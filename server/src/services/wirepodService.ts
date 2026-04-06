import { Buffer } from "node:buffer";
import type {
  ManagedBridgeStatusRecord,
  RuntimeSettings,
  WirePodConnectionMode,
  WirePodProbeResult
} from "../robot/types.js";

const DEFAULT_TIMEOUT_MS = 4_000;
const PROBE_TIMEOUT_MS = 1_500;
const BATTERY_TIMEOUT_MS = 2_000;
const HEALTHY_CACHE_MS = 3_000;
const FAILURE_CACHE_MS = 3_000;
const SDK_INFO_CACHE_MS = 2_000;
const DEFAULT_ENDPOINTS = ["http://localhost:8080", "http://127.0.0.1:8080"];

// TODO: if your local WirePod build uses different route names, update them here.
// This file is the single source of truth for WirePod integration assumptions.
const ROUTES = {
  sdkInfo: "/api-sdk/get_sdk_info",
  sdkSettings: "/api-sdk/get_sdk_settings",
  assumeBehaviorControl: "/api-sdk/assume_behavior_control",
  releaseBehaviorControl: "/api-sdk/release_behavior_control",
  sayText: "/api-sdk/say_text",
  moveWheels: "/api-sdk/move_wheels",
  moveHead: "/api-sdk/move_head",
  moveLift: "/api-sdk/move_lift",
  battery: "/api-sdk/get_battery",
  cloudIntent: "/api-sdk/cloud_intent",
  triggerWakeWord: "/api-sdk/trigger_wake_word",
  volume: "/api-sdk/volume",
  locale: "/api-sdk/locale",
  buttonHeyVector: "/api-sdk/button_hey_vector",
  getImageIds: "/api-sdk/get_image_ids",
  getImage: "/api-sdk/get_image",
  getImageThumb: "/api-sdk/get_image_thumb",
  deleteImage: "/api-sdk/delete_image",
  camStream: "/cam-stream",
  getLogs: "/api/get_logs",
  getDebugLogs: "/api/get_debug_logs",
  getWeatherApi: "/api/get_weather_api",
  setWeatherApi: "/api/set_weather_api",
  getConfig: "/api/get_config",
  getSttInfo: "/api/get_stt_info",
  setSttInfo: "/api/set_stt_info",
  getDownloadStatus: "/api/get_download_status",
  useEscapePod: "/api-chipper/use_ep",
  useIp: "/api-chipper/use_ip"
} as const;

export interface WirePodRobotRecord {
  esn: string;
  ip_address: string;
  guid: string;
  activated: boolean;
}

export interface WirePodSdkInfo {
  global_guid: string;
  robots: WirePodRobotRecord[];
}

export interface WirePodBatteryStatus {
  battery_level?: number;
  battery_volts?: number;
  is_on_charger_platform?: boolean;
  is_charging?: boolean;
  suggested_charger_sec?: number;
}

export interface WirePodSdkSettings {
  button_wakeword?: number;
  locale?: string;
  master_volume?: number;
}

export interface WirePodWeatherApiConfig {
  enable: boolean;
  provider: string;
  key: string;
  unit?: string;
}

export interface WirePodConfig {
  STT?: {
    provider?: string;
    language?: string;
  };
  server?: {
    epconfig?: boolean;
    port?: string;
  };
  pastinitialsetup?: boolean;
}

export interface WirePodSttInfo {
  provider?: string;
  language?: string;
}

interface WirePodServiceOptions {
  initialEndpoint: string;
  timeoutMs?: number;
  getSettings: () => RuntimeSettings;
  beforeDetectEndpoints?: () => Promise<void>;
  getManagedBridgeStatus?: () => ManagedBridgeStatusRecord;
  onEndpointResolved: (endpoint: string, probes: WirePodProbeResult[]) => void;
  onEndpointFailure: (probes: WirePodProbeResult[], error: string) => void;
}

