#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# dev.sh — local development: install deps, build, and link the CLI globally.
# Usage: ./scripts/dev.sh
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT"

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: install Node.js with npm first." >&2
  exit 1
fi

echo "==> Installing dependencies (npm)..."
npm install

echo "==> Building..."
npm run build

echo "==> Linking codexcli globally..."
npm link

echo ""
echo "Done. Run: codexcli"
echo "Tip: launch with \`codexcli\` — the setup wizard stores API keys for you (no export needed)."
