# Scripts

Utility scripts for developing, configuring, and releasing CodexCLI.

## Quick start (one command)

```bash
./scripts/setup.sh
# or
npm run setup
```

This installs dependencies, builds the CLI, links it globally, creates `~/.codex.env` if needed, and launches `codexcli`.

Setup only (no launch):

```bash
./scripts/setup.sh --no-launch
```

## Manual setup

```bash
./scripts/setup_env.sh   # create ~/.codex.env with API key placeholders
./scripts/dev.sh         # install, build, and link codexcli globally
codexcli
```

## Scripts

| Script | Purpose |
|--------|---------|
| `setup.sh` | **One-command setup** — env, install, build, link, and launch |
| `dev.sh` | Install dependencies, build, and link `codexcli` globally |
| `setup_env.sh` | Create `~/.codex.env` with provider API key placeholders |
| `stage_release.sh` | Stage an npm release tarball (run from repo root) |
| `init_firewall.sh` | Linux: iptables network isolation for sandbox UID (requires root) |
| `run_in_container.sh` | Run a command in a network-disabled Docker container |

## Release process

```bash
./scripts/stage_release.sh
# or
npm run stage-release
```

Then verify and publish from the staged directory printed by the script.

## Linux sandboxing

For `--full-auto` mode on Linux, file access is restricted via Landlock. Network isolation is optional:

- **`init_firewall.sh`** — blocks outbound traffic for a dedicated UID via iptables
- **`run_in_container.sh`** — runs commands in Docker with `--network none`

## In-session provider / model switching

Inside the chat TUI:

- `/provider` — open the provider picker
- `/model` — open the model picker (Tab toggles provider/model in the model overlay)

Both commands appear in `/` autocomplete and in `/help`.
