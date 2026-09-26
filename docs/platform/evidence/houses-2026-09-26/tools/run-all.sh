#!/bin/bash
# Reruns every comparison behind ../README.md from the site root with engine
# rc.9 installed. Needs pyswisseph 2.10.03, pyerfa, and Swiss's sepl_18.se1 and
# semo_18.se1 in SWISS_EPHE. Writes results/ and a scratch directory only;
# nothing Swiss computes is written anywhere.
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
HERE=docs/platform/evidence/houses-2026-09-26
WORK=${WORK:-$(mktemp -d)}
: "${SWISS_EPHE:?set SWISS_EPHE}"
export PYTHONDONTWRITEBYTECODE=1
node "$HERE/tools/dump-given.mjs" > "$WORK/given.jsonl"
python3 "$HERE/tools/compare-given.py" "$WORK/given.jsonl" > "$HERE/results/given.json"
node "$HERE/tools/dump-end-to-end.mjs" > "$WORK/end-to-end.jsonl"
python3 "$HERE/tools/compare-end-to-end.py" "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > "$HERE/results/end-to-end.json"
node "$HERE/tools/sidereal.mjs" > "$WORK/sidereal.jsonl"
python3 "$HERE/tools/sidereal.py" "$WORK/sidereal.jsonl" > "$HERE/results/sidereal.json"
python3 "$HERE/tools/worst-koch.py" "$WORK/end-to-end.jsonl" "$SWISS_EPHE" > "$WORK/worst-koch-inputs.json"
node "$HERE/tools/worst-koch.mjs" "$WORK/worst-koch-inputs.json" > "$HERE/results/worst-koch.json"
echo "done: $HERE/results"
