import TypeaheadOverlay from "./typeahead-overlay.js";
import {
  buildProviderItems,
  getProviderDisplayName,
  normalizeProviderKey,
} from "../../config/providers.js";
import { Text } from "ink";
import React from "react";

type Props = {
  currentProvider: string;
  onSelect: (provider: string) => void;
  onExit: () => void;
};

export default function ProviderOverlay({
  currentProvider,
  onSelect,
  onExit,
}: Props): React.ReactElement {
  const items = React.useMemo(() => buildProviderItems(), []);

  return (
    <TypeaheadOverlay
      title="Provider"
      description={
        <Text dimColor>{getProviderDisplayName(currentProvider)}</Text>
      }
      initialItems={items}
      currentValue={normalizeProviderKey(currentProvider)}
      onSelect={onSelect}
      onExit={onExit}
    />
  );
}
