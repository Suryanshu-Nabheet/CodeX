import type { Message, Provider, ProviderResponse } from "./base.js";

import OpenAI from "openai";

export class StandardLLMProvider implements Provider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, baseURL?: string, model: string = "gpt-5.6-terra") {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = model;
  }

  async sendMessage(messages: Array<Message>): Promise<ProviderResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role as any,
        content: m.content,
        tool_call_id: m.toolCallId,
      })),
    });

    const choice = response.choices[0];
    if (!choice) {
      return { text: "" };
    }
    return {
      text: choice.message.content || "",
      toolCalls: choice.message.tool_calls?.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })),
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async streamMessage(
    messages: Array<Message>,
    onChunk: (chunk: string) => void,
  ): Promise<ProviderResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role as any,
        content: m.content,
        tool_call_id: m.toolCallId,
      })),
      stream: true,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      fullText += content;
      onChunk(content);
    }

    return {
      text: fullText,
    };
  }
}
