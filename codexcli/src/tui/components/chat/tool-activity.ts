import type { ResponseItem } from "../../../utils/responses.js";

import { formatToolCallForDisplay } from "../../../utils/format-tool-call.js";

/** Tools that spam the scrollback if shown one-by-one — keep in the live status only. */
const QUIET_TOOL_NAMES = new Set([
  "read_file",
  "list_files",
  "search_files",
]);

export function getToolCallName(item: ResponseItem): string | undefined {
  if (item.type === "local_shell_call") {
    return "local_shell";
  }
  if (item.type === "function_call") {
    return (item as { name?: string }).name;
  }
  if ("name" in item && typeof (item as { name?: string }).name === "string") {
    return (item as { name: string }).name;
  }
  return undefined;
}

export function isToolCallItem(item: ResponseItem): boolean {
  return (
    item.type === "function_call" ||
    item.type === "local_shell_call" ||
    (typeof item.type === "string" &&
      "name" in item &&
      "arguments" in item &&
      item.type !== "message")
  );
}

export function isToolOutputItem(item: ResponseItem): boolean {
  return (
    item.type === "function_call_output" ||
    item.type === "local_shell_call_output"
  );
}

function isFailedToolOutput(item: ResponseItem): boolean {
  if (!isToolOutputItem(item)) {
    return false;
  }
  const raw = (item as { output?: string }).output;
  if (typeof raw !== "string") {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as { metadata?: { exit_code?: number } };
    const code = parsed?.metadata?.exit_code;
    return typeof code === "number" && code !== 0;
  } catch {
    return false;
  }
}

/**
 * Whether an item should burn into Ink <Static> history.
 * Quiet recon tools stay off the scrollback; writes / bash / todos / explore stay.
 */
export function shouldPersistInHistory(item: ResponseItem): boolean {
  if (isToolCallItem(item)) {
    const name = getToolCallName(item);
    if (name && QUIET_TOOL_NAMES.has(name)) {
      return false;
    }
    return true;
  }
  if (isToolOutputItem(item)) {
    // Only keep failed outputs — success is noise under the tool row.
    return isFailedToolOutput(item);
  }
  return true;
}

/** Latest human-readable activity line for the working spinner. */
export function latestActivityLabel(
  items: Array<ResponseItem>,
): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    if (!isToolCallItem(item)) {
      continue;
    }
    if (item.type === "local_shell_call") {
      const action = (item as { action?: { command?: Array<string> } }).action;
      return formatToolCallForDisplay({
        name: "local_shell",
        command: action?.command,
      }).display;
    }
    return formatToolCallForDisplay({
      name: (item as { name?: string }).name,
      arguments: (item as { arguments?: unknown }).arguments,
    }).display;
  }
  return undefined;
}
