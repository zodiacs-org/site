#!/bin/zsh
# Runs the audit's twenty-fixture matrix (the bundle's committed harness,
# unchanged and run in place) and its bracket-recording companion on
# version 1 and on #860's code, one job at a time, under nice -n 10, with
# the pinned Node. Outputs go to ../raw and ../logs only.
set -u
export PATH=<node-22.22.2>/bin:$PATH
P45=<scratch>/p45
O=$P45/prior-versions/results/matrix
H=$P45/prior-versions/bundle/examples/precision-alpha/tools/measure
V1=$P45/v1/examples/precision-alpha
HEAD=$P45/prior-versions/head/examples/precision-alpha
cd $O || exit 1
{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "node: $(command -v node) $(node -v)"
  echo "uname: $(uname -a)"
  echo "load: $(uptime)"
  echo "harness sha256:"
  shasum -a 256 $H/fixture-matrix.mjs $H/fixture-events.mjs
} > logs/environment.txt 2>&1
run() {
  local label=$1; shift
  local t0=$(date +%s)
  echo "start $label $(date -u +%H:%M:%SZ)" >> logs/progress.txt
  nice -n 10 node "$@" > logs/$label.stdout.log 2> logs/$label.stderr.log
  local rc=$?
  echo "end $label exit $rc after $(( $(date +%s) - t0 )) s" >> logs/progress.txt
  return $rc
}
: > logs/progress.txt
run matrix-v1   $H/fixture-matrix.mjs --tree=$V1   --out=$O/raw/matrix-v1.json
run events-v1   $H/fixture-events.mjs --tree=$V1   --out=$O/raw/events-v1.json
run matrix-head $H/fixture-matrix.mjs --tree=$HEAD --out=$O/raw/matrix-head.json
run events-head $H/fixture-events.mjs --tree=$HEAD --out=$O/raw/events-head.json
echo "all done $(date -u +%H:%M:%SZ)" >> logs/progress.txt
