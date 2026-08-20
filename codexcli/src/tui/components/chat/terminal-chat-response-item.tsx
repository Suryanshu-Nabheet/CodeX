import type { OverlayModeType } from "./terminal-chat.js";
import type { FileOpenerScheme } from "../../../config/config.js";
import type {
  ResponseFunctionToolCallItem,
  ResponseFunctionToolCallOutputItem,
  ResponseInputMessageItem,
  ResponseItem,
  ResponseOutputMessage,
  ResponseReasoningItem,
} from "../../../utils/responses.js";
import type { TerminalRendererOptions } from "marked-terminal";

import { collapseXmlBlocks } from "../../../utils/file-tag-utils.js";
import { formatToolCallForDisplay } from "../../../utils/format-tool-call.js";
import { parseToolCallOutput } from "../../../utils/parsers.js";
import { useTerminalSize } from "../../hooks/use-terminal-size.js";
import { theme } from "../../theme.js";
import { PlanView, tryParsePlan } from "./plan-view.js";
import {
  TodoListView,
  parseTodosFromToolArgs,
} from "./todo-list-view.js";
import chalk from "chalk";
import { highlight } from "cli-highlight";
import { Box, Text } from "ink";
import { parse, setOptions } from "marked";
import TerminalRenderer from "marked-terminal";
import path from "path";
import React, { useEffect, useMemo } from "react";
import supportsHyperlinks from "supports-hyperlinks";

export default function TerminalChatResponseItem({
  item,
  fullStdout = false,
  setOverlayMode,
  fileOpener,
}: {
  item: ResponseItem;
  fullStdout?: boolean;
  setOverlayMode?: React.Dispatch<React.SetStateAction<OverlayModeType>>;
  fileOpener: FileOpenerScheme | undefined;
}): React.ReactElement {
  switch (item.type) {
    case "message":
      return (
        <TerminalChatResponseMessage
          setOverlayMode={setOverlayMode}
          message={item}
          fileOpener={fileOpener}
        />
      );
    case "local_shell_call":
    case "function_call":
      return <TerminalChatResponseToolCall message={item} />;
    case "local_shell_call_output":
    case "function_call_output":
      return (
        <TerminalChatResponseToolCallOutput
          message={item}
          fullStdout={fullStdout}
        />
      );
    default:
      break;
  }

  if (item.type === "reasoning") {
    return (
      <TerminalChatResponseReasoning message={item} fileOpener={fileOpener} />
    );
  }


  // Fallback: If item has name and arguments but missing type/incorrect type, treat as function call
  // This handles specific cases where the model response might be malformed or raw
  if (
    "name" in item &&
    "arguments" in item &&
    item.type !== "message"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <TerminalChatResponseToolCall message={{ ...item, type: "function_call" } as any} />;
  }

  return <TerminalChatResponseGenericMessage message={item} />;
}

// TODO: this should be part of `ResponseReasoningItem`. Also it doesn't work.
// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Guess how long the assistant spent "thinking" based on the combined length
 * of the reasoning summary. The calculation itself is fast, but wrapping it in
 * `useMemo` in the consuming component ensures it only runs when the
 * `summary` array actually changes.
 */
// TODO: use actual thinking time
//
// function guessThinkingTime(summary: Array<ResponseReasoningItem.Summary>) {
//   const totalTextLength = summary
//     .map((t) => t.text.length)
//     .reduce((a, b) => a + b, summary.length - 1);
//   return Math.max(1, Math.ceil(totalTextLength / 300));
// }

