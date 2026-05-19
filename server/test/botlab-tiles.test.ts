import assert from "node:assert/strict";
import test from "node:test";
import { createMockRobotController } from "../src/robot/mockRobotController.js";
import {
  getBotLabManifest,
  importBotLabPayload,
  recordBotLabRun,
  resolveBotLabMarker
} from "../src/services/botlabTileService.js";

const samplePayload = {
  app: "BotLab Tiles",
  version: 1,
  robot: {
    name: "Scout",
    model: "Vector"
  },
  layout: [
    {
      slot: 0,
      tile: {
        id: "M01_DOCK",
        name: "Dock",
        short: "DOCK",
        markerId: 1,
        category: "starter",
        lesson: "home base",
        pack: "Starter"
      }
    },
    {
      slot: 1,
      tile: {
        id: "M02_STRAIGHT",
        name: "Straight Path",
        short: "PATH",
        markerId: 2,
        category: "starter",
        lesson: "first landmark",
        pack: "Starter"
      }
    }
  ],
  mission: {
    id: "leave-find-home",
    title: "Leave Home, Find Home",
    pack: "Starter",
    difficulty: 1,
    required: ["M01_DOCK", "M02_STRAIGHT"],
    goal: "Leave the dock tile, identify marker 2, and return to marker 1.",
    success: "Three successful returns without manual repositioning."
  },
  integration: {
    handoffUrl: "manual",
    eventName: "botlab.layout.updated"
  },
  runs: []
};

test("BotLab manifest exposes starter, expansion, mission, and marker lookup data", () => {
  const manifest = getBotLabManifest();
  assert.ok(manifest.starter.some((module) => module.markerId === 1));
  assert.ok(manifest.expansions.some((module) => module.markerId === 41));
  assert.ok(manifest.missions.some((mission) => mission.id === "leave-find-home"));
  assert.equal(manifest.markerMap[1]?.behavior, "set_home_base");
});

test("BotLab payload import creates an app-only local learning session", async () => {
  const controller = createMockRobotController();
  const result = await importBotLabPayload(controller, samplePayload);

  assert.equal(result.mission.id, "leave-find-home");
  assert.equal(result.missingRequired.length, 0);
  assert.match(result.message, /Manual marker learning is ready/i);

  const routines = await controller.getRoutines();
  const session = routines.find((routine) => routine.id === result.session.id);
  assert.ok(session);
  assert.ok(session.conditions.includes("botlab-tiles-session"));
  assert.ok(session.conditions.includes("botlab-local-app-only"));
  assert.equal(session.actions.length, 2);
});

test("BotLab marker assignment and run history record cleanly", async () => {
  const controller = createMockRobotController();
  const imported = await importBotLabPayload(controller, samplePayload);

  const marker = resolveBotLabMarker(2);
  assert.equal(marker.known, true);
  assert.equal(marker.mapping?.behavior, "drive_forward_and_confirm_landmark");
  assert.match(marker.suggestedAction ?? "", /Drive forward/i);

  const run = await recordBotLabRun(controller, {
    missionId: "leave-find-home",
    result: "success",
    sessionId: imported.session.id
  });
  assert.equal(run.run.result, "success");
  assert.match(run.message, /Recorded success/i);

  const memories = await controller.getAiMemory();
  assert.ok(memories.some((memory) => memory.key === "botlab.run.leave-find-home"));
});
