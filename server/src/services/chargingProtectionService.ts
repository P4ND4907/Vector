import type { RobotStatus, RuntimeSettings } from "../robot/types.js";

export const CHARGING_PROTECTION_RELEASE_PERCENT = 95;

const CHARGING_SAFE_ANIMATION_INTENTS = new Set([
  "intent_system_sleep",
  "intent_clock_time",
  "intent_weather_extend",
  "intent_knowledge_promptquestion",
  "intent_play_blackjack",
  "intent_character_age",
  "intent_imperative_praise",
  "intent_imperative_scold"
]);

const CHARGING_SAFE_ANIMATION_PREFIXES = ["intent_greeting_"];

export const isChargingProtectionActive = (
  settings: Pick<RuntimeSettings, "protectChargingUntilFull">,
  robot: Pick<RobotStatus, "isCharging" | "isDocked" | "batteryPercent">,
  fallbackRobot?: Pick<RobotStatus, "isCharging" | "isDocked" | "batteryPercent">
) => {
  if (!settings.protectChargingUntilFull) {
    return false;
  }

  const isCharging = Boolean(robot.isCharging || fallbackRobot?.isCharging);
  const isDocked = Boolean(robot.isDocked || fallbackRobot?.isDocked);
  const batteryPercent = Math.max(
    0,
    robot.batteryPercent ?? 0,
    fallbackRobot?.batteryPercent ?? 0
  );

  return isCharging || (isDocked && batteryPercent < CHARGING_PROTECTION_RELEASE_PERCENT);
};

export const buildChargingProtectionMessage = (actionLabel: string) =>
  `Charging protection kept Vector on the charger. ${actionLabel} stay blocked until the battery is nearly full or you turn that setting off in Settings.`;

export const isAnimationSafeWhileCharging = (intent: string) =>
  CHARGING_SAFE_ANIMATION_INTENTS.has(intent) ||
  CHARGING_SAFE_ANIMATION_PREFIXES.some((prefix) => intent.startsWith(prefix));
