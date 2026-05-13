import path from "node:path";
import type { RobotController } from "../robot/types.js";
import { createEmbeddedProvider, createMockProvider, createWirePodProvider } from "./providers.js";
import { type BridgeProviderName, createEngineSettingsStore, createPairingStore } from "./stores.js";

export const createBridgeProviderManager = (controller: RobotController, dataFilePath: string) => {
  const dataDirectory = path.dirname(path.resolve(dataFilePath));
  const engineStore = createEngineSettingsStore(path.join(dataDirectory, "engine-settings.json"));
  const pairingStore = createPairingStore(path.join(dataDirectory, "pairing-data.json"));

  const providers = {
    embedded: createEmbeddedProvider(controller),
    wirepod: createWirePodProvider(controller),
    mock: createMockProvider(controller)
  } as const;

  const getProviderName = (): BridgeProviderName => engineStore.get().provider;
  const setProviderName = (provider: BridgeProviderName) => engineStore.set(provider).provider;
  const getProvider = () => providers[getProviderName()];

  return {
    getProviderName,
    setProviderName,
    getProvider,
    getPairings: pairingStore.list,
    savePairing: pairingStore.upsert,
    clearPairings: pairingStore.clear,
    getEngineSettings: engineStore.get
  };
};
