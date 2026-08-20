import type { ModelInfo } from "../models/types.js";

import { KNOWN_CONTEXT_LENGTHS } from "../models/defaults.js";

/** Flat context-length lookup for maxTokensForModel / legacy callers. */
export const modelInfo: Record<string, ModelInfo> = Object.fromEntries(
  Object.entries(KNOWN_CONTEXT_LENGTHS).map(([id, maxContextLength]) => [
    id,
    { label: id, maxContextLength },
  ]),
);

export type SupportedModelId = string;
