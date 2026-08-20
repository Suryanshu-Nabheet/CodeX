import type { ResponseItem } from "./responses.js";

import { approximateTokensUsed } from "./approximate-tokens-used.js";
import { createLLMClient } from "./llm-client.js";
import {
  KNOWN_CONTEXT_LENGTHS,
  PREFERRED_MODELS,
  pickPreferredModel,
} from "../models/defaults.js";
import { getApiKey, getBaseUrl } from "../config/config.js";
import {
  normalizeProviderKey,
  providerRequiresApiKey,
  providers,
} from "../config/providers.js";

const MODEL_LIST_TIMEOUT_MS = 8_000;
const cache = new Map<string, Array<string>>();

/** Models we nudge toward when present in a live list (OpenAI-family default). */
export const RECOMMENDED_MODELS: Array<string> = [
  ...(PREFERRED_MODELS["codexcli"] ?? []),
];

function cacheKey(provider: string, apiKey?: string): string {
  return `${provider}::${apiKey ? apiKey.slice(0, 8) : "none"}`;
}

/** Drop embeddings / audio / image-only / moderation noise from OpenAI-style lists. */
export function isLikelyChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  if (
    /embedding|whisper|tts|dall-e|davinci|babbage|moderation|realtime|transcribe|translation|sora|image|audio|omni-moderation|text-moderation|computer-use-preview/.test(
      lower,
    )
  ) {
    return false;
  }
  return true;
}

function sortModels(provider: string, models: Array<string>): Array<string> {
  const prefs = PREFERRED_MODELS[provider] ?? [];
  const rank = new Map(prefs.map((id, i) => [id, i]));
  return [...models].sort((a, b) => {
    const ra = rank.has(a) ? (rank.get(a) as number) : 10_000;
    const rb = rank.has(b) ? (rank.get(b) as number) : 10_000;
    if (ra !== rb) {
      return ra - rb;
    }
    return a.localeCompare(b);
  });
}

async function fetchOpenAICompatibleModels(
  provider: string,
  apiKey: string,
): Promise<Array<string>> {
  const ai = createLLMClient({ provider, apiKey });
  const list = await ai.models.list();
  const models: Array<string> = [];
  for await (const model of list as AsyncIterable<{ id?: string }>) {
    if (model && typeof model.id === "string") {
      let id = model.id;
      if (id.startsWith("models/")) {
        id = id.replace(/^models\//, "");
      }
      if (isLikelyChatModel(id)) {
        models.push(id);
      }
    }
  }
  return models;
}

async function fetchAnthropicModels(apiKey: string): Promise<Array<string>> {
  const base =
    getBaseUrl("claude")?.replace(/\/$/, "") ?? "https://api.anthropic.com/v1";
  const models: Array<string> = [];
  let afterId: string | undefined;
  // Paginate — Anthropic returns newest first.
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${base}/models`);
    url.searchParams.set("limit", "100");
    if (afterId) {
      url.searchParams.set("after_id", afterId);
    }
    const res = await fetch(url, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Anthropic models.list failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      data?: Array<{ id?: string }>;
      has_more?: boolean;
      last_id?: string;
    };
    for (const m of json.data ?? []) {
      if (m.id) {
        models.push(m.id);
      }
    }
    if (!json.has_more || !json.last_id) {
      break;
    }
    afterId = json.last_id;
  }
  return models;
}

async function fetchGeminiModels(apiKey: string): Promise<Array<string>> {
  const models: Array<string> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 20; page++) {
    const url = new URL(
      "https://generativelanguage.googleapis.com/v1beta/models",
    );
    url.searchParams.set("key", apiKey);
    url.searchParams.set("pageSize", "100");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }
    const res = await fetch(url, {
      signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Gemini models.list failed: ${res.status}`);
    }
    const json = (await res.json()) as {
      models?: Array<{
        name?: string;
        supportedGenerationMethods?: Array<string>;
      }>;
      nextPageToken?: string;
    };
    for (const m of json.models ?? []) {
      if (!m.name) {
        continue;
      }
      const methods = m.supportedGenerationMethods ?? [];
      if (
        methods.includes("generateContent") ||
        methods.includes("generateContentStream")
      ) {
        models.push(m.name.replace(/^models\//, ""));
      }
    }
    if (!json.nextPageToken) {
      break;
    }
    pageToken = json.nextPageToken;
  }
  return models;
}

async function fetchModelsRaw(
  provider: string,
  apiKey?: string,
): Promise<Array<string>> {
  const normalized = normalizeProviderKey(provider);
  const resolvedKey = apiKey || getApiKey(normalized);

  if (providerRequiresApiKey(normalized) && !resolvedKey) {
    throw new Error("No API key configured for provider: " + normalized);
  }

  const key = resolvedKey || "ollama";

  try {
    let models: Array<string> = [];
    if (normalized === "claude") {
      models = await fetchAnthropicModels(key);
    } else if (normalized === "gemini") {
      models = await fetchGeminiModels(key);
    } else {
      models = await fetchOpenAICompatibleModels(normalized, key);
    }

    // De-dupe
    models = [...new Set(models)];
    return sortModels(normalized, models);
  } catch {
    return [];
  }
}

/**
 * Live model list for a provider. Cached per process keyed by provider + key prefix.
 * Empty array means the fetch failed or the key cannot list models — callers
 * should allow custom entry rather than treating that as "no models exist".
 */
