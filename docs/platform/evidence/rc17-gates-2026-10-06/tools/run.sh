#!/bin/sh
# Re-runs P3.2's checks from the site's root, with the vendored rc.17
# archive installed (npm ci), and writes them into results/:
#   sh docs/platform/evidence/rc17-gates-2026-10-06/tools/run.sh <engine checkout>
# The engine checkout is zodiacs-org/engine at aae419c (or 782b4963, which
# carries the same fixture); the replay checks the fixture's SHA-256 itself.
# Every result is written before the script judges it. It exits 1 if the
# replay finds a mismatch, if the type check does not compile against rc.17
# or does not fail against rc.16 as recorded, if a planted fault is missed,
# or if the sweep finds a refusal or a difference inside the span or the
# span's refusals are not as recorded.
set -eu
DIR=docs/platform/evidence/rc17-gates-2026-10-06
ENGINE=${1:?engine checkout}
OUT="$DIR/results"
mkdir -p "$OUT"
FAILED=0

# 1. The round-trip fixtures, replayed through the installed engine.
node "$DIR/tools/replay-calc-roundtrip.mjs" "$ENGINE/src/fixtures/calc-roundtrip.json" > "$OUT/calc-roundtrip-replay.json" || FAILED=1

# 2. The types: calc's request types cover what @zodiacs/engine/vedic ships.
#    Against rc.17 (installed) the check compiles; against rc.16, extracted
#    from vendor/ into a temporary folder, it does not.
TSC="node node_modules/typescript/bin/tsc --noEmit --strict --module nodenext --moduleResolution nodenext --target es2022 --types node"
{ $TSC "$DIR/tools/calc-types-cover-vedic.ts" && echo "exit 0"; } > "$OUT/calc-types-rc17.log" 2>&1 || echo "exit $?" >> "$OUT/calc-types-rc17.log"
TMP=$(mktemp -d)
mkdir -p "$TMP/node_modules/@zodiacs/engine" "$TMP/node_modules/@types" "$TMP/tools"
tar -xzf vendor/zodiacs-engine-0.1.1-rc.16.tgz -C "$TMP/node_modules/@zodiacs/engine" --strip-components=1
ln -s "$PWD/node_modules/typescript" "$TMP/node_modules/typescript"
ln -s "$PWD/node_modules/@types/node" "$TMP/node_modules/@types/node"
ln -s "$PWD/node_modules/undici-types" "$TMP/node_modules/undici-types"
cp "$DIR/tools/calc-types-cover-vedic.ts" "$TMP/tools/"
{ (cd "$TMP" && $TSC tools/calc-types-cover-vedic.ts) && echo "exit 0"; } > "$OUT/calc-types-rc16.log" 2>&1 || echo "exit $?" >> "$OUT/calc-types-rc16.log"
rm -rf "$TMP"
[ "$(tail -n 1 "$OUT/calc-types-rc17.log")" = "exit 0" ] || { echo "run.sh: the type check does not compile against rc.17" >&2; FAILED=1; }
# rc.16 lacks the two caller's-ayanamsa types, and eight assertions are false there.
[ "$(grep -c "error TS2724" "$OUT/calc-types-rc16.log")" = 2 ] && [ "$(grep -c "error TS2344" "$OUT/calc-types-rc16.log")" = 8 ] \
  || { echo "run.sh: against rc.16 the type check does not fail as recorded" >&2; FAILED=1; }

# 3. Each assertion can fail: 18 faults, one change each to a copy of the
#    installed engine's dist/calc.d.ts; exits 1 unless every one is caught.
node "$DIR/tools/plant-type-faults.mjs" > "$OUT/calc-types-faults.json" || FAILED=1

# 4. At run time: the four functions with every built-in ayanamsa and a
#    caller's in twelve forms, against /vedic, and the span's refusals.
node "$DIR/tools/sweep-sidereal-options.mjs" > "$OUT/sidereal-options-sweep.json" || FAILED=1

exit "$FAILED"
