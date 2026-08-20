export interface ProviderResponse {
  text: string;
  toolCalls?: Array<ToolCall>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: any;
}

export interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolCallId?: string;
}

export interface Provider {
  sendMessage(messages: Array<Message>): Promise<ProviderResponse>;
  streamMessage(
    messages: Array<Message>,
    onChunk: (chunk: string) => void,
  ): Promise<ProviderResponse>;
}
