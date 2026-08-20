import TypeaheadOverlay from "./typeahead-overlay.js";
import { getAvailableModels } from "../../utils/model-utils.js";
import {
  getProviderDisplayName,
  normalizeProviderKey,
  buildProviderItems,
} from "../../config/providers.js";
import { Box, Text, useInput } from "ink";
import React, { useEffect, useMemo, useState } from "react";

type Props = {
  currentModel: string;
  currentProvider?: string;
  hasLastResponse: boolean;
  onSelect: (allModels: Array<string>, model: string) => void;
  onSelectProvider?: (provider: string) => void;
  onExit: () => void;
  initialMode?: "model" | "provider";
};

export default function ModelOverlay({
  currentModel,
  currentProvider = "codexcli",
  hasLastResponse,
  onSelect,
  onSelectProvider,
  onExit,
  initialMode = "model",
}: Props): React.ReactElement {
  const [items, setItems] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const providerItems = useMemo(() => buildProviderItems(), []);
  const [mode, setMode] = useState<"model" | "provider">(initialMode);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setItems([]);
    void (async () => {
      try {
        const models = await getAvailableModels(
          normalizeProviderKey(currentProvider),
        );
        if (cancelled) {
          return;
        }
        setItems(models.map((m) => ({ label: m, value: m })));
      } catch {
        /* keep empty — user can type a custom id */
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentProvider]);

  useInput((_input, key) => {
    if (hasLastResponse && (key.escape || key.return)) {
      onExit();
    } else if (!hasLastResponse && key.tab) {
      setMode((m) => (m === "model" ? "provider" : "model"));
    }
  });

  if (hasLastResponse) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
        width={72}
      >
        <Text bold color="red">
          Model locked for this chat
        </Text>
        <Text dimColor>Start a new session to switch. esc to close</Text>
      </Box>
    );
  }

  if (mode === "provider") {
    return (
      <TypeaheadOverlay
        title="Provider"
        description={
          <Text dimColor>
            {getProviderDisplayName(currentProvider)} · tab → models
          </Text>
        }
        initialItems={providerItems}
        currentValue={normalizeProviderKey(currentProvider)}
        onSelect={(provider) => {
          onSelectProvider?.(provider);
          setMode("model");
        }}
        onExit={onExit}
      />
    );
  }

  return (
    <TypeaheadOverlay
      title="Model"
      description={
        <Text dimColor>
          {isLoading
            ? "loading…"
            : `${getProviderDisplayName(currentProvider)} · ${currentModel} · tab → provider`}
        </Text>
      }
      initialItems={items}
      currentValue={currentModel}
      onSelect={(selectedModel) =>
        onSelect(
          items.map((m) => m.value),
          selectedModel,
        )
      }
      onExit={onExit}
    />
  );
}
