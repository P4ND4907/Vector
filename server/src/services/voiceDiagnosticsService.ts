import type { RobotIntegrationInfo, RobotStatus, VoiceDiagnosticsRecord } from "../robot/types.js";
import type { WirePodSdkSettings } from "./wirepodService.js";

interface VoiceDiagnosticsInput {
  integration: RobotIntegrationInfo;
  robot: RobotStatus;
  sdkSettings?: WirePodSdkSettings;
  logsText?: string;
  debugLogsText?: string;
}

interface ParsedVoiceEvent {
  at?: string;
  value?: string;
  text?: string;
}

const toIsoTimestamp = (value?: string) => {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(
    /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2}:\d{2})$/,
    "$1-$2-$3T$4"
  );
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const parseLatestIntent = (logsText = ""): ParsedVoiceEvent | undefined => {
  const lines = logsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    const match = line.match(
      /^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}): Intent matched: ([^,]+), transcribed text: '(.*)'/i
    );

    if (match) {
      return {
        at: toIsoTimestamp(match[1]),
        value: match[2],
        text: match[3] || undefined
      };
    }
  }

  return undefined;
};

const parseLatestTranscription = (debugLogsText = ""): ParsedVoiceEvent | undefined => {
  const lines = debugLogsText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    const match = line.match(
      /^(\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}): .*Transcribed text:\s*(.*)$/i
    );

    if (match) {
      return {
        at: toIsoTimestamp(match[1]),
        text: match[2] || undefined
      };
    }
  }

  return undefined;
};

export const buildVoiceDiagnostics = ({
  integration,
  robot,
  sdkSettings,
  logsText,
  debugLogsText
}: VoiceDiagnosticsInput): VoiceDiagnosticsRecord => {
  const lastIntent = parseLatestIntent(logsText);
  const lastTranscription = parseLatestTranscription(debugLogsText);
  const locale = sdkSettings?.locale || "Unknown";
  const volume = typeof sdkSettings?.master_volume === "number" ? sdkSettings.master_volume : robot.volume ?? 0;
  const wakeWordMode =
    sdkSettings?.button_wakeword === 0
      ? "hey-vector"
      : sdkSettings?.button_wakeword === 1
        ? "alexa"
        : "unknown";

  const troubleshooting = new Set<string>();
  let status: VoiceDiagnosticsRecord["status"] = "healthy";
  let summary = "Recent voice activity looks healthy.";

  if (!integration.wirePodReachable) {
    status = "critical";
    summary = "The local bridge is offline, so wake-word voice control cannot work.";
    troubleshooting.add("Make sure the desktop service is still running on this computer.");
  } else if (!robot.isConnected) {
    status = "attention";
    summary = "The local bridge is online, but Vector is not answering live checks right now.";
    troubleshooting.add("Place Vector on the charger, wait a moment, and test again.");
  } else if (wakeWordMode !== "hey-vector") {
    status = "attention";
    summary = "The robot button wake-word mode is not set to Hey Vector.";
    troubleshooting.add("Switch the wake-word mode back to Hey Vector.");
  } else if (!/^en(-|$)/i.test(locale)) {
    status = "attention";
    summary = `Speech locale is ${locale}. English is usually the safest baseline for testing.`;
    troubleshooting.add("Use English (US) first while voice commands are being stabilized.");
  } else if (volume === 0) {
    status = "attention";
    summary = "The speaker volume is muted, so spoken responses may seem broken.";
    troubleshooting.add("Raise the volume before testing spoken responses.");
  } else if (lastIntent?.value === "intent_system_noaudio") {
    status = "attention";
    summary = "Vector woke, but the local bridge did not capture usable follow-up speech.";
    troubleshooting.add("Try a full phrase like 'Hey Vector, what time is it?' instead of only the wake word.");
    troubleshooting.add("Test from closer range in a quieter room.");
  } else if (lastIntent?.value === "intent_system_unmatched") {
    status = "attention";
    summary = lastIntent.text
      ? `Vector heard "${lastIntent.text}" but did not match it to a supported intent.`
      : "Vector heard speech, but it did not match a supported intent.";
    troubleshooting.add("Try a simpler phrase like 'Hey Vector, what time is it?'.");
  } else if (!lastIntent && !lastTranscription?.text) {
    status = "attention";
    summary = "No recent voice activity has been recorded yet.";
    troubleshooting.add("Say a full command after the wake word so the local bridge has real speech to inspect.");
  }

  if (volume > 0 && volume < 3) {
    troubleshooting.add("Turn the volume up to 4 or 5 while testing speech.");
  }

  return {
    wakeWordMode,
    locale,
    volume,
    lastIntent: lastIntent?.value,
    lastTranscription: lastIntent?.text || lastTranscription?.text,
    lastHeardAt: lastIntent?.at || lastTranscription?.at,
    status,
    summary,
    troubleshooting: Array.from(troubleshooting)
  };
};
