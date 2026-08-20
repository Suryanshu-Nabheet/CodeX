import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type SkillCommand = {
  /** Slash name without leading slash, e.g. "review" → /review */
  name: string;
  description: string;
  /** Prompt body injected when the user runs the skill */
  body: string;
  source: string;
};

/**
 * Load markdown skill/slash commands from:
 *   ~/.codex/commands/*.md
 *   .codex/commands/*.md (cwd)
 *   .claude/commands/*.md (compat path)
 *
 * Frontmatter (optional):
 *   ---
 *   description: Short help text
 *   ---
 *   Prompt body with $ARGUMENTS
 */
export function loadSkillCommands(cwd = process.cwd()): Array<SkillCommand> {
  const dirs = [
    path.join(os.homedir(), ".codex", "commands"),
    path.join(cwd, ".codex", "commands"),
    path.join(cwd, ".claude", "commands"),
    path.join(cwd, ".claude", "skills"),
  ];

  const byName = new Map<string, SkillCommand>();

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      continue;
    }
    let entries: Array<string> = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      // skills/name/SKILL.md
      if (fs.statSync(full).isDirectory()) {
        const skillMd = path.join(full, "SKILL.md");
        if (fs.existsSync(skillMd)) {
          const parsed = parseSkillFile(entry, skillMd);
          if (parsed) {
            byName.set(parsed.name, parsed);
          }
        }
        continue;
      }
      if (!entry.endsWith(".md")) {
        continue;
      }
      const name = entry.replace(/\.md$/i, "");
      const parsed = parseSkillFile(name, full);
      if (parsed) {
        byName.set(parsed.name, parsed);
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

function parseSkillFile(
  name: string,
  filePath: string,
): SkillCommand | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    let description = `Custom skill (${path.basename(filePath)})`;
    let body = raw;

    if (raw.startsWith("---")) {
      const end = raw.indexOf("\n---", 3);
      if (end !== -1) {
        const fm = raw.slice(3, end).trim();
        body = raw.slice(end + 4).trim();
        const descMatch = fm.match(/^description:\s*(.+)$/im);
        if (descMatch?.[1]) {
          description = descMatch[1].trim().replace(/^["']|["']$/g, "");
        }
      }
    }

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug || !body.trim()) {
      return null;
    }

    return {
      name: slug,
      description,
      body: body.trim(),
      source: filePath,
    };
  } catch {
    return null;
  }
}

export function expandSkillArguments(
  body: string,
  args: string,
): string {
  return body.replace(/\$ARGUMENTS/g, args).replace(/\$0/g, args);
}
