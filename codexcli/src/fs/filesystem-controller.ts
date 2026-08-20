import { ProjectRoot } from "../utils/project-root.js";
import { existsSync, statSync } from "fs";
import fs from "fs/promises";
import path from "path";

export class FilesystemController {
  private root: ProjectRoot;

  constructor() {
    this.root = ProjectRoot.getInstance();
  }

  async readFile(filePath: string): Promise<string> {
    const absolutePath = this.root.resolve(filePath);
    try {
      return await fs.readFile(absolutePath, "utf-8");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read file ${filePath}: ${errorMessage}`);
    }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const absolutePath = this.root.resolve(filePath);
    try {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, content, "utf-8");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to write file ${filePath}: ${errorMessage}`);
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const absolutePath = this.root.resolve(filePath);
    try {
      await fs.unlink(absolutePath);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete file ${filePath}: ${errorMessage}`);
    }
  }

  async listFiles(dirPath: string = "."): Promise<Array<string>> {
    const absolutePath = this.root.resolve(dirPath);
    try {
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      return entries.map((entry) => {
        const relativePath = path.join(dirPath, entry.name);
        return entry.isDirectory() ? `${relativePath}/` : relativePath;
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list directory ${dirPath}: ${errorMessage}`);
    }
  }

  async listFilesRecursive(
    dirPath: string = ".",
    ignore: Array<string> = ["node_modules", ".git", "dist"],
  ): Promise<Array<string>> {
    const result: Array<string> = [];
    const absolutePath = this.root.resolve(dirPath);

    async function traverse(currentPath: string) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        if (ignore.includes(entry.name)) {continue;}

        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else {
          result.push(
            path.relative(ProjectRoot.getInstance().getRoot(), fullPath),
          );
        }
      }
    }

    await traverse(absolutePath);
    return result;
  }

  async createDirectory(dirPath: string): Promise<void> {
    const absolutePath = this.root.resolve(dirPath);
    try {
      await fs.mkdir(absolutePath, { recursive: true });
    } catch (error: any) {
      throw new Error(
        `Failed to create directory ${dirPath}: ${error.message}`,
      );
    }
  }

  async deleteDirectory(dirPath: string): Promise<void> {
    const absolutePath = this.root.resolve(dirPath);
    try {
      await fs.rm(absolutePath, { recursive: true, force: true });
    } catch (error: any) {
      throw new Error(
        `Failed to delete directory ${dirPath}: ${error.message}`,
      );
    }
  }

  exists(filePath: string): boolean {
    try {
      const absolutePath = this.root.resolve(filePath);
      return existsSync(absolutePath);
    } catch {
      return false;
    }
  }

  isDirectory(filePath: string): boolean {
    try {
      const absolutePath = this.root.resolve(filePath);
      return statSync(absolutePath).isDirectory();
    } catch {
      return false;
    }
  }

  async moveFile(oldPath: string, newPath: string): Promise<void> {
    const oldAbsPath = this.root.resolve(oldPath);
    const newAbsPath = this.root.resolve(newPath);
    try {
      await fs.mkdir(path.dirname(newAbsPath), { recursive: true });
      await fs.rename(oldAbsPath, newAbsPath);
    } catch (error: any) {
      throw new Error(
        `Failed to move ${oldPath} to ${newPath}: ${error.message}`,
      );
    }
  }

  async searchFiles(pattern: string, dirPath: string = "."): Promise<Array<string>> {
    const allFiles = await this.listFilesRecursive(dirPath);
    const regex = new RegExp(pattern.replace(/\*/g, ".*"), "i");
    return allFiles.filter((file) => regex.test(file));
  }

  async searchFileContents(
    pattern: string,
    dirPath: string = ".",
  ): Promise<Array<{ path: string; line: number; content: string }>> {
    const allFiles = await this.listFilesRecursive(dirPath);
    const results: Array<{ path: string; line: number; content: string }> = [];
    const regex = new RegExp(pattern, "i");

    for (const file of allFiles) {
      try {
        const content = await this.readFile(file);
        const lines = content.split("\n");
        lines.forEach((line, index) => {
          if (regex.test(line)) {
            results.push({
              path: file,
              line: index + 1,
              content: line.trim(),
            });
          }
        });
      } catch {
        // Skip files that can't be read (binary, etc.)
      }
    }
    return results;
  }
}
