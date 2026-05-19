import { z } from "zod";
import type { RobotController, RoutineRecord } from "../robot/types.js";

export type BotLabRunResult = "success" | "partial" | "failed";

export interface BotLabMarkerModule {
  id: string;
  title: string;
  markerId: number;
  pack: string;
  trainingValue: string;
  centerXyMm?: [number, number];
}

export interface BotLabMission {
  id: string;
  title: string;
  pack: string;
  difficulty: number;
  required: string[];
  learns: string[];
  goal: string;
  success: string;
  pro?: boolean;
}

export interface BotLabMarkerBehavior {
  tile: string;
  behavior: string;
}

export interface BotLabRunRecord {
  missionId: string;
  result: BotLabRunResult;
  timestamp: string;
  sessionId?: string;
  note?: string;
}

const BOTLAB_SESSION_MARKER = "botlab-tiles-session";
const BOTLAB_APP_ONLY_MARKER = "botlab-local-app-only";

const starterModules: BotLabMarkerModule[] = [
  { id: "M01_DOCK", title: "DOCK", markerId: 1, pack: "Starter", trainingValue: "practice homing and start/end routines", centerXyMm: [-130, 130] },
  { id: "M02_STRAIGHT", title: "PATH", markerId: 2, pack: "Starter", trainingValue: "learn line following, odometry drift, and landmark recognition", centerXyMm: [0, 130] },
  { id: "M03_RAMP", title: "RAMP", markerId: 3, pack: "Starter", trainingValue: "learn slope confidence and recovery", centerXyMm: [130, 130] },
  { id: "M04_LEFT", title: "LEFT", markerId: 4, pack: "Starter", trainingValue: "learn turn landmarks and route memory", centerXyMm: [-130, 0] },
  { id: "M05_FORK", title: "FORK", markerId: 5, pack: "Starter", trainingValue: "learn decision points and reward-based route choice", centerXyMm: [0, 0] },
  { id: "M06_RIGHT", title: "RIGHT", markerId: 6, pack: "Starter", trainingValue: "learn alternate turn landmarks", centerXyMm: [130, 0] },
  { id: "M07_SLALOM", title: "AVOID", markerId: 7, pack: "Starter", trainingValue: "learn obstacle avoidance and replanning", centerXyMm: [-130, -130] },
  { id: "M08_CUBE", title: "CUBE", markerId: 8, pack: "Starter", trainingValue: "learn cube approach, scan, and interaction positioning", centerXyMm: [0, -130] },
  { id: "M09_BLANK", title: "OPEN", markerId: 9, pack: "Starter", trainingValue: "sandbox tile for new markers or custom obstacles", centerXyMm: [130, -130] }
];

