#!/usr/bin/env bash
# Remove the containers started by ha-up.sh (their .ha-<version>/ folders are kept for logs).
set -euo pipefail
ids="$(docker ps -aq --filter 'label=curtain-control-card-e2e=1')"
[ -z "$ids" ] || docker rm -f $ids >/dev/null
echo "removed: ${ids:-none}"
