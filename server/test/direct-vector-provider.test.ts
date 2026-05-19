import assert from "node:assert/strict";
import { test } from "node:test";
import { createDirectVectorProvider } from "../src/services/directVectorProvider.js";

test("direct provider maps drive and stop to Vector wheel commands", async () => {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const provider = createDirectVectorProvider({
    credentialReader: async () => ({
      ok: true,
      credentials: {
        name: "Vector-A1B2",
        host: "192.168.1.42",
        serial: "00305a8c",
        token: "secret-guid",
        certPath: "C:/Users/test/.anki_vector/Vector-A1B2.cert"
      }
    }),
    clientFactory: () => ({
      close: () => undefined,
      batteryState: async () => ({
        battery_volts: 4.1,
        is_charging: false,
        is_on_charger_platform: false
      }),
      driveWheels: async (payload) => {
        calls.push({ method: "driveWheels", payload });
      },
      stopAllMotors: async () => {
        calls.push({ method: "stopAllMotors" });
      },
      sayText: async () => undefined,
      setHeadAngle: async () => undefined,
      setLiftHeight: async () => undefined,
      driveOnCharger: async () => undefined,
      driveOffCharger: async () => undefined
    })
  });

  await provider.drive({ direction: "forward", speed: 50, durationMs: 100 });
  await provider.drive({ direction: "stop", speed: 0 });

  assert.deepEqual(calls, [
    {
      method: "driveWheels",
      payload: {
        leftWheelMmps: 95,
        rightWheelMmps: 95,
        durationMs: 100
      }
    },
    { method: "stopAllMotors" }
  ]);
});

test("direct provider returns offline status when SDK credentials are missing", async () => {
  const provider = createDirectVectorProvider({
    credentialReader: async () => ({
      ok: false,
      missingFields: ["name", "host", "token", "certPath"],
      note: "Direct Vector credentials are missing: name, host, token, certPath."
    })
  });

  const status = await provider.getStatus();

  assert.equal(status.connectionSource, "direct");
  assert.equal(status.isConnected, false);
  assert.match(status.currentActivity, /credentials/i);
});

test("direct provider plays animation intents through Vector SDK calls", async () => {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const provider = createDirectVectorProvider({
    credentialReader: async () => ({
      ok: true,
      credentials: {
        name: "Vector-A1B2",
        host: "192.168.1.42",
        serial: "00305a8c",
        token: "secret-guid",
        certPath: "C:/Users/test/.anki_vector/Vector-A1B2.cert"
      }
    }),
    clientFactory: () => ({
      close: () => undefined,
      batteryState: async () => ({}),
      driveWheels: async () => undefined,
      stopAllMotors: async () => undefined,
      sayText: async () => undefined,
      setHeadAngle: async () => undefined,
      setLiftHeight: async () => undefined,
      driveOnCharger: async () => undefined,
      driveOffCharger: async () => undefined,
      playAnimation: async (payload) => {
        calls.push({ method: "playAnimation", payload });
      },
      photosInfo: async () => [],
      photo: async () => ({ contentType: "image/jpeg", buffer: new Uint8Array() }),
      thumbnail: async () => ({ contentType: "image/jpeg", buffer: new Uint8Array() }),
      deletePhoto: async () => undefined
    })
  });

  const log = await provider.animation({ animationId: "intent_greeting_hello" });

  assert.equal(log.status, "success");
  assert.deepEqual(calls, [
    { method: "playAnimation", payload: { animationId: "intent_greeting_hello" } }
  ]);
});

test("direct provider exposes robot photo library through Vector SDK calls", async () => {
  const calls: Array<{ method: string; payload?: unknown }> = [];
  const provider = createDirectVectorProvider({
    credentialReader: async () => ({
      ok: true,
      credentials: {
        name: "Vector-A1B2",
        host: "192.168.1.42",
        serial: "00305a8c",
        token: "secret-guid",
        certPath: "C:/Users/test/.anki_vector/Vector-A1B2.cert"
      }
    }),
    clientFactory: () => ({
      close: () => undefined,
      batteryState: async () => ({}),
      driveWheels: async () => undefined,
      stopAllMotors: async () => undefined,
      sayText: async () => undefined,
      setHeadAngle: async () => undefined,
      setLiftHeight: async () => undefined,
      driveOnCharger: async () => undefined,
      driveOffCharger: async () => undefined,
      photosInfo: async () => {
        calls.push({ method: "photosInfo" });
        return [
          { photoId: "7", createdAt: "2026-05-18T12:00:00.000Z" },
          { photoId: "2", createdAt: "2026-05-17T12:00:00.000Z" }
        ];
      },
      photo: async (payload) => {
        calls.push({ method: "photo", payload });
        return { contentType: "image/jpeg", buffer: new Uint8Array([1, 2, 3]) };
      },
      thumbnail: async (payload) => {
        calls.push({ method: "thumbnail", payload });
        return { contentType: "image/jpeg", buffer: new Uint8Array([4, 5, 6]) };
      },
      deletePhoto: async (payload) => {
        calls.push({ method: "deletePhoto", payload });
      }
    })
  });

  const photos = await provider.getPhotoIds();
  const fullImage = await provider.getPhoto("7", "full");
  const thumbImage = await provider.getPhoto("7", "thumb");
  await provider.deletePhoto("7");

  assert.deepEqual(photos.map((photo) => photo.photoId), ["7", "2"]);
  assert.deepEqual([...fullImage.buffer], [1, 2, 3]);
  assert.deepEqual([...thumbImage.buffer], [4, 5, 6]);
  assert.deepEqual(calls, [
    { method: "photosInfo" },
    { method: "photo", payload: { photoId: "7" } },
    { method: "thumbnail", payload: { photoId: "7" } },
    { method: "deletePhoto", payload: { photoId: "7" } }
  ]);
});