export function TerminalChatResponseReasoning({
  message,
  fileOpener: _fileOpener,
}: {
  message: ResponseReasoningItem & { duration_ms?: number };
  fileOpener: FileOpenerScheme | undefined;
}): React.ReactElement | null {
  const summary = message["summary"];
  if (!summary || (Array.isArray(summary) && summary.length === 0)) {
    return null;
  }
  return (
    <Box flexDirection="column" marginY={0}>
      {(message["summary"] as Array<{ headline?: string; text: string }>).map(
        (entry, key: number) => {
          const plan = tryParsePlan(
            [entry.headline, entry.text].filter(Boolean).join("\n"),
          );
          if (plan) {
            return <PlanView key={key} plan={plan} />;
          }
          return (
            <Box key={key} flexDirection="column" marginBottom={1}>
              {entry.headline ? (
                <Text>
                  <Text color={theme.colors.muted}>{theme.glyphs.bullet} </Text>
                  <Text bold>{entry.headline}</Text>
                </Text>
              ) : null}
              <Box flexDirection="row">
                {!entry.headline ? (
                  <Text color={theme.colors.muted}>{theme.glyphs.bullet} </Text>
                ) : (
                  <Text>{"  "}</Text>
                )}
                <Box flexGrow={1}>
                  <Text color={theme.colors.reasoning} dimColor>
                    {entry.text}
                  </Text>
                </Box>
              </Box>
            </Box>
          );
        },
      )}
    </Box>
  );
}

function messagePlainText(
  message: ResponseInputMessageItem | ResponseOutputMessage,
): string {
  return (message.content || [])
    .map((c) => {
      if (c.type === "output_text") {
        return (c as { text: string }).text;
      }
      if (c.type === "input_text") {
        return collapseXmlBlocks((c as { text: string }).text);
      }
      if (c.type === "input_image") {
        return "<Image>";
      }
      if (c.type === "input_file") {
        return (c as unknown as { filename: string }).filename;
      }
      if (c.type === "refusal") {
        return (c as unknown as { refusal: string }).refusal;
      }
      return "";
    })
    .join(" ")
    .trim();
}

/** Quiet user turn label — no full-width fill. */
export function UserPromptBar({ text }: { text: string }): React.ReactElement {
  return (
    <Box marginY={1} flexDirection="row">
      <Text color={theme.colors.userPrompt} bold>
        {theme.glyphs.prompt}{" "}
      </Text>
      <Text color={theme.colors.userText}>{text}</Text>
    </Box>
  );
}

function TerminalChatResponseMessage({
  message,
  setOverlayMode,
  fileOpener,
}: {
  message: ResponseInputMessageItem | ResponseOutputMessage;
  setOverlayMode?: React.Dispatch<React.SetStateAction<OverlayModeType>>;
  fileOpener: FileOpenerScheme | undefined;
}) {
  useEffect(() => {
    if (message.role === "system" && message.content) {
      const systemMessage = (message.content as unknown as Array<{
        type: string;
        text?: string;
      }>).find((c) => c.type === "input_text")?.text;
      if (systemMessage?.includes("model_not_found")) {
        setOverlayMode?.("model");
      }
    }
  }, [message, setOverlayMode]);

  const plain = messagePlainText(message);

  if (message.role === "user") {
    return <UserPromptBar text={plain} />;
  }

  if (message.role === "system") {
    return (
      <Box flexDirection="column" marginY={1}>
        <Text dimColor>
          <Text>{theme.glyphs.bullet} </Text>
          {plain}
        </Text>
      </Box>
    );
  }

  // Assistant — no role label; plan blocks get structured UI.
  // While tokens are still arriving, render plain text (cheap + stable);
  // markdown runs once the stream completes.
  const streaming =
    (message as { status?: string }).status === "in_progress";
  const plan = streaming ? null : tryParsePlan(plain);
  return (
    <Box flexDirection="column" marginBottom={1}>
      {plan ? (
        <PlanView plan={plan} />
      ) : streaming ? (
        <Text>
          {plain}
          <Text color={theme.colors.muted}>▋</Text>
        </Text>
      ) : (
        <Box flexDirection="column">
          <Markdown fileOpener={fileOpener}>{plain}</Markdown>
        </Box>
      )}
      {message.content?.map((c, idx: number) => {
        if (c.type === "function_call" || c.type === "local_shell_call") {
          return <TerminalChatResponseToolCall key={idx} message={c} />;
        }
        return null;
      })}
    </Box>
  );
}

