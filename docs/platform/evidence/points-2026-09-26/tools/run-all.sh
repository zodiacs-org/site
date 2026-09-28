#!/bin/bash
# Reruns every comparison behind ../README.md from the site root with engine
# rc.10 installed. Needs pyswisseph 2.10.03, pyerfa, and Swiss's sepl_18.se1 and
# semo_18.se1 in SWISS_EPHE. Writes results/ and a scratch directory only;
# nothing Swiss computes is written anywhere.
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
HERE=docs/platform/evidence/points-2026-09-26
WORK=${WORK:-$(mktemp -d)}
: "${SWISS_EPHE:?set SWISS_EPHE}"
export PYTHONDONTWRITEBYTECODE=1
node "$HERE/tools/dump-given.mjs" > "$WORK/given.jsonl"
python3 "$HERE/tools/compare-given.py" "$WORK/given.jsonl" > "$HERE/results/given.json"
node "$HERE/tools/dump-mean.mjs" > "$WORK/mean.jsonl"
python3 "$HERE/tools/compare-mean.py" "$WORK/mean.jsonl" "$SWISS_EPHE" > "$HERE/results/mean.json"
node "$HERE/tools/dump-end-to-end.mjs" > "$WORK/end-to-end.jsonl"
python3 "$HERE/tools/compare-end-to-end.py" "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > "$HERE/results/end-to-end.json"
python3 "$HERE/tools/worst-vertex.py" "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > "$WORK/worst-vertex-inputs.json"
node "$HERE/tools/worst-vertex.mjs" "$WORK/worst-vertex-inputs.json" > "$HERE/results/worst-vertex.json"
node "$HERE/tools/dump-args.mjs" > "$WORK/args.jsonl"
python3 "$HERE/tools/erfa-args.py" "$WORK/args.jsonl" > "$HERE/results/erfa-args.json"
echo "done: $HERE/results"
