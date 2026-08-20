import type { Provider, Message } from "../providers/base.js";

import { ToolRegistry } from "./tools.js";

export interface AgentOptions {
  provider: Provider;
  instructions: string;
  onToolOutput?: (toolName: string, output: string) => void;
  onToolApproval?: (toolName: string, args: any) => Promise<boolean>;
  onMessage?: (message: string) => void;
}

export class Agent {
  private provider: Provider;
  private tools: ToolRegistry;
  private history: Array<Message> = [];
  private instructions: string;
  private onToolOutput?: (toolName: string, output: string) => void;
  private onToolApproval?: (toolName: string, args: any) => Promise<boolean>;
  private onMessage?: (message: string) => void;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.instructions = options.instructions;
    this.onToolOutput = options.onToolOutput;
    this.onToolApproval = options.onToolApproval;
    this.onMessage = options.onMessage;
    this.tools = new ToolRegistry();

    this.history.push({
      role: "system",
      content: this.instructions,
    });
  }

  async run(userInput: string) {
    this.history.push({ role: "user", content: userInput });

    while (true) {
      const response = await this.provider.sendMessage(this.history);

      if (response.text) {
        if (this.onMessage) {this.onMessage(response.text);}
        this.history.push({ role: "assistant", content: response.text });
      }

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          const tool = this.tools.getTool(tc.name);
          if (!tool) {
            const errorMsg = `Tool ${tc.name} not found.`;
            this.history.push({
              role: "tool",
              content: errorMsg,
              toolCallId: tc.id,
            });
            continue;
          }

          let approved = !tool.requiresApproval;
          if (tool.requiresApproval && this.onToolApproval) {
            approved = await this.onToolApproval(tc.name, tc.arguments);
          }

          if (approved) {
            try {
              const output = await tool.execute(tc.arguments);
              if (this.onToolOutput) {this.onToolOutput(tc.name, output);}
              this.history.push({
                role: "tool",
                content: output,
                toolCallId: tc.id,
              });
            } catch (error: any) {
              const errorMsg = `Error executing ${tc.name}: ${error.message}`;
              this.history.push({
                role: "tool",
                content: errorMsg,
                toolCallId: tc.id,
              });
            }
          } else {
            this.history.push({
              role: "tool",
              content: "Tool execution denied by user.",
              toolCallId: tc.id,
            });
          }
        }
        // Continue loop to process tool outputs
        continue;
      }

      // No more tool calls, wait for user input
      break;
    }
  }

  getHistory() {
    return this.history;
  }
}
