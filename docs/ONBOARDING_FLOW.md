# Onboarding Flow

The `OnboardingWizard` component (`app/src/pages/OnboardingWizard.tsx`) runs the first time a user opens Vector Control Hub. It is a four-step modal card that collects the minimum information needed to establish a robot connection.

---

## When Onboarding Runs

The app checks `localStorage` on startup:

```ts
const STORAGE_KEY = "vector_onboarding_complete";
// onboarding renders when:
!localStorage.getItem(STORAGE_KEY)
```

Once the user completes step 4 and clicks **Go to dashboard**, the wizard calls:

```ts
localStorage.setItem("vector_onboarding_complete", "true");
```

After that the wizard is never shown again unless the flag is cleared.

---

## Step-by-Step Flow

### Step 1 — Welcome

**Title:** Welcome to Vector Control Hub

A feature overview is shown as a checklist:

- Drive your robot remotely
- Run AI voice commands
- Automate routines and behaviors
- Monitor diagnostics in real time

The user clicks **Continue** to proceed.

---

### Step 2 — Choose your engine

**Title:** Choose your engine

The user selects how the app communicates with their robot. Three options are presented:

| Option | Label | Notes |
|---|---|---|
| `embedded` | Embedded (local) | **Disabled** — not yet implemented. Shown with a "Coming soon" badge. |
| `wirepod` | WirePod | **Recommended** for most users. Requires a running WirePod server. Selected by default. |
| `mock` | Mock (demo) | No real robot required. Good for exploring the app or taking screenshots. |

The embedded option is non-interactive (grayed out, `disabled: true`).

The selected engine is stored in local component state and used in step 3.

---

### Step 3 — Connection test

**Title:** Connection test

The wizard calls `useEngineStatus` to check whether the selected engine is reachable. Three display states:

| State | Appearance |
|---|---|
| Loading | Neutral — "Testing connection…" |
| Connected | Green — "Engine is reachable and connected." |
| Not connected | Amber — "Engine not connected yet. You can continue and reconnect later." |

A **Re-test connection** button lets the user retry without leaving this step.

Importantly, a failed connection test does **not** block progress. The user can click **Continue** regardless, and reconnect later from the Engine Settings page.

---

### Step 4 — Complete

**Title:** You're all set!

A green confirmation card confirms setup is complete. The user clicks **Go to dashboard** which:

1. Sets `localStorage.setItem("vector_onboarding_complete", "true")`
2. Calls the `onComplete` callback, which unmounts the wizard and renders the main app

---

## Navigation

- **Back** button is available on steps 2–4
- **Continue** advances through steps 1–3
- **Go to dashboard** is shown only on step 4

There is no form validation between steps. The wizard is intentionally low-friction.

---

## How to Skip or Reset Onboarding

### Skip onboarding (go straight to dashboard)

Set the flag before the app loads, or open the browser console and run:

```js
localStorage.setItem("vector_onboarding_complete", "true");
location.reload();
```

### Re-trigger onboarding

Clear the flag:

```js
localStorage.removeItem("vector_onboarding_complete");
location.reload();
```

This is useful when testing the onboarding flow or resetting a machine to a first-run state.

---

## Engine Settings After Onboarding

The engine selection made in the wizard is informational — the active provider is managed by the backend. After onboarding, go to **Settings → Engine** (`/settings/engine`) to:

- Switch the active provider
- Set a custom WirePod URL (e.g. `http://192.168.1.x:8080` for a LAN machine)
- View live provider status via the `EngineStatusCard` component
