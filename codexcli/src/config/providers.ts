/** Maps legacy or alias provider names to canonical registry keys. */
const PROVIDER_ALIASES: Record<string, string> = {
  "codexcli-compatible": "codexcli",
  openai: "codexcli",
  anthropic: "claude",
  google: "gemini",
};

export function normalizeProviderKey(provider: string): string {
  const key = provider.toLowerCase();
  return PROVIDER_ALIASES[key] ?? key;
}

export function getProviderDisplayName(provider: string): string {
  const key = normalizeProviderKey(provider);
  return providers[key]?.name ?? provider;
}

export function buildProviderItems(): Array<{ label: string; value: string }> {
  return Object.entries(providers).map(([key, p]) => ({
    label: p.name,
    value: key,
  }));
}

/** Local providers that do not require a real API key. */
export function providerRequiresApiKey(provider: string): boolean {
  return normalizeProviderKey(provider) !== "ollama";
}

/**
 * Registered providers. Model pickers always call each provider's live
 * `/models` (or equivalent) endpoint — these entries only supply base URL +
 * env key names.
 */
export const providers: Record<
  string,
  { name: string; baseURL: string; envKey: string }
> = {
  codexcli: {
    name: "OpenAI (API-compatible)",
    baseURL: "https://api.openai.com/v1",
    envKey: "OPENAI_API_KEY",
  },
  claude: {
    name: "Claude (Anthropic)",
    baseURL: "https://api.anthropic.com/v1",
    envKey: "CLAUDE_API_KEY",
  },
  gemini: {
    name: "Google Gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
  },
  openrouter: {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
  },
  ollama: {
    name: "Ollama",
    baseURL: "http://localhost:11434/v1",
    envKey: "OLLAMA_API_KEY",
  },
  mistral: {
    name: "Mistral",
    baseURL: "https://api.mistral.ai/v1",
    envKey: "MISTRAL_API_KEY",
  },
  deepseek: {
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
  },
  xai: {
    name: "xAI",
    baseURL: "https://api.x.ai/v1",
    envKey: "XAI_API_KEY",
  },
  groq: {
    name: "Groq",
    baseURL: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
  },
};
