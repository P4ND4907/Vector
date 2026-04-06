# Improvement Audit

Last reviewed: 2026-04-05

## Local health snapshot

Checks run locally from the repo root:

- `npm run typecheck --workspace app`
- `npm run typecheck --workspace server`
- `npm run build --workspace app`
- `npm run build --workspace server`
- `npm audit --omit=dev`

Current result:

- App typecheck: passing
- Server typecheck: passing
- App build: passing
- Server build: passing
- Production dependency audit: `0 vulnerabilities`

## Current strengths

- Windows app, PWA, and Android shell all exist in one repo
- Real local architecture is honest: app -> backend -> WirePod -> Vector
- Public README, screenshots, Android build path, and Play assets are already in place
- Android release size is already lean thanks to minification and resource shrinking
- AI command catalog, diagnostics, mock mode, and onboarding are much stronger than most hobby dashboards

## Current weak spots worth fixing next

Big files that are likely to slow future work:

- `app/src/services/robotService.ts` ~1277 lines
- `server/src/robot/hybridRobotController.ts` ~1690 lines
- `server/src/services/aiCommandService.ts` ~645 lines
- `app/src/pages/SettingsPage.tsx` ~629 lines

These are not broken, but they are the main places where future bugs and regressions are most likely to pile up.

## Best free projects to borrow from

### 1. wire-pod

Repo:

- <https://github.com/kercre123/wire-pod>

Why it matters:

- This is still the core trust anchor of the modern Vector community
- It is the main local bridge your app depends on
- The repo is large and active, with a wiki, installer paths, and a broad user base

What to borrow:

- setup and troubleshooting language
- service detection and health semantics
- custom intent conventions
- multi-bot handling patterns

### 2. VectorX

Repo:

- <https://github.com/fforchino/vectorx>

Why it matters:

- It is the clearest open-source example of how to extend WirePod with richer voice commands
- It already documents weather, dice, games, chat, localization, and custom assets

What to borrow:

- richer command registry coverage
- localization-ready intent definitions
- weather and dice face asset approach
- command pre-processor strategy layered above WirePod

Best near-term use in this repo:

- import the remaining legacy/community command ideas more systematically
- use its asset and localization model to improve weather, dice, bingo, and game flows

### 3. vector-web-setup

Repo:

- <https://github.com/digital-dream-labs/vector-web-setup>

Why it matters:

- It shows how first-time onboarding can be done in a web flow instead of a brittle phone-app dependency
- It already solved a lot of BLE/browser onboarding reality

What to borrow:

- first-run pairing language
- better setup-state messaging
- one-time onboarding separation from everyday control UI

Best near-term use in this repo:

- improve the startup page so users understand pairing vs backend vs live control more clearly
- eventually offer a tighter handoff into setup rather than generic instructions

### 4. Anki Vector Python SDK

Repo:

- <https://github.com/anki/vector-python-sdk>

Why it matters:

- It is still the clearest reference for direct robot capabilities
- It documents camera, face display, vision, speech, and behavior flows that the community still builds around

What to borrow:

- camera-to-face experiences
- direct behavior semantics for animations and speech
- examples for richer robot actions beyond simple text routes

Best near-term use in this repo:

- rebuild the most important animation-backed commands around known SDK behavior patterns
- improve photo and camera workflows

### 5. SeboLab vector-robot

Repo:

- <https://github.com/SeboLab/vector-robot>

Why it matters:

- It is a good example of a capability map for movement, charger behavior, cube interaction, face turns, and media

What to borrow:

- clearer separation between high-level behaviors and low-level controls
- more explicit cube and charger action support

Best near-term use in this repo:

- split robot controller responsibilities by behavior type
- finish cube features like pickup, roll, dock cube, and charger routines more cleanly

### 6. awesome-anki-vector

Repo:

- <https://github.com/open-ai-robot/awesome-anki-vector>

Why it matters:

- It is not a product to copy directly
- It is useful as a discovery list for experiments, integrations, and camera/vision ideas

Best near-term use in this repo:

- use it as a backlog source for optional modules like vision, object detection, and richer assistant behavior

## Concrete upgrade plan

### Track 1: Reliability

1. Split `hybridRobotController.ts` into smaller services:
   - speech
   - movement
   - charging/docking
   - photos/camera
   - animations
2. Split `robotService.ts` by runtime concern:
   - connection
   - telemetry
   - backend target resolution
   - command pacing / pause windows
3. Add a thin integration test layer for:
   - health endpoint
   - AI preview route
   - AI execute route
   - settings update route
   - mock mode fallback

### Track 2: Command depth

1. Keep importing missing VectorX-style commands into the shared registry
2. Add a command capability matrix:
   - preview-only
   - speech-only
   - speech + animation
   - needs cube
   - needs weather API
3. Give weather and dice their own real face-asset path instead of generic cue fallbacks

### Track 3: Setup and onboarding

1. Separate setup mode from normal control mode more aggressively
2. Add a mobile-first "connect to desktop backend" helper with:
   - LAN host scan
   - saved desktop hosts
   - clearer mock/live switch messaging
3. Borrow language and flow ideas from `vector-web-setup`

### Track 4: Public release quality

1. Add automated release notes from the command catalog and feature flags
2. Add a real changelog for public testers
3. Create at least one guided "first five minutes" flow in the app:
   - connect
   - say hello
   - take photo
   - run diagnostics
   - dock

### Track 5: Mobile quality

1. Add an explicit "desktop backend status" card in mobile mode
2. Cache the last good backend target and offer reconnect suggestions
3. Add a backend URL validator/test button before saving
4. Consider a LAN discovery helper later, but keep manual entry as the truth path first

## Suggested next work order

1. Refactor `server/src/robot/hybridRobotController.ts`
2. Refactor `app/src/services/robotService.ts`
3. Finish weather and dice face/animation assets
4. Finish the remaining high-value legacy commands
5. Improve mobile live-backend onboarding

## Notes

- Local upload/build helper folders are intentionally ignored in git:
  - `mobile-live-builds/`
  - `play-store-assets/`
- Keep IP-specific mobile builds local only; do not commit a hard-coded LAN address to the public repo
