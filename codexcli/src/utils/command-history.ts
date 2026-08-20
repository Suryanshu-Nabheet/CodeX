import fs from "fs";
import os from "os";
import path from "path";

export interface HistoryEntry {
  command: string;
  timestamp: number;
}

const HISTORY_FILE = path.join(os.homedir(), ".codex", "history.json");

export interface HistoryConfig {
  maxSize: number;
  saveHistory: boolean;
  sensitivePatterns: Array<string>;
}

export async function loadCommandHistory(): Promise<Array<HistoryEntry>> {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const content = fs.readFileSync(HISTORY_FILE, "utf-8");
      const data = JSON.parse(content);
      if (Array.isArray(data)) {
        return data; // Assuming data is HistoryEntry[]
      }
    }
  } catch (error) {
    // ignore
  }
  return [];
}

export async function addToHistory(
  command: string,
  history: Array<HistoryEntry>,
  config: HistoryConfig,
): Promise<Array<HistoryEntry>> {
  if (!config.saveHistory) {
    return history;
  }

  // Basic sensitive pattern check
  for (const pattern of config.sensitivePatterns) {
    if (new RegExp(pattern).test(command)) {
      return history;
    }
  }

  const newEntry: HistoryEntry = { command, timestamp: Date.now() };
  // Remove duplicates at the end to mimic shell history behavior (optional)
  const newHistory = [...history, newEntry];

  if (newHistory.length > config.maxSize) {
    newHistory.splice(0, newHistory.length - config.maxSize);
  }

  saveCommandHistory(newHistory);
  return newHistory;
}

export async function clearCommandHistory(): Promise<void> {
  saveCommandHistory([]);
}

function saveCommandHistory(history: Array<HistoryEntry>) {
  try {
    const dir = path.dirname(HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (error) {
    // ignore
  }
}
