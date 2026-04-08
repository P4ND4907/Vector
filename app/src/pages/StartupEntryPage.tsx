import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { mobileRuntimeNeedsManualBackendUrl } from "@/lib/runtime-target";
import { shouldOpenDashboardOnStartup, shouldPreferGuidedNewRobotSetup } from "@/lib/startup-onboarding";
import { StartupConnectPage } from "@/pages/StartupConnectPage";
import { useAppStore } from "@/store/useAppStore";

function StartupEntryFallback() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6 text-sm text-muted-foreground">
        Loading the best startup path for this device...
      </CardContent>
    </Card>
  );
}

export function StartupEntryPage() {
  const robot = useAppStore((state) => state.robot);
  const integration = useAppStore((state) => state.integration);
  const savedProfiles = useAppStore((state) => state.savedProfiles);
  const settings = useAppStore((state) => state.settings);
  const [hasHydrated, setHasHydrated] = useState(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    setHasHydrated(useAppStore.persist.hasHydrated());

    const unsubscribe = useAppStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    return unsubscribe;
  }, []);

  if (!hasHydrated) {
    return <StartupEntryFallback />;
  }

  if (
    shouldOpenDashboardOnStartup({
      robot,
      integration,
      settings
    })
  ) {
    return <Navigate to="/dashboard" replace />;
  }

  const shouldUseGuidedSetup = shouldPreferGuidedNewRobotSetup({
    robot,
    integration,
    settings,
    savedProfile: savedProfiles[0],
    mobileRuntimeNeedsBackend: mobileRuntimeNeedsManualBackendUrl()
  });

  if (shouldUseGuidedSetup) {
    return <Navigate to="/setup/new-robot" replace />;
  }

  return <StartupConnectPage />;
}
