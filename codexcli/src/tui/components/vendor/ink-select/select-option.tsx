import React from "react";
import { Box, Text } from "ink";
import figures from "figures";
import { styles } from "./theme.js";

export type SelectOptionProps = {
  isFocused: boolean;
  isSelected: boolean;
  children: React.ReactNode;
};

export function SelectOption({
  isFocused,
  isSelected,
  children,
}: SelectOptionProps): React.ReactElement {
  return (
    <Box {...styles.option({ isFocused })}>
      {isFocused ? (
        <Text {...styles.focusIndicator()}>{figures.pointer}</Text>
      ) : null}
      <Text {...styles.label({ isFocused, isSelected })}>{children}</Text>
      {isSelected ? (
        <Text {...styles.selectedIndicator()}>{figures.tick}</Text>
      ) : null}
    </Box>
  );
}
