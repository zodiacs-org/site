# The co-ascendants end to end against Swiss Ephemeris, 2026-10-04

Engine 0.1.1-rc.16, the archive the site vendors
(`vendor/zodiacs-engine-0.1.1-rc.16.tgz`, SHA-256 `43a72d30…15d8`, the npm
tarball's bytes), against Swiss Ephemeris 2.10.03 (pyswisseph 2.10.03) as an
instrument. Nothing Swiss computed is committed: `results/` holds statistics,
and the one worst case keeps its instant, place and differences.

**Verdict for the ledger: validated, not accepted.** The four points meet the
preregistered criterion, but only with a clock reading and a window that need
the owner's ratification. Both are explained under
[*What this record does not settle*](#what-this-record-does-not-settle).

## Why

The ledger's gate for `P2.A.houses.co-ascendants` is "vs Swiss houses_ex
ascmc". Its source, version 1's M5 houses item, holds the house functions and
the points beside them to 0.01″ of Swiss given its inputs and to 3″ end to end
on the 55°–66.6° ladder. The engine's rc.16 evidence measured the first half:
gate A of engine `docs/evidence/houses-extra-2026-09-29/` compared the
equatorial ascendant, Koch's and Munkasey's co-ascendants and Munkasey's polar
ascendant with `swe_houses_armc` given the same RAMC, latitude and obliquity,
on 25,616 cases, and the largest difference was 4.71 × 10⁻⁹″. This record
measures the second half, from an instant and a place, by the method
[`PREREGISTRATION.md`](PREREGISTRATION.md) fixed before its tools were
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

Instants run from 1800 to 2199. The criterion is judged on the ladder from
1850 to 2049, the window the house systems and the points were judged in. No
case was refused and every value was finite.

## Results

From 1850 to 2049 (`results/end-to-end.json`), in arcseconds:

| | Ladder, largest | Ladder, 95th percentile | Broad, largest |
| --- | ---: | ---: | ---: |
| Equatorial ascendant | 0.0013 | 0.00086 | 0.0016 |
| Koch's co-ascendant | 0.020 | 0.0027 | 0.013 |
| Munkasey's co-ascendant | 0.0018 | 0.00090 | 0.017 |
| Munkasey's polar ascendant | 0.020 | 0.0027 | 0.013 |

Koch's co-ascendant and the polar ascendant are opposite points by definition,
so their differences are the same. The two programs' inputs agree closely too:
in this window the engine's RAMC is within 0.0016″ of Swiss's `ascmc[2]`, and
its true obliquity within 0.0011″ of Swiss's.

The largest ladder difference is at 1850-06-03T06:52:51.708Z, 66° N,
100.197° E (`results/worst-case.json`): 0.020″ for Koch's co-ascendant and the
polar ascendant. Given Swiss's own RAMC and obliquity there, the engine's four
points equal Swiss's exactly, so the 0.020″ is the inputs' difference,
magnified by the ascendant's sensitivity near the polar circle.

**The preregistered criterion holds: from 1850 to 2049 every point is within
0.021″ of Swiss on the ladder,** with both programs given the same UT1.

Outside 1850–2049 the inputs drift apart: the RAMC differs by up to 1.91″, and
on the ladder Koch's co-ascendant and the polar ascendant reach 63″ (22 of the
389 ladder cases outside the window over 3″); broad, Munkasey's co-ascendant
reaches 84″. As
[`../houses-2026-09-26/`](../houses-2026-09-26/README.md) found, Swiss
switches to a long-term sidereal time outside 1850–2050, so no point is judged
against Swiss there.

## What this record does not settle

Added after two independent reviews of this record, before it was merged.

**An earlier comparison.** About three hours before
`PREREGISTRATION.md` was written, a scratch comparison made while judging
rc.16's gates compared the four points with `swe_houses_ex` on 400 cases from
1900 to 2100, latitudes up to 66°, Swiss given the engine's UT1. By era it
printed Munkasey's co-ascendant within 0.0086″ of Swiss and the two RAMCs
within 0.00091″ before 2050, and 6.07″ and 1.91″ from 2050 to 2100. Over all
400 cases the largest differences were 6.07″ (Munkasey's co-ascendant), 4.28″
(Koch's and the polar ascendant) and 2.05″ (the equatorial ascendant). Its
scripts stayed in the session's scratch directory, outside the repository;
rerunning them reproduces every figure quoted here, as an independent review
did. `PREREGISTRATION.md` says that the end-to-end
half "has not been measured", which was not true of that comparison. The
window it then fixed, 1850–2049, is the one the house systems and points were
judged in, but it was chosen with those numbers known.

**The clock reading.** `PREREGISTRATION.md` gives Swiss the engine's UT1
Julian day. Since rc.15 the engine reads a UTC instant through the IERS tables'
UT1 − UTC; Swiss's `swe_houses_ex` reads whatever Julian day it is given as
UT1. `tools/compare-clock-readings.py` (`results/clock-readings.json`, not
preregistered, not judged) compares the same engine values from 1850 to 2049
under three readings:

| Swiss is given | Ladder cases over 3″ (of 319) | Ladder, largest | Largest RAMC difference |
| --- | ---: | ---: | ---: |
| the engine's UT1 Julian day (preregistered) | 0 | 0.02002″ | 0.001404″ |
| the UTC instant's Julian day, read as UT1, as the rc.9 houses record's tool did | 40 to 48, by point | 88.51″ | 11.66″ |
| the UT1 of Swiss's own `swe_utc_to_jd` | 13 | 14.61″ | 14.87″ |

On 2026-10-01 the rc.16 accuracy refresh
([`../site-engine-rc16/accuracy-refresh/`](../site-engine-rc16/accuracy-refresh/README.md))
measured the house systems both ways, and the site's rc.16 record kept Koch
failed: "an aligned-clock pass does not substitute for the original failed
comparison". The reading used here was chosen with that record on main.

**What follows.** The programme's rule is that a gate that passes only under a
change adopted after its residual was seen counts as validated, not accepted,
until the owner ratifies the change (`docs/platform/programme/README.md`,
*Status and release*). Both the clock reading and the window were chosen with
residuals known, so the ledger records this unit as **validated**, pending the
owner's decision (FINDINGS F-71):

- whether an end-to-end comparison with an engine that reads UTC through
  UT1 − UTC gives Swiss the engine's UT1 Julian day; and
- whether the 1850–2049 window, where Swiss's sidereal time is the IAU one,
  applies to these points as it does to the house systems.

If the owner ratifies both, the unit meets its gate on this record as it
stands. If not, it fails as measured above.

## Commits

The preregistration (author time 2026-10-04T15:48:49Z) was committed before
the tools and the run (15:51:11Z). Rebasing onto main `67aa32d8` set both
commits' committer time to 17:53:01Z and changed no content.

## Rerun

`tools/run-all.sh` reruns the comparison from the site root after `npm ci`.
It needs `python3` with pyswisseph 2.10.03 and no ephemeris file. It writes
`results/` and a scratch directory only. A second run on 2026-10-04 reproduced
both preregistered result files byte for byte, and an independent review
reproduced them again in its own worktree. `results/clock-readings.json` comes
from the same run, from the step added after review.
