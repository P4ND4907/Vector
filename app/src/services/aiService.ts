import { getJson, postJson } from "@/services/apiClient";
import { mapAiCommandPreview, mapIntegration, mapRobot, type ServerIntegration, type ServerRobot } from "@/services/robotBackend";
import { pauseTelemetry } from "@/services/robotService";
import type { AiCommandPreview, Routine, Robot, IntegrationStatus } from "@/types";

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

export const aiService = {
  async getStatus() {
    return getJson<AiStatusResponse>("/api/ai/status", "The AI status check failed.");
  },

  async generateRoutineDraft(prompt: string) {
    return postJson<{ routine: AiRoutineDraft }>(
      "/api/ai/routine-draft",
      { prompt },
      "The AI request failed."
    );
  },

  async previewCommand(prompt: string) {
    const response = await postJson<{ parsed: AiCommandPreview }>(
      "/api/ai/commands/preview",
      { prompt },
      "The AI command preview failed."
    );
    return mapAiCommandPreview(response.parsed);
  },

  async executeCommand(
    prompt: string,
    fallbackRobot: Robot,
    fallbackIntegration: IntegrationStatus
  ) {
    pauseTelemetry(12_000);
    const response = await postJson<AiCommandExecuteResponse>(
      "/api/ai/commands/execute",
      { prompt },
      "The AI command execution failed."
    );

    return {
      parsed: mapAiCommandPreview(response.parsed),
      resultMessage: response.resultMessage,
      robot: mapRobot(response.robot, fallbackRobot),
      integration: response.integration
        ? mapIntegration(response.integration, fallbackIntegration)
        : fallbackIntegration
    };
  }
};
