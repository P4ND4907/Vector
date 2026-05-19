import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";
import type { DirectVectorCredentials } from "./directVectorCredentials.js";

export interface DirectVectorDriveWheelsPayload {
  leftWheelMmps: number;
  rightWheelMmps: number;
  durationMs?: number;
}

export interface DirectVectorBatteryState {
  battery_volts?: number;
  is_charging?: boolean;
  is_on_charger_platform?: boolean;
}

export interface DirectVectorPhotoInfo {
  photoId: string;
  createdAt: string;
}

export interface DirectVectorImageAsset {
  contentType: string;
  buffer: Uint8Array;
}

export interface DirectVectorClient {
  batteryState: () => Promise<DirectVectorBatteryState>;
  driveWheels: (payload: DirectVectorDriveWheelsPayload) => Promise<void>;
  stopAllMotors: () => Promise<void>;
  sayText: (payload: { text: string }) => Promise<void>;
  playAnimation: (payload: { animationId: string }) => Promise<void>;
  setHeadAngle: (payload: { angleRad: number }) => Promise<void>;
  setLiftHeight: (payload: { heightMm: number }) => Promise<void>;
  driveOnCharger: () => Promise<void>;
  driveOffCharger: () => Promise<void>;
  photosInfo: () => Promise<DirectVectorPhotoInfo[]>;
  photo: (payload: { photoId: string }) => Promise<DirectVectorImageAsset>;
  thumbnail: (payload: { photoId: string }) => Promise<DirectVectorImageAsset>;
  deletePhoto: (payload: { photoId: string }) => Promise<void>;
  close: () => void;
}

type GrpcCallback = (error: grpc.ServiceError | null, response: unknown) => void;

const resolveProtoRoot = () => {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDir, "../../protobufs"),
    path.resolve(process.cwd(), "server/protobufs"),
    path.resolve(process.cwd(), "protobufs")
  ];
  const protoRoot = candidates.find((candidate) =>
    existsSync(path.join(candidate, "anki_vector/messaging/external_interface.proto"))
  );

  if (!protoRoot) {
    throw new Error("Vector protobufs were not found in the packaged server.");
  }

  return protoRoot;
};

const normalizeTarget = (host: string) => {
  const withoutProtocol = host.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
  return withoutProtocol.includes(":") ? withoutProtocol : `${withoutProtocol}:443`;
};

const callUnary = (client: Record<string, unknown>, method: string, payload: unknown) =>
  new Promise<unknown>((resolve, reject) => {
    const rpc = client[method];
    if (typeof rpc !== "function") {
      reject(new Error(`Vector gRPC method ${method} is unavailable.`));
      return;
    }

    const callback: GrpcCallback = (error, response) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    };
    rpc.call(client, payload, callback);
  });

const loadExternalInterface = () => {
  const protoRoot = resolveProtoRoot();
  const packageDefinition = protoLoader.loadSync(
    path.join(protoRoot, "anki_vector/messaging/external_interface.proto"),
    {
      defaults: true,
      enums: String,
      includeDirs: [protoRoot],
      keepCase: true,
      longs: Number,
      oneofs: true
    }
  );
  const loaded = grpc.loadPackageDefinition(packageDefinition) as Record<string, any>;
  return loaded.Anki.Vector.external_interface.ExternalInterface;
};

const toPhotoId = (photoId: string) => {
  const numericPhotoId = Number(photoId);
  if (!Number.isInteger(numericPhotoId) || numericPhotoId < 0) {
    throw new Error("Photo id must be a positive robot photo number.");
  }
  return numericPhotoId;
};

const extractImageBuffer = (response: unknown) => {
  const image = (response as { image?: Uint8Array | Buffer })?.image;
  if (!image || image.length === 0) {
    throw new Error("Vector did not return image data for that photo.");
  }
  return image instanceof Uint8Array ? image : new Uint8Array(image);
};

const timestampToIso = (timestampUtc: unknown) => {
  const seconds = Number(timestampUtc);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return new Date().toISOString();
  }
  return new Date(seconds * 1000).toISOString();
};

