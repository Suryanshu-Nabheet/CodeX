import type { AgentTodo } from "../../../agent/todo-store.js";

import { theme } from "../../theme.js";
import { Box, Text } from "ink";
import React from "react";

export function TodoListView({
  todos,
}: {
  todos: Array<AgentTodo>;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={0}>
      <Text bold color={theme.colors.accent}>
        Todos
      </Text>
      {todos.map((t) => {
        const glyph =
          t.status === "completed"
            ? theme.glyphs.checkboxDone
            : t.status === "cancelled"
              ? "·"
              : theme.glyphs.checkbox;
        const color =
          t.status === "in_progress"
            ? theme.colors.accent
            : t.status === "completed"
              ? theme.colors.muted
              : theme.colors.tool;
        return (
          <Text key={t.id} color={color}>
            {glyph} {t.content}
            {t.status === "in_progress" ? (
              <Text dimColor> ←</Text>
            ) : null}
          </Text>
        );
      })}
    </Box>
  );
}

/** Parse todos from update_todos tool arguments JSON. */
export function parseTodosFromToolArgs(
  raw: unknown,
): Array<AgentTodo> | null {
  let args: Record<string, unknown> | null = null;
  if (typeof raw === "string") {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (raw && typeof raw === "object") {
    args = raw as Record<string, unknown>;
  }
  if (!args || !Array.isArray(args["todos"])) {
    return null;
  }
  return (args["todos"] as Array<Record<string, unknown>>).map((t, i) => ({
    id: String(t["id"] ?? i),
    content: String(t["content"] ?? "").trim(),
    status: (String(t["status"] ?? "pending") as AgentTodo["status"]) ||
      "pending",
  }));
}
