export interface LevInfo {
  level: number; // Depth level
  ancestor: string; // Parent directory path
  pathName: string; // Current file/folder name
  lasStatus: number[]; // Array tracking if a node and its ancestors are the last ones in their respective lists (1 for last).
}

export class File {
  private ancestor!: string;
  private pathName!: string;
  private level!: number;

  constructor(ancestor: string, pathName: string, level: number) {
    this.ancestor = ancestor;
    this.pathName = pathName;
    this.level = level;
  }

  getAncestor() {
    return this.ancestor;
  }

  getPathName() {
    return this.pathName;
  }

  getLevel() {
    return this.level;
  }
}

export class Folder {
  private ancestor: string;
  private pathName: string;
  private level: number;
  private children: (Folder | File)[];

  constructor(
    ancestor: string = '',
    pathName: string = '',
    level: number = 0,
    children: (Folder | File)[] = []
  ) {
    this.ancestor = ancestor;
    this.pathName = pathName;
    this.level = level;
    this.children = children;
  }

  getAncestor() {
    return this.ancestor;
  }

  getPathName() {
    return this.pathName;
  }
  getLevel() {
    return this.level;
  }

  getChildren() {
    return this.children;
  }

  addChild(child: Folder | File) {
    this.children.push(child);
  }
}
