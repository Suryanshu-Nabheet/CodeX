import type { MultilineTextEditorHandle } from "./multiline-editor";
import type { ReviewDecision } from "../../../agent/review.js";
import type { HistoryEntry } from "../../../utils/command-history.js";
import type { FileSystemSuggestion } from "../../../utils/file-system-suggestions.js";
import type {
  ResponseInputItem,
  ResponseItem,
} from "../../../utils/responses.js";

import MultilineTextEditor from "./multiline-editor";
import TerminalChatInputThinking from "./terminal-chat-input-thinking.js";
import { TerminalChatCommandReview } from "./terminal-chat-command-review.js";
import TextCompletions from "./terminal-chat-completions.js";
import { loadConfig } from "../../../config/config.js";
import {
  loadCommandHistory,
  addToHistory,
} from "../../../utils/command-history.js";
import { getFileSystemSuggestions } from "../../../utils/file-system-suggestions.js";
import { expandFileTags } from "../../../utils/file-tag-utils.js";
import { createInputItem } from "../../../utils/input-utils.js";
import { setSessionId } from "../../../utils/session.js";
import {
  getAllSlashCommands,
  isKnownSlashCommand,
  type SlashCommand,
} from "../../../utils/slash-commands.js";
import { getAgentTodos } from "../../../agent/todo-store.js";
import {
  expandSkillArguments,
  loadSkillCommands,
} from "../../../agent/skills.js";
import { writeAgentsMd, runDoctor, PLAN_MODE_PREFIX } from "../../../agent/doctor.js";
import {
  formatSessionUsage,
  getSessionUsage,
  resetSessionUsage,
} from "../../../agent/usage-store.js";
import { clearTerminal, onExit } from "../../../utils/terminal.js";
import { theme } from "../../theme.js";
import { Box, Text, useApp, useInput } from "ink";
import { fileURLToPath } from "node:url";
import React, {
  useCallback,
  useState,
  Fragment,
  useEffect,
  useRef,
} from "react";

function pushSystem(
  setItems: React.Dispatch<React.SetStateAction<Array<ResponseItem>>>,
  text: string,
): void {
  setItems((prev) => [
    ...prev,
    {
      id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: "message",
      role: "system",
      content: [{ type: "input_text", text }],
    },
  ]);
}

const suggestions = [
  "explain this codebase to me",
  "fix any build errors",
  "are there any bugs in my code?",
];

