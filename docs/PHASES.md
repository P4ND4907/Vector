# Vector Control Hub Phases

This project is now being tracked in three product phases.

Current status:

- Phase 1 is complete
- Phase 1 is the stable public Windows product
- Phase 2 is complete as the strong mobile companion milestone
- active development now focuses on the Phase 3 independence foundation while keeping Phases 1 and 2 stable

## Phase 1: Stable Public Windows Product

Goal:

- ship a trustworthy Windows release for normal users
- keep setup, control, diagnostics, and recovery in one approachable app
- make GitHub Releases the normal download path instead of raw source

What Phase 1 includes:

- Windows installer and portable builds
- one-click Windows launcher
- local backend startup handled by the app launcher
- first-run onboarding for the current local backend model
- diagnostics, repair tools, command handling, and Mock Mode
- public docs, screenshots, and GitHub release workflow

What Phase 1 still honestly depends on:

- Windows as the main supported public platform
- WirePod as the local backend bridge for real robot control
- unsigned Windows builds unless code signing is added later

Phase 1 exit criteria:

- release builds are reproducible
- docs and README match the real product
- installer path is verified locally
- known limitations are honest

Status:

- complete

## Phase 2: Strong Mobile Companion

Goal:

- make the Android app feel automatic and dependable as a companion to the local desktop backend

Target work:

- stronger backend auto-discovery and reconnect behavior
- Bluetooth discovery and pairing handoff improvements
- better offline shell and recovery messaging
- cleaner mobile setup flow for normal users
- Play testing and real-device stability work as ongoing polish instead of a blocked milestone

Status:

- complete

## Phase 3: True One-App Independence

Goal:

- move beyond the external local bridge so the app becomes the only thing most users think about

Target work:

- replace or embed the current WirePod dependency
- own pairing, provisioning, and reconnect directly
- support a true phone-only or self-contained setup path
- reduce separate install steps to the minimum possible

What is already in place now:

- a provider-agnostic local bridge service boundary in the backend
- compatibility `/bridge/*` API routes that no longer hard-code WirePod in the public mobile path
- integration metadata that can describe the active bridge provider without making the UI architecture-specific
- ongoing UI cleanup so the app talks about a local bridge/provider instead of assuming one backend forever

What still honestly remains before Phase 3 is complete:

- a direct embedded robot transport that does not rely on the current WirePod-compatible implementation
- full in-app pairing and provisioning with no portal handoff
- a truly phone-only setup path for first-time owners
- migration of remaining WirePod-specific internal settings and storage names

Status:

- in progress
