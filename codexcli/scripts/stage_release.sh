#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# stage_release.sh — stage an npm release tarball for codexcli.
#
# Usage (from repo root):
#   ./scripts/stage_release.sh [--tmp DIR] [--version VERSION]
#   npm run stage-release
# -----------------------------------------------------------------------------

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--tmp DIR] [--version VERSION]

Options
  --tmp DIR   Use DIR to stage the release (defaults to a fresh mktemp dir)
  --version   Version to release (defaults to a timestamp-based version)
  -h, --help  Show this help
EOF
  exit "${1:-0}"
}

TMPDIR=""
VERSION="$(printf '0.1.%d' "$(date +%y%m%d%H%M)")"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tmp)
      shift || { echo "--tmp requires an argument"; usage 1; }
      TMPDIR="$1"
      ;;
    --tmp=*)
      TMPDIR="${1#*=}"
      ;;
    --version)
      shift || { echo "--version requires an argument"; usage 1; }
      VERSION="$1"
      ;;
    -h|--help)
      usage 0
      ;;
    --*)
      echo "Unknown option: $1" >&2
      usage 1
      ;;
    *)
      echo "Unexpected extra argument: $1" >&2
      usage 1
      ;;
  esac
  shift
done

if [[ -z "$TMPDIR" ]]; then
  TMPDIR="$(mktemp -d)"
fi

mkdir -p "$TMPDIR"
TMPDIR="$(cd "$TMPDIR" && pwd)"

echo "Staging release in $TMPDIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

pushd "$ROOT" >/dev/null

npm install
npm run build

mkdir -p "$TMPDIR/bin"
cp bin/codexcli.js "$TMPDIR/bin/codexcli.js"
cp -r dist "$TMPDIR/dist"
cp README.md "$TMPDIR" || true

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required to bump package.json version." >&2
  exit 1
fi

jq --arg version "$VERSION" \
  '.version = $version' \
  package.json > "$TMPDIR/package.json"

popd >/dev/null

echo "Staged version $VERSION for release in $TMPDIR"
echo "Verify the CLI:"
echo "    node ${TMPDIR}/bin/codexcli.js --version"
echo "    node ${TMPDIR}/bin/codexcli.js --help"
echo "Next:  cd \"$TMPDIR\" && npm publish"
