#!/usr/bin/env bash
set -euo pipefail
paper_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)
test -f "$paper_root/frozen/research/market-lens/prospective-manifest.json"
test -f "$paper_root/ops/runtime-deps/package-lock.json"
if [ -e "$paper_root/frozen/node_modules" ] && [ ! -L "$paper_root/frozen/node_modules" ]; then
  echo 'Move the old full-site node_modules out of the frozen runtime before installing the minimal runtime.' >&2
  exit 1
fi
if [ -L "$paper_root/frozen/node_modules" ] && [ "$(readlink "$paper_root/frozen/node_modules")" != '../ops/runtime-deps/node_modules' ]; then
  echo 'Unexpected runtime dependency link; refuse to replace it.' >&2
  exit 1
fi
npm ci --prefix "$paper_root/ops/runtime-deps" --ignore-scripts --no-audit --no-fund
if [ ! -L "$paper_root/frozen/node_modules" ]; then
  ln -s ../ops/runtime-deps/node_modules "$paper_root/frozen/node_modules"
fi
