import { useMemo } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { DesktopSidebarPanels, PinnedStatusCard, ToastRail } from "@/components/layout/app-shell-chrome";
import { DesktopNav, MobileNav } from "@/components/layout/app-shell-nav";
import { AiCommandsPage } from "@/pages/AiCommandsPage";
import { AnimationsPage } from "@/pages/AnimationsPage";
import { AutomationControlPage } from "@/pages/AutomationControlPage";
import { CameraPage } from "@/pages/CameraPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { DiagnosticsPage } from "@/pages/DiagnosticsPage";
import { DrivePage } from "@/pages/DrivePage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { PairingPage } from "@/pages/PairingPage";
import { RoutinesPage } from "@/pages/RoutinesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SpeechPage } from "@/pages/SpeechPage";
import { StartupConnectPage } from "@/pages/StartupConnectPage";
import { useAppStore } from "@/store/useAppStore";

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
        <Routes>
          <Route path="/" element={<StartupConnectPage />} />
          <Route path="/startup" element={<StartupConnectPage />} />
        </Routes>

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
        </main>

        <aside className="hidden 2xl:block">
          <DesktopSidebarPanels unreadNotifications={unreadNotifications} recentLogs={recentLogs} />
        </aside>
      </div>

      <MobileNav />

      <ToastRail toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
}
