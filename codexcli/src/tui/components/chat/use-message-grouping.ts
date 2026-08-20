import type { ResponseItem } from "../../../utils/responses.js";

/**
 * Represents a grouped sequence of response items (e.g., function call batches).
 */
export type GroupedResponseItem = {
  label: string;
  items: Array<ResponseItem>;
};
