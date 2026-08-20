import type { SelectOptionItem } from "./select.js";

export type OptionMapItem = SelectOptionItem & {
  previous?: OptionMapItem;
  next?: OptionMapItem;
  index: number;
};

export default class OptionMap extends Map<string, OptionMapItem> {
  first: OptionMapItem | undefined;

  constructor(options: Array<SelectOptionItem>) {
    const items: Array<[string, OptionMapItem]> = [];
    let firstItem: OptionMapItem | undefined;
    let previous: OptionMapItem | undefined;
    let index = 0;

    for (const option of options) {
      const item: OptionMapItem = {
        ...option,
        previous,
        next: undefined,
        index,
      };
      if (previous) {
        previous.next = item;
      }
      firstItem ||= item;
      items.push([option.value, item]);
      index++;
      previous = item;
    }

    super(items);
    this.first = firstItem;
  }
}
