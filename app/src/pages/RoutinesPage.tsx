import { useEffect, useState } from "react";
import { RoutineAiDraftCard } from "@/components/routines/RoutineAiDraftCard";
import { RoutineBlocksCard } from "@/components/routines/RoutineBlocksCard";
import { RoutineBuilderCard } from "@/components/routines/RoutineBuilderCard";
import { RoutineListCard } from "@/components/routines/RoutineListCard";
import {
  BATTERY_EXAMPLE_PROMPT,
  createDefaultRoutine,
  createRoutineFromAiDraft,
  DEFAULT_AI_PROMPT
} from "@/components/routines/routine-helpers";
import { aiService } from "@/services/aiService";
import { useAppStore } from "@/store/useAppStore";
import type { Routine } from "@/types";

export function RoutinesPage() {
  const routines = useAppStore((state) => state.routines);
  const saveRoutine = useAppStore((state) => state.saveRoutine);
  const removeRoutine = useAppStore((state) => state.removeRoutine);
  const toggleRoutine = useAppStore((state) => state.toggleRoutine);
  const runRoutineNow = useAppStore((state) => state.runRoutineNow);
  const [draft, setDraft] = useState<Routine>(createDefaultRoutine());
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_AI_PROMPT);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiModel, setAiModel] = useState("gpt-4.1-mini");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState(
    "Describe an automation in plain English and the AI will turn it into a routine draft."
  );

  useEffect(() => {
    let active = true;

    aiService
      .getStatus()
      .then((status) => {
        if (!active) {
          return;
        }
        setAiEnabled(status.enabled);
        setAiModel(status.model);
        if (!status.enabled) {
          setAiMessage(
            "OpenAI is not configured yet. Add OPENAI_API_KEY to server/.env.local to enable AI routine drafts."
          );
        }
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setAiEnabled(false);
        setAiMessage(
          "The local API server is unavailable right now. Relaunch the app to start the backend service."
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const handleAiDraft = async () => {
    setAiLoading(true);
    setAiMessage("Generating routine draft...");

    try {
      const { routine } = await aiService.generateRoutineDraft(aiPrompt);
      setDraft(createRoutineFromAiDraft(routine));
      setAiMessage(routine.explanation);
    } catch (error) {
      setAiMessage(error instanceof Error ? error.message : "AI draft generation failed.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="grid gap-4">
        <RoutineAiDraftCard
          aiEnabled={aiEnabled}
          aiLoading={aiLoading}
          aiMessage={aiMessage}
          aiModel={aiModel}
          aiPrompt={aiPrompt}
          onGenerate={handleAiDraft}
          onPromptChange={setAiPrompt}
          onUseExample={() => setAiPrompt(BATTERY_EXAMPLE_PROMPT)}
        />

        <RoutineBuilderCard
          draft={draft}
          onDraftChange={setDraft}
          onReset={() => setDraft(createDefaultRoutine())}
          onSave={async () => {
            await saveRoutine(draft);
            setDraft(createDefaultRoutine());
          }}
        />
      </div>

      <div className="grid gap-4">
        <RoutineListCard
          routines={routines}
          onRemove={removeRoutine}
          onRunNow={runRoutineNow}
          onToggle={toggleRoutine}
        />
        <RoutineBlocksCard />
      </div>
    </div>
  );
}
