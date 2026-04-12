/**
 * app/src/App.improvements.tsx
 *
 * EXAMPLE FILE – for maintainer review only.
 *
 * This file is NOT imported anywhere. It shows suggested improvements to
 * app/src/App.tsx without overwriting the stable original.
 *
 * Improvements demonstrated here:
 *   1. Offline indicator banner (uses navigator.onLine + online/offline events)
 *   2. Error-caught initialize() call with console.error fallback
 *
 * To adopt: copy the relevant sections into app/src/App.tsx.
 */

import { useEffect, useState } from "react";
import React from "react";
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { applyThemeClasses } from "@/lib/themes";

// ── Improvement 1: offline indicator ─────────────────────────────────────────

function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline  = (): void => setIsOnline(true);
    const handleOffline = (): void => setIsOnline(false);

    window.addEventListener("online",  handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online",  handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

function OfflineBanner(): React.ReactElement | null {
  const isOnline = useIsOnline();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      style={{
        position:        "fixed",
        top:             0,
        left:            0,
        right:           0,
        zIndex:          9999,
        padding:         "8px 16px",
        backgroundColor: "#f97316",
        color:           "#fff",
        textAlign:       "center",
        fontSize:        "0.875rem",
        fontWeight:      600,
      }}
    >
      You are offline. Some features may not work until your connection is restored.
    </div>
  );
}

// ── Main App component ────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  const { initialize, theme, colorTheme, hasHydrated } = useAppBootstrap();

  // Improvement 2: error-caught initialize()
  useEffect(() => {
    if (!hasHydrated) return;

    const initApp = async (): Promise<void> => {
      try {
        await initialize();
      } catch (error) {
        console.error("[App] Initialization failed:", error);
        // The app stays mounted and shows whatever state it has.
        // AppErrorBoundary will catch any render-time errors separately.
      }
    };

    void initApp();
  }, [hasHydrated, initialize]);

  useEffect(() => {
    applyThemeClasses(theme, colorTheme);
  }, [theme, colorTheme]);

  return (
    <AppErrorBoundary>
      {/* Improvement 1: offline banner renders on top of all UI */}
      <OfflineBanner />
      <AppShell />
    </AppErrorBoundary>
  );
}
