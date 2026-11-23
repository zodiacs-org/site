#!/usr/bin/env bash
# The breaker's Claude runs of the fresh 50: the Claude stand-in, with and without the connector instructions.
# The recorded OpenAI runs in breaker/runs/ cannot be reproduced here: the owner has not approved OpenAI API spend
# (ZOD-207), so those recorded runs are the evidence.
# Run from the evidence folder: bash breaker/run-all.sh
set -euo pipefail
for inst in with without; do
  flag=""; name="fresh50"; [ "$inst" = without ] && flag="--without-instructions" && name="fresh50-no-instructions"
  python3 tools/run-tryouts.py --provider claude --model claude-sonnet-5-5 --tools breaker/raw --questions breaker/questions.json --out breaker/runs/$name.claude-sonnet-5-5.jsonl $flag
done
echo ALL-DONE