const expansionModules: BotLabMarkerModule[] = [
  { id: "MX01_DEAD_END", title: "DEAD", markerId: 21, pack: "Maze Pack", trainingValue: "route memory, dead-end recovery, gate confidence, and reward navigation" },
  { id: "MX02_U_TURN", title: "UTURN", markerId: 22, pack: "Maze Pack", trainingValue: "route memory, dead-end recovery, gate confidence, and reward navigation" },
  { id: "MX03_GATE", title: "GATE", markerId: 23, pack: "Maze Pack", trainingValue: "route memory, dead-end recovery, gate confidence, and reward navigation" },
  { id: "MX04_REWARD", title: "GOAL", markerId: 24, pack: "Maze Pack", trainingValue: "route memory, dead-end recovery, gate confidence, and reward navigation" },
  { id: "TX01_BUMPS", title: "BUMPS", markerId: 31, pack: "Terrain Pack", trainingValue: "surface adaptation, tread confidence, recovery, and micro-obstacle handling" },
  { id: "TX02_TEXTURE", title: "TEXTURE", markerId: 32, pack: "Terrain Pack", trainingValue: "surface adaptation, tread confidence, recovery, and micro-obstacle handling" },
  { id: "TX03_RECOVER", title: "RECOVER", markerId: 33, pack: "Terrain Pack", trainingValue: "surface adaptation, tread confidence, recovery, and micro-obstacle handling" },
  { id: "TX04_MICRO_RAMP", title: "MICRO", markerId: 34, pack: "Terrain Pack", trainingValue: "surface adaptation, tread confidence, recovery, and micro-obstacle handling" },
  { id: "DX01_FUNNEL", title: "FUNNEL", markerId: 41, pack: "Precision Docking Pack", trainingValue: "alignment, offset approach, reverse approach, and low-contrast docking practice" },
  { id: "DX02_OFFSET", title: "OFFSET", markerId: 42, pack: "Precision Docking Pack", trainingValue: "alignment, offset approach, reverse approach, and low-contrast docking practice" },
  { id: "DX03_REVERSE", title: "REVERSE", markerId: 43, pack: "Precision Docking Pack", trainingValue: "alignment, offset approach, reverse approach, and low-contrast docking practice" },
  { id: "DX04_LOW_LIGHT", title: "SHADOW", markerId: 44, pack: "Precision Docking Pack", trainingValue: "alignment, offset approach, reverse approach, and low-contrast docking practice" }
];

const missions: BotLabMission[] = [
  {
    id: "leave-find-home",
    title: "Leave Home, Find Home",
    pack: "Starter",
    difficulty: 1,
    required: ["M01_DOCK", "M02_STRAIGHT"],
    learns: ["dock_marker", "straight_marker", "return_path"],
    goal: "Leave the dock tile, identify marker 2, and return to marker 1.",
    success: "Three successful returns without manual repositioning."
  },
  {
    id: "fork-reward-memory",
    title: "Choice and Reward",
    pack: "Starter",
    difficulty: 2,
    required: ["M01_DOCK", "M05_FORK", "M08_CUBE"],
    learns: ["fork_decision", "reward_branch", "cube_target"],
    goal: "Use the fork tile to test whether a reward object changes route preference.",
    success: "The robot chooses the reward branch twice after discovery."
  },
  {
    id: "slalom-replan",
    title: "Obstacle Replanning",
    pack: "Starter",
    difficulty: 2,
    required: ["M02_STRAIGHT", "M07_SLALOM"],
    learns: ["obstacle_memory", "route_replanning", "clearance"],
    goal: "Move posts between attempts and record whether the route adapts.",
    success: "The robot reaches the exit while avoiding direct post contact."
  },
  {
    id: "maze-recovery",
    title: "Maze Recovery Loop",
    pack: "Maze Pack",
    difficulty: 3,
    required: ["MX01_DEAD_END", "MX02_U_TURN", "M05_FORK"],
    learns: ["dead_end_recovery", "route_reversal", "alternate_path"],
    goal: "Teach recovery from blocked routes using marker IDs 21 and 22.",
    success: "The robot backs out and selects an alternate route.",
    pro: true
  },
  {
    id: "precision-dock",
    title: "Precision Dock Score",
    pack: "Docking Pack",
    difficulty: 4,
    required: ["M01_DOCK", "DX01_FUNNEL"],
    learns: ["dock_alignment", "offset_correction", "approach_score"],
    goal: "Score alignment from offset starts and funnel corrections.",
    success: "Dock approach completes with one or fewer corrections.",
    pro: true
  }
];

