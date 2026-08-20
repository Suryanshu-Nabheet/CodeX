import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = join(fileURLToPath(import.meta.url), "..");
const pkg = JSON.parse(
  readFileSync(join(__dirname, "../package.json"), "utf8"),
);

// Read the version directly from package.json.
export const CLI_VERSION: string = (pkg as { version: string }).version;
