import { ReviewDecision } from "../../../agent/review.js";
import { Select } from "../vendor/ink-select/select.js";
import TextInput from "../vendor/ink-text-input.js";
import { Box, Text, useInput } from "ink";
import React from "react";

// default deny‑reason:
const DEFAULT_DENY_MESSAGE =
  "Don't do that, but keep trying to fix the problem";

export function TerminalChatCommandReview({
  confirmationPrompt,
  onReviewCommand,
  // callback to switch approval mode overlay
  onSwitchApprovalMode,
  explanation: propExplanation,
  // whether this review Select is active (listening for keys)
  isActive = true,
}: {
  confirmationPrompt: React.ReactNode;
  onReviewCommand: (decision: ReviewDecision, customMessage?: string) => void;
  onSwitchApprovalMode: () => void;
  explanation?: string;
  // when false, disable the underlying Select so it won't capture input
  isActive?: boolean;
}): React.ReactElement {
  const [mode, setMode] = React.useState<"select" | "input" | "explanation">(
    "select",
  );
  const [explanation, setExplanation] = React.useState<string>("");

  // If the component receives an explanation prop, update the state
  React.useEffect(() => {
    if (propExplanation) {
      setExplanation(propExplanation);
      setMode("explanation");
    }
  }, [propExplanation]);
  const [msg, setMsg] = React.useState<string>("");

  // -------------------------------------------------------------------------
  // Determine whether the "always approve" option should be displayed.  We
  // only hide it for the special `apply_patch` command since approving those
  // permanently would bypass the user's review of future file modifications.
  // The information is embedded in the `confirmationPrompt` React element –
  // we inspect the `commandForDisplay` prop exposed by
  // <TerminalChatToolCallCommand/> to extract the base command.
  // -------------------------------------------------------------------------

  const showAlwaysApprove = React.useMemo(() => {
    if (
      React.isValidElement(confirmationPrompt) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (confirmationPrompt as any).props?.commandForDisplay === "string"
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const command: string = (confirmationPrompt as any).props
        .commandForDisplay;
      // Grab the first token of the first line – that corresponds to the base
      // command even when the string contains embedded newlines (e.g. diffs).
      const baseCmd = command.split("\n")[0]?.trim().split(/\s+/)[0] ?? "";
      return baseCmd !== "apply_patch";
    }
    // Default to showing the option when we cannot reliably detect the base
    // command.
    return true;
  }, [confirmationPrompt]);

  // Memoize the list of selectable options to avoid recreating the array on
  // every render.  This keeps <Select/> stable and prevents unnecessary work
  // inside Ink.
  const approvalOptions = React.useMemo(() => {
    const opts: Array<
      | { label: string; value: ReviewDecision }
      | { label: string; value: "edit" }
      | { label: string; value: "switch" }
    > = [{ label: "Yes (y)", value: ReviewDecision.YES }];

    if (showAlwaysApprove) {
      opts.push({ label: "Always (a)", value: ReviewDecision.ALWAYS });
    }

    opts.push(
      { label: "Explain (x)", value: ReviewDecision.EXPLAIN },
      { label: "Edit (e)", value: "edit" },
      { label: "Mode (s)", value: "switch" },
      { label: "No (n)", value: ReviewDecision.NO_CONTINUE },
      { label: "Stop (esc)", value: ReviewDecision.NO_EXIT },
    );

    return opts;
  }, [showAlwaysApprove]);

  useInput(
    (input, key) => {
      if (mode === "select") {
        if (input === "y") {
          onReviewCommand(ReviewDecision.YES);
        } else if (input === "x") {
          onReviewCommand(ReviewDecision.EXPLAIN);
        } else if (input === "e") {
          setMode("input");
        } else if (input === "n") {
          onReviewCommand(
            ReviewDecision.NO_CONTINUE,
            "Don't do that, keep going though",
          );
        } else if (input === "a" && showAlwaysApprove) {
          onReviewCommand(ReviewDecision.ALWAYS);
        } else if (input === "s") {
          // switch approval mode
          onSwitchApprovalMode();
        } else if (key.escape) {
          onReviewCommand(ReviewDecision.NO_EXIT);
        }
      } else if (mode === "explanation") {
        // When in explanation mode, any key returns to select mode
        if (key.return || key.escape || input === "x") {
          setMode("select");
        }
      } else {
        // text entry mode
        if (key.return) {
          // if user hit enter on empty msg, fall back to DEFAULT_DENY_MESSAGE
          const custom = msg.trim() === "" ? DEFAULT_DENY_MESSAGE : msg;
          onReviewCommand(ReviewDecision.NO_CONTINUE, custom);
        } else if (key.escape) {
          // treat escape as denial with default message as well
          onReviewCommand(
            ReviewDecision.NO_CONTINUE,
            msg.trim() === "" ? DEFAULT_DENY_MESSAGE : msg,
          );
        }
      }
    },
    { isActive },
  );

  return (
    <Box flexDirection="column" marginTop={1} paddingX={1}>
      {confirmationPrompt}
      {mode === "explanation" ? (
        <Box flexDirection="column">
          <Text dimColor>{explanation || "Loading…"}</Text>
          <Text dimColor>any key to go back</Text>
        </Box>
      ) : mode === "select" ? (
        <Box flexDirection="column">
          <Text dimColor>allow?</Text>
          <Select
            isDisabled={!isActive}
            visibleOptionCount={Math.min(approvalOptions.length, 7)}
            onChange={(value: ReviewDecision | "edit" | "switch") => {
              if (value === "edit") {
                setMode("input");
              } else if (value === "switch") {
                onSwitchApprovalMode();
              } else {
                onReviewCommand(value);
              }
            }}
            options={approvalOptions}
          />
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text dimColor>feedback (enter to send):</Text>
          <TextInput
            value={msg}
            onChange={setMsg}
            placeholder="reason"
            showCursor
            focus
          />
        </Box>
      )}
    </Box>
  );
}
