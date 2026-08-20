import { FilesystemController } from "../fs/filesystem-controller.js";
import { PatchApplier } from "../patch/patch-applier.js";
import { runExploreAgent } from "./explore-agent.js";
import {
  formatTodosForModel,
  setAgentTodos,
  type AgentTodo,
} from "./todo-store.js";
import { webFetch } from "./web-fetch.js";
import { createTwoFilesPatch } from "diff";

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute(args: Record<string, any>): Promise<string>;
  requiresApproval: boolean;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private fs: FilesystemController;
  private patch: PatchApplier;

  constructor() {
    this.fs = new FilesystemController();
    this.patch = new PatchApplier();
    this.registerDefaultTools();
  }

  private registerDefaultTools() {
    this.register({
      name: "read_file",
      description: "Read the contents of a file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file to read.",
          },
        },
        required: ["path"],
      },
      requiresApproval: false,
      execute: async ({ path }) => this.fs.readFile(path),
    });

    this.register({
      name: "write_file",
      description: "Write content to a file. Overwrites if exists.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file to write.",
          },
          content: { type: "string", description: "The content to write." },
        },
        required: ["path", "content"],
      },
      requiresApproval: true,
      execute: async (rawArgs) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { path, content } = rawArgs as any;
        let oldContent = "";
        try {
          oldContent = await this.fs.readFile(path);
        } catch (e) {
          // File doesn't exist, treat as empty
        }
        await this.fs.writeFile(path, content);

        const diff = createTwoFilesPatch(
          path,
          path,
          oldContent,
          content,
          "Original",
          "Modified",
        );
        return diff;
      },
    });

    this.register({
      name: "list_files",
      description: "List files in a directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The directory path (default: .)",
          },
          recursive: {
            type: "boolean",
            description: "Whether to list files recursively.",
          },
        },
      },
      requiresApproval: false,
      execute: async ({ path = ".", recursive = false }) => {
        const files = recursive
          ? await this.fs.listFilesRecursive(path)
          : await this.fs.listFiles(path);
        return files.join("\n");
      },
    });

    this.register({
      name: "apply_patch",
      description: "Apply a unified diff patch to a file.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file to patch.",
          },
          patch: { type: "string", description: "The unified diff content." },
        },
        required: ["path", "patch"],
      },
      requiresApproval: true,
      execute: async ({ path, patch }) => {
        await this.patch.applyUnifiedDiff(path, patch);
        return `Patch applied successfully to ${path}.`;
      },
    });

    this.register({
      name: "create_directory",
      description: "Create a new directory (and parent directories if needed).",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The directory path to create.",
          },
        },
        required: ["path"],
      },
      requiresApproval: true,
      execute: async ({ path }) => {
        await this.fs.createDirectory(path);
        return `Directory ${path} created successfully.`;
      },
    });

    this.register({
      name: "delete_file",
      description: "Delete a file or directory.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path of the file/directory to delete.",
          },
        },
        required: ["path"],
      },
      requiresApproval: true,
      execute: async ({ path }) => {
        await this.fs.deleteFile(path);
        return `${path} deleted successfully.`;
      },
    });

    this.register({
      name: "move_file",
      description: "Move or rename a file/directory.",
      parameters: {
        type: "object",
        properties: {
          source: { type: "string", description: "The source path." },
          destination: { type: "string", description: "The destination path." },
        },
        required: ["source", "destination"],
      },
      requiresApproval: true,
      execute: async ({ source, destination }) => {
        await this.fs.moveFile(source, destination);
        return `Moved ${source} to ${destination} successfully.`;
      },
    });

    this.register({
      name: "search_files",
      description: "Search for files by name pattern or content.",
      parameters: {
        type: "object",
        properties: {
          pattern: {
            type: "string",
            description: "The search pattern (glob or regex).",
          },
          searchContent: {
            type: "boolean",
            description: "Whether to search file contents (default: false).",
          },
        },
        required: ["pattern"],
      },
      requiresApproval: false,
      execute: async ({ pattern, searchContent = false }) => {
        const results = searchContent
          ? await this.fs.searchFileContents(pattern)
          : await this.fs.searchFiles(pattern);

        if (
          Array.isArray(results) &&
          results.length > 0 &&
          typeof results[0] === "object"
        ) {
          return results
            .map(
              (r) =>
                `${(r as any).path}:${(r as any).line}: ${(r as any).content}`,
            )
            .join("\n");
        }
        return (results as Array<string>).join("\n");
      },
    });

    this.register({
      name: "update_todos",
      description:
        "Create or replace the session todo checklist for multi-step work. " +
        "Call at the start of complex tasks and whenever item status changes. " +
        "Keep 3–8 concrete items; mark exactly one in_progress when working.",
      parameters: {
        type: "object",
        properties: {
          todos: {
            type: "array",
            description: "Full replacement todo list",
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "Stable short id" },
                content: {
                  type: "string",
                  description: "What to do",
                },
                status: {
                  type: "string",
                  description:
                    "pending | in_progress | completed | cancelled",
                },
              },
              required: ["id", "content", "status"],
            },
          },
        },
        required: ["todos"],
      },
      requiresApproval: false,
      execute: async ({ todos }) => {
        const list = Array.isArray(todos) ? (todos as Array<AgentTodo>) : [];
        const saved = setAgentTodos(list);
        return formatTodosForModel(saved);
      },
    });

    this.register({
      name: "explore",
      description:
        "Read-only subagent: quickly map the repo for a goal and return a " +
        "compact briefing (tree, manifests, focused files, search hits). " +
        "Prefer this over dozens of list_files/read_file calls for orientation.",
      parameters: {
        type: "object",
        properties: {
          goal: {
            type: "string",
            description: "What you need to understand or find",
          },
          focus_paths: {
            type: "array",
            items: { type: "string" },
            description: "Optional paths to inspect first",
          },
        },
        required: ["goal"],
      },
      requiresApproval: false,
      execute: async (raw) => {
        const goal = typeof raw["goal"] === "string" ? raw["goal"] : "";
        const focus_paths = Array.isArray(raw["focus_paths"])
          ? (raw["focus_paths"] as Array<unknown>).filter(
              (p): p is string => typeof p === "string",
            )
          : undefined;
        return runExploreAgent({ goal, focus_paths });
      },
    });

    this.register({
      name: "web_fetch",
      description:
        "Fetch a public HTTP(S) URL and return readable text (HTML stripped). " +
        "Use for docs, changelogs, or APIs when local context is insufficient. " +
        "Do not use for secrets or authenticated endpoints.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Absolute http(s) URL to fetch",
          },
          max_chars: {
            type: "number",
            description: "Max characters to return (default 40000)",
          },
        },
        required: ["url"],
      },
      requiresApproval: false,
      execute: async (raw) => {
        const url = typeof raw["url"] === "string" ? raw["url"] : "";
        const max =
          typeof raw["max_chars"] === "number" && Number.isFinite(raw["max_chars"])
            ? Math.max(1000, Math.floor(raw["max_chars"]))
            : undefined;
        return webFetch(url, max);
      },
    });
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): Array<Tool> {
    return Array.from(this.tools.values());
  }
}
