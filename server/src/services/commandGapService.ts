import type { CommandGapRecord } from "../robot/types.js";

const weatherPattern = /\b(weather|forecast|temperature|temp|rain|snow|wind|sunny|cloudy)\b/i;
const timerPattern = /\b(timer|alarm|countdown|remind|reminder)\b/i;
const mediaPattern = /\b(song|music|spotify|playlist|podcast|radio)\b/i;
const newsPattern = /\b(news|headline|headlines)\b/i;
const smartHomePattern = /\b(light|lights|lamp|thermostat|switch|plug)\b/i;

export const normalizeCommandPrompt = (prompt: string) =>
  prompt
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 240);

export const inferSuggestedArea = (prompt: string) => {
  const normalized = normalizeCommandPrompt(prompt);

  if (!normalized) {
    return undefined;
  }

  if (weatherPattern.test(normalized)) {
    return "weather";
  }

  if (timerPattern.test(normalized)) {
    return "timers-reminders";
  }

  if (mediaPattern.test(normalized)) {
    return "media";
  }

  if (newsPattern.test(normalized)) {
    return "news";
  }

  if (smartHomePattern.test(normalized)) {
    return "smart-home";
  }

  return undefined;
};

export const isRecentDuplicateGap = (
  gaps: CommandGapRecord[],
  candidate: Pick<CommandGapRecord, "source" | "category" | "normalizedPrompt" | "matchedIntent">,
  windowMs = 15 * 60 * 1000
) => {
  const latestMatch = gaps.find((gap) =>
    gap.source === candidate.source &&
    gap.category === candidate.category &&
    gap.normalizedPrompt === candidate.normalizedPrompt &&
    (gap.matchedIntent ?? "") === (candidate.matchedIntent ?? "")
  );

  if (!latestMatch) {
    return undefined;
  }

  const createdAt = new Date(latestMatch.createdAt).getTime();
  return Number.isFinite(createdAt) && Date.now() - createdAt <= windowMs ? latestMatch : undefined;
};
