import SelectInput from "./select-input/select-input.js";
import Spinner from "./vendor/ink-spinner.js";
import TextInput from "./vendor/ink-text-input.js";
import { type AppConfig } from "../../config/config.js";
import {
  getProviderDisplayName,
  normalizeProviderKey,
  providerRequiresApiKey,
  providers,
} from "../../config/providers.js";
import {
  persistProviderApiKey,
} from "../../config/user-env.js";
import { getAvailableModels, clearModelListCache } from "../../utils/model-utils.js";
import { pickPreferredModel } from "../../models/defaults.js";
import { theme } from "../theme.js";
import { Box, Text } from "ink";
import React, { useState, useEffect } from "react";

type Stage =
  | "select-provider"
  | "input-api-key"
  | "fetching-models"
  | "select-model"
  | "input-custom-model"
  | "saving";

interface SetupProps {
  config: AppConfig;
  onComplete: (newConfig: AppConfig) => void;
  /** Skip provider picker and only collect a key for this provider. */
  forceProvider?: string;
  /** When true, skip model selection and just save the key. */
  keyOnly?: boolean;
}

export default function Setup({
  config,
  onComplete,
  forceProvider,
  keyOnly = false,
}: SetupProps): React.ReactElement {
  const initialProvider = normalizeProviderKey(
    forceProvider ?? config.provider ?? "codexcli",
  );
  const [stage, setStage] = useState<Stage>(() => {
    if (forceProvider || keyOnly) {
      return providerRequiresApiKey(initialProvider)
        ? "input-api-key"
        : "saving";
    }
    return "select-provider";
  });
  const [selectedProvider, setSelectedProvider] =
    useState<string>(initialProvider);
  const [apiKeyInput, setApiKeyInput] = useState<string>("");
  const [availableModels, setAvailableModels] = useState<Array<string>>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const providerItems = Object.entries(providers).map(([key, p]) => ({
    label: p.name,
    value: key,
  }));

  const handleProviderSelect = (item: { value: string }) => {
    const normalized = normalizeProviderKey(item.value);
    setSelectedProvider(normalized);
    setErrorMsg(null);
    if (!providerRequiresApiKey(normalized)) {
      setApiKeyInput("ollama");
      setStage("fetching-models");
    } else {
      setStage("input-api-key");
    }
  };

  const handleApiKeySubmit = (val: string) => {
    const trimmed = val.trim();
    if (!trimmed) {
      setErrorMsg("API key cannot be empty.");
      return;
    }
    setErrorMsg(null);
    setApiKeyInput(trimmed);
    if (keyOnly) {
      finishWithKey(selectedProvider, trimmed, config.model || "default-model");
      return;
    }
    setStage("fetching-models");
  };

  useEffect(() => {
    if (stage !== "fetching-models") {
      return;
    }
    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        clearModelListCache();
        const models = await getAvailableModels(
          selectedProvider,
          apiKeyInput,
        );
        if (cancelled) {
          return;
        }
        if (models.length > 0) {
          // Preferred models float to the top via sortModels; also preselect.
          const preferred = pickPreferredModel(selectedProvider, models);
          setSelectedModel(preferred);
          setAvailableModels(models);
          setStage("select-model");
        } else if (selectedProvider === "ollama") {
          setErrorMsg("No Ollama models found. Is Ollama running?");
          setStage("input-custom-model");
        } else {
          setStage("input-custom-model");
        }
      } catch (err) {
        if (cancelled) {
          return;
        }
        setErrorMsg(`Could not list models (${String(err)}). Enter a model name.`);
        setStage("input-custom-model");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [stage, selectedProvider, apiKeyInput]);

  const finishWithKey = (
    provider: string,
    apiKey: string,
    model: string,
  ): void => {
    setStage("saving");
    const next = persistProviderApiKey(
      { ...config, model },
      provider,
      apiKey,
    );
    setTimeout(() => {
      onComplete(next);
    }, 250);
  };

  // Local providers (ollama): persist immediately when key-only / forced.
  useEffect(() => {
    if (
      stage === "saving" &&
      (forceProvider || keyOnly) &&
      !providerRequiresApiKey(selectedProvider)
    ) {
      finishWithKey(
        selectedProvider,
        "ollama",
        config.model || "default-model",
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModelSelect = (item: { value: string }) => {
    if (item.value === "custom_input") {
      setStage("input-custom-model");
    } else {
      finishWithKey(selectedProvider, apiKeyInput, item.value);
    }
  };

  const shell = (children: React.ReactNode): React.ReactElement => (
    <Box flexDirection="column" gap={0} paddingY={0} marginTop={1}>
      <Text bold>
        {theme.glyphs.brand} setup
      </Text>
      {children}
    </Box>
  );

  if (stage === "select-provider") {
    return shell(
      <>
        <Text dimColor>provider</Text>
        <SelectInput items={providerItems} onSelect={handleProviderSelect} />
      </>,
    );
  }

  if (stage === "input-api-key") {
    const envName =
      providers[selectedProvider]?.envKey ?? "LLM_API_KEY";
    return shell(
      <>
        <Text dimColor>
          {getProviderDisplayName(selectedProvider)} key ({envName})
        </Text>
        {errorMsg ? <Text color="yellow">{errorMsg}</Text> : null}
        <TextInput
          mask="*"
          value={apiKeyInput}
          onChange={setApiKeyInput}
          onSubmit={handleApiKeySubmit}
        />
      </>,
    );
  }

  if (stage === "fetching-models") {
    return shell(
      <Text dimColor>
        <Spinner type="dots" /> fetching models…
      </Text>,
    );
  }

  if (stage === "select-model") {
    const items = availableModels.map((m) => ({
      label: m === selectedModel ? `${m} ★` : m,
      value: m,
    }));
    items.push({
      label: "custom…",
      value: "custom_input",
    });

    return shell(
      <>
        <Text dimColor>
          {availableModels.length} models · {getProviderDisplayName(selectedProvider)}
        </Text>
        <SelectInput items={items} onSelect={handleModelSelect} />
      </>,
    );
  }

  if (stage === "input-custom-model") {
    return shell(
      <>
        {errorMsg ? <Text color="yellow">{errorMsg}</Text> : null}
        <Text dimColor>model id</Text>
        <TextInput
          value={selectedModel}
          onChange={setSelectedModel}
          onSubmit={(val: string) => {
            if (!val.trim()) {
              setErrorMsg("Model name cannot be empty.");
              return;
            }
            finishWithKey(selectedProvider, apiKeyInput, val.trim());
          }}
        />
      </>,
    );
  }

  return shell(<Text dimColor>saving…</Text>);
}
