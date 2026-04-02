import type { CommandLogRecord, DiscoveredRobot, RobotStatus } from "./types.js";
import type { WirePodRobotRecord } from "../services/wirepodService.js";

export const animationIntentMap: Record<string, string> = {
  "happy-hello": "intent_imperative_dance",
  "greeting-wave": "intent_imperative_dance",
  "silly-wiggle": "intent_imperative_dance",
  "celebrate-spark": "intent_imperative_dance",
  "curious-peek": "explore_start",
  "idle-scan": "explore_start",
  "sleepy-yawn": "intent_system_sleep"
};

export const makeLog = (
  type: string,
  payload: Record<string, unknown>,
  status: CommandLogRecord["status"],
  resultMessage: string
): CommandLogRecord => ({
  id: crypto.randomUUID(),
  type,
  payload,
  status,
  createdAt: new Date().toISOString(),
  resultMessage
});

export const clampNumber = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const buildWirePodRobotName = (serial: string, alias?: string) =>
  alias?.trim() || `Vector ${serial.slice(-4).toUpperCase()}`;

export const toDiscoveredRobot = (robot: WirePodRobotRecord, alias?: string): DiscoveredRobot => ({
  id: robot.esn,
  serial: robot.esn,
  name: buildWirePodRobotName(robot.esn, alias),
  ipAddress: robot.ip_address,
  signalStrength: robot.ip_address ? 100 : 0,
  secure: true,
  activated: robot.activated,
  lastSeen: new Date().toISOString()
});

export const chooseRobot = ({
  payload,
  robots,
  selectedSerial
}: {
  payload?: Partial<RobotStatus>;
  robots: WirePodRobotRecord[];
  selectedSerial?: string;
}) => {
  if (payload?.serial) {
    const bySerial = robots.find((item) => item.esn === payload.serial);
    if (bySerial) {
      return bySerial;
    }
  }

  if (payload?.ipAddress) {
    const byIp = robots.find((item) => item.ip_address === payload.ipAddress);
    if (byIp) {
      return byIp;
    }
  }

  if (selectedSerial) {
    const current = robots.find((item) => item.esn === selectedSerial);
    if (current) {
      return current;
    }
  }

  return robots.find((item) => item.activated) ?? robots[0];
};

export const deriveSystemStatus = (robot: Pick<RobotStatus, "isConnected" | "isCharging" | "isDocked" | "connectionState">) => {
  if (!robot.isConnected) {
    return robot.connectionState === "error" ? "error" : "offline";
  }
  if (robot.isCharging) {
    return "charging";
  }
  if (robot.isDocked) {
    return "docked";
  }
  return "ready";
};
