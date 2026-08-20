import type { Provider, Message, ProviderResponse } from "./base.js";

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiProvider implements Provider {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string, model: string = "gemini-3.6-flash") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model });
  }

  async sendMessage(messages: Array<Message>): Promise<ProviderResponse> {
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return { text: "" };
    }
    const chat = this.model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    return {
      text: response.text(),
    };
  }
  async streamMessage(
    messages: Array<Message>,
    onChunk: (chunk: string) => void,
  ): Promise<ProviderResponse> {
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      return { text: "" };
    }

    const chat = this.model.startChat({ history });
    const result = await chat.sendMessageStream(lastMessage.content);

    let fullText = "";
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullText += chunkText;
      onChunk(chunkText);
    }

    return { text: fullText };
  }
}
