#!/usr/bin/env bash

# Exit on error
set -e

# Get the root directory of the project
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Ensure we are in the root directory
cd "$ROOT_DIR"

# Execute sequential commands using && to ensure each one ends successfully before the next starts
echo "Starting end-to-end setup..."

# 1. npm install
echo "1. Installing dependencies..." && \
npm install && \
\
# 2. Build React components
echo "2. Building React components..." && \
cd "$ROOT_DIR/src/vs/workbench/contrib/codex/browser/react" && \
node build.js && \
\
# 3. Return to root and compile
cd "$ROOT_DIR" && \
echo "3. Compiling codebase..." && \
npm run compile && \
\
# 4. Launch the application (backgrounded so the script can proceed to watch)
echo "4. Launching application..." && \
("./scripts/code.sh" &) && \
\
# 5. Start watch mode for real-time development
echo "5. Starting watch mode for real-time testing..." && \
sleep 2 && \
npm run watch
