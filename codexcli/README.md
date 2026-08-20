# CodexCLI

**Autonomous terminal coding agent** — part of the [CodeX](https://github.com/Suryanshu-Nabheet/CodeX) monorepo.

CodexCLI is a production-grade AI coding agent that runs in your terminal. It edits real files, runs real commands, streams responses live, and works with multiple LLM providers — including local models.

**Lead developer:** [Suryanshu Nabheet](https://github.com/Suryanshu-Nabheet)

**Repository:** [github.com/Suryanshu-Nabheet/CodeX](https://github.com/Suryanshu-Nabheet/CodeX) (see `codexcli/`)

---

## What it does

- Operates on a **real filesystem** (create, edit, delete, patch) inside the project root
- Runs **real shell commands** with approval policies and optional sandboxing
- Streams assistant tokens **live** in the TUI
- Queues follow-ups while a turn is running (`/stop` cancels; queue drains next)
- Supports **skills** (custom slash prompts), `/plan`, `/init`, `/doctor`, `/cost`, todos, explore, and `web_fetch`
- Multi-provider: OpenAI-compatible, Anthropic, Gemini, OpenRouter, Ollama, and more

This is not a chat demo. Every tool call hits the real workspace.

---

## Requirements

- Node.js ≥ 22
- npm or pnpm

---

## Install

### From source (recommended)

```bash
git clone https://github.com/Suryanshu-Nabheet/CodeX.git
cd CodeX/codexcli
npm install
npm run build
npm link   # optional: installs `codexcli` on your PATH
```

Or one-shot setup:

```bash
./scripts/setup.sh
# or: npm run setup
```

### Run

```bash
codexcli .
# or
node dist/cli.js .
```

With a prompt:

```bash
codexcli "add a health check endpoint and tests"
```

---

## Configuration

### First launch

Run `codexcli` — the setup wizard asks for provider + API key and saves them under:

- `~/.codex/config.json`
- `~/.codex.env` (loaded on every launch)

`/provider` and `/model` switch at runtime. Model lists are fetched live from each provider.

### Optional env overrides

```bash
export LLM_API_KEY="sk-..."          # OpenAI-compatible / universal
export OPENAI_API_KEY="sk-..."
export CLAUDE_API_KEY="sk-ant-..."   # Anthropic
export GEMINI_API_KEY="..."
export OPENROUTER_API_KEY="sk-or-..."
# Ollama: no key — run `ollama serve`
```

### Config file (`~/.codex/config.json`)

```json
{
  "provider": "codexcli",
  "model": "gpt-4.1",
  "approvalMode": "auto-edit",
  "instructions": "Prefer small diffs. Run tests after edits."
}
```

Edit interactively:

```bash
codexcli --config
```

---

## Autonomy & approval

| Mode | Flag | Behavior |
| --- | --- | --- |
| Suggest | (default / `--suggest`) | Confirm edits and commands |
| Auto-edit | `--auto-edit` | Auto-approve file edits; confirm shell |
| Full-auto | `--full-auto` | Auto-approve (prefer sandbox / writable roots) |

Example:

```bash
codexcli --auto-edit "refactor auth middleware and verify with tests"
```

Quiet / CI:

```bash
codexcli -q "fix lint failures in src/"
```

---

## Slash commands

| Command | Purpose |
| --- | --- |
| `/stop` `/cancel` | Stop current turn; queued follow-ups run next |
| `/queue` `/queue clear` | Inspect or drop follow-ups |
| `/plan [topic]` | Plan-only turn (no edits until you approve) |
| `/init` | Create starter `AGENTS.md` |
| `/doctor` | Health check (config, key, skills, sessions) |
| `/cost` `/status` | Token usage and session info |
| `/compact` | Summarize context |
| `/model` `/provider` `/approval` | Switch settings |
| `/resume` `/sessions` | Browse prior sessions |
| `/diff` `/todos` `/pwd` `/help` `/clear` `/exit` | Utilities |

Custom skills: markdown under `~/.codex/commands/`, `.codex/commands/`, or `.claude/commands/` (compat). Use `$ARGUMENTS` in the body.

Sessions persist under `~/.codex/sessions/`.

---

## Providers

```bash
codexcli -p claude -m claude-sonnet-4 "optimize the query layer"
codexcli -p gemini -m gemini-2.0-flash "add unit tests"
codexcli -p ollama -m codellama "explain this package"
codexcli -p openrouter -m anthropic/claude-sonnet-4 "review the PR diff"
```

`/model` always lists what the provider returns live — not a hardcoded catalog.

---

## Architecture (short)

```
src/
├── agent/          # AgentLoop, tools, skills, explore, usage
├── context/        # Repo context packing
├── fs/             # Project-root scoped filesystem
├── patch/          # Unified diff apply
├── providers/      # LLM backends
├── exec/           # Shell + sandbox
├── tui/            # Ink + React terminal UI
└── config/         # ~/.codex config + env
```

- **Project root boundary** — path traversal outside the workspace is blocked
- **Patch-first edits** — unified diffs; verified on disk
- **Streaming TUI** — tokens render as they arrive; history uses Ink Static for scrollback
- **Tool registry** — `read_file`, `write_file`, `apply_patch`, `search_files`, `explore`, `update_todos`, `web_fetch`, shell, …

---

## Security

- Filesystem ops scoped to the project root
- Approval gates for mutating tools and shell
- Full-auto can restrict writable roots (`-w`)
- Do not commit or push secrets; CodexCLI does not commit unless you ask

---

## Development

```bash
git clone https://github.com/Suryanshu-Nabheet/CodeX.git
cd CodeX/codexcli
npm install
npm run build
npm run lint
npm test
```

Watch / linked dev:

```bash
npm run build:dev
# or
npm run setup
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE).

---

## Support

- Issues: [github.com/Suryanshu-Nabheet/CodeX/issues](https://github.com/Suryanshu-Nabheet/CodeX/issues)
- Discussions: [github.com/Suryanshu-Nabheet/CodeX/discussions](https://github.com/Suryanshu-Nabheet/CodeX/discussions)

**CodexCLI** — real files, real commands, autonomous delivery.
