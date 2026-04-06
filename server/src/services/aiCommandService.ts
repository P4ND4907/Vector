import type {
  ParsedAiAction,
  ParsedAiCommand,
  RobotController,
  RobotStatus
} from "../robot/types.js";
import {
  buildChargingProtectionMessage,
  isChargingProtectionActive
} from "./chargingProtectionService.js";
import { fetchWeatherSummary } from "./weatherService.js";
import { matchVectorCommand } from "./vectorCommandRegistry.js";

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

const HELP_RESPONSE =
  "Try hello, what time is it, what's the weather, take a picture, roll a die, drive forward, go dock, run diagnostics, or my name is followed by your name.";

let activeTimer:
  | {
      createdAt: number;
      durationMs: number;
      endsAt: number;
      label: string;
    }
  | null = null;

const readStringParam = (action: ParsedAiAction, key: string) => {
  const value = action.params[key];
  return typeof value === "string" ? value.trim() : "";
};

const readOptionalStringParam = (action: ParsedAiAction, key: string) => {
  const value = readStringParam(action, key);
  return value || undefined;
};

const readNumberParam = (action: ParsedAiAction, key: string) => {
  const value = action.params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];

  if (hours) {
    parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  }

  if (minutes) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }

  if (seconds && !hours) {
    parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  }

  return parts.join(" ");
};

const formatRemainingTimer = (remainingMs: number) => {
  if (remainingMs <= 0) {
    return "The timer has already finished.";
  }

  return `${formatDuration(remainingMs)} remaining.`;
};

