import type { IntegrationStatus, NotificationLevel, Robot } from "@/types";

export type BatteryStateKey = "on-charger" | "charging" | "normal" | "low" | "unknown";

export interface BatteryStatePresentation {
  key: BatteryStateKey;
  label: string;
  detail: string;
  badgeClassName: string;
}

const batteryBadgeTone: Record<BatteryStateKey, string> = {
  "on-charger": "border-sky-400/30 bg-sky-400/10 text-sky-100",
  charging: "border-cyan-400/30 bg-cyan-400/10 text-cyan-100",
  normal: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  low: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  unknown: "border-white/10 bg-white/[0.05] text-muted-foreground"
};

export const getBatteryState = (
  robot: Pick<Robot, "batteryPercent" | "isCharging" | "isDocked" | "isConnected">
): BatteryStatePresentation => {
  if (robot.isDocked && !robot.isCharging) {
    return {
      key: "on-charger",
      label: "Docked, not charging",
      detail: "Vector is on the dock, but the charger is not currently feeding power.",
      badgeClassName: batteryBadgeTone["on-charger"]
    };
  }

  if (robot.isDocked) {
    return {
      key: "on-charger",
      label: "On charger",
      detail: "Vector is seated on the dock.",
      badgeClassName: batteryBadgeTone["on-charger"]
    };
  }

  if (robot.isCharging) {
    return {
      key: "charging",
      label: "Charging",
      detail: "Vector is actively charging.",
      badgeClassName: batteryBadgeTone.charging
    };
  }

  if (!robot.isConnected && robot.batteryPercent <= 0) {
    return {
      key: "unknown",
      label: "Battery unknown",
      detail: "Live battery data is unavailable while the robot is offline.",
      badgeClassName: batteryBadgeTone.unknown
    };
  }

  if (robot.batteryPercent <= 20) {
    return {
      key: "low",
      label: "Low battery",
      detail: "A dock command is recommended soon.",
      badgeClassName: batteryBadgeTone.low
    };
  }

  return {
    key: "normal",
    label: "Battery normal",
    detail: "Vector has enough charge for regular activity.",
    badgeClassName: batteryBadgeTone.normal
  };
};

export const getBatteryStateFromEstimate = (batteryPercent?: number): BatteryStatePresentation => {
  if (typeof batteryPercent !== "number" || Number.isNaN(batteryPercent) || batteryPercent <= 0) {
    return {
      key: "unknown",
      label: "Battery unknown",
      detail: "No trusted battery estimate was stored for this session.",
      badgeClassName: batteryBadgeTone.unknown
    };
  }

  if (batteryPercent <= 20) {
    return {
      key: "low",
      label: "Low battery",
      detail: "This session ended near the low-battery threshold.",
      badgeClassName: batteryBadgeTone.low
    };
  }

  return {
    key: "normal",
    label: "Battery normal",
    detail: "Stored session data shows a healthy battery window.",
    badgeClassName: batteryBadgeTone.normal
  };
};

export const getSystemStatusDisplay = (status: Robot["systemStatus"]) => {
  switch (status) {
    case "error":
    case "offline":
      return { label: "Offline", toneKey: "offline" as const };
    case "charging":
      return { label: "Charging", toneKey: "charging" as const };
    case "docked":
      return { label: "Docked", toneKey: "docked" as const };
    case "busy":
      return { label: "Busy", toneKey: "busy" as const };
    case "ready":
    default:
      return { label: "Ready", toneKey: "ready" as const };
  }
};

export const getBrainStatusLabel = (
  integration: Pick<IntegrationStatus, "mockMode" | "wirePodReachable" | "managedBridge">
) => {
  if (integration.mockMode) {
    return "Mock mode";
  }

  if (integration.managedBridge.source === "bundled" && integration.wirePodReachable) {
    return "Built-in brain ready";
  }

  return integration.wirePodReachable ? "Local brain ready" : "Vector brain offline";
};

export const notificationSurfaceTone: Record<NotificationLevel, string> = {
  info: "border-sky-400/25 bg-sky-400/8 text-sky-50",
  success: "border-emerald-400/25 bg-emerald-400/8 text-emerald-50",
  warning: "border-amber-300/30 bg-amber-300/10 text-amber-50"
};

export const logStatusTone: Record<"success" | "error" | "queued", string> = {
  success: "border-emerald-400/20 bg-emerald-400/6 text-emerald-100",
  error: "border-red-400/20 bg-red-400/8 text-red-100",
  queued: "border-white/10 bg-white/[0.04] text-foreground"
};
