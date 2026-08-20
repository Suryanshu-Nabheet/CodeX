import type { Provider, Message, ProviderResponse } from "./base.js";

import Anthropic from "@anthropic-ai/sdk";

export class ClaudeProvider implements Provider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-3-5-sonnet-latest") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async sendMessage(messages: Array<Message>): Promise<ProviderResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      system: messages.find((m) => m.role === "system")?.content,
    });

    const content = response.content[0];
    return {
      text: content?.type === "text" ? content.text : "",
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async streamMessage(
    messages: Array<Message>,
    onChunk: (chunk: string) => void,
  ): Promise<ProviderResponse> {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      system: messages.find((m) => m.role === "system")?.content,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of stream) {
      if (
        chunk.type === "content_block_delta" &&
        chunk.delta.type === "text_delta"
      ) {
        fullText += chunk.delta.text;
        onChunk(chunk.delta.text);
      }
    }

    return { text: fullText };
  }
}
