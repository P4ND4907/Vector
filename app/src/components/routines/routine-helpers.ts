import type { Routine } from "@/types";

export const DEFAULT_AI_PROMPT =
  "Every weekday at 7:00 AM say good morning and play a happy greeting animation.";

export const BATTERY_EXAMPLE_PROMPT =
  "When battery drops below 20 percent, return to the charger and notify me.";

export const TRIGGER_OPTIONS: Array<{
  value: Routine["triggerType"];
  label: string;
}> = [
  { value: "schedule", label: "Schedule" },
  { value: "interval", label: "Interval" },
  { value: "battery-low", label: "Battery low" },
  { value: "disconnect", label: "Disconnect" },
  { value: "manual", label: "Manual" }
];

export const ACTION_OPTIONS: Array<{
  value: Routine["actions"][number]["type"];
  label: string;
}> = [
  { value: "speak", label: "Speak" },
  { value: "animation", label: "Animation" },
  { value: "dock", label: "Dock" },
  { value: "mute", label: "Mute" },
  { value: "notify", label: "Notify" },
  { value: "stop", label: "Stop" }
];

export const REPEAT_OPTIONS: Array<{
  value: Routine["repeat"];
  label: string;
}> = [
  { value: "once", label: "Once" },
  { value: "hourly", label: "Hourly" },
  { value: "daily", label: "Daily" },
  { value: "custom", label: "Custom" }
];

export const createDefaultRoutine = (): Routine => ({
  id: crypto.randomUUID(),
  name: "New routine",
  enabled: true,
  triggerType: "schedule",
  triggerValue: "21:00",
  conditions: ["Only when connected"],
  actions: [{ type: "speak", value: "Good night. Entering quiet mode." }],
  delayMs: 0,
  repeat: "daily"
});

export const createRoutineFromAiDraft = (
  routine: Pick<
    Routine,
    "name" | "triggerType" | "triggerValue" | "conditions" | "actions" | "delayMs" | "repeat"
  >
): Routine => ({
  id: crypto.randomUUID(),
  enabled: true,
  name: routine.name,
  triggerType: routine.triggerType,
  triggerValue: routine.triggerValue,
  conditions: routine.conditions.length ? routine.conditions : ["Only when connected"],
  actions: routine.actions,
  delayMs: routine.delayMs,
  repeat: routine.repeat
});
