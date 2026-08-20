import fs from "fs";
import os from "os";
import path from "path";

let logStream: fs.WriteStream | null = null;

export function initLogger() {
  const logDir = path.join(os.tmpdir(), "codexcli");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, "latest.log");
  logStream = fs.createWriteStream(logFile, { flags: "a" });
}

export function log(message: string) {
  if (logStream) {
    logStream.write(`${new Date().toISOString()} - ${message}\n`);
  }
}

export function isLoggingEnabled() {
  return logStream !== null;
}