export async function getAvailableModels(
  provider: string,
  apiKey?: string,
): Promise<Array<string>> {
  const normalized = normalizeProviderKey(provider);
  const key = cacheKey(normalized, apiKey || getApiKey(normalized));
  const hit = cache.get(key);
  if (hit) {
    return hit;
  }

  const models = await Promise.race<Array<string>>([
    fetchModelsRaw(normalized, apiKey),
    new Promise<Array<string>>((resolve) =>
      setTimeout(() => resolve([]), MODEL_LIST_TIMEOUT_MS),
    ),
  ]);

  if (models.length > 0) {
    cache.set(key, models);
  }
  return models;
}

/** Clear the in-memory model cache (tests / after key change). */
export function clearModelListCache(): void {
  cache.clear();
}

/**
 * Pick a sensible default: live list ∩ preference order, else first live, else
 * first hardcoded preference for that provider.
 */
export async function resolveDefaultModel(
  provider: string,
  apiKey?: string,
): Promise<string> {
  const normalized = normalizeProviderKey(provider);
  const available = await getAvailableModels(normalized, apiKey);
  if (available.length > 0) {
    return pickPreferredModel(normalized, available);
  }
  return (PREFERRED_MODELS[normalized] ?? [])[0] ?? "";
}

/**
 * Verifies that the provided model identifier is present in the set returned by
 * {@link getAvailableModels}.
 */
export async function isModelSupportedForResponses(
  provider: string,
  model: string | undefined | null,
): Promise<boolean> {
  if (typeof model !== "string" || model.trim() === "") {
    return true;
  }

  const trimmed = model.trim();
  const prefs = Object.values(PREFERRED_MODELS).flat();
  if (prefs.includes(trimmed) || RECOMMENDED_MODELS.includes(trimmed)) {
    return true;
  }

  try {
    const models = await getAvailableModels(provider);
    if (models.length === 0) {
      return true;
    }
    return models.includes(trimmed);
  } catch {
    return true;
  }
}

/** Returns the maximum context length (in tokens) for a given model. */
export function maxTokensForModel(model: string): number {
  if (model in KNOWN_CONTEXT_LENGTHS) {
    return KNOWN_CONTEXT_LENGTHS[model]!;
  }

  // OpenRouter ids: "openai/gpt-5.6-terra"
  const bare = model.includes("/") ? model.split("/").pop()! : model;
  if (bare in KNOWN_CONTEXT_LENGTHS) {
    return KNOWN_CONTEXT_LENGTHS[bare]!;
  }

  const lower = model.toLowerCase();
  if (lower.includes("32k")) {
    return 32000;
  }
  if (lower.includes("16k")) {
    return 16000;
  }
  if (lower.includes("8k")) {
    return 8000;
  }
  if (lower.includes("4k")) {
    return 4000;
  }
  if (
    lower.includes("gpt-5") ||
    lower.includes("gemini-3") ||
    lower.includes("gemini-2.5") ||
    lower.includes("claude-opus-4") ||
    lower.includes("claude-sonnet-5") ||
    lower.includes("claude-sonnet-4") ||
    lower.includes("claude-fable")
  ) {
    return 1_000_000;
  }
  if (lower.includes("claude") || lower.startsWith("o3") || lower.startsWith("o4") || lower.startsWith("o1")) {
    return 200_000;
  }
  return 128_000;
}

/** Calculates the percentage of tokens remaining in context for a model. */
export function calculateContextPercentRemaining(
  items: Array<ResponseItem>,
  model: string,
): number {
  const used = approximateTokensUsed(items);
  const max = maxTokensForModel(model);
  const remaining = Math.max(0, max - used);
  return (remaining / max) * 100;
}

function isUserMessage(
  item: ResponseItem,
): item is ResponseItem & { type: "message"; role: "user"; content: unknown } {
  return item.type === "message" && (item as { role?: string }).role === "user";
}

/**
 * Deduplicate the stream of {@link ResponseItem}s before they are persisted in
 * component state. Later items with the same id replace earlier ones so
 * streaming token updates overwrite the in-progress bubble.
 */
export function uniqueById(items: Array<ResponseItem>): Array<ResponseItem> {
  const byId = new Map<string, number>();
  const deduped: Array<ResponseItem> = [];

  for (const item of items) {
    if (typeof item.id === "string" && item.id.length > 0) {
      const existing = byId.get(item.id);
      if (existing !== undefined) {
        deduped[existing] = item;
        continue;
      }
      byId.set(item.id, deduped.length);
    }

    if (isUserMessage(item) && deduped.length > 0) {
      const prev = deduped[deduped.length - 1]!;
      if (
        isUserMessage(prev) &&
        JSON.stringify(prev.content) === JSON.stringify(item.content)
      ) {
        continue;
      }
    }

    deduped.push(item);
  }

  return deduped;
}

/** True while the assistant message is still receiving streamed tokens. */
export function isStreamingMessage(item: ResponseItem): boolean {
  return (
    item.type === "message" &&
    (item as { role?: string }).role === "assistant" &&
    (item as { status?: string }).status === "in_progress"
  );
}

/** Provider keys that support live model listing (all registered ones). */
export function listProvidersWithModelCatalog(): Array<string> {
  return Object.keys(providers);
}
