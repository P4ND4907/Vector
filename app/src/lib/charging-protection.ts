import type { AppSettings, Robot } from "@/types";

export const CHARGING_PROTECTION_RELEASE_PERCENT = 95;

export const isChargingProtectionActive = (settings: AppSettings, robot: Robot) =>
  settings.protectChargingUntilFull &&
  (robot.isCharging || (robot.isDocked && robot.batteryPercent < CHARGING_PROTECTION_RELEASE_PERCENT));

export const getChargingProtectionMessage = () =>
  `Charging protection is keeping Vector on the charger until the battery is around ${CHARGING_PROTECTION_RELEASE_PERCENT}%. Turn it off in Settings if you really need movement before then.`;
