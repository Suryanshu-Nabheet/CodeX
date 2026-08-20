/**
 * Session token / cost accounting for /cost and /status.
 */

export type UsageSnapshot = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  turns: number;
};

let sessionUsage: UsageSnapshot = {
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  turns: 0,
};

export function resetSessionUsage(): void {
  sessionUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    turns: 0,
  };
}

export function recordUsage(partial: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): void {
  const input = Math.max(0, partial.inputTokens ?? 0);
  const output = Math.max(0, partial.outputTokens ?? 0);
  const total =
    Math.max(0, partial.totalTokens ?? 0) || input + output;
  sessionUsage.inputTokens += input;
  sessionUsage.outputTokens += output;
  sessionUsage.totalTokens += total;
  sessionUsage.turns += 1;
}

export function getSessionUsage(): UsageSnapshot {
  return { ...sessionUsage };
}

export function formatSessionUsage(): string {
  const u = sessionUsage;
  return [
    `turns: ${u.turns}`,
    `input tokens: ${u.inputTokens.toLocaleString()}`,
    `output tokens: ${u.outputTokens.toLocaleString()}`,
    `total tokens: ${u.totalTokens.toLocaleString()}`,
    "(provider billing may differ; this is reported usage)",
  ].join("\n");
}
