#!/usr/bin/env bash
# The breaker's four runs of the fresh 50: each stand-in, with and without the connector instructions.
# Run from the evidence folder: bash breaker/run-all.sh
set -u
for inst in with without; do
  flag=""; name="fresh50"; [ "$inst" = without ] && flag="--without-instructions" && name="fresh50-no-instructions"
  python3 tools/run-tryouts.py --provider openai --model gpt-6.1-sol --tools breaker/raw --questions breaker/questions.json --out breaker/runs/$name.gpt-6.1-sol.jsonl $flag
  python3 tools/run-tryouts.py --provider claude --model claude-sonnet-5-5 --tools breaker/raw --questions breaker/questions.json --out breaker/runs/$name.claude-sonnet-5-5.jsonl $flag
done
echo ALL-DONE
