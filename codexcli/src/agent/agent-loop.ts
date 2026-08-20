import type { AppConfig } from "../config/config.js";
import type { ApplyPatchCommand, ApprovalPolicy } from "../utils/approvals.js";
import type {
  ResponseCreateParams,
  ResponseEvent,
  ResponseInputItem,
  ResponseItem,
  ResponseFunctionToolCall,
} from "../utils/responses.js";

import { ToolRegistry } from "./tools.js";
import { ReviewDecision } from "./review.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { recordUsage } from "./usage-store.js";
import { LLM_API_KEY, LLM_TIMEOUT_MS, getBaseUrl } from "../config/config.js";
import { handleExecCommand } from "../exec/handle-exec-command.js";
import { applyPatchToolInstructions } from "../patch/apply-patch.js";
import { log } from "../utils/logger.js";
import { parseToolCallArguments } from "../utils/parsers.js";
import { responsesCreateViaChatCompletions } from "../utils/responses.js";
import {
  ORIGIN,
  getSessionId,
  setCurrentModel,
  setSessionId,
} from "../utils/session.js";
import { CLI_VERSION } from "../utils/version.js";
import { HttpsProxyAgent } from "https-proxy-agent";
import { randomUUID } from "node:crypto";
import OpenAI, { APIConnectionTimeoutError } from "openai";

// Mapped types from responses utility
type FunctionTool = {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
};
type Tool = FunctionTool | { type: string; [key: string]: unknown };
type Reasoning = {
  effort?: string;
  summary?: string;
  [key: string]: unknown;
};

// Wait time before retrying after rate limit errors (ms).
const RATE_LIMIT_RETRY_WAIT_MS = parseInt(
  process.env["OPENAI_RATE_LIMIT_RETRY_WAIT_MS"] || "500",
  10,
);

/** Soft cap on agent turns per user message — forces a summary instead of runaway loops. */
const MAX_AGENT_TURNS = parseInt(
  process.env["CODEX_MAX_AGENT_TURNS"] || "40",
  10,
);

const PROXY_URL = process.env["HTTPS_PROXY"];

export type CommandConfirmation = {
  review: ReviewDecision;
  applyPatch?: ApplyPatchCommand | undefined;
  customDenyMessage?: string;
  explanation?: string;
};

type AgentLoopParams = {
  model: string;
  provider?: string;
  config?: AppConfig;
  instructions?: string;
  approvalPolicy: ApprovalPolicy;
  /**
   * Whether the model responses should be stored on the server side (allows
   * using `previous_response_id` to provide conversational context). Defaults
   * to `true` to preserve the current behaviour. When set to `false` the agent
   * will instead send the *full* conversation context as the `input` payload
   * on every request and omit the `previous_response_id` parameter.
   */
  disableResponseStorage?: boolean;
  onItem: (item: ResponseItem) => void;
  onLoading: (loading: boolean) => void;

  /** Extra writable roots to use with sandbox execution. */
  additionalWritableRoots: ReadonlyArray<string>;

  /** Called when the command is not auto-approved to request explicit user review. */
  getCommandConfirmation: (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>;
  onLastResponseId: (lastResponseId: string) => void;
};

const shellFunctionTool: FunctionTool = {
  type: "function",
  name: "run_command",
  description: "Runs a shell command, and returns its output.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      cmd: { type: "array", items: { type: "string" } },
      workdir: {
        type: "string",
        description: "The working directory for the command.",
      },
      timeout: {
        type: "number",
        description:
          "The maximum time to wait for the command to complete in milliseconds.",
      },
    },
    required: ["cmd"],
    additionalProperties: false,
  },
};

export class AgentLoop {
  private model: string;
  private provider: string;
  private instructions?: string;
  private approvalPolicy: ApprovalPolicy;
  private config: AppConfig;
  private additionalWritableRoots: ReadonlyArray<string>;
  /** Whether we ask the API to persist conversation state on the server */
  private readonly disableResponseStorage: boolean;

  // InstanceType<typeof CodexCLI> sidesteps typing issues with the package under
  // the TS 5+ moduleResolution=bundler setup. Client instance. We keep the concrete
  // Reference implementation for apply_patch logic.
  // type to avoid sprinkling any across the implementation while still allowing paths where
  // the SDK types may not perfectly match.
  private llmClient: OpenAI;
  private toolRegistry: ToolRegistry;

  private onItem: (item: ResponseItem) => void;
  private onLoading: (loading: boolean) => void;
  private getCommandConfirmation: (
    command: Array<string>,
    applyPatch: ApplyPatchCommand | undefined,
  ) => Promise<CommandConfirmation>;
  private onLastResponseId: (lastResponseId: string) => void;

  /**
   * A reference to the currently active stream returned from the LLM
   * client. We keep this so that we can abort the request if the user decides
   * to interrupt the current task (e.g. via the escape hot‑key).
   */
  private currentStream: unknown | null = null;
  private alreadyProcessedResponses = new Set<string>();
  private alreadyStagedItemIds = new Set<string>();
  /** Incremented with every call to `run()`. Allows us to ignore stray events
   * from streams that belong to a previous run which might still be emitting
   * after the user has canceled and issued a new command. */
  private generation = 0;
  /** AbortController for in‑progress tool calls (e.g. shell commands). */
  private execAbortController: AbortController | null = null;
  /** Set to true when `cancel()` is called so `run()` can exit early. */
  private canceled = false;
  /** True while a `run()` is in flight — blocks concurrent runs (follow-ups queue in the UI). */
  private running = false;

  /** Whether the agent is currently working a turn. */
  public isRunning(): boolean {
    return this.running;
  }

  /**
   * Local conversation transcript used when `disableResponseStorage === true`. Holds
   * all non‑system items exchanged so far so we can provide full context on
   * every request.
   */
  private transcript: Array<ResponseInputItem> = [];
  /** Function calls that were emitted by the model but never answered because
   *  the user cancelled the run.  We keep the `call_id`s around so the *next*
   *  request can send a dummy `function_call_output` that satisfies the
   *  contract and prevents errors from the LLM provider. */
  private pendingAborts: Set<string> = new Set();
  /** Set to true by `terminate()` – prevents any further use of the instance. */
  private terminated = false;
  /** Master abort controller – fires when terminate() is invoked. */
  private readonly hardAbort = new AbortController();

  /**
   * Abort the ongoing request/stream, if any. This allows callers (typically
   * the UI layer) to interrupt the current agent step so the user can issue
   * new instructions without waiting for the model to finish.
   */
  public cancel(): void {
    if (this.terminated) {
      return;
    }

    // Reset the current stream to allow new requests
    this.currentStream = null;
    log(
      `AgentLoop.cancel() invoked – currentStream=${Boolean(
        this.currentStream,
      )} execAbortController=${Boolean(this.execAbortController)} generation=${
        this.generation
      }`,
    );
    (
      this.currentStream as { controller?: { abort?: () => void } } | null
    )?.controller?.abort?.();

    this.canceled = true;
    this.running = false;

    // Abort any in-progress tool calls
    this.execAbortController?.abort();

    // Create a new abort controller for future tool calls
    this.execAbortController = new AbortController();
    log("AgentLoop.cancel(): execAbortController.abort() called");

    // NOTE: We intentionally do *not* clear `lastResponseId` here.  If the
    // stream produced a `function_call` before the user cancelled, CodexCLI now
    // expects a corresponding `function_call_output` that must reference that
    // very same response ID.  We therefore keep the ID around so the
    // follow‑up request can still satisfy the contract.

    // If we have *not* seen any function_call IDs yet there is nothing that
    // needs to be satisfied in a follow‑up request.  In that case we clear
    // the stored lastResponseId so a subsequent run starts a clean turn.
    if (this.pendingAborts.size === 0) {
      try {
        this.onLastResponseId("");
      } catch {
        /* ignore */
      }
    }

    this.onLoading(false);

    /* Inform the UI that the run was aborted by the user. */
    // const cancelNotice: ResponseItem = {
    //   id: `cancel-${Date.now()}`,
    //   type: "message",
    //   role: "system",
    //   content: [
    //     {
    //       type: "input_text",
    //       text: "⏹️  Execution canceled by user.",
    //     },
    //   ],
    // };
    // this.onItem(cancelNotice);

    this.generation += 1;
    log(`AgentLoop.cancel(): generation bumped to ${this.generation}`);
  }

