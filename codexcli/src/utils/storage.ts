import fs from "fs";
import os from "os";
import path from "path";

/** Canonical session rollout directory (must match sessions overlay). */
export const SESSIONS_DIR = path.join(os.homedir(), ".codex", "sessions");

/** Legacy path from earlier builds — migrate once if present. */
const LEGACY_SESSIONS_DIR = path.join(os.homedir(), ".codexcli", "sessions");

export function ensureSessionsDir(): void {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  }
  // One-time copy of legacy session files that are missing in the new dir.
  if (!fs.existsSync(LEGACY_SESSIONS_DIR)) {
    return;
  }
  try {
    for (const entry of fs.readdirSync(LEGACY_SESSIONS_DIR)) {
      if (!entry.endsWith(".json")) {
        continue;
      }
      const dest = path.join(SESSIONS_DIR, entry);
      if (fs.existsSync(dest)) {
        continue;
      }
      fs.copyFileSync(path.join(LEGACY_SESSIONS_DIR, entry), dest);
    }
  } catch {
    /* ignore migration errors */
  }
}

export function saveRollout(sessionId: string, items: Array<unknown>): void {
  ensureSessionsDir();
  const rolloutFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  fs.writeFileSync(
    rolloutFile,
    JSON.stringify(
      {
        session: { timestamp: new Date().toISOString() },
        items,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
}
