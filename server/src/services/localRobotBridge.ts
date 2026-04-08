import type { Buffer } from "node:buffer";
import {
  batteryVoltageToPercent,
  createWirePodService,
  type WirePodBatteryStatus,
  type WirePodConfig,
  type WirePodSdkInfo,
  type WirePodSdkSettings,
  type WirePodSttInfo,
  type WirePodWeatherApiConfig
} from "./wirepodService.js";
import type {
  ManagedBridgeStatusRecord,
  RuntimeSettings,
  WirePodConnectionMode,
  WirePodProbeResult
} from "../robot/types.js";

export type LocalRobotBridgeProvider = "wirepod";

export interface LocalRobotBridgeService {
  provider: LocalRobotBridgeProvider;
  label: string;
  detectEndpoint: () => Promise<string>;
  getActiveEndpoint: () => string;
  getLastProbes: () => WirePodProbeResult[];
  getSdkInfo: () => Promise<WirePodSdkInfo>;
  getBattery: (serial: string) => Promise<WirePodBatteryStatus>;
  getSdkSettings: (serial: string) => Promise<WirePodSdkSettings>;
  getLogs: () => Promise<string>;
  getDebugLogs: () => Promise<string>;
  getConfig: () => Promise<WirePodConfig>;
  getSttInfo: () => Promise<WirePodSttInfo>;
  finishInitialSetup: (payload?: {
    language?: string;
    connectionMode?: Exclude<WirePodConnectionMode, "unknown">;
    port?: string;
  }) => Promise<{
    config: WirePodConfig;
    stt: WirePodSttInfo;
  }>;
  getWeatherApiConfig: () => Promise<WirePodWeatherApiConfig>;
  setWeatherApiConfig: (config: {
    provider: string;
    key: string;
    unit?: string;
  }) => Promise<WirePodWeatherApiConfig>;
  sayText: (serial: string, text: string) => Promise<unknown>;
  moveWheels: (serial: string, left: number, right: number, durationMs?: number) => Promise<unknown>;
  stop: (serial: string) => Promise<unknown>;
  moveHead: (serial: string, speed: number, durationMs?: number) => Promise<unknown>;
  moveLift: (serial: string, speed: number, durationMs?: number) => Promise<unknown>;
  dock: (serial: string) => Promise<unknown>;
  takePhoto: (serial: string) => Promise<unknown>;
  wake: (serial: string) => Promise<unknown>;
  playAnimation: (serial: string, intent: string) => Promise<unknown>;
  setVolume: (serial: string, volume: number) => Promise<unknown>;
  setLocale: (serial: string, locale: string) => Promise<unknown>;
  setButtonHeyVector: (serial: string) => Promise<unknown>;
  getImageIds: (serial: string) => Promise<string[]>;
  getImage: (
    serial: string,
    photoId: string,
    variant?: "full" | "thumb"
  ) => Promise<{ contentType: string; buffer: Buffer }>;
  deleteImage: (serial: string, photoId: string) => Promise<unknown>;
  getCameraStreamUrl: (serial: string) => Promise<string>;
}

interface LocalRobotBridgeOptions {
  initialEndpoint: string;
  timeoutMs?: number;
  getSettings: () => RuntimeSettings;
  beforeDetectEndpoints?: () => Promise<void>;
  getManagedBridgeStatus?: () => ManagedBridgeStatusRecord;
  onEndpointResolved: (endpoint: string, probes: WirePodProbeResult[]) => void;
  onEndpointFailure: (probes: WirePodProbeResult[], error: string) => void;
}

export const createLocalRobotBridgeService = (
  options: LocalRobotBridgeOptions
): LocalRobotBridgeService => {
  const bridge = createWirePodService(options);

  return {
    provider: "wirepod",
    label: "WirePod compatibility bridge",
    ...bridge,
    finishInitialSetup: (payload) => bridge.finishInitialSetup(payload ?? {})
  };
};

export { batteryVoltageToPercent };
