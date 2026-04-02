import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface RoutineAiDraftCardProps {
  aiEnabled: boolean;
  aiLoading: boolean;
  aiMessage: string;
  aiModel: string;
  aiPrompt: string;
  onGenerate: () => void;
  onPromptChange: (value: string) => void;
  onUseExample: () => void;
}

export function RoutineAiDraftCard({
  aiEnabled,
  aiLoading,
  aiMessage,
  aiModel,
  aiPrompt,
  onGenerate,
  onPromptChange,
  onUseExample
}: RoutineAiDraftCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="eyebrow">AI routine draft</div>
        <CardTitle>Turn plain-English ideas into a structured routine.</CardTitle>
        <CardDescription>
          The OpenAI-backed helper runs on the local server, so your API key stays out of the frontend bundle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{aiEnabled ? "AI connected" : "AI unavailable"}</Badge>
          <Badge>{aiModel}</Badge>
        </div>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Describe the routine you want</label>
          <Textarea value={aiPrompt} onChange={(event) => onPromptChange(event.target.value)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onGenerate} disabled={!aiEnabled || aiLoading || !aiPrompt.trim()}>
            <Sparkles className="h-4 w-4" />
            {aiLoading ? "Generating..." : "Generate draft"}
          </Button>
          <Button variant="outline" onClick={onUseExample}>
            Use battery example
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{aiMessage}</p>
      </CardContent>
    </Card>
  );
}
