import fs from "fs";
import path from "path";

export class ProjectRoot {
  private static instance: ProjectRoot;
  private root: string;

  private constructor(root: string) {
    this.root = path.resolve(root);
    if (!fs.existsSync(this.root) || !fs.statSync(this.root).isDirectory()) {
      throw new Error(
        `Project root does not exist or is not a directory: ${this.root}`,
      );
    }
  }

  public static initialize(root: string): ProjectRoot {
    this.instance = new ProjectRoot(root);
    return this.instance;
  }

  public static getInstance(): ProjectRoot {
    if (!this.instance) {
      throw new Error(
        "ProjectRoot not initialized. Call initialize(root) first.",
      );
    }
    return this.instance;
  }

  public getRoot(): string {
    return this.root;
  }

  public resolve(...paths: Array<string>): string {
    const resolvedPath = path.resolve(this.root, ...paths);
    if (!resolvedPath.startsWith(this.root)) {
      throw new Error(
        `Path traversal detected: ${resolvedPath} is outside of project root ${this.root}`,
      );
    }
    return resolvedPath;
  }

  public relative(to: string): string {
    return path.relative(this.root, to);
  }

  public isInside(targetPath: string): boolean {
    const resolvedPath = path.resolve(targetPath);
    return resolvedPath.startsWith(this.root);
  }
}
