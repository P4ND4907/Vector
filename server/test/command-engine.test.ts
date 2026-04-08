import assert from "node:assert/strict";
import test from "node:test";
import { previewAiCommand, executeAiCommand } from "../src/services/aiCommandService.js";
import { createMockRobotController } from "../src/robot/mockRobotController.js";
import { getVectorCommandCatalog } from "../src/services/vectorCommandCatalog.js";

const getFirstAction = async (prompt: string) => {
  const preview = await previewAiCommand(prompt);
  assert.equal(preview.canExecute, true, `Expected "${prompt}" to preview as executable.`);
  assert.ok(preview.actions.length > 0, `Expected "${prompt}" to produce at least one action.`);
  return preview.actions[0];
};

test("every catalog sample prompt previews as an executable command", async () => {
  for (const item of getVectorCommandCatalog()) {
    const preview = await previewAiCommand(item.samplePrompt);
    assert.equal(
      preview.canExecute,
      true,
      `Expected sample prompt "${item.samplePrompt}" for catalog item "${item.key}" to be executable.`
    );
    assert.ok(
      preview.actions.length > 0,
      `Expected sample prompt "${item.samplePrompt}" for catalog item "${item.key}" to produce actions.`
    );
  }
});

test("notable legacy, community, and automation command variations resolve to the right actions", async () => {
  const dice = await getFirstAction("hey vector can you roll the dice");
  assert.equal(dice.type, "assistant");
  assert.equal(dice.params.kind, "roll-die");

  const weather = await getFirstAction("please what's the weather tomorrow in Seattle");
  assert.equal(weather.type, "assistant");
  assert.equal(weather.params.kind, "weather-tomorrow");
  assert.equal(weather.params.location, "seattle");

  const dock = await getFirstAction("return to base");
  assert.equal(dock.type, "dock");

  const coin = await getFirstAction("flip a coin");
  assert.equal(coin.type, "assistant");
  assert.equal(coin.params.kind, "flip-coin");

  const joke = await getFirstAction("tell me a joke");
  assert.equal(joke.type, "assistant");
  assert.equal(joke.params.kind, "fun-joke");

  const patrol = await getFirstAction("start quiet patrol in office");
  assert.equal(patrol.type, "assistant");
  assert.equal(patrol.params.kind, "start-roam");
  assert.equal(patrol.params.behavior, "quiet");
  assert.equal(patrol.params.targetArea, "office");

  const automationStatus = await getFirstAction("automation status");
  assert.equal(automationStatus.type, "assistant");
  assert.equal(automationStatus.params.kind, "automation-status");

  const scan = await getFirstAction("scan for robots");
  assert.equal(scan.type, "assistant");
  assert.equal(scan.params.kind, "discover-robots");

  const snore = await getFirstAction("pretend to snore");
  assert.equal(snore.type, "assistant");
  assert.equal(snore.params.kind, "fun-snore");

  const sing = await getFirstAction("sing for me");
  assert.equal(sing.type, "assistant");
  assert.equal(sing.params.kind, "fun-sing");
});

test("learned phrases can be taught, listed, used, and forgotten", async () => {
  const controller = createMockRobotController();

  const teachPreview = await previewAiCommand('learn that lucky toss means flip a coin', controller);
  assert.equal(teachPreview.canExecute, true);
  assert.equal(teachPreview.actions[0]?.type, "assistant");
  assert.equal(teachPreview.actions[0]?.params.kind, "teach-command");
  await executeAiCommand(controller, teachPreview);

  const listPreview = await previewAiCommand("list learned commands", controller);
  assert.equal(listPreview.actions[0]?.params.kind, "list-learned-commands");

  const learnedPreview = await previewAiCommand("lucky toss", controller);
  assert.equal(learnedPreview.canExecute, true);
  assert.ok(
    learnedPreview.actions.some(
      (action) => action.type === "assistant" && action.params.kind === "flip-coin"
    )
  );

  const forgetPreview = await previewAiCommand("forget lucky toss", controller);
  assert.equal(forgetPreview.actions[0]?.params.kind, "forget-command");
  await executeAiCommand(controller, forgetPreview);

  const afterForget = await previewAiCommand("lucky toss", controller);
  assert.equal(afterForget.canExecute, false);
});

test("mock execution works for new fun commands and returns a usable response", async () => {
  const controller = createMockRobotController();

  const flipPreview = await previewAiCommand("flip a coin", controller);
  const flipResult = await executeAiCommand(controller, flipPreview);
  assert.match(flipResult.resultMessage, /heads|tails/i);

  const dockPreview = await previewAiCommand("go dock", controller);
  const dockResult = await executeAiCommand(controller, dockPreview);
  assert.ok(dockResult.resultMessage.length > 0);

  const laughPreview = await previewAiCommand("robot laugh", controller);
  const laughResult = await executeAiCommand(controller, laughPreview);
  assert.ok(laughResult.resultMessage.length > 0);
});

test("unsupported prompts surface a teach hint and can be tracked as command gaps", async () => {
  const controller = createMockRobotController();

  const preview = await previewAiCommand("coin toss please maybe", controller);
  assert.equal(preview.canExecute, false);
  assert.match(preview.warnings[0] ?? "", /teach/i);

  await controller.recordCommandGap({
    source: "ai",
    prompt: "coin toss please maybe",
    category: "unsupported",
    note: preview.warnings[0] ?? "Unsupported command."
  });

  const gaps = await controller.getCommandGaps();
  assert.equal(gaps.length > 0, true);
  assert.equal(gaps[0]?.prompt, "coin toss please maybe");
});
