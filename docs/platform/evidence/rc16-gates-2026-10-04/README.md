# Engine rc.16's capability gates, 2026-10-04

Nine units of the acceptance ledger first shipped in `@zodiacs/engine`
0.1.1-rc.16. The trusted publisher put it on npm under `next` on 2026-10-01
with SLSA provenance, from release source
[`ddbbaa0`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726).
The archive the site vendors, `43a72d30…15d8`, is the npm tarball's bytes.
Until this record the ledger recorded none of the nine. Each is judged here
against its gate as the ledger words it, from the engine's evidence at the
release commit and from three measurements made on the site's side:
[`../co-ascendants-2026-10-04/`](../co-ascendants-2026-10-04/README.md),
[`../houses-2026-10-04/`](../houses-2026-10-04/README.md) and the round-trip
replay below.

| Unit | Weight | Gate | Verdict |
| --- | ---: | --- | --- |
| B2.a, birth-time window partition | 4 | switch instants agree with dense 1 s sampling on 1,000 random windows, zero missed | **met** |
| P2.D.frames, frames, distances and speeds through the uniform API | 2 | round-trip fixtures; vs an independent pyerfa chain | **met** |
| P2.A.houses.co-ascendants | 0.25 | vs Swiss houses_ex ascmc | **met** |
| P3.2, uniform calculation API | 3 | `.d.ts` covers every `calc_ut` option Phase 2 ships; round-trip fixtures; typed refusals | partial: the sidereal zodiac is typed but refused |
| P2.A.timing.planetary-returns | 0.75 | cited worked examples; completeness verdict | partial: no cited example beyond the Sun |
| P2.A.houses.position | 0.75 | vs Swiss house_pos on a grid | failed: Porphyry and Topocentric |
| P2.A.houses.cusp-speeds | 0.75 | vs Swiss houses_ex2 speeds | failed: five systems |
| P2.A.rise-set | 1.5 | ≤ 5 s from Swiss rise_trans and a first-principles computation on a site grid; USNO ±30 s check | failed: 192 events over 5 s, 2 over 30 s |
| P2.A.timing.planetary-hours | 0.75 | cited worked examples; sunrise/sunset per rise-set rule | failed: its sunrises and sunsets are the rise/set function's, which fails |

The house-system rerun on rc.16 also settles one unit recorded before:
**P2.A.house.koch** (0.2), failed end to end on rc.9, now meets its gate
(below).

## How the engine's evidence carries to the release

The engine measured several gates on the build of `704cadc`, the integrated
rc.16 candidate. From there to the release, `ddbbaa0`, the source changes are
a regenerated bounds table (`src/calc-bounds.ts`), a receipt conventions set
that names the nutation and the Moon's series (`src/receipt.ts`), the version
string, comments in `src/window.ts`, fixtures and tests. No position, frame,
window, house, sky or timing code changed. Each engine record below says which
build it ran on.

## B2.a: met

Engine
[`docs/evidence/birth-window/`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/evidence/birth-window):
the preregistration (committed `d1000e66` before the run), the first run on
the branch (`RESULTS.md`, PASS), and the rerun on rc.16's build, unchanged in
method (`rc16/README.md`, `rc16/summary.json`):

- 1,000 of 1,000 windows pass;
- 12,259,372 whole-second samples hold 24,188 transitions, and every one
  falls in the same second as a reported change: 0 missed, 0 extra;
- 0 cell disagreements and 0 searches that threw;
- 1,487,520 millisecond checks at the reported switches, 0 failures;
- no window flagged `bound-exceeded` or `node-unresolved`; 41 flagged
  `polar-fallback`.

It ships as `birthWindow` in `@zodiacs/engine/window`. Two limits stay: near
the true node's ingresses a window can leave a stretch unresolved, flagged
`node-unresolved` with the node's cells null (none of the 1,000 did), and
neither the site nor the hosted compute API calls it yet.

## P2.D.frames: met