const parseBuiltInSegment = (segment: string): ParsedAiAction | null => {
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
    return buildAction("drive", `Drive ${direction}`, {
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

  if (
    /^(?:go\s+)?dock$|^return(?:\s+to)?\s+(?:the\s+)?dock$|^(?:go|return|head)\s+(?:to\s+)?(?:your\s+)?charger$|^(?:go|return|head)\s+home$|^back\s+to\s+(?:the\s+)?(?:dock|charger)$/.test(
      normalized
    )
  ) {
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

const parseSegment = (segment: string): ParsedAiAction | null =>
  parseBuiltInSegment(segment) ?? matchVectorCommand(segment);

const speakOnly = async (controller: RobotController, text: string) => {
  const log = await controller.speak({ text });
  return log.resultMessage;
};

const playVisualCue = async (
  controller: RobotController,
  animationId: string,
  holdMs = 325
) => {
  try {
    await controller.animation({ animationId });
    if (holdMs > 0) {
      await sleep(holdMs);
    }
    return true;
  } catch {
    return false;
  }
};

const playCueAndSpeak = async (
  controller: RobotController,
  {
    animationId,
    spokenText,
    holdMs = 325
  }: {
    animationId: string;
    spokenText: string;
    holdMs?: number;
  }
) => {
  await playVisualCue(controller, animationId, holdMs);
  return speakOnly(controller, spokenText);
};

const runAssistantAction = async (
  controller: RobotController,
  action: ParsedAiAction,
  prompt: string
) => {
  const kind = readStringParam(action, "kind") || "placeholder";
  const commandKey = readOptionalStringParam(action, "commandKey") || kind;
  const commandCategory = readOptionalStringParam(action, "commandCategory");
  const spokenResponse = readOptionalStringParam(action, "spokenResponse");

  switch (kind) {
    case "set-user-name": {
      const name = readStringParam(action, "name");
      if (!name) {
        return "I still need the name to save.";
      }
      await controller.updateSettings({ userName: name });
      return speakOnly(controller, `Got it. I'll remember that your name is ${name}.`);
    }

    case "get-user-name": {
      const settings = await controller.getSettings();
      return speakOnly(
        controller,
        settings.userName
          ? `Your name is ${settings.userName}.`
          : "I do not know your name yet. Say my name is and then your name."
      );
    }

    case "weather":
    case "weather-tomorrow": {
      const settings = await controller.getSettings();
      const requestedLocation = readOptionalStringParam(action, "location");
      const location = requestedLocation || settings.weatherLocation || "Anchorage, Alaska";
      let animationId = "question-prompt";
      if (location !== settings.weatherLocation) {
        await controller.updateSettings({ weatherLocation: location });
      }

      if (kind === "weather" && !requestedLocation) {
        try {
          const weatherConfig = await controller.getWirePodWeatherConfig();
          if (weatherConfig.enable && weatherConfig.provider && weatherConfig.key) {
            animationId = "weather-report";
          }
        } catch {
          // If the stock weather routine is unavailable, still use a safe on-robot visual cue.
        }
      }

      await playVisualCue(controller, animationId, animationId === "weather-report" ? 500 : 325);

      const summary = await fetchWeatherSummary(location, kind === "weather-tomorrow" ? 1 : 0);

      return speakOnly(controller, summary);
    }

    case "stock-intent": {
      const intent = readStringParam(action, "intent");

      if (!intent) {
        return spokenResponse || "That stock Vector action is missing its intent mapping.";
      }

      try {
        const log = await controller.animation({ animationId: intent });
        return spokenResponse || log.resultMessage;
      } catch (error) {
        if (spokenResponse) {
          return speakOnly(controller, spokenResponse);
        }

        throw error;
      }
    }

    case "set-timer": {
      const durationMs = readNumberParam(action, "durationMs");
      const durationLabel = readOptionalStringParam(action, "durationLabel");

      if (!durationMs) {
        return speakOnly(controller, "I need a timer length like 5 minutes or 30 seconds.");
      }

      activeTimer = {
        createdAt: Date.now(),
        durationMs,
        endsAt: Date.now() + durationMs,
        label: durationLabel || formatDuration(durationMs)
      };

      return speakOnly(controller, `Timer set for ${activeTimer.label}.`);
    }

    case "check-timer": {
      if (!activeTimer) {
        return speakOnly(controller, "There is no active timer right now.");
      }

      const remainingMs = activeTimer.endsAt - Date.now();
      if (remainingMs <= 0) {
        activeTimer = null;
        return speakOnly(controller, "The timer has already finished.");
      }

      return speakOnly(controller, `Timer status. ${formatRemainingTimer(remainingMs)}`);
    }

    case "cancel-timer": {
      if (!activeTimer) {
        return speakOnly(controller, "There is no active timer to cancel.");
      }

      activeTimer = null;
      return speakOnly(controller, "Timer cancelled.");
    }

    case "time-lookup": {
      const now = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      });
      return speakOnly(controller, `It is ${now}.`);
    }

    case "battery-status": {
      const status = await controller.getStatus();
      const chargingText = status.isCharging
        ? "and charging"
        : status.isDocked
          ? "and resting on the charger"
          : "and off the charger";
      return speakOnly(
        controller,
        `${status.nickname ?? status.name} is at ${status.batteryPercent} percent battery ${chargingText}.`
      );
    }

    case "connect": {
      const status = await controller.connect();
      return speakOnly(
        controller,
        status.isConnected
          ? `${status.nickname ?? status.name} is connected and ready.`
          : "I could not bring Vector online yet."
      );
    }

    case "disconnect": {
      const status = await controller.disconnect();
      return `${status.nickname ?? status.name} disconnected safely.`;
    }

    case "diagnostics": {
      const report = await controller.runDiagnostics();
      return speakOnly(controller, report.summary);
    }

    case "set-robot-name": {
      const name = readStringParam(action, "name");
      if (!name) {
        return "I still need the new robot name.";
      }

      await controller.connect({ nickname: name, name });
      return speakOnly(controller, `Okay. I will call this robot ${name}.`);
    }

    case "get-robot-name": {
      const status = await controller.getStatus();
      return speakOnly(controller, `My name is ${status.nickname ?? status.name}.`);
    }

    case "switch-language": {
      const language = readStringParam(action, "language");
      if (!language) {
        return "I still need the language name.";
      }

      await controller.updateSettings({ preferredLanguage: language });
      return speakOnly(
        controller,
        `Okay. I will remember ${language} as the preferred language for app commands.`
      );
    }

    case "translate-phrase": {
      const phrase = readStringParam(action, "phrase");
      const language = readOptionalStringParam(action, "language");
      await controller.recordCommandGap({
        source: "ai",
        prompt,
        category: "missing-integration",
        note: "Translation command matched the shared registry, but live translation is not wired yet.",
        matchedIntent: commandKey,
        suggestedArea: "translation"
      });
      return speakOnly(
        controller,
        language
          ? `I heard the translation request for ${phrase} in ${language}. Live translation is not wired yet.`
          : `I heard the translation request for ${phrase}. Live translation is not wired yet.`
      );
    }

    case "roll-die": {
      const roll = 1 + Math.floor(Math.random() * 6);
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      const animationId =
        status && !status.isDocked && !status.isCharging ? "game-time" : "question-prompt";
      await playVisualCue(controller, animationId, animationId === "game-time" ? 450 : 250);
      return speakOnly(controller, `I rolled a ${roll}.`);
    }

    case "quit-blackjack": {
      return playCueAndSpeak(controller, {
        animationId: "goodbye-nod",
        spokenText: spokenResponse || "Ending blackjack.",
        holdMs: 250
      });
    }

    case "listen-to-music": {
      return playCueAndSpeak(controller, {
        animationId: "celebrate-spark",
        spokenText: spokenResponse || "Music listening mode enabled.",
        holdMs: 300
      });
    }

    case "play-new-game": {
      return playCueAndSpeak(controller, {
        animationId: "game-time",
        spokenText: spokenResponse || "Starting new game mode.",
        holdMs: 450
      });
    }

    case "play-classic-game": {
      try {
        await controller.animation({ animationId: "intent_play_blackjack" });
        return spokenResponse || "Starting classic game mode.";
      } catch {
        return playCueAndSpeak(controller, {
          animationId: "game-time",
          spokenText: spokenResponse || "Starting classic game mode.",
          holdMs: 450
        });
      }
    }

    case "play-bingo": {
      return playCueAndSpeak(controller, {
        animationId: "game-time",
        spokenText: spokenResponse || "Bingo mode activated.",
        holdMs: 450
      });
    }

    case "chat-with-user": {
      const target = readStringParam(action, "target");
      if (!target) {
        return "I still need the chat target.";
      }

      await controller.updateSettings({ chatTarget: target });
      return speakOnly(controller, `Okay. I will use ${target} as the current chat target.`);
    }

    case "get-chat-target": {
      const settings = await controller.getSettings();
      return speakOnly(
        controller,
        settings.chatTarget
          ? `Right now I am chatting with ${settings.chatTarget}.`
          : "No chat target is saved yet."
      );
    }

    case "send-chat-message": {
      const settings = await controller.getSettings();
      const target = readOptionalStringParam(action, "target") || settings.chatTarget;
      const message = readStringParam(action, "message");

      if (!target) {
        return speakOnly(controller, "I need a chat target first. Say chat with and then a name.");
      }

      return speakOnly(controller, `Message for ${target}. ${message}`);
    }

    case "volume-down": {
      const status = await controller.getStatus();
      const nextVolume = Math.max(0, (status.volume ?? 3) - 1);
      const log = await controller.setVolume({ volume: nextVolume });
      return log.resultMessage;
    }

    case "volume-up": {
      const status = await controller.getStatus();
      const nextVolume = Math.min(5, (status.volume ?? 3) + 1);
      const log = await controller.setVolume({ volume: nextVolume });
      return log.resultMessage;
    }

    case "mute-audio": {
      const log = await controller.toggleMute({ isMuted: true });
      return log.resultMessage;
    }

    case "unmute-audio": {
      const log = await controller.toggleMute({ isMuted: false });
      return log.resultMessage;
    }

    case "stop-exploring": {
      const automation = await controller.getAutomationControl();
      if (automation.status === "idle") {
        return speakOnly(controller, "Exploration is already idle.");
      }

      const session = await controller.stopRoam();
      return speakOnly(controller, session.summary);
    }

    case "show-help": {
      return speakOnly(controller, spokenResponse || HELP_RESPONSE);
    }

    default: {
      await controller.recordCommandGap({
        source: "ai",
        prompt,
        category: "missing-integration",
        note: `${action.label} matched the shared registry, but it still uses a placeholder response.`,
        matchedIntent: commandKey,
        suggestedArea: commandCategory
      });

      return speakOnly(
        controller,
        spokenResponse || "That command is recognized, but the live action is still being wired up."
      );
    }
  }
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
  const settings = await controller.getSettings();
  let latestStatus = await controller.getStatus();

  for (const action of parsed.actions) {
    if (action.type === "speak") {
      const text = String(action.params.text ?? "");
      if (isChargingProtectionActive(settings, latestStatus)) {
        results.push(buildChargingProtectionMessage("Speech requests"));
        latestStatus = await controller.getStatus();
        continue;
      }
      const needsWake =
        !latestStatus.isConnected ||
        latestStatus.mood === "sleepy" ||
        latestStatus.connectionState !== "connected";
      if (needsWake) {
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
      if (direction !== "stop" && isChargingProtectionActive(settings, latestStatus)) {
        results.push(buildChargingProtectionMessage("Drive commands"));
        latestStatus = await controller.getStatus();
        continue;
      }
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
      if (isChargingProtectionActive(settings, latestStatus)) {
        results.push(buildChargingProtectionMessage("Wake requests"));
        latestStatus = await controller.getStatus();
        continue;
      }
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
      continue;
    }

    if (action.type === "assistant") {
      results.push(await runAssistantAction(controller, action, parsed.prompt));
      latestStatus = await controller.getStatus();
      continue;
    }

    if (action.type === "photo") {
      const sync = await controller.capturePhoto();
      results.push(sync.note);
      latestStatus = await controller.getStatus();
    }
  }

  return {
    parsed,
    resultMessage: results.join(" "),
    robot: latestStatus,
    integration: await controller.getIntegrationInfo()
  };
};
