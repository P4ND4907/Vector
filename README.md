# Vector Control Hub

![Status](https://img.shields.io/badge/status-active-66e3d2)
![Local First](https://img.shields.io/badge/data-local--first-1d7f5f)
![Platform](https://img.shields.io/badge/platform-Windows-4f8cff)
![License](https://img.shields.io/badge/license-MIT-5cb85c)

Vector Control Hub is a local-first dashboard for the Anki / DDL Vector robot.

It exists to make Vector easier to use day-to-day: one app for connection, drive controls, speech, diagnostics, routines, AI command previews, and camera/photo tools, with WirePod staying in the background as the local bridge.

## At A Glance

- Built for normal users, not just script-heavy setups
- Keeps robot control local on your machine
- Uses WirePod as the backend bridge instead of replacing it
- Includes Mock Mode so the app still works without a robot
- Runs as a Windows-first local app with a one-click starter

## Project Status

This project is active and usable, but still evolving.

- Core local dashboard flow works
- First-run onboarding now handles the easy local WirePod setup inside the app
- Mock mode is available for testing without a robot
- WirePod is still required as the local backend bridge
- Some advanced features are still being refined
- Current public-testing focus: stable local control, honest status, and an easier first-time setup path

## Release Path

This project now has a Phase 1 Windows release path.

- Source download: good for advanced users and local testing
- GitHub Release installer: the intended path for normal Windows testers
- Long-term goal: one app experience with fewer separate setup steps

Phase roadmap:

- [Phase plan](./docs/PHASES.md)
- [Release steps](./docs/RELEASING.md)

## Why This App Exists

Vector owners often end up bouncing between multiple tools:

- local setup pages
- robot control pages
- diagnostics pages
- scripts or curl commands

This app is meant to reduce that friction. The goal is a single control center that feels approachable for normal users, not just developers.

## Main Features

- Auto-detects local WirePod endpoints
- Connects to Vector through a local backend
- Shows live robot status
- Drive, wake, dock, volume, head, and lift controls
- AI command preview and execution
- Diagnostics and log viewer
- Local routine storage
- Camera/photo capture and sync
- Mock mode for testing when the robot stack is unavailable

## Screenshots

Add these screenshots before a public post:

| Screen | Suggested filename | Notes |
| --- | --- | --- |
| Startup connection | `docs/screenshots/startup-connect.png` | Show a calm ready-to-connect state |
| Main dashboard | `docs/screenshots/dashboard-connected.png` | Use a clean connected robot state |
| Controls | `docs/screenshots/controls-live.png` | Show large touch-friendly controls |
| AI commands | `docs/screenshots/ai-commands.png` | Include preview and result feedback |
| Diagnostics | `docs/screenshots/diagnostics.png` | Show honest health messaging |
| Camera | `docs/screenshots/camera.png` | Use either synced photos or an empty state |

Tip: use one clean connected state and one honest offline state.

The `docs/screenshots/` folder is already in the repo so these paths can be dropped in directly.

## How It Works

Architecture:

`User -> Vector Control Hub app -> local backend -> local WirePod -> Vector`

Important:

- This app does **not** replace WirePod
- This app is designed so WirePod stays mostly invisible after setup
- The frontend does **not** talk directly to random local endpoints; the backend owns the WirePod communication layer

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand
- Backend: Node.js, Express, Zod
- Local bridge: WirePod
- Packaging path: PWA-first, with Capacitor-ready frontend structure

## Privacy And Safety

By default, this project is local-first.

What stays local:

- robot status polling
- local connection settings
- saved routines
- local logs
- local photo sync data

What may go to an external API:

- OpenAI routine drafting or AI assistance, **only if you add your own `OPENAI_API_KEY`**

What you should never do:

- never commit `.env.local`
- never paste secret keys into frontend code
- never share a zip of this project without checking whether local config files are inside it

## Requirements

- Windows with Node.js LTS installed
- WirePod installed locally if you want real robot control
- A Vector robot already authenticated with your local WirePod setup for the smoothest experience

## Quick Start

### Best Download Option

If you just want to try the app on Windows, use a GitHub Release build when one is available.

If you are downloading the source code directly from GitHub instead:

- install Node.js 20+
- extract the repo
- double-click `start-app.bat`

### Easiest Launch

Use:

- `start-app.bat`

After code changes or local updates, use:

- `refresh-app.bat`

Compatibility launcher:

- `Launch-Vector-Control-Hub.bat`

Both launchers call the same PowerShell script and do only visible, local startup work:

- verify Node.js is installed
- install dependencies if missing
- build the project if needed
- start the local backend
- start the local static app server
- open the app window

### Manual Install

```bash
npm install
```

### Windows Installer Build

To build the Windows installer and portable app locally:

```bash
npm run release:windows
```

That writes installer files to:

```text
dist-electron/
```

## Environment Setup

### Frontend

Optional override file:

- `.env.example`

This is only for hosted or unusual frontend setups.

Normal local use does not require changing it.

### Backend

Copy:

```text
server/.env.local.example -> server/.env.local
```

Then update values as needed:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `WIREPOD_BASE_URL`
- `WIREPOD_TIMEOUT_MS`

Important:

- `server/.env.local` is for local development only
- it must never be committed
- keep secrets in backend env files only

## Run Instructions

### Start everything locally

```bash
npm start
```

### Frontend only

```bash
npm run dev:app
```

### Backend only

```bash
npm run dev:server
```

## Build Instructions

### Full build

```bash
npm run build
```

### Typecheck / lint-style validation

```bash
npm run typecheck
npm run lint
```

### Preview the built app

```bash
npm run preview
```

## First-Time Connection Flow

For a normal user, the intended path is:

1. Start WirePod locally
2. Launch Vector Control Hub
3. Keep Mock Mode off
4. If needed, use `Finish local setup automatically` on the startup screen
5. If the robot has never been paired to WirePod, use `Open robot pairing portal` once for the one-time robot handshake
6. Scan or reconnect to the saved robot
7. Open the dashboard once Vector answers

After that, most daily use should happen in this app.

## Demo / Fallback Mode

If WirePod or the robot is unavailable, the app can still run in Mock Mode.

Mock Mode is useful for:

- UI testing
- screenshots
- demoing the flow
- developing without a live robot

If no OpenAI key is present:

- the app should not crash
- local rule-based command parsing still works for simple AI command flows
- OpenAI-only features stay unavailable with calm messaging

## Project Structure

```text
vector-control-hub/
  app/                React frontend
  server/             Express backend
  scripts/            local helper scripts
  start-app.bat       simple Windows launcher
  Launch-Vector-Control-Hub.ps1
  README.md
  SECURITY.md
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md
  LICENSE
```

## Helper Scripts

### `start-app.bat`

Windows-friendly launcher that starts the local app stack.

### `Launch-Vector-Control-Hub.ps1`

Main launcher script used by the `.bat` wrappers.

### `scripts/serve-static-app.mjs`

Small local static file server used for the built frontend.

## GitHub Releases

This repo includes GitHub Actions workflows for:

- validating the app on pushes and pull requests
- building Windows release artifacts on demand
- attaching Windows artifacts to tagged GitHub Releases

If you want to publish a new Windows release, see:

- [docs/RELEASING.md](./docs/RELEASING.md)

## Troubleshooting

### The app says "Vector brain offline"

Check:

1. WirePod is running on this computer
2. Vector and this computer are on the same local network
3. Mock Mode is off
4. The saved serial is correct

### AI page says assistance is unavailable

That usually means `OPENAI_API_KEY` is missing or invalid.

The app should still allow simple local command preview rules without crashing.

### The robot reacts but does not drive

Check whether Vector is still on the charger. Some movement commands can appear limited while docked.

### The robot shows "Docked" but does not keep charging

Check:

1. Vector is seated cleanly on the charger
2. the charger pins and Vector foot contacts are clean
3. the app is not being used to wake or drive the robot while it is trying to charge

The app now blocks most wake, movement, photo, and animation actions while charging protection is on, but a weak dock contact or aging battery can still cause real hardware charging problems.

### Weather command works in the app but not from "Hey Vector"

Wake-word weather still depends on a real weather API being configured for WirePod.

You can now configure that from inside the app in `Settings -> Voice weather setup`.

### Camera page shows no photos

Ask Vector to take a photo, then open `Photos` and use `Retrieve latest photo` or `Sync saved photos`.

## FAQ

### Do I need WirePod?

Yes, for real local Vector control today.

### Does this app replace WirePod?

No. It sits on top of WirePod and is meant to become the everyday UI.

### Does this app send robot data to the cloud?

Not by default. Most robot control stays local. Optional OpenAI features require your own key.

### Is Mock Mode required?

No. It is optional and should only be used when you want a fallback or demo path.

## Known Limitations

- Some advanced roam automation behavior is still being refined
- Speech and audio behavior may vary depending on the local Vector and WirePod setup
- Advanced vision and object detection are not finished yet
- This repo is currently Windows-first in its helper scripts
- Real robot control still depends on local WirePod in Phase 1
- Live battery updates currently use fast polling, not a true push/socket stream
- Some classic or community-style commands still use partial implementations or safe fallbacks
- On-robot weather visuals are best when WirePod weather is configured; otherwise the app falls back to a simpler robot-side cue plus spoken forecast
- Docking and charging stability can still be affected by physical charger contact or battery health, which software alone cannot fully fix

## Public Sharing Checklist

Before publishing:

1. Make sure `server/.env.local` is not included
2. Confirm no secrets are in screenshots
3. Add screenshots to this README
4. Verify the launcher still works on a clean machine
5. Confirm Mock Mode is off in any "real robot" screenshots
6. Decide whether to share your local IP in screenshots
7. If you use wake-word weather, set the weather API in-app first so public demos behave consistently

For the longer version, see:

- [docs/PUBLIC_RELEASE_CHECKLIST.md](./docs/PUBLIC_RELEASE_CHECKLIST.md)
