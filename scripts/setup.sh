#!/usr/bin/env bash

# Exit on error
set -e

# Get the root directory of the project
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 1. Install dependencies
echo "Installing dependencies..."
npm install

# 2. Build React components
echo "Building React components..."
cd "$ROOT_DIR/src/vs/workbench/contrib/codex/browser/react"
node build.js

# 3. Return to root and compile
echo "Compiling codebase..."
cd "$ROOT_DIR"
npm run compile

# 4. Launch the application in the background
echo "Launching application..."
"$ROOT_DIR/scripts/code.sh" &

# 5. Start watch mode for real-time development
echo "Starting watch mode..."
npm run watch
