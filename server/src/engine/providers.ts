import type { RobotController } from "../robot/types.js";
import type { BridgeProviderName, PairingRecord } from "./stores.js";

export interface BridgeProvider {
  init: () => Promise<void>;
  health: () => Promise<{ ok: boolean; provider: BridgeProviderName; note: string }>;
  discoverRobots: () => Promise<Awaited<ReturnType<RobotController["discoverRobots"]>>>;
  pairRobot: (payload: PairingRecord) => Promise<{ ok: boolean; message: string; pairing: PairingRecord }>;
  connect: (payload?: { serial?: string; ipAddress?: string; name?: string; token?: string }) => Promise<Awaited<ReturnType<RobotController["connect"]>>>;
  disconnect: () => Promise<Awaited<ReturnType<RobotController["disconnect"]>>>;
  getStatus: () => Promise<Awaited<ReturnType<RobotController["getStatus"]>>>;
  drive: (payload: { direction: string; speed: number; durationMs?: number }) => Promise<Awaited<ReturnType<RobotController["drive"]>>>;
  setHeadAngle: (payload: { angle: number }) => Promise<Awaited<ReturnType<RobotController["head"]>>>;
  setLiftHeight: (payload: { height: number }) => Promise<Awaited<ReturnType<RobotController["lift"]>>>;
  speak: (payload: { text: string }) => Promise<Awaited<ReturnType<RobotController["speak"]>>>;
  dock: () => Promise<Awaited<ReturnType<RobotController["dock"]>>>;
  wake: () => Promise<Awaited<ReturnType<RobotController["wake"]>>>;
  sleep: () => Promise<Awaited<ReturnType<RobotController["dock"]>>>;
  getPhotoList: () => Promise<Awaited<ReturnType<RobotController["getSnapshots"]>>>;
  downloadPhoto: (photoId: string) => Promise<Awaited<ReturnType<RobotController["getPhotoImage"]>>>;
  getDiagnostics: () => Promise<Awaited<ReturnType<RobotController["runDiagnostics"]>>>;
}

interface BaseProviderOptions {
  provider: BridgeProviderName;
  controller: RobotController;
  note: string;
  initMode: () => Promise<void>;
}

const createBaseProvider = ({ provider, controller, note, initMode }: BaseProviderOptions): BridgeProvider => ({
  init: async () => {
    await initMode();
  },
  health: async () => {
    await initMode();
    const integration = await controller.getIntegrationInfo();
    return {
      ok: provider === "mock" ? true : Boolean(integration.wirePodReachable),
      provider,
      note
    };
  },
  discoverRobots: async () => {
    await initMode();
    return controller.discoverRobots();
  },
  pairRobot: async (payload) => {
    await initMode();
    return {
      ok: true,
      message: "Robot pairing details saved locally.",
      pairing: payload
    };
  },
  connect: async (payload) => {
    await initMode();
    return controller.connect(payload);
  },
  disconnect: async () => {
    await initMode();
    return controller.disconnect();
  },
  getStatus: async () => {
    await initMode();
    return controller.getStatus();
  },
  drive: async (payload) => {
    await initMode();
    return controller.drive(payload);
  },
  setHeadAngle: async (payload) => {
    await initMode();
    return controller.head(payload);
  },
  setLiftHeight: async (payload) => {
    await initMode();
    return controller.lift(payload);
  },
  speak: async (payload) => {
    await initMode();
    return controller.speak(payload);
  },
  dock: async () => {
    await initMode();
    return controller.dock();
  },
  wake: async () => {
    await initMode();
    return controller.wake();
  },
  sleep: async () => {
    await initMode();
    return controller.dock();
  },
  getPhotoList: async () => {
    await initMode();
    return controller.getSnapshots();
  },
  downloadPhoto: async (photoId) => {
    await initMode();
    return controller.getPhotoImage(photoId, "full");
  },
  getDiagnostics: async () => {
    await initMode();
    return controller.runDiagnostics();
  }
});

export const createEmbeddedProvider = (controller: RobotController): BridgeProvider =>
  createBaseProvider({
    provider: "embedded",
    controller,
    note:
      "Embedded Engine uses local transport. If direct control is unavailable, switch to legacy WirePod compatibility mode.",
    initMode: async () => {
      await controller.updateSettings({ mockMode: false });
    }
  });

export const createWirePodProvider = (controller: RobotController): BridgeProvider =>
  createBaseProvider({
    provider: "wirepod",
    controller,
    note: "Legacy WirePod compatibility mode is active.",
    initMode: async () => {
      await controller.updateSettings({ mockMode: false });
    }
  });

export const createMockProvider = (controller: RobotController): BridgeProvider =>
  createBaseProvider({
    provider: "mock",
    controller,
    note: "Mock Engine mode is active for demos and testing.",
    initMode: async () => {
      await controller.updateSettings({ mockMode: true });
    }
  });
