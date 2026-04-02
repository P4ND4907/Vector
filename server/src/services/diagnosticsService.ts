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
}

export const buildDiagnosticsSnapshot = async (
  controller: RobotController
): Promise<DiagnosticsSnapshot> => {
  const robot = await controller.getStatus();
  const [integration, logs] = await Promise.all([
    controller.getIntegrationInfo(),
    controller.getLogs()
  ]);

  const latestSuccessfulCommand = logs.find((log) => log.status === "success");
  const latestFailedCommand = logs.find((log) => log.status === "error");
  const troubleshooting = [
    integration.note,
    !integration.wirePodReachable ? "Vector brain offline. Make sure WirePod is running locally." : "",
    integration.wirePodReachable && !integration.robotReachable
      ? "WirePod is reachable, but Vector is not responding on local Wi-Fi yet."
      : ""
  ].filter(Boolean) as string[];

  return {
    robot,
    integration,
    latestSuccessfulCommand,
    latestFailedCommand,
    logs,
    troubleshooting
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
