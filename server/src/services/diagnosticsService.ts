import type {
  CommandLogRecord,
  DiagnosticReportRecord,
  RobotController,
  RobotIntegrationInfo,
  RobotStatus
} from "../robot/types.js";

export interface DiagnosticsSnapshot {
  integration: RobotIntegrationInfo;
  latestFailedCommand?: CommandLogRecord;
  latestSuccessfulCommand?: CommandLogRecord;
  logs: CommandLogRecord[];
  robot: RobotStatus;
  troubleshooting: string[];
  bridgeWatchdog: Awaited<ReturnType<RobotController["getBridgeWatchdogStatus"]>>;
}

export const buildDiagnosticsSnapshot = async (
  controller: RobotController
): Promise<DiagnosticsSnapshot> => {
  const robot = await controller.getStatus();
  const [integration, logs, bridgeWatchdog] = await Promise.all([
    controller.getIntegrationInfo(),
    controller.getLogs(),
    controller.getBridgeWatchdogStatus()
  ]);

  const latestSuccessfulCommand = logs.find((log) => log.status === "success");
  const latestFailedCommand = logs.find((log) => log.status === "error");
  const troubleshooting = [
    integration.note,
    !integration.wirePodReachable ? "Local bridge offline. Make sure the desktop service is running locally." : "",
    integration.wirePodReachable && !integration.robotReachable
      ? "The local bridge is reachable, but Vector is not responding on local Wi-Fi yet."
      : ""
  ].filter(Boolean) as string[];

  return {
    robot,
    integration,
    latestSuccessfulCommand,
    latestFailedCommand,
    logs,
    troubleshooting,
    bridgeWatchdog
  };
};

export const runDiagnostics = async (controller: RobotController) => {
  const [report, snapshot] = await Promise.all([
    controller.runDiagnostics(),
    buildDiagnosticsSnapshot(controller)
  ]);

  return {
    report: report as DiagnosticReportRecord,
    snapshot
  };
};
