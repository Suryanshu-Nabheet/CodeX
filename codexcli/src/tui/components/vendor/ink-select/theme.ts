type OptionStyleArgs = { isFocused: boolean };
type LabelStyleArgs = { isFocused: boolean; isSelected: boolean };

const theme = {
  styles: {
    container: () =>
      ({
        flexDirection: "column" as const,
      }) as const,
    option: ({ isFocused }: OptionStyleArgs) =>
      ({
        gap: 1,
        paddingLeft: isFocused ? 0 : 2,
      }) as const,
    selectedIndicator: () =>
      ({
        color: "green" as const,
      }) as const,
    focusIndicator: () =>
      ({
        color: "blue" as const,
      }) as const,
    label({ isFocused, isSelected }: LabelStyleArgs) {
      let color: "green" | "blue" | undefined;
      if (isSelected) {
        color = "green";
      }
      if (isFocused) {
        color = "blue";
      }
      return { color };
    },
    highlightedText: () =>
      ({
        bold: true as const,
      }) as const,
  },
};

export const styles = theme.styles;
export default theme;
