import type { ContextEngine } from "../context/context-engine.js";
import type { FilesystemController } from "../fs/filesystem-controller.js";
import type { Provider } from "../providers/base.js";

import { ToolRegistry } from "./tools.js";
import { log } from "../utils/logger.js";

export interface AgentConfig {
  provider: Provider;
  instructions: string;
  fs: FilesystemController;
  context: ContextEngine;
  onMessage?: (message: string) => void;
  onToolCall?: (toolName: string, args: unknown) => void;
  onToolResult?: (toolName: string, result: string) => void;
  onError?: (error: Error) => void;
  requireApproval?: (toolName: string, args: unknown) => Promise<boolean>;
}

export interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ProviderResponse {
  text?: string;
  toolCalls?: Array<ToolCall>;
  finishReason?: string;
}

/**
 * Core Agent implementation that operates on REAL files.
 * This is NOT a chatbot - it's a deterministic system that:
 * - Reads actual files from disk
 * - Writes actual files to disk
 * - Executes real commands
 * - Never hallucinates success
 */
export class RealAgent {
  private provider: Provider;
  private instructions: string;
  private tools: ToolRegistry;
  private history: Array<Message> = [];
  private onMessage?: (message: string) => void;
  private onToolCall?: (toolName: string, args: unknown) => void;
  private onToolResult?: (toolName: string, result: string) => void;
  private onError?: (error: Error) => void;
  private requireApproval?: (
    toolName: string,
    args: unknown,
  ) => Promise<boolean>;
  private canceled = false;

  constructor(config: AgentConfig) {
    this.provider = config.provider;
    this.instructions = config.instructions;
    this.tools = new ToolRegistry();
    this.onMessage = config.onMessage;
    this.onToolCall = config.onToolCall;
    this.onToolResult = config.onToolResult;
    this.onError = config.onError;
    this.requireApproval = config.requireApproval;

    // Add system message
    this.history.push({
      role: "system",
      content: this.instructions,
    });
  }

  /**
   * Cancel the current operation
   */
  public cancel(): void {
    this.canceled = true;
    log("RealAgent: Operation canceled");
  }

  /**
   * Reset cancellation flag
   */
  private resetCancel(): void {
    this.canceled = false;
  }

  /**
   * Run the agent with a user prompt
   */
  public async run(userPrompt: string): Promise<void> {
    this.resetCancel();

    // Add user message to history
    this.history.push({
      role: "user",
      content: userPrompt,
    });

    // Main agent loop
    let iterations = 0;
    const MAX_ITERATIONS = 50; // Prevent infinite loops

    while (iterations < MAX_ITERATIONS && !this.canceled) {
      iterations++;

      try {
        // Get response from provider
        const response = await this.provider.sendMessage(this.history);

        // Handle text response
        if (response.text) {
          if (this.onMessage) {
            this.onMessage(response.text);
          }
          this.history.push({
            role: "assistant",
            content: response.text,
          });
        }

        // Handle tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          const toolResults: Array<{ id: string; result: string }> = [];

          for (const toolCall of response.toolCalls) {
            if (this.canceled) {break;}

            const tool = this.tools.getTool(toolCall.name);
            if (!tool) {
              const errorMsg = `Tool '${toolCall.name}' not found`;
              log(errorMsg);
              toolResults.push({ id: toolCall.id, result: errorMsg });
              continue;
            }

            // Notify about tool call
            if (this.onToolCall) {
              this.onToolCall(toolCall.name, toolCall.arguments);
            }

            // Check if approval is required
            if (tool.requiresApproval && this.requireApproval) {
              const approved = await this.requireApproval(
                toolCall.name,
                toolCall.arguments,
              );
              if (!approved) {
                const denyMsg = `Tool '${toolCall.name}' execution denied by user`;
                log(denyMsg);
                toolResults.push({ id: toolCall.id, result: denyMsg });
                continue;
              }
            }

            // Execute the tool
            try {
              const result = await tool.execute(
                toolCall.arguments as Record<string, unknown>,
              );
              log(`Tool '${toolCall.name}' executed successfully`);

              if (this.onToolResult) {
                this.onToolResult(toolCall.name, result);
              }

              toolResults.push({ id: toolCall.id, result });
            } catch (error) {
              const errorMsg =
                error instanceof Error
                  ? `Error executing ${toolCall.name}: ${error.message}`
                  : `Error executing ${toolCall.name}: ${String(error)}`;
              log(errorMsg);

              if (this.onError) {
                this.onError(
                  error instanceof Error ? error : new Error(String(error)),
                );
              }

              toolResults.push({ id: toolCall.id, result: errorMsg });
            }
          }

          // Add tool results to history
          for (const { id, result } of toolResults) {
            this.history.push({
              role: "tool",
              content: result,
              toolCallId: id,
            });
          }

          // Continue loop to process tool results
          continue;
        }

        // If no tool calls and we have a response, we're done
        if (response.finishReason === "stop" || !response.toolCalls) {
          break;
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? `Agent error: ${error.message}`
            : `Agent error: ${String(error)}`;
        log(errorMsg);

        if (this.onError) {
          this.onError(
            error instanceof Error ? error : new Error(String(error)),
          );
        }

        // Add error to history and break
        this.history.push({
          role: "assistant",
          content: `I encountered an error: ${errorMsg}`,
        });
        break;
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      const msg =
        "Maximum iterations reached. Stopping to prevent infinite loop.";
      log(msg);
      if (this.onMessage) {
        this.onMessage(msg);
      }
    }
  }

  /**
   * Get the conversation history
   */
  public getHistory(): Array<Message> {
    return [...this.history];
  }

  /**
   * Clear the conversation history (except system message)
   */
  public clearHistory(): void {
    this.history = this.history.filter((msg) => msg.role === "system");
  }
}
