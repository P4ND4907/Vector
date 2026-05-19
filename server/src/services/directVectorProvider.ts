import { buildOfflineRobot } from "../db/localStore.js";
import { batteryVoltageToPercent } from "./localRobotBridge.js";
import { buildWirePodRobotName, clampNumber, deriveSystemStatus, makeLog } from "../robot/hybridRobotSupport.js";
import type { CommandLogRecord, DiscoveredRobot, RobotStatus } from "../robot/types.js";
import {
  readDirectVectorCredentials,
  type DirectVectorCredentialResult,
  type DirectVectorCredentials
} from "./directVectorCredentials.js";
import {
  createDirectVectorGrpcClient,
  type DirectVectorClient
} from "./directVectorGrpcClient.js";

export interface DirectVectorProvider {
  isConfigured: () => Promise<boolean>;
  getCredentialStatus: () => Promise<DirectVectorCredentialResult>;
  discoverRobots: () => Promise<DiscoveredRobot[]>;
  connect: (payload?: Partial<RobotStatus>) => Promise<RobotStatus>;
  disconnect: () => Promise<RobotStatus>;
  getStatus: () => Promise<RobotStatus>;
  drive: (payload: { direction: string; speed: number; durationMs?: number }) => Promise<CommandLogRecord>;
  head: (payload: { angle: number }) => Promise<CommandLogRecord>;
  lift: (payload: { height: number }) => Promise<CommandLogRecord>;
  speak: (payload: { text: string }) => Promise<CommandLogRecord>;
  animation: (payload: { animationId: string }) => Promise<CommandLogRecord>;
  dock: () => Promise<CommandLogRecord>;
  wake: () => Promise<CommandLogRecord>;
  getPhotoIds: () => Promise<Array<{ photoId: string; createdAt: string }>>;
  getPhoto: (photoId: string, variant?: "full" | "thumb") => Promise<{ contentType: string; buffer: Uint8Array }>;
  deletePhoto: (photoId: string) => Promise<CommandLogRecord>;
}

export interface DirectVectorProviderOptions {
  credentialReader?: () => Promise<DirectVectorCredentialResult>;
  clientFactory?: (credentials: DirectVectorCredentials) => DirectVectorClient;
}

const buildRobotFromCredentials = (
  credentials: DirectVectorCredentials,
  battery: {
    battery_volts?: number;
    is_charging?: boolean;
    is_on_charger_platform?: boolean;
  },
  connected: boolean,
  message?: string
): RobotStatus => {
  const batteryPercent = battery.battery_volts ? batteryVoltageToPercent(battery.battery_volts) : 0;
  const name = buildWirePodRobotName(credentials.serial || "direct", credentials.name);
  const robot: RobotStatus = {
    id: `direct-${credentials.serial || credentials.name}`,
    serial: credentials.serial,
    name,
    nickname: credentials.name,
    ipAddress: credentials.host,
    token: "direct-sdk-managed",
    batteryPercent,
    isCharging: Boolean(battery.is_charging),
    isConnected: connected,
    isDocked: Boolean(battery.is_on_charger_platform),
    lastSeen: new Date().toISOString(),
    firmwareVersion: connected ? "Direct Vector SDK" : "Direct Vector offline",
    mood: !connected ? "sleepy" : battery.is_charging ? "charging" : "ready",
    connectionState: connected ? "connected" : "error",
    wifiStrength: connected ? 100 : 0,
    isMuted: false,
    volume: 3,
    cameraAvailable: connected,
    connectionSource: "direct",
    systemStatus: "ready",
    currentActivity: message || (connected ? "Ready through direct Vector SDK." : "Direct Vector SDK offline.")
  };

  return {
    ...robot,
    systemStatus: deriveSystemStatus(robot)
  };
};

const buildOfflineDirectRobot = (credentialStatus: DirectVectorCredentialResult) =>
  buildOfflineRobot(
    {
      selectedSerial: credentialStatus.ok ? credentialStatus.credentials.serial : undefined,
      aliases: credentialStatus.ok && credentialStatus.credentials.serial
        ? { [credentialStatus.credentials.serial]: credentialStatus.credentials.name }
        : {},
      token: "direct-sdk-managed"
    },
    credentialStatus.ok
      ? "Direct Vector SDK offline."
      : credentialStatus.note,
    "direct"
  );

