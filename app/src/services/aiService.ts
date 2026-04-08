import { deleteJson, getJson, postJson } from "@/services/apiClient";
import {
  deleteMockLearnedCommand,
  getMockCommandGaps,
  executeMockCommand,
  getMockLearnedCommands,
  getMockAiStatus,
  getMockCommandCatalog,
  previewMockCommand,
  saveMockLearnedCommand
} from "@/services/mockAiService";
import { mapAiCommandPreview, mapIntegration, mapRobot, type ServerIntegration, type ServerRobot } from "@/services/robotBackend";
import { pauseTelemetry } from "@/services/robotService";
import type {
  AiCommandPreview,
  CommandGap,
  IntegrationStatus,
  LearnedCommand,
  Robot,
  Routine,
  VectorCommandCatalogItem
} from "@/types";

export interface AiRoutineDraft {
  name: string;
  triggerType: Routine["triggerType"];
  triggerValue: string;
  conditions: string[];
  actions: Routine["actions"];
  delayMs: number;
  repeat: Routine["repeat"];
  explanation: string;
}

interface AiStatusResponse {
  enabled: boolean;
  model: string;
}

interface AiCommandExecuteResponse {
  parsed: AiCommandPreview;
  resultMessage: string;
  robot: ServerRobot;
  integration?: ServerIntegration;
}

interface AiCommandCatalogResponse {
  items: VectorCommandCatalogItem[];
  counts: {
    total: number;
    live: number;
    partial: number;
  };
}

interface LearnedCommandsResponse {
  items: LearnedCommand[];
  item?: LearnedCommand;
}

interface CommandGapsResponse {
  items: CommandGap[];
}

const isPersistedMockModeEnabled = () => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const raw = window.localStorage.getItem("vector-control-hub-store");
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw) as { state?: { settings?: { mockMode?: boolean } } };
    return Boolean(parsed.state?.settings?.mockMode);
  } catch {
    return false;
  }
};

export const aiService = {
  async getStatus() {
    try {
      return await getJson<AiStatusResponse>("/api/ai/status", "The AI status check failed.");
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return getMockAiStatus();
    }
  },

  async getCommandCatalog() {
    try {
      return await getJson<AiCommandCatalogResponse>(
        "/api/ai/commands/catalog",
        "The command catalog could not be loaded."
      );
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return getMockCommandCatalog();
    }
  },

  async getLearnedCommands() {
    try {
      return await getJson<LearnedCommandsResponse>(
        "/api/ai/commands/learned",
        "Learned phrases could not be loaded."
      );
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return {
        items: getMockLearnedCommands()
      };
    }
  },

  async saveLearnedCommand(phrase: string, targetPrompt: string) {
    try {
      return await postJson<LearnedCommandsResponse>(
        "/api/ai/commands/learned",
        { phrase, targetPrompt },
        "The learned phrase could not be saved."
      );
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return {
        ...saveMockLearnedCommand(phrase, targetPrompt)
      };
    }
  },

  async deleteLearnedCommand(phrase: string) {
    try {
      return await deleteJson<LearnedCommandsResponse>(
        `/api/ai/commands/learned/${encodeURIComponent(phrase)}`,
        "The learned phrase could not be removed."
      );
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return {
        item: deleteMockLearnedCommand(phrase),
        items: getMockLearnedCommands()
      };
    }
  },

  async getCommandGaps() {
    try {
      return await getJson<CommandGapsResponse>(
        "/api/ai/commands/gaps",
        "Missed phrases could not be loaded."
      );
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return {
        items: getMockCommandGaps()
      };
    }
  },

  async generateRoutineDraft(prompt: string) {
    return postJson<{ routine: AiRoutineDraft }>(
      "/api/ai/routine-draft",
      { prompt },
      "The AI request failed."
    );
  },

  async previewCommand(prompt: string) {
    try {
      const response = await postJson<{ parsed: AiCommandPreview }>(
        "/api/ai/commands/preview",
        { prompt },
        "The AI command preview failed."
      );
      return mapAiCommandPreview(response.parsed);
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return previewMockCommand(prompt);
    }
  },

  async executeCommand(
    prompt: string,
    fallbackRobot: Robot,
    fallbackIntegration: IntegrationStatus
  ) {
    pauseTelemetry(12_000);
    try {
      const response = await postJson<AiCommandExecuteResponse>(
        "/api/ai/commands/execute",
        { prompt },
        "The AI command execution failed.",
        {
          connectTimeoutMs: 5_000,
          readTimeoutMs: 20_000
        }
      );

      return {
        parsed: mapAiCommandPreview(response.parsed),
        resultMessage: response.resultMessage,
        robot: mapRobot(response.robot, fallbackRobot),
        integration: response.integration
          ? mapIntegration(response.integration, fallbackIntegration)
          : fallbackIntegration
      };
    } catch (error) {
      if (!isPersistedMockModeEnabled()) {
        throw error;
      }
      return executeMockCommand(prompt, fallbackRobot, fallbackIntegration);
    }
  }
};
