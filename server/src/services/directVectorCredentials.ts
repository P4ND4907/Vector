import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sanitizeRobotSerial } from "../robot/serials.js";

export interface DirectVectorCredentials {
  name: string;
  serial?: string;
  host: string;
  token: string;
  certPath: string;
}

export interface DirectVectorCredentialSuccess {
  ok: true;
  credentials: DirectVectorCredentials;
  source: "env" | "sdk-config";
}

export interface DirectVectorCredentialFailure {
  ok: false;
  missingFields: Array<keyof DirectVectorCredentials>;
  note: string;
}

export type DirectVectorCredentialResult =
  | DirectVectorCredentialSuccess
  | DirectVectorCredentialFailure;

export interface DirectVectorCredentialReadOptions {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  homeDir?: string;
  exists?: (filePath: string) => boolean;
  readFile?: (filePath: string) => Promise<string>;
}

type IniSections = Record<string, Record<string, string>>;

const requiredFields: Array<keyof DirectVectorCredentials> = ["name", "host", "token", "certPath"];

const readEnvValue = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  keys: string[]
) => keys.map((key) => env[key]?.trim()).find(Boolean);

const stripQuotes = (value: string) => value.trim().replace(/^["']|["']$/g, "");

const isAbsoluteFilePath = (filePath: string) =>
  path.isAbsolute(filePath) || /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith("\\\\");

const parseIni = (text: string): IniSections => {
  const sections: IniSections = { default: {} };
  let current = "default";

  for (const rawLine of text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }

    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      current = sectionMatch[1]?.trim() || "default";
      sections[current] ??= {};
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = stripQuotes(line.slice(separatorIndex + 1));
    sections[current][key] = value;
  }

  return sections;
};

const parseFlatIniFields = (text: string) => {
  const normalizedText = text.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n");
  return Object.fromEntries(
    Array.from(normalizedText.matchAll(/^\s*([A-Za-z0-9_.-]+)\s*=\s*(.+?)\s*$/gm))
      .map((match) => [match[1]!.toLowerCase(), stripQuotes(match[2]!)])
  ) as Record<string, string>;
};

const completeCredentials = (
  partial: Partial<DirectVectorCredentials>,
  source: DirectVectorCredentialSuccess["source"]
): DirectVectorCredentialResult => {
  const missingFields = requiredFields.filter((field) => !partial[field]);
  if (missingFields.length) {
    return {
      ok: false,
      missingFields,
      note: `Direct Vector credentials are missing: ${missingFields.join(", ")}.`
    };
  }

  return {
    ok: true,
    source,
    credentials: {
      name: partial.name!,
      serial: sanitizeRobotSerial(partial.serial),
      host: partial.host!,
      token: partial.token!,
      certPath: partial.certPath!
    }
  };
};

const readEnvCredentials = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined>
): DirectVectorCredentialResult => completeCredentials(
  {
    name: readEnvValue(env, ["VECTOR_DIRECT_NAME", "VECTOR_NAME"]),
    serial: readEnvValue(env, ["VECTOR_DIRECT_SERIAL", "VECTOR_SERIAL", "VECTOR_SN"]),
    host: readEnvValue(env, ["VECTOR_DIRECT_HOST", "VECTOR_DIRECT_IP", "VECTOR_IP"]),
    token: readEnvValue(env, ["VECTOR_DIRECT_TOKEN", "VECTOR_DIRECT_GUID", "VECTOR_BEARER_TOKEN"]),
    certPath: readEnvValue(env, ["VECTOR_DIRECT_CERT_PATH", "VECTOR_CRT", "VECTOR_CERT"])
  },
  "env"
);

const sectionToCredentials = (
  sectionName: string,
  section: Record<string, string>,
  configDirectory: string
): Partial<DirectVectorCredentials> => {
  const cert = section.cert || section.certificate || section.crt;
  return {
    name: section.name || section.robot_name,
    serial: sanitizeRobotSerial(section.serial || section.esn || sectionName),
    host: section.ip || section.host || section.address,
    token: section.guid || section.token || section.authorization,
    certPath: cert && isAbsoluteFilePath(cert) ? cert : cert ? path.resolve(configDirectory, cert) : undefined
  };
};

export const readDirectVectorCredentials = async (
  options: DirectVectorCredentialReadOptions = {}
): Promise<DirectVectorCredentialResult> => {
  const env = options.env ?? process.env;
  const envResult = readEnvCredentials(env);
  if (envResult.ok) {
    return envResult;
  }

  const homeDir = options.homeDir ?? os.homedir();
  const exists = options.exists ?? existsSync;
  const fileReader = options.readFile ?? ((filePath: string) => readFile(filePath, "utf8"));
  const sdkConfigPath = [
    path.join(homeDir, ".anki_vector", "sdk_config.ini"),
    path.posix.join(homeDir.replace(/\\/g, "/"), ".anki_vector", "sdk_config.ini")
  ].find((candidate) => exists(candidate));

  if (!sdkConfigPath) {
    return envResult;
  }

  const configDirectory = path.dirname(sdkConfigPath);
  const configText = await fileReader(sdkConfigPath);
  const sections = parseIni(configText);
  const candidates = Object.entries(sections)
    .map(([sectionName, section]) => sectionToCredentials(sectionName, section, configDirectory))
    .filter((candidate) => Object.values(candidate).some(Boolean));
  const flatFields = parseFlatIniFields(configText);
  const firstSection = configText.match(/^\s*\[([^\]]+)\]/m)?.[1] || "default";
  const flatCandidate = sectionToCredentials(firstSection, flatFields, configDirectory);

  const configuredSerial = sanitizeRobotSerial(readEnvValue(env, ["VECTOR_DIRECT_SERIAL", "VECTOR_SERIAL", "VECTOR_SN"]));
  const completeCandidate = (candidate?: Partial<DirectVectorCredentials>) =>
    candidate && requiredFields.every((field) => Boolean(candidate[field]));
  const selected = configuredSerial
    ? candidates.find((candidate) => candidate.serial === configuredSerial) ??
      (completeCandidate(flatCandidate) ? flatCandidate : candidates[0])
    : candidates.find(completeCandidate) ??
      (completeCandidate(flatCandidate) ? flatCandidate : candidates[0] ?? flatCandidate);

  return completeCredentials(selected ?? {}, "sdk-config");
};
