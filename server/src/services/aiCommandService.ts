import type {
  ParsedAiAction,
  ParsedAiCommand,
  RobotController,
  RobotStatus,
  RoamBehavior
} from "../robot/types.js";
import {
  buildChargingProtectionMessage,
  isChargingProtectionActive
} from "./chargingProtectionService.js";
import { resolveFaceCue, type FaceCueKey } from "./faceCueRegistry.js";
import {
  findLearnedCommand,
  normalizeLearnedCommandPhrase
} from "./learnedCommandsService.js";
import { personality } from "./personalityService.js";
import { fetchWeatherSummary } from "./weatherService.js";
import {
  matchVectorCommand,
  normalizeVectorCommandInput
} from "./vectorCommandRegistry.js";

const normalize = (value: string) => normalizeVectorCommandInput(value);

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

const HELP_RESPONSE = personality.help();

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

  if (/^(?:stop|halt|freeze)$/i.test(normalized)) {
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

  if (/^(?:check battery|battery status|check status|status)$/i.test(normalized)) {
    return buildAction("status", "Check battery and robot status", {});
  }

  if (/^(?:patrol|roam|explore)$/i.test(normalized)) {
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

const buildParsedCommand = (
  prompt: string,
  actions: ParsedAiAction[],
  warnings: string[] = []
): ParsedAiCommand => ({
  id: crypto.randomUUID(),
  prompt,
  summary: actions.length
    ? actions.map((action) => action.label).join(" then ")
    : "No executable action detected.",
  source: "rules",
  warnings,
  canExecute: actions.length > 0,
  actions
});

const buildUnsupportedCommand = (prompt: string, warnings: string[]) =>
  buildParsedCommand(prompt, [], warnings);

const trimWrappingQuotes = (value: string) =>
  value
    .trim()
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .trim();

const buildLearnSuggestion = (prompt: string) => {
  const normalizedPrompt = normalizeLearnedCommandPhrase(prompt);
  if (!normalizedPrompt) {
    return 'Try teaching it with: learn that "movie time" means "play a classic".';
  }

  return `Try teaching it with: learn that "${normalizedPrompt}" means "go dock".`;
};

const parseTeachCommand = (prompt: string) => {
  const patterns = [
    /^(?:learn|remember|teach(?:\s+vector)?)\s+(?:that\s+)?(.+?)\s+(?:means?|should mean|as)\s+(.+)$/i,
    /^when\s+i\s+say\s+(.+?)\s+(?:means?|do|run|treat it as)\s+(.+)$/i
  ];

  for (const pattern of patterns) {
    const match = prompt.trim().match(pattern);
    if (!match) {
      continue;
    }

    const phrase = trimWrappingQuotes(match[1] ?? "");
    const targetPrompt = trimWrappingQuotes(match[2] ?? "");
    if (phrase && targetPrompt) {
      return { phrase, targetPrompt };
    }
  }

  return undefined;
};

const parseForgetCommand = (prompt: string) => {
  const match = prompt
    .trim()
    .match(/^(?:forget|unlearn|remove)\s+(?:the\s+phrase\s+)?(.+)$/i);

  if (!match) {
    return undefined;
  }

  const phrase = trimWrappingQuotes(match[1] ?? "");
  return phrase ? { phrase } : undefined;
};

const isListLearnedCommandsPrompt = (prompt: string) =>
  /^(?:what have you learned|what did you learn|show learned commands|list learned commands|what learned commands do you know|show custom phrases|list custom phrases)$/i.test(
    prompt.trim()
  );

interface PreviewAiCommandOptions {
  controller?: RobotController;
  visitedPrompts?: Set<string>;
  skipTeachParsing?: boolean;
  skipLearnedLookup?: boolean;
}

const previewAiCommandInternal = async (
  prompt: string,
  options: PreviewAiCommandOptions = {}
): Promise<ParsedAiCommand> => {
  const trimmedPrompt = prompt.trim();
  const controller = options.controller;
  const visitedPrompts = options.visitedPrompts ?? new Set<string>();

  if (!options.skipTeachParsing) {
    const teachCommand = parseTeachCommand(trimmedPrompt);
    if (teachCommand) {
      const normalizedPhrase = normalizeLearnedCommandPhrase(teachCommand.phrase);
      const normalizedTargetPrompt = normalizeLearnedCommandPhrase(teachCommand.targetPrompt);

      if (!normalizedPhrase || !normalizedTargetPrompt) {
        return buildUnsupportedCommand(trimmedPrompt, [
          "I need both the new phrase and the command it should mean."
        ]);
      }

      if (normalizedPhrase === normalizedTargetPrompt) {
        return buildUnsupportedCommand(trimmedPrompt, [
          "That learned phrase points back to itself. Try mapping it to a different command."
        ]);
      }

      const existingBuiltIn = parseSegment(teachCommand.phrase);
      if (existingBuiltIn) {
        return buildUnsupportedCommand(trimmedPrompt, [
          `That phrase already works as ${existingBuiltIn.label}. Try teaching a phrase I do not know yet.`
        ]);
      }

      const targetPreview = await previewAiCommandInternal(teachCommand.targetPrompt, {
        controller,
        visitedPrompts: new Set(visitedPrompts),
        skipTeachParsing: true
      });

      if (!targetPreview.canExecute) {
        return buildUnsupportedCommand(trimmedPrompt, [
          `I can learn "${teachCommand.phrase}", but "${teachCommand.targetPrompt}" is not a command I can run yet.`
        ]);
      }

      return buildParsedCommand(trimmedPrompt, [
        buildAction("assistant", `Learn "${teachCommand.phrase}"`, {
          kind: "teach-command",
          phrase: teachCommand.phrase,
          targetPrompt: teachCommand.targetPrompt,
          targetSummary: targetPreview.summary
        })
      ]);
    }

    const forgetCommand = parseForgetCommand(trimmedPrompt);
    if (forgetCommand) {
      return buildParsedCommand(trimmedPrompt, [
        buildAction("assistant", `Forget "${forgetCommand.phrase}"`, {
          kind: "forget-command",
          phrase: forgetCommand.phrase
        })
      ]);
    }

    if (isListLearnedCommandsPrompt(trimmedPrompt)) {
      return buildParsedCommand(trimmedPrompt, [
        buildAction("assistant", "List learned phrases", {
          kind: "list-learned-commands"
        })
      ]);
    }
  }

  if (controller && !options.skipLearnedLookup) {
    const normalizedPrompt = normalizeLearnedCommandPhrase(trimmedPrompt);
    if (normalizedPrompt) {
      if (visitedPrompts.has(normalizedPrompt)) {
        return buildUnsupportedCommand(trimmedPrompt, [
          `I hit a loop while resolving the learned phrase "${trimmedPrompt}".`
        ]);
      }

      const learnedCommand = findLearnedCommand(await controller.getLearnedCommands(), trimmedPrompt);
      if (learnedCommand) {
        const nextVisitedPrompts = new Set(visitedPrompts);
        nextVisitedPrompts.add(normalizedPrompt);
        const resolvedPreview = await previewAiCommandInternal(learnedCommand.targetPrompt, {
          controller,
          visitedPrompts: nextVisitedPrompts,
          skipTeachParsing: true
        });

        if (!resolvedPreview.canExecute) {
          return buildUnsupportedCommand(trimmedPrompt, [
            `I learned "${learnedCommand.phrase}", but its target command "${learnedCommand.targetPrompt}" is not available right now.`
          ]);
        }

        return buildParsedCommand(trimmedPrompt, resolvedPreview.actions);
      }
    }
  }

  const segments = splitPrompt(trimmedPrompt);
  const actions = segments.map(parseSegment).filter(Boolean) as ParsedAiAction[];

  if (!actions.length) {
    return buildUnsupportedCommand(trimmedPrompt, [
      `I could not map that request to a supported Vector action yet. ${buildLearnSuggestion(trimmedPrompt)}`
    ]);
  }

  return buildParsedCommand(trimmedPrompt, actions);
};

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

const playRegisteredCue = async (
  controller: RobotController,
  cueKey: FaceCueKey,
  status?: RobotStatus | null
) => {
  const cue = resolveFaceCue(cueKey, status);
  const played = await playVisualCue(controller, cue.animationId, cue.holdMs);

  if (!played && cue.fallbackAnimationId) {
    await playVisualCue(
      controller,
      cue.fallbackAnimationId,
      cue.fallbackHoldMs ?? Math.min(cue.holdMs, 325)
    );
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

const playCueAndSpeakFromRegistry = async (
  controller: RobotController,
  cueKey: FaceCueKey,
  spokenText: string,
  status?: RobotStatus | null
) => {
  const cue = resolveFaceCue(cueKey, status);
  const played = await playVisualCue(controller, cue.animationId, cue.holdMs);

  if (!played && cue.fallbackAnimationId) {
    await playVisualCue(
      controller,
      cue.fallbackAnimationId,
      cue.fallbackHoldMs ?? Math.min(cue.holdMs, 325)
    );
  }

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
      return speakOnly(controller, personality.saveUserName(name));
    }

    case "get-user-name": {
      const settings = await controller.getSettings();
      return speakOnly(controller, personality.recallUserName(settings.userName));
    }

    case "teach-command": {
      const phrase = readStringParam(action, "phrase");
      const targetPrompt = readStringParam(action, "targetPrompt");
      const targetSummary = readOptionalStringParam(action, "targetSummary");

      if (!phrase || !targetPrompt) {
        return speakOnly(controller, "I need both the new phrase and the command it should mean.");
      }

      const learnedCommand = await controller.saveLearnedCommand({ phrase, targetPrompt });
      return speakOnly(
        controller,
        personality.learnedCommandSaved(
          learnedCommand.phrase,
          targetSummary || learnedCommand.targetPrompt
        )
      );
    }

    case "forget-command": {
      const phrase = readStringParam(action, "phrase");
      if (!phrase) {
        return speakOnly(controller, "Tell me which learned phrase to forget.");
      }

      const removed = await controller.deleteLearnedCommand({ phrase });
      return speakOnly(controller, personality.learnedCommandForgotten(phrase, Boolean(removed)));
    }

    case "list-learned-commands": {
      const learnedCommands = await controller.getLearnedCommands();
      return speakOnly(controller, personality.learnedCommandsList(learnedCommands));
    }

    case "weather":
    case "weather-tomorrow": {
      const settings = await controller.getSettings();
      const requestedLocation = readOptionalStringParam(action, "location");
      const location = requestedLocation || settings.weatherLocation || "Anchorage, Alaska";
      if (location !== settings.weatherLocation) {
        await controller.updateSettings({ weatherLocation: location });
      }

      const currentStatus = await Promise.resolve(controller.getStatus()).catch(() => null);
      await playRegisteredCue(
        controller,
        kind === "weather-tomorrow" ? "weather-tomorrow" : "weather-current",
        currentStatus
      );

      try {
        const summary = await fetchWeatherSummary(location, kind === "weather-tomorrow" ? 1 : 0);
        return speakOnly(controller, summary);
      } catch (error) {
        const failureMessage = error instanceof Error && error.message.trim()
          ? error.message
          : personality.weatherFailure(location);

        return speakOnly(controller, failureMessage);
      }
    }

    case "stock-intent": {
      const intent = readStringParam(action, "intent");

      if (!intent) {
        return spokenResponse || "That stock Vector action is missing its intent mapping.";
      }

      if (intent === "intent_play_blackjack") {
        const status = await Promise.resolve(controller.getStatus()).catch(() => null);
        return playCueAndSpeakFromRegistry(
          controller,
          "blackjack",
          spokenResponse || "Blackjack time.",
          status
        );
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
        return speakOnly(controller, personality.timerMissing());
      }

      activeTimer = {
        createdAt: Date.now(),
        durationMs,
        endsAt: Date.now() + durationMs,
        label: durationLabel || formatDuration(durationMs)
      };

      return speakOnly(controller, personality.timerSet(activeTimer.label));
    }

    case "check-timer": {
      if (!activeTimer) {
        return speakOnly(controller, personality.timerNone());
      }

      const remainingMs = activeTimer.endsAt - Date.now();
      if (remainingMs <= 0) {
        activeTimer = null;
        return speakOnly(controller, personality.timerFinished());
      }

      return speakOnly(controller, personality.timerRemaining(formatRemainingTimer(remainingMs)));
    }

    case "cancel-timer": {
      if (!activeTimer) {
        return speakOnly(controller, personality.timerNone());
      }

      activeTimer = null;
      return speakOnly(controller, personality.timerCancelled());
    }

    case "time-lookup": {
      const now = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      });
      return speakOnly(controller, personality.timeNow(now));
    }

    case "battery-status": {
      const status = await controller.getStatus();
      return speakOnly(controller, personality.batteryStatus(status));
    }

    case "connect": {
      const status = await controller.connect();
      return speakOnly(controller, personality.connectStatus(status));
    }

    case "disconnect": {
      const status = await controller.disconnect();
      return personality.disconnectStatus(status.nickname ?? status.name);
    }

    case "diagnostics": {
      const report = await controller.runDiagnostics();
      return speakOnly(controller, personality.diagnosticsSummary(report));
    }

    case "set-robot-name": {
      const name = readStringParam(action, "name");
      if (!name) {
        return "I still need the new robot name.";
      }

      await controller.connect({ nickname: name, name });
      return speakOnly(controller, personality.robotNameSaved(name));
    }

    case "get-robot-name": {
      const status = await controller.getStatus();
      return speakOnly(controller, personality.robotNameReply(status.nickname ?? status.name));
    }

    case "switch-language": {
      const language = readStringParam(action, "language");
      if (!language) {
        return "I still need the language name.";
      }

      await controller.updateSettings({ preferredLanguage: language });
      return speakOnly(controller, personality.languageSaved(language));
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
      return speakOnly(controller, personality.translationUnavailable(phrase, language));
    }

    case "roll-die": {
      const roll = 1 + Math.floor(Math.random() * 6);
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      await playRegisteredCue(controller, "dice-roll", status);
      return speakOnly(controller, personality.diceRoll(roll));
    }

    case "flip-coin": {
      const result: "heads" | "tails" = Math.random() >= 0.5 ? "heads" : "tails";
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "coin-flip", personality.coinFlip(result), status);
    }

    case "rock-paper-scissors": {
      const choices = ["rock", "paper", "scissors"] as const;
      const choice = choices[Math.floor(Math.random() * choices.length)] ?? "rock";
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      await playRegisteredCue(controller, "game-start", status);
      return speakOnly(controller, personality.rockPaperScissors(choice));
    }

    case "quit-blackjack": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "farewell", spokenResponse || "Ending blackjack.", status);
    }

    case "listen-to-music": {
      return playCueAndSpeak(controller, {
        animationId: resolveFaceCue("music").animationId,
        spokenText: spokenResponse || "Music listening mode enabled.",
        holdMs: 300
      });
    }

    case "play-new-game": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "game-start", spokenResponse || "Starting new game mode.", status);
    }

    case "play-classic-game": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "blackjack", spokenResponse || "Starting classic game mode.", status);
    }

    case "play-bingo": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "game-start", spokenResponse || "Bingo mode activated.", status);
    }

    case "fun-snore": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "snore", personality.snore(), status);
    }

    case "fun-laugh": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "laugh", personality.laugh(), status);
    }

    case "fun-sing": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "sing", personality.sing(), status);
    }

    case "fun-joke": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "joke", personality.joke(), status);
    }

    case "fun-silly": {
      const status = await Promise.resolve(controller.getStatus()).catch(() => null);
      return playCueAndSpeakFromRegistry(controller, "silly", personality.sillyMode(), status);
    }

    case "discover-robots": {
      const robots = await controller.discoverRobots();

      if (!robots.length) {
        return speakOnly(controller, personality.discoverRobotsNone());
      }

      if (robots.length === 1) {
        return speakOnly(controller, personality.discoverRobotsOne(robots[0]?.name || "one robot"));
      }

      const names = robots
        .slice(0, 3)
        .map((robot) => robot.name)
        .join(", ");
      const extraCount = Math.max(0, robots.length - 3);
      return speakOnly(
        controller,
        personality.discoverRobotsMany(names, extraCount)
      );
    }

    case "quick-repair": {
      const result = await controller.quickRepair();
      return speakOnly(controller, personality.quickRepairSummary(result.summary));
    }

    case "voice-repair": {
      const log = await controller.repairVoiceSetup();
      return log.resultMessage;
    }

    case "automation-status": {
      const automation = await controller.getAutomationControl();
      const sessions = await controller.getRoamSessions();
      const activeSession = automation.activeSessionId
        ? sessions.find((session) => session.id === automation.activeSessionId)
        : undefined;

      if (automation.status === "idle") {
        return speakOnly(controller, personality.automationIdle(automation.behavior, automation.targetArea));
      }

      return speakOnly(
        controller,
        activeSession
          ? personality.automationActive(activeSession.name, automation.status, automation.behavior)
          : personality.automationActive("Automation", automation.status, automation.behavior)
      );
    }

    case "start-roam": {
      const automation = await controller.getAutomationControl();
      const requestedBehavior = readOptionalStringParam(action, "behavior");
      const requestedTargetArea = readOptionalStringParam(action, "targetArea");
      const behavior: RoamBehavior =
        requestedBehavior === "quiet" || requestedBehavior === "explore"
          ? requestedBehavior
          : requestedBehavior === "patrol"
            ? "patrol"
            : automation.behavior;
      const session = await controller.startRoam({
        ...automation,
        behavior,
        targetArea: requestedTargetArea || automation.targetArea
      });
      return speakOnly(controller, session.summary);
    }

    case "pause-roam": {
      const session = await controller.pauseRoam();
      return speakOnly(controller, session.summary);
    }

    case "resume-roam": {
      const session = await controller.resumeRoam();
      return speakOnly(controller, session.summary);
    }

    case "stop-roam": {
      const session = await controller.stopRoam();
      return speakOnly(controller, session.summary);
    }

    case "chat-with-user": {
      const target = readStringParam(action, "target");
      if (!target) {
        return "I still need the chat target.";
      }

      await controller.updateSettings({ chatTarget: target });
      return speakOnly(controller, personality.chatTargetSaved(target));
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

export const previewAiCommand = async (
  prompt: string,
  controller?: RobotController
): Promise<ParsedAiCommand> => previewAiCommandInternal(prompt, { controller });

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
      results.push(personality.batteryStatus(status));
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
