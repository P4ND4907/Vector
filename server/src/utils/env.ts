import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const loadLocalEnvFile = () => {
  const configuredCandidate = process.env.VECTOR_ENV_FILE?.trim();
  const candidates = [
    ...(configuredCandidate ? [configuredCandidate] : []),
    path.resolve(serverRoot, ".env.local"),
    path.resolve(serverRoot, "../.env.local"),
    path.resolve(process.cwd(), "server/.env.local"),
    path.resolve(process.cwd(), ".env.local")
  ];

  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }

    const contents = readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
};

export const buildEnv = () => {
  loadLocalEnvFile();

  return {
    port: Number(process.env.PORT ?? 8787),
    mode: process.env.NODE_ENV ?? "development",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    openaiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    supportEmail: process.env.SUPPORT_EMAIL ?? "",
    stripePaymentLinkPro: process.env.STRIPE_PAYMENT_LINK_PRO ?? "",
    stripePaymentLinkSetup: process.env.STRIPE_PAYMENT_LINK_SETUP ?? "",
    stripePaymentLinkStudio: process.env.STRIPE_PAYMENT_LINK_STUDIO ?? "",
    wirePodBaseUrl: process.env.WIREPOD_BASE_URL ?? "http://127.0.0.1:8080",
    wirePodTimeoutMs: Number(process.env.WIREPOD_TIMEOUT_MS ?? 4000),
    dataFilePath:
      process.env.VECTOR_DATA_FILE ??
      path.resolve(serverRoot, "data/vector-control-hub.local.json"),
    engineProvider: process.env.ENGINE_PROVIDER ?? "embedded"
  };
};
