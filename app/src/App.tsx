import { useEffect } from "react";
import { AppErrorBoundary } from "@/components/layout/AppErrorBoundary";
import { AppShell } from "@/components/layout/AppShell";
import { useAppBootstrap } from "@/hooks/useAppBootstrap";
import { applyThemeClasses } from "@/lib/themes";

export default function App() {
  const { initialize, theme, colorTheme } = useAppBootstrap();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    applyThemeClasses(theme, colorTheme);
  }, [theme, colorTheme]);

  return (
    <AppErrorBoundary>
      <AppShell />
    </AppErrorBoundary>
  );
}
