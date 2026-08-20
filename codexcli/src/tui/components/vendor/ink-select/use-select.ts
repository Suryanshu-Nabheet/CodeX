import { useInput } from "ink";

export type SelectInputState = {
  focusNextOption: () => void;
  focusPreviousOption: () => void;
  selectFocusedOption: () => void;
};

export function useSelect({
  isDisabled = false,
  state,
}: {
  isDisabled?: boolean;
  state: SelectInputState;
}): void {
  useInput(
    (_input, key) => {
      if (key.downArrow) {
        state.focusNextOption();
      }
      if (key.upArrow) {
        state.focusPreviousOption();
      }
      if (key.return) {
        state.selectFocusedOption();
      }
    },
    { isActive: !isDisabled },
  );
}
