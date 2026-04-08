import { Capacitor, CapacitorHttp, type HttpResponse } from "@capacitor/core";
import { getResolvedAppBackendUrl, isMobileShellLikeRuntime } from "@/lib/runtime-target";

export const getApiBaseUrl = () => getResolvedAppBackendUrl();
const MAX_NATIVE_HTTP_CONCURRENCY = 2;
const NATIVE_HTTP_CONNECT_TIMEOUT_MS = 3_000;
const NATIVE_HTTP_READ_TIMEOUT_MS = 8_000;

export interface ApiRequestOptions {
  connectTimeoutMs?: number;
  readTimeoutMs?: number;
  timeoutMs?: number;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly kind: "http" | "network",
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export const isNetworkError = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError && error.kind === "network";

const readPayload = async <T,>(response: Response): Promise<T | { message?: string }> => {
  try {
    return (await response.json()) as T | { message?: string };
  } catch {
    return {} as { message?: string };
  }
};

const readNativePayload = <T,>(response: HttpResponse): T | { message?: string } => {
  const payload = response.data;

  if (typeof payload === "string") {
    try {
      return JSON.parse(payload) as T | { message?: string };
    } catch {
      return {} as { message?: string };
    }
  }

  if (payload && typeof payload === "object") {
    return payload as T | { message?: string };
  }

  return {} as { message?: string };
};

export const readJson = async <T,>(response: Response, fallbackMessage = "Request failed."): Promise<T> => {
  const payload = await readPayload<T>(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : fallbackMessage;
    throw new ApiClientError(message, "http", response.status);
  }
  return payload as T;
};

const readNativeJson = <T,>(response: HttpResponse, fallbackMessage = "Request failed."): T => {
  const payload = readNativePayload<T>(response);
  if (response.status < 200 || response.status >= 300) {
    const message =
      typeof payload === "object" && payload && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : fallbackMessage;
    throw new ApiClientError(message, "http", response.status);
  }
  return payload as T;
};

const getRequestUrl = (path: string, fallbackMessage?: string) => {
  const baseUrl = getApiBaseUrl().trim();
  if (baseUrl) {
    return `${baseUrl}${path}`;
  }

  throw new ApiClientError(
    fallbackMessage ??
      (isMobileShellLikeRuntime()
        ? "Save the desktop backend URL in Settings first."
        : "Request failed."),
    "network"
  );
};

const shouldUseNativeHttp = () => Capacitor.isNativePlatform();
let nativeHttpActiveCount = 0;
const nativeHttpWaiters: Array<() => void> = [];
const nativeHttpInflightGets = new Map<string, Promise<HttpResponse>>();

const resolveConnectTimeout = (options?: ApiRequestOptions) =>
  options?.connectTimeoutMs ?? options?.timeoutMs ?? NATIVE_HTTP_CONNECT_TIMEOUT_MS;

const resolveReadTimeout = (options?: ApiRequestOptions) =>
  options?.readTimeoutMs ?? options?.timeoutMs ?? NATIVE_HTTP_READ_TIMEOUT_MS;

const fetchWithOptionalTimeout = async (input: RequestInfo | URL, init: RequestInit, options?: ApiRequestOptions) => {
  const timeoutMs = options?.timeoutMs ?? options?.readTimeoutMs;

  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const acquireNativeHttpSlot = async () => {
  if (!shouldUseNativeHttp()) {
    return () => {};
  }

  if (nativeHttpActiveCount >= MAX_NATIVE_HTTP_CONCURRENCY) {
    await new Promise<void>((resolve) => {
      nativeHttpWaiters.push(resolve);
    });
  }

  nativeHttpActiveCount += 1;

  return () => {
    nativeHttpActiveCount = Math.max(0, nativeHttpActiveCount - 1);
    nativeHttpWaiters.shift()?.();
  };
};

const withNativeHttp = async (
  key: string | null,
  request: () => Promise<HttpResponse>
) => {
  if (key) {
    const existing = nativeHttpInflightGets.get(key);
    if (existing) {
      return existing;
    }
  }

  const pending = (async () => {
    const release = await acquireNativeHttpSlot();
    try {
      return await request();
    } finally {
      release();
      if (key) {
        nativeHttpInflightGets.delete(key);
      }
    }
  })();

  if (key) {
    nativeHttpInflightGets.set(key, pending);
  }

  return pending;
};

export const getJson = async <T,>(path: string, fallbackMessage?: string, options?: ApiRequestOptions) => {
  try {
    const url = getRequestUrl(path, fallbackMessage);
    if (shouldUseNativeHttp()) {
      const response = await withNativeHttp(`GET:${url}`, () =>
        CapacitorHttp.get({
          url,
          responseType: "json",
          connectTimeout: resolveConnectTimeout(options),
          readTimeout: resolveReadTimeout(options)
        })
      );
      return readNativeJson<T>(response, fallbackMessage);
    }

    const response = await fetchWithOptionalTimeout(url, {}, options);
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};

export const postJson = async <T,>(path: string, body?: unknown, fallbackMessage?: string, options?: ApiRequestOptions) => {
  try {
    const url = getRequestUrl(path, fallbackMessage);
    if (shouldUseNativeHttp()) {
      const response = await withNativeHttp(null, () =>
        CapacitorHttp.post({
          url,
          headers: body === undefined ? undefined : { "Content-Type": "application/json" },
          data: body,
          responseType: "json",
          connectTimeout: resolveConnectTimeout(options),
          readTimeout: resolveReadTimeout(options)
        })
      );
      return readNativeJson<T>(response, fallbackMessage);
    }

    const response = await fetchWithOptionalTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    }, options);
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};

export const patchJson = async <T,>(path: string, body: unknown, fallbackMessage?: string, options?: ApiRequestOptions) => {
  try {
    const url = getRequestUrl(path, fallbackMessage);
    if (shouldUseNativeHttp()) {
      const response = await withNativeHttp(null, () =>
        CapacitorHttp.patch({
          url,
          headers: { "Content-Type": "application/json" },
          data: body,
          responseType: "json",
          connectTimeout: resolveConnectTimeout(options),
          readTimeout: resolveReadTimeout(options)
        })
      );
      return readNativeJson<T>(response, fallbackMessage);
    }

    const response = await fetchWithOptionalTimeout(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }, options);
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};

export const deleteJson = async <T,>(path: string, fallbackMessage?: string, options?: ApiRequestOptions) => {
  try {
    const url = getRequestUrl(path, fallbackMessage);
    if (shouldUseNativeHttp()) {
      const response = await withNativeHttp(null, () =>
        CapacitorHttp.delete({
          url,
          responseType: "json",
          connectTimeout: resolveConnectTimeout(options),
          readTimeout: resolveReadTimeout(options)
        })
      );
      return readNativeJson<T>(response, fallbackMessage);
    }

    const response = await fetchWithOptionalTimeout(url, {
      method: "DELETE"
    }, options);
    return readJson<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof ApiClientError) {
      throw error;
    }
    throw new ApiClientError(fallbackMessage ?? "Request failed.", "network");
  }
};
