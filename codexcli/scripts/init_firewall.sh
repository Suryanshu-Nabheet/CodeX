#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# init_firewall.sh — Linux network isolation helper for sandboxed full-auto mode.
#
# Creates an iptables chain that blocks outbound traffic for a dedicated UID.
# Requires root. Used alongside Landlock file sandboxing on Linux.
#
# Usage (as root):
#   ./scripts/init_firewall.sh [sandbox_uid]
#
# Default sandbox UID: 65534 (nobody)
# -----------------------------------------------------------------------------

set -euo pipefail

SANDBOX_UID="${1:-65534}"
CHAIN="CODEXCLI_SANDBOX"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Error: run as root (sudo $0)" >&2
  exit 1
fi

if ! command -v iptables >/dev/null 2>&1; then
  echo "Error: iptables not found. Install iptables or use run_in_container.sh." >&2
  exit 1
fi

if ! iptables -L "$CHAIN" >/dev/null 2>&1; then
  iptables -N "$CHAIN"
fi

iptables -F "$CHAIN"
iptables -A "$CHAIN" -m owner --uid-owner "$SANDBOX_UID" -j DROP

if ! iptables -C OUTPUT -j "$CHAIN" >/dev/null 2>&1; then
  iptables -A OUTPUT -j "$CHAIN"
fi

echo "Firewall chain '${CHAIN}' active for UID ${SANDBOX_UID}."
echo "Run commands as UID ${SANDBOX_UID} to enforce network isolation."
