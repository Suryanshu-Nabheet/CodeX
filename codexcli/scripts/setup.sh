#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# setup.sh — one-command project setup and CLI launch.
#
# Usage:
#   ./scripts/setup.sh [codexcli args...]
#   ./scripts/setup.sh --no-launch          # setup only, don't start the TUI
#   ./scripts/setup.sh --force-env          # recreate ~/.codex.env
#   ./scripts/setup.sh --help
#
# What it does:
#   1. Verifies Node.js >= 22
#   2. Creates ~/.codex config directory
#   3. Creates ~/.codex.env (if missing) via setup_env.sh
#   4. Installs deps, builds, and links codexcli globally via dev.sh
#   5. Launches codexcli (unless --no-launch)
# -----------------------------------------------------------------------------

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_DIR="${HOME}/.codex"
ENV_FILE="${HOME}/.codex.env"
MIN_NODE_MAJOR=22

NO_LAUNCH=false
FORCE_ENV=false
CLI_ARGS=()

usage() {
  cat <<EOF
Usage: $(basename "$0") [options] [-- codexcli args...]

Options:
  --no-launch   Run setup only; do not start codexcli
  --force-env   Overwrite ~/.codex.env with the default template
  -h, --help    Show this help

Examples:
  ./scripts/setup.sh
  ./scripts/setup.sh --no-launch
  ./scripts/setup.sh -- "explain this codebase"
  npm run setup
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-launch) NO_LAUNCH=true ;;
    --force-env) FORCE_ENV=true ;;
    -h|--help) usage; exit 0 ;;
    --)
      shift
      CLI_ARGS=("$@")
      break
      ;;
    *)
      CLI_ARGS+=("$1")
      ;;
  esac
  shift
done

info() { echo "==> $*"; }
warn() { echo "warning: $*" >&2; }

# ── 1. Node.js ──────────────────────────────────────────────────────────────

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (>= ${MIN_NODE_MAJOR})." >&2
  echo "Install from https://nodejs.org/ or use nvm/fnm." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [[ "$NODE_MAJOR" -lt "$MIN_NODE_MAJOR" ]]; then
  echo "Error: Node.js >= ${MIN_NODE_MAJOR} required (found $(node -v))." >&2
  exit 1
fi

info "Node $(node -v)"

# ── 2. Config directory ─────────────────────────────────────────────────────

mkdir -p "$CONFIG_DIR"
info "Config directory: ${CONFIG_DIR}"

# ── 3. Environment file ─────────────────────────────────────────────────────

if [[ "$FORCE_ENV" == "true" ]]; then
  info "Creating ${ENV_FILE} (--force-env)..."
  bash "$SCRIPT_DIR/setup_env.sh" --force
elif [[ ! -f "$ENV_FILE" ]]; then
  info "Creating ${ENV_FILE}..."
  bash "$SCRIPT_DIR/setup_env.sh"
else
  info "Environment file exists: ${ENV_FILE}"
fi

# ── 4. Install, build, link ─────────────────────────────────────────────────

info "Installing dependencies and linking codexcli..."
bash "$SCRIPT_DIR/dev.sh"

# ── 5. API key check (non-blocking) ─────────────────────────────────────────

# shellcheck disable=SC1090
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE" 2>/dev/null || true

has_key=false
for var in LLM_API_KEY CLAUDE_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY; do
  if [[ -n "${!var:-}" ]]; then
    has_key=true
    break
  fi
done

# Ollama uses a local server and does not require a real API key.
if [[ "$has_key" == "false" ]] && command -v ollama >/dev/null 2>&1; then
  has_key=true
fi

if [[ "$has_key" == "false" ]]; then
  warn "No API keys found in ${ENV_FILE}."
  echo "       Edit that file or use the in-app setup wizard on first launch."
  echo "       Ollama (local) works without a key."
fi

# ── 6. Launch ───────────────────────────────────────────────────────────────

if [[ "$NO_LAUNCH" == "true" ]]; then
  echo ""
  echo "Setup complete."
  echo "Run: codexcli"
  exit 0
fi

if ! command -v codexcli >/dev/null 2>&1; then
  warn "codexcli not on PATH after link. Trying node directly..."
  if [[ ${#CLI_ARGS[@]} -gt 0 ]]; then
    exec node "$ROOT/bin/codexcli.js" "${CLI_ARGS[@]}"
  else
    exec node "$ROOT/bin/codexcli.js"
  fi
fi

echo ""
info "Launching codexcli..."
if [[ ${#CLI_ARGS[@]} -gt 0 ]]; then
  exec codexcli "${CLI_ARGS[@]}"
else
  exec codexcli
fi
