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
  sdkInfo,
  savedSerial
}: {
  reachable: boolean;
  config?: WirePodConfig;
  sttInfo?: WirePodSttInfo;
  sdkInfo?: WirePodSdkInfo;
  savedSerial?: string;
}): WirePodSetupStatusRecord => {
  const discoveredRobotCount = sdkInfo?.robots.filter((item) => item.activated || item.ip_address).length ?? 0;
  const initialSetupComplete = reachable ? Boolean(config?.pastinitialsetup) : false;
  const savedRobotTargetConfigured = Boolean(savedSerial?.trim());
  const connectionMode =
    config?.server?.epconfig === true
      ? "escape-pod"
      : config?.server?.epconfig === false
        ? "ip"
        : "unknown";
  const needsRobotPairing =
    reachable && initialSetupComplete && discoveredRobotCount === 0 && !savedRobotTargetConfigured;

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
      ? "Start the local bridge first, then come back here."
      : !initialSetupComplete
        ? "Finish the one-time local bridge setup first."
        : needsRobotPairing
          ? "Authenticate Vector once so the local bridge can discover it."
          : savedRobotTargetConfigured && discoveredRobotCount === 0
            ? "The local bridge already has a saved robot target. Retry connection or run Quick repair instead of pairing again."
          : discoveredRobotCount > 0
            ? "The local bridge can already see a robot. Save it here and reconnect."
            : "The local bridge is ready. Scan the network and reconnect."
  };
};
