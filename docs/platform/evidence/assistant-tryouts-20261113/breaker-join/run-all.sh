#!/usr/bin/env bash
# The join-round breaker's Claude runs of the fresh 50 (breaker/questions.json, unchanged), against the tool list
# and instructions dumped from the joined head into breaker-join/raw. Then the extra probes, the same ways.
# The recorded OpenAI runs in breaker-join/runs/ cannot be reproduced here: the owner has not approved OpenAI API
# spend (ZOD-207), so those recorded runs are the evidence.
# Run from the evidence folder: bash breaker-join/run-all.sh
set -euo pipefail
for set in fresh50 probes; do
  q=breaker/questions.json; [ "$set" = probes ] && q=breaker-join/probes.json
  [ -f "$q" ] || continue
  for inst in with without; do
    flag=""; name="$set"; [ "$inst" = without ] && flag="--without-instructions" && name="$set-no-instructions"
    python3 tools/run-tryouts.py --provider claude --model claude-sonnet-5-5 --tools breaker-join/raw --questions $q --out breaker-join/runs/$name.claude-sonnet-5-5.jsonl $flag
  done
done
echo ALL-DONE
