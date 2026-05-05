/**
 * app/src/runtimeConfig.example.ts
 *
 * EXAMPLE FILE – for maintainer review only.
 *
 * This file is NOT imported anywhere. It shows how to extend the existing
 * app/src/config/runtimeConfig.ts to support additional runtime injection
 * scenarios, including:
 *   1. window.__APP_CONFIG__ – injected at runtime by the server (or nginx)
 *                               so the same Docker image can be re-configured
 *                               without a rebuild.
 *   2. VITE_API_BASE_URL     – compiled into the bundle at Vite build time
 *                               (standard approach for local dev / CI).
 *
 * The production implementation already lives in
 * app/src/config/runtimeConfig.ts – see that file for the canonical version.
 *
 * This file demonstrates an alternative shape that also exposes mockMode
 * through window.__APP_CONFIG__, useful when deploying a single Docker image
 * across multiple environments without rebuilding.
 *
 * Server / nginx injection example (runtime config script tag):
 *   <script>
 *     window.__APP_CONFIG__ = {
 *       apiBaseUrl: "http://server:8787",
 *       mockMode: false
 *     };
 *   </script>
 *
 * See also: server/src/wirepodShim.ts (WIREPOD_MODE proxy|mock|direct)
 */

// ── Runtime config shape ──────────────────────────────────────────────────────

export interface AppRuntimeConfig {
  /** Base URL used for all /api/* fetch calls from the frontend. */
  apiBaseUrl: string;
  /**
   * When true the app runs without a real robot or WirePod connection.
   * Requests that would fail silently return mock data instead.
   */
  mockMode: boolean;
}

// ── Config reader (example) ───────────────────────────────────────────────────

/**
 * Example of how to resolve runtime configuration from multiple sources.
 *
 * Priority order (highest → lowest):
 *   1. window.__APP_CONFIG__  (injected at runtime – best for Docker)
 *   2. VITE_API_BASE_URL / VITE_MOCK_MODE  (compiled at build time)
 *   3. Hard-coded defaults  (localhost:8787, mockMode=false)
 *
 * NOTE: The production implementation is in app/src/config/runtimeConfig.ts.
 * This function shows how to add mockMode support to the injected config.
 */
export function getRuntimeConfig(): AppRuntimeConfig {
  // window.__APP_CONFIG__ is declared in app/src/config/runtimeConfig.ts.
  // Cast to extended shape when a runtime injector also provides mockMode.
  const injected =
    typeof window !== "undefined"
      ? (window.__APP_CONFIG__ as { apiBaseUrl?: string; mockMode?: boolean } | undefined)
      : undefined;

  const apiBaseUrl =
    injected?.apiBaseUrl?.trim() ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    "http://localhost:8787";

  const mockMode =
    injected?.mockMode ??
    (typeof import.meta.env.VITE_MOCK_MODE === "string"
      ? import.meta.env.VITE_MOCK_MODE === "true"
      : false);

  return { apiBaseUrl, mockMode };
}
