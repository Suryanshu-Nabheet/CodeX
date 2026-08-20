/**
 * Soft preferences only — never used as the exclusive picker list.
 * Live provider `/models` responses are the source of truth at setup time.
 */

/** Ordered preference: first match present in the live list wins. */
export const PREFERRED_MODELS: Record<string, Array<string>> = {
  codexcli: [
    "gpt-5.6-terra",
    "gpt-5.6-sol",
    "gpt-5.6-luna",
    "gpt-5.4",
    "gpt-5.3-codex",
    "gpt-5.4-mini",
    "gpt-4.1",
    "o3",
    "o4-mini",
  ],
  claude: [
    "claude-sonnet-5",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5",
    "claude-opus-4-7",
    "claude-haiku-4-5-20251001",
  ],
  gemini: [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.5-flash-lite",
    "gemini-2.5-pro",
    "gemini-2.5-flash",
  ],
  openrouter: [
    "openai/gpt-5.6-terra",
    "anthropic/claude-sonnet-5",
    "google/gemini-3.6-flash",
    "openai/gpt-4.1",
  ],
  ollama: ["llama3.2", "llama3", "qwen2.5-coder", "codellama", "mistral"],
  mistral: ["mistral-large-latest", "mistral-small-latest", "codestral-latest"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  xai: ["grok-3", "grok-3-mini", "grok-2"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "qwen/qwen3-32b"],
};

/** Known context windows for current flagships (heuristic fallback otherwise). */
export const KNOWN_CONTEXT_LENGTHS: Record<string, number> = {
  // OpenAI GPT-5.6 family
  "gpt-5.6-sol": 1_050_000,
  "gpt-5.6-terra": 1_050_000,
  "gpt-5.6-luna": 1_050_000,
  "gpt-5.5": 400_000,
  "gpt-5.5-pro": 400_000,
  "gpt-5.4": 400_000,
  "gpt-5.4-pro": 400_000,
  "gpt-5.4-mini": 400_000,
  "gpt-5.4-nano": 400_000,
  "gpt-5.3-codex": 400_000,
  "gpt-5.2": 400_000,
  "gpt-5.1": 400_000,
  "gpt-5": 400_000,
  "gpt-5-mini": 400_000,
  "gpt-5-nano": 400_000,
  "gpt-4.1": 1_047_576,
  "gpt-4.1-mini": 1_047_576,
  "gpt-4.1-nano": 1_047_576,
  o3: 200_000,
  "o3-pro": 200_000,
  "o4-mini": 200_000,
  // Anthropic
  "claude-fable-5": 1_000_000,
  "claude-opus-4-8": 1_000_000,
  "claude-opus-4-7": 1_000_000,
  "claude-opus-4-6": 1_000_000,
  "claude-sonnet-5": 1_000_000,
  "claude-sonnet-4-6": 1_000_000,
  "claude-haiku-4-5": 200_000,
  "claude-haiku-4-5-20251001": 200_000,
  // Google
  "gemini-3.6-flash": 1_048_576,
  "gemini-3.5-flash": 1_048_576,
  "gemini-3.5-flash-lite": 1_048_576,
  "gemini-3.1-pro-preview": 1_048_576,
  "gemini-2.5-pro": 1_048_576,
  "gemini-2.5-flash": 1_048_576,
};

export function pickPreferredModel(
  provider: string,
  available: Array<string>,
): string {
  const prefs = PREFERRED_MODELS[provider] ?? [];
  for (const id of prefs) {
    if (available.includes(id)) {
      return id;
    }
  }
  // Loose match: preferred id is a prefix of a live id (or vice versa)
  for (const id of prefs) {
    const hit = available.find(
      (m) => m === id || m.startsWith(`${id}-`) || m.includes(id),
    );
    if (hit) {
      return hit;
    }
  }
  return available[0] ?? prefs[0] ?? "";
}
