import type { Message, Provider, ProviderResponse, ProviderTool } from "./base.js";

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

  async sendMessage(messages: Array<Message>, tools?: Array<ProviderTool>): Promise<ProviderResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role as any,
        content: m.content,
        tool_call_id: m.toolCallId,
      })),
      tools,
    });

    const choice = response.choices[0];
    if (!choice) {
      return { text: "" };
    }
    return {
      text: choice.message.content || "",
      toolCalls: choice.message.tool_calls?.flatMap((tc) => {
        try {
          return [{
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments),
          }];
        } catch {
          return [];
        }
      }),
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
    tools?: Array<ProviderTool>,
  ): Promise<ProviderResponse> {
    const stream = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map((m) => ({
        role: m.role as any,
        content: m.content,
        tool_call_id: m.toolCallId,
      })),
      stream: true,
      tools,
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
