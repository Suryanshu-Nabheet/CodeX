#!/usr/bin/env bash

# Exit on error, undefined vars, and failed pipes
set -euo pipefail

# Get the root directory of the project
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Starting end-to-end setup..."

# ---------------------------------------------------------------------------
# 0. Select a Python interpreter that node-gyp can actually use.
#
#    node-gyp picks `python3` off PATH by default. On macOS that is often a
#    Homebrew Python (e.g. 3.14) whose `pyexpat`/`plistlib` is broken or that
#    is newer than node-gyp supports, which makes native builds (@vscode/sqlite3,
#    etc.) fail. We probe known-good interpreters and verify each can import
#    `plistlib` (which transitively imports the C `pyexpat` module gyp needs),
#    then pin it for npm/node-gyp via $npm_config_python and $PYTHON.
# ---------------------------------------------------------------------------
pick_python() {
	local candidate resolved
	for candidate in python3.13 python3.12 python3.11 python3.10 /usr/bin/python3 python3; do
		resolved="$(command -v "$candidate" 2>/dev/null || true)"
		[ -n "$resolved" ] || continue
		# Verify the interpreter is healthy enough for node-gyp.
		if "$resolved" -c "import plistlib, sys; assert sys.version_info[:2] <= (3, 13)" >/dev/null 2>&1; then
			printf '%s\n' "$resolved"
			return 0
		fi
	done
	return 1
}

echo "0. Selecting a compatible Python for native builds..."
if PYTHON_BIN="$(pick_python)"; then
	export npm_config_python="$PYTHON_BIN"
	export PYTHON="$PYTHON_BIN"
	echo "   Using Python: $PYTHON_BIN ($("$PYTHON_BIN" -c 'import sys;print("%d.%d.%d"%sys.version_info[:3])'))"
else
	echo "   ERROR: No working Python (3.10-3.13) found for node-gyp." >&2
	echo "   node-gyp needs a Python whose 'pyexpat' module loads cleanly and is <= 3.13." >&2
	echo "   Install one with: brew install python@3.12" >&2
	echo "   Then re-run: ./scripts/setup.sh" >&2
	exit 1
fi

# 1. Install dependencies
echo "1. Installing dependencies..."
npm install

# 2. Build React components
echo "2. Building React components..."
(cd "$ROOT_DIR/src/vs/workbench/contrib/codex/browser/react" && node build.js)

# 3. Compile the codebase
echo "3. Compiling codebase..."
npm run compile

# 4. Launch the application (backgrounded so the script can proceed to watch)
echo "4. Launching application..."
("$ROOT_DIR/scripts/code.sh" &)

# 5. Start watch mode for real-time development
echo "5. Starting watch mode for real-time testing..."
sleep 2
npm run watch
