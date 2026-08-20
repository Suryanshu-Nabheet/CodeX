import { Agent } from "./agent/agent.js";
import { buildSystemPrompt } from "./agent/system-prompt.js";
import { loadConfig } from "./config/config.js";
import { ProviderFactory } from "./providers/factory.js";
import { ProjectRoot } from "./utils/project-root.js";

export async function main(prompt?: string) {
  const rootDir = process.cwd();
  ProjectRoot.initialize(rootDir);

  const config = loadConfig(undefined, undefined, { cwd: rootDir });

  const provider = ProviderFactory.create(
    config.provider || "codexcli-compatible",
    {
      apiKey: config.apiKey,
      model: config.model,
    },
  );

  const agent = new Agent({
    provider,
    instructions: [buildSystemPrompt(), config.instructions]
      .filter((s) => s && s.trim() !== "")
      .join("\n\n"),
    onMessage: (msg) => {
      console.log(`\nAssistant: ${msg}\n`);
    },
    onToolApproval: async (name, args) => {
      console.log(
        `\nAction required: ${name} with arguments ${JSON.stringify(args)}`,
      );
      return true;
    },
    onToolOutput: (name, _output) => {
      console.log(`Tool ${name} returned output.`);
    },
  });

  if (prompt) {
    await agent.run(prompt);
  } else {
    // Start interactive mode
    console.log('Welcome to CodexCLI. Type your request or "exit" to quit.');
    // TODO: Implement interactive shell if no prompt
  }
}