const markerToBehavior: Record<number, BotLabMarkerBehavior> = {
  1: { tile: "M01_DOCK", behavior: "set_home_base" },
  2: { tile: "M02_STRAIGHT", behavior: "drive_forward_and_confirm_landmark" },
  3: { tile: "M03_RAMP", behavior: "slow_climb_and_check_pitch" },
  4: { tile: "M04_LEFT", behavior: "learn_left_turn" },
  5: { tile: "M05_FORK", behavior: "evaluate_branch_choice" },
  6: { tile: "M06_RIGHT", behavior: "learn_right_turn" },
  7: { tile: "M07_SLALOM", behavior: "avoid_obstacle_and_replan" },
  8: { tile: "M08_CUBE", behavior: "approach_cube_target" },
  9: { tile: "M09_BLANK", behavior: "custom_experiment" },
  21: { tile: "MX01_DEAD_END", behavior: "recover_from_dead_end" },
  22: { tile: "MX02_U_TURN", behavior: "reverse_route_memory" },
  23: { tile: "MX03_GATE", behavior: "slow_gate_approach" },
  24: { tile: "MX04_REWARD", behavior: "reward_goal_memory" },
  31: { tile: "TX01_BUMPS", behavior: "terrain_bump_confidence" },
  32: { tile: "TX02_TEXTURE", behavior: "surface_texture_adaptation" },
  33: { tile: "TX03_RECOVER", behavior: "recovery_island_navigation" },
  34: { tile: "TX04_MICRO_RAMP", behavior: "micro_ramp_confidence" },
  41: { tile: "DX01_FUNNEL", behavior: "precision_dock_alignment" },
  42: { tile: "DX02_OFFSET", behavior: "offset_dock_correction" },
  43: { tile: "DX03_REVERSE", behavior: "reverse_alignment_retry" },
  44: { tile: "DX04_LOW_LIGHT", behavior: "low_contrast_dock_search" }
};

const tileSchema = z.object({
  id: z.string(),
  name: z.string(),
  short: z.string(),
  markerId: z.number().int(),
  category: z.string(),
  lesson: z.string(),
  pack: z.string(),
  pro: z.boolean().optional()
});

export const botLabPayloadSchema = z.object({
  app: z.literal("BotLab Tiles"),
  version: z.number().int().min(1),
  robot: z.object({
    name: z.string(),
    model: z.string()
  }),
  layout: z.array(
    z.object({
      slot: z.number().int().min(0).max(8),
      tile: tileSchema
    })
  ),
  mission: z.object({
    id: z.string(),
    title: z.string(),
    pack: z.string(),
    difficulty: z.number().int(),
    required: z.array(z.string()),
    goal: z.string(),
    success: z.string(),
    pro: z.boolean().optional()
  }),
  integration: z.object({
    handoffUrl: z.string(),
    eventName: z.literal("botlab.layout.updated")
  }),
  runs: z.array(
    z.object({
      missionId: z.string(),
      result: z.enum(["success", "partial", "failed"]),
      timestamp: z.string()
    })
  )
});

export type BotLabPayload = z.infer<typeof botLabPayloadSchema>;

const allModules = [...starterModules, ...expansionModules];
const moduleById = new Map(allModules.map((module) => [module.id, module]));
const moduleByMarkerId = new Map(allModules.map((module) => [module.markerId, module]));

const buildSessionRoutine = (payload: BotLabPayload): RoutineRecord => {
  const now = new Date().toISOString();
  const layoutActions = payload.layout.map(({ slot, tile }) => ({
    type: "botlab-marker",
    value: JSON.stringify({
      slot,
      tileId: tile.id,
      markerId: tile.markerId,
      behavior: markerToBehavior[tile.markerId]?.behavior ?? "unknown_marker"
    })
  }));

  return {
    id: `botlab-${payload.mission.id}-${crypto.randomUUID()}`,
    name: `BotLab: ${payload.mission.title}`,
    enabled: true,
    triggerType: "manual",
    triggerValue: "botlab",
    conditions: [
      BOTLAB_SESSION_MARKER,
      BOTLAB_APP_ONLY_MARKER,
      `mission:${payload.mission.id}`,
      "manual marker assignment v1"
    ],
    actions: layoutActions,
    delayMs: 250,
    repeat: "never",
    lastRunAt: now
  };
};

