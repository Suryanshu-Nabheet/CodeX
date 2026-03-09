import { window, QuickPickItem } from 'vscode';
import { runCmd } from './utils/commands';
import { IOS_COMMANDS } from './constants';
import { simulatorPath } from './config';

interface IOSSimulator {
	name: string;
	udid: string;
	state: string;
	isAvailable: boolean;
	version: string;
}

interface SimulatorQuickPickItem extends QuickPickItem {
	simulator?: IOSSimulator;
}

// Get iOS devices and pick iOS version first, then device
export const iOSPick = async () => {
	// Create and show QuickPick with loading state
	const quickPick = window.createQuickPick<SimulatorQuickPickItem>();
	quickPick.placeholder = 'Loading iOS simulators...';
	quickPick.busy = true;
	quickPick.show();

	try {
		const simulators = await getIOSSimulators();

		if (!simulators || simulators.length === 0) {
			quickPick.dispose();
			window.showWarningMessage('No iOS simulators found.');
			return;
		}

		// Stage state: first pick version (if multiple), then pick device
		let stage: 'version' | 'device' = 'version';
		let selectedVersion: string | null = null;

		// Prepare version list
		const versions = Array.from(new Set(simulators.map((s) => s.version))).sort();

		quickPick.busy = false;

		if (versions.length === 1) {
			// Skip version selection UI, go straight to devices for that version
			stage = 'device';
			selectedVersion = versions[0];
			const devicesForVersion = simulators.filter(
				(s) => s.version === selectedVersion,
			);

			if (devicesForVersion.length === 0) {
				quickPick.dispose();
				window.showWarningMessage(
					`No devices found for iOS ${selectedVersion}.`,
				);
				return;
			}

			quickPick.placeholder = 'Select iOS simulator device';
			quickPick.items = devicesForVersion.map((s) => ({
				label: s.name,
				description: `(${s.udid})`,
				simulator: s,
			})) as SimulatorQuickPickItem[];
		} else {
			// Normal flow: ask for version first
			quickPick.placeholder = 'Select iOS version';
			quickPick.items = versions.map((version) => ({
				label: version,
			})) as SimulatorQuickPickItem[];
		}

		quickPick.onDidAccept(async () => {
			const selected = quickPick.selectedItems[0];
			if (!selected) {
				return;
			}

			if (stage === 'version') {
				// Move to device selection for this version
				selectedVersion = selected.label;
				const devicesForVersion = simulators.filter(
					(s) => s.version === selectedVersion,
				);

				if (devicesForVersion.length === 0) {
					window.showWarningMessage(
						`No devices found for iOS ${selectedVersion}.`,
					);
					return;
				}

				stage = 'device';
				quickPick.placeholder = 'Select iOS simulator device';
				quickPick.items = devicesForVersion.map((s) => ({
					label: s.name,
					description: `(${s.udid})`,
					simulator: s,
				})) as SimulatorQuickPickItem[];
			} else if (stage === 'device') {
				// Run the selected device
				const simulator = selected.simulator;
				if (!simulator) {
					return;
				}

				quickPick.busy = true;
				quickPick.items = [
					{
						label: `Starting ${selected.label}...`,
						simulator,
					} as SimulatorQuickPickItem,
				];

				await runIOSSimulator(simulator);

				quickPick.items = [
					{
						label: `✓ Started ${selected.label}!`,
						simulator,
					} as SimulatorQuickPickItem,
				];
				quickPick.busy = false;

				setTimeout(() => quickPick.dispose(), 2000);
			}
		});

		quickPick.onDidHide(() => quickPick.dispose());
	} catch (error: any) {
		quickPick.dispose();
		window.showErrorMessage(error.toString());
	}
};

const getIOSSimulators = async (): Promise<IOSSimulator[] | false> => {
	try {
		const res = await runCmd(IOS_COMMANDS.LIST_SIMULATORS);
		const { devices } = JSON.parse(res);

		const results: IOSSimulator[] = [];
		for (const item of Object.keys(devices)) {
			const version = item.split('.').pop()!.replace('-', ' ').replace('-', '.');
			if (devices[item].length > 0) {
				for (const device of devices[item]) {
					results.push({
						...device,
						version
					});
				}
			}
		}
		return results.filter((item) => item.isAvailable);
	} catch (e) {
		window.showErrorMessage(
			`Error fetching your iOS simulators! Make sure you have Xcode installed. Try running this command: ${IOS_COMMANDS.LIST_SIMULATORS}`,
		);
		return false;
	}
};

const runIOSSimulator = async (simulator: IOSSimulator) => {
	let developerDir = '';
	try {
		const configPath = simulatorPath();
		const xcodePath = await runCmd(IOS_COMMANDS.DEVELOPER_DIR);

		if (configPath) {
			developerDir = configPath;
		} else {
			developerDir = xcodePath.trim() + IOS_COMMANDS.SIMULATOR_APP;
		}

		if (simulator.state !== 'Booted') {
			// If simulator isn't running, boot it up
			await runCmd(IOS_COMMANDS.BOOT_SIMULATOR + simulator.udid);
		}

		await runCmd(
			'open ' + developerDir + IOS_COMMANDS.SIMULATOR_ARGS + simulator.udid
		);

		return;
	} catch (e) {
		window.showErrorMessage(
			`Error running you iOS simulator! Try running this command: ${'open ' + developerDir.trim() + IOS_COMMANDS.SIMULATOR_ARGS + simulator.udid
			}`,
		);
		return false;
	}
};
