import { differenceInSeconds, format, formatDistanceToNowStrict } from "date-fns";
import type { NotificationLevel, RobotMood } from "@/types";

const parseSafeDate = (value?: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatRelativeTime = (value?: string) => {
  const date = parseSafeDate(value);
  if (!date) {
    return "recently";
  }

  return Math.abs(differenceInSeconds(date, new Date())) < 5
    ? "just now"
    : formatDistanceToNowStrict(date, { addSuffix: true });
};

export const formatTimestamp = (value?: string) => {
  const date = parseSafeDate(value);
  return date ? format(date, "MMM d, h:mm a") : "Not yet";
};

export const moodLabel: Record<RobotMood, string> = {
  ready: "Ready",
  curious: "Curious",
  playful: "Playful",
  charging: "Charging",
  sleepy: "Sleepy",
  focused: "Focused"
};

export const levelTone: Record<NotificationLevel, string> = {
  info: "text-primary",
  success: "text-emerald-400",
  warning: "text-amber-300"
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
