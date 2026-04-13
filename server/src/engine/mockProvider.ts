export { createMockRobotController as createMockProvider } from "../robot/mockRobotController.js";

import type { EngineProviderStatus } from "./types.js";

export const getMockProviderStatus = (): EngineProviderStatus => ({
  provider: "mock",
  available: true,
  connected: true,
  note: "Mock provider is active. No real robot connection.",
  protocolGaps: ["No real robot — all responses are simulated"]
});
