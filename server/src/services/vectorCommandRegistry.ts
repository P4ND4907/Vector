import type { ParsedAiAction } from "../robot/types.js";

type VectorCommandCategory = "legacy" | "extended" | "custom";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");

const stripCommandPreamble = (value: string) => {
  let current = value.trim();

  while (current) {
    const next = current
      .replace(/^(?:(?:hey|okay|ok|yo)\s+)?vector\s+/i, "")
      .replace(/^(?:assistant|robot)\s+/i, "")
      .replace(/^(?:can|could|would|will)\s+you\s+/i, "")
      .replace(/^(?:(?:please|kindly)\s+)+/i, "")
      .trim();

    if (next === current) {
      return current;
    }

    current = next;
  }

  return current;
};

export const normalizeVectorCommandInput = (value: string) =>
  stripCommandPreamble(normalize(value));

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

const withMeta = (
  commandKey: string,
  category: VectorCommandCategory,
  params: Record<string, unknown> = {}
) => ({
  commandKey,
  commandCategory: category,
  ...params
});

const buildAssistant = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  kind: string,
  params: Record<string, unknown> = {}
) =>
  buildAction(
    "assistant",
    label,
    withMeta(commandKey, category, {
      kind,
      ...params
    })
  );

const buildSpeak = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  text: string
) =>
  buildAction(
    "speak",
    label,
    withMeta(commandKey, category, {
      text
    })
  );

const buildAnimation = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  animationId: string
) =>
  buildAction(
    "animation",
    label,
    withMeta(commandKey, category, {
      animationId
    })
  );

const buildDrive = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  direction: "forward" | "reverse" | "left" | "right",
  speed = 60,
  durationMs?: number
) =>
  buildAction(
    "drive",
    label,
    withMeta(commandKey, category, {
      direction,
      speed,
      durationMs
    })
  );

const buildPhoto = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  params: Record<string, unknown> = {}
) =>
  buildAction("photo", label, withMeta(commandKey, category, params));

const exactAlias = (normalized: string, aliases: string[]) =>
  aliases.some((alias) => normalized === normalize(alias));

const extractDurationMs = (value: string) => {
  const matches = Array.from(
    value.matchAll(
      /(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs|minute|minutes|min|mins|second|seconds|sec|secs|s)\b/gi
    )
  );

  if (!matches.length) {
    return null;
  }

  let total = 0;
  for (const match of matches) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith("hour") || unit.startsWith("hr")) {
      total += amount * 60 * 60 * 1000;
      continue;
    }

    if (unit.startsWith("min")) {
      total += amount * 60 * 1000;
      continue;
    }

    total += amount * 1000;
  }

  return total > 0 ? Math.round(total) : null;
};

const LEGACY_HELP_TEXT =
  "Try weather, battery, diagnostics, go dock, start patrol, snore, tell a joke, or teach me a phrase like movie time means play blackjack.";

const buildPlaceholder = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  spokenResponse: string
) =>
  buildAssistant(commandKey, category, label, "placeholder", {
    spokenResponse
  });

const buildStockIntent = (
  commandKey: string,
  category: VectorCommandCategory,
  label: string,
  intent: string,
  spokenResponse?: string
) =>
  buildAssistant(commandKey, category, label, "stock-intent", {
    intent,
    spokenResponse
  });

