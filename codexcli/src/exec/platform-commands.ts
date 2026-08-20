import os from "os";

export function adaptCommandForPlatform(command: Array<string>): Array<string> {
  if (os.platform() === "win32") {
    if (command[0] === "ls") {
      command[0] = "dir";
    }
    // Add other windows adaptations if necessary
  }
  return command;
}