function TerminalChatResponseToolCall({
  message,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: ResponseFunctionToolCallItem | any;
}) {
  const todos = useMemo(() => {
    if (message?.name === "update_todos") {
      return parseTodosFromToolArgs(message.arguments);
    }
    return null;
  }, [message]);

  const formatted = useMemo(() => {
    if (message.type === "local_shell_call") {
      const action = message.action;
      return formatToolCallForDisplay({
        name: "local_shell",
        command: action?.command,
        workdir: action?.working_directory,
      });
    }
    return formatToolCallForDisplay({
      name: message.name,
      arguments: message.arguments,
    });
  }, [message]);

  if (todos && todos.length > 0) {
    return (
      <Box marginY={0}>
        <TodoListView todos={todos} />
      </Box>
    );
  }

  return (
    <Box flexDirection="row" marginTop={0}>
      <Text color={theme.colors.muted}>{theme.glyphs.tool} </Text>
      <Text>
        <Text bold color={theme.colors.tool}>
          {formatted.label}
        </Text>
        {formatted.detail ? (
          <Text color={theme.colors.toolDetail}> {formatted.detail}</Text>
        ) : null}
      </Text>
    </Box>
  );
}

function TerminalChatResponseToolCallOutput({
  message,
  fullStdout,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  message: ResponseFunctionToolCallOutputItem | any;
  fullStdout: boolean;
}) {
  const { output, metadata } = parseToolCallOutput(message.output);
  const { exit_code, duration_seconds } = metadata;
  const lineCount = output.length === 0 ? 0 : output.split("\n").length;
  const failed = typeof exit_code === "number" && exit_code !== 0;
  const showBody = fullStdout || failed;

  const summary = useMemo(() => {
    const parts: Array<string> = [];
    if (typeof exit_code === "number") {
      parts.push(`exit ${exit_code}`);
    }
    if (lineCount > 0) {
      parts.push(`${lineCount} line${lineCount === 1 ? "" : "s"}`);
    }
    if (typeof duration_seconds === "number") {
      parts.push(`${duration_seconds}s`);
    }
    return parts.join(` ${theme.glyphs.sep} `);
  }, [exit_code, duration_seconds, lineCount]);

  let displayedContent = output;
  if (!fullStdout && failed) {
    const lines = displayedContent.split("\n");
    if (lines.length > 4) {
      const head = lines.slice(0, 4);
      const remaining = lines.length - 4;
      displayedContent = [...head, `… (${remaining} more lines)`].join("\n");
    }
  }

  const colorizedContent = displayedContent
    .split("\n")
    .map((line) => {
      if (line.startsWith("+") && !line.startsWith("++")) {
        return chalk.green(line);
      }
      if (line.startsWith("-") && !line.startsWith("--")) {
        return chalk.red(line);
      }
      return line;
    })
    .join("\n");

  // Successful quiet outputs stay collapsed — keep scrollback brief
  if (!showBody) {
    return (
      <Text dimColor>
        {"  "}
        {theme.glyphs.tree}{" "}
        {failed ? theme.glyphs.fail : theme.glyphs.ok}
        {summary ? ` ${summary}` : ""}
      </Text>
    );
  }

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text dimColor>
        {failed ? theme.glyphs.fail : theme.glyphs.ok}
        {summary ? ` ${summary}` : ""}
      </Text>
      {output.length > 0 ? <Text dimColor>{colorizedContent}</Text> : null}
    </Box>
  );
}

export function TerminalChatResponseGenericMessage({
  message,
}: {
  message: ResponseItem;
}): React.ReactElement {
  if (
    "name" in message &&
    typeof (message as { name?: unknown }).name === "string"
  ) {
    const formatted = formatToolCallForDisplay({
      name: (message as { name: string }).name,
      arguments: (message as { arguments?: unknown }).arguments,
    });
    return (
      <Text>
        <Text color={theme.colors.muted}>{theme.glyphs.tool} </Text>
        <Text bold>{formatted.display}</Text>
      </Text>
    );
  }
  return <Text dimColor>[unsupported message]</Text>;
}

export type MarkdownProps = TerminalRendererOptions & {
  children: string;
  fileOpener: FileOpenerScheme | undefined;
  /** Base path for resolving relative file citation paths. */
  cwd?: string;
};

