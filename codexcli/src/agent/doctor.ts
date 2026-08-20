import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { CONFIG_DIR, CONFIG_JSON_FILEPATH } from "../config/config.js";
import { hasUsableApiKey } from "../config/user-env.js";
import { providers } from "../config/providers.js";
import { SESSIONS_DIR } from "../utils/storage.js";
import { loadSkillCommands } from "./skills.js";

/** Generate a starter AGENTS.md for the project (/init). */
export function writeAgentsMd(cwd = process.cwd()): string {
  const target = path.join(cwd, "AGENTS.md");
  if (fs.existsSync(target)) {
    return `AGENTS.md already exists at ${target}`;
  }
  const pkgName = readPackageName(cwd);
  const content = `# AGENTS.md

Project instructions for coding agents working in${pkgName ? ` **${pkgName}**` : " this repository"}.

## Overview
<!-- What this repo is and how it is structured -->

## Commands
\`\`\`bash
# install
# test
# lint
# build
\`\`\`

## Conventions
- Match existing style, imports, and patterns.
- Prefer small, focused diffs.
- Do not commit or push unless asked.

## Notes
<!-- Gotchas, architecture decisions, forbidden areas -->
`;
  fs.writeFileSync(target, content, "utf-8");
  return `Created ${target}`;
}

function readPackageName(cwd: string): string {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, "package.json"), "utf-8"),
    ) as { name?: string };
    return pkg.name?.trim() || "";
  } catch {
    return "";
  }
}

/** Environment and config health check (/doctor). */
export function runDoctor(opts: {
  model?: string;
  provider?: string;
}): string {
  const lines: Array<string> = ["CodexCLI doctor", ""];

  lines.push(`Node: ${process.version}`);
  lines.push(`Platform: ${process.platform} ${process.arch}`);
  lines.push(`Cwd: ${process.cwd()}`);
  lines.push(`Config dir: ${CONFIG_DIR}`);
  lines.push(
    `Config file: ${fs.existsSync(CONFIG_JSON_FILEPATH) ? "ok" : "missing"}`,
  );
  lines.push(
    `Sessions dir: ${SESSIONS_DIR} (${fs.existsSync(SESSIONS_DIR) ? "ok" : "will create on save"})`,
  );

  const provider = (opts.provider || "openai").toLowerCase();
  const providerCfg = providers[provider];
  lines.push(`Provider: ${provider}${providerCfg ? "" : " (unknown)"}`);
  lines.push(`Model: ${opts.model || "—"}`);

  if (providerCfg) {
    const keyOk = hasUsableApiKey(provider);
    lines.push(`API key: ${keyOk ? "configured" : "MISSING — run setup or /provider"}`);
  }

  const agentsMd = path.join(process.cwd(), "AGENTS.md");
  lines.push(`AGENTS.md: ${fs.existsSync(agentsMd) ? "found" : "missing — /init to create"}`);

  const skills = loadSkillCommands();
  lines.push(`Custom skills: ${skills.length}`);
  for (const s of skills.slice(0, 8)) {
    lines.push(`  /${s.name} ← ${s.source}`);
  }
  if (skills.length > 8) {
    lines.push(`  … +${skills.length - 8} more`);
  }

  const homeCommands = path.join(os.homedir(), ".codex", "commands");
  lines.push(
    `User commands dir: ${homeCommands} (${fs.existsSync(homeCommands) ? "ok" : "optional"})`,
  );

  lines.push("");
  lines.push("Checks complete.");
  return lines.join("\n");
}

/** Force the next user message into plan-only mode (no edits until approved). */
export const PLAN_MODE_PREFIX = `[PLAN MODE — active]
Do not edit files, run mutating shell commands, or apply patches yet.
1. Inspect the codebase with read-only tools if needed.
2. Produce a clear, ordered plan with risks and verification steps.
3. Stop and wait for the user to approve (e.g. "go ahead" or /approve).
`;
