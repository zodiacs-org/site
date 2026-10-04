# The co-ascendants end to end against Swiss Ephemeris, 2026-10-04

Engine 0.1.1-rc.16, the archive the site vendors
(`vendor/zodiacs-engine-0.1.1-rc.16.tgz`, SHA-256 `43a72d30…15d8`, the npm
tarball's bytes), against Swiss Ephemeris 2.10.03 (pyswisseph 2.10.03) as an
instrument. Nothing Swiss computed is committed: `results/` holds statistics,
and the one worst case keeps its instant, place and differences.

## Why

The ledger's gate for `P2.A.houses.co-ascendants` is "vs Swiss houses_ex
ascmc". Its source, version 1's M5 houses item, holds the house functions and
the points beside them to 0.01″ of Swiss given its inputs and to 3″ end to end
on the 55°–66.6° ladder. The engine's rc.16 evidence measured the first half:
gate A of engine `docs/evidence/houses-extra-2026-09-29/` compared the
equatorial ascendant, Koch's and Munkasey's co-ascendants and Munkasey's polar
ascendant with `swe_houses_armc` given the same RAMC, latitude and obliquity,
on 25,616 cases, and the largest difference was 0.0000000047″. This record
measures the second half, from an instant and a place, as
[`PREREGISTRATION.md`](PREREGISTRATION.md) fixed it before any tool was
written.

## Method

`tools/dump-end-to-end.mjs` asks the engine's `houses()` (`@zodiacs/engine/calc`)
for its own RAMC, true obliquity and the instant's UT1 Julian day, and gives
the RAMC and obliquity to `coAscendants()` (`@zodiacs/engine/houses`), as a
caller does. `tools/compare-end-to-end.py` asks Swiss's `swe_houses_ex` for
`ascmc[4]` to `ascmc[7]` at the engine's UT1 Julian day, so both programs read
the same instant as UT1.

- **The ladder:** 55°–66.6° every 0.2°, both hemispheres, six instants each
  (708 cases).
- **Broad:** 3,000 draws within 66° of the equator.

Instants run from 1800 to 2199. The gate is judged on the ladder from 1850 to
2049, the window the house systems and the points were judged in. No case was
refused and every value was finite.

## Results

From 1850 to 2049 (`results/end-to-end.json`), in arcseconds:

| | Ladder, largest | Ladder, 95th percentile | Broad, largest |
| --- | ---: | ---: | ---: |
| Equatorial ascendant | 0.0013 | 0.00086 | 0.0016 |
| Koch's co-ascendant | 0.020 | 0.0027 | 0.013 |
| Munkasey's co-ascendant | 0.0018 | 0.00090 | 0.017 |
| Munkasey's polar ascendant | 0.020 | 0.0027 | 0.013 |

The two programs' inputs agree closely too. In this window the largest
difference of the engine's RAMC from Swiss's `ascmc[2]` is 0.0015″, and of its
true obliquity from Swiss's 0.0011″.

The largest ladder difference is at 1850-06-03T06:52:51.708Z, 66° N,
100.197° E (`results/worst-case.json`): 0.020″ for Koch's co-ascendant and the
polar ascendant. Given Swiss's own RAMC and obliquity there, the engine's four
points equal Swiss's exactly, so the 0.020″ is the inputs' difference,
magnified by the ascendant's sensitivity near the polar circle.

**End to end, 1850–2049: PASS, every point within 0.021″ of Swiss on the
ladder.** With gate A's pass given Swiss's inputs, the co-ascendants and the
polar ascendant meet M5's rule.

Outside 1850–2049 the inputs drift apart: the RAMC differs by up to 1.9″, and
on the ladder Koch's co-ascendant and the polar ascendant reach 63″ (22 of 708
cases over 3″); broad, Munkasey's co-ascendant reaches 84″. As
[`../houses-2026-09-26/`](../houses-2026-09-26/README.md) found, Swiss
switches to a long-term sidereal time outside 1850–2050, so no point is judged
against Swiss there.

## Rerun

`tools/run-all.sh` reruns the comparison from the site root after `npm ci`.
It needs `python3` with pyswisseph 2.10.03 and no ephemeris file. It writes
`results/` and a scratch directory only. A second run on 2026-10-04 reproduced
both result files byte for byte.
