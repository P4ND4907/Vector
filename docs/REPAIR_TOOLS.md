# Repair Tools

The Repair Tools page (`app/src/pages/RepairToolsPage.tsx`) is accessible from the main navigation. It provides tools for diagnosing and recovering from common Vector connectivity problems.

Navigate to: **Repair** (or `/repair` in the URL).

---

## When to Use Repair Tools

Use repair tools when:

- The dashboard shows the robot as offline but WirePod is running
- Commands stop responding mid-session
- The bridge connection appears stuck or stale
- You want a snapshot of connection health before filing a bug report
- A previous action (drive, speak, etc.) timed out and the session feels broken

Repair tools are **not** a substitute for physical troubleshooting (charger contact, network, robot firmware). If the bridge is healthy but commands still fail, check the robot's physical state first.

---

## Quick Repair

**Section:** Run quick repair

The most common starting point. Clicking **Start quick repair** triggers `quickRepair()` from the Zustand app store, which runs a guided recovery sequence:

1. Resets the current bridge session
2. Attempts to re-establish the robot connection
3. Returns a `RepairResult` object with:
   - `overallStatus`: `"repaired"` | `"partial"` | `"failed"`
   - `summary`: human-readable outcome
   - `steps[]`: individual step results, each with a label, status (`success` | `warn` | `fail`), and optional details

The UI reflects status with color-coded cards:

| Status | Color |
|---|---|
| `repaired` | Green |
| `partial` | Amber |
| `failed` | Red |

Each step in the repair sequence is listed with its own status badge so you can see exactly where recovery succeeded or stalled.

If the repair action itself throws an error, the error message is shown inline below the button.

---

## Bridge Watchdog

**Section:** Connection health

The bridge watchdog gives a live stability snapshot of the local bridge (WirePod) connection without running a full repair.

Click **Check bridge status** to fetch the watchdog data. The `BridgeWatchdogCard` component renders:

- Connection stability metrics
- A **Recover** button that triggers the same `quickRepair()` flow
- A **Retry** button to refresh the watchdog data

The watchdog check calls `robotService.getBridgeWatchdog(snapshot)` and is independent of the quick repair flow. Use it to monitor connection health passively before deciding whether a full repair is needed.

---

## Repair History

**Section:** Recent repair reports

The last three repair reports are listed below the watchdog card, pulled from `supportReports` in the Zustand store. Each entry shows:

- Overall status (repaired / partial / failed) with color coding
- Summary text
- Timestamp

Reports accumulate within the current session. For the full report history and raw diagnostic data, go to the **Diagnostics** page.

---

## DiagnosticReport

The `supportReports` array in the app store holds `DiagnosticReport` objects. Each report contains:

- `id`: unique identifier
- `createdAt`: ISO timestamp
- `repairResult`: the full `RepairResult` from the repair run

These are written to the store by `quickRepair()` and displayed in the repair history section. They are not persisted to disk between sessions.

---

## Summary

| Tool | What it does | When to use it |
|---|---|---|
| Quick repair | Resets bridge session and reconnects | Robot offline, commands timing out |
| Bridge watchdog | Reads live connection stability metrics | Monitoring before deciding to repair |
| Repair history | Shows last 3 repair outcomes | Reviewing what happened in this session |
| Diagnostics page | Full diagnostic detail | Deeper investigation, sharing with support |
