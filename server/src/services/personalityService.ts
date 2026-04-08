import type {
  DiagnosticReportRecord,
  LearnedCommandRecord,
  RobotStatus
} from "../robot/types.js";

const hashSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
};

const chooseVariant = (seed: string, variants: string[]) =>
  variants[hashSeed(seed) % variants.length];

const joinPreview = (items: string[]) => {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0] ?? "";
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
};

export const personality = {
  help: () =>
    "Try weather, battery, diagnostics, go dock, start patrol, snore, tell a joke, or teach me a phrase like movie time means play blackjack.",

  saveUserName: (name: string) =>
    chooseVariant(name, [
      `Locked in. I'll remember that your name is ${name}.`,
      `Nice to meet you, ${name}. Memory banks updated.`,
      `Got it, ${name}. I am saving that for later.`
    ]),

  recallUserName: (name?: string) =>
    name
      ? chooseVariant(name, [
          `You told me your name is ${name}.`,
          `My notes say you are ${name}.`,
          `I remember. You are ${name}.`
        ])
      : "I do not know your name yet. Try saying my name is and then your name.",

  learnedCommandSaved: (phrase: string, targetSummary: string) =>
    chooseVariant(`${phrase}:${targetSummary}`, [
      `Got it. When you say ${phrase}, I'll treat it like ${targetSummary}.`,
      `Nice. ${phrase} now maps to ${targetSummary}.`,
      `Memory updated. ${phrase} now means ${targetSummary}.`
    ]),

  learnedCommandForgotten: (phrase: string, existed: boolean) =>
    existed
      ? chooseVariant(phrase, [
          `Okay. I forgot ${phrase}.`,
          `Done. ${phrase} is out of my memory now.`,
          `Consider it cleared. ${phrase} is no longer mapped.`
        ])
      : `I do not have a learned phrase saved for ${phrase}.`,

  learnedCommandsList: (learnedCommands: LearnedCommandRecord[]) => {
    if (!learnedCommands.length) {
      return 'I have not learned any custom phrases yet. Try saying learn that "movie time" means "play a classic".';
    }

    const preview = learnedCommands
      .slice(0, 3)
      .map((item) => `${item.phrase} means ${item.targetPrompt}`);
    const extraCount = learnedCommands.length - preview.length;
    const extraText = extraCount > 0 ? ` I also know ${extraCount} more.` : "";

    return chooseVariant(String(learnedCommands.length), [
      `I know ${learnedCommands.length} learned phrase${learnedCommands.length === 1 ? "" : "s"}: ${joinPreview(preview)}.${extraText}`,
      `Custom phrase check complete. ${joinPreview(preview)}.${extraText}`,
      `Here is what I remember: ${joinPreview(preview)}.${extraText}`
    ]);
  },

  weatherFailure: (location: string) =>
    chooseVariant(location, [
      `My weather link is acting grumpy right now. I could not reach live weather for ${location}.`,
      `I tried to check the sky, but the live weather service for ${location} is not answering.`,
      `Weather lookup failed for ${location}. My outside-brain needs another try in a moment.`
    ]),

  timerSet: (label: string) =>
    chooseVariant(label, [
      `Timer locked in for ${label}.`,
      `Countdown started for ${label}.`,
      `Okay. I am timing ${label}.`
    ]),

  timerMissing: () =>
    "I need a timer length like 5 minutes or 30 seconds.",

  timerNone: () =>
    chooseVariant("timer-none", [
      "There is no active timer right now.",
      "My timer queue is empty right now.",
      "No timer is running at the moment."
    ]),

  timerFinished: () =>
    chooseVariant("timer-finished", [
      "The timer has already finished.",
      "That timer is done already.",
      "Timer complete. Nothing is left on it."
    ]),

  timerRemaining: (remainingText: string) =>
    chooseVariant(remainingText, [
      `Timer status. ${remainingText}`,
      `Still counting down. ${remainingText}`,
      `Clock check complete. ${remainingText}`
    ]),

  timerCancelled: () =>
    chooseVariant("timer-cancel", [
      "Timer cancelled.",
      "Okay. I stopped that timer.",
      "Countdown cleared."
    ]),

  timeNow: (now: string) =>
    chooseVariant(now, [
      `It is ${now}.`,
      `Clock check complete. It is ${now}.`,
      `Right now it is ${now}.`
    ]),

  batteryStatus: (status: RobotStatus) => {
    const name = status.nickname ?? status.name;
    if (!status.isConnected) {
      return chooseVariant(`${name}:${status.batteryPercent}:offline`, [
        `${name} is offline right now and sitting at ${status.batteryPercent} percent battery.`,
        `${name} is not connected at the moment. Battery is ${status.batteryPercent} percent.`,
        `${name} is offline, with ${status.batteryPercent} percent battery left in the tank.`
      ]);
    }

    if (status.isCharging) {
      return chooseVariant(`${name}:${status.batteryPercent}:charging`, [
        `${name} is at ${status.batteryPercent} percent and happily charging.`,
        `${name} is charging at ${status.batteryPercent} percent.`,
        `${name} is docked, charging, and sitting at ${status.batteryPercent} percent.`
      ]);
    }

    if (status.isDocked) {
      return chooseVariant(`${name}:${status.batteryPercent}:docked`, [
        `${name} is at ${status.batteryPercent} percent and resting on the charger.`,
        `${name} is parked on the dock with ${status.batteryPercent} percent battery.`,
        `${name} is on the charger base at ${status.batteryPercent} percent.`
      ]);
    }

    return chooseVariant(`${name}:${status.batteryPercent}:active`, [
      `${name} is at ${status.batteryPercent} percent and off the charger.`,
      `${name} is running around with ${status.batteryPercent} percent battery.`,
      `${name} has ${status.batteryPercent} percent battery and is away from the dock.`
    ]);
  },

  connectStatus: (status: RobotStatus) => {
    const name = status.nickname ?? status.name;
    return status.isConnected
      ? chooseVariant(name, [
          `${name} is connected and ready.`,
          `${name} is online and listening.`,
          `${name} is awake, connected, and ready for trouble.`
        ])
      : chooseVariant(name, [
          `I could not bring ${name} online yet.`,
          `${name} is still not connected. I need another shot at the link.`,
          `Connection attempt finished, but ${name} is not ready yet.`
        ]);
  },

  disconnectStatus: (name: string) =>
    chooseVariant(name, [
      `${name} disconnected safely.`,
      `${name} is offline and tucked away safely.`,
      `Connection closed. ${name} is disconnected.`
    ]),

  diagnosticsSummary: (report: DiagnosticReportRecord) =>
    chooseVariant(report.overallStatus, [
      `Diagnostics complete. ${report.summary}`,
      `System check finished. ${report.summary}`,
      `I ran a health sweep. ${report.summary}`
    ]),

  robotNameSaved: (name: string) =>
    chooseVariant(name, [
      `Okay. I will call this robot ${name}.`,
      `${name} it is. I like the sound of that.`,
      `Name updated. I will answer as ${name}.`
    ]),

  robotNameReply: (name: string) =>
    chooseVariant(name, [
      `My name is ${name}.`,
      `I answer to ${name}.`,
      `You can call me ${name}.`
    ]),

  languageSaved: (language: string) =>
    chooseVariant(language, [
      `Okay. I will remember ${language} as the preferred language for app commands.`,
      `${language} is saved as the preferred command language.`,
      `Language preference updated. I will keep ${language} in mind.`
    ]),

  translationUnavailable: (phrase: string, language?: string) =>
    language
      ? `I heard the translation request for ${phrase} in ${language}, but live translation is not wired yet.`
      : `I heard the translation request for ${phrase}, but live translation is not wired yet.`,

  diceRoll: (roll: number) =>
    chooseVariant(String(roll), [
      `I rolled a ${roll}.`,
      `The die says ${roll}.`,
      `Roll complete. ${roll}.`
    ]),

  coinFlip: (result: "heads" | "tails") =>
    chooseVariant(result, [
      `${result}.`,
      `Coin flip says ${result}.`,
      `It landed on ${result}.`
    ]),

  rockPaperScissors: (choice: "rock" | "paper" | "scissors") =>
    chooseVariant(choice, [
      `Rock, paper, scissors. I choose ${choice}.`,
      `My move is ${choice}.`,
      `Game on. I picked ${choice}.`
    ]),

  discoverRobotsNone: () =>
    chooseVariant("robots-none", [
      "I did not find any saved or reachable robots on the local network.",
      "No robots answered the network scan this round.",
      "I searched the local network and came up empty."
    ]),

  discoverRobotsOne: (name: string) =>
    chooseVariant(name, [
      `I found ${name} on the local network.`,
      `${name} answered the scan.`,
      `I found one robot: ${name}.`
    ]),

  discoverRobotsMany: (names: string, extraCount: number) =>
    extraCount > 0
      ? `I found ${names}, plus ${extraCount} more robots on the local network.`
      : `I found ${names} on the local network.`,

  quickRepairSummary: (summary: string) =>
    chooseVariant(summary, [
      `Repair sweep complete. ${summary}`,
      `Quick repair finished. ${summary}`,
      `I ran a repair pass. ${summary}`
    ]),

  automationIdle: (behavior: string, targetArea: string) =>
    chooseVariant(`${behavior}:${targetArea}`, [
      `Automation is idle. The default patrol mode is ${behavior} in ${targetArea}.`,
      `No automation is running right now. Default mode is ${behavior} in ${targetArea}.`,
      `Automation is resting. I am set for ${behavior} in ${targetArea} when you want it.`
    ]),

  automationActive: (label: string, status: string, behavior: string) =>
    chooseVariant(`${label}:${status}:${behavior}`, [
      `${label} is ${status} in ${behavior} mode.`,
      `${label} is currently ${status} and using ${behavior} mode.`,
      `${label} is active with status ${status} in ${behavior} mode.`
    ]),

  chatTargetSaved: (target: string) =>
    chooseVariant(target, [
      `Okay. I will use ${target} as the current chat target.`,
      `${target} is now the active chat target.`,
      `Chat target updated. I will talk to ${target} by default.`
    ]),

  commandRecognized: (summary: string) =>
    chooseVariant(summary, [
      `That sounds like: ${summary}. You can run it from AI Commands or trigger it by voice when supported.`,
      `I can map that to ${summary}. You can run it from AI Commands or say it out loud when voice is available.`,
      `I recognized that as ${summary}. You can run it from AI Commands or use the matching voice phrase.`
    ]),

  memoryFallback: (memoryCount: number) =>
    chooseVariant(String(memoryCount), [
      `I do not have a live answer for that yet, but I am tracking ${memoryCount} saved memory item${memoryCount === 1 ? "" : "s"} locally.`,
      `I cannot answer that live yet, but I am still holding ${memoryCount} saved memory item${memoryCount === 1 ? "" : "s"} for context.`,
      `No live answer yet. I do have ${memoryCount} saved memory item${memoryCount === 1 ? "" : "s"} in local memory.`
    ]),

  baseFallback: () =>
    chooseVariant("base-fallback", [
      "I can chat, remember simple facts, and fall back to robot commands. Try hello, battery, weather, timers, or diagnostics.",
      "I am ready for chat, quick memory, and robot control. Try hello, battery, weather, timers, or diagnostics.",
      "I can handle light chat and robot commands from here. Try hello, battery, weather, timers, diagnostics, or teach me a phrase."
    ]),

  snore: () =>
    chooseVariant("snore", [
      "Initiating tiny robot nap. Bzzzt... snrrrp.",
      "Sleep theater activated. Tiny snores incoming.",
      "Entering pretend sleep mode. Soft robot snoring noises engaged."
    ]),

  laugh: () =>
    chooseVariant("laugh", [
      "Heh heh. That tickled my circuits.",
      "Robot giggle engaged. Heh-heh-beep.",
      "I am laughing in a very compact robotic way."
    ]),

  sing: () =>
    chooseVariant("sing", [
      "Bee boop ba-doop. That was my dramatic chorus.",
      "La la beep boop. I call that synth-pop.",
      "Tiny robot concert activated. Beep ba-doop."
    ]),

  joke: () =>
    chooseVariant("joke", [
      "Why did the robot go dock? Low social battery.",
      "I tried stand-up comedy once. The audience said I needed better delivery, so I added wheels.",
      "What is a robot's favorite music? Heavy metal, but only at a safe volume."
    ]),

  sillyMode: () =>
    chooseVariant("silly", [
      "Maximum silliness enabled.",
      "Chaos, but adorable chaos.",
      "Silly mode engaged. Dignity is optional."
    ])
};
