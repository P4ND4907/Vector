import type { LearnedCommandRecord } from "../robot/types.js";
import { normalizeVectorCommandInput } from "./vectorCommandRegistry.js";

const LEARNED_COMMAND_LIMIT = 120;

const cleanText = (value: string, maxLength: number) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);

export const normalizeLearnedCommandPhrase = (value: string) =>
  normalizeVectorCommandInput(value).slice(0, 240);

const normalizeLearnedCommandTarget = (value: string) =>
  cleanText(value, 240);

export const sanitizeLearnedCommands = (value: unknown): LearnedCommandRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return undefined;
      }

      const candidate = item as Partial<LearnedCommandRecord>;
      const phrase = cleanText(typeof candidate.phrase === "string" ? candidate.phrase : "", 120);
      const targetPrompt = normalizeLearnedCommandTarget(
        typeof candidate.targetPrompt === "string" ? candidate.targetPrompt : ""
      );
      const normalizedPhrase = normalizeLearnedCommandPhrase(candidate.normalizedPhrase || phrase);
      const normalizedTargetPrompt = normalizeLearnedCommandPhrase(
        candidate.normalizedTargetPrompt || targetPrompt
      );

      if (!phrase || !targetPrompt || !normalizedPhrase || !normalizedTargetPrompt) {
        return undefined;
      }

      return {
        phrase,
        normalizedPhrase,
        targetPrompt,
        normalizedTargetPrompt,
        createdAt:
          typeof candidate.createdAt === "string" && candidate.createdAt.trim()
            ? candidate.createdAt
            : new Date().toISOString(),
        updatedAt:
          typeof candidate.updatedAt === "string" && candidate.updatedAt.trim()
            ? candidate.updatedAt
            : new Date().toISOString()
      } satisfies LearnedCommandRecord;
    })
    .filter((item): item is LearnedCommandRecord => Boolean(item))
    .slice(0, LEARNED_COMMAND_LIMIT);
};

export const findLearnedCommand = (
  commands: LearnedCommandRecord[],
  prompt: string
) => {
  const normalizedPrompt = normalizeLearnedCommandPhrase(prompt);
  if (!normalizedPrompt) {
    return undefined;
  }

  return commands.find((command) => command.normalizedPhrase === normalizedPrompt);
};

export const upsertLearnedCommand = (
  commands: LearnedCommandRecord[],
  phrase: string,
  targetPrompt: string
) => {
  const cleanedPhrase = cleanText(phrase, 120);
  const cleanedTargetPrompt = normalizeLearnedCommandTarget(targetPrompt);
  const normalizedPhrase = normalizeLearnedCommandPhrase(cleanedPhrase);
  const normalizedTargetPrompt = normalizeLearnedCommandPhrase(cleanedTargetPrompt);

  if (!cleanedPhrase || !cleanedTargetPrompt || !normalizedPhrase || !normalizedTargetPrompt) {
    throw new Error("Both the new phrase and the command it maps to are required.");
  }

  const now = new Date().toISOString();
  const existing = commands.find((command) => command.normalizedPhrase === normalizedPhrase);
  const record: LearnedCommandRecord = existing
    ? {
        ...existing,
        phrase: cleanedPhrase,
        normalizedPhrase,
        targetPrompt: cleanedTargetPrompt,
        normalizedTargetPrompt,
        updatedAt: now
      }
    : {
        phrase: cleanedPhrase,
        normalizedPhrase,
        targetPrompt: cleanedTargetPrompt,
        normalizedTargetPrompt,
        createdAt: now,
        updatedAt: now
      };

  const nextCommands = [
    record,
    ...commands.filter((command) => command.normalizedPhrase !== normalizedPhrase)
  ].slice(0, LEARNED_COMMAND_LIMIT);

  return {
    commands: nextCommands,
    record
  };
};

export const deleteLearnedCommand = (
  commands: LearnedCommandRecord[],
  phrase: string
) => {
  const normalizedPhrase = normalizeLearnedCommandPhrase(phrase);
  if (!normalizedPhrase) {
    return {
      commands,
      record: undefined
    };
  }

  const record = commands.find((command) => command.normalizedPhrase === normalizedPhrase);
  return {
    commands: commands.filter((command) => command.normalizedPhrase !== normalizedPhrase),
    record
  };
};
