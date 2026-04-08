import type { AppSettings, IntegrationStatus, PairingCandidate, Robot, RobotProfile } from "@/types";

const MOCK_SERIAL_PATTERN = /^mock[-_]/i;
const PLACEHOLDER_SERIALS = new Set(["vector-local"]);

export const normalizeRobotSerial = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
};

export const isPlaceholderRobotSerial = (value?: string | null) => {
  const normalized = normalizeRobotSerial(value);
  if (!normalized) {
    return false;
  }

  return PLACEHOLDER_SERIALS.has(normalized.toLowerCase()) || MOCK_SERIAL_PATTERN.test(normalized);
};

export const sanitizeRobotSerial = (
  value?: string | null,
  options?: { allowPlaceholder?: boolean }
) => {
  const normalized = normalizeRobotSerial(value);
  if (!normalized) {
    return undefined;
  }

  if (!options?.allowPlaceholder && isPlaceholderRobotSerial(normalized)) {
    return undefined;
  }

  return normalized;
};

export const selectRobotSerial = (...values: Array<string | null | undefined>) =>
  values
    .map((value) => sanitizeRobotSerial(value))
    .find((value): value is string => Boolean(value));

export const sanitizeRobotForMode = (robot: Robot, allowPlaceholder = false): Robot => ({
  ...robot,
  serial: sanitizeRobotSerial(robot.serial, { allowPlaceholder })
});

export const sanitizeIntegrationForMode = (
  integration: IntegrationStatus,
  allowPlaceholder = integration.mockMode
): IntegrationStatus => ({
  ...integration,
  selectedSerial: sanitizeRobotSerial(integration.selectedSerial, { allowPlaceholder })
});

export const sanitizeSettingsForMode = (settings: AppSettings): AppSettings => ({
  ...settings,
  robotSerial: sanitizeRobotSerial(settings.robotSerial, { allowPlaceholder: settings.mockMode }) ?? ""
});

export const sanitizeSavedProfilesForMode = (
  profiles: RobotProfile[],
  allowPlaceholder = false
): RobotProfile[] =>
  profiles.flatMap((profile) => {
    const serial = sanitizeRobotSerial(profile.serial, { allowPlaceholder });
    if (!serial && profile.serial) {
      return [];
    }

    return [
      {
        ...profile,
        serial
      }
    ];
  });

export const sanitizeAvailableRobotsForMode = (
  robots: PairingCandidate[],
  allowPlaceholder = false
): PairingCandidate[] =>
  robots.flatMap((robot) => {
    const serial = sanitizeRobotSerial(robot.serial, { allowPlaceholder });
    if (!serial && robot.serial) {
      return [];
    }

    return [
      {
        ...robot,
        serial
      }
    ];
  });