const unique = (values: Array<string | undefined | null>) =>
  values.filter((value, index, items): value is string => Boolean(value) && items.indexOf(value) === index);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getSpeechHoldMs = (text: string) => Math.min(10_000, Math.max(5_500, text.trim().length * 95));

const normalizeFetchError = (error: unknown, fallbackMessage: string) => {
  if (!(error instanceof Error)) {
    return fallbackMessage;
  }

  const message = error.message.toLowerCase();

  if (message.includes("aborted") || message.includes("timeout")) {
    return fallbackMessage;
  }

  if (message.includes("fetch failed") || message.includes("connect") || message.includes("refused")) {
    return fallbackMessage;
  }

  return error.message;
};

export const batteryVoltageToPercent = (voltage?: number) => {
  if (!voltage) {
    return 70;
  }

  const maxVoltage = 4.1;
  const midVoltage = 3.85;
  const minVoltage = 3.5;

  if (voltage >= maxVoltage) {
    return 100;
  }

  if (voltage >= midVoltage) {
    const scaledVoltage = (voltage - midVoltage) / (maxVoltage - midVoltage);
    return Math.max(0, Math.min(100, Math.round(80 + 20 * Math.log10(1 + scaledVoltage * 9))));
  }

  if (voltage >= minVoltage) {
    const scaledVoltage = (voltage - minVoltage) / (midVoltage - minVoltage);
    return Math.max(0, Math.min(100, Math.round(80 * Math.log10(1 + scaledVoltage * 9))));
  }

  return 0;
};

