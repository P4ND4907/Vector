#!/usr/bin/env bash
# scripts/build-electron.sh
#
# Helper script for building the Vector Control Hub Electron app locally.
#
# Prerequisites:
#   - Node.js 20+ and npm
#   - electron and electron-builder installed (npm ci from repo root)
#
# Usage:
#   ./scripts/build-electron.sh             # build installer
#   ./scripts/build-electron.sh --dev       # start Electron in dev mode (no installer)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

DEV_MODE=false
if [[ "${1:-}" == "--dev" ]]; then
  DEV_MODE=true
fi

echo "▸ Building frontend (Vite)..."
npm run build --workspace app

echo "▸ Building server (TypeScript)..."
npm run build --workspace server

if [[ "$DEV_MODE" == "true" ]]; then
  echo "▸ Starting Electron in development mode..."
  npx electron .
else
  echo "▸ Generating Electron installer (Windows NSIS + portable)..."
  npx electron-builder \
    --config packaging/electron/electron-builder.yml \
    --win nsis portable

  echo ""
  echo "✔ Installers written to: dist-electron/"
  ls -lh dist-electron/*.exe 2>/dev/null || true
fi
