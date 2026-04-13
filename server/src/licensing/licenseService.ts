import type { LicenseRecord, LicenseTier, LicenseStore } from "./licenseStore.js";

export interface LicenseStatus {
  active: boolean;
  tier: LicenseTier;
  key?: string;
  email?: string;
  activatedAt?: string;
  expiresAt?: string;
  note: string;
}

export interface LicenseActivateResult {
  success: boolean;
  tier: LicenseTier;
  key: string;
  email?: string;
  activatedAt: string;
  note: string;
}

/**
 * Minimal offline license validation.
 *
 * Key format (for testing / self-hosted deployments):
 *   VCH-PRO-<alphanumeric 12 chars>
 *
 * Any key that matches that prefix is accepted as a pro key.
 * A real deployment would verify a HMAC signature or call a
 * license server, but this keeps the feature fully local-first.
 */
const PRO_KEY_RE = /^VCH-PRO-[A-Z0-9]{12}$/i;

const resolveTier = (key: string): LicenseTier =>
  PRO_KEY_RE.test(key.trim()) ? "pro" : "free";

export const createLicenseService = (store: LicenseStore) => {
  const getStatus = (): LicenseStatus => {
    const record = store.read();
    if (!record || !record.key) {
      return {
        active: false,
        tier: "free",
        note: "No license key activated. Running on the free tier."
      };
    }

    const now = new Date();
    if (record.expiresAt && new Date(record.expiresAt) < now) {
      return {
        active: false,
        tier: "free",
        key: record.key,
        email: record.email,
        activatedAt: record.activatedAt,
        expiresAt: record.expiresAt,
        note: "License key has expired. Reverted to the free tier."
      };
    }

    return {
      active: true,
      tier: record.tier,
      key: record.key,
      email: record.email,
      activatedAt: record.activatedAt,
      expiresAt: record.expiresAt,
      note:
        record.tier === "pro"
          ? "Pro license is active. All Pro features are unlocked."
          : "Free license is active."
    };
  };

  const activate = (key: string, email?: string): LicenseActivateResult => {
    const trimmedKey = key.trim();
    if (!trimmedKey) {
      return {
        success: false,
        tier: "free",
        key: "",
        activatedAt: new Date().toISOString(),
        note: "License key must not be empty."
      };
    }

    const tier = resolveTier(trimmedKey);
    const now = new Date().toISOString();
    const record: LicenseRecord = {
      key: trimmedKey,
      tier,
      activatedAt: now,
      email: email?.trim() || undefined
    };

    store.write(record);

    return {
      success: true,
      tier,
      key: trimmedKey,
      email: record.email,
      activatedAt: now,
      note:
        tier === "pro"
          ? "Pro license activated. All Pro features are now unlocked."
          : "License key accepted but does not match the Pro key format. Running on the free tier."
    };
  };

  const isProActive = (): boolean => {
    const status = getStatus();
    return status.active && status.tier === "pro";
  };

  return { getStatus, activate, isProActive };
};

export type LicenseService = ReturnType<typeof createLicenseService>;
