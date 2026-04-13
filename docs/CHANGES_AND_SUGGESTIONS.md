# Changes and Suggestions – Vector Control Hub

This document summarises every change introduced in the
`feature/packaging/docker-electron-ci` PR, the rationale behind each decision,
and a prioritised list of suggested next steps for the maintainers.

---

## 1. Files Added

| Path | Purpose |
|---|---|
| `docker-compose.yml` | Orchestrates wirepod + server + frontend as Docker services |
| `server/Dockerfile` | Multi-stage image: TypeScript build → slim Node runtime |
| `app/Dockerfile` | Multi-stage image: Vite build → nginx static server |
| `app/docker/nginx.conf` | nginx config serving SPA on port 4173 |
| `scripts/install-windows.ps1` | PowerShell helper for Windows Docker-based setup |
| `README.quickstart-docker.md` | End-user Docker quick-start guide |
| `docs/CHANGES_AND_SUGGESTIONS.md` | This file |
| `.github/workflows/ci.yml` | PR-level CI: typecheck + test + Docker build (no publish) |
| `.github/workflows/ci-docker.yml` | Tag/release CI: build and push images to GHCR |
| `.github/workflows/ci-electron.yml` | Release CI: build Windows Electron installer (draft) |
| `packaging/electron/package.json` | Electron app workspace scripts |
| `packaging/electron/electron-main.ts` | Electron main process – spawns server, loads UI |
| `packaging/electron/electron-builder.yml` | electron-builder config (NSIS Windows installer) |
| `scripts/build-electron.sh` | Local Electron build helper |
| `server/.env.local.example` | Extended env variable reference (updated) |
| `app/src/config/runtimeConfig.ts` | Runtime API base URL override without rebuild |
| `server/src/index.improvements.ts` | Improved server: logging, validation, graceful shutdown |
| `app/src/App.improvements.tsx` | Improved App: offline indicator, safer init |

### Files Modified

| Path | Change |
|---|---|
| `package.json` (root) | Added `test:ui`, `test:coverage`, `format`, `format:check`, `docker:up`, `docker:down` scripts |
| `README.md` | Added "Get started with Docker" section |

---

## 2. Docker Bundle

### Rationale

The original project requires Node.js LTS, WirePod locally installed, and a
Windows PowerShell launcher. This works well for developers but creates
friction for end-users. The Docker bundle reduces the required installs to
**Docker Desktop only**.

### Architecture

```
[Docker Compose]
  ├── wirepod      (kercre123/wire-pod:latest)  port 8080, 8070
  ├── server       (built from ./server)         port 8787
  └── frontend     (built from ./app → nginx)    port 4173
```

### Notable design choices

- **Multi-stage Dockerfiles** keep final images small: the build tools
  (TypeScript compiler, Vite) are discarded before the runtime image is
  produced.
- **Build-arg `VITE_API_BASE_URL`** lets users point the frontend at a remote
  server without a rebuild (useful for LAN deployments from a phone).
- **Build-arg `VITE_MOCK_MODE`** enables the existing Mock Mode without
  needing a robot or WirePod container running.
- Persistent volumes (`wirepod-data`, `server-data`) keep state across
  container restarts.

### Security considerations

- No secrets are baked into images. API keys are passed at runtime via
  environment variables or a `.env` file that is gitignored.
- The WirePod container is community-maintained; review its image for your
  threat model before deploying to a network-accessible host.
- The nginx image is pinned to a minor version (`nginx:1.27-alpine`) rather
  than `latest` to reduce surprise breakage.

---

## 3. CI Workflows

### `.github/workflows/ci.yml` (PR CI)

Runs on every PR to `main`:

1. Install dependencies (`npm ci`)
2. Typecheck app workspace (`tsc --noEmit`)
3. Typecheck server workspace (`tsc --noEmit`)
4. Run server tests (`npm test --workspace server`)
5. Build Docker images (without pushing) to catch Dockerfile errors early

**No secrets required.** Docker images are built but never pushed.

### `.github/workflows/ci-docker.yml` (Image publish)

Runs on pushed tags matching `v*.*.*` and published GitHub Releases.

1. Builds `server` and `frontend` Docker images
2. Tags them as `ghcr.io/p4nd4907/vector-server:<tag>` and
   `ghcr.io/p4nd4907/vector-frontend:<tag>`
3. Pushes to GitHub Container Registry (GHCR)

**Requires secret:** `GITHUB_TOKEN` (automatically available in Actions) is
used by `docker/login-action`. No additional secret is needed for GHCR with
the default token.

**Opt-in:** The publish step is gated on `github.event_name != 'pull_request'`
so it never runs on PRs.

### `.github/workflows/ci-electron.yml` (Electron installer, draft)

Runs on GitHub Release publication.

1. Builds the Vite frontend
2. Builds the TypeScript server
3. Runs `electron-builder` to produce an NSIS Windows installer

