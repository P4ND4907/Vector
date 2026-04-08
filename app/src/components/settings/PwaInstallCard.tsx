import { useEffect, useState } from "react";
import { Download, ExternalLink, Globe, Link2, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePwaInstall } from "@/hooks/usePwaInstall";

export function PwaInstallCard() {
  const {
    canInstall,
    canSelfInstall,
    installUrl,
    isInstalled,
    isNativeShell,
    isSecureContextLike,
    serviceWorkerReady,
    showIosHint,
    promptInstall,
    supportsServiceWorker
  } = usePwaInstall();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setCopyState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const handleCopyLink = async () => {
    if (!installUrl) {
      setCopyState("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(installUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const statusMessage = isNativeShell
    ? "You are already inside the native mobile shell, so web install is not needed on this device."
    : isInstalled
      ? "This browser is already running Vector Control Hub in an installed app-like mode."
      : canInstall
        ? "This browser is ready to show the install prompt from the current page."
        : showIosHint
          ? "Safari on iPhone or iPad can install this app from the Share menu with Add to Home Screen."
          : canSelfInstall
            ? "The app is web-install ready, but this browser has not exposed the install prompt yet. You can still use the browser menu install option."
            : "This page still needs a supported browser context before it can behave like a true installable web app.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Installable web app</CardTitle>
        <CardDescription>
          Vector Control Hub can run as a browser app, an installed PWA, or inside the native mobile shell without changing the core interface.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Current status
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{statusMessage}</p>
          {installUrl ? (
            <div className="mt-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] px-3 py-2 text-xs text-muted-foreground">
              {installUrl}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-primary" />
              Install context
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isNativeShell
                ? "Native shell detected."
                : isSecureContextLike
                  ? "HTTPS or localhost is available."
                  : "Open this from HTTPS or localhost to unlock install support."}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Download className="h-4 w-4 text-primary" />
              App shell
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isNativeShell
                ? "The native app does not use the browser service worker."
                : serviceWorkerReady
                  ? "Service worker is active for app-like launch and offline shell behavior."
                  : "Service worker has not taken control yet on this page."}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="h-4 w-4 text-primary" />
              Install path
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {canInstall
                ? "Prompt-ready in this browser."
                : showIosHint
                  ? "Use Safari Share > Add to Home Screen."
                  : supportsServiceWorker
                    ? "Use Chrome or Edge menu install if the prompt does not appear."
                    : "This browser/runtime does not expose the full install flow."}
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-4">
          <div className="text-sm font-semibold">What to do next</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-3 text-xs text-muted-foreground">
              Android and desktop Chrome/Edge can install directly from the browser menu or the install button below.
            </div>
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-3 text-xs text-muted-foreground">
              iPhone and iPad need Safari, then Share and Add to Home Screen.
            </div>
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-black)] p-3 text-xs text-muted-foreground">
              The PWA shell stays browser-based, so the desktop backend URL still needs to be reachable after install.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void promptInstall()} disabled={!canInstall}>
            <Download className="h-4 w-4" />
            {isInstalled ? "Already installed" : "Install app"}
          </Button>
          <Button variant="outline" onClick={() => void handleCopyLink()} disabled={!installUrl}>
            <Link2 className="h-4 w-4" />
            {copyState === "copied"
              ? "Link copied"
              : copyState === "failed"
                ? "Copy failed"
                : "Copy install link"}
          </Button>
          {installUrl ? (
            <Button
              variant="outline"
              onClick={() => {
                window.open(installUrl, "_blank", "noopener,noreferrer");
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open web app
            </Button>
          ) : null}
        </div>

        {!isNativeShell && !serviceWorkerReady ? (
          <p className="text-xs text-muted-foreground">
            The service worker may need one full page load before the browser marks the app as install-ready.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
