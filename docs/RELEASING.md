# Releasing Vector Control Hub

This document covers the current Phase 1 Windows release path.

## What Phase 1 Produces

- Windows installer (`.exe`)
- Windows portable build (`.exe`)
- GitHub Release artifacts for testers

The release still assumes:
- Windows users
- WirePod is installed separately for real robot control

## Before You Release

1. Make sure the app builds locally:

   ```bash
   npm run typecheck
   npm run build
   npm run desktop:assets
   ```

2. Confirm screenshots and README wording are current.
3. Make sure no local env files are present in what you plan to share.
4. Test `start-app.bat` once on your own machine.

## Local Windows Packaging

To create local release builds:

```bash
npm run release:windows
```

Artifacts are written to:

```text
dist-electron/
```

Expected outputs include:
- NSIS installer
- portable Windows executable

## GitHub Actions Release Flow

This repo includes:

- a validation workflow for pushes and pull requests
- a Windows release workflow for tags and manual runs

### Option A: Manual GitHub build

1. Open the repo on GitHub
2. Go to `Actions`
3. Run the `Windows Release` workflow
4. Download the generated artifacts

### Option B: Tagged release

1. Update the version in `package.json`
2. Commit the change
3. Create and push a tag like:

   ```bash
   git tag v0.1.1
   git push origin main --tags
   ```

4. GitHub Actions will build the Windows artifacts
5. The workflow will attach them to a GitHub Release

## Release Notes Template

Suggested format:

```text
Vector Control Hub vX.Y.Z

Highlights
- ...
- ...

Known limitations
- WirePod is still required for real robot control
- Windows-first release
```

## Current Honest Limitations

- This is a Windows-first release path
- Real robot control still depends on local WirePod
- Code signing is not set up yet, so Windows SmartScreen may warn on first download

That is okay for Phase 1. The goal right now is a trustworthy GitHub Release, not the final one-app experience.