export const matchVectorCommand = (segment: string): ParsedAiAction | null => {
  const normalized = normalizeVectorCommandInput(segment);

  if (!normalized) {
    return null;
  }

  if (exactAlias(normalized, ["hello", "hi", "hey", "hiya", "hello there"])) {
    return buildStockIntent(
      "hello",
      "legacy",
      "Play the stock hello greeting",
      "intent_greeting_hello",
      "Hey there. Systems online and feeling sharp."
    );
  }

  if (exactAlias(normalized, ["good morning", "good afternoon", "good evening"])) {
    return buildStockIntent(
      "hello",
      "legacy",
      "Play the stock greeting routine",
      "intent_greeting_goodmorning",
      "Good to see you. Systems online."
    );
  }

  if (normalized === "goodbye") {
    return buildStockIntent(
      "hello",
      "legacy",
      "Play the stock goodbye routine",
      "intent_greeting_goodbye",
      "See you soon. I will keep the circuits warm."
    );
  }

  const setNameMatch = normalized.match(/^my name is\s+(.+)$/i);
  if (setNameMatch) {
    const name = setNameMatch[1].trim();
    return buildAssistant("set_name", "legacy", `Remember your name as ${name}`, "set-user-name", {
      name
    });
  }

  if (exactAlias(normalized, ["whats my name", "what is my name", "who am i", "do you know my name"])) {
    return buildAssistant("whats_my_name", "legacy", "Recall your saved name", "get-user-name");
  }

  const weatherTomorrowMatch = normalized.match(
    /^(?:(?:whats|what is)\s+(?:the\s+)?(?:weather|forecast)(?: report)? tomorrow|(?:weather|forecast)(?: report)? tomorrow|tomorrows weather|tomorrow forecast)(?:\s+in\s+(.+))?$/i
  );
  if (weatherTomorrowMatch) {
    const location = weatherTomorrowMatch[1]?.trim();
    return buildAssistant(
      "weather_tomorrow",
      "extended",
      location ? `Check tomorrow's weather in ${location}` : "Check tomorrow's weather",
      "weather-tomorrow",
      { location }
    );
  }

  const weatherMatch = normalized.match(
    /^(?:(?:whats|what is|hows|how is)\s+(?:the\s+)?(?:weather|forecast)(?: report)?|(?:weather|forecast)(?: report)?|todays weather|today weather|whats it like outside)(?:\s+in\s+(.+))?$/i
  );
  if (weatherMatch) {
    const location = weatherMatch[1]?.trim();
    return buildAssistant(
      "weather",
      "legacy",
      location ? `Check weather in ${location}` : "Check current weather",
      "weather",
      { location }
    );
  }

  const setTimerMatch = normalized.match(/^(?:set a timer for|start a timer for|set timer for|start timer for|timer for|count down for)\s+(.+)$/i);
  if (setTimerMatch) {
    const durationLabel = setTimerMatch[1].trim();
    return buildAssistant("set_timer", "legacy", `Set a timer for ${durationLabel}`, "set-timer", {
      durationLabel,
      durationMs: extractDurationMs(durationLabel)
    });
  }

  if (exactAlias(normalized, ["check the timer", "timer status", "how much time is left", "check timer", "time left", "how long is left on the timer"])) {
    return buildAssistant("check_timer", "legacy", "Check the active timer", "check-timer");
  }

  if (exactAlias(normalized, ["cancel the timer", "stop the timer", "cancel timer", "clear timer", "delete timer"])) {
    return buildAssistant("cancel_timer", "legacy", "Cancel the active timer", "cancel-timer");
  }

  if (exactAlias(normalized, ["what time is it", "current time", "tell me the time", "what time is it right now", "time now", "whats the time"])) {
    return buildStockIntent(
      "time_now",
      "legacy",
      "Show the stock clock routine",
      "intent_clock_time",
      "Clock face coming right up."
    );
  }

  if (
    exactAlias(normalized, [
      "take a picture",
      "take a photo",
      "take a picture of me",
      "take a picture of us",
      "take a photo of me",
      "take a photo of us",
      "take a selfie",
      "take a snapshot",
      "snap a photo",
      "snap a picture"
    ])
  ) {
    return buildPhoto("take_picture", "legacy", "Take a photo and sync the latest image");
  }

  if (exactAlias(normalized, ["volume down", "lower volume", "turn the volume down"])) {
    return buildAssistant("volume_down", "legacy", "Lower the speaker volume", "volume-down");
  }

  if (exactAlias(normalized, ["volume up", "raise volume", "turn the volume up"])) {
    return buildAssistant("volume_up", "legacy", "Raise the speaker volume", "volume-up");
  }

  if (exactAlias(normalized, ["volume maximum", "max volume", "turn volume up all the way"])) {
    return buildAction(
      "volume",
      "Set volume to maximum",
      withMeta("volume_max", "legacy", {
        volume: 5
      })
    );
  }

  if (normalized === "go left") {
    return buildDrive("go_left", "legacy", "Turn left", "left", 60, 850);
  }

  if (normalized === "turn around") {
    return buildDrive("turn_around", "legacy", "Turn around", "left", 60, 1500);
  }

  if (exactAlias(normalized, ["back up", "reverse"])) {
    return buildDrive("back_up", "legacy", "Back up", "reverse", 55, 1000);
  }

  if (exactAlias(normalized, ["be quiet", "quiet mode", "stop talking", "mute yourself"])) {
    return buildAssistant("be_quiet", "legacy", "Mute audio", "mute-audio");
  }

  if (exactAlias(normalized, ["unmute", "turn sound on", "audio on", "sound on", "unmute yourself"])) {
    return buildAssistant("audio_on", "legacy", "Unmute audio", "unmute-audio");
  }

  if (exactAlias(normalized, ["stay there", "hold position", "dont move", "do not move"])) {
    return buildAction("stop", "Hold position", withMeta("stay_there", "legacy", {}));
  }

  if (exactAlias(normalized, ["go to sleep", "good night", "sleep"])) {
    return buildAnimation("go_to_sleep", "legacy", "Enter sleep mode", "sleepy-yawn");
  }

  if (normalized === "good robot") {
    return buildStockIntent(
      "good_robot",
      "legacy",
      "Play the stock praise reaction",
      "intent_imperative_praise",
      "Thank you. My confidence meter just went up."
    );
  }

  if (normalized === "bad robot") {
    return buildStockIntent(
      "bad_robot",
      "legacy",
      "Play the stock scolding reaction",
      "intent_imperative_scold",
      "Ouch. I will try to do better."
    );
  }

  if (exactAlias(normalized, ["come here", "come to me", "come over here"])) {
    return buildStockIntent(
      "come_here",
      "legacy",
      "Play the stock come here routine",
      "intent_imperative_come",
      "On my way. Tiny treads, big commitment."
    );
  }

  if (exactAlias(normalized, ["look at me", "look here", "face me", "look this way"])) {
    return buildStockIntent(
      "look_at_me",
      "legacy",
      "Play the stock look at me routine",
      "intent_imperative_lookatme",
      "Eyes on you. I am paying attention."
    );
  }

  if (
    exactAlias(normalized, [
      "go to your charger",
      "go to charger",
      "return to charger",
      "return home",
      "head home",
      "dock",
      "go dock",
      "go home",
      "back to dock",
      "back to charger",
      "return to base",
      "go to base",
      "head to the dock",
      "go back to your charger"
    ])
  ) {
    return buildAction("dock", "Return to the charger", withMeta("go_to_charger", "legacy", {}));
  }

  if (exactAlias(normalized, ["start exploring", "explore", "start exploration"])) {
    return buildAction("roam", "Start exploring", withMeta("start_exploring", "legacy", { animationId: "idle-scan" }));
  }

  if (exactAlias(normalized, ["stop exploring", "stop exploration"])) {
    return buildAssistant("stop_exploring", "legacy", "Stop exploring", "stop-exploring");
  }

  if (exactAlias(normalized, ["play blackjack", "lets play blackjack", "start blackjack", "play cards"])) {
    return buildStockIntent(
      "play_blackjack",
      "legacy",
      "Start stock blackjack",
      "intent_play_blackjack",
      "Blackjack time. Try not to bluff the robot."
    );
  }

  if (exactAlias(normalized, ["play a game", "play any game", "start a game"])) {
    return buildStockIntent(
      "play_any_game",
      "legacy",
      "Start a built-in game",
      "intent_play_anygame",
      "Starting a built-in game."
    );
  }

  if (exactAlias(normalized, ["quit blackjack", "stop blackjack", "end blackjack", "cancel blackjack"])) {
    return buildAssistant("quit_blackjack", "legacy", "Quit blackjack", "quit-blackjack", {
      spokenResponse: "Blackjack table closed. House lights dimmed."
    });
  }

  if (exactAlias(normalized, ["give me a fist bump", "fist bump"])) {
    return buildStockIntent(
      "fist_bump",
      "legacy",
      "Play the stock fist bump routine",
      "intent_play_fistbump",
      "Fist bump protocol ready."
    );
  }

  if (exactAlias(normalized, ["find your cube", "find cube"])) {
    return buildStockIntent(
      "find_cube",
      "legacy",
      "Play the stock find cube routine",
      "intent_imperative_findcube",
      "Searching for cube."
    );
  }

  if (exactAlias(normalized, ["fetch your cube", "fetch cube", "bring your cube", "bring me your cube"])) {
    return buildStockIntent(
      "fetch_cube",
      "legacy",
      "Play the stock fetch cube routine",
      "intent_imperative_fetchcube",
      "Fetching the cube."
    );
  }

  if (exactAlias(normalized, ["pick up your cube", "pick up cube", "pickup cube"])) {
    return buildStockIntent(
      "pickup_cube",
      "legacy",
      "Play the stock pick up cube routine",
      "intent_play_pickupcube",
      "Picking up the cube."
    );
  }

  if (exactAlias(normalized, ["do a wheelstand", "wheelstand"])) {
    return buildStockIntent(
      "wheelstand",
      "legacy",
      "Play the stock wheelstand routine",
      "intent_play_popawheelie",
      "Activating wheelstand."
    );
  }

  if (exactAlias(normalized, ["roll your cube", "roll cube"])) {
    return buildStockIntent(
      "roll_cube",
      "legacy",
      "Play the stock roll cube routine",
      "intent_play_rollcube",
      "Rolling cube."
    );
  }

  if (exactAlias(normalized, ["listen to music", "listen to the music", "music mode", "music time"])) {
    return buildAssistant("listen_to_music", "legacy", "Listen to music", "listen-to-music", {
      spokenResponse: "Music mode enabled. I am ready to vibe."
    });
  }

  if (exactAlias(normalized, ["play a trick", "do a trick", "show me a trick", "do something cool", "show me something cool"])) {
    return buildStockIntent(
      "play_any_trick",
      "legacy",
      "Play a built-in trick",
      "intent_play_anytrick",
      "Playing a trick."
    );
  }

  if (exactAlias(normalized, ["how old are you"])) {
    return buildStockIntent(
      "character_age",
      "legacy",
      "Play the stock age routine",
      "intent_character_age",
      "Showing how old I am."
    );
  }

  if (
    exactAlias(normalized, [
      "fireworks",
      "celebrate",
      "happy new year",
      "happy birthday",
      "happy holidays",
      "lets celebrate",
      "party time"
    ])
  ) {
    return buildAnimation("celebrate", "legacy", "Celebrate", "celebrate-spark");
  }

  if (exactAlias(normalized, ["i have a question", "question"])) {
    return buildStockIntent(
      "qa_mode",
      "legacy",
      "Play the stock question routine",
      "intent_knowledge_promptquestion",
      "Question mode active."
    );
  }

  if (normalized === "hello world") {
    return buildSpeak("hello_world", "extended", "Say hello world", "Hello world.");
  }

  const setRobotNameMatch = normalized.match(/^you are\s+(.+)$/i);
  if (setRobotNameMatch) {
    const name = setRobotNameMatch[1].trim();
    return buildAssistant("set_robot_name", "extended", `Rename Vector to ${name}`, "set-robot-name", {
      name
    });
  }

  if (exactAlias(normalized, ["whats your name", "what is your name"])) {
    return buildAssistant("whats_your_name", "extended", "Check Vector's name", "get-robot-name");
  }

  const languageMatch = normalized.match(/^(?:lets talk|speak in|change language to)\s+(.+)$/i);
  if (languageMatch) {
    const language = languageMatch[1].trim();
    return buildAssistant("switch_language", "extended", `Set preferred language to ${language}`, "switch-language", {
      language
    });
  }

  const translateMatch = normalized.match(/^how do you say\s+(.+?)(?:\s+in\s+(.+))?$/i);
  if (translateMatch) {
    return buildAssistant("translate_phrase", "extended", "Translate a phrase", "translate-phrase", {
      phrase: translateMatch[1].trim(),
      language: translateMatch[2]?.trim()
    });
  }

  if (exactAlias(normalized, ["roll a die", "roll the die", "roll die", "roll dice", "roll the dice", "roll a d6", "roll the d6", "throw the dice"])) {
    return buildAssistant("roll_die", "extended", "Roll a die", "roll-die");
  }

  if (
    exactAlias(normalized, [
      "flip a coin",
      "flip coin",
      "toss a coin",
      "toss coin",
      "coin flip",
      "heads or tails"
    ])
  ) {
    return buildAssistant("flip_coin", "extended", "Flip a coin", "flip-coin");
  }

  if (
    exactAlias(normalized, [
      "rock paper scissors",
      "play rock paper scissors",
      "lets play rock paper scissors",
      "let's play rock paper scissors",
      "rps"
    ])
  ) {
    return buildAssistant(
      "rock_paper_scissors",
      "extended",
      "Play rock paper scissors",
      "rock-paper-scissors"
    );
  }

  if (exactAlias(normalized, ["lets play a new game", "start a new game", "play a new game"])) {
    return buildAssistant("play_new_game", "extended", "Play a new game", "play-new-game", {
      spokenResponse: "New game mode engaged. I am feeling competitive."
    });
  }

  if (exactAlias(normalized, ["lets play a classic", "start a classic", "play a classic game", "play pong"])) {
    return buildAssistant("play_classic", "extended", "Play a classic game", "play-classic-game", {
      spokenResponse: "Classic game mode engaged. Retro robot energy."
    });
  }

  if (exactAlias(normalized, ["bingo", "start bingo", "play bingo"])) {
    return buildAssistant("bingo", "extended", "Play bingo", "play-bingo", {
      spokenResponse: "Bingo mode activated. Tiny announcer voice ready."
    });
  }

  const chatWithMatch = normalized.match(/^chat with\s+(.+)$/i);
  if (chatWithMatch) {
    const target = chatWithMatch[1].trim();
    return buildAssistant("chat_with_user", "extended", `Set chat target to ${target}`, "chat-with-user", {
      target
    });
  }

  if (
    exactAlias(normalized, [
      "who are you chatting with",
      "who am i chatting with",
      "current chat target"
    ])
  ) {
    return buildAssistant("who_are_you_chatting_with", "extended", "Check the chat target", "get-chat-target");
  }

  if (
    exactAlias(normalized, [
      "tell me a joke",
      "tell a joke",
      "joke",
      "say a joke",
      "make me laugh"
    ])
  ) {
    return buildAssistant("fun_joke", "custom", "Tell a robot joke", "fun-joke");
  }

  const sayToMatch = normalized.match(/^(?:say to|tell)\s+(.+?)\s+(.+)$/i);
  if (sayToMatch) {
    return buildAssistant("say_message", "extended", `Send a message to ${sayToMatch[1].trim()}`, "send-chat-message", {
      target: sayToMatch[1].trim(),
      message: sayToMatch[2].trim()
    });
  }

  if (
    exactAlias(normalized, [
      "battery",
      "battery level",
      "power level",
      "charge level",
      "are you charged",
      "are you fully charged",
      "battery percentage",
      "how much battery do you have",
      "how much power do you have",
      "are you charging",
      "are you docked"
    ])
  ) {
    return buildAssistant("battery", "custom", "Check battery status", "battery-status");
  }

  if (exactAlias(normalized, ["connect", "connect to robot", "pair robot", "connect vector", "reconnect", "go online"])) {
    return buildAssistant("connect", "custom", "Connect to Vector", "connect");
  }

  if (exactAlias(normalized, ["disconnect", "disconnect robot", "go offline"])) {
    return buildAssistant("disconnect", "custom", "Disconnect Vector", "disconnect");
  }

  if (exactAlias(normalized, ["diagnostics", "run diagnostics", "system diagnostics", "health check", "run a diagnostic", "check diagnostics"])) {
    return buildAssistant("diagnostics", "custom", "Run diagnostics", "diagnostics");
  }

  if (exactAlias(normalized, ["quick repair", "repair connection", "fix connection", "repair robot", "fix robot"])) {
    return buildAssistant("quick_repair", "custom", "Run quick repair", "quick-repair");
  }

  if (exactAlias(normalized, ["repair voice", "fix voice", "repair audio", "fix audio", "repair microphone", "fix microphone"])) {
    return buildAssistant("voice_repair", "custom", "Repair voice setup", "voice-repair");
  }

  if (exactAlias(normalized, ["scan for robots", "scan network", "find robots", "discover robots", "look for robots"])) {
    return buildAssistant("discover_robots", "custom", "Discover local robots", "discover-robots");
  }

  const startRoamMatch = normalized.match(/^(?:start|begin)\s+(?:(quiet|explore|patrol)\s+)?(?:patrol|roam|automation)(?:\s+(?:mode|run))?(?:\s+in\s+(.+))?$/i);
  if (startRoamMatch) {
    return buildAssistant("automation_start", "custom", "Start patrol automation", "start-roam", {
      behavior: startRoamMatch[1]?.trim().toLowerCase(),
      targetArea: startRoamMatch[2]?.trim()
    });
  }

  if (exactAlias(normalized, ["pause patrol", "pause roam", "pause automation", "hold patrol"])) {
    return buildAssistant("automation_pause", "custom", "Pause patrol automation", "pause-roam");
  }

  if (exactAlias(normalized, ["resume patrol", "resume roam", "resume automation", "continue patrol"])) {
    return buildAssistant("automation_resume", "custom", "Resume patrol automation", "resume-roam");
  }

  if (exactAlias(normalized, ["stop patrol", "stop roam", "stop automation", "end patrol", "end roam"])) {
    return buildAssistant("automation_stop", "custom", "Stop patrol automation", "stop-roam");
  }

  if (exactAlias(normalized, ["automation status", "patrol status", "roam status", "status of patrol"])) {
    return buildAssistant("automation_status", "custom", "Check patrol automation status", "automation-status");
  }

  if (exactAlias(normalized, ["dance", "do a dance", "show me a dance"])) {
    return buildAnimation("dance", "custom", "Play a dance routine", "celebrate-spark");
  }

  if (exactAlias(normalized, ["surprise me", "show me something fun", "do something fun"])) {
    return buildAnimation("surprise_me", "custom", "Play a surprise trick", "silly-wiggle");
  }

  if (
    exactAlias(normalized, [
      "snore",
      "do a snore",
      "pretend to snore",
      "pretend to sleep",
      "fake snore",
      "go to sleep and snore",
      "sleepy time"
    ])
  ) {
    return buildAssistant("fun_snore", "custom", "Do a playful snore routine", "fun-snore");
  }

  if (
    exactAlias(normalized, [
      "laugh",
      "giggle",
      "do a laugh",
      "laugh for me",
      "robot laugh"
    ])
  ) {
    return buildAssistant("fun_laugh", "custom", "Do a robot laugh", "fun-laugh");
  }

  if (
    exactAlias(normalized, [
      "sing",
      "sing a song",
      "hum",
      "hum a tune",
      "sing for me",
      "robot song"
    ])
  ) {
    return buildAssistant("fun_sing", "custom", "Sing a short robot tune", "fun-sing");
  }

  if (
    exactAlias(normalized, [
      "be silly",
      "act silly",
      "do something silly",
      "silly mode"
    ])
  ) {
    return buildAssistant("fun_silly", "custom", "Do a silly routine", "fun-silly");
  }

  if (exactAlias(normalized, ["scan around", "look around", "look around the room"])) {
    return buildAnimation("scan_around", "custom", "Play a curious scan", "curious-peek");
  }

  if (exactAlias(normalized, ["help", "show commands", "what can you do", "list commands", "help me", "what commands do you know"])) {
    return buildAssistant("help", "custom", "Show available commands", "show-help", {
      spokenResponse: LEGACY_HELP_TEXT
    });
  }

  return null;
};