export const getBotLabManifest = () => ({
  starter: starterModules,
  expansions: expansionModules,
  missions,
  markerMap: markerToBehavior,
  markerLookup: Object.fromEntries(allModules.map((module) => [module.markerId, module])),
  note: "BotLab v1 uses manual marker assignment. Camera marker detection can call the same marker endpoint later."
});

export const importBotLabPayload = async (controller: RobotController, payload: unknown) => {
  const parsed = botLabPayloadSchema.parse(payload);
  const missingRequired = parsed.mission.required.filter((tileId) => !parsed.layout.some((entry) => entry.tile.id === tileId));
  const routine = buildSessionRoutine(parsed);
  await controller.saveRoutine(routine);

  const history = parsed.runs.map((run) => ({
    ...run,
    sessionId: routine.id
  }));

  await controller.saveAiMemory({
    key: `botlab.session.${routine.id}`,
    value: JSON.stringify({
      sessionId: routine.id,
      missionId: parsed.mission.id,
      title: parsed.mission.title,
      importedAt: new Date().toISOString(),
      layout: parsed.layout,
      runs: history
    })
  });

  return {
    session: routine,
    mission: parsed.mission,
    missingRequired,
    history,
    message: missingRequired.length
      ? `Imported ${parsed.mission.title}, but missing required tile${missingRequired.length === 1 ? "" : "s"}: ${missingRequired.join(", ")}.`
      : `Imported ${parsed.mission.title}. Manual marker learning is ready.`
  };
};

export const resolveBotLabMarker = (markerId: number) => {
  const module = moduleByMarkerId.get(markerId);
  const mapping = markerToBehavior[markerId];

  if (!module || !mapping) {
    return {
      markerId,
      known: false,
      message: `Marker ${markerId} is not in the BotLab learning map yet.`
    };
  }

  return {
    markerId,
    known: true,
    module,
    mapping,
    suggestedAction: getSuggestedActionForBehavior(mapping.behavior),
    message: `Marker ${markerId} is ${module.title}. Behavior: ${mapping.behavior}.`
  };
};

export const recordBotLabRun = async (
  controller: RobotController,
  run: { missionId: string; result: BotLabRunResult; sessionId?: string; note?: string }
) => {
  const record: BotLabRunRecord = {
    ...run,
    timestamp: new Date().toISOString()
  };

  await controller.saveAiMemory({
    key: `botlab.run.${record.missionId}`,
    value: JSON.stringify(record)
  });

  if (record.sessionId) {
    await controller.updateRoutine(record.sessionId, { lastRunAt: record.timestamp });
  }

  return {
    run: record,
    message: `Recorded ${record.result} for ${record.missionId}.`
  };
};

export const getBotLabSessions = async (controller: RobotController) => {
  const routines = await controller.getRoutines();
  const sessions = routines.filter((routine) => routine.conditions.includes(BOTLAB_SESSION_MARKER));
  const runs = (await controller.getAiMemory()).flatMap((memory) => {
    if (!memory.key.startsWith("botlab.run.")) {
      return [];
    }

    try {
      return [JSON.parse(memory.value) as BotLabRunRecord];
    } catch {
      return [];
    }
  });

  return { sessions, runs };
};

const getSuggestedActionForBehavior = (behavior: string) => {
  switch (behavior) {
    case "set_home_base":
      return "Treat this marker as home base for the current session.";
    case "drive_forward_and_confirm_landmark":
      return "Drive forward slowly, then record whether Vector reached the landmark.";
    case "learn_left_turn":
      return "Run a short left turn and record drift.";
    case "learn_right_turn":
      return "Run a short right turn and record drift.";
    case "avoid_obstacle_and_replan":
      return "Mark this as an obstacle zone and record success, partial, or failed.";
    case "approach_cube_target":
      return "Approach slowly and record whether cube positioning worked.";
    default:
      return "Record what Vector did here, then mark the mission run result.";
  }
};

export const getBotLabModuleById = (id: string) => moduleById.get(id);
