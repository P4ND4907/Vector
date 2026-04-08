import { useMemo } from "react";

import {
  ActiveRoamCard,
  AutomationOverviewCard,
  RoamSetupCard,
  StoredRoamDataCard
} from "@/components/automation-control/automation-control-sections";
import { FeatureGateCard } from "@/components/monetization/FeatureGateCard";
import { isProAccessActive } from "@/lib/monetization-access";
import { getBatteryState } from "@/lib/robot-state";
import { useAppStore } from "@/store/useAppStore";

export function AutomationControlPage() {
  const robot = useAppStore((state) => state.robot);
  const settings = useAppStore((state) => state.settings);
  const roamSessions = useAppStore((state) => state.roamSessions);
  const automationControl = useAppStore((state) => state.automationControl);
  const automationState = useAppStore((state) => state.actionStates.automation);
  const returnToDock = useAppStore((state) => state.returnToDock);
  const updateAutomationControl = useAppStore((state) => state.updateAutomationControl);
  const startRoam = useAppStore((state) => state.startRoam);
  const pauseRoam = useAppStore((state) => state.pauseRoam);
  const resumeRoam = useAppStore((state) => state.resumeRoam);
  const stopRoam = useAppStore((state) => state.stopRoam);

  const activeSession = roamSessions.find((session) => session.id === automationControl.activeSessionId) ?? null;
  const completedSessionsCount = useMemo(
    () => roamSessions.filter((session) => session.status === "completed").length,
    [roamSessions]
  );
  const storedDistance = useMemo(
    () => roamSessions.reduce((sum, session) => sum + session.distanceMeters, 0),
    [roamSessions]
  );
  const storedDataPoints = useMemo(
    () => roamSessions.reduce((sum, session) => sum + session.dataPointsCollected, 0),
    [roamSessions]
  );
  const batteryState = getBatteryState(robot);
  const proAccess = isProAccessActive(settings);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
      <div className="grid gap-4">
        <AutomationOverviewCard
          automationControl={automationControl}
          automationState={automationState}
          roamSessionsCount={roamSessions.length}
          storedDataPoints={storedDataPoints}
          controlsDisabled={!proAccess}
          controlMessage={
            !proAccess
              ? "Free keeps manual controls, connection repair, and robot status open. Companion Pro unlocks patrol runs, pause and resume controls, and stored autonomous roam tools."
              : undefined
          }
          onStartRoam={startRoam}
          onPauseRoam={pauseRoam}
          onResumeRoam={resumeRoam}
          onStopRoam={stopRoam}
          onReturnToDock={returnToDock}
        />
        {proAccess ? (
          <RoamSetupCard
            automationControl={automationControl}
            onUpdateAutomationControl={updateAutomationControl}
          />
        ) : (
          <FeatureGateCard feature="advanced-automation" />
        )}
      </div>

      <div className="grid gap-4">
        <ActiveRoamCard activeSession={activeSession} robotBatteryStateLabel={batteryState.label} />
        <StoredRoamDataCard
          roamSessions={roamSessions}
          completedSessionsCount={completedSessionsCount}
          storedDistance={storedDistance}
          storedDataPoints={storedDataPoints}
        />
      </div>
    </div>
  );
}
