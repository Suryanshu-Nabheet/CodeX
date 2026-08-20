import {
  CONFIG_DIR,
  saveConfig,
  type AppConfig,
} from "./config.js";
import {
  normalizeProviderKey,
  providerRequiresApiKey,
  providers,
} from "./providers.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export const USER_WIDE_ENV_PATH = join(homedir(), ".codex.env");

/** Resolve the env var name for a provider's API key. */
export function envKeyForProvider(provider: string): string {
  const key = normalizeProviderKey(provider);
  return providers[key]?.envKey ?? "LLM_API_KEY";
}

/**
 * Upsert KEY=value in ~/.codex.env and set process.env so the current
 * process can use the key immediately — no shell export required.
 */
export function upsertUserEnvVar(name: string, value: string): void {
  const trimmed = value.trim();
  if (!name || !trimmed) {
    return;
  }

  process.env[name] = trimmed;

  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    let content = "";
    if (existsSync(USER_WIDE_ENV_PATH)) {
      content = readFileSync(USER_WIDE_ENV_PATH, "utf-8");
    } else {
      content =
        "# CodexCLI user-wide environment (~/.codex.env)\n" +
        "# Written by the in-app setup wizard. Project .env overrides these.\n\n";
    }

    const line = `${name}=${trimmed}`;
    const re = new RegExp(`^${name}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      if (!content.endsWith("\n") && content.length > 0) {
        content += "\n";
      }
      content += `${line}\n`;
    }

    writeFileSync(USER_WIDE_ENV_PATH, content, { mode: 0o600 });
  } catch {
    // Persistence failure is non-fatal; process.env is already set for this run.
  }
}

/**
 * Persist a provider API key to config.json + ~/.codex.env + process.env.
 * Returns an updated AppConfig with apiKey set.
 */
export function persistProviderApiKey(
  config: AppConfig,
  provider: string,
  apiKey: string,
): AppConfig {
  const normalized = normalizeProviderKey(provider);
  const envName = envKeyForProvider(normalized);
  const key =
    normalized === "ollama" ? apiKey.trim() || "ollama" : apiKey.trim();

  if (providerRequiresApiKey(normalized)) {
    upsertUserEnvVar(envName, key);
  }

  const next: AppConfig = {
    ...config,
    provider: normalized,
    apiKey: key,
  };
  saveConfig(next);
  return next;
}

/** True when the provider can make authenticated requests. */
export function hasUsableApiKey(
  provider: string | undefined,
  options?: {
    apiKey?: string;
    /** Only trust `apiKey` when it was stored for this provider. */
    keyBelongsToProvider?: string;
  },
): boolean {
  const normalized = normalizeProviderKey(provider ?? "codexcli");
  if (!providerRequiresApiKey(normalized)) {
    return true;
  }

  const envName = envKeyForProvider(normalized);
  if (process.env[envName]?.trim()) {
    return true;
  }
  // Shared / alias env vars
  if (normalized === "codexcli") {
    if (
      process.env["OPENAI_API_KEY"]?.trim() ||
      process.env["LLM_API_KEY"]?.trim()
    ) {
      return true;
    }
  }
  if (normalized === "claude") {
    if (
      process.env["CLAUDE_API_KEY"]?.trim() ||
      process.env["ANTHROPIC_API_KEY"]?.trim()
    ) {
      return true;
    }
  }
  if (process.env["LLM_API_KEY"]?.trim()) {
    // Only accept shared key when it belongs to this provider or is unset owner
    if (
      !options?.keyBelongsToProvider ||
      normalizeProviderKey(options.keyBelongsToProvider) === normalized
    ) {
      return true;
    }
  }

  const key = options?.apiKey?.trim();
  if (!key) {
    return false;
  }

  const owner = options?.keyBelongsToProvider;
  if (!owner || normalizeProviderKey(owner) === normalized) {
    return true;
  }

  return false;
}
