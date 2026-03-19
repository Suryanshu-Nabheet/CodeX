import * as vscode from "vscode";

/**
 * Commands to be registered by the extension.
 * The 'id' matches the command identifier in package.json.
 * The 'target' is the actual VS Code command to execute.
 */
const COMMAND_MAPPING = [
    { id: "codex-sync.git.pull", target: "git.pull" },
    { id: "codex-sync.git.push", target: "git.push" }
];

export function activate(context: vscode.ExtensionContext) {
    console.log("CodeX Sync extension is now active.");

    for (const mapping of COMMAND_MAPPING) {
        const disposable = vscode.commands.registerCommand(mapping.id, async () => {
            try {
                await vscode.commands.executeCommand(mapping.target);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to execute ${mapping.target}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
        context.subscriptions.push(disposable);
    }
}

export function deactivate() {
    // Clean up resources if necessary
}