export const createDirectVectorProvider = (
  options: DirectVectorProviderOptions = {}
): DirectVectorProvider => {
  const readCredentials = options.credentialReader ?? readDirectVectorCredentials;
  const createClient = options.clientFactory ?? createDirectVectorGrpcClient;

  const withClient = async <T>(action: (client: DirectVectorClient, credentials: DirectVectorCredentials) => Promise<T>) => {
    const credentialStatus = await readCredentials();
    if (!credentialStatus.ok) {
      throw new Error(credentialStatus.note);
    }

    const client = createClient(credentialStatus.credentials);
    try {
      return await action(client, credentialStatus.credentials);
    } finally {
      client.close();
    }
  };

  const getCredentialStatus = () => readCredentials();

  return {
    isConfigured: async () => (await getCredentialStatus()).ok,
    getCredentialStatus,
    discoverRobots: async () => {
      const credentialStatus = await getCredentialStatus();
      if (!credentialStatus.ok) {
        return [];
      }

      const { credentials } = credentialStatus;
      return [
        {
          id: credentials.serial || credentials.name,
          serial: credentials.serial || "",
          name: buildWirePodRobotName(credentials.serial || "direct", credentials.name),
          ipAddress: credentials.host,
          signalStrength: 100,
          secure: true,
          activated: true,
          lastSeen: new Date().toISOString()
        }
      ];
    },
    connect: async () => {
      return withClient(async (client, credentials) => {
        const battery = await client.batteryState();
        return buildRobotFromCredentials(credentials, battery, true, "Connected through direct Vector SDK.");
      });
    },
    disconnect: async () => {
      const credentialStatus = await getCredentialStatus();
      return {
        ...buildOfflineDirectRobot(credentialStatus),
        connectionState: "disconnected",
        currentActivity: "Disconnected from direct Vector SDK."
      };
    },
    getStatus: async () => {
      const credentialStatus = await getCredentialStatus();
      if (!credentialStatus.ok) {
        return buildOfflineDirectRobot(credentialStatus);
      }

      try {
        return await withClient(async (client, credentials) =>
          buildRobotFromCredentials(credentials, await client.batteryState(), true)
        );
      } catch (error) {
        return buildRobotFromCredentials(
          credentialStatus.credentials,
          {},
          false,
          error instanceof Error ? error.message : "Direct Vector SDK offline."
        );
      }
    },
    drive: async ({ direction, speed, durationMs }) => {
      return withClient(async (client) => {
        const wheelSpeed = Math.round(clampNumber(speed, 10, 100) * 1.9);
        const commands =
          direction === "forward"
            ? { leftWheelMmps: wheelSpeed, rightWheelMmps: wheelSpeed, message: `Driving forward at ${speed}% speed.` }
            : direction === "reverse"
              ? { leftWheelMmps: -wheelSpeed, rightWheelMmps: -wheelSpeed, message: `Driving backward at ${speed}% speed.` }
              : direction === "left"
                ? { leftWheelMmps: -wheelSpeed, rightWheelMmps: wheelSpeed, message: "Turning left." }
                : direction === "right"
                  ? { leftWheelMmps: wheelSpeed, rightWheelMmps: -wheelSpeed, message: "Turning right." }
                  : { leftWheelMmps: 0, rightWheelMmps: 0, message: "Stop command sent." };

        if (direction === "stop") {
          await client.stopAllMotors();
        } else {
          await client.driveWheels({
            leftWheelMmps: commands.leftWheelMmps,
            rightWheelMmps: commands.rightWheelMmps,
            durationMs
          });
        }

        return makeLog("drive", { direction, speed, durationMs }, "success", commands.message);
      });
    },
    head: async ({ angle }) => {
      return withClient(async (client) => {
        const clampedAngle = clampNumber(angle, -22, 45);
        await client.setHeadAngle({ angleRad: clampedAngle * Math.PI / 180 });
        return makeLog("head", { angle }, "success", `Head adjusted to ${clampedAngle} degrees.`);
      });
    },
    lift: async ({ height }) => {
      return withClient(async (client) => {
        const heightMm = clampNumber(height, 0, 100) * 0.92;
        await client.setLiftHeight({ heightMm });
        return makeLog("lift", { height }, "success", `Lift adjusted to ${height}%.`);
      });
    },
    speak: async ({ text }) => {
      return withClient(async (client) => {
        await client.sayText({ text });
        return makeLog("speak", { text }, "success", `Speaking: ${text}`);
      });
    },
    animation: async ({ animationId }) => {
      return withClient(async (client) => {
        await client.playAnimation({ animationId });
        return makeLog("animation", { animationId }, "success", `Animation intent sent for ${animationId}.`);
      });
    },
    dock: async () => {
      return withClient(async (client) => {
        await client.driveOnCharger();
        return makeLog("dock", {}, "success", "Vector is returning to the charger.");
      });
    },
    wake: async () => {
      return withClient(async (client) => {
        await client.driveOffCharger();
        return makeLog("wake", {}, "success", "Wake command sent through direct Vector SDK.");
      });
    },
    getPhotoIds: async () => withClient(async (client) => client.photosInfo()),
    getPhoto: async (photoId, variant = "full") =>
      withClient(async (client) =>
        variant === "thumb" ? client.thumbnail({ photoId }) : client.photo({ photoId })
      ),
    deletePhoto: async (photoId) => {
      return withClient(async (client) => {
        await client.deletePhoto({ photoId });
        return makeLog("photo-delete", { photoId }, "success", `Deleted Vector photo ${photoId}.`);
      });
    }
  };
};
