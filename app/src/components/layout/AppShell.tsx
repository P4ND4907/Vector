import { Suspense, lazy, useMemo } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { AdSenseBanner } from "@/components/ads/AdSenseBanner";
import { DesktopSidebarPanels, PinnedStatusCard, ToastRail } from "@/components/layout/app-shell-chrome";
import { DesktopNav, MobileNav } from "@/components/layout/app-shell-nav";
import { StartupConnectPage } from "@/pages/StartupConnectPage";
import { useAppStore } from "@/store/useAppStore";

const DashboardPage = lazy(() =>
  import("@/pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const PairingPage = lazy(() =>
  import("@/pages/PairingPage").then((module) => ({ default: module.PairingPage }))
);
const DrivePage = lazy(() =>
  import("@/pages/DrivePage").then((module) => ({ default: module.DrivePage }))
);
const AiCommandsPage = lazy(() =>
  import("@/pages/AiCommandsPage").then((module) => ({ default: module.AiCommandsPage }))
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
  const isStartupRoute = location.pathname === "/" || location.pathname === "/startup";

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.read),
    [notifications]
  );
  const recentLogs = useMemo(() => logs.slice(0, 8), [logs]);

  if (isStartupRoute) {
    return (
      <div className="min-h-screen px-4 pb-8 pt-4 md:px-6">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<StartupConnectPage />} />
            <Route path="/startup" element={<StartupConnectPage />} />
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
          <PinnedStatusCard robot={robot} integration={integration} />

          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/startup" element={<StartupConnectPage />} />
              <Route path="/pairing" element={<PairingPage />} />
              <Route path="/drive" element={<DrivePage />} />
              <Route path="/ai" element={<AiCommandsPage />} />
              <Route path="/speech" element={<SpeechPage />} />
              <Route path="/animations" element={<AnimationsPage />} />
              <Route path="/diagnostics" element={<DiagnosticsPage />} />
              <Route path="/automation" element={<AutomationControlPage />} />
              <Route path="/camera" element={<CameraPage />} />
              <Route path="/routines" element={<RoutinesPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>

        <aside className="hidden 2xl:block">
          <DesktopSidebarPanels unreadNotifications={unreadNotifications} recentLogs={recentLogs} />
        </aside>
      </div>

      <AdSenseBanner />

      <MobileNav />

      <ToastRail toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}
