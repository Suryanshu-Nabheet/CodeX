import * as vscode from 'vscode';
import Entry from './index';
import Config from './config';

export function activate(context: vscode.ExtensionContext) {
  const config = new Config();
  const entry = new Entry();

  vscode.workspace.onDidChangeConfiguration(() => config.refresh());

  const disposable = vscode.commands.registerCommand(
    'codex-project-tree.generate',
    async () => {
      try {
        await entry.action();
      } catch (err: any) {
        vscode.window.showErrorMessage(`Codex Project Tree Error: ${err.message}`);
      }
    }
  );

  context.subscriptions.push(disposable);
  console.log('Codex Project Tree by Suryanshu Nabheet is now active.');
}

// This method is called when your extension is deactivated
export function deactivate() {}
