import type { ParsedAiAction, RobotController, RoutineRecord } from "../robot/types.js";

const COURSE_MARKER = "obstacle-course-local-only";
const MAX_COURSE_STEPS = 12;
const MAX_DRIVE_DURATION_MS = 4000;
const MAX_WAIT_DURATION_MS = 5000;
const DEFAULT_DRIVE_SPEED = 55;

export interface ObstacleCourseParseResult {
  name: string;
  actions: RoutineRecord["actions"];
  skippedSteps: string[];
}

export interface ObstacleCourseIntent {
  type: "save" | "run" | "list";
  name?: string;
  courseText?: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

const sanitizeName = (value?: string) => {
  const cleaned = (value || "My obstacle course")
    .replace(/\b(?:called|named|course|obstacle|obstical)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "My obstacle course";
};

const readDurationMs = (segment: string, fallbackMs: number, maxMs: number) => {
  const match = segment.match(/(\d+(?:\.\d+)?)\s*(seconds?|secs?|s|milliseconds?|ms)\b/i);
  if (!match) {
    return fallbackMs;
  }

  const raw = Number(match[1]);
  const unit = (match[2] || "seconds").toLowerCase();
  const ms = unit.startsWith("ms") || unit.startsWith("millisecond") ? raw : raw * 1000;
  return Math.max(250, Math.min(maxMs, Math.round(ms)));
};

const splitCourseSteps = (courseText: string) =>
  courseText
    .split(/\bthen\b|,|;|->/i)
    .map((step) => step.trim())
    .filter(Boolean)
    .slice(0, MAX_COURSE_STEPS);

const parseCourseStep = (rawStep: string): RoutineRecord["actions"][number] | undefined => {
  const step = rawStep.trim();
  const normalized = step.toLowerCase().replace(/\s+/g, " ");

  if (!normalized) {
    return undefined;
  }

  const driveMatch = normalized.match(/^(?:drive|move|go)?\s*(forward|backward|back|reverse)\b/);
  if (driveMatch) {
    const direction = driveMatch[1] === "back" || driveMatch[1] === "backward" ? "reverse" : driveMatch[1];
    const durationMs = readDurationMs(normalized, 1200, MAX_DRIVE_DURATION_MS);
    return {
      type: "drive",
      value: `${direction}:${DEFAULT_DRIVE_SPEED}:${durationMs}`
    };
  }

  const turnMatch = normalized.match(/^(?:turn|rotate|pivot|go)?\s*(left|right)\b/);
  if (turnMatch) {
    const durationMs = readDurationMs(normalized, 750, MAX_DRIVE_DURATION_MS);
    return {
      type: "drive",
      value: `${turnMatch[1]}:${DEFAULT_DRIVE_SPEED}:${durationMs}`
    };
  }

  const waitMatch = normalized.match(/^(?:wait|pause|hold)\b/);
  if (waitMatch) {
    return {
      type: "wait",
      value: String(readDurationMs(normalized, 1000, MAX_WAIT_DURATION_MS))
    };
  }

  const sayMatch = step.match(/^(?:say|speak)\s+(.+)$/i);
  if (sayMatch?.[1]?.trim()) {
    return {
      type: "speak",
      value: sayMatch[1].trim().slice(0, 180)
    };
  }

  if (/^(?:go\s+)?dock$|^(?:return|go)\s+(?:home|to\s+charger|to\s+dock)$/i.test(normalized)) {
    return {
      type: "dock",
      value: "dock"
    };
  }

  if (/^(?:stop|halt|freeze)$/i.test(normalized)) {
    return {
      type: "stop",
      value: "stop"
    };
  }

  return undefined;
};

export const parseObstacleCourseIntent = (prompt: string): ObstacleCourseIntent | undefined => {
  const trimmed = prompt.trim();

  if (/^(?:list|show)\s+(?:my\s+)?(?:obstacle|obstical)\s+courses?$/i.test(trimmed)) {
    return { type: "list" };
  }

  const runMatch = trimmed.match(
    /^(?:run|start|play)\s+(?:the\s+)?(?:obstacle|obstical)\s+course(?:\s+(?:called|named))?(?:\s+(.+))?$/i
  );
  if (runMatch) {
    return {
      type: "run",
      name: sanitizeName(runMatch[1])
    };
  }

  const saveMatch = trimmed.match(
    /^(?:learn|save|record)\s+(?:an?\s+)?(?:obstacle|obstical)\s+course(?:\s+(?:called|named)\s+([^:,-]+?)|\s+([^:,-]+?))?(?:\s*(?::|-|,)\s*|\s+(?:with|as|that\s+is|where)\s+)(.+)$/i
  );
  if (saveMatch) {
    return {
      type: "save",
      name: sanitizeName(saveMatch[1] || saveMatch[2]),
      courseText: saveMatch[3]?.trim()
    };
  }

  const namedSaveMatch = trimmed.match(
    /^(?:learn|save|record)\s+(.+?)\s+(?:obstacle|obstical)\s+course(?:\s*(?::|-|,)\s*|\s+(?:with|as|that\s+is|where)\s+)(.+)$/i
  );
  if (namedSaveMatch) {
    return {
      type: "save",
      name: sanitizeName(namedSaveMatch[1]),
      courseText: namedSaveMatch[2]?.trim()
    };
  }

  return undefined;
};

export const parseObstacleCourseSteps = (
  name: string,
  courseText: string
): ObstacleCourseParseResult => {
  const skippedSteps: string[] = [];
  const actions = splitCourseSteps(courseText).flatMap((step) => {
    const parsed = parseCourseStep(step);
    if (!parsed) {
      skippedSteps.push(step);
      return [];
    }

    return [parsed];
  });

  return {
    name: sanitizeName(name),
    actions,
    skippedSteps
  };
};

export const buildObstacleCourseRoutine = (
  parsed: ObstacleCourseParseResult
): RoutineRecord => {
  const now = new Date().toISOString();
  const slug = slugify(parsed.name) || "course";

  return {
    id: `obstacle-course-${slug}-${crypto.randomUUID()}`,
    name: parsed.name,
    enabled: true,
    triggerType: "manual",
    triggerValue: "app-only",
    conditions: [
      COURSE_MARKER,
      "Only runs from this app",
      "Movement steps are capped for safety"
    ],
    actions: parsed.actions,
    delayMs: 250,
    repeat: "never",
    lastRunAt: now
  };
};

export const isObstacleCourseRoutine = (routine: RoutineRecord) =>
  routine.conditions.some((condition) => condition === COURSE_MARKER);

export const findObstacleCourseRoutine = (
  routines: RoutineRecord[],
  name?: string
) => {
  const obstacleCourses = routines.filter(isObstacleCourseRoutine);
  const target = sanitizeName(name).toLowerCase();

  if (!name || target === "my obstacle course") {
    return obstacleCourses[0];
  }

  return (
    obstacleCourses.find((routine) => routine.name.toLowerCase() === target) ??
    obstacleCourses.find((routine) => routine.name.toLowerCase().includes(target)) ??
    obstacleCourses[0]
  );
};

const routineActionToParsedAction = (action: RoutineRecord["actions"][number]): ParsedAiAction | undefined => {
  if (action.type === "drive") {
    const [direction = "forward", rawSpeed = String(DEFAULT_DRIVE_SPEED), rawDuration = "1200"] = action.value.split(":");
    return {
      id: crypto.randomUUID(),
      type: "drive",
      label: `Course drive ${direction}`,
      params: {
        direction,
        speed: Math.min(DEFAULT_DRIVE_SPEED, Math.max(20, Number(rawSpeed) || DEFAULT_DRIVE_SPEED)),
        durationMs: Math.min(MAX_DRIVE_DURATION_MS, Math.max(250, Number(rawDuration) || 1200))
      }
    };
  }

  if (action.type === "speak") {
    return {
      id: crypto.randomUUID(),
      type: "speak",
      label: `Course says "${action.value}"`,
      params: { text: action.value }
    };
  }

  if (action.type === "dock") {
    return {
      id: crypto.randomUUID(),
      type: "dock",
      label: "Course return to dock",
      params: {}
    };
  }

  if (action.type === "stop") {
    return {
      id: crypto.randomUUID(),
      type: "stop",
      label: "Course stop",
      params: {}
    };
  }

  return undefined;
};

export const replayObstacleCourseRoutine = async (
  controller: RobotController,
  routine: RoutineRecord,
  runParsedAction: (action: ParsedAiAction) => Promise<string>
) => {
  const results: string[] = [];

  for (const routineAction of routine.actions.slice(0, MAX_COURSE_STEPS)) {
    if (routineAction.type === "wait") {
      const waitMs = Math.min(MAX_WAIT_DURATION_MS, Math.max(250, Number(routineAction.value) || 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      results.push(`waited ${Math.round(waitMs / 1000)} second${waitMs === 1000 ? "" : "s"}`);
      continue;
    }

    const action = routineActionToParsedAction(routineAction);
    if (!action) {
      continue;
    }

    results.push(await runParsedAction(action));
  }

  await controller.updateRoutine(routine.id, { lastRunAt: new Date().toISOString() });
  return results;
};

export const describeObstacleCourseActions = (actions: RoutineRecord["actions"]) =>
  actions
    .map((action) => {
      if (action.type === "drive") {
        const [direction, , duration] = action.value.split(":");
        return `${direction} ${Math.round((Number(duration) || 1000) / 1000)}s`;
      }

      if (action.type === "wait") {
        return `wait ${Math.round((Number(action.value) || 1000) / 1000)}s`;
      }

      if (action.type === "speak") {
        return `say "${action.value}"`;
      }

      return action.type;
    })
    .join(", ");