export const createDirectVectorGrpcClient = (
  credentials: DirectVectorCredentials
): DirectVectorClient => {
  const ExternalInterface = loadExternalInterface();
  const cert = readFileSync(credentials.certPath);
  const sslCredentials = grpc.credentials.createSsl(cert);
  const authCredentials = grpc.credentials.createFromMetadataGenerator((_params, callback) => {
    const metadata = new grpc.Metadata();
    metadata.set("authorization", `Bearer ${credentials.token}`);
    callback(null, metadata);
  });
  const channelCredentials = grpc.credentials.combineChannelCredentials(sslCredentials, authCredentials);
  const client = new ExternalInterface(
    normalizeTarget(credentials.host),
    channelCredentials,
    {
      "grpc.ssl_target_name_override": credentials.name,
      "grpc.default_authority": credentials.name
    }
  ) as Record<string, unknown> & grpc.Client;

  return {
    batteryState: async () => callUnary(client, "BatteryState", {}) as Promise<DirectVectorBatteryState>,
    driveWheels: async ({ leftWheelMmps, rightWheelMmps }) => {
      await callUnary(client, "DriveWheels", {
        left_wheel_mmps: leftWheelMmps,
        right_wheel_mmps: rightWheelMmps,
        left_wheel_mmps2: Math.max(120, Math.abs(leftWheelMmps) * 4),
        right_wheel_mmps2: Math.max(120, Math.abs(rightWheelMmps) * 4)
      });
    },
    stopAllMotors: async () => {
      await callUnary(client, "StopAllMotors", {});
    },
    sayText: async ({ text }) => {
      await callUnary(client, "SayText", { text, use_vector_voice: true, duration_scalar: 1 });
    },
    playAnimation: async ({ animationId }) => {
      await callUnary(client, "PlayAnimation", {
        animation: { name: animationId },
        loops: 1,
        ignore_body_track: false,
        ignore_head_track: false,
        ignore_lift_track: false
      });
    },
    setHeadAngle: async ({ angleRad }) => {
      await callUnary(client, "SetHeadAngle", {
        angle_rad: angleRad,
        max_speed_rad_per_sec: 2,
        accel_rad_per_sec2: 4,
        duration_sec: 0,
        num_retries: 2
      });
    },
    setLiftHeight: async ({ heightMm }) => {
      await callUnary(client, "SetLiftHeight", {
        height_mm: heightMm,
        max_speed_rad_per_sec: 2,
        accel_rad_per_sec2: 4,
        duration_sec: 0,
        num_retries: 2
      });
    },
    driveOnCharger: async () => {
      await callUnary(client, "DriveOnCharger", {});
    },
    driveOffCharger: async () => {
      await callUnary(client, "DriveOffCharger", {});
    },
    photosInfo: async () => {
      const response = await callUnary(client, "PhotosInfo", {}) as {
        photo_infos?: Array<{ photo_id?: number | string; timestamp_utc?: number | string }>;
      };
      return (response.photo_infos ?? [])
        .map((photo) => ({
          photoId: String(photo.photo_id ?? ""),
          createdAt: timestampToIso(photo.timestamp_utc)
        }))
        .filter((photo) => photo.photoId.length > 0)
        .sort((left, right) => Number(right.photoId) - Number(left.photoId));
    },
    photo: async ({ photoId }) => {
      const response = await callUnary(client, "Photo", { photo_id: toPhotoId(photoId) });
      return {
        contentType: "image/jpeg",
        buffer: extractImageBuffer(response)
      };
    },
    thumbnail: async ({ photoId }) => {
      const response = await callUnary(client, "Thumbnail", { photo_id: toPhotoId(photoId) });
      return {
        contentType: "image/jpeg",
        buffer: extractImageBuffer(response)
      };
    },
    deletePhoto: async ({ photoId }) => {
      await callUnary(client, "DeletePhoto", { photo_id: toPhotoId(photoId) });
    },
    close: () => client.close()
  };
};
