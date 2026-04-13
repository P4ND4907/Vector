export type EngineProviderId = "embedded" | "wirepod" | "mock";
export type LicenseTier = "free" | "pro";

export interface EngineSettings {
  provider: EngineProviderId;
  embedded: {
    preferredIp: string;
    preferredSerial: string;
    allowFallbackScan: boolean;
    reconnectOnStartup: boolean;
  };
  wirepod: {
    endpoint: string;
    reconnectOnStartup: boolean;
  };
  mock: {
    enabled: boolean;
  };
}

export interface PairingRecord {
  id: string;
  name: string;
  serial?: string;
  ipAddress: string;
  token: string;
  pairedAt: string;
  provider: EngineProviderId;
}

export interface EngineHealth {
  ok: boolean;
  provider: EngineProviderId;
  label: string;
  detail: string;
  legacyWirePodMention?: string;
}

export interface EngineRobotCandidate {
  id: string;
  name: string;
  serial?: string;
  ipAddress: string;
  signalStrength: number;
  secure: boolean;
  activated?: boolean;
  lastSeen: string;
  source: "saved" | "scan" | "bridge" | "manual" | "mock";
}

export interface EngineRobotStatus {
  id: string;
  name: string;
  serial?: string;
  ipAddress: string;
  isConnected: boolean;
  isCharging: boolean;
  isDocked: boolean;
  batteryPercent: number;
  lastSeen: string;
  firmwareVersion: string;
  currentActivity: string;
  provider: EngineProviderId;
}

export interface EngineDiagnostics {
  provider: EngineProviderId;
  summary: string;
  detail: string[];
  robot?: EngineRobotStatus;
}

export interface BridgeProvider {
  readonly id: EngineProviderId;
  readonly label: string;
  init(): Promise<void>;
  health(): Promise<EngineHealth>;
  discoverRobots(): Promise<EngineRobotCandidate[]>;
  pairRobot(input: { name: string; serial?: string; ipAddress: string; token?: string }): Promise<PairingRecord>;
  connect(): Promise<EngineRobotStatus>;
  disconnect(): Promise<EngineRobotStatus>;
  getStatus(): Promise<EngineRobotStatus>;
  drive(input: { direction: string; speed: number; durationMs?: number }): Promise<{ ok: boolean; message: string }>;
  setHeadAngle(input: { angle: number }): Promise<{ ok: boolean; message: string }>;
  setLiftHeight(input: { height: number }): Promise<{ ok: boolean; message: string }>;
  speak(input: { text: string }): Promise<{ ok: boolean; message: string }>;
  dock(): Promise<{ ok: boolean; message: string }>;
  wake(): Promise<{ ok: boolean; message: string }>;
  sleep(): Promise<{ ok: boolean; message: string }>;
  getPhotoList(): Promise<Array<{ id: string; label: string; createdAt: string }>>;
  downloadPhoto(photoId: string): Promise<{ id: string; label: string; dataUrl: string } | null>;
  getDiagnostics(): Promise<EngineDiagnostics>;
}