- **Against pyerfa.** Engine
  [`docs/evidence/calc-api/`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/evidence/calc-api)
  (preregistration, then `rc16/README.md` on rc.16's build): the twelve
  frame-transform checks against an independent ERFA chain (pyerfa 2.0.1.5,
  ERFA 2.0.1) built from JPL Horizons's ICRF vectors all pass. The four that
  pass through the nutation are within 0.0023″ (tolerance 0.005″), which is
  IAU 2000B's own difference from IAU 2000A. The other angles agree within
  0.0000007″, and cartesian against spherical distances to 4.4 × 10⁻¹⁶.
- **Round trip.** `tools/replay-calc-roundtrip.mjs` replays the engine's
  fixture file `src/fixtures/calc-roundtrip.json` (SHA-256 `b56ba1cf…e874`,
  the same at the release and at engine `main` `23660f5`) against the
  vendored rc.16 archive: 25 cases (22 `calc`, 1 `houses`, 2 `events`) in all
  eight frames, from four centres, with three corrections, and nine typed
  refusals of four kinds. Every result, and each of the 16 receipts' requests
  replayed, equals the fixture exactly: worst relative difference 0
  (`results/calc-roundtrip-replay.json`).

The positions themselves are bounded per body and frame against Horizons
(median 3.00″, largest 24.6″, geocentric and apparent); that is the
ephemeris's accuracy, which other units judge.

The unit depends on P3.2, which stays partial (below). The brief asks for these
outputs through the uniform API, and they go through `calc()`, released. The
clause P3.2 misses is the sidereal option, which none of these outputs uses.

## P2.A.houses.co-ascendants: met

Given Swiss's inputs, engine gate A (`houses-extra-2026-09-29`, rerun on
rc.16's build): the four points within 0.0000000047″ of `swe_houses_armc`'s
`ascmc[4..7]` on 25,616 cases. End to end, from an instant and a place
([`../co-ascendants-2026-10-04/`](../co-ascendants-2026-10-04/README.md),
preregistered here): within 0.021″ of `swe_houses_ex` on the 55°–66.6° ladder
from 1850 to 2049, where M5's rule allows 3″. It ships as `coAscendants` in
`@zodiacs/engine/houses`.

## P2.A.house.koch: met on rc.16

[`../houses-2026-10-04/`](../houses-2026-10-04/README.md): within 0.000000005″
of Swiss given its inputs, polar status agreeing in every case, and within
0.035″ end to end on the ladder from 1850 to 2049, where rc.9 was 3.73″ in 1
of 353 cases. The site and the MCP adapter 0.1.0-rc.16 run rc.16, and the
adapter offers Koch.

## P3.2: partial

`@zodiacs/engine/calc` types `calc()`, `houses()`, `events()` and `chart()`;
its refusals are typed; its round-trip fixtures replay (above). The gate's
first clause is not met. The engine's own map of Swiss's `calc_ut` flags
([`docs/calc.md`](https://github.com/zodiacs-org/engine/blob/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/calc.md),
*Swiss Ephemeris `calc_ut` flags*) gives `SEFLG_SIDEREAL` as "typed in,
refused: `not-in-this-version`". Phase 2 ships the sidereal zodiac:
`@zodiacs/engine/vedic` gives sidereal longitudes on its ayanamsas, and the
nakshatra and dasha units are accepted on them (the ayanamsa unit itself fails
its accuracy gate). So the `.d.ts` names the option and `calc()` refuses it.

## P2.A.timing.planetary-returns: partial

Engine gate R (`houses-extra-2026-09-29`, rerun on rc.16's build): every
result carries its completeness verdict, `complete`; for each of the ten
bodies the returns match JPL Horizons's crossings in number and direction,
each within the body's tolerance; and for an invented native born at the March
equinox of 2000, four solar returns fall within 50 s of USNO's published March
equinoxes of 2001 to 2004 (210 s allowed). The completeness half is met. The
worked examples are not: the Horizons fixtures are computed, not cited, and
only the Sun has a published reference.

## P2.A.houses.position: failed

Engine gate P against `swe_house_pos` at 0.01″, on the ladder and 20,000 broad
draws: 11 of 13 systems pass. Porphyry fails in 11 broad cases (up to 0.0507″).
Topocentric fails in 444 ladder and 301 broad cases (up to 0.465″), and is
undefined in the engine alone in 519 and 979.

## P2.A.houses.cusp-speeds: failed

Engine gate S against `swe_houses_armc_ex2` at 0.004° a day plus one part in a
million: the ascendant, the midheaven and eight systems pass; Koch, Placidus,
Porphyry, whole sign and Alcabitius fail. Gate F, against a central difference
of the engine's own cusps, passes for every system (largest 0.000348° a day),
and the engine's record finds Swiss's speeds disagreeing with a central
difference of Swiss's own cusps in the same values. The ledger's gate names
Swiss's speeds, so it is recorded as failing. Whether to judge the speeds
against a derivative instead is a gate change, which this record does not
make.

## P2.A.rise-set: failed

Engine
[`docs/evidence/sky-chinese-2026-09-29/rc16/`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/evidence/sky-chinese-2026-09-29/rc16),
on rc.16's build:

- Against skyfield with DE440s, a first-principles computation: 192 of 189,491
  events over 5 s, the largest 11.603 s.
- Against Swiss's `rise_trans`: the same 192 of 188,982 events over 5 s, the
  largest 11.609 s.
- All 192 are rises and sets of Uranus in 1950 at 65° N and 65° S, where the
  engine's Uranus is 15″ to 18″ of altitude from DE440s at a grazing
  crossing.
- Against USNO, 30 s allowed: 2 of 467 events over, the Moon's rise at
  34.60° S on 1950-03-20 (−30.058 s) and the Sun's set there on 2024-06-21
  (−30.149 s).

## P2.A.timing.planetary-hours: failed

The worked examples are cited and pass (`src/sky/hours.test.ts`): Chaucer's
*Treatise on the Astrolabe* II.12, Skeat's notes to II.7–10, Heindel (1919),
pp. 155–156, and Cassius Dio 37.19. The hours divide the rise/set function's
sunrises and sunsets exactly: on 9,504 dates, 227,880 hours, 0 failures at
1 ms. But the gate takes sunrise and sunset per the rise-set rule, and the
rise/set function fails its gate, one of its USNO failures being a sunset. The
unit is recorded as failing until rise and set pass.

## Rerun

From the site root after `npm ci`, with an engine checkout at `ddbbaa0` or
`23660f5`:

```sh
node docs/platform/evidence/rc16-gates-2026-10-04/tools/replay-calc-roundtrip.mjs \
  <engine checkout>/src/fixtures/calc-roundtrip.json \
  > docs/platform/evidence/rc16-gates-2026-10-04/results/calc-roundtrip-replay.json
```

The tool refuses a fixture whose SHA-256 differs and writes counts only.
