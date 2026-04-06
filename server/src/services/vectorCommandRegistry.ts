import type { ParsedAiAction } from "../robot/types.js";

type VectorCommandCategory = "legacy" | "extended" | "custom";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ");

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
  "Try hello, what time is it, what's the weather, take a selfie, roll a die, play a trick, fetch your cube, drive forward, go dock, run diagnostics, or my name is followed by your name.";

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
  const normalized = normalize(segment);

  if (!normalized) {
    return null;
  }

  if (exactAlias(normalized, ["hello", "hi", "hey"])) {
    return buildStockIntent(
      "hello",
      "legacy",
      "Play the stock hello greeting",
      "intent_greeting_hello",
      "Hello human. Systems online."
    );
  }

  if (exactAlias(normalized, ["good morning", "good afternoon", "good evening"])) {
    return buildStockIntent(
      "hello",
      "legacy",
      "Play the stock greeting routine",
      "intent_greeting_goodmorning",
      "Hello human. Systems online."
    );
  }

  if (normalized === "goodbye") {
    return buildStockIntent(
      "hello",
      "legacy",
      "Play the stock goodbye routine",
      "intent_greeting_goodbye",
      "Goodbye for now."
    );
  }

  const setNameMatch = normalized.match(/^my name is\s+(.+)$/i);
  if (setNameMatch) {
    const name = setNameMatch[1].trim();
    return buildAssistant("set_name", "legacy", `Remember your name as ${name}`, "set-user-name", {
      name
    });
  }

  if (exactAlias(normalized, ["whats my name", "what is my name", "who am i"])) {
    return buildAssistant("whats_my_name", "legacy", "Recall your saved name", "get-user-name");
  }

  const weatherTomorrowMatch = normalized.match(
    /^(?:(?:whats|what is)\s+the weather(?: report)? tomorrow|weather(?: report)? tomorrow)(?:\s+in\s+(.+))?$/i
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
    /^(?:(?:whats|what is)\s+the weather(?: report)?|weather(?: report)?)(?:\s+in\s+(.+))?$/i
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

  const setTimerMatch = normalized.match(/^(?:set a timer for|start a timer for)\s+(.+)$/i);
  if (setTimerMatch) {
    const durationLabel = setTimerMatch[1].trim();
    return buildAssistant("set_timer", "legacy", `Set a timer for ${durationLabel}`, "set-timer", {
      durationLabel,
      durationMs: extractDurationMs(durationLabel)
    });
  }

  if (exactAlias(normalized, ["check the timer", "timer status", "how much time is left", "check timer"])) {
    return buildAssistant("check_timer", "legacy", "Check the active timer", "check-timer");
  }

  if (exactAlias(normalized, ["cancel the timer", "stop the timer", "cancel timer"])) {
    return buildAssistant("cancel_timer", "legacy", "Cancel the active timer", "cancel-timer");
  }

  if (exactAlias(normalized, ["what time is it", "current time", "tell me the time"])) {
    return buildStockIntent(
      "time_now",
      "legacy",
      "Show the stock clock routine",
      "intent_clock_time",
      "Showing the clock."
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
      "take a snapshot"
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

  if (exactAlias(normalized, ["be quiet", "quiet mode", "stop talking"])) {
    return buildAssistant("be_quiet", "legacy", "Mute audio", "mute-audio");
  }

  if (exactAlias(normalized, ["unmute", "turn sound on", "audio on", "sound on"])) {
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
      "Thank you. Compliment acknowledged."
    );
  }

  if (normalized === "bad robot") {
    return buildStockIntent(
      "bad_robot",
      "legacy",
      "Play the stock scolding reaction",
      "intent_imperative_scold",
      "Disappointment registered."
    );
  }

  if (exactAlias(normalized, ["come here", "come to me"])) {
    return buildStockIntent(
      "come_here",
      "legacy",
      "Play the stock come here routine",
      "intent_imperative_come",
      "Navigating toward you."
    );
  }

  if (exactAlias(normalized, ["look at me", "look here", "face me"])) {
    return buildStockIntent(
      "look_at_me",
      "legacy",
      "Play the stock look at me routine",
      "intent_imperative_lookatme",
      "Looking at you."
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
      "back to charger"
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

  if (exactAlias(normalized, ["play blackjack"])) {
    return buildStockIntent(
      "play_blackjack",
      "legacy",
      "Start stock blackjack",
      "intent_play_blackjack",
      "Starting blackjack."
    );
  }

  if (exactAlias(normalized, ["play a game"])) {
    return buildStockIntent(
      "play_any_game",
      "legacy",
      "Start a built-in game",
      "intent_play_anygame",
      "Starting a built-in game."
    );
  }

  if (exactAlias(normalized, ["quit blackjack", "stop blackjack", "end blackjack"])) {
    return buildPlaceholder("quit_blackjack", "legacy", "Quit blackjack", "Ending blackjack.");
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

  if (exactAlias(normalized, ["listen to music", "listen to the music", "music mode"])) {
    return buildPlaceholder("listen_to_music", "legacy", "Listen to music", "Music listening mode enabled.");
  }

  if (exactAlias(normalized, ["play a trick", "do a trick", "show me a trick"])) {
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
      "happy holidays"
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

  if (exactAlias(normalized, ["roll a die", "roll die", "roll dice"])) {
    return buildAssistant("roll_die", "extended", "Roll a die", "roll-die");
  }

  if (normalized === "lets play a new game") {
    return buildPlaceholder("play_new_game", "extended", "Play a new game", "Starting new game mode.");
  }

  if (normalized === "lets play a classic") {
    return buildPlaceholder("play_classic", "extended", "Play a classic game", "Starting classic game mode.");
  }

  if (exactAlias(normalized, ["bingo", "start bingo", "play bingo"])) {
    return buildPlaceholder("bingo", "extended", "Play bingo", "Bingo mode activated.");
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
      "are you fully charged"
    ])
  ) {
    return buildAssistant("battery", "custom", "Check battery status", "battery-status");
  }

  if (exactAlias(normalized, ["connect", "connect to robot", "pair robot", "connect vector"])) {
    return buildAssistant("connect", "custom", "Connect to Vector", "connect");
  }

  if (exactAlias(normalized, ["disconnect", "disconnect robot"])) {
    return buildAssistant("disconnect", "custom", "Disconnect Vector", "disconnect");
  }

  if (exactAlias(normalized, ["diagnostics", "run diagnostics", "system diagnostics", "health check"])) {
    return buildAssistant("diagnostics", "custom", "Run diagnostics", "diagnostics");
  }

  if (exactAlias(normalized, ["dance", "do a dance", "show me a dance"])) {
    return buildAnimation("dance", "custom", "Play a dance routine", "celebrate-spark");
  }

  if (exactAlias(normalized, ["surprise me", "show me something fun", "do something fun"])) {
    return buildAnimation("surprise_me", "custom", "Play a surprise trick", "silly-wiggle");
  }

  if (exactAlias(normalized, ["scan around", "look around", "look around the room"])) {
    return buildAnimation("scan_around", "custom", "Play a curious scan", "curious-peek");
  }

  if (exactAlias(normalized, ["help", "show commands", "what can you do", "list commands"])) {
    return buildAssistant("help", "custom", "Show available commands", "show-help", {
      spokenResponse: LEGACY_HELP_TEXT
    });
  }

  return null;
};
