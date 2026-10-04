# Preregistration: the co-ascendants end to end against Swiss Ephemeris

Written 2026-10-04 on the site branch `next-gates`, made from main at
`9d7dd31d`. It is committed before the tools below are written and before any
measurement is run, and it is not edited after a measurement. A failure is
recorded as a failure, with its numbers; no grid, tolerance or criterion below
changes after a result is seen.

## Why this measurement

The acceptance ledger's unit `P2.A.houses.co-ascendants` (weight 0.25) has
the gate "vs Swiss houses_ex ascmc". Its source is version 1's M5 houses item
("Vertex/East Point/co-ascendants"). For the house functions and the points
beside them, M5's rule is: within 0.01″ of Swiss given its inputs, and within
3″ end to end on the 55°–66.6° ladder. The house systems are held to that
rule, and the Vertex and East Point unit states it.

The engine's evidence for rc.16 measured the first half only. Its gate A
(engine `docs/evidence/houses-extra-2026-09-29/`, rerun on rc.16's build)
compared the four points with `swe_houses_armc` given the same RAMC, latitude
and obliquity, and passed; the largest difference was 0.0000000047″.
`swe_houses_armc` takes those three as inputs. `swe_houses_ex` computes them
from an instant and a place, as a caller of the engine does. That second half,
end to end, has not been measured, and this record measures it.

## Instrument

- **Swiss Ephemeris 2.10.03** (pyswisseph 2.10.03), as a comparison
  instrument only. Its values stay in memory. The committed files hold
  statistics and, for the one worst case, its inputs and differences; never a
  value Swiss computed. No test expectation comes from it.
- `swe.houses_ex(jd_ut, latitude, longitude, b'E')`, `ascmc[4]` to `ascmc[7]`:
  the equatorial ascendant, Walter Koch's co-ascendant, Michael Munkasey's
  co-ascendant and Munkasey's polar ascendant. The house system does not
  enter these four points, and no ephemeris file is needed.

## Engine

- The released archive the site vendors,
  `vendor/zodiacs-engine-0.1.1-rc.16.tgz`, SHA-256
  `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`.
- For each case, `houses({ time, place: { latitude, longitude }, system:
  'equal' })` from `@zodiacs/engine/calc` gives the engine's own `armc` and
  true `obliquity`, and its receipt the instant's UT1 Julian day, `jdUt1`.
  `coAscendants({ gastHours: armc / 15, longitude: 0, latitude, obliquity })`
  from `@zodiacs/engine/houses` gives the four points. That is the path a
  caller takes from an instant; the package has no single call for it. Equal
  houses are asked for because they are defined at every latitude; the house
  system enters neither `armc`, `obliquity` nor the points.
- Swiss receives the engine's `jdUt1`, so both programs read the same instant
  as UT1.

## Cases

Instants and longitudes come from the linear congruential generator of
`points-2026-09-26/tools/dump-end-to-end.mjs`, with seed 20261004. Instants
are uniform over the engine's calculation span, 1800-01-01 to 2200-01-01 UTC,
to the millisecond; longitudes are uniform in [−180°, 180°). Drawn in this
order:

- **Broad:** 3,000 cases, latitude uniform in [−66°, 66°].
- **Ladder:** every 0.2° of latitude from 55° to 66.6° (59 latitudes), north
  then south, six instants each: 708 cases.

## Metric

For each point, the angular difference across the 0°/360° seam, in arcseconds.
A value that is not finite on either side, or a refusal by the engine, fails
its case.

## Windows

**1850–2049**, by the UTC year of the instant: the window in which the house
systems and the points were judged end to end (`houses-2026-09-26`,
`points-2026-09-26`). **1800–2199**, the whole span, is reported.

## Gate

**Pass:** on the ladder, every case from 1850 to 2049 has all four points
within 3″ of Swiss. Otherwise the gate fails, with the count over 3″ and the
largest difference for each point. The broad set and 1800–2199 are reported
and not judged, as in `points-2026-09-26`.

## Reported

- For each point, set and window: the cases compared, the median, the 95th
  percentile, the largest difference and the count over 3″.
- Diagnostics, not judged, for each set and window: the largest difference of
  the engine's `armc` from Swiss's `ascmc[2]`, and of its obliquity from
  Swiss's true obliquity (`swe.calc_ut(jd_ut, swe.ECL_NUT)`).
- The worst ladder case from 1850 to 2049: its instant and place, its four
  differences, and the four differences again with the engine's
  `coAscendants` fed Swiss's own ARMC and true obliquity, as
  `points-2026-09-26/tools/worst-vertex.*` did for the Vertex. That shows
  whether a difference lies in the inputs or in the points.

## Files

`tools/` will hold the engine side (it writes engine values only, to a scratch
directory), the Swiss side (it prints statistics only), the worst-case
diagnostic and a script that reruns them all. `results/` will hold the
statistics and the worst case. `README.md` will give the verdict.
