#!/usr/bin/env bash
# Local, pinned instrumentation. Only aggregates are written below accuracy-refresh/.
# No downloads, network, package installation, remote actions or fixture generation.
set -euo pipefail
SITE_ROOT=$(cd "$(dirname "$0")/../../../../../.." && pwd)
cd "$SITE_ROOT"
export SITE_ROOT
export PATH="$SITE_ROOT/../npm-cache/_npx/5705de4b80ce9477/node_modules/node/bin:$PATH"
export WORK_ROOT=${WORK_ROOT:-/tmp/rc16-accuracy-refresh}
export SWISS_EPHE=${SWISS_EPHE:-"$SITE_ROOT/../reference-swiss-ephe"}
export PYTHONDONTWRITEBYTECODE=1
PSWISS=${PSWISS:-"$SITE_ROOT/../reference-swiss-env/bin/python"}
PERFA=${PERFA:-"$SITE_ROOT/../reference-env/bin/python"}
OUT=docs/platform/evidence/site-engine-rc16/accuracy-refresh
BENCH=docs/platform/evidence/swiss-benchmark/tools
PHASE=docs/platform/evidence/phase1-verdicts-2026-09-25/tools
HOUSES=docs/platform/evidence/houses-2026-09-26/tools
mkdir -p "$WORK_ROOT"
[ "$(node --version)" = v22.22.2 ]
# Assert scratch data cannot enter the repository, and check the pinned file identities.
"$PSWISS" - <<'PY'
from pathlib import Path
import hashlib, importlib.metadata, os, swisseph
root=Path(os.environ['SITE_ROOT']).resolve(); work=Path(os.environ['WORK_ROOT']).resolve()
assert root not in work.parents and work!=root
assert swisseph.version=='2.10.03' and importlib.metadata.version('pyswisseph')=='2.10.3.2'
for name,want in {'sepl_18.se1':'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66','semo_18.se1':'1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7'}.items():
    assert hashlib.sha256((Path(os.environ['SWISS_EPHE'])/name).read_bytes()).hexdigest()==want
PY
"$PSWISS" "$OUT/tools/runtime.py" "$PERFA" > "$OUT/runtime.json"
node "$BENCH/multiyear-zodiacs.mjs" > "$WORK_ROOT/multiyear-zodiacs.jsonl"
"$PSWISS" "$BENCH/multiyear_swiss.py" "$WORK_ROOT/multiyear-zodiacs.jsonl" "$SWISS_EPHE" > "$OUT/multiyear-1800-2199.json"
node "$BENCH/deltat-gap-zodiacs.mjs" > "$WORK_ROOT/deltat-gap-zodiacs.jsonl"
"$PSWISS" "$BENCH/deltat_gap_swiss.py" "$WORK_ROOT/deltat-gap-zodiacs.jsonl" "$SWISS_EPHE" > "$OUT/deltat-gap-2100-2199.json"
# Preserve the literal historical P1.03 runner's rc.7-version compatibility failure.
export WORK="$WORK_ROOT/literal-original"
mkdir -p "$WORK"
set +e
node node_modules/vite-node/vite-node.mjs --config "$PHASE/vite.config.mjs" "$PHASE/s13/engine_grids.mjs" > "$OUT/original-p103-tool-failure.log" 2>&1
status=$?
set -e
echo "exit=$status" >> "$OUT/original-p103-tool-failure.log"
[ "$status" -eq 1 ] && grep -q 'Error: engine 0.1.1-rc.16' "$OUT/original-p103-tool-failure.log"
for mode in default-utc aligned-ut1; do
    export CLOCK_MODE="$mode" WORK="$WORK_ROOT/$mode"
    mkdir -p "$WORK/s13/erfa-rebuild"
    node node_modules/vite-node/vite-node.mjs --config "$PHASE/vite.config.mjs" "$OUT/tools/engine-grids.mjs" > "$WORK/s13/engine-grids.log"
    "$PSWISS" "$PHASE/s13/swiss_grids.py" > "$WORK/s13/swiss-grids.log"
    "$PERFA" - <<'PY'
import json, os
p=os.environ['WORK']+'/s13/'
e=json.load(open(p+'engine-grids.json'))
json.dump(dict(engineVersion=e['engineVersion'], **{k:[[r['ut'],r['tt']] for r in e[k]] for k in ['A','L']}),open(p+'erfa-rebuild/angle-clock.json','w'))
PY
    "$PERFA" "$OUT/tools/angle-arbiter.py" "$WORK/s13/erfa-rebuild/angle-clock.json" > "$WORK/s13/erfa-rebuild/angle-grid-erfa.json"
    "$PERFA" "$OUT/tools/compare13.py" > "$WORK/s13/compare13.log"
done
node "$HOUSES/dump-end-to-end.mjs" > "$WORK_ROOT/houses-default-utc.jsonl"
# Preserve the literal historical comparator's new-system compatibility failure.
set +e
"$PSWISS" "$HOUSES/compare-end-to-end.py" "$WORK_ROOT/houses-default-utc.jsonl" "$SWISS_EPHE" > "$WORK_ROOT/original-house-tool.stdout" 2> "$OUT/original-house-tool-failure.log"
status=$?
set -e
echo "exit=$status" >> "$OUT/original-house-tool-failure.log"
[ "$status" -eq 1 ] && grep -q "KeyError: 'equal-mc'" "$OUT/original-house-tool-failure.log"
"$PSWISS" "$OUT/tools/compare-houses.py" "$WORK_ROOT/houses-default-utc.jsonl" "$SWISS_EPHE" > "$OUT/houses-default-utc.json"
node "$OUT/tools/dump-houses-aligned-ut1.mjs" > "$WORK_ROOT/houses-aligned-ut1.jsonl"
"$PSWISS" "$OUT/tools/compare-houses.py" "$WORK_ROOT/houses-aligned-ut1.jsonl" "$SWISS_EPHE" > "$OUT/houses-aligned-ut1.json"
node "$HOUSES/dump-given.mjs" > "$WORK_ROOT/houses-given.jsonl"
"$PSWISS" "$OUT/tools/compare-houses-given.py" "$WORK_ROOT/houses-given.jsonl" > "$OUT/houses-given.json"
"$PERFA" "$OUT/tools/summarize.py" > "$WORK_ROOT/summary.log"
