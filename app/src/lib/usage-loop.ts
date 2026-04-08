import type { AiCommandHistoryItem, CommandLog, MonetizationAccessTier } from "@/types";

export interface UsageLoopSnapshot {
  recentWins: number;
  funMoments: number;
  taughtPhrases: number;
  missedPhrases: number;
  streakDays: number;
  headline: string;
  summary: string;
  nextMove: string;
}

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const funCommandPattern =
  /(joke|laugh|sing|snore|silly|dice|die|coin|blackjack|rock paper|celebrate)/i;

const toDateKey = (value: string) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildSuccessPool = (aiHistory: AiCommandHistoryItem[], logs: CommandLog[]) => {
  const aiSuccesses = aiHistory
    .filter((item) => item.status === "success")
    .map((item) => ({
      createdAt: item.createdAt,
      text: `${item.prompt} ${item.summary} ${item.resultMessage}`
    }));
  const commandSuccesses = logs
    .filter((item) => item.status === "success")
    .map((item) => ({
      createdAt: item.createdAt,
      text: `${item.type} ${item.resultMessage}`
    }));

  return [...aiSuccesses, ...commandSuccesses].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );
};

const countRecentWins = (items: ReturnType<typeof buildSuccessPool>) => {
  const cutoff = Date.now() - RECENT_WINDOW_MS;
  return items.filter((item) => new Date(item.createdAt).getTime() >= cutoff).length;
};

const countFunMoments = (items: ReturnType<typeof buildSuccessPool>) =>
  items.filter((item) => funCommandPattern.test(item.text)).length;

const countStreakDays = (items: ReturnType<typeof buildSuccessPool>) => {
  const successDays = new Set(items.map((item) => toDateKey(item.createdAt)));
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = toDateKey(cursor.toISOString());
    if (!successDays.has(key)) {
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const buildUsageLoopSnapshot = ({
  aiHistory,
  logs,
  learnedCommandCount,
  commandGapCount,
  planAccess
}: {
  aiHistory: AiCommandHistoryItem[];
  logs: CommandLog[];
  learnedCommandCount: number;
  commandGapCount: number;
  planAccess: MonetizationAccessTier;
}): UsageLoopSnapshot => {
  const successes = buildSuccessPool(aiHistory, logs);
  const recentWins = countRecentWins(successes);
  const funMoments = countFunMoments(successes);
  const streakDays = countStreakDays(successes);
  const taughtPhrases = learnedCommandCount;
  const missedPhrases = commandGapCount;

  const headline =
    recentWins > 0
      ? planAccess === "pro"
        ? "This device already has a real Vector habit loop."
        : "Free already gets owners to a real daily-use moment."
      : "One good command away from a habit.";

  const summary =
    planAccess === "pro"
      ? "Companion Pro should feel like deeper delight and time savings on top of a healthy daily-use loop."
      : "Keep Free complete for daily use, then let Pro add the enthusiast layer instead of fixing basics.";

  const nextMove =
    taughtPhrases === 0
      ? "Teach one phrase so the app starts feeling personal."
      : missedPhrases > 0
        ? "Turn one missed phrase into a working alias."
        : funMoments < 2
          ? "Try a fun command like flip a coin, tell me a joke, or sing."
          : streakDays === 0
            ? "Run one quick command today to start a streak."
            : "Keep the streak alive with one useful or fun command today.";

  return {
    recentWins,
    funMoments,
    taughtPhrases,
    missedPhrases,
    streakDays,
    headline,
    summary,
    nextMove
  };
};
