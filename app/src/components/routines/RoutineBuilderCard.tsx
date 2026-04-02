import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ACTION_OPTIONS,
  REPEAT_OPTIONS,
  TRIGGER_OPTIONS
} from "@/components/routines/routine-helpers";
import type { Routine } from "@/types";

interface RoutineBuilderCardProps {
  draft: Routine;
  onDraftChange: (routine: Routine) => void;
  onReset: () => void;
  onSave: () => Promise<void> | void;
}

export function RoutineBuilderCard({
  draft,
  onDraftChange,
  onReset,
  onSave
}: RoutineBuilderCardProps) {
  const firstAction = draft.actions[0] ?? { type: "speak", value: "" };

  const updateDraft = (patch: Partial<Routine>) => {
    onDraftChange({ ...draft, ...patch });
  };

  const updateAction = (patch: Partial<Routine["actions"][number]>) => {
    onDraftChange({
      ...draft,
      actions: [{ ...firstAction, ...patch }]
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="eyebrow">Routine builder</div>
        <CardTitle>Simple block-style automation without overwhelming the user.</CardTitle>
        <CardDescription>
          Triggers, conditions, actions, delay, and repeat are modeled as clean data so a richer builder can grow later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Routine name</label>
          <Input value={draft.name} onChange={(event) => updateDraft({ name: event.target.value })} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Trigger</label>
            <select
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm"
              value={draft.triggerType}
              onChange={(event) =>
                updateDraft({ triggerType: event.target.value as Routine["triggerType"] })
              }
            >
              {TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Trigger value</label>
            <Input
              value={draft.triggerValue}
              onChange={(event) => updateDraft({ triggerValue: event.target.value })}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Action type</label>
            <select
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm"
              value={firstAction.type}
              onChange={(event) =>
                updateAction({ type: event.target.value as Routine["actions"][number]["type"] })
              }
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Action value</label>
            <Input value={firstAction.value} onChange={(event) => updateAction({ value: event.target.value })} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Conditions</label>
          <Input
            value={draft.conditions.join(", ")}
            onChange={(event) =>
              updateDraft({
                conditions: event.target.value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean)
              })
            }
            placeholder="Only when connected, Avoid bedtime"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Delay (ms)</label>
            <Input
              type="number"
              value={draft.delayMs}
              onChange={(event) => updateDraft({ delayMs: Number(event.target.value || 0) })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Repeat</label>
            <select
              className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm"
              value={draft.repeat}
              onChange={(event) => updateDraft({ repeat: event.target.value as Routine["repeat"] })}
            >
              {REPEAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onSave}>Save routine</Button>
          <Button variant="outline" onClick={onReset}>
            Reset draft
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
