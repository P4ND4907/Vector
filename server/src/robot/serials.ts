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

export const sanitizeRobotSerial = (value?: string | null) => {
  const normalized = normalizeRobotSerial(value);
  if (!normalized || isPlaceholderRobotSerial(normalized)) {
    return undefined;
  }

  return normalized;
};

export const pickRobotSerial = (...values: Array<string | null | undefined>) =>
  values
    .map((value) => sanitizeRobotSerial(value))
    .find((value): value is string => Boolean(value));
