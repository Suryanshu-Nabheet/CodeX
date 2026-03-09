export const OS_PICKER = {
	ANDROID: 'View Android emulators',
	ANDROID_COLD: 'View Android cold boot emulators',
	IOS: 'View iOS simulators',
};

export const ANDROID_COMMANDS = {
	LIST_AVDS: ' -list-avds',
	RUN_AVD: ' -avd ',
	RUN_AVD_COLD: ' -no-snapshot-load -avd ',
};

export const IOS_COMMANDS = {
	LIST_SIMULATORS: 'xcrun simctl list --json devices',
	BOOT_SIMULATOR: 'xcrun simctl boot ',
	DEVELOPER_DIR: 'xcode-select -p',
	SIMULATOR_APP: '/Applications/Simulator.app ',
	SIMULATOR_ARGS: ' --args -CurrentDeviceUDID ',
};

export const ANDROID = {
	PATH: 'emulator',
};
