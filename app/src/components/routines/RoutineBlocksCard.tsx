import { Blocks, Clock3, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RoutineBlocksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Builder blocks</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-3">
          <Blocks className="h-4 w-4 text-primary" />
          Trigger, condition, action, delay, and repeat are all first-class routine fields.
        </div>
        <div className="flex items-center gap-3">
          <Clock3 className="h-4 w-4 text-primary" />
          Schedule and interval routines are already modeled for future background execution.
        </div>
        <div className="flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-primary" />
          The AI helper drafts routines, but you still keep full control before saving anything locally.
        </div>
      </CardContent>
    </Card>
  );
}
