#!/bin/sh
# Regenerate every artefact in this directory, in dependency order.
#
#   SWISS_WINDOW_FIXTURE=<fixture> sh run-all.sh <output directory>
#
# The first run wrote into raw/ in a scratch copy at /home/user/precision/search
# and read the repository at /home/user/site: the fixture, the v6 policy and
# the DE prototype module, never modified. The fixture and Swiss's own figures
# in the output left the tree on 2026-09-28 and 2026-09-29
# (docs/engine-validation/SWISS-OUTPUT-REMOVAL.md), so now both stay outside
# it: SWISS_WINDOW_FIXTURE is a copy of
# `git show 2ca93d41:src/lib/engine/fixtures/transit-window-independent.json`
# kept outside the repository, and the output directory must be outside it
# too. uranus-d.mjs reads the decomposition it is paired with from raw/.
set -eu
out="${1:?give an output directory outside the repository}"
cd "$(dirname "$0")"
mkdir -p "$out"
case "$(cd "$out" && pwd -P)/" in
  "$(git rev-parse --show-toplevel)"/*) echo "$out is inside the repository" >&2; exit 1 ;;
esac

echo "== analytic suite (proven enclosures) =="
node test-analytic.mjs

echo "== reproduce the original failure =="
node reproduce.mjs > "$out/reproduction.json"

echo "== four-way decomposition and stationary audit =="
node decompose.mjs > "$out/decomposition.json"

echo "== the real Uranus D case under the new contract =="
node uranus-d.mjs > "$out/uranus-d.json"

echo "== done =="
ls -l "$out"
