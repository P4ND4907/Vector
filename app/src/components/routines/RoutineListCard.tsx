import { Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { formatTimestamp } from "@/lib/format";
import type { Routine } from "@/types";

interface RoutineListCardProps {
  onRemove: (routineId: string) => void;
  onRunNow: (routineId: string) => void;
  onToggle: (routineId: string) => void;
  routines: Routine[];
}

export function RoutineListCard({
  onRemove,
  onRunNow,
  onToggle,
  routines
}: RoutineListCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Current routines</CardTitle>
        <CardDescription>Users can toggle, run, or remove routines without leaving this screen.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {routines.length ? (
          routines.map((routine) => (
            <div key={routine.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold">{routine.name}</div>
                    <Badge>{routine.triggerType}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Trigger value: {routine.triggerValue} | Repeat: {routine.repeat}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last run: {formatTimestamp(routine.lastRunAt)}
                  </div>
                </div>
                <Switch checked={routine.enabled} onCheckedChange={() => onToggle(routine.id)} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => onRunNow(routine.id)}>
                  <Play className="h-4 w-4" />
                  Run now
                </Button>
                <Button size="sm" variant="outline" onClick={() => onRemove(routine.id)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No routines yet. Save a draft to build out your local automations.</p>
        )}
      </CardContent>
    </Card>
  );
}
