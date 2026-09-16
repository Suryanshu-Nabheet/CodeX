import fs from "fs";
import path from "path";

export class ProjectRoot {
  private static instance: ProjectRoot;
  private root: string;

  private constructor(root: string) {
    const lexicalRoot = path.resolve(root);
    if (!fs.existsSync(lexicalRoot) || !fs.statSync(lexicalRoot).isDirectory()) {
      throw new Error(
        `Project root does not exist or is not a directory: ${lexicalRoot}`,
      );
    }
    this.root = fs.realpathSync.native(lexicalRoot);
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
    const relative = path.relative(this.root, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error(
        `Path traversal detected: ${resolvedPath} is outside of project root ${this.root}`,
      );
    }
    const existingAncestor = this.findExistingAncestor(resolvedPath);
    const realAncestor = fs.realpathSync.native(existingAncestor);
    const ancestorRelative = path.relative(this.root, realAncestor);
    if (ancestorRelative.startsWith("..") || path.isAbsolute(ancestorRelative)) {
      throw new Error(
        `Path traversal detected through a symbolic link: ${resolvedPath}`,
      );
    }
    return resolvedPath;
  }

  private findExistingAncestor(target: string): string {
    let candidate = target;
    while (!fs.existsSync(candidate)) {
      const parent = path.dirname(candidate);
      if (parent === candidate) return candidate;
      candidate = parent;
    }
    return candidate;
  }

  public relative(to: string): string {
    return path.relative(this.root, to);
  }

  public isInside(targetPath: string): boolean {
    const resolvedPath = path.resolve(targetPath);
    const relative = path.relative(this.root, resolvedPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return false;
    try {
      const realPath = fs.realpathSync.native(resolvedPath);
      const realRelative = path.relative(this.root, realPath);
      return !realRelative.startsWith("..") && !path.isAbsolute(realRelative);
    } catch {
      return true;
    }
  }
}
