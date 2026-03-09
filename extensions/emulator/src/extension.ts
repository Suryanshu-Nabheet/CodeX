import * as vscode from 'vscode';
import { OS_PICKER } from './constants';
import { androidColdBoot, isWSL } from './config';
import { androidPick } from './android';
import { iOSPick } from './ios';

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('codex-emulator.start', () => {
		// If on Windows, directly show Android devices
		if (!androidColdBoot() && (process.platform.startsWith('win') || isWSL())) {
			androidPick(false);
			return;
		}

		// For other platforms, show the OS picker
		const pickerList: string[] = [OS_PICKER.ANDROID];
		if (process.platform === 'darwin') {
			pickerList.push(OS_PICKER.IOS);
		}
		if (androidColdBoot()) {
			pickerList.push(OS_PICKER.ANDROID_COLD);
		}

		vscode.window.showQuickPick(pickerList).then((response) => {
			switch (response) {
				case OS_PICKER.ANDROID:
					androidPick(false);
					break;
				case OS_PICKER.ANDROID_COLD:
					androidPick(true);
					break;
				case OS_PICKER.IOS:
					iOSPick();
					break;
			}
		});
	});

	context.subscriptions.push(disposable);

	// Create a Status Bar Item
	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'codex-emulator.start';
	statusBarItem.text = '$(device-mobile) CodeX Emulator';
	statusBarItem.tooltip = 'Click to open CodeX Emulator';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);
}

export function deactivate() { }
