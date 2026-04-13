export { createHybridRobotController as createWirepodProvider } from "../robot/hybridRobotController.js";

import type { EngineProviderStatus } from "./types.js";

export const getWirepodProviderStatus = (connected: boolean): EngineProviderStatus => ({
  provider: "wirepod",
  available: true,
  connected,
  note: connected
    ? "WirePod bridge is active."
    : "WirePod bridge is configured but not currently reachable.",
  protocolGaps: []
});
