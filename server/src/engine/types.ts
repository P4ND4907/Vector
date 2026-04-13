// Engine provider types
export type EngineProviderName = "embedded" | "wirepod" | "mock";

export interface EngineProviderStatus {
  provider: EngineProviderName;
  available: boolean;
  connected: boolean;
  note: string;
  protocolGaps: string[];
}

export interface EngineSettings {
  activeProvider: EngineProviderName;
  wirepodBaseUrl: string;
  wirepodTimeoutMs: number;
  autoFallback: boolean;
}
