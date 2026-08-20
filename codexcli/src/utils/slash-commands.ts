import { loadSkillCommands } from "../agent/skills.js";

// Defines the available slash commands and their descriptions.
// Used for autocompletion in the chat input and /help.
export interface SlashCommand {
  command: string;
  description: string;
}

export const SLASH_COMMANDS: Array<SlashCommand> = [
  {
    command: "/stop",
    description: "Stop the current turn; queued follow-ups run next",
  },
  {
    command: "/cancel",
    description: "Alias for /stop",
  },
  {
    command: "/resume",
    description: "Browse and resume a previous session",
  },
  {
    command: "/sessions",
    description: "Browse previous sessions",
  },
  {
    command: "/queue",
    description: "Show queued follow-ups (/queue clear to drop them)",
  },
  {
    command: "/status",
    description: "Show model, provider, approval, workdir, queue, and usage",
  },
  {
    command: "/cost",
    description: "Show session token usage",
  },
  {
    command: "/todos",
    description: "Show the agent's current todo list",
  },
  {
    command: "/pwd",
    description: "Show the current working directory",
  },
  {
    command: "/model",
    description: "Open model selection",
  },
  {
    command: "/provider",
    description: "Open provider selection",
  },
  {
    command: "/approval",
    description: "Open approval mode selection",
  },
  {
    command: "/compact",
    description: "Summarize context and free space",
  },
  {
    command: "/plan",
    description: "Ask for a plan only (no edits until you approve)",
  },
  {
    command: "/init",
    description: "Create a starter AGENTS.md in this project",
  },
  {
    command: "/doctor",
    description: "Run environment and config health checks",
  },
  {
    command: "/diff",
    description: "Show git diff of the working tree",
  },
  {
    command: "/history",
    description: "Open command history for this session",
  },
  {
    command: "/clear",
    description: "Clear the screen and conversation context",
  },
  {
    command: "/new",
    description: "Start a fresh chat (alias for /clear)",
  },
  {
    command: "/clearhistory",
    description: "Clear persisted command history",
  },
  {
    command: "/bug",
    description: "Generate a prefilled GitHub issue URL",
  },
  {
    command: "/help",
    description: "Show all commands",
  },
  {
    command: "/exit",
    description: "Quit CodexCLI",
  },
  {
    command: "/quit",
    description: "Quit CodexCLI",
  },
];

/** Built-ins plus project/user skills from .codex/commands and .claude/commands. */
export function getAllSlashCommands(): Array<SlashCommand> {
  const skills = loadSkillCommands().map((s) => ({
    command: `/${s.name}`,
    description: s.description,
  }));
  const seen = new Set(SLASH_COMMANDS.map((c) => c.command));
  const extras = skills.filter((s) => !seen.has(s.command));
  return [...SLASH_COMMANDS, ...extras];
}

export function isKnownSlashCommand(input: string): boolean {
  const cmd = input.trim().split(/\s+/)[0] ?? "";
  if (SLASH_COMMANDS.some((c) => c.command === cmd)) {
    return true;
  }
  const name = cmd.replace(/^\//, "");
  return loadSkillCommands().some((s) => s.name === name);
}
