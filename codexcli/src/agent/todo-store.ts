export type TodoStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type AgentTodo = {
  id: string;
  content: string;
  status: TodoStatus;
};

/** Session-scoped todo list the model maintains via `update_todos`. */
let currentTodos: Array<AgentTodo> = [];

export function getAgentTodos(): Array<AgentTodo> {
  return currentTodos.map((t) => ({ ...t }));
}

export function setAgentTodos(todos: Array<AgentTodo>): Array<AgentTodo> {
  currentTodos = todos.map((t) => ({
    id: String(t.id),
    content: String(t.content).trim(),
    status: normalizeStatus(t.status),
  }));
  return getAgentTodos();
}

export function clearAgentTodos(): void {
  currentTodos = [];
}

function normalizeStatus(status: unknown): TodoStatus {
  const s = String(status ?? "pending").toLowerCase();
  if (
    s === "pending" ||
    s === "in_progress" ||
    s === "completed" ||
    s === "cancelled"
  ) {
    return s;
  }
  if (s === "done" || s === "complete") {
    return "completed";
  }
  if (s === "active" || s === "doing") {
    return "in_progress";
  }
  return "pending";
}

export function formatTodosForModel(todos: Array<AgentTodo>): string {
  if (todos.length === 0) {
    return "Todo list cleared.";
  }
  const lines = todos.map((t, i) => {
    const mark =
      t.status === "completed"
        ? "[x]"
        : t.status === "in_progress"
          ? "[~]"
          : t.status === "cancelled"
            ? "[-]"
            : "[ ]";
    return `${i + 1}. ${mark} ${t.content} (${t.id})`;
  });
  return `Todos updated (${todos.length}):\n${lines.join("\n")}`;
}
