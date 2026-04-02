# Vector Control Hub

Vector Control Hub is a local dashboard for the Anki / DDL Vector robot.

It exists to make Vector easier to use day-to-day: one app for connection, drive controls, speech, diagnostics, routines, AI command previews, and camera/photo tools, with WirePod staying in the background as the local bridge.

## Project Status

This project is active and usable, but still evolving.

- Core local dashboard flow works
- Mock mode is available for testing without a robot
- WirePod is still required as the local backend bridge
- Some advanced features are still being refined

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

1. Startup connection screen
2. Main dashboard
3. Controls page
4. AI commands page
5. Diagnostics page
6. Camera/photo page

Tip: use one clean connected state and one honest offline state.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Zustand
- Backend: Node.js, Express, Zod
- Local bridge: WirePod
- Packaging path: PWA-first, with Capacitor-ready frontend structure

## How It Works

Architecture:

`User -> Vector Control Hub app -> local backend -> local WirePod -> Vector`

Important:

- This app does **not** replace WirePod
- This app is designed so WirePod stays mostly invisible after setup
- The frontend does **not** talk directly to random local endpoints; the backend owns the WirePod communication layer

## Privacy and Safety

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

### Easiest launch

Use:

- `start-app.bat`

Compatibility launcher:

- `Launch-Vector-Control-Hub.bat`

Both launchers call the same PowerShell script and do only visible, local startup work:

- verify Node.js is installed
- install dependencies if missing
- build the project if needed
- start the local backend
- start the local static app server
- open the app window

### Manual install

```bash
npm install
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
4. Use the startup connection screen
5. Scan or reconnect to the saved robot
6. Open the dashboard once Vector answers

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

### Camera page shows no photos

Ask Vector to take a photo, then use the camera page action to capture/sync again.

## FAQ

### Do I need WirePod?

Yes, for real local Vector control today.

### Does this app replace WirePod?

No. It sits on top of WirePod and is meant to become the everyday UI.

### Does this app send robot data to the cloud?

Not by default. Most robot control stays local. Optional OpenAI features require your own key.

### Is Mock Mode required?

No. It is optional and should only be used when you want a fallback/demo path.

## Known Limitations

- Some advanced roam automation behavior is still being refined
- Speech/audio behavior may vary depending on the local Vector/WirePod setup
- Advanced vision/object detection is not finished yet
- This repo is currently Windows-first in its helper scripts

## Public Sharing Checklist

Before publishing:

1. Make sure `server/.env.local` is not included
2. Confirm no secrets are in screenshots
3. Add screenshots to this README
4. Verify the launcher still works on a clean machine
5. Confirm Mock Mode is off in any "real robot" screenshots
