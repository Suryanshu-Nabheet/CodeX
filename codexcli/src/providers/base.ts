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

export interface ProviderTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
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
  sendMessage(
    messages: Array<Message>,
    tools?: Array<ProviderTool>,
  ): Promise<ProviderResponse>;
  streamMessage(
    messages: Array<Message>,
    onChunk: (chunk: string) => void,
    tools?: Array<ProviderTool>,
  ): Promise<ProviderResponse>;
}
