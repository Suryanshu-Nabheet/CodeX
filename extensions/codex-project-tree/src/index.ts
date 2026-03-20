import { WorkspaceFolder, workspace, window } from 'vscode';
import { traverse, traverseFolder } from './traverse';
import { resolve } from 'path';
import { appendFileSync } from 'fs';
import { LevInfo, Folder } from './type';
import theme from './theme';
import Config from './config';

export default class {
  private folder!: string;
  private name!: string;
  private rootFolder!: Folder;
  private levInfos!: LevInfo[];
  private lines!: string[];
  private context!: string;
  private config!: Config;

  constructor() {
    this.config = new Config();
  }

  async init(): Promise<void> {
    const { workspaceFolders } = workspace;
    let selectFolder!: WorkspaceFolder;
    if (!workspaceFolders) {
      window.showInformationMessage('Please open the folder and try again.');
      return;
    }
    if (workspaceFolders.length === 1) {
      selectFolder = workspaceFolders[0];
    } else {
      let name!: string;
      try {
        name = await this.pickFolder(workspaceFolders);
      } catch (e) {
        window.showInformationMessage('Please open the folder and try again.');
      }
      selectFolder =
        workspaceFolders.find((item: WorkspaceFolder) => item.name === name) ||
        workspaceFolders[0];
    }
    this.name = selectFolder.name;
    this.folder = selectFolder.uri.fsPath.replace(this.name, '');
    this.rootFolder = traverseFolder(this.folder, this.name) || new Folder();
  }

  initLines(): void {
    this.levInfos = traverse(this.rootFolder) || [];
    const themFunc: any = {
      normal: theme.normal,
      perfect: theme.perfect,
    };
    const { maxLen, lines } = (themFunc[this.config.theme] || theme.perfect)(
      this.levInfos
    );
    this.lines = lines;
    this.initContext(maxLen);
  }

  initContext(maxLen: number): void {
    this.context = '\r\n```\r\n';
    this.lines.forEach((item: string) => {
      if (this.config.withComment) {
        this.context += `${item}${new Array(
          maxLen - item.length + 1 + this.config.commentDistance
        ).join(' ')}//\r\n`;
      } else {
        this.context += `${item}\r\n`;
      }
    });
    this.context += '\r\n```';
  }

  /**
   * Prompts the user to pick a folder from the multi-root workspace.
   * @param workspaceFolders List of available workspace folders.
   */
  pickFolder(workspaceFolders: readonly WorkspaceFolder[]): Promise<string> {
    const folders = workspaceFolders.map((item: WorkspaceFolder) => item.name);
    return new Promise((res, rej) => {
      window
        .showQuickPick(folders, {
          placeHolder: 'Select a workspace folder for the project tree generation',
          ignoreFocusOut: true,
        })
        .then((folderName: string | undefined) => {
          if (folderName) {
            return res(folderName);
          }
          return rej();
        });
    });
  }

  async action(): Promise<void> {
    await this.init();
    if (!this.rootFolder) {
      return;
    }
    this.initLines();
    try {
      appendFileSync(
        resolve(resolve(this.folder, this.name), this.config.distFileName),
        this.context
      );
      window.showInformationMessage(`Project tree successfully appended to ${this.config.distFileName}!`);
    } catch (err: any) {
      window.showErrorMessage(`Failed to write to file: ${err.message}`);
    }
  }
}
