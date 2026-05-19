import { getJson, postJson } from "@/services/apiClient";
import type {
  BotLabManifest,
  BotLabMarkerResolution,
  BotLabRunRecord,
  BotLabRunResult,
  Routine
} from "@/types";

export interface BotLabImportResponse {
  session: Routine;
  mission: {
    id: string;
    title: string;
    goal: string;
    success: string;
  };
  missingRequired: string[];
  history: BotLabRunRecord[];
  message: string;
}

export interface BotLabSessionsResponse {
  sessions: Routine[];
  runs: BotLabRunRecord[];
}

export const botlabService = {
  getManifest() {
    return getJson<BotLabManifest>(
      "/api/engine/botlab/manifest",
      "BotLab learning map could not be loaded."
    );
  },

  getSessions() {
    return getJson<BotLabSessionsResponse>(
      "/api/engine/botlab/sessions",
      "BotLab sessions could not be loaded."
    );
  },

  importPayload(payload: unknown) {
    return postJson<BotLabImportResponse>(
      "/api/engine/botlab/import",
      payload,
      "BotLab layout import failed."
    );
  },

  resolveMarker(markerId: number) {
    return postJson<BotLabMarkerResolution>(
      "/api/engine/botlab/marker",
      { markerId },
      "BotLab marker lookup failed."
    );
  },

  recordRun(missionId: string, result: BotLabRunResult, sessionId?: string, note?: string) {
    return postJson<{ run: BotLabRunRecord; message: string }>(
      "/api/engine/botlab/runs",
      { missionId, result, sessionId, note },
      "BotLab run result could not be saved."
    );
  }
};
