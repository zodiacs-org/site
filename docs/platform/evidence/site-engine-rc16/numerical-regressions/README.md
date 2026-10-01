# rc.16 numerical regression attribution

Local verification on Node 22.22.2. This covers the six numerical regression
files assigned below, not the full site adoption or production acceptance.
No application/UI source, programme ledger, external service, published
archive, accuracy tolerance or budget was changed.

## Reproduce

From the repository root, with installed dependencies:

```sh
node docs/platform/evidence/site-engine-rc16/numerical-regressions/measure.mjs
node node_modules/vitest/vitest.mjs run \
  src/lib/engine/transit-scan.test.ts src/lib/engine/returns.test.ts \
  src/lib/compare/diff.test.ts src/lib/share-positions.test.ts \
  src/islands/MoonPhaseTool.reference.test.ts src/lib/scene/scene.test.ts \
  scripts/deltat-install-guard.test.mjs
```

`measure.mjs` unpacks the immutable rc.15 and rc.16 archives into temporary
folders, then bundles each with the same current site adapters, transit
scanner, comparison and scene code. Separate bundles isolate the ephemeris
clock/cache state. Their versions and archive SHA-256 digests are recorded in
`measurements.json`. It makes no network calls and reads no Swiss, holdout or
DE440 reference outputs.

At each relevant TT, the tool measures full IAU 2000B minus astronomy-engine's
five-term nutation. It checks body-longitude changes against Δψ and speed
changes against the same correction's finite difference, with the engine's
unchanged sampling intervals and denominator. Angles are reconstructed with
`computeAngles` from the old and new obliquity/equation of equinoxes. This is
source attribution between engine versions, not an independent astronomical
accuracy verdict.

## Changes and causes

- **Transit scanner:** the second crossing of the unchanged target
  352.56407473871195° moves from 09:26:10.066 to 09:26:34.570 on
  2026-02-26. Nearest-minute output is therefore 09:27. The synthetic
  ten-seconds-after-station input moves to 06:47:23.924, restoring the
  original >10,000 ms pair-separation gate (measured 20,008 ms). The
  near-tangent witness is reset to the largest longitude sampled at 1 ms
  steps over 06:47:13–15: 06:47:13.947, giving two roots 998 ms apart.
  Both count/order gates and the >100 ms gate are unchanged. The numerical
  ±0.001-day speed zero moves by 6.107 seconds; this differs from the WIP
  handoff's approximate 5.94-second figure. A sampled longitude extremum
  and a finite-difference speed zero are distinct numerical witnesses.
- **Saturn direction:** the same ±0.001-day speed zero moves from
  19:57:45.828 to 19:53:14.040 on 2026-07-26. Its speed change at the old
  zero is −0.000005363603°/day, explained by the derivative of Δψ. Test
  instants now straddle the new zero by ten seconds. Earlier-version
  agreement witnesses remain, and the new two instants also explicitly
  agree with the chart. This is a numerical-model station, not a claimed
  independently certified station time.
- **Comparison rounding:** rc.16 shifts the baseline rounding boundaries.
  At +2 ms the Moon's 3.09815e−7° change prints differently while the
  node's 5.09233e−7° change does not. The no-distance-threshold assertion
  remains. Under a same-value ΔT pin, only the Moon's speed crosses the
  sixth decimal; both Sun speeds now print 0.955127. The relative-speed
  gate is unchanged.
- **Comparison receipts:** two added synthetic tests require the current
  convention set at index 0 to name full IAU 2000B and the `GeoMoon`
  reduction, and verify that the comparison explicitly identifies both
  differences from a parser-accepted rc.15-convention record. The latter
  is a conventions-only fixture with deliberately unchanged numbers.
- **Shared-position region helper:** the old helper still used five-term
  GAST and obliquity. It now substitutes the full equation of equinoxes
  and true obliquity while retaining the sidereal polynomial and clock.
  Across the same 435 seeded cases, maximum angle mismatch falls from
  0.000199453531° to 4.55e−13°. The existing 1e−6° matching gate, geographic
  floors and Arctic-strip checks are unchanged and pass.
- **Moon phase:** at 2024-01-16 10:18 UTC, Moon and Sun both move by
  +0.0514465034″. Only the Moon longitude pin changes, to
  3.271515249695085°. Their angular separation is bit-identical, so the
  illumination, category and phase-angle pins remain unchanged.
- **Scene snapshot:** for the existing fixed 1907 example, all body
  longitudes shift by +0.0739716509″. Speeds follow Δψ's derivative;
  angles follow full obliquity and GAST. The tool recursively checks the
  entire seven-decimal scene: only 49 numeric fields (anchor, angles,
  body longitude/draw longitude/sign degree/speed) plus engine version
  differ across archives. The committed snapshot already named rc.16,
  so its refresh changes only those 49 numerical values. Structure,
  signs, houses, occupants, aspects, applying flags, dignity and layout
  rules stay identical.

## Verification

- **7 files, 165 tests pass**, including the six owned suites and the
  astronomy-engine clock-install guard; see `focused-tests.log`
- Existing test tolerances and numerical gates were not weakened
- Maximum longitude attribution residual in the scene/rounding sample is
  3.41e−13°; maximum speed residual is 4.35e−11°/day
- `measurements.json` reproduced byte-for-byte on a second fresh run
- `git diff --check` passes for the changed regression files
- Full-suite/build/adoption verification belongs to the parent integration;
  this focused result alone does not assert those gates pass
