import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AdSenseBanner } from "@/components/ads/AdSenseBanner";
import { PremiumModal } from "@/components/engine/PremiumModal";
import { DesktopSidebarPanels, PinnedStatusCard, ToastRail } from "@/components/layout/app-shell-chrome";
import { DesktopNav, MobileNav, MobilePageHeader } from "@/components/layout/app-shell-nav";
import { StartupEntryPage } from "@/pages/StartupEntryPage";
import { StartupConnectPage } from "@/pages/StartupConnectPage";
import { getJson } from "@/services/apiClient";
import { useAppStore } from "@/store/useAppStore";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const PairingPage = lazy(() =>
  import("@/pages/PairingPage").then((module) => ({ default: module.PairingPage }))
);
const NewRobotSetupPage = lazy(() =>
  import("@/pages/OnboardingWizard").then((module) => ({ default: module.OnboardingWizard }))
);
const RepairToolsPage = lazy(() =>
  import("@/pages/RepairToolsPage").then((module) => ({ default: module.RepairToolsPage }))
);
const DrivePage = lazy(() =>
  import("@/pages/DrivePage").then((module) => ({ default: module.DrivePage }))
);
const AiCommandsPage = lazy(() =>
  import("@/pages/AiCommandsPage").then((module) => ({ default: module.AiCommandsPage }))
);
const MonetizationPage = lazy(() =>
  import("@/pages/MonetizationPage").then((module) => ({ default: module.MonetizationPage }))
);
const SpeechPage = lazy(() =>
  import("@/pages/SpeechPage").then((module) => ({ default: module.SpeechPage }))
);
const AnimationsPage = lazy(() =>
  import("@/pages/AnimationsPage").then((module) => ({ default: module.AnimationsPage }))
);
const DiagnosticsPage = lazy(() =>
  import("@/pages/DiagnosticsPage").then((module) => ({ default: module.DiagnosticsPage }))
);
const AutomationControlPage = lazy(() =>
  import("@/pages/AutomationControlPage").then((module) => ({ default: module.AutomationControlPage }))
);
const CameraPage = lazy(() =>
  import("@/pages/CameraPage").then((module) => ({ default: module.CameraPage }))
);
const RoutinesPage = lazy(() =>
  import("@/pages/RoutinesPage").then((module) => ({ default: module.RoutinesPage }))
);
const NotificationsPage = lazy(() =>
  import("@/pages/NotificationsPage").then((module) => ({ default: module.NotificationsPage }))
);
const SettingsPage = lazy(() =>
  import("@/pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);

function PageFallback() {
  return (
    <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-6 text-sm text-muted-foreground">
      Loading the next panel...
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const toasts = useAppStore((state) => state.toasts);
  const dismissToast = useAppStore((state) => state.dismissToast);
  const notifications = useAppStore((state) => state.notifications);
  const logs = useAppStore((state) => state.logs);
  const isStartupRoute =
    location.pathname === "/" || location.pathname === "/startup" || location.pathname === "/setup/new-robot";

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications]
  );
  const recentLogs = useMemo(() => logs.slice(0, 8), [logs]);
  const [proActive, setProActive] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getJson<{ license?: { tier: "free" | "pro"; activated: boolean } }>(
      "/api/engine/license/status",
      "License status could not be loaded."
    )
      .then((response) => {
        if (cancelled) {
          return;
        }
        const license = response.license;
        setProActive(Boolean(license?.activated && license?.tier === "pro"));
      })
      .catch(() => {
        if (!cancelled) {
          setProActive(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [premiumOpen]);

  if (isStartupRoute) {
    return (
      <div className="min-h-screen px-4 pb-8 pt-4 md:px-6">
        <Suspense fallback={<PageFallback />}>
          <Routes>
              <Route path="/" element={<StartupEntryPage />} />
              <Route path="/startup" element={<StartupConnectPage />} />
              <Route path="/setup/new-robot" element={<NewRobotSetupPage />} />
              <Route path="/onboarding" element={<NewRobotSetupPage />} />
            </Routes>
          </Suspense>

        <ToastRail toasts={toasts} dismissToast={dismissToast} />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-24 pt-4 md:px-6 md:pb-10">
      <div className="mx-auto grid max-w-[1900px] gap-4 xl:grid-cols-[240px_minmax(0,1fr)] 2xl:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="hidden xl:block">
          <DesktopNav />
        </aside>

        <main className="min-w-0 space-y-4">
          <MobilePageHeader />

          <PinnedStatusCard robot={robot} integration={integration} />

          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/startup" element={<StartupConnectPage />} />
              <Route path="/setup/new-robot" element={<NewRobotSetupPage />} />
              <Route path="/onboarding" element={<NewRobotSetupPage />} />
              <Route path="/pairing" element={<PairingPage />} />
              <Route path="/drive" element={<DrivePage />} />
              <Route path="/ai" element={<AiCommandsPage />} />
              <Route path="/upgrade" element={<MonetizationPage />} />
              <Route path="/speech" element={<SpeechPage />} />
              <Route path="/animations" element={<AnimationsPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
              <Route
                path="/automation"
                element={
                  proActive ? (
                    <AutomationControlPage />
                  ) : (
                    <button type="button" className="w-full text-left" onClick={() => setPremiumOpen(true)}>
                      <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-6">
                        Automation is a Pro feature. Tap to upgrade.
                      </div>
                    </button>
                  )
                }
              />
              <Route path="/camera" element={<CameraPage />} />
              <Route
                path="/routines"
                element={
                  proActive ? (
                    <RoutinesPage />
                  ) : (
                    <button type="button" className="w-full text-left" onClick={() => setPremiumOpen(true)}>
                      <div className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-6">
                        Routines is a Pro feature. Tap to upgrade.
                      </div>
                    </button>
                  )
                }
              />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/repair-tools" element={<RepairToolsPage />} />
            </Routes>
          </Suspense>
        </main>

        <aside className="hidden 2xl:block">
          <DesktopSidebarPanels unreadNotifications={unreadNotifications} recentLogs={recentLogs} />
        </aside>
      </div>

      <AdSenseBanner />

      <MobileNav />

      <PremiumModal
        open={premiumOpen}
        onOpenChange={setPremiumOpen}
        onActivated={() => {
          setPremiumOpen(false);
          setProActive(true);
        }}
      />

      <ToastRail toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}
