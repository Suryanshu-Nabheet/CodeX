import { ProjectRoot } from "../utils/project-root.js";
import { spawn } from "child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class CommandExecutor {
  private root: ProjectRoot;

  constructor() {
    this.root = ProjectRoot.getInstance();
  }

  async execute(
    command: string,
    args: Array<string> = [],
    onStdout?: (data: string) => void,
  ): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: this.root.getRoot(),
        shell: true,
        env: { ...process.env, PAGER: "cat" },
      });

      let stdout = "";
      let stderr = "";

      child.stdout.on("data", (data) => {
        const str = data.toString();
        stdout += str;
        if (onStdout) {
          onStdout(str);
        }
      });

      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });

      child.on("error", (err) => {
        reject(err);
      });
    });
  }
}
