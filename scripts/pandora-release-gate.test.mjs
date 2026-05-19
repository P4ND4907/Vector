import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  createExecutionPlan,
  getFirstOpenMarkerPath,
  markFirstOpenComplete,
  sanitizeNpmEnv
} from "./pandora-release-gate.mjs";

test("first-open plan pulls when an upstream exists, bootstraps tests, then verifies", () => {
  const plan = createExecutionPlan({ firstOpen: true, hasUpstream: true });

  assert.deepEqual(
    plan.map((step) => [step.command, step.args]),
    [
      ["git", ["pull", "--ff-only"]],
      [process.platform === "win32" ? "npm.cmd" : "npm", ["test"]],
      [process.platform === "win32" ? "npm.cmd" : "npm", ["run", "verify:ci"]]
    ]
  );
});

test("first-open plan skips pull cleanly when there is no upstream", () => {
  const plan = createExecutionPlan({ firstOpen: true, hasUpstream: false });

  assert.deepEqual(
    plan.map((step) => step.args),
    [["test"], ["run", "verify:ci"]]
  );
});

test("first-open plan skips pull cleanly when local changes are present", () => {
  const plan = createExecutionPlan({
    firstOpen: true,
    hasUpstream: true,
    worktreeClean: false
  });

  assert.deepEqual(
    plan.map((step) => step.args),
    [["test"], ["run", "verify:ci"]]
  );
});

test("repeat-open plan only runs the release readiness gate", () => {
  const plan = createExecutionPlan({ firstOpen: false, hasUpstream: true });

  assert.deepEqual(
    plan.map((step) => step.args),
    [["run", "verify:ci"]]
  );
});

test("first-open marker is written under .git after bootstrap succeeds", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "vector-pandora-"));
  try {
    await mkdir(path.join(tempRoot, ".git"));
    await markFirstOpenComplete(tempRoot);

    const markerPath = getFirstOpenMarkerPath(tempRoot);
    assert.equal(existsSync(markerPath), true);
    assert.match(await readFile(markerPath, "utf8"), /^completedAt=/);
  } finally {
    await rm(tempRoot, { force: true, recursive: true });
  }
});

test("npm proxy env warnings are suppressed for child release commands", () => {
  const sanitized = sanitizeNpmEnv({
    PATH: "keep",
    npm_config_http_proxy: "http://proxy.local",
    npm_config_https_proxy: "http://proxy.local",
    npm_config_http_proxy_extra: "keep"
  });

  assert.equal(sanitized.PATH, "keep");
  assert.equal("npm_config_http_proxy" in sanitized, false);
  assert.equal("npm_config_https_proxy" in sanitized, false);
  assert.equal(sanitized.npm_config_http_proxy_extra, "keep");
});
