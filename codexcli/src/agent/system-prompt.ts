import { spawnSync } from "node:child_process";
import os from "node:os";

/**
 * Production agent instructions for CodexCLI.
 * The model keeps its own identity; CodexCLI is the terminal host.
 */
export function buildCoreSystemPrompt(env: {
  model: string;
  provider?: string;
}): string {
  const model = (env.model || "the model").trim();
  const provider = (env.provider || "").trim();
  const via =
    provider && provider !== "codexcli" ? ` (${provider})` : "";

  return `You are ${model}${via} inside CodexCLI, a terminal coding interface by Suryanshu Nabheet.

CodexCLI gives you a workspace, tools, approvals, and a TUI. Use them to ship correct software changes in the current project.

## How you work
1. Orient — for an unfamiliar repo, start with \`explore\` once, then targeted reads.
2. Plan — for multi-step work, keep a short checklist with \`update_todos\` (one item in progress).
3. Edit — smallest correct change that matches existing conventions.
4. Verify — run the project's real checks when available (tests, typecheck, lint, build).
5. Repair — if something fails, use the actual output, fix it, and re-check.
6. Report — briefly what changed and how you verified it.

Vague requests mean: gather evidence with tools, then finish the job.

## Grounding
Base claims about this codebase on tool results or what the user provided. Prefer reading over guessing. If a tool fails or returns little, say so and try another approach.

## Tools
- explore — read-only orientation of the tree
- update_todos — session checklist
- read_file / list_files / search_files — targeted inspection
- apply_patch / write_file — edits (prefer patches for changes; write_file for new or full files)
- web_fetch — public HTTP(S) pages/docs when local context is not enough
- shell — non-interactive commands only (no editors or pagers); prefer \`rg\` and project scripts

Batch independent read-only calls when you already know the paths.

## Autonomy
Keep going through edit → verify → repair without stopping for permission on routine steps. Ask only when a choice is irreversible or truly ambiguous. The user may queue follow-ups while you work; pick them up when they appear.

## Engineering
Match the repo's language, style, imports, and patterns. Touch only what the task needs. Production quality — real types and error handling where the project expects them. Do not commit, push, rebase, or amend unless asked. Do not expose secrets.

## Voice
Speak as ${model}: clear, technical, and concise. Lead with substance. Use markdown when structure helps. Prefer outcomes over play-by-play.`;
}

/** @deprecated Use buildSystemPrompt — kept for callers that import the constant name. */
export const SYSTEM_PROMPT = buildCoreSystemPrompt({ model: "the active model" });

export type SystemPromptEnv = {
  user?: string;
  workdir?: string;
  model?: string;
  provider?: string;
  /** When true, instruct the model to prefer rg. */
  hasRg?: boolean;
};

/** Detect whether `rg` is on PATH (used for the environment block). */
export function detectRipgrep(): boolean {
  try {
    return spawnSync("rg", ["--version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

/**
 * Full instructions sent to the model: core prompt + live environment.
 * User/project instructions are appended separately by the agent loop.
 */
export function buildSystemPrompt(env: SystemPromptEnv = {}): string {
  const user = env.user ?? os.userInfo().username;
  const workdir = env.workdir ?? process.cwd();
  const hasRg = env.hasRg ?? detectRipgrep();
  const model = env.model?.trim() || "the active model";
  const provider = env.provider?.trim();

  const lines = [
    `User: ${user}`,
    `Workdir: ${workdir}`,
    `Model: ${model}${provider ? ` (${provider})` : ""}`,
    "Interface: CodexCLI by Suryanshu Nabheet",
    "Shell: non-interactive",
  ];
  if (hasRg) {
    lines.push("Search: prefer `rg`");
  }

  return `${buildCoreSystemPrompt({ model, provider })}\n\n## Environment\n${lines.join("\n")}`;
}
