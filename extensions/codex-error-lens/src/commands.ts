import { codeLensOnClickCommand } from './commands/codeLensOnClickCommand';
import { copyProblemCodeCommand } from './commands/copyProblemCodeCommand';
import { copyProblemMessageCommand } from './commands/copyProblemMessageCommand';
import { disableLineCommand } from './commands/disableLineCommand';
import { excludeProblemCommand } from './commands/excludeProblemCommand';
import { findLinterRuleDefinitionCommand } from './commands/findLinterRuleDefinitionCommand';
import { revealLineCommand } from './commands/revealLineCommand';
import { searchForProblemCommand } from './commands/searchForProblemCommand';
import { selectProblemCommand } from './commands/selectProblemCommand';
import { statusBarCommand } from './commands/statusBarCommand';
import { toggleEnabledLevels } from './commands/toggleEnabledLevels';
import { toggleWorkspaceCommand } from './commands/toggleWorkspaceCommand';
import { updateEverythingCommand } from './commands/updateEverythingCommand';
import { $config } from './extension';
import { vscodeUtils } from './utils/vscodeUtils';
import { commands, type ExtensionContext } from 'vscode';

/**
 * All command ids contributed by this extensions.
 */
export const enum CommandId {
	// ──── User facing ───────────────────────────────────────────
	Toggle = 'codexErrorLens.toggle',
	ToggleError = 'codexErrorLens.toggleError',
	ToggleWarning = 'codexErrorLens.toggleWarning',
	ToggleInfo = 'codexErrorLens.toggleInfo',
	ToggleHint = 'codexErrorLens.toggleHint',
	ToggleInlineMessage = 'codexErrorLens.toggleInlineMessage',
	/** {@link toggleWorkspaceCommand} */
	ToggleWorkspace = 'codexErrorLens.toggleWorkspace',
	/** {@link copyProblemMessageCommand} */
	CopyProblemMessage = 'codexErrorLens.copyProblemMessage',
	/** {@link copyProblemCodeCommand} */
	CopyProblemCode = 'codexErrorLens.copyProblemCode',
	/** {@link selectProblemCommand} */
	SelectProblem = 'codexErrorLens.selectProblem',
	/** {@link findLinterRuleDefinitionCommand} */
	FindLinterRuleDefinition = 'codexErrorLens.findLinterRuleDefinition',
	/** {@link searchForProblemCommand} */
	SearchForProblem = 'codexErrorLens.searchForProblem',
	/** {@link disableLineCommand} */
	DisableLine = 'codexErrorLens.disableLine',
	/** {@link updateEverythingCommand} */
	UpdateEverything = 'codexErrorLens.updateEverything',
	// ──── Internal ──────────────────────────────────────────────
	/** {@link statusBarCommand} */
	StatusBarCommand = 'codexErrorLens.statusBarCommand',
	/** {@link revealLineCommand} */
	RevealLine = 'codexErrorLens.revealLine',
	/** {@link excludeProblemCommand} */
	ExcludeProblem = 'codexErrorLens.excludeProblem',
	/** {@link codeLensOnClickCommand} */
	CodeLensOnClick = 'codexErrorLens.codeLensOnClick',
}

/**
 * Register all commands contributed by this extension.
 */
export function registerAllCommands(context: ExtensionContext): void {
	// ────────────────────────────────────────────────────────────
	// ──── Global commands ───────────────────────────────────────
	// ────────────────────────────────────────────────────────────
	context.subscriptions.push(commands.registerCommand(CommandId.Toggle, () => {
		vscodeUtils.updateGlobalSetting('codexErrorLens.enabled', !$config.enabled);
	}));
	context.subscriptions.push(commands.registerCommand(CommandId.ToggleError, () => {
		toggleEnabledLevels('error', $config.enabledDiagnosticLevels);
	}));
	context.subscriptions.push(commands.registerCommand(CommandId.ToggleWarning, () => {
		toggleEnabledLevels('warning', $config.enabledDiagnosticLevels);
	}));
	context.subscriptions.push(commands.registerCommand(CommandId.ToggleInfo, () => {
		toggleEnabledLevels('info', $config.enabledDiagnosticLevels);
	}));
	context.subscriptions.push(commands.registerCommand(CommandId.ToggleHint, () => {
		toggleEnabledLevels('hint', $config.enabledDiagnosticLevels);
	}));
	context.subscriptions.push(commands.registerCommand(CommandId.ToggleInlineMessage, () => {
		vscodeUtils.toggleGlobalBooleanSetting('codexErrorLens.messageEnabled');
	}));
	context.subscriptions.push(commands.registerCommand(CommandId.ToggleWorkspace, toggleWorkspaceCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.UpdateEverything, updateEverythingCommand));

	context.subscriptions.push(commands.registerCommand(CommandId.FindLinterRuleDefinition, findLinterRuleDefinitionCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.SearchForProblem, searchForProblemCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.CopyProblemCode, copyProblemCodeCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.DisableLine, disableLineCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.CopyProblemMessage, copyProblemMessageCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.ExcludeProblem, excludeProblemCommand));
	// ────────────────────────────────────────────────────────────
	// ──── Text Editor commands ──────────────────────────────────
	// ────────────────────────────────────────────────────────────
	context.subscriptions.push(commands.registerTextEditorCommand(CommandId.SelectProblem, selectProblemCommand));
	// ────────────────────────────────────────────────────────────
	// ──── Internal commands ─────────────────────────────────────
	// ────────────────────────────────────────────────────────────
	context.subscriptions.push(commands.registerCommand(CommandId.CodeLensOnClick, codeLensOnClickCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.RevealLine, revealLineCommand));
	context.subscriptions.push(commands.registerCommand(CommandId.StatusBarCommand, statusBarCommand));
}
