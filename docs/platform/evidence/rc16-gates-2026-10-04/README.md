# Engine rc.16's capability gates, 2026-10-04

Nine units of the acceptance ledger first shipped in `@zodiacs/engine`
0.1.1-rc.16. The trusted publisher put it on npm under `next` on 2026-10-01
with SLSA provenance built from
[`6807f632`](https://github.com/zodiacs-org/engine/commit/6807f632fc5aad08999d97f61e50793c6ca9a0b4),
the merge of engine #22, whose package source (`src/`, `package.json`) is the
release source,
[`ddbbaa0`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726).
The archive the site vendors, `43a72d30…15d8`, is the npm tarball's bytes.
Before this record the ledger had B2.a and P2.D.frames as partial, on the
site's Moon-sign candidates and rc.11's equatorial coordinates, and the other
seven as not started. Each is judged here against its gate as the ledger words
it, from the engine's evidence at the release commit and from three
measurements made on the site's side:
[`../co-ascendants-2026-10-04/`](../co-ascendants-2026-10-04/README.md),
[`../houses-2026-10-04/`](../houses-2026-10-04/README.md) and the round-trip
replay below. Two related units are judged with them: B2.c, the record of the
birth-time window rule, and Koch, which failed on rc.9.

| Unit | Weight | Gate | Verdict |
| --- | ---: | --- | --- |
| B2.a, birth-time window partition | 4 | switch instants agree with dense 1 s sampling on 1,000 random windows, zero missed | **met** |
| B2.c, the B2 rule run recorded | 1 | the 1,000-window rule recorded as PASS/FAIL | **met** |
| P2.D.frames, frames, distances and speeds through the uniform API | 2 | round-trip fixtures; vs an independent pyerfa chain | **met** |
| P2.A.houses.co-ascendants | 0.25 | vs Swiss houses_ex ascmc | validated: met only with a clock reading and a window chosen after residuals were seen, which the owner has to ratify |
| P2.A.house.koch | 0.2 | ≤ 0.01″ given Swiss's inputs and ≤ 3″ end to end on the ladder; polar status; released and adopted | validated: end to end only with the same clock reading |
| P3.2, uniform calculation API | 3 | `.d.ts` covers every `calc_ut` option Phase 2 ships; round-trip fixtures; typed refusals | partial: the sidereal zodiac is typed but refused, and user-defined ayanamsas are not typed |
| P2.A.timing.planetary-returns | 0.75 | cited worked examples; completeness verdict | partial: no cited worked example |
| P2.A.houses.position | 0.75 | vs Swiss house_pos on a grid | failed as worded: Porphyry and Topocentric, where Swiss's own positions are off the exact ones |
| P2.A.houses.cusp-speeds | 0.75 | vs Swiss houses_ex2 speeds | failed as worded: five systems, where Swiss's speeds disagree with its own cusps |
| P2.A.rise-set | 1.5 | ≤ 5 s from Swiss rise_trans and a first-principles computation on a site grid; USNO ±30 s check | failed: 192 events of Uranus over 5 s, 2 events over USNO's 30 s |
| P2.A.timing.planetary-hours | 0.75 | cited worked examples; sunrise/sunset per rise-set rule | failed: one of its sunsets misses USNO by 30.149 s |

**Release state.** For an engine capability the ledger needs an engine
candidate the site vendors and production serves
(`docs/platform/programme/README.md`, *Status and release*). Production
`dpl_Av6FTWYa2iFZzT2WZuWeCsRDg2oV` (ready 2026-10-04T17:54:58Z, aliased to
zodiacs.org) serves site `67aa32d8`, which vendors rc.16, so every engine unit
above is recorded `deployed`, whatever its verdict; B2.c, a record, is
`merged` (below). Most of these entry points are vendored and served but not
called by the site: nothing in `src/` or `api/` imports
`@zodiacs/engine/window`, `/calc` or `coAscendants`. That is the release state
the ledger asks of an engine capability, and the ledger records other
capabilities the site does not call, such as profections, the same way.

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
the preregistration, committed in
[`d03f60c0`](https://github.com/zodiacs-org/engine/commit/d03f60c0f69d4dd4e7dc722876fd704b6cfde665)
(2026-09-28T17:29:42Z) before the run; the first run's PASS in `RESULTS.md`,
committed in
[`09f8aa18`](https://github.com/zodiacs-org/engine/commit/09f8aa1813551bd8a9b61ff0e16b0135fc44aebf)
(19:10:39Z); and the rerun on rc.16's build, unchanged in method
(`rc16/README.md`, `rc16/summary.json`). `RESULTS.md` names the
preregistration and the measured build as `d1000e66` and `670db8a6`, hashes
from before the branch was rebased, which are in no published history (FINDINGS
F-73). The rerun on `704cadc` stands on its own:

- 1,000 of 1,000 windows pass;
- 12,259,372 whole-second samples hold 24,188 transitions, and every one
  falls in the same second as a reported change: 0 missed, 0 extra;
- 0 cell disagreements and 0 searches that threw;
- 1,487,520 millisecond checks at the reported switches, 0 failures;
- no window flagged `bound-exceeded` or `node-unresolved`; 41 flagged
  `polar-fallback`.

It ships as `birthWindow` in `@zodiacs/engine/window`. The unit's title says
"in the engine/API". This record reads that as the engine's own interface, as
the programme's handoff of 2026-09-30 did when it listed B2.a among "the calc,
window, houses and sky capabilities" the rc.16 adoption makes eligible. The
brief's first slice also asks for the windows "in the birth chart tool and the
API": the tool is B2.b, and neither the tool nor the hosted compute API offers
windows yet. Near the true node's ingresses a window can leave a stretch
unresolved, flagged `node-unresolved` with the node's cells null; none of the
1,000 did.

## B2.c: met

The gate asks for the 1,000-window rule recorded as PASS or FAIL. The engine's
`RESULTS.md` records it as PASS, after a preregistration committed before the
run, and `rc16/README.md` records it again as PASS on rc.16's build, with the
counts above in `rc16/summary.json`. The records are on the engine's `main`
(`23660f5`). The unit is recorded `merged`, as the ledger records the other
records it accepts, such as the conformance suite and the time atlas's first
slice.

## P2.D.frames: met

- **Against pyerfa.** Engine
  [`docs/evidence/calc-api/`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/evidence/calc-api)
  (preregistration, then `rc16/README.md` on rc.16's build): the twelve
  frame-transform checks of its part (a) all pass. Each turns the engine's own
  output with ERFA (pyerfa 2.0.1.5, ERFA 2.0.1) and compares it with the
  engine's output in another frame. The four that pass through the nutation
  agree within 0.0023″ (tolerance 0.005″), IAU 2000B's own difference from
  IAU 2000A. The other angles agree within 0.0000007″, and cartesian against
  spherical distances to 4.4 × 10⁻¹⁶. Its part (b), the positions against
  ERFA frames built from JPL Horizons's ICRF vectors, sets bounds rather than
  a pass: median 3.00″, largest 24.6″, geocentric and apparent. That is the
  ephemeris's accuracy, which other units judge.
- **Round trip.** `tools/replay-calc-roundtrip.mjs` replays the engine's
  fixture file `src/fixtures/calc-roundtrip.json` (SHA-256 `b56ba1cf…e874`,
  the same at the release and at engine `main` `23660f5`) against the
  vendored rc.16 archive: 25 cases (22 `calc`, 1 `houses`, 2 `events`) in all
  eight frames, from four centres, with three corrections, and nine typed
  refusals of four kinds. Every result, and each of the 16 receipts' requests
  replayed, equals the fixture exactly: worst relative difference 0
  (`results/calc-roundtrip-replay.json`).

The unit depends on P3.2, which stays partial (below). The brief asks for these
outputs through the uniform API, and they go through `calc()`, released. The
clause P3.2 misses is the sidereal zodiac, which none of these outputs uses.
The ledger's rules do not define `dependsOn`; this is the first accepted unit
whose dependency is not accepted, and the reason is the one given here.

## P2.A.houses.co-ascendants: validated

Given Swiss's inputs, engine gate A (`houses-extra-2026-09-29`, rerun on
rc.16's build): the four points within 0.000000005″ (4.71 × 10⁻⁹″) of
`swe_houses_armc`'s `ascmc[4..7]` on 25,616 cases. End to end, from an instant
and a place
([`../co-ascendants-2026-10-04/`](../co-ascendants-2026-10-04/README.md)): within
0.021″ of `swe_houses_ex` on the 55°–66.6° ladder from 1850 to 2049, where
M5's rule allows 3″, with Swiss given the engine's own UT1 Julian day.

Two choices behind that result were made with residuals known. The window: a
scratch comparison earlier the same day had found differences up to 6.07″
after 2050. The clock reading: with Swiss reading the UTC instant as UT1, as
the rc.9 houses tool did, 40 to 48 of the 319 ladder cases from 1850 to 2049
exceed 3″. Under the programme's rule, a gate that passes only under a change
adopted after its residual was seen is validated until the owner ratifies the
change, so the unit is **validated**, pending the owner's decision (FINDINGS
F-71). It ships as `coAscendants` in `@zodiacs/engine/houses`.

## P2.A.house.koch: validated

[`../houses-2026-10-04/`](../houses-2026-10-04/README.md): within 0.000000005″
of Swiss given its inputs, polar status agreeing in every case, and 0.035″ the
largest difference end to end on the ladder from 1850 to 2049, with Swiss given
the engine's UT1; rc.9 had 3.73″ in 1 of 353 cases. The site and the MCP
adapter 0.1.0-rc.16 run rc.16, and the adapter offers Koch.

The accuracy refresh of 2026-10-01, which had measured the same with the
aligned clock, also measured it with Swiss reading the UTC instant as UT1: 48
of 353 cases over 3″, the largest 82.677″. The site's rc.16 record kept Koch
failed: "an aligned-clock pass does not substitute for the original failed
comparison". Under the same rule as the co-ascendants, Koch is **validated**
until the owner ratifies the shared-UT1 reading (F-71), and fails if the owner
does not.

## P3.2: partial

`@zodiacs/engine/calc` types `calc()`, `houses()`, `events()` and `chart()`;
its refusals are typed; its round-trip fixtures replay (above), though none
exercises `chart()`. The gate's first clause is not met, for two options:

- The engine's own map of Swiss's `calc_ut` flags
  ([`docs/calc.md`](https://github.com/zodiacs-org/engine/blob/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/calc.md),
  *Swiss Ephemeris `calc_ut` flags*) gives `SEFLG_SIDEREAL` as "typed in,
  refused: `not-in-this-version`". Phase 2 ships the sidereal zodiac:
  `@zodiacs/engine/vedic` gives sidereal longitudes on its ayanamsas, and the
  nakshatra and dasha units are accepted on them (the ayanamsa unit itself
  fails its accuracy gate).
- `CalcAyanamsa` in `calc.d.ts` names the nine built-in ayanamsas only.
  `@zodiacs/engine/vedic` also ships `userAyanamsa`, the counterpart of
  Swiss's `SE_SIDM_USER`, which the ayanamsa unit measures.

## P2.A.timing.planetary-returns: partial

Engine gate R (`houses-extra-2026-09-29`, rerun on rc.16's build): every
result carries its completeness verdict, `complete`; for each of the ten
bodies the returns match JPL Horizons's crossings in number and direction,
each within the body's tolerance; and for an invented native born at the March
equinox of 2000, four solar returns fall within 50 s of USNO's published March
equinoxes of 2001 to 2004 (210 s allowed). The completeness half is met. The
worked examples are not: the Horizons fixtures are computed, and the Sun's
check applies a published reference, USNO's equinoxes, to an invented native.
No return is checked against a cited worked example.

## P2.A.houses.position: failed as worded

Engine gate P against `swe_house_pos` at 0.01″, on the ladder and 20,000 broad
draws: 11 of 13 systems pass. Porphyry fails in 11 broad cases (up to 0.0507″).
Topocentric fails in 444 ladder and 301 broad cases (up to 0.465″), and is
undefined in the engine alone in 519 and 979, where no circle of the family
reaches a circumpolar body.

The engine's diagnostics, not preregistered, explain both. Porphyry: the exact
positions of each body's longitude plus 0.001″ reproduce Swiss's to
5 × 10⁻⁹″, and the 11 cases are those whose smaller quadrant is 1.78° to
8.67° wide, where that 0.001″ is magnified. Topocentric: the engine's
positions satisfy the equation of their position circle to 1.13 × 10⁻⁹″;
Swiss's leave a median of 0.00205″ and up to 0.445″. Swiss's positions are
near the exact solution, not on it. Meeting the gate as worded would mean
reproducing those departures, and the brief's third non-negotiable keeps Swiss
an instrument, never a fitting target. This needs a decision on the gate, not
an engine fix.

## P2.A.houses.cusp-speeds: failed as worded

Engine gate S against `swe_houses_armc_ex2` at 0.004° a day plus one part in a
million: the ascendant, the midheaven and eight systems pass; Koch, Placidus,
Porphyry, whole sign and Alcabitius fail. Gate F, against a central difference
of the engine's own cusps, passes for every system (largest 0.000348° a day),
and the engine's record finds Swiss's speeds disagreeing with a central
difference of Swiss's own cusps in the same values. The ledger's gate names
Swiss's speeds, so it is recorded as failing. Whether to judge the speeds
against a derivative instead is a decision on the gate, which this record does
not make.

## P2.A.rise-set: failed

Engine
[`docs/evidence/sky-chinese-2026-09-29/rc16/`](https://github.com/zodiacs-org/engine/tree/ddbbaa0b1d21e16834722f81e8708816849c6726/docs/evidence/sky-chinese-2026-09-29/rc16),
on rc.16's build:

- Against skyfield with DE440s, a first-principles computation: 192 of 189,491
  events over 5 s, the largest 11.603 s.
- Against Swiss's `rise_trans`: the same 192 of 188,982 events over 5 s, the
  largest 11.609 s.
- All 192 are rises and sets of Uranus in 1950 at 65° N and 65° S, where
  astronomy-engine's Uranus is 15″ to 18″ of altitude from DE440s at a grazing
  crossing: a limit of the ephemeris, not of the rise and set search.
- Against USNO, 30 s allowed: 2 of 467 events over, the Moon's rise at
  34.60° S on 1950-03-20 (−30.058 s) and the Sun's set there on 2024-06-21
  (−30.149 s). USNO publishes these times to the minute.

## P2.A.timing.planetary-hours: failed

The worked examples are cited and pass (`src/sky/hours.test.ts`): Chaucer's
*Treatise on the Astrolabe* II.12, Skeat's notes to II.7–10, Heindel (1919),
pp. 155–156, and Cassius Dio 37.19. The hours divide the rise/set function's
sunrises and sunsets exactly: on 9,504 dates, 227,880 hours, 0 failures at
1 ms. The gate takes sunrise and sunset per the rise-set rule. The Sun's
rises and sets meet its 5 s comparisons, but one of its two USNO misses is the
Sun's set at 34.60° S on 2024-06-21, 30.149 s from USNO's. That is the failure
that bears on the hours; the Uranus events do not.

## Rerun

From the site root after `npm ci`, with an engine checkout at `ddbbaa0` or
`23660f5`:

```sh
node docs/platform/evidence/rc16-gates-2026-10-04/tools/replay-calc-roundtrip.mjs \
  <engine checkout>/src/fixtures/calc-roundtrip.json \
  > docs/platform/evidence/rc16-gates-2026-10-04/results/calc-roundtrip-replay.json
```

The tool refuses a fixture whose SHA-256 differs and writes counts only.

## After review

Two independent reviews read this record and its two measurements before they
were merged. Their findings changed it: the co-ascendants and Koch went from
met to validated (F-71), B2.c was judged, the release state became `deployed`,
the pyerfa checks and P3.2's shortfall are described correctly, the
house-position and cusp-speed failures are attributed to what the engine's
diagnostics found, and the citations name published commits.
