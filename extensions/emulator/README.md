# CodeX Android iOS Emulator

A powerful extension for CodeX to run Android and iOS Simulators with a single click. Made by Suryanshu Nabheet

**Running iOS simulators only works on Mac with Xcode!**

## Features

Select and run your emulator directly from CodeX.

Open all commands with `Cmd-Shift-P` and type `CodeX Emulator` or click the Emulator icon in the top right.

## Requirements

### Android Studio

To run Android emulators you need to have Android studio and already created the Android Virtual Devices.

Add the Android Studio emulator script to your settings of CodeX:
You can either set the default path or specify a specific path for each operating system. The default path will always be the fallback.
&nbsp;&nbsp;&nbsp;&nbsp;Default: `"emulator.emulatorPath": "~/Library/Android/sdk/emulator"`
&nbsp;&nbsp;&nbsp;&nbsp;Mac: `"emulator.emulatorPathMac": "~/Library/Android/sdk/emulator"`
&nbsp;&nbsp;&nbsp;&nbsp;Linux: `"emulator.emulatorPathLinux": "~/Android/Sdk/emulator"`
&nbsp;&nbsp;&nbsp;&nbsp;Windows: `"emulator.emulatorPathWindows":`
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`"<yourAndroidHome>\\Sdk\\emulator"`
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;or
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`"C:\Users\<yourUsername>\AppData\Local\Android\Sdk\emulator"`
&nbsp;&nbsp;&nbsp;&nbsp;WSL: `"emulator.emulatorPathWSL": "/mnt/c/Users/<yourUsername>/AppData/Local/Android/Sdk/emulator"`

Your CodeX settings are found here:
&nbsp;&nbsp;&nbsp;&nbsp;File -> Preferences -> Setting -> User Setting -> Extensions -> CodeX Emulator Configuration

Enable selection for cold boot Android emulators. Activate it in your settings:
&nbsp;&nbsp;&nbsp;&nbsp;Android Cold Boot: `true`

### Xcode

To run iOS emulators Xcode is required.

If your Xcode or simulator is not installed in the default location it is possible to set the correct path of the Simulator.app file:
`"emulator.simulatorPath": "/Applications/Xcode.app/Contents/Developer/Applications/Simulator.app"`

## License

MIT License

Copyright (c) 2026 Suryanshu Nabheet