const codeTheme = {
  keyword: chalk.cyan,
  built_in: chalk.cyan,
  type: chalk.cyan,
  literal: chalk.yellow,
  number: chalk.yellow,
  regexp: chalk.yellow,
  string: chalk.green,
  subst: chalk.white,
  symbol: chalk.cyan,
  class: chalk.white,
  function: chalk.white,
  title: chalk.white,
  params: chalk.white,
  comment: chalk.gray,
  doctag: chalk.cyan,
  meta: chalk.gray,
  attribute: chalk.white,
  attr: chalk.white,
  variable: chalk.white,
  tag: chalk.cyan,
  name: chalk.cyan,
  builtin_name: chalk.white,
  section: chalk.white,
  bullet: chalk.cyan,
  code: chalk.white,
  emphasis: chalk.italic,
  strong: chalk.bold,
  formula: chalk.gray,
  link: chalk.cyan,
  quote: chalk.gray,
  selector_tag: chalk.cyan,
  selector_id: chalk.white,
  selector_class: chalk.white,
  selector_attr: chalk.cyan,
  selector_pseudo: chalk.cyan,
  template_tag: chalk.cyan,
  template_variable: chalk.white,
  addition: chalk.green,
  deletion: chalk.red,
};

export function Markdown({
  children,
  fileOpener,
  cwd,
  ...options
}: MarkdownProps): React.ReactElement {
  const size = useTerminalSize();

  const rendered = React.useMemo(() => {
    const linkifiedMarkdown = rewriteFileCitations(children, fileOpener, cwd);
    const width = Math.max(40, size.columns - 4);

    // Configure marked for this specific render
    setOptions({
      highlight: (code: string, language: string) => {
        try {
          return highlight(code, {
            language: language || "plaintext",
            ignoreIllegals: true,
            theme: codeTheme,
          });
        } catch {
          return code;
        }
      },
      // @ts-expect-error missing parser, space props
      renderer: new TerminalRenderer({
        width,
        reflowText: true,
        showSectionPrefix: false,
        tab: 2,
        emoji: false,
        firstHeading: chalk.bold.white,
        heading: chalk.bold.white,
        strong: chalk.bold.white,
        em: chalk.italic.gray,
        codespan: chalk.cyan,
        code: chalk.white,
        blockquote: chalk.gray.italic,
        listitem: chalk.white,
        link: chalk.cyan,
        href: chalk.cyan.underline,
        del: chalk.dim.strikethrough,
        hr: () => chalk.dim("─".repeat(Math.min(width, 48))),
        ...options,
      }),
    });
    const parsed = parse(linkifiedMarkdown, { async: false }).trim();

    return parsed;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- options is an object of primitives
  }, [
    children,
    size.columns,
    size.rows,
    fileOpener,
    supportsHyperlinks.stdout,
    chalk.level,
  ]);

  return <Text>{rendered}</Text>;
}

/** Regex to match citations for source files (hence the `F:` prefix). */
const citationRegex = new RegExp(
  [
    // Opening marker
    "【",

    // Capture group 1: file ID or name (anything except '†')
    "F:([^†]+)",

    // Field separator
    "†",

    // Capture group 2: start line (digits)
    "L(\\d+)",

    // Non-capturing group for optional end line
    "(?:",

    // Capture group 3: end line (digits or '?')
    "-L(\\d+|\\?)",

    // End of optional group (may not be present)
    ")?",

    // Closing marker
    "】",
  ].join(""),
  "g", // Global flag
);

function rewriteFileCitations(
  markdown: string,
  fileOpener: FileOpenerScheme | undefined,
  cwd: string = process.cwd(),
): string {
  citationRegex.lastIndex = 0;
  return markdown.replace(citationRegex, (_match, file, start, _end) => {
    const absPath = path.resolve(cwd, file);
    if (!fileOpener) {
      return `[${file}](${absPath})`;
    }
    const uri = `${fileOpener}://file${absPath}:${start}`;
    const label = `${file}:${start}`;
    // In practice, sometimes multiple citations for the same file, but with a
    // different line number, are shown sequentially, so we:
    // - include the line number in the label to disambiguate them
    // - add a space after the link to make it easier to read
    return `[${label}](${uri}) `;
  });
}
