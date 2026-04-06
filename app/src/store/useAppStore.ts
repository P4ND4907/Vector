import { create } from "zustand";
import { persist } from "zustand/middleware";

import { createAutomationActions } from "./app-store-automation-actions";
import { createRobotActions } from "./app-store-robot-actions";
import { createSystemActions } from "./app-store-system-actions";
import type { AppState, PersistedSlice } from "./app-store-types";
import { actionDefaults, baseSnapshot, mergePersistedState, partializeState } from "./app-store-utils";

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...baseSnapshot,
      initialized: false,
      telemetryActive: false,
      actionStates: actionDefaults(),
      toasts: [],
      ...createRobotActions(set, get),
      ...createAutomationActions(set, get),
      ...createSystemActions(set, get)
    }),
    {
      name: "vector-control-hub-store",
      version: 4,
      partialize: partializeState,
      merge: (persistedState, currentState) =>
        mergePersistedState(currentState as AppState, persistedState as PersistedSlice | undefined)
    }
  )
);

export type { AppState, DriveDirection } from "./app-store-types";
