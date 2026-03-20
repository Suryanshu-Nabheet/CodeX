import { WorkspaceConfiguration, workspace } from 'vscode';

let instance: Config | null = null;

export default class Config {
  /** Whether to append comments at the end of tree lines. */
  withComment: boolean = false;
  /** Distance between line end and comment. */
  commentDistance: number = 5;
  /** Visual theme for the tree. */
  theme: string = 'perfect';
  /** Whether to load rules from .gitignore. */
  loadIgnore: boolean = true;
  /** Custom folder ignore list. */
  ignoreFolders: string[] = [];
  /** Target file to append project tree into. */
  distFileName: string = 'README.md';

  constructor() {
    if (instance) {
      return instance;
    }
    this.refresh();
    instance = this;
  }

  refresh() {
    const config = workspace.getConfiguration('CodexProjectTree');
    this.withComment = !!config.get('withComment');
    this.commentDistance = config.get<number>('commentDistance') || 5;
    this.theme = config.get<string>('theme') || 'perfect';
    this.loadIgnore = !!config.get('loadIgnore');
    this.ignoreFolders = config.get<string[]>('ignoreFolders') || [];
    this.distFileName = config.get<string>('distFileName') || 'README.md';
  }
}
