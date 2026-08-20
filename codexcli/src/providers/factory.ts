import type { Provider } from "./base.js";

import { ClaudeProvider } from "./claude.js";
import { GeminiProvider } from "./gemini.js";
import { StandardLLMProvider } from "./standard-llm.js";

export class ProviderFactory {
  static create(providerName: string, config: any): Provider {
    switch (providerName.toLowerCase()) {
      case "codexcli":
      case "codexcli-compatible":
        return new StandardLLMProvider(
          config.apiKey,
          config.baseURL,
          config.model,
        );
      case "claude":
      case "anthropic":
        return new ClaudeProvider(config.apiKey, config.model);
      case "gemini":
      case "google":
        return new GeminiProvider(config.apiKey, config.model);
      case "openrouter":
        return new StandardLLMProvider(
          config.apiKey,
          "https://openrouter.ai/api/v1",
          config.model,
        );
      case "ollama":
        return new StandardLLMProvider(
          "ollama",
          "http://localhost:11434/v1",
          config.model || "llama3",
        );
      default:
        throw new Error(`Unsupported provider: ${providerName}`);
    }
  }
}
