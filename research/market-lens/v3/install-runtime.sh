#!/usr/bin/env bash
set -euo pipefail
lens_v3_here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
lens_v3_root=$(cd -- "$lens_v3_here/../../.." && pwd -P)
test "$(node --version)" = v22.22.2
test "$(npm --version)" = 10.9.7
if [ -e "$lens_v3_root/node_modules" ] && [ ! -L "$lens_v3_root/node_modules" ]; then
  echo 'Use an isolated restored runtime, not the site dependency directory.' >&2
  exit 1
fi
if [ -L "$lens_v3_root/node_modules" ] && [ "$(readlink "$lens_v3_root/node_modules")" != 'research/market-lens/v3/runtime-deps/node_modules' ]; then
  echo 'Unexpected runtime dependency link.' >&2
  exit 1
fi
npm ci --prefix "$lens_v3_here/runtime-deps" --ignore-scripts --no-audit --no-fund
if [ ! -L "$lens_v3_root/node_modules" ]; then
  ln -s research/market-lens/v3/runtime-deps/node_modules "$lens_v3_root/node_modules"
fi
