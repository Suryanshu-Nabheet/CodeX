#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# setup_env.sh — create or update ~/.codex.env with provider API key placeholders.
# Usage: ./scripts/setup_env.sh [--force]
# -----------------------------------------------------------------------------

set -euo pipefail

ENV_FILE="${HOME}/.codex.env"
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force|-f) FORCE=true ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--force]"
      echo "Creates ${ENV_FILE} with commented API key placeholders."
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

if [[ -f "$ENV_FILE" && "$FORCE" != "true" ]]; then
  echo "${ENV_FILE} already exists. Use --force to overwrite."
  exit 0
fi

cat >"$ENV_FILE" <<'EOF'
# CodexCLI user-wide environment (~/.codex.env)
# Loaded automatically on startup. Project .env overrides these per-repo.

# OpenAI / API-compatible (default provider: codexcli)
OPENAI_API_KEY=
# LLM_API_KEY=   # alias — also accepted
# CODEXCLI_BASE_URL=https://api.openai.com/v1

# Claude (Anthropic)
CLAUDE_API_KEY=
# ANTHROPIC_API_KEY=   # alias
# CLAUDE_BASE_URL=https://api.anthropic.com/v1

# Google Gemini
GEMINI_API_KEY=

# OpenRouter
OPENROUTER_API_KEY=

# Mistral / DeepSeek / xAI / Groq
# MISTRAL_API_KEY=
# DEEPSEEK_API_KEY=
# XAI_API_KEY=
# GROQ_API_KEY=

# Ollama (local — no API key required; ensure `ollama serve` is running)
# OLLAMA_API_KEY=

# Optional overrides
# LLM_TIMEOUT_MS=120000
# CODEX_UNSAFE_ALLOW_NO_SANDBOX=0
# CODEX_MAX_AGENT_TURNS=40
EOF

chmod 600 "$ENV_FILE"
echo "Created ${ENV_FILE}"
echo "Edit the file and set the API key(s) for your provider(s)."
