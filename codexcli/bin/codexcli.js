#!/usr/bin/env node

/**
 * CodexCLI bootstrap script.
 * Enforces execution from project root and prevents running inside dist/.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Enforce execution NOT inside dist/
if (__dirname.includes('dist')) {
  console.error('Error: CodexCLI should be run from the installed package, not from within the dist/ directory.');
  process.exit(1);
}

// 2. Resolve project root (the directory where the command is run)
const projectRoot = process.cwd();

// 3. Import and run the main entry point from dist/
const mainPath = path.resolve(__dirname, '../dist/cli.js');

if (!fs.existsSync(mainPath)) {
  console.error(`Error: Could not find build artifacts at ${mainPath}. Did you run 'npm run build'?`);
  process.exit(1);
}

import(mainPath).catch(err => {
  console.error('Failed to launch CodexCLI:', err);
  process.exit(1);
});
