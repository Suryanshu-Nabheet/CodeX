import type { ForegroundColorName } from "chalk";

/**
 * CodexCLI visual language — quiet chrome, clear hierarchy.
 * Accents: cyan (actions / active), yellow (user prompt), white (focus).
 */
export const theme = {
  glyphs: {
    brand: ">_",
    prompt: ">",
    bullet: "•",
    tool: "•",
    tree: "└",
    checkbox: "□",
    checkboxDone: "■",
    sep: "·",
    ok: "✓",
    fail: "✗",
  },
  colors: {
    brand: "white" as ForegroundColorName,
    assistant: "white" as ForegroundColorName,
    userPrompt: "yellow" as ForegroundColorName,
    userText: "white" as ForegroundColorName,
    system: "gray" as ForegroundColorName,
    tool: "white" as ForegroundColorName,
    toolDetail: "white" as ForegroundColorName,
    accent: "cyan" as ForegroundColorName,
    active: "cyan" as ForegroundColorName,
    reasoning: "gray" as ForegroundColorName,
    success: "green" as ForegroundColorName,
    failure: "red" as ForegroundColorName,
    muted: "gray" as ForegroundColorName,
    tip: "gray" as ForegroundColorName,
    approvalSuggest: undefined as string | undefined,
    approvalAutoEdit: "greenBright" as ForegroundColorName,
    approvalFullAuto: "green" as ForegroundColorName,
  },
  tips: [
    "Use /help to see commands when you need them.",
    "Use /model to change the model mid-session.",
    "Use /provider to switch AI providers.",
    "Use /diff to review your working tree changes.",
  ],
} as const;

export const colorsByPolicy: Record<string, string | undefined> = {
  suggest: theme.colors.approvalSuggest,
  "auto-edit": theme.colors.approvalAutoEdit,
  "full-auto": theme.colors.approvalFullAuto,
};

export function pickTip(seed = Date.now()): string {
  const tips = theme.tips;
  return tips[seed % tips.length] ?? tips[0]!;
}
