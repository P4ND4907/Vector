import { Capacitor } from "@capacitor/core";

const APP_BACKEND_URL_STORAGE_KEY = "vector-control-hub-api-base-url";
const STORE_STORAGE_KEY = "vector-control-hub-store";
const DEFAULT_BACKEND_PORT = 8787;
const MOBILE_LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const isNativeCapacitorRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return Capacitor.isNativePlatform();
};

const shouldRejectNativeLoopbackBackend = (parsed: URL) =>
  isNativeCapacitorRuntime() &&
  !import.meta.env.VITE_API_BASE_URL?.trim() &&
  MOBILE_LOOPBACK_HOSTS.has(parsed.hostname);

const normalizeAppBackendUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    if (shouldRejectNativeLoopbackBackend(parsed)) {
      return "";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const readPersistedStoreBackendUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const raw = window.localStorage.getItem(STORE_STORAGE_KEY);
    if (!raw) {
      return "";
    }

    const parsed = JSON.parse(raw) as { state?: { settings?: { appBackendUrl?: string } } };
    return normalizeAppBackendUrl(parsed.state?.settings?.appBackendUrl ?? "");
  } catch {
    return "";
  }
};

export const getStoredAppBackendUrl = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const directValue = normalizeAppBackendUrl(
    window.localStorage.getItem(APP_BACKEND_URL_STORAGE_KEY) ?? ""
  );

  return directValue || readPersistedStoreBackendUrl();
};

export const persistAppBackendUrl = (value: string) => {
  if (typeof window === "undefined") {
    return "";
  }

  const normalized = normalizeAppBackendUrl(value);
  if (normalized) {
    window.localStorage.setItem(APP_BACKEND_URL_STORAGE_KEY, normalized);
  } else {
    window.localStorage.removeItem(APP_BACKEND_URL_STORAGE_KEY);
  }

  return normalized;
};

export const getDefaultAppBackendUrl = () => {
  if (typeof window === "undefined") {
    return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
  }

  if (isNativeCapacitorRuntime()) {
    return "";
  }

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    return `${window.location.protocol}//${window.location.hostname}:${DEFAULT_BACKEND_PORT}`;
  }

  return `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;
};

export const getResolvedAppBackendUrl = () =>
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  getStoredAppBackendUrl() ||
  getDefaultAppBackendUrl();

export const isMobileShellLikeRuntime = () => {
  if (typeof window === "undefined") {
    return false;
  }

  return isNativeCapacitorRuntime() || !window.location.protocol.startsWith("http");
};

export const mobileRuntimeNeedsManualBackendUrl = () =>
  isMobileShellLikeRuntime() &&
  !import.meta.env.VITE_API_BASE_URL?.trim() &&
  !getStoredAppBackendUrl();
