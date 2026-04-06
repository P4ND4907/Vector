import type {
  WirePodConfig,
  WirePodSdkInfo,
  WirePodSttInfo
} from "./wirepodService.js";
import type { WirePodSetupStatusRecord } from "../robot/types.js";

export const buildWirePodSetupStatus = ({
  reachable,
  config,
  sttInfo,
  sdkInfo
}: {
  reachable: boolean;
  config?: WirePodConfig;
  sttInfo?: WirePodSttInfo;
  sdkInfo?: WirePodSdkInfo;
}): WirePodSetupStatusRecord => {
  const discoveredRobotCount = sdkInfo?.robots.filter((item) => item.activated || item.ip_address).length ?? 0;
  const initialSetupComplete = reachable ? Boolean(config?.pastinitialsetup) : false;
  const connectionMode =
    config?.server?.epconfig === true
      ? "escape-pod"
      : config?.server?.epconfig === false
        ? "ip"
        : "unknown";
  const needsRobotPairing = reachable && initialSetupComplete && discoveredRobotCount === 0;

  return {
    reachable,
    initialSetupComplete,
    sttProvider: sttInfo?.provider || config?.STT?.provider || "unknown",
    sttLanguage: sttInfo?.language || config?.STT?.language || "en-US",
    connectionMode,
    port: config?.server?.port || "443",
    discoveredRobotCount,
    needsRobotPairing,
    recommendedNextStep: !reachable
      ? "Start WirePod first, then come back here."
      : !initialSetupComplete
        ? "Finish the one-time local WirePod setup first."
        : needsRobotPairing
          ? "Authenticate Vector once so WirePod can discover it."
          : discoveredRobotCount > 0
            ? "WirePod is ready. Save a serial here and reconnect."
            : "WirePod is ready. Scan the network and reconnect."
  };
};
