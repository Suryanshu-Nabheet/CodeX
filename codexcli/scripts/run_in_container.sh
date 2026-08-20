#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# run_in_container.sh — run a command inside a network-disabled Docker container.
#
# Usage:
#   ./scripts/run_in_container.sh [--mount DIR] -- COMMAND [ARGS...]
#
# Example:
#   ./scripts/run_in_container.sh --mount "$(pwd)" -- npm test
# -----------------------------------------------------------------------------

set -euo pipefail

MOUNTS=()
IMAGE="${CODEXCLI_SANDBOX_IMAGE:-node:22-bookworm-slim}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mount)
      shift
      MOUNTS+=("-v" "$1:/work$1" "-w" "/work$1")
      ;;
    --image)
      shift
      IMAGE="$1"
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      echo "Usage: $(basename "$0") [--mount DIR] [--image IMAGE] -- COMMAND [ARGS...]"
      exit 0
      ;;
    *)
      echo "Unexpected argument: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ $# -eq 0 ]]; then
  echo "Error: command required after --" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found." >&2
  exit 1
fi

MOUNT_ARGS=()
if [[ ${#MOUNTS[@]} -eq 0 ]]; then
  MOUNT_ARGS=(-v "$(pwd):/work" -w /work)
else
  MOUNT_ARGS=("${MOUNTS[@]}")
fi

exec docker run --rm -i \
  --network none \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  "${MOUNT_ARGS[@]}" \
  "$IMAGE" \
  "$@"