  /**
   * Replace the local conversation transcript with a compact summary so the
   * next turn starts fresh without replaying the full history.
   */
  public replaceContext(summaryText: string): void {
    this.transcript = [
      {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              "Conversation compacted. Continue from this summary:\n\n" +
              summaryText,
          },
        ],
      } as ResponseInputItem,
    ];
    this.pendingAborts.clear();
    try {
      this.onLastResponseId("");
    } catch {
      /* ignore */
    }
    this.generation += 1;
    log("AgentLoop.replaceContext(): transcript replaced with summary");
  }

  /**
   * Hard‑stop the agent loop. After calling this method the instance becomes
   * unusable: any in‑flight operations are aborted and subsequent invocations
   * of `run()` will throw.
   */
  public terminate(): void {
    if (this.terminated) {
      return;
    }
    this.terminated = true;

    this.hardAbort.abort();

    this.cancel();
  }

  public sessionId: string;
  /*
   * Cumulative thinking time across this AgentLoop instance (ms).
   * Currently not used anywhere – comment out to keep the strict compiler
   * happy under `noUnusedLocals`.  Restore when telemetry support lands.
   */
  // private cumulativeThinkingMs = 0;
  constructor({
    model,
    provider = "codexcli",
    instructions,
    approvalPolicy,
    disableResponseStorage,
    // `config` used to be required.  Some unit‑tests (and potentially other
    // callers) instantiate `AgentLoop` without passing it, so we make it
    // optional and fall back to sensible defaults.  This keeps the public
    // surface backwards‑compatible and prevents runtime errors like
    // "Cannot read properties of undefined (reading 'apiKey')" when accessing
    // `config.apiKey` below.
    config,
    onItem,
    onLoading,
    getCommandConfirmation,
    onLastResponseId,
    additionalWritableRoots,
  }: AgentLoopParams & { config?: AppConfig }) {
    this.model = model;
    this.provider = provider;
    this.instructions = instructions;
    this.approvalPolicy = approvalPolicy;

    // If no `config` has been provided we derive a minimal stub so that the
    // rest of the implementation can rely on `this.config` always being a
    // defined object.  We purposefully copy over the `model` and
    // `instructions` that have already been passed explicitly so that
    // downstream consumers (e.g. telemetry) still observe the correct values.
    this.config = config ?? {
      model,
      instructions: instructions ?? "",
    };
    this.additionalWritableRoots = additionalWritableRoots;
    this.onItem = onItem;
    this.onLoading = onLoading;
    this.getCommandConfirmation = getCommandConfirmation;
    this.onLastResponseId = onLastResponseId;

    this.disableResponseStorage = disableResponseStorage ?? false;
    this.sessionId = getSessionId() || randomUUID().replaceAll("-", "");
    // Configure LLM client with optional timeout (ms) from environment
    const timeoutMs = LLM_TIMEOUT_MS;
    // For Ollama/local providers, ensure we have a dummy key if none provided
    const isLocal =
      this.provider.toLowerCase() === "ollama" ||
      this.provider.toLowerCase() === "local";
    const apiKey =
      this.config.apiKey ?? LLM_API_KEY ?? (isLocal ? "ollama" : undefined);
    const baseURL = getBaseUrl(this.provider);

    this.llmClient = new OpenAI({
      // The CodexCLI-compatible SDK only requires `apiKey` when making requests against
      // the official API.  When running unit‑tests we stub out all network
      // calls so an undefined key is perfectly fine.  We therefore only set
      // the property if we actually have a value to avoid triggering runtime
      // errors inside the SDK (it validates that `apiKey` is a non‑empty
      // string when the field is present).
      ...(apiKey ? { apiKey } : {}),
      baseURL,
      defaultHeaders: {
        originator: ORIGIN,
        version: CLI_VERSION,
        session_id: this.sessionId,
      },
      httpAgent: PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : undefined,
      ...(timeoutMs !== undefined ? { timeout: timeoutMs } : {}),
    });

    setSessionId(this.sessionId);
    setCurrentModel(this.model);

    // Initialize tool registry for file operations
    this.toolRegistry = new ToolRegistry();

    this.hardAbort = new AbortController();

    this.hardAbort.signal.addEventListener(
      "abort",
      () => this.execAbortController?.abort(),
      { once: true },
    );
  }

  private async handleFunctionCall(
    item: ResponseFunctionToolCall,
  ): Promise<Array<ResponseInputItem>> {
    // If the agent has been canceled in the meantime we should not perform any
    // additional work. Returning an empty array ensures that we neither execute
    // the requested tool call nor enqueue any follow‑up input items. This keeps
    // the cancellation semantics intuitive for users – once they interrupt a
    // task no further actions related to that task should be taken.
    if (this.canceled) {
      return [];
    }
    // ---------------------------------------------------------------------
    // Normalise the function‑call item into a consistent shape regardless of
    // whether it originated from the `/responses` or the `/chat/completions`
    // endpoint – their JSON differs slightly.
    // ---------------------------------------------------------------------

    const isChatStyle =
      // The chat endpoint nests function details under a `function` key.
      // We conservatively treat the presence of this field as a signal that
      // we are dealing with the chat format.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item as any).function != null;

    const name: string | undefined = isChatStyle
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item as any).function?.name
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item as any).name;

    const rawArguments: string | undefined = isChatStyle
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item as any).function?.arguments
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item as any).arguments;

    // The CodexCLI "function_call" item may have either `call_id` (responses
    // endpoint) or `id` (chat endpoint).  Prefer `call_id` if present but fall
    // back to `id` to remain compatible.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const callId: string = (item as any).call_id ?? (item as any).id;
    if (this.alreadyProcessedResponses.has(callId)) {
      return [];
    }
    this.alreadyProcessedResponses.add(callId);

    log(
      `handleFunctionCall(): name=${
        name ?? "undefined"
      } callId=${callId} args=${rawArguments}`,
    );

    const isShellCommand =
      name === "container.exec" || name === "run_command" || name === "shell";

    let args: any;
    if (isShellCommand) {
      args = parseToolCallArguments(rawArguments ?? "{}");
      if (args == null) {
        const outputItem: ResponseInputItem.FunctionCallOutput = {
          type: "function_call_output",
          call_id: callId,
          output: `invalid arguments for shell command: ${rawArguments}`,
        };
        return [outputItem];
      }
    } else {
      try {
        args = JSON.parse(rawArguments ?? "{}");
      } catch (e) {
        const outputItem: ResponseInputItem.FunctionCallOutput = {
          type: "function_call_output",
          call_id: callId,
          output: `failed to parse arguments: ${rawArguments}`,
        };
        return [outputItem];
      }
    }

    const outputItem: ResponseInputItem.FunctionCallOutput = {
      type: "function_call_output",
      // `call_id` is mandatory – ensure we never send `undefined` which would
      // trigger the "No tool output found…" 400 from the API.
      call_id: callId,
      output: "no function found",
    };

    // We intentionally *do not* remove this `callId` from the `pendingAborts`
    // set right away.  The output produced below is only queued up for the
    // *next* request to the CodexCLI API – it has not been delivered yet.  If
    // the user presses ESC‑ESC (i.e. invokes `cancel()`) in the small window
    // between queuing the result and the actual network call, we need to be
    // able to surface a synthetic `function_call_output` marked as
    // "aborted".  Keeping the ID in the set until the run concludes
    // successfully lets the next `run()` differentiate between an aborted
    // tool call (needs the synthetic output) and a completed one (cleared
    // below in the `flush()` helper).

    // used to tell model to stop if needed
    const additionalItems: Array<ResponseInputItem> = [];

    // TODO: allow arbitrary function calls (beyond shell/container.exec)
    if (
      name === "container.exec" ||
      name === "run_command" ||
      name === "shell"
    ) {
      const {
        outputText,
        metadata,
        additionalItems: additionalItemsFromExec,
      } = await handleExecCommand(
        args,
        this.config,
        this.approvalPolicy,
        this.additionalWritableRoots,
        this.getCommandConfirmation,
        this.execAbortController?.signal,
      );
      outputItem.output = JSON.stringify({ output: outputText, metadata });

      if (additionalItemsFromExec) {
        additionalItems.push(...additionalItemsFromExec);
      }
    } else if (name) {
      // Check if this is a file operation tool from ToolRegistry
      const tool = this.toolRegistry.getTool(name);
      if (tool) {
        // Honor requiresApproval under "suggest"; auto-edit/full-auto proceed.
        if (tool.requiresApproval && this.approvalPolicy === "suggest") {
          const { review } = await this.getCommandConfirmation(
            [name, typeof args === "object" ? JSON.stringify(args) : String(args)],
            name === "apply_patch" &&
              args &&
              typeof (args as { patch?: string }).patch === "string"
              ? { patch: (args as { patch: string }).patch }
              : undefined,
          );
          if (
            review !== ReviewDecision.YES &&
            review !== ReviewDecision.ALWAYS
          ) {
            outputItem.output = JSON.stringify({
              output: `User declined tool '${name}'.`,
              metadata: { exit_code: 1, duration_seconds: 0 },
            });
            return [outputItem, ...additionalItems];
          }
        }

        try {
          const output = await tool.execute(args);
          outputItem.output = JSON.stringify({
            output: output,
            metadata: { exit_code: 0, duration_seconds: 0 },
          });
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          outputItem.output = JSON.stringify({
            output: `Error executing ${name}: ${errorMessage}`,
            metadata: { exit_code: 1, duration_seconds: 0 },
          });
        }
      }
    }

    return [outputItem, ...additionalItems];
  }

  private async handleLocalShellCall(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    item: any,
  ): Promise<Array<ResponseInputItem>> {
    // If the agent has been canceled in the meantime we should not perform any
    // additional work. Returning an empty array ensures that we neither execute
    // the requested tool call nor enqueue any follow‑up input items. This keeps
    // the cancellation semantics intuitive for users – once they interrupt a
    // task no further actions related to that task should be taken.
    if (this.canceled) {
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outputItem: any = {
      type: "local_shell_call_output",
      // `call_id` is mandatory – ensure we never send `undefined` which would
      // trigger the "No tool output found…" 400 from the API.
      call_id: item.call_id,
      output: "no function found",
    };

    // We intentionally *do not* remove this `callId` from the `pendingAborts`
    // set right away.  The output produced below is only queued up for the
    // *next* request to the CodexCLI API – it has not been delivered yet.  If
    // the user presses ESC‑ESC (i.e. invokes `cancel()`) in the small window
    // between queuing the result and the actual network call, we need to be
    // able to surface a synthetic `function_call_output` marked as
    // "aborted".  Keeping the ID in the set until the run concludes
    // successfully lets the next `run()` differentiate between an aborted
    // tool call (needs the synthetic output) and a completed one (cleared
    // below in the `flush()` helper).

    // used to tell model to stop if needed
    const additionalItems: Array<ResponseInputItem> = [];

    if (item.action.type !== "exec") {
      throw new Error("Invalid action type");
    }

    const args = {
      cmd: item.action.command,
      workdir: item.action.working_directory,
      timeoutInMillis: item.action.timeout_ms,
    };

    const {
      outputText,
      metadata,
      additionalItems: additionalItemsFromExec,
    } = await handleExecCommand(
      args,
      this.config,
      this.approvalPolicy,
      this.additionalWritableRoots,
      this.getCommandConfirmation,
      this.execAbortController?.signal,
    );
    outputItem.output = JSON.stringify({ output: outputText, metadata });

    if (additionalItemsFromExec) {
      additionalItems.push(...additionalItemsFromExec);
    }

    return [outputItem, ...additionalItems];
  }

  public async run(
    input: Array<ResponseInputItem>,
    previousResponseId: string = "",
  ): Promise<void> {
    // ---------------------------------------------------------------------
    // Top‑level error wrapper so that known transient network issues like
    // `ERR_STREAM_PREMATURE_CLOSE` do not crash the entire CLI process.
    // Instead we surface the failure to the user as a regular system‑message
    // and terminate the current run gracefully. The calling UI can then let
    // the user retry the request if desired.
    // ---------------------------------------------------------------------

    if (this.running) {
      log(
        "AgentLoop.run(): ignored — a turn is already in flight (queue follow-ups in the UI)",
      );
      return;
    }
    this.running = true;

    try {
      if (this.terminated) {
        throw new Error("AgentLoop has been terminated");
      }
      // Record when we start "thinking" so we can report accurate elapsed time.
      const thinkingStart = Date.now();
      // Bump generation so that any late events from previous runs can be
      // identified and dropped.
      const thisGeneration = ++this.generation;

      // Reset cancellation flag and stream for a fresh run.
      this.canceled = false;
      this.currentStream = null;

      // Create a fresh AbortController for this run so that tool calls from a
      // previous run do not accidentally get signalled.
      this.execAbortController = new AbortController();
      log(
        `AgentLoop.run(): new execAbortController created (${this.execAbortController.signal}) for generation ${this.generation}`,
      );
      // NOTE: We no longer (re‑)attach an `abort` listener to `hardAbort` here.
      // A single listener that forwards the `abort` to the current
      // `execAbortController` is installed once in the constructor. Re‑adding a
      // new listener on every `run()` caused the same `AbortSignal` instance to
      // accumulate listeners which in turn triggered Node's
      // `MaxListenersExceededWarning` after ten invocations.

      // Track the response ID from the last *stored* response so we can use
      // `previous_response_id` when `disableResponseStorage` is enabled.  When storage
      // is disabled we deliberately ignore the caller‑supplied value because
      // the backend will not retain any state that could be referenced.
      // If the backend stores conversation state (`disableResponseStorage === false`) we
      // forward the caller‑supplied `previousResponseId` so that the model sees the
      // full context.  When storage is disabled we *must not* send any ID because the
      // server no longer retains the referenced response.
      let lastResponseId: string = this.disableResponseStorage
        ? ""
        : previousResponseId;

      // If there are unresolved function calls from a previously cancelled run
      // we have to emit dummy tool outputs so that the API no longer expects
      // them.  We prepend them to the user‑supplied input so they appear
      // first in the conversation turn.
      const abortOutputs: Array<ResponseInputItem> = [];
      if (this.pendingAborts.size > 0) {
        for (const id of this.pendingAborts) {
          abortOutputs.push({
            type: "function_call_output",
            call_id: id,
            output: JSON.stringify({
              output: "aborted",
              metadata: { exit_code: 1, duration_seconds: 0 },
            }),
          } as ResponseInputItem.FunctionCallOutput);
        }
        // Once converted the pending list can be cleared.
        this.pendingAborts.clear();
      }

      // Build the input list for this turn. When responses are stored on the
      // server we can simply send the *delta* (the new user input as well as
      // any pending abort outputs) and rely on `previous_response_id` for
      // context.  When storage is disabled the server has no memory of the
      // conversation, so we must include the *entire* transcript (minus system
      // messages) on every call.

      let turnInput: Array<ResponseInputItem> = [];
      // Keeps track of how many items in `turnInput` stem from the existing
      // transcript so we can avoid re‑emitting them to the UI. Only used when
      // `disableResponseStorage === true`.
      let transcriptPrefixLen = 0;

      // Get file operation tools from registry and convert to tool format
      const registryTools = this.toolRegistry.getAllTools();
      const fileOperationTools: Array<Tool> = registryTools.map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: false,
      }));

      const tools: Array<Tool> = [shellFunctionTool, ...fileOperationTools];
      // Note: We always provide file operation tools now to ensure the agent
      // can fulfill its core feature of manipulating the codebase.

      const stripInternalFields = (
        item: ResponseInputItem,
      ): ResponseInputItem => {
        // Clone shallowly and remove fields that are not part of the public
        // schema expected by the Responses API.
        // We shallow‑clone the item so that subsequent mutations (deleting
        // internal fields) do not affect the original object which may still
        // be referenced elsewhere (e.g. UI components).
        const clean = { ...item } as Record<string, unknown>;
        delete clean["duration_ms"];
        // Remove assigned identifiers and transient status so the
        // backend does not reject items that were never persisted because we
        // use `store: false`.
        delete clean["id"];
        delete clean["status"];
        return clean as unknown as ResponseInputItem;
      };

      if (this.disableResponseStorage) {
        // Remember where the existing transcript ends – everything after this
        // index in the upcoming `turnInput` list will be *new* for this turn
        // and therefore needs to be surfaced to the UI.
        transcriptPrefixLen = this.transcript.length;

        // Ensure the transcript is up‑to‑date with the latest user input so
        // that subsequent iterations see a complete history.
        // `turnInput` is still empty at this point (it will be filled later).
        // We need to look at the *input* items the user just supplied.
        this.transcript.push(...filterToApiMessages(input));

        turnInput = [...this.transcript, ...abortOutputs].map(
          stripInternalFields,
        );
      } else {
        turnInput = [...abortOutputs, ...input].map(stripInternalFields);
      }

      this.onLoading(true);

      const staged: Array<ResponseItem | undefined> = [];
      const stageItem = (item: ResponseItem) => {
        // Ignore any stray events that belong to older generations.
        if (thisGeneration !== this.generation) {
          return;
        }

        // Skip items we've already processed to avoid staging duplicates
        if (item.id == null || this.alreadyStagedItemIds.has(item.id)) {
          return;
        }
        this.alreadyStagedItemIds.add(item.id);

        // Store the item so the final flush can still operate on a complete list.
        // We'll nil out entries once they're delivered.
        const idx = staged.push(item) - 1;

        // Instead of emitting synchronously we schedule a short‑delay delivery.
        //
        // This accomplishes two things:
        //   1. The UI still sees new messages almost immediately, creating the
        //      perception of real‑time updates.
        //   2. If the user calls `cancel()` in the small window right after the
        //      item was staged we can still abort the delivery because the
        //      generation counter will have been bumped by `cancel()`.
        //
        // Use a minimal 3ms delay for terminal rendering to maintain readable
        // streaming.
        setTimeout(() => {
          if (
            thisGeneration === this.generation &&
            !this.canceled &&
            !this.hardAbort.signal.aborted
          ) {
            this.onItem(item);
            // Mark as delivered so flush won't re-emit it
            staged[idx] = undefined;

            // Handle transcript updates to maintain consistency. When we
            // operate without server‑side storage we keep our own transcript
            // so we can provide full context on subsequent calls.
            if (this.disableResponseStorage) {
              // Exclude system messages from transcript as they do not form
              // part of the assistant/user dialogue that the model needs.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const role = (item as any).role;
              if (role !== "system") {
                // Clone the item to avoid mutating the object that is also
                // rendered in the UI. We need to strip auxiliary metadata
                // such as `duration_ms` which is not part of the Responses
                // API schema and therefore causes a 400 error when included
                // in subsequent requests whose context is sent verbatim.

                // Skip items that we have already inserted earlier or that the
                // model does not need to see again in the next turn.
                //   • function_call   – superseded by the forthcoming
                //     function_call_output.
                //   • reasoning       – internal only, never sent back.
                //   • user messages   – we added these to the transcript when
                //     building the first turnInput; stageItem would add a
                //     duplicate.
                if (
                  (item as ResponseInputItem).type === "function_call" ||
                  (item as ResponseInputItem).type === "reasoning" ||
                  item.type === "local_shell_call" ||
                  ((item as ResponseInputItem).type === "message" &&
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (item as any).role === "user")
                ) {
                  return;
                }

                const clone: ResponseInputItem = {
                  ...(item as unknown as ResponseInputItem),
                } as ResponseInputItem;
                // The `duration_ms` field is only added to reasoning items to
                // show elapsed time in the UI. It must not be forwarded back
                // to the server.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                delete (clone as any).duration_ms;

                this.transcript.push(clone);
              }
            }
          }
        }, 3); // Small 3ms delay for readable streaming.
      };

      let agentTurnCount = 0;
      while (turnInput.length > 0) {
        if (this.canceled || this.hardAbort.signal.aborted) {
          this.onLoading(false);
          return;
        }

        agentTurnCount += 1;
        if (agentTurnCount > MAX_AGENT_TURNS) {
          log(
            `AgentLoop.run(): soft stop after ${MAX_AGENT_TURNS} turns (CODEX_MAX_AGENT_TURNS)`,
          );
          stageItem({
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  `Stopped after ${MAX_AGENT_TURNS} agent turns to avoid a runaway loop. ` +
                  `Raise CODEX_MAX_AGENT_TURNS or send another message to continue.`,
              },
            ],
          } as ResponseItem);
          this.onLoading(false);
          return;
        }

        // send request to provider
        // Only surface the *new* input items to the UI – replaying the entire
        // transcript would duplicate messages that have already been shown in
        // earlier turns.
        // `turnInput` holds the *new* items that will be sent to the API in
        // this iteration.  Surface exactly these to the UI so that we do not
        // re‑emit messages from previous turns (which would duplicate user
        // prompts) and so that freshly generated `function_call_output`s are
        // shown immediately.
        // Figure out what subset of `turnInput` constitutes *new* information
        // for the UI so that we don't spam the interface with repeats of the
        // entire transcript on every iteration when response storage is
        // disabled.
        const deltaInput = this.disableResponseStorage
          ? turnInput.slice(transcriptPrefixLen)
          : [...turnInput];
        for (const item of deltaInput) {
          stageItem(item as ResponseItem);
        }
        // Send request to provider with retry on timeout.
        let stream;

        // Retry loop for transient errors. Up to MAX_RETRIES attempts.
        const MAX_RETRIES = 8;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            let reasoning: Reasoning | undefined;
            let modelSpecificInstructions: string | undefined;
            if (
              this.model.startsWith("o") ||
              this.model.startsWith("codex") ||
              this.model.startsWith("gpt-5")
            ) {
              reasoning = { effort: this.config.reasoningEffort ?? "medium" };
              reasoning.summary = "auto";
            }
            if (
              this.model.startsWith("gpt-4.1") ||
              this.model.startsWith("gpt-5")
            ) {
              modelSpecificInstructions = applyPatchToolInstructions;
            }
            const prefix = buildPrefix(this.model, this.provider);
            const mergedInstructions = [
              prefix,
              modelSpecificInstructions,
              // User + project instructions only (SYSTEM_PROMPT already in prefix).
              this.instructions,
            ]
              .filter((s) => typeof s === "string" && s.trim() !== "")
              .join("\n\n");

            const responseCall =
              !this.config.provider ||
              this.config.provider?.toLowerCase() === "codexcli"
                ? (params: ResponseCreateParams) =>
                    this.llmClient.responses.create(params as any)
                : (params: ResponseCreateParams) =>
                    responsesCreateViaChatCompletions(
                      this.llmClient,
                      params as any,
                    );
            log(
              `instructions (length ${mergedInstructions.length}): ${mergedInstructions}`,
            );

            // eslint-disable-next-line no-await-in-loop
            stream = await responseCall({
              model: this.model,
              instructions: mergedInstructions,
              input: turnInput as any,
              stream: true,
              parallel_tool_calls: true,
              reasoning: reasoning as any,
              ...(this.config.flexMode ? { service_tier: "flex" } : {}),
              ...(this.disableResponseStorage
                ? { store: false }
                : {
                    store: true,
                    previous_response_id: lastResponseId || undefined,
                  }),
              tools: tools as any,
              // Explicitly tell the model it is allowed to pick whatever
              // tool it deems appropriate.  Omitting this sometimes leads to
              // the model ignoring the available tools and responding with
              // plain text instead (resulting in a missing tool‑call).
              tool_choice: "auto",
            });
            break;
          } catch (error) {
            const isTimeout = error instanceof APIConnectionTimeoutError;
            // Lazily look up the APIConnectionError class at runtime to
            // accommodate the test environment's minimal CodexCLI mocks which
            // do not define the class.  Falling back to `false` when the
            // export is absent ensures the check never throws.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const ApiConnErrCtor = (OpenAI as any).APIConnectionError as  // eslint-disable-next-line @typescript-eslint/no-explicit-any
              | (new (...args: any) => Error)
              | undefined;
            const isConnectionError = ApiConnErrCtor
              ? error instanceof ApiConnErrCtor
              : false;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const errCtx = error as any;
            const status =
              errCtx?.status ?? errCtx?.httpStatus ?? errCtx?.statusCode;
            // Treat classical 5xx *and* explicit CodexCLI `server_error` types
            // as transient server-side failures that qualify for a retry. The
            // SDK often omits the numeric status for these, reporting only
            // the `type` field.
            const isServerError =
              (typeof status === "number" && status >= 500) ||
              errCtx?.type === "server_error";
            if (
              (isTimeout || isServerError || isConnectionError) &&
              attempt < MAX_RETRIES
            ) {
              log(
                `AI request failed (attempt ${attempt}/${MAX_RETRIES}), retrying...`,
              );
              continue;
            }

            const isTooManyTokensError =
              (errCtx.param === "max_tokens" ||
                (typeof errCtx.message === "string" &&
                  /max_tokens is too large/i.test(errCtx.message))) &&
              errCtx.type === "invalid_request_error";

            if (isTooManyTokensError) {
              this.onItem({
                id: `error-${Date.now()}`,
                type: "message",
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: "⚠️  The current request exceeds the maximum context length supported by the chosen model. Please shorten the conversation, run /clear, or switch to a model with a larger context window and try again.",
                  },
                ],
              });
              this.onLoading(false);
              return;
            }

            const isRateLimit =
              status === 429 ||
              errCtx.code === "rate_limit_exceeded" ||
              errCtx.type === "rate_limit_exceeded" ||
              /rate limit/i.test(errCtx.message ?? "");
            if (isRateLimit) {
              if (attempt < MAX_RETRIES) {
                // Exponential backoff: base wait * 2^(attempt-1), or use suggested retry time
                // if provided.
                let delayMs = RATE_LIMIT_RETRY_WAIT_MS * 2 ** (attempt - 1);

                // Parse suggested retry time from error message, e.g., "Please try again in 1.3s"
                const msg = errCtx?.message ?? "";
                const m = /(?:retry|try) again in ([\d.]+)s/i.exec(msg);
                if (m && m[1]) {
                  const suggested = parseFloat(m[1]) * 1000;
                  if (!Number.isNaN(suggested)) {
                    delayMs = suggested;
                  }
                }
                log(
                  `Rate limit exceeded (attempt ${attempt}/${MAX_RETRIES}), retrying in ${Math.round(
                    delayMs,
                  )} ms...`,
                );
                // eslint-disable-next-line no-await-in-loop
                await new Promise((resolve) => setTimeout(resolve, delayMs));
                continue;
              } else {
                // We have exhausted all retry attempts. Surface a message so the user understands
                // why the request failed and can decide how to proceed (e.g. wait and retry later
                // or switch to a different model / account).

                const errorDetails = [
                  `Status: ${status || "unknown"}`,
                  `Code: ${errCtx.code || "unknown"}`,
                  `Type: ${errCtx.type || "unknown"}`,
                  `Message: ${errCtx.message || "unknown"}`,
                ].join(", ");

                this.onItem({
                  id: `error-${Date.now()}`,
                  type: "message",
                  role: "system",
                  content: [
                    {
                      type: "input_text",
                      text: `⚠️  Rate limit reached. Error details: ${errorDetails}. Please try again later.`,
                    },
                  ],
                });

                this.onLoading(false);
                return;
              }
            }

            const isClientError =
              (typeof status === "number" &&
                status >= 400 &&
                status < 500 &&
                status !== 429) ||
              errCtx.code === "invalid_request_error" ||
              errCtx.type === "invalid_request_error";
            if (isClientError) {
              this.onItem({
                id: `error-${Date.now()}`,
                type: "message",
                role: "system",
                content: [
                  {
                    type: "input_text",
                    // Surface the request ID when it is present on the error so users
                    // can reference it when contacting support or inspecting logs.
                    text: (() => {
                      const reqId =
                        (
                          errCtx as Partial<{
                            request_id?: string;
                            requestId?: string;
                          }>
                        )?.request_id ??
                        (
                          errCtx as Partial<{
                            request_id?: string;
                            requestId?: string;
                          }>
                        )?.requestId;

                      const errorDetails = [
                        `Status: ${status || "unknown"}`,
                        `Code: ${errCtx.code || "unknown"}`,
                        `Type: ${errCtx.type || "unknown"}`,
                        `Message: ${errCtx.message || "unknown"}`,
                      ].join(", ");

                      return `⚠️  AI Provider rejected the request${
                        reqId ? ` (request ID: ${reqId})` : ""
                      }. Error details: ${errorDetails}. Please verify your settings and try again.`;
                    })(),
                  },
                ],
              });
              this.onLoading(false);
              return;
            }
            throw error;
          }
        }

        // If the user requested cancellation while we were awaiting the network
        // request, abort immediately before we start handling the stream.
        if (this.canceled || this.hardAbort.signal.aborted) {
          // `stream` is defined; abort to avoid wasting tokens/server work
          try {
            (
              stream as { controller?: { abort?: () => void } }
            )?.controller?.abort?.();
          } catch {
            /* ignore */
          }
          this.onLoading(false);
          return;
        }

        // Keep track of the active stream so it can be aborted on demand.
        this.currentStream = stream;

        // Guard against an undefined stream before iterating.
        if (!stream) {
          this.onLoading(false);
          log("AgentLoop.run(): stream is undefined");
          return;
        }

        const MAX_STREAM_RETRIES = 5;
        let streamRetryAttempt = 0;

        // Live assistant text — emit token deltas to the UI (throttled).
        let streamingItemId: string | null = null;
        let streamingText = "";
        let streamFlushTimer: ReturnType<typeof setTimeout> | null = null;

        const emitStreamingMessage = (final: boolean): void => {
          if (!streamingItemId) {
            return;
          }
          if (
            thisGeneration !== this.generation ||
            this.canceled ||
            this.hardAbort.signal.aborted
          ) {
            return;
          }
          const item = {
            type: "message",
            id: streamingItemId,
            status: final ? "completed" : "in_progress",
            role: "assistant",
            content: [
              {
                type: "output_text",
                text: streamingText,
                annotations: [],
              },
            ],
          } as ResponseItem;
          // Bypass stageItem while in progress so the same id can update.
          // Finalize through stageItem so dedupe / transcript stay consistent.
          if (final) {
            if (streamFlushTimer) {
              clearTimeout(streamFlushTimer);
              streamFlushTimer = null;
            }
            stageItem(item);
            streamingItemId = null;
            streamingText = "";
          } else {
            this.onItem(item);
          }
        };

        const scheduleStreamingFlush = (): void => {
          if (streamFlushTimer != null) {
            return;
          }
          streamFlushTimer = setTimeout(() => {
            streamFlushTimer = null;
            emitStreamingMessage(false);
          }, 32);
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          try {
            let newTurnInput: Array<ResponseInputItem> = [];

            // eslint-disable-next-line no-await-in-loop
            for await (const event of stream as AsyncIterable<ResponseEvent>) {
              // Real-time token stream → live assistant bubble
              if (event.type === "response.output_text.delta") {
                if (!streamingItemId) {
                  streamingItemId =
                    (event as { item_id?: string }).item_id ||
                    `msg_stream_${Date.now()}`;
                }
                streamingText += event.delta ?? "";
                scheduleStreamingFlush();
                continue;
              }

              if (event.type === "response.output_text.done") {
                if (!streamingItemId) {
                  streamingItemId =
                    (event as { item_id?: string }).item_id ||
                    `msg_stream_${Date.now()}`;
                }
                const doneText = (event as { text?: string }).text;
                if (typeof doneText === "string") {
                  streamingText = doneText;
                }
                // Keep status in_progress until output_item.done so Static
                // does not freeze a mid-render markdown frame.
                if (streamFlushTimer) {
                  clearTimeout(streamFlushTimer);
                  streamFlushTimer = null;
                }
                emitStreamingMessage(false);
                continue;
              }

              // process and surface each completed output item
              if (event.type === "response.output_item.done") {
                const item = event.item;
                // 1) if it's a reasoning item, annotate it
                type ReasoningItem = { type?: string; duration_ms?: number };
                const maybeReasoning = item as ReasoningItem;
                if (maybeReasoning.type === "reasoning") {
                  maybeReasoning.duration_ms = Date.now() - thinkingStart;
                }
                if (
                  item.type === "function_call" ||
                  item.type === "local_shell_call"
                ) {
                  // Track outstanding tool call so we can abort later if needed.
                  // The item comes from the streaming response, therefore it has
                  // either `id` (chat) or `call_id` (responses) – we normalise
                  // by reading both.
                  const callId =
                    (item as { call_id?: string; id?: string }).call_id ??
                    (item as { id?: string }).id;
                  if (callId) {
                    this.pendingAborts.add(callId);
                  }
                } else if (item.type === "message") {
                  // Prefer the final message body; mark completed for Static.
                  const content = (item as { content?: Array<{ text?: string }> })
                    .content;
                  const finalText =
                    Array.isArray(content) && content[0]?.text != null
                      ? content.map((c) => c.text ?? "").join("")
                      : streamingText;
                  if (!streamingItemId) {
                    streamingItemId =
                      (item as { id?: string }).id ||
                      `msg_stream_${Date.now()}`;
                  }
                  streamingText = finalText;
                  // Align id with the API item so stageItem dedupe works.
                  if ((item as { id?: string }).id) {
                    streamingItemId = (item as { id: string }).id;
                  }
                  emitStreamingMessage(true);
                } else {
                  stageItem(item as ResponseItem);
                }
              }

              if (event.type === "response.completed") {
                // Flush any leftover streamed text that never got output_item.done
                if (streamingItemId && streamingText.length > 0) {
                  emitStreamingMessage(true);
                } else if (streamFlushTimer) {
                  clearTimeout(streamFlushTimer);
                  streamFlushTimer = null;
                }
                const usage = (
                  event.response as {
                    usage?: {
                      input_tokens?: number;
                      output_tokens?: number;
                      total_tokens?: number;
                    };
                  }
                ).usage;
                if (usage) {
                  recordUsage({
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.total_tokens,
                  });
                }
                if (thisGeneration === this.generation && !this.canceled) {
                  for (const item of event.response.output) {
                    stageItem(item as ResponseItem);
                  }
                }
                if (
                  event.response.status === "completed" ||
                  (event.response.status as unknown as string) ===
                    "requires_action"
                ) {
                  // TODO: remove this once we can depend on streaming events
                  newTurnInput = await this.processEventsWithoutStreaming(
                    event.response.output,
                    stageItem,
                  );

                  // When we do not use server‑side storage we maintain our
                  // own transcript so that *future* turns still contain full
                  // conversational context. However, whether we advance to
                  // another loop iteration should depend solely on the
                  // presence of *new* input items (i.e. items that were not
                  // part of the previous request). Re‑sending the transcript
                  // by itself would create an infinite request loop because
                  // `turnInput.length` would never reach zero.

                  if (this.disableResponseStorage) {
                    // 1) Append the freshly emitted output to our local
                    //    transcript (minus non‑message items the model does
                    //    not need to see again).
                    const cleaned = filterToApiMessages(
                      event.response.output.map(stripInternalFields),
                    );
                    this.transcript.push(...cleaned);

                    // 2) Determine the *delta* (newTurnInput) that must be
                    //    sent in the next iteration. If there is none we can
                    //    safely terminate the loop – the transcript alone
                    //    does not constitute new information for the
                    //    assistant to act upon.

                    const delta = filterToApiMessages(
                      newTurnInput.map(stripInternalFields),
                    );

                    if (delta.length === 0) {
                      // No new input => end conversation.
                      newTurnInput = [];
                    } else {
                      // Re‑send full transcript *plus* the new delta so the
                      // stateless backend receives complete context.
                      newTurnInput = [...this.transcript, ...delta];
                      // The prefix ends at the current transcript length –
                      // everything after this index is new for the next
                      // iteration.
                      transcriptPrefixLen = this.transcript.length;
                    }
                  }
                }
                lastResponseId = event.response.id;
                this.onLastResponseId(event.response.id);
              }
            }

            // Set after we have consumed all stream events in case the stream wasn't
            // complete or we missed events for whatever reason. That way, we will set
            // the next turn to an empty array to prevent an infinite loop.
            // And don't update the turn input too early otherwise we won't have the
            // current turn inputs available for retries.
            turnInput = newTurnInput;

            // Stream finished successfully – leave the retry loop.
            break;
          } catch (err: unknown) {
            const isRateLimitError = (e: unknown): boolean => {
              if (!e || typeof e !== "object") {
                return false;
              }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ex: any = e;
              return (
                ex.status === 429 ||
                ex.code === "rate_limit_exceeded" ||
                ex.type === "rate_limit_exceeded"
              );
            };

            if (
              isRateLimitError(err) &&
              streamRetryAttempt < MAX_STREAM_RETRIES
            ) {
              streamRetryAttempt += 1;

              const waitMs =
                RATE_LIMIT_RETRY_WAIT_MS * 2 ** (streamRetryAttempt - 1);
              log(
                `Stream rate‑limited – retry ${streamRetryAttempt}/${MAX_STREAM_RETRIES} in ${waitMs} ms`,
              );

              // Give the server a breather before retrying.
              // eslint-disable-next-line no-await-in-loop
              await new Promise((res) => setTimeout(res, waitMs));

              // Re‑create the stream with the *same* parameters.
              let reasoning: Reasoning | undefined;
              if (
                this.model.startsWith("o") ||
                this.model.startsWith("gpt-5")
              ) {
                reasoning = { effort: "high" };
                if (
                  this.model === "o3" ||
                  this.model === "o4-mini" ||
                  this.model === "codex-mini-latest" ||
                  this.model.startsWith("gpt-5")
                ) {
                  reasoning.summary = "auto";
                }
              }

              const prefix = buildPrefix(this.model, this.provider);
              const mergedInstructions = [prefix, this.instructions]
                .filter((s) => typeof s === "string" && s.trim() !== "")
                .join("\n\n");

              const responseCall =
                !this.config.provider ||
                this.config.provider?.toLowerCase() === "codexcli" ||
                this.config.provider?.toLowerCase() === "azure"
                  ? (params: ResponseCreateParams) =>
                      this.llmClient.responses.create(params)
                  : (params: ResponseCreateParams) =>
                      responsesCreateViaChatCompletions(
                        this.llmClient,
                        params as ResponseCreateParams & { stream: true },
                      );

              log(
                "agentLoop.run(): responseCall(1): turnInput: " +
                  JSON.stringify(turnInput),
              );
              // eslint-disable-next-line no-await-in-loop
              stream = await responseCall({
                model: this.model,
                instructions: mergedInstructions,
                input: turnInput as any,
                stream: true,
                parallel_tool_calls: true,
                reasoning: reasoning as any,
                ...(this.config.flexMode ? { service_tier: "flex" } : {}),
                ...(this.disableResponseStorage
                  ? { store: false }
                  : {
                      store: true,
                      previous_response_id: lastResponseId || undefined,
                    }),
                tools: tools as any,
                tool_choice: "auto",
              });

              this.currentStream = stream;
              // Continue to outer while to consume new stream.
              continue;
            }

            // Gracefully handle an abort triggered via `cancel()` so that the
            // consumer does not see an unhandled exception.
            if (err instanceof Error && err.name === "AbortError") {
              if (!this.canceled) {
                // It was aborted for some other reason; surface the error.
                throw err;
              }
              this.onLoading(false);
              return;
            }
            // Suppress internal stack on JSON parse failures
            if (err instanceof SyntaxError) {
              this.onItem({
                id: `error-${Date.now()}`,
                type: "message",
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: "⚠️ Failed to parse streaming response (invalid JSON). Please `/clear` to reset.",
                  },
                ],
              });
              this.onLoading(false);
              return;
            }
            // Handle CodexCLI API quota errors
            if (
              err instanceof Error &&
              (err as { code?: string }).code === "insufficient_quota"
            ) {
              this.onItem({
                id: `error-${Date.now()}`,
                type: "message",
                role: "system",
                content: [
                  {
                    type: "input_text",
                    text: `⚠️  Insufficient quota: ${err instanceof Error && err.message ? err.message.trim() : "No remaining quota."} Please verify your account balance and limits.`,
                  },
                ],
              });
              this.onLoading(false);
              return;
            }
            throw err;
          } finally {
            this.currentStream = null;
          }
        } // end while retry loop

        log(
          `Turn inputs (${turnInput.length}) - ${turnInput
            .map((i) => i.type)
            .join(", ")}`,
        );
      }

      // Flush staged items if the run concluded successfully (i.e. the user did
      // not invoke cancel() or terminate() during the turn).
      const flush = () => {
        if (
          !this.canceled &&
          !this.hardAbort.signal.aborted &&
          thisGeneration === this.generation
        ) {
          // Only emit items that weren't already delivered above
          for (const item of staged) {
            if (item) {
              this.onItem(item);
            }
          }
        }

        // At this point the turn finished without the user invoking
        // `cancel()`.  Any outstanding function‑calls must therefore have been
        // satisfied, so we can safely clear the set that tracks pending aborts
        // to avoid emitting duplicate synthetic outputs in subsequent runs.
        this.pendingAborts.clear();
        // Now emit system messages recording the per‑turn *and* cumulative
        // thinking times so UIs and tests can surface/verify them.
        // const thinkingEnd = Date.now();

        // 1) Per‑turn measurement – exact time spent between request and
        //    response for *this* command.
        // this.onItem({
        //   id: `thinking-${thinkingEnd}`,
        //   type: "message",
        //   role: "system",
        //   content: [
        //     {
        //       type: "input_text",
        //       text: `🤔  Thinking time: ${Math.round(
        //         (thinkingEnd - thinkingStart) / 1000
        //       )} s`,
        //     },
        //   ],
        // });

        // 2) Session‑wide cumulative counter so users can track overall wait
        //    time across multiple turns.
        // this.cumulativeThinkingMs += thinkingEnd - thinkingStart;
        // this.onItem({
        //   id: `thinking-total-${thinkingEnd}`,
        //   type: "message",
        //   role: "system",
        //   content: [
        //     {
        //       type: "input_text",
        //       text: `⏱  Total thinking time: ${Math.round(
        //         this.cumulativeThinkingMs / 1000
        //       )} s`,
        //     },
        //   ],
        // });

        this.onLoading(false);
      };

      // Use a small delay to make sure UI rendering is smooth. Double-check
      // cancellation state right before flushing to avoid race conditions.
      setTimeout(() => {
        if (
          !this.canceled &&
          !this.hardAbort.signal.aborted &&
          thisGeneration === this.generation
        ) {
          flush();
        }
      }, 3);

      // End of main logic. The corresponding catch block for the wrapper at the
      // start of this method follows next.
    } catch (err) {
      // Handle known transient network/streaming issues so they do not crash the
      // CLI. We currently match Node/undici's `ERR_STREAM_PREMATURE_CLOSE`
      // error which manifests when the HTTP/2 stream terminates unexpectedly
      // (e.g. during brief network hiccups).

      const isPrematureClose =
        err instanceof Error &&
        // eslint-disable-next-line
        ((err as any).code === "ERR_STREAM_PREMATURE_CLOSE" ||
          err.message?.includes("Premature close"));

      if (isPrematureClose) {
        try {
          this.onItem({
            id: `error-${Date.now()}`,
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: "⚠️  Connection closed prematurely while waiting for the model. Please try again.",
              },
            ],
          });
        } catch {
          /* no-op – emitting the error message is best‑effort */
        }
        this.onLoading(false);
        return;
      }

      // -------------------------------------------------------------------
      // Catch‑all handling for other network or server‑side issues so that
      // transient failures do not crash the CLI. We intentionally keep the
      // detection logic conservative to avoid masking programming errors. A
      // failure is treated as retry‑worthy/user‑visible when any of the
      // following apply:
      //   • the error carries a recognised Node.js network errno ‑ style code
      //     (e.g. ECONNRESET, ETIMEDOUT …)
      //   • the CodexCLI SDK attached an HTTP `status` >= 500 indicating a
      //     server‑side problem.
      //   • the error is model specific and detected in stream.
      // If matched we emit a single system message to inform the user and
      // resolve gracefully so callers can choose to retry.
      // -------------------------------------------------------------------

      const NETWORK_ERRNOS = new Set([
        "ECONNRESET",
        "ECONNREFUSED",
        "EPIPE",
        "ENOTFOUND",
        "ETIMEDOUT",
        "EAI_AGAIN",
      ]);

      const isNetworkOrServerError = (() => {
        if (!err || typeof err !== "object") {
          return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e: any = err;

        // Direct instance check for connection errors thrown by the CodexCLI SDK.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ApiConnErrCtor = (OpenAI as any).APIConnectionError as  // eslint-disable-next-line @typescript-eslint/no-explicit-any
          | (new (...args: any) => Error)
          | undefined;
        if (ApiConnErrCtor && e instanceof ApiConnErrCtor) {
          return true;
        }

        if (typeof e.code === "string" && NETWORK_ERRNOS.has(e.code)) {
          return true;
        }

        // When the CodexCLI SDK nests the underlying network failure inside the
        // `cause` property we surface it as well so callers do not see an
        // unhandled exception for errors like ENOTFOUND, ECONNRESET …
        if (
          e.cause &&
          typeof e.cause === "object" &&
          NETWORK_ERRNOS.has((e.cause as { code?: string }).code ?? "")
        ) {
          return true;
        }

        if (typeof e.status === "number" && e.status >= 500) {
          return true;
        }

        // Fallback to a heuristic string match so we still catch future SDK
        // variations without enumerating every errno.
        if (
          typeof e.message === "string" &&
          /network|socket|stream/i.test(e.message)
        ) {
          return true;
        }

        return false;
      })();

      if (isNetworkOrServerError) {
        try {
          const msgText =
            "⚠️  Network error while contacting the LLM provider. Please check your connection and try again.";
          this.onItem({
            id: `error-${Date.now()}`,
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: msgText,
              },
            ],
          });
        } catch {
          /* best‑effort */
        }
        this.onLoading(false);
        return;
      }

      const isInvalidRequestError = () => {
        if (!err || typeof err !== "object") {
          return false;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const e: any = err;

        if (
          e.type === "invalid_request_error" &&
          e.code === "model_not_found"
        ) {
          return true;
        }

        if (
          e.cause &&
          e.cause.type === "invalid_request_error" &&
          e.cause.code === "model_not_found"
        ) {
          return true;
        }

        return false;
      };

      if (isInvalidRequestError()) {
        try {
          // Extract request ID and error details from the error object

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e: any = err;

          const reqId =
            e.request_id ??
            (e.cause && e.cause.request_id) ??
            (e.cause && e.cause.requestId);

          const errorDetails = [
            `Status: ${e.status || (e.cause && e.cause.status) || "unknown"}`,
            `Code: ${e.code || (e.cause && e.cause.code) || "unknown"}`,
            `Type: ${e.type || (e.cause && e.cause.type) || "unknown"}`,
            `Message: ${
              e.message || (e.cause && e.cause.message) || "unknown"
            }`,
          ].join(", ");

          const msgText = `⚠️  The LLM provider rejected the request${
            reqId ? ` (request ID: ${reqId})` : ""
          }. Error details: ${errorDetails}. Please verify your settings and try again.`;

          this.onItem({
            id: `error-${Date.now()}`,
            type: "message",
            role: "system",
            content: [
              {
                type: "input_text",
                text: msgText,
              },
            ],
          });
        } catch {
          /* best-effort */
        }
        this.onLoading(false);
        return;
      }

      // Re‑throw all other errors so upstream handlers can decide what to do.
      throw err;
    } finally {
      this.running = false;
    }
  }

  // we need until we can depend on streaming events
  private async processEventsWithoutStreaming(
    output: Array<ResponseInputItem>,
    emitItem: (item: ResponseItem) => void,
  ): Promise<Array<ResponseInputItem>> {
    // If the agent has been canceled we should short‑circuit immediately to
    // avoid any further processing (including potentially expensive tool
    // calls). Returning an empty array ensures the main run‑loop terminates
    // promptly.
    if (this.canceled) {
      return [];
    }
    const turnInput: Array<ResponseInputItem> = [];

    // First pass: collect tool calls so read-only ones can run in parallel.
    type PendingTool = {
      kind: "function_call" | "local_shell_call";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      item: any;
      readonly: boolean;
    };
    const pendingTools: Array<PendingTool> = [];

    const isReadonlyTool = (name: string | undefined): boolean => {
      if (!name) {
        return false;
      }
      const tool = this.toolRegistry.getTool(name);
      return Boolean(tool && !tool.requiresApproval);
    };

    for (const item of output) {
      if (item.type === "function_call") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fc = item as any;
        pendingTools.push({
          kind: "function_call",
          item: fc,
          readonly: isReadonlyTool(fc.name),
        });
      } else if (item.type === "local_shell_call") {
        pendingTools.push({
          kind: "local_shell_call",
          item,
          readonly: false,
        });
      } else if (item.type === "message" && (item as { content?: unknown }).content) {
        // Fall through to existing nested handling below after tools
      }
    }

    // Execute read-only tools concurrently, then mutating / shell serially.
    const readonlyTools = pendingTools.filter((t) => t.readonly);
    const mutatingTools = pendingTools.filter((t) => !t.readonly);

    if (readonlyTools.length > 0) {
      const results = await Promise.all(
        readonlyTools.map(async (t) => {
          if (this.canceled) {
            return [] as Array<ResponseInputItem>;
          }
          return this.handleFunctionCall(t.item);
        }),
      );
      for (const result of results) {
        turnInput.push(...result);
      }
    }

    for (const t of mutatingTools) {
      if (this.canceled) {
        break;
      }
      if (t.kind === "function_call") {
        // eslint-disable-next-line no-await-in-loop
        const result = await this.handleFunctionCall(t.item);
        turnInput.push(...result);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const result = await this.handleLocalShellCall(t.item);
        turnInput.push(...result);
      }
    }

    // Second pass: nested tool calls / heuristic JSON in message text
    for (const item of output) {
      if (
        item.type === "function_call" ||
        item.type === "local_shell_call"
      ) {
        continue;
      }
      if (item.type === "message" && (item as { content?: unknown }).content) {
        const content = (item as { content: unknown }).content;
        if (Array.isArray(content)) {
          for (const part of content) {
            if (part.type === "function_call") {
              // eslint-disable-next-line no-await-in-loop
              const result = await this.handleFunctionCall(part as never);
              turnInput.push(...result);
            } else if (part.type === "local_shell_call") {
              // eslint-disable-next-line no-await-in-loop
              const result = await this.handleLocalShellCall(part);
              turnInput.push(...result);
            } else if (
              part.type === "output_text" &&
              typeof part.text === "string"
            ) {
              // Heuristic: Check for JSON tool calls embedded in text (common with local models)
              // We support both raw JSON and JSON wrapped in markdown code blocks.
              let textToParse = part.text;

              // Simple markdown stripper
              const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/g;
              const matches = [...textToParse.matchAll(codeBlockRegex)];
              if (matches.length > 0) {
                // If we found code blocks, only parse the content inside them
                textToParse = matches.map((m) => m[1]).join("\n");
              }

              const marker = '"name":';
              let searchIndex = 0;

              // eslint-disable-next-line no-constant-condition
              while (true) {
                const nameIndex = textToParse.indexOf(marker, searchIndex);
                if (nameIndex === -1) {
                  break;
                }

                // Look for the opening brace before "name"
                const openBraceIndex = textToParse.lastIndexOf("{", nameIndex);
                if (openBraceIndex === -1) {
                  searchIndex = nameIndex + marker.length;
                  continue;
                }

                // Count balanced braces to find the end
                let braceCount = 0;
                let foundEnd = false;
                let jsonStr = null;

                for (let i = openBraceIndex; i < textToParse.length; i++) {
                  if (textToParse[i] === "{") {
                    braceCount++;
                  } else if (textToParse[i] === "}") {
                    braceCount--;
                  }

                  if (braceCount === 0) {
                    // Found matching closing brace
                    jsonStr = textToParse.substring(openBraceIndex, i + 1);
                    searchIndex = i + 1;
                    foundEnd = true;
                    break;
                  }
                }

                if (foundEnd && jsonStr) {
                  try {
                    // Sanitize control characters that might break JSON.parse
                    // eslint-disable-next-line no-control-regex
                    const sanitizedJsonStr = jsonStr.replace(
                      /[\x00-\x1F\x7F]/g,
                      "",
                    );
                    const json = JSON.parse(sanitizedJsonStr);
                    // Validate it looks like a tool call
                    if (json.name && json.arguments) {
                      const callId = `synthetic-${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2)}`;
                      const syntheticCall = {
                        type: "function_call",
                        call_id: callId,
                        name: json.name,
                        arguments:
                          typeof json.arguments === "string"
                            ? json.arguments
                            : JSON.stringify(json.arguments),
                      };

                      const result = await this.handleFunctionCall(
                        syntheticCall as any,
                      );
                      turnInput.push(...result);
                    }
                  } catch {
                    // Parse error, ignore
                  }
                } else {
                  // No matching brace found or invalid, move past this "name": occurrence
                  searchIndex = nameIndex + marker.length;
                }
              }
            }
          }
        }
      }
      emitItem(item as ResponseItem);
    }
    return turnInput;
  }
}

/** Core agent prompt + live environment for the current model. */
function buildPrefix(model: string, provider: string): string {
  return buildSystemPrompt({ model, provider });
}

function filterToApiMessages(
  items: Array<ResponseInputItem>,
): Array<ResponseInputItem> {
  return items.filter((it) => {
    if (it.type === "message" && it.role === "system") {
      return false;
    }
    if (it.type === "reasoning") {
      return false;
    }
    return true;
  });
}
