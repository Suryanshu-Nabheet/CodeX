import type { ProviderModelMap, ModelInfo } from "./types.js";

import {
  KNOWN_CONTEXT_LENGTHS,
  PREFERRED_MODELS,
  pickPreferredModel,
} from "./defaults.js";

export * from "./types.js";
export * from "./defaults.js";

/**
 * Soft catalog built from known context lengths + preferred ids.
 * Live `/models` fetches are the source of truth for pickers; this map is only
 * for context-window estimates and offline default hints.
 */
function buildSoftCatalog(): Record<string, ProviderModelMap> {
  const out: Record<string, ProviderModelMap> = {};
  for (const [provider, ids] of Object.entries(PREFERRED_MODELS)) {
    const map: ProviderModelMap = {};
    for (const id of ids) {
      map[id] = {
        label: id,
        maxContextLength: KNOWN_CONTEXT_LENGTHS[id] ?? 128_000,
      };
    }
    out[provider] = map;
  }
  // Also register known contexts under every provider so lookups still work
  // when the user picked a live model not in PREFERRED_MODELS.
  const known: ProviderModelMap = {};
  for (const [id, maxContextLength] of Object.entries(KNOWN_CONTEXT_LENGTHS)) {
    known[id] = { label: id, maxContextLength };
  }
  out["_known"] = known;
  return out;
}

export const ALL_MODELS: Record<string, ProviderModelMap> = buildSoftCatalog();

function normalizeAlias(provider: string): string {
  const aliases: Record<string, string> = {
    "codexcli-compatible": "codexcli",
    openai: "codexcli",
    anthropic: "claude",
    google: "gemini",
  };
  return aliases[provider] ?? provider;
}

export function getModelsForProvider(provider: string): ProviderModelMap {
  const normalizedProvider = provider.toLowerCase();
  return (
    ALL_MODELS[normalizedProvider] ||
    ALL_MODELS[normalizeAlias(normalizedProvider)] ||
    {}
  );
}

/**
 * Sync offline default — prefer live {@link resolveDefaultModel} when a key
 * is available. Used for immediate provider switches before fetch completes.
 */
export function getDefaultModelForProvider(provider: string): string {
  const normalized = normalizeAlias(provider.toLowerCase());
  const prefs = PREFERRED_MODELS[normalized] ?? [];
  return prefs[0] ?? "";
}

/** @deprecated Prefer pickPreferredModel from defaults — kept for callers. */
export function pickDefaultFromList(
  provider: string,
  available: Array<string>,
): string {
  return pickPreferredModel(normalizeAlias(provider.toLowerCase()), available);
}

/** Flat context lookup (legacy). */
export const modelInfo: Record<string, ModelInfo> = {
  ...Object.fromEntries(
    Object.entries(KNOWN_CONTEXT_LENGTHS).map(([id, maxContextLength]) => [
      id,
      { label: id, maxContextLength },
    ]),
  ),
};
