import React from "react";
import { Box, Text } from "ink";
import { styles } from "./theme.js";
import { SelectOption } from "./select-option.js";
import { useSelectState } from "./use-select-state.js";
import { useSelect } from "./use-select.js";

export type SelectProps<T extends string = string> = {
  isDisabled?: boolean;
  visibleOptionCount?: number;
  highlightText?: string;
  options: Array<{ label: string; value: T }>;
  defaultValue?: T;
  onChange?: (value: T) => void;
};

export function Select<T extends string = string>({
  isDisabled = false,
  visibleOptionCount = 5,
  highlightText,
  options,
  defaultValue,
  onChange,
}: SelectProps<T>): React.ReactElement {
  const state = useSelectState({
    visibleOptionCount,
    options,
    defaultValue,
    onChange: onChange as ((value: string) => void) | undefined,
  });
  useSelect({ isDisabled, state });

  return (
    <Box {...styles.container()}>
      {state.visibleOptions.map((option) => {
        let label: React.ReactNode = option.label;
        if (highlightText && option.label.includes(highlightText)) {
          const index = option.label.indexOf(highlightText);
          label = (
            <>
              {option.label.slice(0, index)}
              <Text {...styles.highlightedText()}>{highlightText}</Text>
              {option.label.slice(index + highlightText.length)}
            </>
          );
        }

        return (
          <SelectOption
            key={option.value}
            isFocused={!isDisabled && state.focusedValue === option.value}
            isSelected={state.value === option.value}
          >
            {label}
          </SelectOption>
        );
      })}
    </Box>
  );
}

export type SelectOptionItem = {
  label: string;
  value: string;
};
