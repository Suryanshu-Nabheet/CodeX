import type { AppConfig } from "../config/config.js";

import { getBaseUrl, getApiKey, LLM_TIMEOUT_MS } from "../config/config.js";
import OpenAI from "openai";

/**
 * Configuration for the LLM client.
 */
export type LLMClientConfig = {
  provider: string;
  apiKey?: string;
};

/**
 * Creates an LLM client instance based on the provided configuration.
 * Uses the OpenAI SDK for compatibility across multiple providers.
 *
 * @param config - The configuration containing provider information
 * @returns An instance of the OpenAI client
 */
export function createLLMClient(config: LLMClientConfig | AppConfig): OpenAI {
  const apiKey =
    "apiKey" in config && config.apiKey
      ? config.apiKey
      : getApiKey(config.provider);

  return new OpenAI({
    apiKey,
    baseURL: getBaseUrl(config.provider),
    timeout: LLM_TIMEOUT_MS,
    defaultHeaders: {},
  });
}
