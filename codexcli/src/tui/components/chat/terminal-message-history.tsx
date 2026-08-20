import type { OverlayModeType } from "./terminal-chat.js";
import type { TerminalHeaderProps } from "./terminal-header.js";
import type { GroupedResponseItem } from "./use-message-grouping.js";
import type { FileOpenerScheme } from "../../../config/config.js";
import type { ResponseItem } from "../../../utils/responses.js";

import TerminalChatResponseItem from "./terminal-chat-response-item.js";
import TerminalHeader from "./terminal-header.js";
import { shouldPersistInHistory } from "./tool-activity.js";
import { isStreamingMessage } from "../../../utils/model-utils.js";
import { Box, Static } from "ink";
import React, { useMemo } from "react";

type BatchEntry = { item?: ResponseItem; group?: GroupedResponseItem };
type TerminalMessageHistoryProps = {
  batch: Array<BatchEntry>;
  groupCounts: Record<string, number>;
  items: Array<ResponseItem>;
  userMsgCount: number;
  confirmationPrompt: React.ReactNode;
  loading: boolean;
  thinkingSeconds: number;
  headerProps: TerminalHeaderProps;
  fullStdout: boolean;
  setOverlayMode: React.Dispatch<React.SetStateAction<OverlayModeType>>;
  fileOpener: FileOpenerScheme | undefined;
};

/** Noise that should never burn into the permanent scrollback. */
function isEphemeralSystemMessage(message: ResponseItem): boolean {
  if (
    message.type !== "message" ||
    (message as { role?: string }).role !== "system"
  ) {
    return false;
  }
  const text = Array.isArray(
    (message as { content?: Array<{ text?: string }> }).content,
  )
    ? (message as { content: Array<{ text?: string }> }).content
        .map((c) => c.text ?? "")
        .join("\n")
    : "";
  return (
    /^Switched (model|provider)\b/i.test(text) ||
    /^Warning: model "/i.test(text) ||
    /^Initializing agent/i.test(text) ||
    /Execution interrupted by user/i.test(text) ||
    /Execution interrupted\. Continue when ready/i.test(text)
  );
}

/**
 * Completed transcript via Ink <Static> (scrollback above the live region).
 * The chatbox lives OUTSIDE this component — Ink keeps that live footer at the
 * bottom of the terminal while Static history grows above it.
 */
const TerminalMessageHistory: React.FC<TerminalMessageHistoryProps> = ({
  batch,
  headerProps,
  fullStdout,
  setOverlayMode,
  fileOpener,
}) => {
  // Never burn in-progress streams into Static — Ink won't update them.
  // Those render in the live footer until status becomes completed.
  const messages = useMemo(
    () =>
      batch
        .map(({ item }) => item!)
        .filter(
          (m) =>
            m != null &&
            !isStreamingMessage(m) &&
            !isEphemeralSystemMessage(m) &&
            shouldPersistInHistory(m),
        ),
    [batch],
  );

  return (
    <Static items={["header", ...messages]}>
      {(item, index) => {
        if (item === "header") {
          return <TerminalHeader key="header" {...headerProps} />;
        }

        const message = item as ResponseItem;
        const msg = message as unknown as { summary?: Array<unknown> };
        if (msg.summary?.length === 0) {
          return null;
        }

        return (
          <Box
            key={message.id ?? `msg-${index}`}
            flexDirection="column"
            marginBottom={
              message.type === "message" &&
              (message as { role?: string }).role === "assistant"
                ? 1
                : 0
            }
          >
            <TerminalChatResponseItem
              item={message}
              fullStdout={fullStdout}
              setOverlayMode={setOverlayMode}
              fileOpener={fileOpener}
            />
          </Box>
        );
      }}
    </Static>
  );
};

export default React.memo(TerminalMessageHistory);
