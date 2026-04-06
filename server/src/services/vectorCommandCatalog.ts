import type { VectorCommandCatalogItemRecord } from "../robot/types.js";

const commandCatalog: VectorCommandCatalogItemRecord[] = [
  {
    key: "hello",
    title: "Greeting routines",
    category: "classic",
    status: "live",
    summary: "Classic hello, goodbye, and greeting routines with stock robot personality.",
    aliases: ["hello", "hi", "hey", "good morning", "goodbye"],
    samplePrompt: "hello",
    surfaces: ["face", "voice"]
  },
  {
    key: "weather",
    title: "Current weather",
    category: "classic",
    status: "live",
    summary: "Checks the current weather and gives a quick on-robot cue before speaking the result.",
    aliases: ["what's the weather", "weather", "what is the weather"],
    samplePrompt: "what's the weather",
    surfaces: ["face", "voice"],
    note: "Wake-word weather still needs a configured provider key inside the app settings."
  },
  {
    key: "weather_tomorrow",
    title: "Tomorrow forecast",
    category: "community",
    status: "live",
    summary: "Checks tomorrow's forecast, with optional location support through the shared assistant flow.",
    aliases: ["what's the weather tomorrow", "weather tomorrow", "what is the weather tomorrow in Seattle"],
    samplePrompt: "what's the weather tomorrow",
    surfaces: ["face", "voice"]
  },
  {
    key: "time_now",
    title: "Clock routine",
    category: "classic",
    status: "live",
    summary: "Runs the stock time routine so Vector can answer like the classic app experience.",
    aliases: ["what time is it", "current time", "tell me the time"],
    samplePrompt: "what time is it",
    surfaces: ["face", "voice"]
  },
  {
    key: "take_picture",
    title: "Photo capture",
    category: "classic",
    status: "live",
    summary: "Takes a photo and syncs the latest saved image back into the local gallery.",
    aliases: ["take a photo", "take a picture", "take a selfie", "take a snapshot"],
    samplePrompt: "take a selfie",
    surfaces: ["camera", "app"]
  },
  {
    key: "battery_status",
    title: "Battery and status checks",
    category: "control",
    status: "live",
    summary: "Reads battery, dock, and charging status through the local backend.",
    aliases: ["battery", "battery status", "check battery", "status"],
    samplePrompt: "check battery",
    surfaces: ["voice", "app"]
  },
  {
    key: "dock",
    title: "Dock and return home",
    category: "control",
    status: "live",
    summary: "Sends Vector back to the charger with the same plain-English command path as voice and typed input.",
    aliases: ["go dock", "go home", "return home", "return to charger"],
    samplePrompt: "go dock",
    surfaces: ["motion", "voice"]
  },
  {
    key: "drive",
    title: "Drive and turn controls",
    category: "control",
    status: "live",
    summary: "Moves Vector forward, backward, left, or right with optional durations.",
    aliases: ["drive forward", "drive backward", "turn left", "turn right", "stop"],
    samplePrompt: "drive forward for 2 seconds",
    surfaces: ["motion"]
  },
  {
    key: "speak",
    title: "Typed speech",
    category: "control",
    status: "live",
    summary: "Lets typed commands speak through Vector with the same backend flow used by AI and manual speech.",
    aliases: ["say hello", "speak hello", "say good morning"],
    samplePrompt: "say hello",
    surfaces: ["voice"]
  },
  {
    key: "volume",
    title: "Volume and mute",
    category: "classic",
    status: "live",
    summary: "Adjusts speaker volume, mute, unmute, or max volume from the same shared command system.",
    aliases: ["volume down", "volume up", "max volume", "be quiet", "unmute"],
    samplePrompt: "volume up",
    surfaces: ["voice", "app"]
  },
  {
    key: "set_name",
    title: "User name memory",
    category: "classic",
    status: "live",
    summary: "Stores and recalls the local user name so Vector can personalize replies.",
    aliases: ["my name is Joseph", "what's my name", "who am i"],
    samplePrompt: "my name is Joseph",
    surfaces: ["voice", "memory"]
  },
  {
    key: "robot_name",
    title: "Robot identity",
    category: "community",
    status: "live",
    summary: "Changes or recalls Vector's local display name without leaving the app.",
    aliases: ["you are Scout", "what's your name", "what is your name"],
    samplePrompt: "what's your name",
    surfaces: ["voice", "memory"]
  },
  {
    key: "timers",
    title: "Timers",
    category: "classic",
    status: "live",
    summary: "Starts, checks, and cancels local timers through the shared assistant flow.",
    aliases: ["set a timer for 5 minutes", "check timer", "cancel timer"],
    samplePrompt: "set a timer for 5 minutes",
    surfaces: ["voice", "memory"]
  },
  {
    key: "roll_die",
    title: "Roll a die",
    category: "community",
    status: "live",
    summary: "Rolls a virtual die, triggers a quick game-like cue on the robot, and speaks the result.",
    aliases: ["roll a die", "roll die", "roll dice"],
    samplePrompt: "roll a die",
    surfaces: ["face", "voice"]
  },
  {
    key: "diagnostics",
    title: "Diagnostics and repair",
    category: "control",
    status: "live",
    summary: "Runs diagnostics and speaks the local summary, with repair flows available elsewhere in the app.",
    aliases: ["run diagnostics", "health check", "system diagnostics"],
    samplePrompt: "run diagnostics",
    surfaces: ["voice", "app"]
  },
  {
    key: "tricks",
    title: "Tricks and surprises",
    category: "community",
    status: "live",
    summary: "Runs playful routines like tricks, surprises, age responses, and celebratory reactions.",
    aliases: ["play a trick", "surprise me", "how old are you", "happy birthday"],
    samplePrompt: "surprise me",
    surfaces: ["face", "voice"]
  },
  {
    key: "exploration",
    title: "Roam and scan",
    category: "community",
    status: "live",
    summary: "Starts lightweight roaming or scan-style exploration commands from the same assistant page.",
    aliases: ["scan around", "explore", "start exploring", "stop exploring"],
    samplePrompt: "scan around",
    surfaces: ["motion", "voice"]
  },
  {
    key: "cube_fetch",
    title: "Fetch and pick up cube",
    category: "classic",
    status: "partial",
    summary: "Recognized and routed, but these commands still depend on a working cube nearby and need more real-world tuning.",
    aliases: ["fetch your cube", "pick up your cube", "find your cube"],
    samplePrompt: "fetch your cube",
    surfaces: ["motion", "voice"],
    note: "Best on floor, off charger, with the cube already paired and visible."
  },
  {
    key: "cube_tricks",
    title: "Roll cube and wheelstand",
    category: "classic",
    status: "partial",
    summary: "The app recognizes these classic toy commands, but they still need more stock-intent coverage and real testing.",
    aliases: ["roll your cube", "do a wheelstand"],
    samplePrompt: "roll your cube",
    surfaces: ["face", "motion"]
  },
  {
    key: "fist_bump",
    title: "Fist bump",
    category: "classic",
    status: "partial",
    summary: "The command is recognized and routed, but still needs deeper robot-side validation for a truly polished result.",
    aliases: ["fist bump", "give me a fist bump"],
    samplePrompt: "fist bump",
    surfaces: ["face", "motion"]
  },
  {
    key: "games",
    title: "Blackjack, bingo, and classic games",
    category: "community",
    status: "live",
    summary: "Game-style commands now trigger real robot cues and spoken flows, with room to keep expanding the deeper game logic later.",
    aliases: ["play blackjack", "quit blackjack", "bingo", "let's play a classic"],
    samplePrompt: "play blackjack",
    surfaces: ["face", "voice"],
    note: "Classic and community game prompts now route through live robot responses instead of placeholder-only replies."
  },
  {
    key: "language_tools",
    title: "Language and translation",
    category: "community",
    status: "partial",
    summary: "The app can remember a preferred language, but true translation and multi-language replies are still a future layer.",
    aliases: ["let's talk Spanish", "change language to French", "how do you say hello in Italian"],
    samplePrompt: "change language to French",
    surfaces: ["voice", "memory"]
  },
  {
    key: "chat_tools",
    title: "Chat target and relayed messages",
    category: "assistant",
    status: "partial",
    summary: "These commands are recognized and logged, but richer chat-style experiences still need more real integration work.",
    aliases: ["chat with Sarah", "who are you chatting with", "say hello to Sarah"],
    samplePrompt: "chat with Sarah",
    surfaces: ["app", "memory"]
  }
];

export const getVectorCommandCatalog = () => commandCatalog;
