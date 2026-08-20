import { FilesystemController } from "../fs/filesystem-controller.js";

export interface ContextChunk {
  file: string;
  content: string;
}

export class ContextEngine {
  private fs: FilesystemController;

  constructor() {
    this.fs = new FilesystemController();
  }

  async buildRepoTree(): Promise<string> {
    const files = await this.fs.listFilesRecursive(".");
    return this.formatTree(files);
  }

  private formatTree(files: Array<string>): string {
    const tree: any = {};
    files.forEach((file) => {
      const parts = file.split(path.sep);
      let current = tree;
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = index === parts.length - 1 ? null : {};
        }
        current = current[part];
      });
    });

    const render = (obj: any, indent: string = ""): string => {
      let result = "";
      const keys = Object.keys(obj).sort();
      keys.forEach((key, index) => {
        const isLast = index === keys.length - 1;
        const prefix = isLast ? "└── " : "├── ";
        result += `${indent}${prefix}${key}${obj[key] === null ? "" : "/"}\n`;
        if (obj[key] !== null) {
          result += render(obj[key], indent + (isLast ? "    " : "│   "));
        }
      });
      return result;
    };

    return render(tree);
  }

  async getFileContext(files: Array<string>): Promise<Array<ContextChunk>> {
    const chunks: Array<ContextChunk> = [];
    for (const file of files) {
      if (this.fs.exists(file) && !this.fs.isDirectory(file)) {
        const content = await this.fs.readFile(file);
        chunks.push({ file, content });
      }
    }
    return chunks;
  }
}

import path from "path";
