import { formatCommandForDisplay } from "./format-command.js";

export type FormattedToolCall = {
  /** Human tool verb, e.g. "Read", "List", "Bash" */
  label: string;
  /** Primary detail shown after the label (path, command, pattern) */
  detail: string;
  workdir?: string;
  /** Full one-line display: "Read src/foo.ts" */
  display: string;
};

const SHELL_TOOL_NAMES = new Set([
  "shell",
  "container.exec",
  "local_shell",
  "run_command",
]);

const TOOL_LABELS: Record<string, string> = {
  read_file: "Read",
  write_file: "Write",
  list_files: "List",
  apply_patch: "Patch",
  create_directory: "Create",
  delete_file: "Delete",
  move_file: "Move",
  search_files: "Search",
  update_todos: "Todos",
  explore: "Explore",
  shell: "Bash",
  "container.exec": "Bash",
  local_shell: "Bash",
  run_command: "Bash",
};

function parseArgsJson(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) {
    return undefined;
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw !== "string") {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed != null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toStringArray(value: unknown): Array<string> | undefined {
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value as Array<string>;
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return undefined;
}

function humanizeToolName(name: string): string {
  if (TOOL_LABELS[name]) {
    return TOOL_LABELS[name];
  }
  return name
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function firstStringishArg(args: Record<string, unknown>): string | undefined {
  const preferredKeys = [
    "path",
    "file",
    "filename",
    "command",
    "cmd",
    "query",
    "pattern",
    "source",
    "destination",
    "url",
  ];
  for (const key of preferredKeys) {
    const value = args[key];
    const asArr = toStringArray(value);
    if (asArr) {
      return asArr.join(" ");
    }
    const str = asString(value);
    if (str) {
      return str;
    }
  }
  for (const value of Object.values(args)) {
    const str = asString(value);
    if (str) {
      return str.length > 80 ? `${str.slice(0, 77)}…` : str;
    }
    const asArr = toStringArray(value);
    if (asArr) {
      const joined = asArr.join(" ");
      return joined.length > 80 ? `${joined.slice(0, 77)}…` : joined;
    }
  }
  return undefined;
}

/**
 * Format any tool call for a compact one-line TUI display.
 * Never returns raw JSON dumps.
 */
export function formatToolCallForDisplay(input: {
  name?: string;
  arguments?: unknown;
  /** Pre-parsed local shell command argv */
  command?: Array<string> | string;
  workdir?: string;
}): FormattedToolCall {
  const name = input.name?.trim() || "Tool";
  const args = parseArgsJson(input.arguments) ?? {};

  const cmdFromArgs =
    toStringArray(args["cmd"]) ?? toStringArray(args["command"]);
  const cmdFromInput = toStringArray(input.command);
  const cmd = cmdFromInput ?? cmdFromArgs;

  const workdir =
    input.workdir ??
    asString(args["workdir"]) ??
    asString(args["working_directory"]);

  if (SHELL_TOOL_NAMES.has(name) || cmd != null) {
    const detail =
      cmd != null
        ? formatCommandForDisplay(cmd)
        : (firstStringishArg(args) ?? "");
    const label = "Bash";
    return {
      label,
      detail,
      workdir,
      display: detail ? `${label} ${detail}` : label,
    };
  }

  const label = humanizeToolName(name);
  let detail: string | undefined;

  switch (name) {
    case "read_file":
    case "write_file":
    case "list_files":
    case "apply_patch":
    case "create_directory":
    case "delete_file":
      detail = asString(args["path"]) ?? ".";
      break;
    case "move_file": {
      const source = asString(args["source"]) ?? "?";
      const dest = asString(args["destination"]) ?? "?";
      detail = `${source} → ${dest}`;
      break;
    }
    case "search_files":
      detail = asString(args["pattern"]) ?? firstStringishArg(args);
      break;
    case "update_todos": {
      const todos = args["todos"];
      const n = Array.isArray(todos) ? todos.length : 0;
      detail = n > 0 ? `${n} item${n === 1 ? "" : "s"}` : "";
      break;
    }
    case "explore":
      detail = asString(args["goal"]) ?? firstStringishArg(args);
      break;
    default:
      detail = firstStringishArg(args);
      break;
  }

  const safeDetail = detail?.trim() || "";
  return {
    label,
    detail: safeDetail,
    workdir,
    display: safeDetail ? `${label} ${safeDetail}` : label,
  };
}
