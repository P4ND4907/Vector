import type { AnimationItem } from "@/types";

export const animationCategories = [
  { value: "happy", label: "Happy" },
  { value: "curious", label: "Curious" },
  { value: "greeting", label: "Greeting" },
  { value: "idle", label: "Idle" },
  { value: "silly", label: "Silly" },
  { value: "celebration", label: "Celebration" },
  { value: "sleepy", label: "Sleepy" }
] as const;

export const animationCatalog: AnimationItem[] = [
  { id: "happy-hello", name: "Happy Hello", category: "happy", favorite: true, durationMs: 2200 },
  { id: "praise-reaction", name: "Good Robot", category: "happy", favorite: false, durationMs: 1700 },
  { id: "curious-peek", name: "Curious Peek", category: "curious", favorite: true, durationMs: 1800 },
  { id: "question-prompt", name: "Question Prompt", category: "curious", favorite: false, durationMs: 1800 },
  { id: "find-cube", name: "Find Cube", category: "curious", favorite: false, durationMs: 2400 },
  { id: "fetch-cube", name: "Fetch Cube", category: "curious", favorite: false, durationMs: 2600 },
  { id: "pick-up-cube", name: "Pick Up Cube", category: "curious", favorite: false, durationMs: 2500 },
  { id: "greeting-wave", name: "Greeting Wave", category: "greeting", favorite: false, durationMs: 1600 },
  { id: "goodbye-nod", name: "Goodbye Nod", category: "greeting", favorite: false, durationMs: 1600 },
  { id: "idle-scan", name: "Explore Start", category: "idle", favorite: false, durationMs: 3200 },
  { id: "silly-wiggle", name: "Play a Trick", category: "silly", favorite: true, durationMs: 2400 },
  { id: "wheelstand", name: "Wheelstand", category: "silly", favorite: true, durationMs: 2000 },
  { id: "celebrate-spark", name: "Dance Burst", category: "celebration", favorite: false, durationMs: 2800 },
  { id: "fist-bump", name: "Fist Bump", category: "celebration", favorite: true, durationMs: 2200 },
  { id: "roll-cube", name: "Roll Cube", category: "celebration", favorite: false, durationMs: 2500 },
  { id: "game-time", name: "Play a Game", category: "celebration", favorite: false, durationMs: 2500 },
  { id: "sleepy-yawn", name: "Sleepy Yawn", category: "sleepy", favorite: false, durationMs: 2600 }
];
