#!/usr/bin/env bash
# Start a throwaway Home Assistant in Docker with the demo covers and the built card.
# Usage: scripts/ha-up.sh <version> <port>    e.g. scripts/ha-up.sh 2024.8.0 8124
set -euo pipefail

ver="${1:?version, e.g. 2024.8.0 or stable}"
port="${2:?host port, e.g. 8124}"
name="ha-${ver}"
dir="$PWD/.ha-${ver}"
image="ghcr.io/home-assistant/home-assistant:${ver}"

[ -f dist/curtain-control-card.js ] || { echo "run npm run build first" >&2; exit 1; }

# Template covers use the legacy syntax before 2025.10.
case "$ver" in
  2024.* | 2025.[1-9] | 2025.[1-9].*) demo=dev/ha-demo-legacy.yaml ;;
  *) demo=dev/ha-demo.yaml ;;
esac

docker rm -f "$name" >/dev/null 2>&1 || true
if [ -d "$dir" ]; then
  # HA writes as root; on Linux the host user cannot delete those files directly.
  docker run --rm -v "$dir:/c" --entrypoint sh "$image" -c 'rm -rf /c/* /c/.[!.]* /c/..?*'
  rmdir "$dir"
fi
mkdir -p "$dir/packages" "$dir/themes" "$dir/www"
cp "$demo" "$dir/packages/cc_demo.yaml"
cp dev/ha-demo-helpers.yaml "$dir/packages/cc_demo_helpers.yaml"
cp dist/curtain-control-card.js "$dir/www/"
cat >"$dir/configuration.yaml" <<'YAML'
default_config:
demo:
homeassistant:
  packages: !include_dir_named packages
frontend:
  themes: !include_dir_merge_named themes
YAML
# Nord colours from the design canvas, for the custom-theme checks.
cat >"$dir/themes/nord.yaml" <<'YAML'
Nord:
  card-background-color: "#2e3440"
  primary-background-color: "#242933"
  secondary-background-color: "#3b4252"
  primary-text-color: "#eceff4"
  secondary-text-color: "#a3adc2"
  divider-color: "#434c5e"
  primary-color: "#88c0d0"
YAML

docker run -d --label curtain-control-card-e2e=1 --name "$name" -p "${port}:8123" -v "$dir:/config" -e TZ=UTC "$image" >/dev/null

printf 'waiting for %s on :%s' "$name" "$port"
for _ in $(seq 1 120); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/api/" || true)"
  if [ "$code" = 401 ] || [ "$code" = 200 ]; then
    echo " up"
    exit 0
  fi
  printf '.'
  sleep 2
done
echo " timed out" >&2
docker logs --tail 40 "$name" >&2
exit 1
