# Architecture

## System Overview

```
User
  └─► Vector Control Hub (React frontend)
        └─► Express backend (Node.js)
              └─► Engine provider (wirepod | mock | embedded*)
                    └─► Vector robot
```

The frontend never talks directly to WirePod or the robot. All robot communication is owned by the backend, behind the engine provider abstraction.

---

## Provider-Based Engine Architecture

The backend uses a provider pattern so the communication layer is swappable without touching the rest of the app.

**File:** `server/src/engine/types.ts`

```ts
export type EngineProviderName = "embedded" | "wirepod" | "mock";

export interface EngineProviderStatus {
  provider: EngineProviderName;
  available: boolean;
  connected: boolean;
  note: string;
  protocolGaps: string[];
}

export interface EngineSettings {
  activeProvider: EngineProviderName;
  wirepodBaseUrl: string;
  wirepodTimeoutMs: number;
  autoFallback: boolean;
}
```

`EngineManager` (`server/src/engine/engineManager.ts`) holds provider instances in a `Map`, creating them lazily. Switching providers at runtime is instant; the old provider instance is preserved in the map and reused if you switch back.

### wirepod (default, recommended)

Routes robot calls through a locally running [WirePod](https://github.com/kercre123/wire-pod) server. Default URL: `http://127.0.0.1:8080`. The URL and timeout are configurable via `/api/engine/settings`.

### mock

Returns simulated responses without a real robot. Useful for UI development, screenshots, and demos. All status fields report plausible fake values.

### embedded ⚠️ not yet implemented

The embedded provider exists in the codebase as a stub and is **disabled in the UI** (shown as "Coming soon"). The intention is direct SDK-level robot communication without WirePod as a middleman, but the transport layer has not been built yet. The provider correctly documents its own `protocolGaps` so the status endpoint is honest about what is missing.

---

## API Route Organization

All routes are mounted under `/api` in the Express app.

| Prefix | Purpose |
|---|---|
| `/api/engine/*` | Engine provider management |
| `/api/robot/*` | Robot control (drive, speak, status, camera, etc.) |
| `/api/license/*` | Local license activation and status |

### `/api/engine/*`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/engine/status` | Active provider status |
| `GET` | `/api/engine/providers` | Status of all three providers |
| `POST` | `/api/engine/provider` | Switch active provider (`{ provider: "wirepod" \| "mock" \| "embedded" }`) |
| `GET` | `/api/engine/settings` | Current engine settings |
| `POST` | `/api/engine/settings` | Patch engine settings (URL, timeout, autoFallback) |

### `/api/license/*`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/license/status` | Current tier and feature list |
| `POST` | `/api/license/activate` | Activate with a license key |

---

## Local Licensing

Licensing is entirely offline. There is no Stripe integration, no external server, and no internet call during activation.

- License data is stored in a local JSON file: `vector-license.local.json` (next to the main data file)
- A key starting with `PRO-` activates the pro tier; anything else stays on free
- The backend reads this file on every `/api/license/status` request
- Features are returned as a plain list of strings so the frontend can gate UI accordingly

**Pro features:** `advanced_automation`, `premium_personality_packs`, `repair_tools_advanced`, `priority_support`, `no_ads`

**Free features:** `basic_controls`, `diagnostics`, `voice_commands`, `routines`, `camera`

---

## Data Storage

All persistent state is local JSON on disk:

| File | Contents |
|---|---|
| `vector-data.local.json` (or similar) | Robot settings, routines, saved state |
| `vector-license.local.json` | License tier and activation timestamp |

No database is required. The backend reads and writes these files directly using Node.js `fs`.

---

## Frontend

**Stack:** React 18, TypeScript, Vite, Tailwind CSS, Zustand

### State management

Global app state lives in a single Zustand store (`app/src/store/useAppStore.ts`). The store holds robot status, settings, support reports, action states, and UI flags.

### Key hooks

| Hook | Purpose |
|---|---|
| `useEngineStatus` | Polls `/api/engine/status`, returns `{ connected, loading, refresh }` |
| `useLicense` | Fetches `/api/license/status`, exposes tier and feature flags |

### Pages

| Page | Path |
|---|---|
| Dashboard | `/` |
| Engine settings | `/settings/engine` |
| Repair tools | `/repair` |
| Diagnostics | `/diagnostics` |
| Routines | `/routines` |
| Camera / Photos | `/camera` |
| AI commands | `/ai` |
| Settings | `/settings` |

Onboarding is rendered on top of the normal app when `localStorage.getItem("vector_onboarding_complete")` is falsy.

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| State | Zustand |
| UI components | Radix UI primitives, Lucide icons |
| Backend | Node.js, Express, TypeScript |
| Validation | Zod |
| Local bridge | WirePod (via HTTP) |
| Desktop packaging | Electron (Windows) |
| Mobile shell | Capacitor (Android, `app/android`) |
| Container | Docker Compose |
| CI | GitHub Actions |
