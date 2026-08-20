import { process_patch } from "./apply-patch.js";
import { ProjectRoot } from "../utils/project-root.js";
import fs from "fs";

export class PatchApplier {
  private root: ProjectRoot;

  constructor() {
    this.root = ProjectRoot.getInstance();
  }

  async applyUnifiedDiff(_filePath: string, diffText: string): Promise<void> {
    // Use the custom process_patch which handles the project's specific V4A format
    try {
      process_patch(
        diffText,
        (p) => fs.readFileSync(this.root.resolve(p), "utf8"),
        (p, c) => fs.writeFileSync(this.root.resolve(p), c, "utf8"),
        (p) => fs.unlinkSync(this.root.resolve(p)),
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to apply patch: ${message}`);
    }
  }

  validatePatch(_filePath: string, diffText: string): boolean {
    // Basic validation for V4A format
    return (
      diffText.includes("*** Begin Patch") &&
      diffText.includes("*** End Patch") &&
      diffText.includes("File:")
    );
  }
}
