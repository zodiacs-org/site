#!/bin/bash
# Reruns the comparison behind ../README.md from the site root with the
# vendored engine rc.16 installed (npm ci). Needs python3 with pyswisseph
# 2.10.03; no ephemeris file. Writes results/ and a scratch directory only;
# nothing Swiss computes is written outside the scratch directory.
set -euo pipefail
cd "$(dirname "$0")/../../../../.."
HERE=docs/platform/evidence/co-ascendants-2026-10-04
WORK=${WORK:-$(mktemp -d)}
export PYTHONDONTWRITEBYTECODE=1
node "$HERE/tools/dump-end-to-end.mjs" > "$WORK/end-to-end.jsonl"
python3 "$HERE/tools/compare-end-to-end.py" "$WORK/end-to-end.jsonl" "$WORK/worst-case.json" > "$HERE/results/end-to-end.json"
node "$HERE/tools/worst-case.mjs" "$WORK/worst-case.json" > "$HERE/results/worst-case.json"
echo "done: $HERE/results"
