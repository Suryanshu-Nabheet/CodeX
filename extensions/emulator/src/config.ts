import { workspace } from 'vscode';
import * as os from 'os';

let config = workspace.getConfiguration('emulator');

workspace.onDidChangeConfiguration((event) => {
	if (event.affectsConfiguration('emulator')) {
		config = workspace.getConfiguration('emulator');
	}
});

export const isWSL = () => {
	if (process.platform !== 'linux') return false;
	const release = os.release().toLowerCase();
	return release.includes('microsoft') || release.includes('wsl');
};

export const getPath = (): string | undefined => {
	const pathMac = config.get<string>('emulatorPathMac');
	const pathLinux = config.get<string>('emulatorPathLinux');
	const pathWindows = config.get<string>('emulatorPathWindows');
	const pathWSL = config.get<string>('emulatorPathWSL');

	if (process.platform === 'darwin' && pathMac) {
		return pathMac;
	}
	if (process.platform === 'linux' && !isWSL() && pathLinux) {
		return pathLinux;
	}
	if (process.platform.startsWith('win') && pathWindows) {
		return pathWindows;
	}
	if (isWSL() && pathWSL) {
		return pathWSL;
	}
	return config.get<string>('emulatorPath');
};

export const androidColdBoot = () => config.get<boolean>('androidColdBoot');
export const androidExtraBootArgs = () => config.get<string>('androidExtraBootArgs');
export const simulatorPath = () => config.get<string>('simulatorPath');
