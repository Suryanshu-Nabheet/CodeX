import { theme } from "../../theme.js";
import { log } from "../../../utils/logger.js";
import { Box, Text, useInput, useStdin } from "ink";
import React, { useState } from "react";
import { useInterval } from "use-interval";

/** Legacy CodexCLI identity spinner — keep distinct from other CLIs. */
const BALL_FRAMES = [
  "(●    )",
  "( ●   )",
  "(  ●  )",
  "(   ● )",
  "(    ●)",
  "(   ● )",
  "(  ●  )",
  "( ●   )",
];

export default function TerminalChatInputThinking({
  onInterrupt,
  active,
  thinkingSeconds,
  activity,
  queuedFollowUps = [],
}: {
  onInterrupt: () => void;
  active: boolean;
  thinkingSeconds: number;
  /** Latest tool activity, e.g. "Read package.json" */
  activity?: string;
  queuedFollowUps?: Array<{ id: string; preview: string }>;
}): React.ReactElement {
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [frame, setFrame] = useState(0);
  const { stdin, setRawMode } = useStdin();

  useInterval(() => {
    setFrame((idx) => (idx + 1) % BALL_FRAMES.length);
  }, 80);

  React.useEffect(() => {
    if (!active) {
      return;
    }

    setRawMode?.(true);

    const onData = (data: Buffer | string) => {
      if (awaitingConfirm) {
        return;
      }

      const str = Buffer.isBuffer(data) ? data.toString("utf8") : data;
      if (str === "\x1b\x1b") {
        log(
          "raw stdin: received collapsed ESC ESC – starting confirmation timer",
        );
        setAwaitingConfirm(true);
        setTimeout(() => setAwaitingConfirm(false), 1500);
      }
    };

    stdin?.on("data", onData);
    return () => {
      stdin?.off("data", onData);
    };
  }, [stdin, awaitingConfirm, onInterrupt, active, setRawMode]);

  useInput(
    (_input, key) => {
      if (!key.escape) {
        return;
      }

      if (awaitingConfirm) {
        log("useInput: second ESC detected – triggering onInterrupt()");
        onInterrupt();
        setAwaitingConfirm(false);
      } else {
        log("useInput: first ESC detected – waiting for confirmation");
        setAwaitingConfirm(true);
        setTimeout(() => setAwaitingConfirm(false), 1500);
      }
    },
    { isActive: active },
  );

  const spinner = BALL_FRAMES[frame] ?? BALL_FRAMES[0];
  const activityShort =
    activity && activity.length > 64
      ? `${activity.slice(0, 61)}…`
      : activity;

  return (
    <Box flexDirection="column" marginY={0}>
      <Text dimColor>
        <Text color={theme.colors.accent}>{spinner}</Text>
        {" "}
        working {thinkingSeconds}s
        {activityShort ? ` ${theme.glyphs.sep} ${activityShort}` : ""}
        {" "}
        {theme.glyphs.sep} Esc×2
      </Text>
      {queuedFollowUps.length > 0 ? (
        <Box flexDirection="column">
          <Text dimColor>
            {queuedFollowUps.length} queued · runs next
          </Text>
          {queuedFollowUps.slice(0, 3).map((q, i) => (
            <Text key={q.id} dimColor>
              {"  "}
              {i + 1}. {q.preview}
            </Text>
          ))}
        </Box>
      ) : null}
      {awaitingConfirm ? (
        <Text dimColor>Esc again to interrupt</Text>
      ) : null}
    </Box>
  );
}
