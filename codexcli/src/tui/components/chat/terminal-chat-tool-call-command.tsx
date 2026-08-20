import { parseApplyPatch } from "../../../patch/parse-apply-patch.js";
import { shortenPath } from "../../../utils/short-path.js";
import { theme } from "../../theme.js";
import chalk from "chalk";
import { Text } from "ink";
import React from "react";

export function TerminalChatToolCallCommand({
  commandForDisplay,
  explanation,
}: {
  commandForDisplay: string;
  explanation?: string;
}): React.ReactElement {
  const colorizedCommand = commandForDisplay
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

  return (
    <>
      <Text>
        <Text color={theme.colors.muted}>{theme.glyphs.tool} </Text>
        <Text bold>Bash</Text>
        <Text> {colorizedCommand}</Text>
      </Text>
      {explanation ? (
        <Text dimColor>
          {"  "}
          {theme.glyphs.tree}{" "}
          {explanation
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .join(" ")}
        </Text>
      ) : null}
    </>
  );
}

export function TerminalChatToolCallApplyPatch({
  commandForDisplay,
  patch,
}: {
  commandForDisplay: string;
  patch: string;
}): React.ReactElement {
  const ops = React.useMemo(() => parseApplyPatch(patch), [patch]);
  const firstOp = ops?.[0];

  const title = React.useMemo(() => {
    if (!firstOp) {
      return "";
    }
    return firstOp.type.charAt(0).toUpperCase() + firstOp.type.slice(1);
  }, [firstOp]);

  const filePath = React.useMemo(() => {
    if (!firstOp) {
      return "";
    }
    return shortenPath(firstOp.path || ".");
  }, [firstOp]);

  if (ops == null) {
    return (
      <Text color={theme.colors.failure}>
        {theme.glyphs.fail} Invalid patch{" "}
        <Text dimColor>{commandForDisplay}</Text>
      </Text>
    );
  }

  if (!firstOp) {
    return (
      <Text dimColor>
        {theme.glyphs.tool} Empty patch
      </Text>
    );
  }

  return (
    <Text>
      <Text color={theme.colors.tool}>
        {theme.glyphs.tool} {title}
      </Text>
      <Text> {filePath}</Text>
    </Text>
  );
}
