import { createMockRobotController } from "../../robot/mockRobotController.js";
import type { BridgeProvider, EngineDiagnostics, EngineHealth, EngineRobotCandidate, EngineRobotStatus, PairingRecord } from "../types.js";

const toStatus = (robot: ReturnType<ReturnType<typeof createMockRobotController>["getStatus"]>): EngineRobotStatus => ({
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
  provider: "mock"
});

export const createMockProvider = (): BridgeProvider => {
  const controller = createMockRobotController();
  let paired: PairingRecord | null = null;

  return {
    id: "mock",
    label: "Demo engine",
    async init() {
      return;
    },
    async health(): Promise<EngineHealth> {
      return {
        ok: true,
        provider: "mock",
        label: "Demo engine ready",
        detail: "Mock mode is active. You can test the app without a live robot."
      };
    },
    async discoverRobots(): Promise<EngineRobotCandidate[]> {
      return controller.discoverRobots().map((robot) => ({
        id: robot.id,
        name: robot.name,
        serial: robot.serial,
        ipAddress: robot.ipAddress,
        signalStrength: robot.signalStrength,
        secure: robot.secure,
        activated: robot.activated,
        lastSeen: robot.lastSeen,
        source: "mock"
      }));
    },
    async pairRobot(input) {
      paired = {
        id: input.serial || input.ipAddress,
        name: input.name,
        serial: input.serial,
        ipAddress: input.ipAddress,
        token: input.token || "mock-token",
        pairedAt: new Date().toISOString(),
        provider: "mock"
      };
      return paired;
    },
    async connect() {
      return toStatus(controller.connect());
    },
    async disconnect() {
      return toStatus(controller.disconnect());
    },
    async getStatus() {
      return toStatus(controller.getStatus());
    },
    async drive(input) {
      const log = controller.drive(input);
      return { ok: log.status !== "error", message: log.resultMessage };
    },
    async setHeadAngle(input) {
      const log = controller.head(input);
      return { ok: log.status !== "error", message: log.resultMessage };
    },
    async setLiftHeight(input) {
      const log = controller.lift(input);
      return { ok: log.status !== "error", message: log.resultMessage };
    },
    async speak(input) {
      const log = controller.speak(input);
      return { ok: log.status !== "error", message: log.resultMessage };
    },
    async dock() {
      const log = controller.dock();
      return { ok: log.status !== "error", message: log.resultMessage };
    },
    async wake() {
      const log = controller.wake();
      return { ok: log.status !== "error", message: log.resultMessage };
    },
    async sleep() {
      const disconnect = controller.disconnect();
      return { ok: disconnect.connectionState !== "error", message: "Demo robot is resting now." };
    },
    async getPhotoList() {
      return controller.getSnapshots().map((snapshot) => ({
        id: snapshot.id,
        label: snapshot.label,
        createdAt: snapshot.createdAt
      }));
    },
    async downloadPhoto(photoId) {
      const snapshot = controller.getSnapshots().find((item) => item.id === photoId || item.remoteId === photoId);
      return snapshot ? { id: snapshot.id, label: snapshot.label, dataUrl: snapshot.dataUrl } : null;
    },
    async getDiagnostics(): Promise<EngineDiagnostics> {
      const report = controller.runDiagnostics();
      return {
        provider: "mock",
        summary: report.summary,
        detail: report.troubleshooting,
        robot: await this.getStatus()
      };
    }
  };
};
