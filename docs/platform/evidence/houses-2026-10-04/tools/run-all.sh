#!/bin/bash
# Reruns the comparisons behind ../README.md from the site root with the
# vendored engine rc.16 installed (npm ci). Needs python3 with pyswisseph
# 2.10.03; no ephemeris file. Writes results/ and a scratch directory only;
# nothing Swiss computes is written outside the scratch directory.
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
HERE=docs/platform/evidence/houses-2026-10-04
WORK=${WORK:-$(mktemp -d)}
export PYTHONDONTWRITEBYTECODE=1
mkdir -p "$HERE/results"
node "$HERE/tools/dump-given.mjs" > "$WORK/given.jsonl"
python3 "$HERE/tools/compare-given.py" "$WORK/given.jsonl" > "$HERE/results/given.json"
node "$HERE/tools/dump-end-to-end.mjs" > "$WORK/end-to-end.jsonl"
python3 "$HERE/tools/compare-end-to-end.py" "$WORK/end-to-end.jsonl" "$WORK/worst-koch.json" > "$HERE/results/end-to-end.json"
node "$HERE/tools/worst-koch.mjs" "$WORK/worst-koch.json" > "$HERE/results/worst-koch.json"
echo "done: $HERE/results"
