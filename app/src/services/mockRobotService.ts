import { clamp } from "@/lib/format";
import { getBatteryState } from "@/lib/robot-state";
import { buildCameraFrame, cloneSnapshot } from "@/services/mockData";
import type {
  AnimationItem,
  AutomationControl,
  AppSnapshot,
  CameraSnapshot,
  DiagnosticCheck,
  DiagnosticReport,
  DiagnosticsSnapshot,
  IntegrationStatus,
  PairRobotInput,
  Robot,
  RobotCommandResult,
  RobotProfile,
  RoamSession,
  Routine
} from "@/types";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const maybeFail = async (chance = 0.08) => {
  if (Math.random() < chance) {
    await wait(120);
    throw new Error("Local connection timed out. Try again in a moment.");
  }
};

const clone = <T,>(value: T) => JSON.parse(JSON.stringify(value)) as T;

export const mockRobotService = {
  async bootstrap(): Promise<AppSnapshot> {
    await wait(240);
    return cloneSnapshot();
  },

  async scanNetwork() {
    await wait(850);
    await maybeFail(0.04);
    return cloneSnapshot().availableRobots;
  },

  async pairRobot(input: PairRobotInput): Promise<RobotCommandResult<{ profile: RobotProfile; robot: Robot }>> {
    await wait(700);

    const robot: Robot = {
      id: crypto.randomUUID(),
      serial: input.serial,
      name: input.name.trim() || "Vector",
      nickname: input.name.trim(),
      ipAddress: input.ipAddress.trim(),
      token: input.token.trim(),
      lastSeen: new Date().toISOString(),
      batteryPercent: 82,
      isCharging: false,
      isConnected: false,
      isDocked: false,
      firmwareVersion: "2.4.1-local",
      connectionState: "disconnected",
      mood: "ready",
      wifiStrength: 76,
      isMuted: false,
      volume: 3,
      cameraAvailable: true,
      connectionSource: "mock",
      systemStatus: "offline",
      currentActivity: "Awaiting a mock connection."
    };

    const profile: RobotProfile = {
      id: robot.id,
      serial: robot.serial,
      name: robot.name,
      ipAddress: robot.ipAddress,
      token: robot.token,
      autoReconnect: input.autoReconnect,
      lastPairedAt: new Date().toISOString()
    };

    return {
      ok: true,
      message: `Saved ${robot.name} for quick reconnect.`,
      data: { profile, robot }
    };
  },

  async connect(robot: Robot): Promise<RobotCommandResult<Robot>> {
    await wait(520);
    await maybeFail(0.12);

    return {
      ok: true,
      message: `${robot.nickname ?? robot.name} is online and ready.`,
      data: {
        ...robot,
        isConnected: true,
        connectionState: "connected",
        lastSeen: new Date().toISOString(),
        wifiStrength: clamp(robot.wifiStrength + 4, 10, 100),
        connectionSource: "mock",
        systemStatus: "ready",
        currentActivity: "Mock mode is active."
      }
    };
  },

  async disconnect(robot: Robot): Promise<RobotCommandResult<Robot>> {
    await wait(320);
    return {
      ok: true,
      message: `${robot.nickname ?? robot.name} disconnected safely.`,
      data: {
        ...robot,
        isConnected: false,
        connectionState: "disconnected",
        lastSeen: new Date().toISOString(),
        systemStatus: "offline",
        currentActivity: "Disconnected in mock mode."
      }
    };
  },

  async sendDriveCommand(direction: string, speed: number, precisionMode: boolean) {
    await wait(180);
    return {
      ok: true,
      message: precisionMode
        ? `Precision ${direction} command sent at ${speed}% speed.`
        : `${direction} command sent at ${speed}% speed.`
    };
  },

  async setHead(angle: number) {
    await wait(160);
    return {
      ok: true,
      message: `Head adjusted to ${angle} degrees.`
    };
  },

  async setLift(height: number) {
    await wait(160);
    return {
      ok: true,
      message: `Lift moved to ${height}% height.`
    };
  },

  async speak(text: string) {
    await wait(430);
    await maybeFail(0.05);
    return {
      ok: true,
      message: `Speaking: "${text.slice(0, 40)}${text.length > 40 ? "..." : ""}"`
    };
  },

  async playAnimation(animation: AnimationItem) {
    await wait(260);
    return {
      ok: true,
      message: `Playing ${animation.name}.`
    };
  },

  async dock() {
    await wait(550);
    return {
      ok: true,
      message: "Vector is returning to the charger."
    };
  },

  async toggleMute(isMuted: boolean) {
    await wait(200);
    return {
      ok: true,
      message: isMuted ? "Audio muted." : "Audio unmuted."
    };
  },

  async wake() {
    await wait(200);
    return {
      ok: true,
      message: "Wake signal sent."
    };
  },

  async setVolume(volume: number) {
    await wait(180);
    return {
      ok: true,
      message: `Volume set to ${volume}.`
    };
  },

  async takePhoto(count: number): Promise<RobotCommandResult<CameraSnapshot>> {
    await wait(460);
    const snapshot: CameraSnapshot = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      label: `Live snapshot ${count + 1}`,
      dataUrl: buildCameraFrame(`Live snapshot ${count + 1}`, "#1f5e72"),
      motionScore: Math.floor(Math.random() * 60) + 20
    };

    return {
      ok: true,
      message: "Snapshot saved locally.",
      data: snapshot
    };
  },

  async saveRoutine(routine: Routine) {
    await wait(280);
    return {
      ok: true,
      message: `Routine "${routine.name}" saved.`,
      data: routine
    };
  },

  async deleteRoutine(routineId: string) {
    await wait(200);
    return {
      ok: true,
      message: `Routine ${routineId} removed.`
    };
  },

  async runDiagnostics(robot: Robot): Promise<RobotCommandResult<DiagnosticReport>> {
    await wait(1_000);
    await maybeFail(0.03);
    const batteryState = getBatteryState(robot);

    const checks: DiagnosticCheck[] = [
      {
        id: crypto.randomUUID(),
        label: "Local network",
        category: "network" as const,
        status: robot.isConnected ? "pass" : "warn",
        metric: `${Math.floor(Math.random() * 15) + 12} ms average latency`,
        details: robot.isConnected
          ? "Wi-Fi round-trip timing stayed in the responsive range."
          : "Robot is disconnected, so diagnostics fell back to the last known link state."
      },
      {
        id: crypto.randomUUID(),
        label: "Battery and dock readiness",
        category: "power" as const,
        status: robot.batteryPercent > 25 ? "pass" : "warn",
        metric: batteryState.label,
        details: batteryState.detail
      },
      {
        id: crypto.randomUUID(),
        label: "Drive and lift control",
        category: "motion" as const,
        status: "pass" as const,
        metric: "Responsive",
        details: "Mock motion checks completed with clean head, lift, and drive command timing."
      },
      {
        id: crypto.randomUUID(),
        label: "Camera and sensors",
        category: "vision" as const,
        status: robot.cameraAvailable ? "pass" : "warn",
        metric: robot.cameraAvailable ? "Camera online" : "Camera unavailable",
        details: robot.cameraAvailable
          ? "Camera snapshots and placeholder vision events are available."
          : "The camera layer is currently unavailable, so roam data will be motion-only."
      },
      {
        id: crypto.randomUUID(),
        label: "Local storage",
        category: "storage" as const,
        status: "warn" as const,
        metric: `${Math.floor(Math.random() * 40) + 72} MB stored`,
        details: "Roam sessions and snapshots are persisting locally on this device."
      }
    ];

    const hasFail = checks.some((check) => check.status === "fail");
    const hasWarn = checks.some((check) => check.status === "warn");

    const report: DiagnosticReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      overallStatus: hasFail ? "critical" : hasWarn ? "attention" : "healthy",
      summary: hasFail
        ? "Diagnostics found at least one blocking robot issue."
        : hasWarn
          ? "Diagnostics completed with a few items worth attention."
          : "Diagnostics passed cleanly across all robot checks.",
      robotName: robot.nickname ?? robot.name,
      checks,
      troubleshooting: [
        "Mock mode is active, so these results are simulated.",
        "Turn mock mode off in Settings to test the live WirePod connection path."
      ]
    };

    return {
      ok: true,
      message: report.summary,
      data: report
    };
  },

  async getDiagnosticsSnapshot(snapshot: AppSnapshot): Promise<DiagnosticsSnapshot> {
    await wait(150);
    const logs = clone(snapshot.logs);
    const latestSuccessfulCommand = logs.find((log) => log.status === "success");
    const latestFailedCommand = logs.find((log) => log.status === "error");

    const integration: IntegrationStatus = {
      ...snapshot.integration,
      source: "mock",
      mockMode: true,
      note: "Mock mode is active."
    };

    return {
      robot: clone(snapshot.robot),
      integration,
      logs,
      latestSuccessfulCommand,
      latestFailedCommand,
      troubleshooting: [
        "Mock mode is active, so diagnostics and controls are simulated locally.",
        "Turn mock mode off and make sure WirePod is running to test the live path."
      ]
    };
  },

  async startRoam(robot: Robot, automation: AutomationControl, existingCount: number): Promise<RobotCommandResult<RoamSession>> {
    await wait(480);
    await maybeFail(0.05);

    const session: RoamSession = {
      id: crypto.randomUUID(),
      name: `${automation.targetArea} roam ${existingCount + 1}`,
      status: "running",
      behavior: automation.behavior,
      targetArea: automation.targetArea,
      startedAt: new Date().toISOString(),
      distanceMeters: 0,
      commandsIssued: 0,
      snapshotsTaken: 0,
      dataPointsCollected: 0,
      batteryStart: robot.batteryPercent,
      summary: "Autonomous roam is in progress.",
      events: [
        {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          type: "status",
          message: `Autonomous ${automation.behavior} roam started in ${automation.targetArea}.`,
          batteryPercent: robot.batteryPercent,
          dataPointsCollected: 0
        }
      ]
    };

    return {
      ok: true,
      message: `Roam started for ${automation.targetArea}.`,
      data: session
    };
  },

  async pauseRoam(session: RoamSession): Promise<RobotCommandResult<RoamSession>> {
    await wait(220);
    return {
      ok: true,
      message: `${session.name} paused.`,
      data: {
        ...session,
        status: "paused",
        summary: "Roam paused by the operator."
      }
    };
  },

  async resumeRoam(session: RoamSession): Promise<RobotCommandResult<RoamSession>> {
    await wait(220);
    return {
      ok: true,
      message: `${session.name} resumed.`,
      data: {
        ...session,
        status: "running",
        summary: "Roam resumed."
      }
    };
  },

  async stopRoam(session: RoamSession, robot: Robot): Promise<RobotCommandResult<RoamSession>> {
    await wait(280);
    return {
      ok: true,
      message: `${session.name} stopped and stored locally.`,
      data: {
        ...session,
        status: "completed",
        endedAt: new Date().toISOString(),
        batteryEnd: robot.batteryPercent,
        summary: "Roam completed and data stored locally."
      }
    };
  },

  subscribeRoam(
    getSession: () => RoamSession | undefined,
    getRobot: () => Robot,
    getAutomation: () => AutomationControl,
    onTick: (payload: {
      session: RoamSession;
      robot: Robot;
      event: RoamSession["events"][number];
      snapshot?: CameraSnapshot;
      shouldAutoDock: boolean;
    }) => void
  ) {
    const timer = window.setInterval(() => {
      const session = clone(getSession());
      if (!session || session.status !== "running") {
        return;
      }

      const robot = clone(getRobot());
      const automation = clone(getAutomation());
      const distanceMeters = Number((Math.random() * 1.8 + 0.6).toFixed(1));
      const commandsIssued = Math.floor(Math.random() * 3) + 1;
      const dataPointsCollected = automation.dataCollectionEnabled ? Math.floor(Math.random() * 12) + 6 : 0;
      const nextBattery = clamp(robot.batteryPercent - (Math.random() > 0.7 ? 2 : 1), 0, 100);
      const shouldCaptureSnapshot = automation.captureSnapshots && Math.random() > 0.7;

      const snapshot = shouldCaptureSnapshot
        ? {
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            label: `${automation.targetArea} roam capture`,
            dataUrl: buildCameraFrame(`${automation.targetArea} roam`, "#1d6f68"),
            motionScore: Math.floor(Math.random() * 50) + 25
          }
        : undefined;

      const eventOptions = [
        `Patrolled a clean lane through ${automation.targetArea}.`,
        `Detected motion and logged a waypoint inside ${automation.targetArea}.`,
        `Adjusted route slightly to keep the roam smooth and obstacle-aware.`,
        `Collected another batch of local telemetry from the roam session.`
      ];

      const event: RoamSession["events"][number] = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        type: shouldCaptureSnapshot ? "vision" : "movement",
        message: eventOptions[Math.floor(Math.random() * eventOptions.length)],
        batteryPercent: nextBattery,
        dataPointsCollected
      };

      const nextSession: RoamSession = {
        ...session,
        distanceMeters: Number((session.distanceMeters + distanceMeters).toFixed(1)),
        commandsIssued: session.commandsIssued + commandsIssued,
        snapshotsTaken: session.snapshotsTaken + (snapshot ? 1 : 0),
        dataPointsCollected: session.dataPointsCollected + dataPointsCollected,
        summary: `Roaming ${automation.targetArea} in ${automation.behavior} mode.`,
        events: [event, ...session.events].slice(0, 20)
      };

      const nextRobot: Robot = {
        ...robot,
        batteryPercent: nextBattery,
        lastSeen: new Date().toISOString(),
        mood: automation.behavior === "quiet" ? "focused" : "curious",
        systemStatus: "busy",
        currentActivity: `Roaming ${automation.targetArea} in mock mode.`
      };

      onTick({
        session: nextSession,
        robot: nextRobot,
        event,
        snapshot,
        shouldAutoDock: automation.safeReturnEnabled && nextBattery <= automation.autoDockThreshold
      });
    }, 7_000);

    return () => window.clearInterval(timer);
  },

  subscribeTelemetry(getRobot: () => Robot, onRobot: (nextRobot: Robot) => void) {
    const timer = window.setInterval(() => {
      const robot = clone(getRobot());
      const nextBattery = robot.isCharging
        ? clamp(robot.batteryPercent + 2, 0, 100)
        : clamp(robot.batteryPercent - 1, 10, 100);

      const nextRobot: Robot = {
        ...clone(robot),
        batteryPercent: nextBattery,
        lastSeen: new Date().toISOString(),
        mood:
          nextBattery < 24
            ? "focused"
            : nextBattery > 84
              ? "playful"
              : robot.isCharging
                ? "charging"
            : Math.random() > 0.5
              ? "curious"
              : "ready",
        wifiStrength: clamp(robot.wifiStrength + (Math.random() > 0.5 ? 1 : -2), 48, 98),
        systemStatus: robot.isCharging ? "charging" : "ready",
        currentActivity: robot.isCharging ? "Charging in mock mode." : "Awaiting your next command."
      };

      onRobot(nextRobot);
    }, 6_000);

    return () => window.clearInterval(timer);
  }
};