export const createWirePodService = ({
  initialEndpoint,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  getSettings,
  beforeDetectEndpoints,
  getManagedBridgeStatus,
  onEndpointResolved,
  onEndpointFailure
}: WirePodServiceOptions) => {
  let activeEndpoint = initialEndpoint.trim();
  let queue = Promise.resolve();
  let lastProbes: WirePodProbeResult[] = [];
  let lastHealthyProbeAt = 0;
  let lastFailureAt = 0;
  let lastFailureMessage = "Vector brain offline";
  let sdkInfoCache: { endpoint: string; expiresAt: number; value: WirePodSdkInfo } | null = null;

  const invalidateCaches = () => {
    sdkInfoCache = null;
  };

  const rawRequest = async (
    endpoint: string,
    path: string,
    init?: RequestInit,
    requestTimeoutMs = timeoutMs
  ) => {
    const response = await fetch(`${endpoint}${path}`, {
      ...init,
      signal: AbortSignal.timeout(requestTimeoutMs)
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `WirePod request failed with status ${response.status}.`);
    }

    return response;
  };

  const requestJson = async <T,>(
    endpoint: string,
    path: string,
    init?: RequestInit,
    requestTimeoutMs = timeoutMs
  ) => (await rawRequest(endpoint, path, init, requestTimeoutMs)).json() as Promise<T>;

  const requestText = async (
    endpoint: string,
    path: string,
    init?: RequestInit,
    requestTimeoutMs = timeoutMs
  ) => (await rawRequest(endpoint, path, init, requestTimeoutMs)).text();

  const requestBinary = async (
    endpoint: string,
    path: string,
    init?: RequestInit,
    requestTimeoutMs = timeoutMs
  ) => {
    const response = await rawRequest(endpoint, path, init, requestTimeoutMs);
    return {
      contentType: response.headers.get("content-type") || "application/octet-stream",
      buffer: Buffer.from(await response.arrayBuffer())
    };
  };

  const requestSdkPostForm = async (
    endpoint: string,
    path: string,
    requestTimeoutMs = timeoutMs
  ) =>
    requestText(
      endpoint,
      path,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      },
      requestTimeoutMs
    );

  const requestSdkText = async (
    endpoint: string,
    path: string,
    requestTimeoutMs = timeoutMs
  ) => {
    try {
      return await requestText(endpoint, path, undefined, requestTimeoutMs);
    } catch {
      return requestText(endpoint, path, { method: "POST" }, requestTimeoutMs);
    }
  };

  const requestSdkJson = async <T,>(
    endpoint: string,
    path: string,
    requestTimeoutMs = timeoutMs
  ) => {
    try {
      return await requestJson<T>(endpoint, path, undefined, requestTimeoutMs);
    } catch {
      return requestJson<T>(endpoint, path, { method: "POST" }, requestTimeoutMs);
    }
  };

  const waitForDownloadStatus = async (endpoint: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await sleep(500);
      const status = await requestText(
        endpoint,
        ROUTES.getDownloadStatus,
        undefined,
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      ).catch(() => "Language model download still in progress.");

      if (status.includes("success")) {
        return status;
      }

      if (status.includes("error")) {
        throw new Error(status);
      }
    }

    throw new Error("Language model download is taking longer than expected.");
  };

  const buildCandidates = () => {
    const settings = getSettings();
    const managedBridgeStatus = getManagedBridgeStatus?.();
    return unique([
      managedBridgeStatus?.endpoint,
      activeEndpoint,
      settings.savedWirePodEndpoint,
      ...DEFAULT_ENDPOINTS,
      settings.customWirePodEndpoint.trim()
    ]);
  };

  const probeEndpoint = async (
    endpoint: string,
    source: WirePodProbeResult["source"]
  ): Promise<WirePodProbeResult> => {
    const startedAt = Date.now();

    try {
      await requestSdkJson<WirePodSdkInfo>(endpoint, ROUTES.sdkInfo, Math.min(timeoutMs, PROBE_TIMEOUT_MS));
      return {
        endpoint,
        source,
        ok: true,
        latencyMs: Date.now() - startedAt
      };
    } catch (error) {
      return {
        endpoint,
        source,
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: normalizeFetchError(error, "WirePod probe timed out.")
      };
    }
  };

  const detectEndpoint = async () => {
    await beforeDetectEndpoints?.();
    const candidates = buildCandidates();
    const settings = getSettings();
    const probes = await Promise.all(
      candidates.map((candidate) => {
        const source =
          candidate === activeEndpoint
            ? "active"
            : candidate === settings.savedWirePodEndpoint
              ? "saved"
              : candidate === settings.customWirePodEndpoint.trim()
                ? "custom"
                : "default";

        return probeEndpoint(candidate, source);
      })
    );

    const resolved = probes.find((probe) => probe.ok);
    if (resolved) {
      activeEndpoint = resolved.endpoint;
      lastProbes = probes;
      lastHealthyProbeAt = Date.now();
      lastFailureAt = 0;
      lastFailureMessage = "";
      invalidateCaches();
      onEndpointResolved(resolved.endpoint, probes);
      return resolved.endpoint;
    }

    lastProbes = probes;
    activeEndpoint = "";
    invalidateCaches();
    lastFailureAt = Date.now();
    lastFailureMessage = "Vector brain offline";
    onEndpointFailure(probes, lastFailureMessage);
    throw new Error(lastFailureMessage);
  };

  const ensureEndpoint = async () => {
    const settings = getSettings();

    if (!settings.autoDetectWirePod && settings.customWirePodEndpoint.trim()) {
      activeEndpoint = settings.customWirePodEndpoint.trim();
      return activeEndpoint;
    }

    if (activeEndpoint && Date.now() - lastHealthyProbeAt < HEALTHY_CACHE_MS) {
      return activeEndpoint;
    }

    if (!activeEndpoint && Date.now() - lastFailureAt < FAILURE_CACHE_MS) {
      throw new Error(lastFailureMessage || "Vector brain offline");
    }

    if (activeEndpoint) {
      const probe = await probeEndpoint(activeEndpoint, "active");
      if (probe.ok) {
        lastProbes = [probe];
        lastHealthyProbeAt = Date.now();
        lastFailureAt = 0;
        lastFailureMessage = "";
        onEndpointResolved(activeEndpoint, [probe]);
        return activeEndpoint;
      }
    }

    return detectEndpoint();
  };

  const enqueue = async <T,>(work: () => Promise<T>) => {
    const result = queue.then(work, work);
    queue = result.then(
      async () => {
        await sleep(0);
      },
      async () => {
        await sleep(0);
      }
    );
    return result;
  };

  const withBehaviorControl = async <T>(serial: string, work: (endpoint: string) => Promise<T>) =>
    enqueue(async () => {
      const endpoint = await ensureEndpoint();
      await requestSdkText(
        endpoint,
        `${ROUTES.assumeBehaviorControl}?priority=high&serial=${encodeURIComponent(serial)}`
      );

      try {
        return await work(endpoint);
      } finally {
        await requestSdkText(
          endpoint,
          `${ROUTES.releaseBehaviorControl}?priority=high&serial=${encodeURIComponent(serial)}`
        );
      }
    });

  const requestMoveWheels = async (
    endpoint: string,
    serial: string,
    left: number,
    right: number
  ) => {
    // TODO: WirePod's sdkapp source reads lw/rw, while some wrappers document left/right.
    // Try lw/rw first so the call does not falsely succeed with zero wheel movement.
    try {
      return await requestSdkText(
        endpoint,
        `${ROUTES.moveWheels}?lw=${left}&rw=${right}&serial=${encodeURIComponent(serial)}`
      );
    } catch {
      return requestSdkText(
        endpoint,
        `${ROUTES.moveWheels}?left=${left}&right=${right}&serial=${encodeURIComponent(serial)}`
      );
    }
  };

  const requestMoveSpeed = async (
    endpoint: string,
    route: (typeof ROUTES)["moveHead"] | (typeof ROUTES)["moveLift"],
    serial: string,
    speed: number
  ) =>
    requestSdkPostForm(
      endpoint,
      `${route}?speed=${speed}&serial=${encodeURIComponent(serial)}`
    );

  const requestSayText = async (
    endpoint: string,
    serial: string,
    text: string
  ) => {
    const queryPath = `${ROUTES.sayText}?text=${encodeURIComponent(text)}&serial=${encodeURIComponent(serial)}`;

    try {
      return await requestText(endpoint, queryPath, undefined, timeoutMs);
    } catch {
      return requestSdkPostForm(endpoint, queryPath, timeoutMs);
    }
  };

  return {
    detectEndpoint,
    getActiveEndpoint: () => activeEndpoint,
    getLastProbes: () => lastProbes,
    async getSdkInfo() {
      const endpoint = await ensureEndpoint();
      if (sdkInfoCache && sdkInfoCache.endpoint === endpoint && sdkInfoCache.expiresAt > Date.now()) {
        return sdkInfoCache.value;
      }

      const value = await requestSdkJson<WirePodSdkInfo>(
        endpoint,
        ROUTES.sdkInfo,
        Math.min(timeoutMs, PROBE_TIMEOUT_MS)
      );
      sdkInfoCache = {
        endpoint,
        expiresAt: Date.now() + SDK_INFO_CACHE_MS,
        value
      };
      return value;
    },
    async getBattery(serial: string) {
      const endpoint = await ensureEndpoint();
      try {
        return await requestSdkJson<WirePodBatteryStatus>(
          endpoint,
          `${ROUTES.battery}?serial=${encodeURIComponent(serial)}`,
          Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
        );
      } catch (error) {
        throw new Error(
          normalizeFetchError(error, "Vector is not responding through WirePod right now.")
        );
      }
    },
    async getSdkSettings(serial: string) {
      const endpoint = await ensureEndpoint();
      return requestSdkJson<WirePodSdkSettings>(
        endpoint,
        `${ROUTES.sdkSettings}?serial=${encodeURIComponent(serial)}`,
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      );
    },
    async getLogs() {
      const endpoint = await ensureEndpoint();
      return requestText(endpoint, ROUTES.getLogs, undefined, Math.min(timeoutMs, BATTERY_TIMEOUT_MS));
    },
    async getDebugLogs() {
      const endpoint = await ensureEndpoint();
      return requestText(endpoint, ROUTES.getDebugLogs, undefined, Math.min(timeoutMs, BATTERY_TIMEOUT_MS));
    },
    async getConfig() {
      const endpoint = await ensureEndpoint();
      return requestJson<WirePodConfig>(
        endpoint,
        ROUTES.getConfig,
        undefined,
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      );
    },
    async getSttInfo() {
      const endpoint = await ensureEndpoint();
      return requestJson<WirePodSttInfo>(
        endpoint,
        ROUTES.getSttInfo,
        undefined,
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      );
    },
    async finishInitialSetup({
      language = "en-US",
      connectionMode = "escape-pod",
      port = "443"
    }: {
      language?: string;
      connectionMode?: Exclude<WirePodConnectionMode, "unknown">;
      port?: string;
    }) {
      const endpoint = await ensureEndpoint();
      const languageResponse = await rawRequest(
        endpoint,
        ROUTES.setSttInfo,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ language })
        },
        timeoutMs
      ).then((response) => response.text());

      if (languageResponse.includes("downloading")) {
        await waitForDownloadStatus(endpoint);
      } else if (languageResponse.includes("error")) {
        throw new Error(languageResponse);
      }

      const connectionPath =
        connectionMode === "ip"
          ? `${ROUTES.useIp}?port=${encodeURIComponent(port || "443")}`
          : ROUTES.useEscapePod;

      await requestText(endpoint, connectionPath, undefined, timeoutMs);
      await sleep(750);

      return {
        config: await requestJson<WirePodConfig>(
          endpoint,
          ROUTES.getConfig,
          undefined,
          Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
        ),
        stt: await requestJson<WirePodSttInfo>(
          endpoint,
          ROUTES.getSttInfo,
          undefined,
          Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
        )
      };
    },
    async getWeatherApiConfig() {
      const endpoint = await ensureEndpoint();
      return requestJson<WirePodWeatherApiConfig>(
        endpoint,
        ROUTES.getWeatherApi,
        undefined,
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      );
    },
    async setWeatherApiConfig(config: { provider: string; key: string; unit?: string }) {
      const endpoint = await ensureEndpoint();
      await rawRequest(
        endpoint,
        ROUTES.setWeatherApi,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            provider: config.provider,
            key: config.key,
            unit: config.unit
          })
        },
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      );

      return requestJson<WirePodWeatherApiConfig>(
        endpoint,
        ROUTES.getWeatherApi,
        undefined,
        Math.min(timeoutMs, BATTERY_TIMEOUT_MS)
      );
    },
    async sayText(serial: string, text: string) {
      return withBehaviorControl(serial, async (endpoint) => {
        await sleep(850);
        await requestSayText(endpoint, serial, text);
        await sleep(getSpeechHoldMs(text));
      });
    },
    async moveWheels(serial: string, left: number, right: number, durationMs = 650) {
      return withBehaviorControl(serial, async (endpoint) => {
        await requestMoveWheels(endpoint, serial, left, right);
        if (durationMs > 0) {
          await sleep(durationMs);
          await requestMoveWheels(endpoint, serial, 0, 0);
        }
      });
    },
    async stop(serial: string) {
      return withBehaviorControl(serial, async (endpoint) =>
        requestMoveWheels(endpoint, serial, 0, 0)
      );
    },
    async moveHead(serial: string, speed: number, durationMs = 260) {
      return withBehaviorControl(serial, async (endpoint) => {
        await requestMoveSpeed(endpoint, ROUTES.moveHead, serial, speed);
        if (durationMs > 0) {
          await sleep(durationMs);
          await requestMoveSpeed(endpoint, ROUTES.moveHead, serial, 0);
        }
      });
    },
    async moveLift(serial: string, speed: number, durationMs = 260) {
      return withBehaviorControl(serial, async (endpoint) => {
        await requestMoveSpeed(endpoint, ROUTES.moveLift, serial, speed);
        if (durationMs > 0) {
          await sleep(durationMs);
          await requestMoveSpeed(endpoint, ROUTES.moveLift, serial, 0);
        }
      });
    },
    async dock(serial: string) {
      return withBehaviorControl(serial, async (endpoint) => {
        await requestMoveWheels(endpoint, serial, 0, 0).catch(() => undefined);
        await sleep(250);
        await requestSdkText(
          endpoint,
          `${ROUTES.cloudIntent}?intent=${encodeURIComponent("intent_system_charger")}&serial=${encodeURIComponent(serial)}`
        );
        await sleep(700);
      });
    },
    async takePhoto(serial: string) {
      return withBehaviorControl(serial, async (endpoint) =>
        requestSdkText(
          endpoint,
          `${ROUTES.cloudIntent}?intent=${encodeURIComponent("intent_photo_take_extend")}&serial=${encodeURIComponent(serial)}`
        )
      );
    },
    async wake(serial: string) {
      return withBehaviorControl(serial, async (endpoint) => {
        try {
          return await requestSdkText(
            endpoint,
            `${ROUTES.triggerWakeWord}?serial=${encodeURIComponent(serial)}`
          );
        } catch {
          return requestSdkText(
            endpoint,
            `${ROUTES.cloudIntent}?intent=${encodeURIComponent("intent_system_wake")}&serial=${encodeURIComponent(serial)}`
          );
        }
      });
    },
    async playAnimation(serial: string, intent: string) {
      return withBehaviorControl(serial, async (endpoint) =>
        requestSdkText(
          endpoint,
          `${ROUTES.cloudIntent}?intent=${encodeURIComponent(intent)}&serial=${encodeURIComponent(serial)}`
        )
      );
    },
    async setVolume(serial: string, volume: number) {
      return withBehaviorControl(serial, async (endpoint) =>
        requestSdkText(
          endpoint,
          `${ROUTES.volume}?volume=${Math.max(0, Math.min(5, volume))}&serial=${encodeURIComponent(serial)}`
        )
      );
    },
    async setLocale(serial: string, locale: string) {
      const endpoint = await ensureEndpoint();
      return requestSdkPostForm(
        endpoint,
        `${ROUTES.locale}?locale=${encodeURIComponent(locale)}&serial=${encodeURIComponent(serial)}`
      );
    },
    async setButtonHeyVector(serial: string) {
      const endpoint = await ensureEndpoint();
      return requestSdkPostForm(
        endpoint,
        `${ROUTES.buttonHeyVector}?serial=${encodeURIComponent(serial)}`
      );
    },
    async getImageIds(serial: string) {
      const endpoint = await ensureEndpoint();
      const raw = await requestSdkText(
        endpoint,
        `${ROUTES.getImageIds}?serial=${encodeURIComponent(serial)}`
      );

      if (!raw || raw === "null") {
        return [] as string[];
      }

      try {
        const parsed = JSON.parse(raw) as Array<string | number>;
        return Array.isArray(parsed) ? parsed.map((value) => String(value)) : [];
      } catch {
        return [];
      }
    },
    async getImage(serial: string, photoId: string, variant: "full" | "thumb" = "full") {
      const endpoint = await ensureEndpoint();
      const route = variant === "thumb" ? ROUTES.getImageThumb : ROUTES.getImage;
      return requestBinary(
        endpoint,
        `${route}?serial=${encodeURIComponent(serial)}&id=${encodeURIComponent(photoId)}`
      );
    },
    async deleteImage(serial: string, photoId: string) {
      const endpoint = await ensureEndpoint();
      return requestSdkPostForm(
        endpoint,
        `${ROUTES.deleteImage}?serial=${encodeURIComponent(serial)}&id=${encodeURIComponent(photoId)}`
      );
    },
    async getCameraStreamUrl(serial: string) {
      const endpoint = await ensureEndpoint();
      return `${endpoint}${ROUTES.camStream}?serial=${encodeURIComponent(serial)}`;
    }
  };
};
