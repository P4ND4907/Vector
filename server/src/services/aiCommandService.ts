import type {
  ParsedAiAction,
  ParsedAiCommand,
  RobotController
} from "../robot/types.js";

const normalize = (value: string) => value.trim().toLowerCase();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildAction = (
  type: ParsedAiAction["type"],
  label: string,
  params: Record<string, unknown>
): ParsedAiAction => ({
  id: crypto.randomUUID(),
  type,
  label,
  params
});

const splitPrompt = (prompt: string) =>
  prompt
    .split(/\bthen\b|\band\b|,|;/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

const defaultDriveDurationMs = (direction: string) =>
  direction === "left" || direction === "right" ? 750 : 1200;

const parseSegment = (segment: string): ParsedAiAction | null => {
  const normalized = normalize(segment);

  const speakMatch = normalized.match(/^(say|speak)\s+(.+)/i);
  if (speakMatch) {
    return buildAction("speak", `Speak "${speakMatch[2]}"`, { text: speakMatch[2] });
  }

  const moveMatch = normalized.match(
    /^(drive|move|go)\s+(forward|backward|reverse|left|right)(?:\s+for\s+(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs|s))?/i
  );
  if (moveMatch) {
    const direction = moveMatch[2] === "backward" ? "reverse" : moveMatch[2];
    const durationMs = moveMatch[3]
      ? Math.round(Number(moveMatch[3]) * 1000)
      : defaultDriveDurationMs(direction);
    return buildAction(`drive`, `Drive ${direction}`, {
      direction,
      speed: 60,
      durationMs
    });
  }

  const turnMatch = normalized.match(
    /^(turn)\s+(left|right)(?:\s+for\s+(\d+(?:\.\d+)?)\s*(second|seconds|sec|secs|s))?/i
  );
  if (turnMatch) {
    const durationMs = turnMatch[3]
      ? Math.round(Number(turnMatch[3]) * 1000)
      : defaultDriveDurationMs(turnMatch[2]);
    return buildAction("drive", `Turn ${turnMatch[2]}`, {
      direction: turnMatch[2],
      speed: 60,
      durationMs
    });
  }

  if (/^(forward|go forward|move forward)$/i.test(normalized)) {
    return buildAction("drive", "Drive forward", {
      direction: "forward",
      speed: 60,
      durationMs: defaultDriveDurationMs("forward")
    });
  }

  if (/^(back|back up|reverse|go back|move back|move backward)$/i.test(normalized)) {
    return buildAction("drive", "Drive reverse", {
      direction: "reverse",
      speed: 60,
      durationMs: defaultDriveDurationMs("reverse")
    });
  }

  if (/^(left|go left|move left)$/i.test(normalized)) {
    return buildAction("drive", "Turn left", {
      direction: "left",
      speed: 60,
      durationMs: defaultDriveDurationMs("left")
    });
  }

  if (/^(right|go right|move right)$/i.test(normalized)) {
    return buildAction("drive", "Turn right", {
      direction: "right",
      speed: 60,
      durationMs: defaultDriveDurationMs("right")
    });
  }

  if (/^(stop|halt|freeze)/i.test(normalized)) {
    return buildAction("stop", "Stop movement", { direction: "stop", speed: 0 });
  }

  if (/(go\s+)?dock|return to (the )?dock|go home/i.test(normalized)) {
    return buildAction("dock", "Return to dock", {});
  }

  if (/^wake( up)?/i.test(normalized)) {
    return buildAction("wake", "Wake Vector", {});
  }

  const volumeMatch = normalized.match(/(?:set )?volume(?: to)?\s+(\d{1,3})/i);
  if (volumeMatch) {
    const raw = Number(volumeMatch[1]);
    const volume = raw > 5 ? Math.max(0, Math.min(5, Math.round(raw / 20))) : Math.max(0, Math.min(5, raw));
    return buildAction("volume", `Set volume to ${volume}`, { volume });
  }

  if (/check battery|battery status|check status|status/i.test(normalized)) {
    return buildAction("status", "Check battery and robot status", {});
  }

  if (/patrol|roam|explore/i.test(normalized)) {
    return buildAction("roam", "Start patrol behavior", { animationId: "idle-scan" });
  }

  const animationMatch = normalized.match(/play\s+(.+?)\s+animation/i);
  if (animationMatch) {
    return buildAction("animation", `Play ${animationMatch[1]} animation`, {
      animationId: animationMatch[1].trim().replace(/\s+/g, "-")
    });
  }

  return null;
};

export const previewAiCommand = async (prompt: string): Promise<ParsedAiCommand> => {
  const segments = splitPrompt(prompt);
  const actions = segments.map(parseSegment).filter(Boolean) as ParsedAiAction[];
  const warnings: string[] = [];

  if (!actions.length) {
    warnings.push("I could not map that request to a supported Vector action yet.");
  }

  return {
    id: crypto.randomUUID(),
    prompt,
    summary: actions.length
      ? actions.map((action) => action.label).join(" then ")
      : "No executable action detected.",
    source: "rules",
    warnings,
    canExecute: actions.length > 0,
    actions
  };
};

export const executeAiCommand = async (
  controller: RobotController,
  parsed: ParsedAiCommand
) => {
  const results: string[] = [];
  let latestStatus = await controller.getStatus();

  for (const action of parsed.actions) {
    if (action.type === "speak") {
      const text = String(action.params.text ?? "");
      if (latestStatus.isDocked || latestStatus.mood === "sleepy") {
        try {
          await controller.wake();
        } catch {}
        await sleep(1200);
      }
      const log = await controller.speak({ text });
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "drive") {
      const direction = String(action.params.direction ?? "forward");
      const speed = Number(action.params.speed ?? 60);
      const durationMs = action.params.durationMs
        ? Number(action.params.durationMs)
        : defaultDriveDurationMs(direction);
      if (latestStatus.isDocked) {
        results.push("Vector is still on the charger, so wheel movement may stay limited until you take it off the dock.");
      }
      if (latestStatus.isDocked || latestStatus.mood === "sleepy") {
        try {
          await controller.wake();
        } catch {}
        await sleep(1200);
      }
      const log = await controller.drive({ direction, speed, durationMs });
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "stop") {
      const log = await controller.drive({ direction: "stop", speed: 0 });
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "dock") {
      const log = await controller.dock();
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "wake") {
      const log = await controller.wake();
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "volume") {
      const volume = Number(action.params.volume ?? 3);
      const log = await controller.setVolume({ volume });
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "animation") {
      const animationId = String(action.params.animationId ?? "happy-hello");
      const log = await controller.animation({ animationId });
      results.push(log.resultMessage);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "roam") {
      const animationId = String(action.params.animationId ?? "idle-scan");
      const log = await controller.animation({ animationId });
      results.push(`Patrol request sent. ${log.resultMessage}`);
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "status") {
      const status = await controller.getStatus();
      results.push(
        `${status.nickname ?? status.name} is ${status.isConnected ? "online" : "offline"} with ${status.batteryPercent}% battery.`
      );
      latestStatus = status;
    }
  }

  return {
    parsed,
    resultMessage: results.join(" "),
    robot: latestStatus,
    integration: await controller.getIntegrationInfo()
  };
};