**Code signing is NOT included.** Windows will show an "unknown publisher"
SmartScreen warning. To add signing, see the note in the workflow file and
refer to `electron-builder` docs for `win.certificateFile`.

---

## 4. Electron Packaging Skeleton

`packaging/electron/` contains a minimal Electron wrapper that:

- Spawns the compiled server (`server/dist/index.js`) as a child process
- Waits for the server to be ready (health-check loop)
- Loads `app/dist` in a `BrowserWindow`
- Implements single-instance lock (one app window at a time)
- Gracefully shuts down the server child process on quit

This is a **skeleton** – it is not wired into the main build pipeline.
To adopt it, copy the files into the root workspace and run
`scripts/build-electron.sh`.

---

## 5. Runtime Config (`app/src/config/runtimeConfig.ts`)

The static frontend build bakes `VITE_API_BASE_URL` in at build time.  
On a Docker-served deployment, this means the URL must be correct at build
time or the app cannot reach the API.

`runtimeConfig.ts` adds a two-level override:

1. **`window.__APP_CONFIG__.apiBaseUrl`** – injected by the server or a
   reverse proxy at request time (no rebuild needed)
2. **`import.meta.env.VITE_API_BASE_URL`** – original build-time value
   (fallback)
3. **`http://localhost:8787`** – final hardcoded fallback

This allows operators to deploy one Docker image and configure the API URL at
runtime by serving a small config snippet from nginx or the backend.

---

## 6. Improvement Example Files

Rather than modifying the stable runtime files, improvements are provided as
`.improvements.*` files for maintainer review:

### `server/src/index.improvements.ts`

Key additions over `index.ts`:

- **Request logging middleware** – logs method, path, status, and duration
- **Input length validation** on `/vector/speak` (max 1 000 characters)
- **Richer health response** – includes `uptime`, `timestamp`, and `version`
- **Graceful SIGTERM/SIGINT shutdown** – closes the HTTP server cleanly

### `app/src/App.improvements.tsx`

Key additions over `App.tsx`:

- **Offline indicator** – shows a banner when `navigator.onLine` is false
- Wraps `initialize()` in a try/catch with console.error logging

---

## 7. Suggested Next Steps (Prioritised)

### High priority

1. **Enable Mock Mode by default for new users**  
   New users without a robot currently see errors on first load. Default
   `VITE_MOCK_MODE=true` (or detect absence of WirePod and auto-switch).

2. **Adopt `index.improvements.ts`**  
   The logging and validation changes are low-risk and improve
   observability significantly. Review and merge.

3. **Adopt `App.improvements.tsx` offline indicator**  
   The offline banner prevents confusion when users lose network/WirePod
   connectivity mid-session.

4. **Pin Docker images in `docker-compose.yml`**  
   Replace `kercre123/wire-pod:latest` with a specific digest or version
   tag to prevent surprise breakage on upstream changes.

### Medium priority

5. **Add end-to-end tests**  
   The existing test suite covers the command engine. Add Playwright or
   Vitest browser tests for the most critical UI flows (connect, speak,
   mock mode toggle).

6. **Add response caching for WirePod status**  
   The `/vector/status` endpoint calls WirePod on every request. Add a
   short in-memory cache (1–2 s TTL) to reduce WirePod load.

7. **Implement runtime config injection in nginx**  
   Serve `/config.js` from nginx that sets `window.__APP_CONFIG__` so
   operators can reconfigure the API URL without rebuilding the image.
   See `app/src/config/runtimeConfig.ts` for the client-side contract.

8. **Electron code signing**  
   The NSIS installer is unsigned. Windows SmartScreen will warn users.
   Obtain an EV code-signing certificate and configure `electron-builder`
   `win.certificateFile` / `win.certificatePassword`.

### Low priority / Nice to have

9. **Dependabot for Docker base images**  
   Add a `docker` entry to `.github/dependabot.yml` to get automated
   PRs for base image updates.

10. **Health check in `docker-compose.yml`**  
    Add `healthcheck:` blocks to the server and frontend services so
    Docker Compose waits for them to be ready before starting dependents.

11. **`.dockerignore` files**  
    Add `.dockerignore` to `server/` and `app/` to exclude `node_modules`,
    `dist`, and test files from the build context, speeding up builds.

12. **Publish frontend image to GHCR**  
    The `ci-docker.yml` workflow already builds the frontend image.
    Uncomment the push step once a registry namespace is confirmed.

---

## 8. Rollout Plan

| Phase | Action |
|---|---|
| Now | Merge Docker files + CI; let contributors test with Docker |
| Sprint 1 | Review and adopt improvement files; enable default Mock Mode |
| Sprint 2 | Add Electron code signing; publish first Docker images to GHCR |
| Sprint 3 | End-to-end tests; dependabot; runtime config injection |
| Future | Full Electron packaging with auto-update (Squirrel or electron-updater) |

---

*This document was generated as part of the Docker + CI + Electron packaging PR.
Update it as the project evolves.*
