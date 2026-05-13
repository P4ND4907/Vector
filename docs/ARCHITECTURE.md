# Architecture

Vector runs as one local app with a provider-based Engine backend.

- Frontend API surface: `/api/engine/*` and `/api/robot/*`
- Default provider: `embedded`
- Legacy compatibility provider: `wirepod`
- Demo/testing provider: `mock`

The Engine route layer wraps existing app, settings, diagnostics, routines, support, AI, and monetization endpoints so the UI stays behind one Engine namespace.

Persistence:

- `engine-settings.json` for provider/runtime engine settings
- `pairing-data.json` for local pairing records
- `license.json` for offline local license activation state
