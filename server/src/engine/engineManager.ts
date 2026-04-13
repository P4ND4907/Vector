import type { RobotController } from "../robot/types.js";
import { createEmbeddedProvider, getEmbeddedProviderStatus } from "./embeddedProvider.js";
import { createWirepodProvider, getWirepodProviderStatus } from "./wirepodProvider.js";
import { createMockProvider, getMockProviderStatus } from "./mockProvider.js";
import type { EngineProviderName, EngineProviderStatus, EngineSettings } from "./types.js";

interface EngineManagerOptions {
  wirepodBaseUrl: string;
  wirepodTimeoutMs: number;
  dataFilePath: string;
}

const DEFAULT_SETTINGS: EngineSettings = {
  activeProvider: "wirepod",
  wirepodBaseUrl: "http://127.0.0.1:8080",
  wirepodTimeoutMs: 4000,
  autoFallback: true
};

export class EngineManager {
  private settings: EngineSettings;
  private wirepodOptions: EngineManagerOptions;
  private providers = new Map<EngineProviderName, RobotController>();

  constructor(options: EngineManagerOptions) {
    this.wirepodOptions = options;
    this.settings = {
      ...DEFAULT_SETTINGS,
      wirepodBaseUrl: options.wirepodBaseUrl,
      wirepodTimeoutMs: options.wirepodTimeoutMs
    };
  }

  getSettings(): EngineSettings {
    return { ...this.settings };
  }

  updateSettings(patch: Partial<EngineSettings>): EngineSettings {
    this.settings = { ...this.settings, ...patch };
    // Invalidate wirepod provider if URL changed so it's recreated with new settings
    if (patch.wirepodBaseUrl !== undefined || patch.wirepodTimeoutMs !== undefined) {
      this.providers.delete("wirepod");
    }
    return { ...this.settings };
  }

  switchProvider(name: EngineProviderName): void {
    this.settings = { ...this.settings, activeProvider: name };
  }

  getActiveProvider(): RobotController {
    const name = this.settings.activeProvider;
    return this.getProvider(name);
  }

  getActiveProviderName(): EngineProviderName {
    return this.settings.activeProvider;
  }

  getProvider(name: EngineProviderName): RobotController {
    if (!this.providers.has(name)) {
      this.providers.set(name, this.createProvider(name));
    }
    return this.providers.get(name)!;
  }

  private createProvider(name: EngineProviderName): RobotController {
    switch (name) {
      case "embedded":
        return createEmbeddedProvider();
      case "wirepod":
        return createWirepodProvider({
          wirePodBaseUrl: this.settings.wirepodBaseUrl,
          wirePodTimeoutMs: this.settings.wirepodTimeoutMs,
          dataFilePath: this.wirepodOptions.dataFilePath
        });
      case "mock":
        return createMockProvider();
    }
  }

  async getAllProviderStatuses(): Promise<EngineProviderStatus[]> {
    const embedded = getEmbeddedProviderStatus();

    let wirepodConnected = false;
    try {
      const wirepod = this.getProvider("wirepod");
      const status = await wirepod.getStatus();
      wirepodConnected = status.isConnected;
    } catch {
      wirepodConnected = false;
    }
    const wirepod = getWirepodProviderStatus(wirepodConnected);
    const mock = getMockProviderStatus();

    return [embedded, wirepod, mock];
  }

  async getActiveProviderStatus(): Promise<EngineProviderStatus> {
    const name = this.settings.activeProvider;
    if (name === "embedded") {
      return getEmbeddedProviderStatus();
    }
    if (name === "mock") {
      return getMockProviderStatus();
    }
    let connected = false;
    try {
      const status = await this.getActiveProvider().getStatus();
      connected = status.isConnected;
    } catch {
      connected = false;
    }
    return getWirepodProviderStatus(connected);
  }
}

export const createEngineManager = (options: EngineManagerOptions): EngineManager =>
  new EngineManager(options);
