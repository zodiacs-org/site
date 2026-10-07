#!/usr/bin/env bash
# The two Swiss statistics runs the public accuracy claims bind to, on the
# installed engine. Only aggregates are written below accuracy-refresh/; the
# per-instant dumps stay in WORK_ROOT, outside the repository. No downloads,
# network, package installation or remote action.
#
#   WORK_ROOT=<scratch> SWISS_EPHE=<dir of sepl_18.se1 and semo_18.se1> PSWISS=<python with pyswisseph 2.10.3.2> \
#     bash docs/platform/evidence/site-engine-rc17/accuracy-refresh/tools/run.sh
set -euo pipefail
SITE_ROOT=$(cd "$(dirname "$0")/../../../../../.." && pwd)
cd "$SITE_ROOT"
export SITE_ROOT
: "${WORK_ROOT:?set WORK_ROOT to a scratch directory outside the repository}"
: "${SWISS_EPHE:?set SWISS_EPHE to the directory of the Swiss data files}"
: "${PSWISS:?set PSWISS to a Python with pyswisseph 2.10.3.2}"
export WORK_ROOT SWISS_EPHE PYTHONDONTWRITEBYTECODE=1
OUT=docs/platform/evidence/site-engine-rc17/accuracy-refresh
BENCH=docs/platform/evidence/swiss-benchmark/tools
mkdir -p "$WORK_ROOT"
[ "$(node --version)" = v22.22.2 ]
# Scratch must stay outside the repository; check the pinned Swiss identities.
"$PSWISS" - <<'PY'
from pathlib import Path
import hashlib, importlib.metadata, os, swisseph
root=Path(os.environ['SITE_ROOT']).resolve(); work=Path(os.environ['WORK_ROOT']).resolve()
assert root not in work.parents and work!=root
assert swisseph.version=='2.10.03' and importlib.metadata.version('pyswisseph')=='2.10.3.2'
for name,want in {'sepl_18.se1':'ca1393ceab3a44fbc895887cf789c68819ae6a1cbc9b22225872dbe4ccd99a66','semo_18.se1':'1ca07bd67c24374d77226180c20a4f9996cba013697894810518e7eb582ca4f7'}.items():
    assert hashlib.sha256((Path(os.environ['SWISS_EPHE'])/name).read_bytes()).hexdigest()==want
PY
node "$BENCH/multiyear-zodiacs.mjs" > "$WORK_ROOT/multiyear-zodiacs.jsonl"
"$PSWISS" "$BENCH/multiyear_swiss.py" "$WORK_ROOT/multiyear-zodiacs.jsonl" "$SWISS_EPHE" > "$OUT/multiyear-1800-2199.json"
node "$BENCH/deltat-gap-zodiacs.mjs" > "$WORK_ROOT/deltat-gap-zodiacs.jsonl"
"$PSWISS" "$BENCH/deltat_gap_swiss.py" "$WORK_ROOT/deltat-gap-zodiacs.jsonl" "$SWISS_EPHE" > "$OUT/deltat-gap-2100-2199.json"
