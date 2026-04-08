import type { RobotStatus } from "../robot/types.js";

export type FaceCueKey =
  | "weather-current"
  | "weather-tomorrow"
  | "dice-roll"
  | "coin-flip"
  | "game-start"
  | "blackjack"
  | "question"
  | "music"
  | "celebrate"
  | "farewell"
  | "snore"
  | "laugh"
  | "sing"
  | "joke"
  | "silly";

export interface FaceCueDefinition {
  animationId: string;
  holdMs: number;
  fallbackAnimationId?: string;
  fallbackHoldMs?: number;
  dockedAnimationId?: string;
  dockedHoldMs?: number;
  vectorxSceneId?: string;
}

const faceCueRegistry: Record<FaceCueKey, FaceCueDefinition> = {
  "weather-current": {
    animationId: "weather-report",
    holdMs: 500,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 325,
    dockedAnimationId: "weather-report",
    dockedHoldMs: 500,
    vectorxSceneId: "weather/current"
  },
  "weather-tomorrow": {
    animationId: "weather-report",
    holdMs: 500,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 325,
    dockedAnimationId: "weather-report",
    dockedHoldMs: 500,
    vectorxSceneId: "weather/tomorrow"
  },
  "dice-roll": {
    animationId: "game-time",
    holdMs: 450,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 250,
    dockedAnimationId: "intent_play_blackjack",
    dockedHoldMs: 250,
    vectorxSceneId: "games/dice"
  },
  "coin-flip": {
    animationId: "game-time",
    holdMs: 450,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 250,
    dockedAnimationId: "intent_play_blackjack",
    dockedHoldMs: 250,
    vectorxSceneId: "games/coin"
  },
  "game-start": {
    animationId: "game-time",
    holdMs: 450,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 250,
    dockedAnimationId: "intent_play_blackjack",
    dockedHoldMs: 250,
    vectorxSceneId: "games/start"
  },
  blackjack: {
    animationId: "intent_play_blackjack",
    holdMs: 425,
    fallbackAnimationId: "game-time",
    fallbackHoldMs: 325,
    dockedAnimationId: "intent_play_blackjack",
    dockedHoldMs: 325,
    vectorxSceneId: "games/blackjack"
  },
  question: {
    animationId: "question-prompt",
    holdMs: 325,
    vectorxSceneId: "assistant/question"
  },
  music: {
    animationId: "celebrate-spark",
    holdMs: 300,
    vectorxSceneId: "music/listen"
  },
  celebrate: {
    animationId: "celebrate-spark",
    holdMs: 350,
    vectorxSceneId: "celebrate/default"
  },
  farewell: {
    animationId: "goodbye-nod",
    holdMs: 250,
    vectorxSceneId: "farewell/default"
  },
  snore: {
    animationId: "sleepy-yawn",
    holdMs: 500,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 250,
    dockedAnimationId: "sleepy-yawn",
    dockedHoldMs: 450,
    vectorxSceneId: "fun/snore"
  },
  laugh: {
    animationId: "silly-wiggle",
    holdMs: 350,
    fallbackAnimationId: "celebrate-spark",
    fallbackHoldMs: 250,
    vectorxSceneId: "fun/laugh"
  },
  sing: {
    animationId: "game-time",
    holdMs: 350,
    fallbackAnimationId: "celebrate-spark",
    fallbackHoldMs: 250,
    vectorxSceneId: "fun/sing"
  },
  joke: {
    animationId: "curious-peek",
    holdMs: 300,
    fallbackAnimationId: "question-prompt",
    fallbackHoldMs: 250,
    vectorxSceneId: "fun/joke"
  },
  silly: {
    animationId: "silly-wiggle",
    holdMs: 400,
    fallbackAnimationId: "celebrate-spark",
    fallbackHoldMs: 250,
    vectorxSceneId: "fun/silly"
  }
};

const isDockedOrCharging = (status: RobotStatus | null | undefined) =>
  Boolean(status?.isDocked || status?.isCharging);

export const resolveFaceCue = (
  key: FaceCueKey,
  status?: RobotStatus | null
) => {
  const definition = faceCueRegistry[key];

  if (isDockedOrCharging(status) && definition.dockedAnimationId) {
    return {
      animationId: definition.dockedAnimationId,
      holdMs: definition.dockedHoldMs ?? definition.holdMs,
      fallbackAnimationId: definition.fallbackAnimationId,
      fallbackHoldMs: definition.fallbackHoldMs,
      vectorxSceneId: definition.vectorxSceneId
    };
  }

  return definition;
};

export const getFaceCueRegistrySnapshot = () => faceCueRegistry;
