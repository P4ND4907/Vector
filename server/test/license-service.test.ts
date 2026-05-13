import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLicenseService } from "../src/licensing/licenseService.js";

test("activates a pro license with valid key format", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "vector-license-test-"));
  try {
    const service = createLicenseService(path.join(tempDir, "license.json"));
    const activated = service.activate("vec-pro-1a2b3c4d");
    assert.equal(activated.activated, true);
    assert.equal(activated.tier, "pro");
    assert.equal(activated.key, "VEC-PRO-1A2B3C4D");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("rejects invalid license key format", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "vector-license-test-"));
  try {
    const service = createLicenseService(path.join(tempDir, "license.json"));
    assert.throws(() => service.activate("invalid-key"), /invalid/i);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
