import SelectInput from "./select-input/select-input.js";
import TextInput from "./vendor/ink-text-input.js";
import { Box, Text, useInput } from "ink";
import React, { useState } from "react";

export type TypeaheadItem = { label: string; value: string };

type Props = {
  title: string;
  description?: React.ReactNode;
  initialItems: Array<TypeaheadItem>;
  currentValue?: string;
  limit?: number;
  onSelect: (value: string) => void;
  onExit: () => void;
};

/**
 * Compact picker — keep it one short block so Ink does not leave ghost frames
 * in the scrollback when the overlay unmounts.
 */
export default function TypeaheadOverlay({
  title,
  description,
  initialItems,
  currentValue,
  limit = 8,
  onSelect,
  onExit,
}: Props): React.ReactElement {
  const [value, setValue] = useState("");
  const [items, setItems] = useState<Array<TypeaheadItem>>(initialItems);

  React.useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useInput((_input, key) => {
    if (key.escape) {
      onExit();
    }
  });

  const q = value.toLowerCase();
  const filtered =
    q.length === 0
      ? items
      : items.filter((i) => i.label.toLowerCase().includes(q));

  const ranked = [...filtered].sort((a, b) => {
    if (a.value === currentValue) {
      return -1;
    }
    if (b.value === currentValue) {
      return 1;
    }
    if (q.length === 0) {
      return 0;
    }
    const ia = a.label.toLowerCase().indexOf(q);
    const ib = b.label.toLowerCase().indexOf(q);
    if (ia !== ib) {
      return ia - ib;
    }
    return a.label.localeCompare(b.label);
  });

  const initialIndex = ranked.findIndex((i) => i.value === currentValue);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
      width={72}
    >
      <Text>
        <Text bold>{title}</Text>
        {description ? (
          <>
            <Text dimColor> · </Text>
            {description}
          </>
        ) : null}
      </Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={(submitted) => {
          if (ranked.length === 0) {
            const target = submitted.trim();
            if (target) {
              onSelect(target);
            } else {
              onExit();
            }
          }
        }}
      />
      {ranked.length > 0 ? (
        <SelectInput
          limit={limit}
          items={ranked}
          initialIndex={initialIndex === -1 ? 0 : initialIndex}
          isFocused
          onSelect={(item: TypeaheadItem) => {
            if (item.value) {
              onSelect(item.value);
            }
          }}
        />
      ) : (
        <Text dimColor>no matches — type an id and enter, or esc</Text>
      )}
      <Text dimColor>enter · esc</Text>
    </Box>
  );
}
