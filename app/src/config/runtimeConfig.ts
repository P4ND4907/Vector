/**
 * app/src/config/runtimeConfig.ts
 *
 * Resolves the API base URL at runtime with a three-level priority:
 *
 *   1. window.__APP_CONFIG__.apiBaseUrl  – injected by the server or nginx
 *      at request time (allows reconfiguring without rebuilding the image).
 *
 *   2. import.meta.env.VITE_API_BASE_URL – set as a Vite build arg
 *      (default when building via Docker Compose).
 *
 *   3. "http://localhost:8787"           – hard-coded fallback for local dev.
 *
 * Usage example (how to inject at runtime from nginx):
 *
 *   # nginx.conf – serve a small config.js before the app bundle
 *   location = /config.js {
 *     add_header Content-Type application/javascript;
 *     return 200 'window.__APP_CONFIG__ = { apiBaseUrl: "$API_BASE_URL" };';
 *   }
 *
 *   # In index.html – load before the app bundle:
 *   <script src="/config.js"></script>
 *
 * Mock Mode:
 *
 *   Pass VITE_MOCK_MODE=true at build time or append ?mock=true to the URL:
 *     http://localhost:4173?mock=true
 *   The app reads this value in useMockMode() (app/src/hooks/).
 */

declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

function resolveApiBaseUrl(): string {
  // 1. Runtime injection (e.g., from nginx or a config endpoint)
  const runtimeUrl = window.__APP_CONFIG__?.apiBaseUrl;
  if (runtimeUrl && runtimeUrl.trim() !== "") {
    return runtimeUrl.trim();
  }

  // 2. Build-time Vite environment variable
  const buildTimeUrl = import.meta.env.VITE_API_BASE_URL;
  if (buildTimeUrl && buildTimeUrl.trim() !== "") {
    return buildTimeUrl.trim();
  }

  // 3. Hardcoded local fallback
  return "http://localhost:8787";
}

function isMockMode(): boolean {
  // Check URL query string first (?mock=true)
  const params = new URLSearchParams(window.location.search);
  if (params.get("mock") === "true") {
    return true;
  }
  // Then check localStorage for a persisted preference
  if (localStorage.getItem("vectorMockMode") === "true") {
    return true;
  }
  // Finally check the Vite build-time flag
  return import.meta.env.VITE_MOCK_MODE === "true";
}

export const runtimeConfig = {
  apiBaseUrl: resolveApiBaseUrl(),
  mockMode:   isMockMode(),
} as const;

export type RuntimeConfig = typeof runtimeConfig;
