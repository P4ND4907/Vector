# Mobile Foundation

This project can become a mobile app, but the safest path is to separate that into stages.

## What Exists Today

- The React UI is already responsive and uses a mobile bottom nav.
- The app already includes Capacitor packages in `app/package.json`.
- The frontend can now store a manual app-backend target locally.

## The Main Architecture Reality

The current product flow is:

`User -> app frontend -> local Node/Express backend -> local WirePod -> Vector`

That works well on Windows because the frontend and backend live on the same machine.

For mobile, the backend should not be assumed to run on the phone yet.

## Recommended Mobile Path

### Phase A: Frontend foundation

- keep the current React app
- keep the UI responsive
- add local-only app backend targeting
- make camera/feed and API calls use that runtime backend target

This phase makes the app capable of talking to a desktop or LAN backend later.

### Phase B: Mobile shell

- package the frontend with Capacitor
- add Android and iOS projects
- test the app against a backend running on the same local network

In this phase, the phone is a control surface. The desktop or another local machine still runs the backend and WirePod.

### Phase C: Mobile polish

- improve safe-area handling
- tighten mobile layouts
- add mobile-specific onboarding copy
- add a simple backend target helper for LAN setup

### Phase D: One-app future

- either bundle or replace the local backend layer
- remove the need for a separate desktop/LAN backend

That is the hardest stage and should come after the mobile shell is already useful.

## Current Foundation Added

- `app/src/lib/runtime-target.ts`
  - resolves the active app backend target
  - supports a locally saved manual backend URL
- `app/src/services/apiClient.ts`
  - now reads the backend target dynamically
- `Settings -> Mobile foundation`
  - lets the user save a manual backend URL such as `http://192.168.x.x:8787`

## Practical First Mobile Test

When the mobile shell is added, the first realistic test should be:

1. run Vector Control Hub backend on a Windows PC
2. put phone and PC on the same Wi-Fi
3. set the app backend URL to `http://PC-IP:8787`
4. verify startup, dashboard, controls, AI commands, and photos

## Honest Limit

This does not make the app a full standalone phone-only Vector controller yet.

It makes the frontend ready for that future without rebuilding the product architecture twice.
