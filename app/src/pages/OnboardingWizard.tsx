import { useState } from "react";
import { CheckCircle2, ChevronRight, Cpu, Radio, Shapes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEngineStatus } from "@/hooks/useEngineStatus";

type EngineChoice = "embedded" | "wirepod" | "mock";
type WizardStep = 1 | 2 | 3 | 4;

const STORAGE_KEY = "vector_onboarding_complete";

const engineOptions: {
  id: EngineChoice;
  label: string;
  description: string;
  recommended?: boolean;
  disabled?: boolean;
  icon: typeof Cpu;
}[] = [
  {
    id: "embedded",
    label: "Embedded (local)",
    description: "Direct local engine — not yet implemented.",
    disabled: true,
    icon: Cpu
  },
  {
    id: "wirepod",
    label: "WirePod",
    description: "Connect via a WirePod server. Recommended for most users.",
    recommended: true,
    icon: Radio
  },
  {
    id: "mock",
    label: "Mock (demo)",
    description: "No real robot required. Great for exploring the app.",
    icon: Shapes
  }
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [selectedEngine, setSelectedEngine] = useState<EngineChoice>("wirepod");
  const { connected, loading, refresh } = useEngineStatus();

  const finish = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onComplete();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="eyebrow">Setup · Step {step} of 4</div>
          {step === 1 && (
            <>
              <CardTitle>Welcome to Vector Control Hub</CardTitle>
              <CardDescription>
                Control, automate, and extend your Vector robot from any device. This short wizard
                will get you connected in under a minute.
              </CardDescription>
            </>
          )}
          {step === 2 && (
            <>
              <CardTitle>Choose your engine</CardTitle>
              <CardDescription>
                Select how the app communicates with your Vector robot.
              </CardDescription>
            </>
          )}
          {step === 3 && (
            <>
              <CardTitle>Connection test</CardTitle>
              <CardDescription>Let's verify the engine can reach your robot.</CardDescription>
            </>
          )}
          {step === 4 && (
            <>
              <CardTitle>You're all set!</CardTitle>
              <CardDescription>
                Vector Control Hub is ready. Head to the dashboard to start exploring.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" /> Drive your robot remotely
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" /> Run AI voice commands
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" /> Automate routines and behaviors
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-teal-400" /> Monitor diagnostics in real time
              </li>
            </ul>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {engineOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedEngine === opt.id;
                return (
                  <button
                    key={opt.id}
                    disabled={opt.disabled}
                    onClick={() => !opt.disabled && setSelectedEngine(opt.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      opt.disabled
                        ? "cursor-not-allowed opacity-40"
                        : isSelected
                          ? "border-primary/50 bg-primary/10"
                          : "border-[var(--surface-border)] bg-[var(--surface-soft)] hover:bg-[var(--surface-strong)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-5 w-5 text-primary" />
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          {opt.label}
                          {opt.recommended && (
                            <span className="rounded-lg border border-teal-400/30 bg-teal-400/10 px-1.5 py-0.5 text-[10px] text-teal-300">
                              Recommended
                            </span>
                          )}
                          {opt.disabled && (
                            <span className="rounded-lg border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              Coming soon
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">{opt.description}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selected engine:{" "}
                <span className="font-semibold text-foreground">
                  {engineOptions.find((o) => o.id === selectedEngine)?.label}
                </span>
              </p>
              <div
                className={`rounded-2xl border p-4 text-sm ${
                  loading
                    ? "border-white/10 bg-white/5 text-muted-foreground"
                    : connected
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                      : "border-amber-300/30 bg-amber-300/10 text-amber-100"
                }`}
              >
                {loading
                  ? "Testing connection…"
                  : connected
                    ? "Engine is reachable and connected."
                    : "Engine not connected yet. You can continue and reconnect later."}
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
                Re-test connection
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              Setup complete. Your preferences have been saved.
            </div>
          )}

          <div className="flex justify-between pt-2">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s - 1) as WizardStep)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < 4 ? (
              <Button onClick={() => setStep((s) => (s + 1) as WizardStep)}>
                Continue <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={finish}>Go to dashboard</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
