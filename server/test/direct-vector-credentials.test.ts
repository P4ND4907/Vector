import assert from "node:assert/strict";
import { test } from "node:test";
import { readDirectVectorCredentials } from "../src/services/directVectorCredentials.js";

test("loads direct Vector credentials from environment variables", async () => {
  const credentials = await readDirectVectorCredentials({
    env: {
      VECTOR_DIRECT_NAME: "Vector-A1B2",
      VECTOR_DIRECT_SERIAL: "00305a8c",
      VECTOR_DIRECT_HOST: "192.168.1.42",
      VECTOR_DIRECT_TOKEN: "secret-guid",
      VECTOR_DIRECT_CERT_PATH: "C:/Users/test/.anki_vector/Vector-A1B2.cert"
    },
    homeDir: "C:/Users/test",
    exists: () => false,
    readFile: async () => {
      throw new Error("should not read sdk config when env is complete");
    }
  });

  assert.equal(credentials.ok, true);
  assert.equal(credentials.credentials?.name, "Vector-A1B2");
  assert.equal(credentials.credentials?.serial, "00305a8c");
  assert.equal(credentials.credentials?.host, "192.168.1.42");
  assert.equal(credentials.credentials?.token, "secret-guid");
});

test("loads direct Vector credentials from SDK config", async () => {
  const credentials = await readDirectVectorCredentials({
    env: {},
    homeDir: "C:/Users/test",
    exists: (filePath) => filePath.replace(/\\/g, "/").endsWith(".anki_vector/sdk_config.ini"),
    readFile: async () => `
[00305a8c]
name = Vector-A1B2
ip = 192.168.1.42
guid = secret-guid
cert = C:/Users/test/.anki_vector/Vector-A1B2.cert
`
  });

  assert.equal(credentials.ok, true);
  assert.equal(credentials.credentials?.serial, "00305a8c");
  assert.equal(credentials.credentials?.name, "Vector-A1B2");
  assert.equal(credentials.credentials?.host, "192.168.1.42");
  assert.equal(credentials.credentials?.certPath, "C:/Users/test/.anki_vector/Vector-A1B2.cert");
});

test("reports missing direct Vector credential fields without exposing secrets", async () => {
  const credentials = await readDirectVectorCredentials({
    env: { VECTOR_DIRECT_TOKEN: "secret-guid" },
    homeDir: "C:/Users/test",
    exists: () => false,
    readFile: async () => ""
  });

  assert.equal(credentials.ok, false);
  assert.deepEqual(credentials.missingFields.sort(), ["certPath", "host", "name"].sort());
  assert.match(credentials.note, /missing/i);
  assert.doesNotMatch(credentials.note, /secret-guid/);
});
