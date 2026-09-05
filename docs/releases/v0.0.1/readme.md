# CodeX `v0.0.1`

The Ai Code Editor

**Author:** Suryanshu Nabheet &nbsp;·&nbsp; **Released:** March 27, 2026 &nbsp;·&nbsp; [Release page](https://github.com/Suryanshu-Nabheet/CodeX/releases/tag/v0.0.1)

---

## What is CodeX

Most AI-assisted editors operate through a thin extension layer with no meaningful access to internal editor state. CodeX takes a different approach — the AI engine has direct access to workbench internals (TextMate grammar resolution, the global search index, SCM state, task runner pipelines), and all inference runs through VS Code's extension host worker thread model so the UI stays responsive regardless of what the model is doing.

The **Unified Context Engine** indexes the entire project and constructs a semantic representation of the codebase. This is what the model reasons over — not a buffer of recently opened files.

---

## Features

### AI Sidebar

A React-powered interface in the editor's auxiliary bar.

- Accepts text, images, and codebase references in a single prompt
- Runs multi-file operations autonomously — refactoring across a module, updating all usages of an interface, restructuring a directory — without step-by-step supervision
- A `ThoughtBlock` component surfaces the model's intermediate reasoning steps as they are generated

### Inline Editing &nbsp;`Cmd+K`

- Diffs are computed as structured patches and rendered as View Zones inside the active editor buffer
- Generation uses a 2,000+ line context window around the cursor to match existing conventions in the file

### Model Context Protocol (MCP)

Native MCP support at the platform layer, not an extension shim.

- Automatically discovers and registers local tools — filesystem, terminal, web search — without configuration
- Exposes a schema-validated bridge for connecting the AI engine to internal APIs

### Version Control

- **CodeX Commit** — derives commit messages from AST-level analysis of staged changes, not surface-level diffs
- Native push/pull with AI-assisted conflict resolution surfaced inside the merge workflow

---

## Bundled Extensions

| # | Extension | Location |
|---|---|---|
| 1 | CodeX Sync | `extensions/codex-sync` |
| 2 | CodeX Onboarding | `src/vs/workbench/contrib/onboarding` |
| 3 | CodeX Error Lens | `extensions/codex-error-lens` |
| 4 | CodeX Project Tree | `extensions/codex-project-tree` |
| 5 | CodeX Theme | `extensions/codex-theme` |
| 6 | CodeX Commit | `extensions/codex-commit` |
| 7 | CodeX Timeline | `extensions/codex-timeline` |
| 8 | CodeX Emulator | `extensions/emulator` |
| 9 | CodeX PDF Viewer | `extensions/codex-pdfviewer` |
| 10 | CodeX Path Intellisense | `extensions/codex-pathintellisense` |

---

## Installation

| Platform | Steps |
|---|---|
| **Windows** | Unzip `CodeX-win32-x64.zip` → run `codex.exe` |
| **macOS (Intel)** | Unzip `CodeX-darwin-x64.zip` → open `CodeX.app` |
| **macOS (Apple Silicon)** | Unzip `CodeX-darwin-arm64.zip` → open `CodeX.app` |
| **Linux** | Extract `CodeX-linux-x64.tar.gz` → run `./codex` |

---

## Troubleshooting

**macOS — "CodeX is damaged and can't be opened"**

macOS blocks unsigned apps. Move `CodeX.app` to your Applications folder, then run:

```sh
xattr -d com.apple.quarantine /Applications/CodeX.app
```

---

**Full changelog:** [github.com/Suryanshu-Nabheet/CodeX/commits/v0.0.1](https://github.com/Suryanshu-Nabheet/CodeX/commits/v0.0.1)
