import { Capacitor } from "@capacitor/core";
import { BleClient, ScanMode, type ScanResult } from "@capacitor-community/bluetooth-le";
import type {
  BluetoothDiscoveryCandidate,
  BluetoothDiscoveryConfidence,
  BluetoothDiscoveryStatus,
  BluetoothScanSnapshot
} from "@/types";

const VECTOR_NAME_HINTS = ["vector", "anki", "ddl"];
const DEFAULT_SCAN_DURATION_MS = 7_000;

let initializePromise: Promise<void> | null = null;

const delay = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const getPlatform = (): BluetoothDiscoveryStatus["platform"] => {
  if (!Capacitor.isNativePlatform()) {
    return "web";
  }

  const platform = Capacitor.getPlatform();
  if (platform === "android" || platform === "ios") {
    return platform;
  }

  return "unknown";
};

const isAndroidNativeRuntime = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

const getConfidence = (value: string, bonded: boolean): BluetoothDiscoveryConfidence => {
  const normalized = value.trim().toLowerCase();
  if (VECTOR_NAME_HINTS.some((hint) => normalized.includes(hint))) {
    return "likely";
  }

  if (bonded || normalized.includes("vic-") || normalized.includes("robot")) {
    return "possible";
  }

  return "unknown";
};

const buildDeviceNote = ({
  confidence,
  bonded
}: {
  confidence: BluetoothDiscoveryConfidence;
  bonded: boolean;
}) => {
  if (confidence === "likely") {
    return bonded
      ? "Looks like a previously known Vector-class BLE device."
      : "Looks like a likely Vector-class BLE device in range.";
  }

  if (confidence === "possible") {
    return bonded
      ? "This bonded BLE device may be your robot or a previously trusted accessory."
      : "This device might be relevant, but the Bluetooth name is not specific enough yet.";
  }

  return bonded
    ? "Bonded BLE device with no obvious Vector name hint."
    : "No strong Vector hint was visible in the Bluetooth advertisement.";
};

const mapScanResult = (
  result: ScanResult,
  bondedDeviceIds: Set<string>
): BluetoothDiscoveryCandidate | null => {
  const deviceId = result.device.deviceId;
  const name = result.localName || result.device.name || "Unnamed BLE device";
  const bonded = bondedDeviceIds.has(deviceId);
  const confidence = getConfidence(name, bonded);

  if (confidence === "unknown" && !bonded && !name.trim()) {
    return null;
  }

  return {
    id: deviceId,
    deviceId,
    name,
    localName: result.localName,
    rssi: result.rssi,
    bonded,
    confidence,
    note: buildDeviceNote({ confidence, bonded })
  };
};

const sortCandidates = (devices: BluetoothDiscoveryCandidate[]) =>
  [...devices].sort((left, right) => {
    const confidenceOrder: Record<BluetoothDiscoveryConfidence, number> = {
      likely: 0,
      possible: 1,
      unknown: 2
    };

    const confidenceDelta = confidenceOrder[left.confidence] - confidenceOrder[right.confidence];
    if (confidenceDelta !== 0) {
      return confidenceDelta;
    }

    return (right.rssi ?? -999) - (left.rssi ?? -999);
  });

const ensureInitialized = async () => {
  if (!isAndroidNativeRuntime()) {
    throw new Error("Bluetooth discovery is currently available in the Android app only.");
  }

  if (!initializePromise) {
    initializePromise = BleClient.initialize({ androidNeverForLocation: true })
      .then(async () => {
        await BleClient.setDisplayStrings({
          scanning: "Scanning for nearby BLE devices...",
          cancel: "Cancel",
          availableDevices: "Nearby Bluetooth devices",
          noDeviceFound: "No Bluetooth devices found"
        });
      })
      .catch((error) => {
        initializePromise = null;
        throw error;
      });
  }

  await initializePromise;
};

const getLocationEnabled = async () => {
  if (!isAndroidNativeRuntime()) {
    return null;
  }

  try {
    return await BleClient.isLocationEnabled();
  } catch {
    return null;
  }
};

export const bluetoothDiscoveryService = {
  async getStatus(): Promise<BluetoothDiscoveryStatus> {
    const platform = getPlatform();
    if (!isAndroidNativeRuntime()) {
      return {
        supported: false,
        platform,
        bluetoothEnabled: false,
        locationEnabled: null,
        ready: false,
        note: "Bluetooth scanning is wired into the Android app first. Desktop web and emulator shells cannot do the real BLE scan."
      };
    }

    try {
      await ensureInitialized();
      const bluetoothEnabled = await BleClient.isEnabled();
      const locationEnabled = await getLocationEnabled();

      return {
        supported: true,
        platform,
        bluetoothEnabled,
        locationEnabled,
        ready: bluetoothEnabled,
        note: bluetoothEnabled
          ? "Bluetooth is ready. The first scan may prompt Android for Nearby Devices permission."
          : "Bluetooth is turned off on this device right now."
      };
    } catch (error) {
      return {
        supported: false,
        platform,
        bluetoothEnabled: false,
        locationEnabled: null,
        ready: false,
        note:
          error instanceof Error
            ? error.message
            : "Bluetooth is not available in this Android shell."
      };
    }
  },

  async requestEnable() {
    await ensureInitialized();
    await BleClient.requestEnable();
    return this.getStatus();
  },

  async openBluetoothSettings() {
    await ensureInitialized();
    await BleClient.openBluetoothSettings();
  },

  async openLocationSettings() {
    await ensureInitialized();
    await BleClient.openLocationSettings();
  },

  async openAppSettings() {
    await ensureInitialized();
    await BleClient.openAppSettings();
  },

  async scanForPairingModeVectors({
    durationMs = DEFAULT_SCAN_DURATION_MS
  }: {
    durationMs?: number;
  } = {}): Promise<BluetoothScanSnapshot> {
    await ensureInitialized();

    const bluetoothEnabled = await BleClient.isEnabled();
    if (!bluetoothEnabled) {
      throw new Error("Turn Bluetooth on first, then try the scan again.");
    }

    const bondedDevices = await BleClient.getBondedDevices().catch(() => []);
    const bondedDeviceIds = new Set(bondedDevices.map((device) => device.deviceId));
    const devicesById = new Map<string, BluetoothDiscoveryCandidate>();

    await BleClient.requestLEScan(
      {
        allowDuplicates: false,
        scanMode: ScanMode.SCAN_MODE_LOW_LATENCY
      },
      (scanResult) => {
        const nextDevice = mapScanResult(scanResult, bondedDeviceIds);
        if (!nextDevice) {
          return;
        }

        const existing = devicesById.get(nextDevice.deviceId);
        if (!existing || (nextDevice.rssi ?? -999) > (existing.rssi ?? -999)) {
          devicesById.set(nextDevice.deviceId, nextDevice);
        }
      }
    );

    try {
      await delay(durationMs);
    } finally {
      await BleClient.stopLEScan().catch(() => undefined);
    }

    const devices = sortCandidates([...devicesById.values()]);
    const likelyCount = devices.filter((device) => device.confidence !== "unknown").length;

    return {
      devices,
      totalDetected: devices.length,
      likelyCount,
      scannedAt: new Date().toISOString(),
      note: devices.length
        ? likelyCount > 0
          ? "Nearby Bluetooth devices found. If one looks like Vector, keep the robot in pairing mode and continue with the pairing handoff."
          : "Bluetooth devices were found, but none exposed a strong Vector name hint yet."
        : "No nearby Bluetooth devices were detected. Keep Vector in pairing mode, stay close, and try again."
    };
  }
};
