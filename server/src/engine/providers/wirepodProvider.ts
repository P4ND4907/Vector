import type { RobotController } from "../../robot/types.js";
import type { BridgeProvider, EngineDiagnostics, EngineHealth, EngineRobotCandidate, EngineRobotStatus, PairingRecord } from "../types.js";

const toStatus = async (controller: RobotController): Promise<EngineRobotStatus> => {
  const robot = await controller.getStatus();
  return {
    id: robot.id,
    name: robot.nickname || robot.name,
    serial: robot.serial,
    ipAddress: robot.ipAddress,
    isConnected: robot.isConnected,
    isCharging: robot.isCharging,
    isDocked: robot.isDocked,
    batteryPercent: robot.batteryPercent,
    lastSeen: robot.lastSeen,
    firmwareVersion: robot.firmwareVersion,
    currentActivity: robot.currentActivity,
    provider: "wirepod"
  };
};

export const createWirePodProvider = (controller: RobotController): BridgeProvider => ({
  id: "wirepod",
  label: "Legacy WirePod compatibility",
  async init() {
    return;
  },
  async health(): Promise<EngineHealth> {
    const integration = await controller.getIntegrationInfo();
    return {
      ok: integration.wirePodReachable,
      provider: "wirepod",
      label: integration.wirePodReachable ? "Compatibility engine online" : "Compatibility engine needs attention",
      detail: integration.note || (integration.wirePodReachable ? "WirePod answered the bridge check." : "WirePod is not reachable yet."),
      legacyWirePodMention: "This provider uses your existing WirePod setup for compatibility."
    };
  },
  async discoverRobots(): Promise<EngineRobotCandidate[]> {
    return (await controller.discoverRobots()).map((robot) => ({
      id: robot.id,
      name: robot.name,
      serial: robot.serial,
      ipAddress: robot.ipAddress,
      signalStrength: robot.signalStrength,
      secure: robot.secure,
      activated: robot.activated,
      lastSeen: robot.lastSeen,
      source: "bridge"
    }));
  },
  async pairRobot(input): Promise<PairingRecord> {
    const robot = await controller.connect({
      serial: input.serial,
      name: input.name,
      ipAddress: input.ipAddress,
      token: input.token
    });
    return {
      id: robot.id,
      name: robot.nickname || robot.name,
      serial: robot.serial,
      ipAddress: robot.ipAddress,
      token: robot.token,
      pairedAt: new Date().toISOString(),
      provider: "wirepod"
    };
  },
  async connect() {
    await controller.connect();
    return toStatus(controller);
  },
  async disconnect() {
    await controller.disconnect();
    return toStatus(controller);
  },
  async getStatus() {
    return toStatus(controller);
  },
  async drive(input) {
    const log = await controller.drive(input);
    return { ok: log.status !== "error", message: log.resultMessage };
  },
  async setHeadAngle(input) {
    const log = await controller.head(input);
    return { ok: log.status !== "error", message: log.resultMessage };
  },
  async setLiftHeight(input) {
    const log = await controller.lift(input);
    return { ok: log.status !== "error", message: log.resultMessage };
  },
  async speak(input) {
    const log = await controller.speak(input);
    return { ok: log.status !== "error", message: log.resultMessage };
  },
  async dock() {
    const log = await controller.dock();
    return { ok: log.status !== "error", message: log.resultMessage };
  },
  async wake() {
    const log = await controller.wake();
    return { ok: log.status !== "error", message: log.resultMessage };
  },
  async sleep() {
    await controller.disconnect();
    return { ok: true, message: "The robot link was disconnected for sleep mode." };
  },
  async getPhotoList() {
    return (await controller.getSnapshots()).map((snapshot) => ({
      id: snapshot.id,
      label: snapshot.label,
      createdAt: snapshot.createdAt
    }));
  },
  async downloadPhoto(photoId) {
    const snapshot = (await controller.getSnapshots()).find((item) => item.id === photoId || item.remoteId === photoId);
    return snapshot ? { id: snapshot.id, label: snapshot.label, dataUrl: snapshot.dataUrl } : null;
  },
  async getDiagnostics(): Promise<EngineDiagnostics> {
    const report = await controller.runDiagnostics();
    return {
      provider: "wirepod",
      summary: report.summary,
      detail: report.troubleshooting,
      robot: await toStatus(controller)
    };
  }
});