export default function TerminalChatInput({
  isNew,
  loading,
  submitInput,
  confirmationPrompt,
  explanation,
  submitConfirmation,
  setLastResponseId,
  setItems,
  openOverlay,
  openModelOverlay,
  openProviderOverlay,
  openApprovalOverlay,
  openHelpOverlay,
  openDiffOverlay,
  openSessionsOverlay,
  onCompact,
  interruptAgent,
  active,
  thinkingSeconds,
  items = [],
  activity,
  queuedFollowUps = [],
  sessionStatus,
  onClearQueue,
}: {
  isNew: boolean;
  loading: boolean;
  submitInput: (input: Array<ResponseInputItem>) => void;
  confirmationPrompt: React.ReactNode | null;
  explanation?: string;
  submitConfirmation: (
    decision: ReviewDecision,
    customDenyMessage?: string,
  ) => void;
  setLastResponseId: (lastResponseId: string) => void;
  setItems: React.Dispatch<React.SetStateAction<Array<ResponseItem>>>;
  contextLeftPercent: number;
  openOverlay: () => void;
  openModelOverlay: () => void;
  openProviderOverlay: () => void;
  openApprovalOverlay: () => void;
  openHelpOverlay: () => void;
  openDiffOverlay: () => void;
  openSessionsOverlay: () => void;
  onCompact: () => void;
  interruptAgent: () => void;
  active: boolean;
  thinkingSeconds: number;
  items?: Array<ResponseItem>;
  activity?: string;
  queuedFollowUps?: Array<{ id: string; preview: string }>;
  sessionStatus?: {
    model: string;
    provider: string;
    approval: string;
    cwd: string;
  };
  onClearQueue?: () => void;
}): React.ReactElement {
  // Slash command suggestion index
  const [selectedSlashSuggestion, setSelectedSlashSuggestion] =
    useState<number>(0);
  const app = useApp();
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(0);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<Array<HistoryEntry>>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [draftInput, setDraftInput] = useState<string>("");
  const [skipNextSubmit, setSkipNextSubmit] = useState<boolean>(false);
  const [fsSuggestions, setFsSuggestions] = useState<
    Array<FileSystemSuggestion>
  >([]);
  const [selectedCompletion, setSelectedCompletion] = useState<number>(-1);
  // Multiline text editor key to force remount after submission
  const [editorState, setEditorState] = useState<{
    key: number;
    initialCursorOffset?: number;
  }>({ key: 0 });
  // Imperative handle from the multiline editor so we can query caret position
  const editorRef = useRef<MultilineTextEditorHandle | null>(null);
  // Track the caret row across keystrokes
  const prevCursorRow = useRef<number | null>(null);
  const prevCursorWasAtLastRow = useRef<boolean>(false);

  // --- Helper for updating input, remounting editor, and moving cursor to end ---
  const applyFsSuggestion = useCallback((newInputText: string) => {
    setInput(newInputText);
    setEditorState((s) => ({
      key: s.key + 1,
      initialCursorOffset: newInputText.length,
    }));
  }, []);

  // --- Helper for updating file system suggestions ---
  function updateFsSuggestions(
    txt: string,
    alwaysUpdateSelection: boolean = false,
  ) {
    // Clear file system completions if a space is typed
    if (txt.endsWith(" ")) {
      setFsSuggestions([]);
      setSelectedCompletion(-1);
    } else {
      // Determine the current token (last whitespace-separated word)
      const words = txt.trim().split(/\s+/);
      const lastWord = words[words.length - 1] ?? "";

      const shouldUpdateSelection =
        lastWord.startsWith("@") || alwaysUpdateSelection;

      // Strip optional leading '@' for the path prefix
      let pathPrefix: string;
      if (lastWord.startsWith("@")) {
        pathPrefix = lastWord.slice(1);
        // If only '@' is typed, list everything in the current directory
        pathPrefix = pathPrefix.length === 0 ? "./" : pathPrefix;
      } else {
        pathPrefix = lastWord;
      }

      if (shouldUpdateSelection) {
        const completions = getFileSystemSuggestions(pathPrefix);
        setFsSuggestions(completions);
        if (completions.length > 0) {
          setSelectedCompletion((prev) =>
            prev < 0 || prev >= completions.length ? 0 : prev,
          );
        } else {
          setSelectedCompletion(-1);
        }
      } else if (fsSuggestions.length > 0) {
        // Token cleared → clear menu
        setFsSuggestions([]);
        setSelectedCompletion(-1);
      }
    }
  }

  /**
   * Result of replacing text with a file system suggestion
   */
  interface ReplacementResult {
    /** The new text with the suggestion applied */
    text: string;
    /** The selected suggestion if a replacement was made */
    suggestion: FileSystemSuggestion | null;
    /** Whether a replacement was actually made */
    wasReplaced: boolean;
  }

  // --- Helper for replacing input with file system suggestion ---
  function getFileSystemSuggestion(
    txt: string,
    requireAtPrefix: boolean = false,
  ): ReplacementResult {
    if (fsSuggestions.length === 0 || selectedCompletion < 0) {
      return { text: txt, suggestion: null, wasReplaced: false };
    }

    const words = txt.trim().split(/\s+/);
    const lastWord = words[words.length - 1] ?? "";

    // Check if @ prefix is required and the last word doesn't have it
    if (requireAtPrefix && !lastWord.startsWith("@")) {
      return { text: txt, suggestion: null, wasReplaced: false };
    }

    const selected = fsSuggestions[selectedCompletion];
    if (!selected) {
      return { text: txt, suggestion: null, wasReplaced: false };
    }

    const replacement = lastWord.startsWith("@")
      ? `@${selected.path}`
      : selected.path;
    words[words.length - 1] = replacement;
    return {
      text: words.join(" "),
      suggestion: selected,
      wasReplaced: true,
    };
  }

  // Load command history on component mount
  useEffect(() => {
    async function loadHistory() {
      const historyEntries = await loadCommandHistory();
      setHistory(historyEntries);
    }

    loadHistory();
  }, []);
  // Reset slash suggestion index when input prefix changes
  useEffect(() => {
    if (input.trim().startsWith("/")) {
      setSelectedSlashSuggestion(0);
    }
  }, [input]);

  useInput(
    (_input, _key) => {
      // Slash command navigation: up/down to select, enter to fill
      // (also while the agent is working — follow-up box stays active)
      if (!confirmationPrompt && input.trim().startsWith("/")) {
        const prefix = input.trim();
        const matches = getAllSlashCommands().filter((cmd: SlashCommand) =>
          cmd.command.startsWith(prefix),
        );
        if (matches.length > 0) {
          if (_key.tab) {
            // Cycle and fill slash command suggestions on Tab
            const len = matches.length;
            // Determine new index based on shift state
            const nextIdx = _key.shift
              ? selectedSlashSuggestion <= 0
                ? len - 1
                : selectedSlashSuggestion - 1
              : selectedSlashSuggestion >= len - 1
                ? 0
                : selectedSlashSuggestion + 1;
            setSelectedSlashSuggestion(nextIdx);
            // Autocomplete the command in the input
            const match = matches[nextIdx];
            if (!match) {
              return;
            }
            const cmd = match.command;
            setInput(cmd);
            setDraftInput(cmd);
            return;
          }
          if (_key.upArrow) {
            setSelectedSlashSuggestion((prev) =>
              prev <= 0 ? matches.length - 1 : prev - 1,
            );
            return;
          }
          if (_key.downArrow) {
            setSelectedSlashSuggestion((prev) =>
              prev < 0 || prev >= matches.length - 1 ? 0 : prev + 1,
            );
            return;
          }
          if (_key.return) {
            // Execute the selected slash command through the same path as Enter.
            const selIdx = selectedSlashSuggestion;
            const cmdObj = matches[selIdx];
            if (cmdObj) {
              const cmd = cmdObj.command;
              setInput("");
              setDraftInput("");
              setSelectedSlashSuggestion(0);
              void onSubmit(cmd);
            }
            return;
          }
        }
      }
      if (!confirmationPrompt && !loading) {
        if (fsSuggestions.length > 0) {
          if (_key.upArrow) {
            setSelectedCompletion((prev) =>
              prev <= 0 ? fsSuggestions.length - 1 : prev - 1,
            );
            return;
          }

          if (_key.downArrow) {
            setSelectedCompletion((prev) =>
              prev >= fsSuggestions.length - 1 ? 0 : prev + 1,
            );
            return;
          }

          if (_key.tab && selectedCompletion >= 0) {
            const { text: newText, suggestion, wasReplaced } =
              getFileSystemSuggestion(input);

            if (wasReplaced) {
              applyFsSuggestion(newText);
              if (suggestion?.isDirectory) {
                updateFsSuggestions(newText, true);
              } else {
                setFsSuggestions([]);
                setSelectedCompletion(-1);
              }
            }
            return;
          }
        }

        if (_key.upArrow) {
          let moveThroughHistory = true;

          // Only use history when the caret was *already* on the very first
          // row *before* this key-press.
          const cursorRow = editorRef.current?.getRow?.() ?? 0;
          const cursorCol = editorRef.current?.getCol?.() ?? 0;
          const wasAtFirstRow = (prevCursorRow.current ?? cursorRow) === 0;
          if (!(cursorRow === 0 && wasAtFirstRow)) {
            moveThroughHistory = false;
          }

          // If we are not yet in history mode, then also require that the col is zero so that
          // we only trigger history navigation when the user is at the start of the input.
          if (historyIndex == null && !(cursorRow === 0 && cursorCol === 0)) {
            moveThroughHistory = false;
          }

          // Move through history.
          if (history.length && moveThroughHistory) {
            let newIndex: number;
            if (historyIndex == null) {
              const currentDraft = editorRef.current?.getText?.() ?? input;
              setDraftInput(currentDraft);
              newIndex = history.length - 1;
            } else {
              newIndex = Math.max(0, historyIndex - 1);
            }
            setHistoryIndex(newIndex);

            setInput(history[newIndex]?.command ?? "");
            // Re-mount the editor so it picks up the new initialText
            setEditorState((s) => ({ key: s.key + 1 }));
            return; // handled
          }

          // Otherwise let it propagate.
        }

        if (_key.downArrow) {
          // Only move forward in history when we're already *in* history mode
          // AND the caret sits on the last line of the buffer.
          const wasAtLastRow =
            prevCursorWasAtLastRow.current ??
            editorRef.current?.isCursorAtLastRow() ??
            true;
          if (historyIndex != null && wasAtLastRow) {
            const newIndex = historyIndex + 1;
            if (newIndex >= history.length) {
              setHistoryIndex(null);
              setInput(draftInput);
              setEditorState((s) => ({ key: s.key + 1 }));
            } else {
              setHistoryIndex(newIndex);
              setInput(history[newIndex]?.command ?? "");
              setEditorState((s) => ({ key: s.key + 1 }));
            }
            return; // handled
          }
          // Otherwise let it propagate
        }

        // Defer filesystem suggestion logic to onSubmit if enter key is pressed
        if (!_key.return) {
          // Pressing tab should trigger the file system suggestions
          const shouldUpdateSelection = _key.tab;
          const targetInput = _key.delete ? input.slice(0, -1) : input + _input;
          updateFsSuggestions(targetInput, shouldUpdateSelection);
        }
      }

      // Update the cached cursor position *after* **all** handlers (including
      // the internal <MultilineTextEditor>) have processed this key event.
      //
      // Ink invokes `useInput` callbacks starting with **parent** components
      // first, followed by their descendants. As a result the call above
      // executes *before* the editor has had a chance to react to the key
      // press and update its internal caret position.  When navigating
      // through a multi-line draft with the ↑ / ↓ arrow keys this meant we
      // recorded the *old* cursor row instead of the one that results *after*
      // the key press.  Consequently, a subsequent ↑ still saw
      // `prevCursorRow = 1` even though the caret was already on row 0 and
      // history-navigation never kicked in.
      //
      // Defer the sampling by one tick so we read the *final* caret position
      // for this frame.
      setTimeout(() => {
        prevCursorRow.current = editorRef.current?.getRow?.() ?? null;
        prevCursorWasAtLastRow.current =
          editorRef.current?.isCursorAtLastRow?.() ?? true;
      }, 1);

      if (input.trim() === "" && isNew) {
        if (_key.tab) {
          setSelectedSuggestion(
            (s) => (s + (_key.shift ? -1 : 1)) % (suggestions.length + 1),
          );
        } else if (selectedSuggestion && _key.return) {
          const suggestion = suggestions[selectedSuggestion - 1] || "";
          setInput("");
          setSelectedSuggestion(0);
          submitInput([
            {
              role: "user",
              content: [{ type: "input_text", text: suggestion }],
              type: "message",
            },
          ]);
        }
      } else if (_input === "\u0003" || (_input === "c" && _key.ctrl)) {
        setTimeout(() => {
          app.exit();
          onExit();
          process.exit(0);
        }, 60);
      }
    },
    { isActive: active },
  );

  const onSubmit = useCallback(
    async (value: string) => {
      let inputValue = value.trim();

      // If the user only entered a slash, do not send a chat message.
      if (inputValue === "/") {
        setInput("");
        return;
      }

      // Skip this submit if we just autocompleted a slash command.
      if (skipNextSubmit) {
        setSkipNextSubmit(false);
        return;
      }

      if (!inputValue) {
        return;
      } else if (inputValue === "/stop" || inputValue === "/cancel") {
        setInput("");
        interruptAgent();
        return;
      } else if (inputValue === "/resume" || inputValue === "/sessions") {
        setInput("");
        openSessionsOverlay();
        return;
      } else if (inputValue === "/history") {
        setInput("");
        openOverlay();
        return;
      } else if (inputValue === "/help") {
        setInput("");
        openHelpOverlay();
        return;
      } else if (inputValue === "/diff") {
        setInput("");
        openDiffOverlay();
        return;
      } else if (inputValue === "/compact") {
        setInput("");
        onCompact();
        return;
      } else if (inputValue.startsWith("/model")) {
        setInput("");
        openModelOverlay();
        return;
      } else if (inputValue.startsWith("/provider")) {
        setInput("");
        openProviderOverlay();
        return;
      } else if (inputValue.startsWith("/approval")) {
        setInput("");
        openApprovalOverlay();
        return;
      } else if (inputValue === "/status") {
        setInput("");
        const usage = getSessionUsage();
        const lines = [
          `model: ${sessionStatus?.model ?? loadConfig().model ?? "—"}`,
          `provider: ${sessionStatus?.provider ?? loadConfig().provider ?? "—"}`,
          `approval: ${sessionStatus?.approval ?? "—"}`,
          `cwd: ${sessionStatus?.cwd ?? process.cwd()}`,
          `queue: ${queuedFollowUps.length}`,
          loading ? "state: working" : "state: idle",
          `tokens: ${usage.totalTokens.toLocaleString()} (in ${usage.inputTokens.toLocaleString()} / out ${usage.outputTokens.toLocaleString()}, ${usage.turns} turns)`,
        ];
        pushSystem(setItems, lines.join("\n"));
        return;
      } else if (inputValue === "/cost") {
        setInput("");
        pushSystem(setItems, formatSessionUsage());
        return;
      } else if (inputValue === "/init") {
        setInput("");
        pushSystem(setItems, writeAgentsMd(process.cwd()));
        return;
      } else if (inputValue === "/doctor") {
        setInput("");
        const cfg = loadConfig();
        pushSystem(
          setItems,
          runDoctor({
            model: sessionStatus?.model ?? cfg.model,
            provider: sessionStatus?.provider ?? cfg.provider,
          }),
        );
        return;
      } else if (inputValue === "/plan" || inputValue.startsWith("/plan ")) {
        const topic = inputValue.slice("/plan".length).trim();
        inputValue = topic
          ? `${PLAN_MODE_PREFIX}\n\nTopic: ${topic}`
          : `${PLAN_MODE_PREFIX}\n\nCreate a plan for the user's current goal based on the conversation so far. If the goal is unclear, ask one clarifying question then propose a plan.`;
        // Continue as a normal chat submit below.
      } else if (inputValue === "/todos") {
        setInput("");
        const todos = getAgentTodos();
        if (todos.length === 0) {
          pushSystem(setItems, "No todos.");
        } else {
          const lines = todos.map((t, i) => {
            const mark =
              t.status === "completed"
                ? "[x]"
                : t.status === "in_progress"
                  ? "[~]"
                  : t.status === "cancelled"
                    ? "[-]"
                    : "[ ]";
            return `${i + 1}. ${mark} ${t.content}`;
          });
          pushSystem(setItems, `Todos (${todos.length}):\n${lines.join("\n")}`);
        }
        return;
      } else if (inputValue === "/pwd") {
        setInput("");
        pushSystem(setItems, process.cwd());
        return;
      } else if (inputValue === "/queue" || inputValue.startsWith("/queue ")) {
        setInput("");
        const arg = inputValue.slice("/queue".length).trim();
        if (arg === "clear" || arg === "drop" || arg === "flush") {
          onClearQueue?.();
          pushSystem(setItems, "Follow-up queue cleared.");
          return;
        }
        if (queuedFollowUps.length === 0) {
          pushSystem(setItems, "Queue empty.");
        } else {
          const lines = queuedFollowUps.map((q, i) => `${i + 1}. ${q.preview}`);
          pushSystem(
            setItems,
            `Queued (${queuedFollowUps.length}):\n${lines.join("\n")}\n(/queue clear to drop)`,
          );
        }
        return;
      } else if (["exit", "q", ":q", "/exit", "/quit"].includes(inputValue)) {
        setInput("");
        setTimeout(() => {
          app.exit();
          onExit();
          process.exit(0);
        }, 60);
        return;
      } else if (
        inputValue === "/clear" ||
        inputValue === "/new" ||
        inputValue === "clear"
      ) {
        setInput("");
        setSessionId("");
        setLastResponseId("");
        resetSessionUsage();
        onClearQueue?.();
        clearTerminal();
        setItems((prev) => {
          const filteredOldItems = prev.filter((item) => {
            if (
              item.type === "message" &&
              (item.role === "user" || item.role === "assistant")
            ) {
              return false;
            }
            if (
              item.type === "function_call" ||
              item.type === "function_call_output"
            ) {
              return false;
            }
            return true;
          });
          return [
            ...filteredOldItems,
            {
              id: `clear-${Date.now()}`,
              type: "message",
              role: "system",
              content: [{ type: "input_text", text: "New chat" }],
            },
          ];
        });
        return;
      } else if (inputValue === "/clearhistory") {
        setInput("");
        import("../../../utils/command-history.js").then(
          async ({ clearCommandHistory }) => {
            await clearCommandHistory();
            setHistory([]);
            pushSystem(setItems, "Command history cleared");
          },
        );
        return;
      } else if (inputValue === "/bug") {
        setInput("");
        try {
          const os = await import("node:os");
          const { CLI_VERSION } = await import("../../../utils/version.js");
          const { buildBugReportUrl } =
            await import("../../../utils/bug-report.js");
          const url = buildBugReportUrl({
            items: items ?? [],
            cliVersion: CLI_VERSION,
            model: loadConfig().model ?? "unknown",
            platform: [os.platform(), os.arch(), os.release()]
              .map((s) => `\`${s}\``)
              .join(" | "),
          });
          pushSystem(setItems, `Bug report URL: ${url}`);
        } catch (error) {
          pushSystem(setItems, `Failed to create bug report URL: ${error}`);
        }
        return;
      } else if (inputValue.startsWith("/")) {
        const trimmed = inputValue.trim();
        const head = trimmed.split(/\s+/)[0] ?? "";
        const skillName = head.replace(/^\//, "");
        const skill = loadSkillCommands().find((s) => s.name === skillName);
        if (skill) {
          const args = trimmed.slice(head.length).trim();
          inputValue = expandSkillArguments(skill.body, args);
          // Continue as a normal chat submit below.
        } else if (/^\/\S+$/.test(trimmed) && !isKnownSlashCommand(head)) {
          setInput("");
          pushSystem(
            setItems,
            `Unknown command ${trimmed}. Type /help for the list.`,
          );
          return;
        } else if (/^\/\S+$/.test(trimmed) && isKnownSlashCommand(head)) {
          setInput("");
          return;
        } else {
          // Slash with args but not a skill — treat as unknown if head unknown
          if (!isKnownSlashCommand(head)) {
            setInput("");
            pushSystem(
              setItems,
              `Unknown command ${head}. Type /help for the list.`,
            );
            return;
          }
        }
      }

      // detect image file paths for dynamic inclusion
      const images: Array<string> = [];
      let text = inputValue;

      // markdown-style image syntax: ![alt](path)
      text = text.replace(/!\[[^\]]*?\]\(([^)]+)\)/g, (_m, p1: string) => {
        images.push(p1.startsWith("file://") ? fileURLToPath(p1) : p1);
        return "";
      });

      // quoted file paths ending with common image extensions (e.g. '/path/to/img.png')
      text = text.replace(
        /['"]([^'"]+?\.(?:png|jpe?g|gif|bmp|webp|svg))['"]/gi,
        (_m, p1: string) => {
          images.push(p1.startsWith("file://") ? fileURLToPath(p1) : p1);
          return "";
        },
      );

      // bare file paths ending with common image extensions
      text = text.replace(
        // eslint-disable-next-line no-useless-escape
        /\b(?:\.[\/\\]|[\/\\]|[A-Za-z]:[\/\\])?[\w-]+(?:[\/\\][\w-]+)*\.(?:png|jpe?g|gif|bmp|webp|svg)\b/gi,
        (match: string) => {
          images.push(
            match.startsWith("file://") ? fileURLToPath(match) : match,
          );
          return "";
        },
      );
      text = text.trim();

      // Expand @file tokens into XML blocks for the model
      const expandedText = await expandFileTags(text);

      const inputItem = await createInputItem(expandedText, images);
      submitInput([inputItem]);

      // Get config for history persistence.
      const config = loadConfig();

      // Add to history and update state.
      const updatedHistory = await addToHistory(value, history, {
        maxSize: config.history?.maxSize ?? 1000,
        saveHistory: config.history?.saveHistory ?? true,
        sensitivePatterns: config.history?.sensitivePatterns ?? [],
      });

      setHistory(updatedHistory);
      setHistoryIndex(null);
      setDraftInput("");
      setSelectedSuggestion(0);
      setInput("");
      setFsSuggestions([]);
      setSelectedCompletion(-1);
    },
    [
      setInput,
      submitInput,
      setLastResponseId,
      setItems,
      app,
      setHistory,
      setHistoryIndex,
      openOverlay,
      openApprovalOverlay,
      openModelOverlay,
      openProviderOverlay,
      openHelpOverlay,
      openDiffOverlay,
      openSessionsOverlay,
      history,
      onCompact,
      skipNextSubmit,
      items,
      interruptAgent,
      queuedFollowUps,
      sessionStatus,
      onClearQueue,
      loading,
    ],
  );

  if (confirmationPrompt) {
    return (
      <TerminalChatCommandReview
        confirmationPrompt={confirmationPrompt}
        onReviewCommand={submitConfirmation}
        // allow switching approval mode via 'v'
        onSwitchApprovalMode={openApprovalOverlay}
        explanation={explanation}
        // disable when input is inactive (e.g., overlay open)
        isActive={active}
      />
    );
  }

  return (
    <Box flexDirection="column" marginTop={loading ? 0 : 1}>
      {loading ? (
        <TerminalChatInputThinking
          onInterrupt={interruptAgent}
          active={active}
          thinkingSeconds={thinkingSeconds}
          activity={activity}
          queuedFollowUps={queuedFollowUps}
        />
      ) : null}
      {/* Quiet composer — prompt + editor, no fill bar */}
      <Box flexDirection="row">
        <Text color={theme.colors.userPrompt} bold>
          {theme.glyphs.prompt}{" "}
        </Text>
        <Box flexGrow={1}>
          <MultilineTextEditor
            ref={editorRef}
            onChange={(txt: string) => {
              setDraftInput(txt);
              if (historyIndex != null) {
                setHistoryIndex(null);
              }
              setInput(txt);
            }}
            key={editorState.key}
            initialCursorOffset={editorState.initialCursorOffset}
            initialText={input}
            height={loading ? 1 : 3}
            focus={active && !confirmationPrompt}
            onSubmit={(txt) => {
              const {
                text: replacedText,
                suggestion,
                wasReplaced,
              } = getFileSystemSuggestion(txt, true);

              if (wasReplaced) {
                applyFsSuggestion(replacedText);
                if (suggestion?.isDirectory) {
                  updateFsSuggestions(replacedText, true);
                } else {
                  setFsSuggestions([]);
                  setSelectedCompletion(-1);
                }
                return;
              }

              onSubmit(replacedText);
              setEditorState((s) => ({ key: s.key + 1 }));
              setInput("");
              setHistoryIndex(null);
              setDraftInput("");
            }}
          />
        </Box>
      </Box>
      {loading ? (
        <Text dimColor>enter queues · Esc×2 interrupt</Text>
      ) : null}
      {input.trim().startsWith("/") && (
        <Box flexDirection="column" marginTop={0}>
          {getAllSlashCommands()
            .filter((cmd: SlashCommand) =>
              cmd.command.startsWith(input.trim()),
            )
            .map((cmd: SlashCommand, idx: number) => (
            <Box key={cmd.command}>
              <Text
                backgroundColor={
                  idx === selectedSlashSuggestion ? "blackBright" : undefined
                }
              >
                <Text color={theme.colors.accent}>{cmd.command}</Text>
                <Text dimColor> {cmd.description}</Text>
              </Text>
            </Box>
          ))}
        </Box>
      )}
      {!loading ? (
        <Box>
          {isNew && !input ? (
            <Text dimColor>
              try:{" "}
              {suggestions.map((m, key) => (
                <Fragment key={key}>
                  {key !== 0 ? ` ${theme.glyphs.sep} ` : ""}
                  <Text
                    backgroundColor={
                      key + 1 === selectedSuggestion ? "blackBright" : ""
                    }
                  >
                    {m}
                  </Text>
                </Fragment>
              ))}
            </Text>
          ) : fsSuggestions.length > 0 ? (
            <>
              <TextCompletions
                completions={fsSuggestions.map((suggestion) => suggestion.path)}
                selectedCompletion={selectedCompletion}
                displayLimit={5}
              />
              <Text dimColor>
                {" "}
                ↑↓ {theme.glyphs.sep} Enter/Tab
              </Text>
            </>
          ) : (
            <Text dimColor>
              / help {theme.glyphs.sep} Tab {theme.glyphs.sep} Esc×2{" "}
              {theme.glyphs.sep} Ctrl+C
            </Text>
          )}
        </Box>
      ) : null}
    </Box>
  );
}
