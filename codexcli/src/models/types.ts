export type ModelInfo = {
  /** The human-readable label for this model */
  label: string;
  /** The max context window size for this model */
  maxContextLength: number;
};

export type ProviderModelMap = Record<string, ModelInfo>;
