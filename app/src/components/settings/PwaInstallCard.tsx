import { Download, Globe, Share2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function PwaInstallCard() {
  const { canInstall, isInstalled, showIosHint, promptInstall } = usePwaInstall();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installable web app</CardTitle>
        <CardDescription>
          Vector Control Hub can now behave like a progressive web app with offline shell caching and a home-screen install flow.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Current status
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isInstalled
              ? "This browser is already running Vector Control Hub in an installed app-like mode."
              : canInstall
                ? "This browser supports installing the app directly from the current page."
                : showIosHint
                  ? "On iPhone or iPad, add this page to the home screen from Safari to install it."
                  : "The install prompt is not available in this browser yet, but the manifest and offline shell are in place."}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-primary" />
              Browser first
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The same app can run in the browser, as an installed PWA, or inside the native mobile shell.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Download className="h-4 w-4 text-primary" />
              Offline shell
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The app shell is cached so the interface can still reopen even when the live network drops.
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Share2 className="h-4 w-4 text-primary" />
              Install hint
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Android browsers should show an install prompt. On iPhone or iPad, use Safari's Share menu and Add to Home Screen.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void promptInstall()} disabled={!canInstall}>
            <Download className="h-4 w-4" />
            {isInstalled ? "Already installed" : "Install app"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
