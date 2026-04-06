# Vector Control Hub Phases

This project is being shipped in clear product phases so we can improve the real app without breaking trust.

## Phase 1: GitHub Release + Windows Installer

Goal:
- make the project easy to try from GitHub
- give people a normal Windows installer download
- keep the current app working as-is

What is included:
- clean GitHub repo and public docs
- Windows packaging scripts
- GitHub Actions workflow to build release artifacts
- manual and tagged release instructions
- source-download path still available for advanced users

What is not included yet:
- in-app WirePod installation
- one-click first-run setup for brand-new users
- automatic app updates
- full one-app experience

## Phase 2: First-Run Onboarding

Goal:
- make first launch calm and obvious for normal users

Target work:
- setup wizard
- clearer "real mode" vs "mock mode" explanation
- better missing-dependency messaging
- beginner-friendly connection steps inside the app

## Phase 3: Managed WirePod Experience

Goal:
- keep WirePod mostly invisible during normal use

Target work:
- detect WirePod automatically
- start it from inside the app when possible
- in-app repair and diagnostics for common failures
- fewer reasons to touch the WirePod web UI

## Phase 4: Product Polish

Goal:
- make the app feel finished and reliable

Target work:
- smoother startup
- better screenshots and release notes
- stronger offline and empty states
- feedback flow and support bundle export
- stable update path

## Phase 5: One-App Experience

Goal:
- move toward a true non-technical install experience

Target work:
- reduce or remove separate dependency steps
- evaluate bundling or replacing the local bridge
- signed installer
- auto-updates
- the app becomes the only thing most users think about
