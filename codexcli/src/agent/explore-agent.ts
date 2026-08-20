import { FilesystemController } from "../fs/filesystem-controller.js";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

const MAX_FILE_BYTES = 24_000;
const MAX_FILES_READ = 8;

/**
 * Lightweight read-only subagent: orient on the repo for a goal and return a
 * compact briefing so the main agent skips dozens of noisy list/read calls.
 */
export async function runExploreAgent(args: {
  goal: string;
  focus_paths?: Array<string>;
}): Promise<string> {
  const goal = (args.goal || "").trim() || "Understand the repository structure";
  const focus = (args.focus_paths ?? []).filter(Boolean).slice(0, 12);
  const fs = new FilesystemController();
  const sections: Array<string> = [`# Explore: ${goal}`];

  // Root listing (non-recursive noise filter)
  try {
    const root = await fs.listFiles(".");
    const interesting = root
      .filter((name) => !name.startsWith(".") || name === ".env.example")
      .filter(
        (name) =>
          ![
            "node_modules",
            "dist",
            "build",
            "coverage",
            ".git",
          ].includes(name),
      )
      .slice(0, 60);
    sections.push(`## Top-level\n${interesting.join("\n") || "(empty)"}`);
  } catch (err) {
    sections.push(`## Top-level\n(error: ${String(err)})`);
  }

  // Manifest / docs
  const manifests = [
    "package.json",
    "README.md",
    "AGENTS.md",
    "tsconfig.json",
    "Cargo.toml",
    "pyproject.toml",
    "go.mod",
  ];
  for (const path of manifests) {
    if (!existsSync(path)) {
      continue;
    }
    try {
      const st = statSync(path);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) {
        continue;
      }
      const text = readFileSync(path, "utf-8");
      sections.push(
        `## ${path}\n\`\`\`\n${truncate(text, MAX_FILE_BYTES)}\n\`\`\``,
      );
    } catch {
      /* skip */
    }
  }

  // Focus paths the caller named
  let reads = 0;
  for (const path of focus) {
    if (reads >= MAX_FILES_READ) {
      break;
    }
    if (!existsSync(path)) {
      sections.push(`## ${path}\n(missing)`);
      continue;
    }
    try {
      const st = statSync(path);
      if (st.isDirectory()) {
        const files = await fs.listFiles(path);
        sections.push(
          `## ${path}/ (dir)\n${files.slice(0, 40).join("\n") || "(empty)"}`,
        );
      } else if (st.isFile() && st.size <= MAX_FILE_BYTES * 2) {
        const text = await fs.readFile(path);
        sections.push(
          `## ${path}\n\`\`\`\n${truncate(text, MAX_FILE_BYTES)}\n\`\`\``,
        );
        reads += 1;
      }
    } catch (err) {
      sections.push(`## ${path}\n(error: ${String(err)})`);
    }
  }

  // Keyword search from the goal (best-effort via rg)
  const keywords = extractKeywords(goal);
  if (keywords.length > 0 && hasRg()) {
    const pattern = keywords.map(escapeRg).join("|");
    const result = spawnSync(
      "rg",
      ["-n", "--hidden", "-g", "!node_modules", "-g", "!.git", "-m", "40", pattern, "."],
      { encoding: "utf-8", maxBuffer: 512_000 },
    );
    const out = (result.stdout || "").trim();
    if (out) {
      sections.push(`## Search hits (${keywords.join(", ")})\n${out}`);
    }
  }

  // src sketch
  if (existsSync("src") && reads < MAX_FILES_READ) {
    try {
      const files = await fs.listFilesRecursive("src");
      const sample = files
        .filter((f) => /\.(ts|tsx|js|jsx|py|go|rs)$/.test(f))
        .slice(0, 40);
      sections.push(`## src/ sketch\n${sample.join("\n") || "(no source files)"}`);
    } catch {
      /* skip */
    }
  }

  sections.push(
    "## Guidance\nUse this briefing instead of re-listing the whole tree. Read only the specific files you still need, then act.",
  );

  return sections.join("\n\n");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}\n…(truncated)`;
}

function extractKeywords(goal: string): Array<string> {
  const stop = new Set([
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "about",
    "entire",
    "codebase",
    "project",
    "please",
    "analyze",
    "analise",
    "understand",
    "explain",
  ]);
  return goal
    .toLowerCase()
    .split(/[^a-z0-9_/-]+/)
    .filter((w) => w.length >= 3 && !stop.has(w))
    .slice(0, 5);
}

function escapeRg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasRg(): boolean {
  try {
    return spawnSync("rg", ["--version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}
