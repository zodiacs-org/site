# The house systems against Swiss Ephemeris on rc.16, 2026-10-04

Engine 0.1.1-rc.16, the archive the site and the MCP adapter 0.1.0-rc.16 run
(`vendor/zodiacs-engine-0.1.1-rc.16.tgz`, SHA-256 `43a72d30…15d8`, the npm
tarball's bytes), against Swiss Ephemeris 2.10.03 (pyswisseph 2.10.03) as an
instrument. Nothing Swiss computed is committed: `results/` holds statistics,
and the worst Koch case keeps its instant, place and two differences.

[`PREREGISTRATION.md`](PREREGISTRATION.md) fixed the method before any tool
was written. It reruns the rc.9 record,
[`../houses-2026-09-26/`](../houses-2026-09-26/README.md), with its seeds,
sets, windows and rules, for all thirteen systems, adapted in two ways: Equal-MC
(`D`) is compared, and Swiss's `swe_houses_ex` receives the engine's own UT1
Julian day, since from rc.15 the engine reads a UTC instant through the IERS
tables' UT1 − UTC.

## Given the same inputs

`tools/dump-given.mjs` and `tools/compare-given.py`: the 55°–66.6° ladder every
0.1° at 24 RAMCs (5,616 cases) and 20,000 broad draws (`results/given.json`).
For the twelve systems of the rc.9 record every statistic is the rc.9 record's,
to the digit: Placidus, which iterates, is within 0.0052″ on the ladder and
0.0096″ broad, and every other system within 0.00005″. Equal-MC's largest
difference is 0.0000000004″. Polar status agrees in every case: Placidus and Koch are
undefined on both sides in the same 48 ladder and 5,199 broad cases, and no
case is undefined on one side only.

**Given Swiss's inputs: PASS for all thirteen systems.**

## End to end

`tools/dump-end-to-end.mjs` asks the engine's `houses()` for every system
from a UTC instant and place, which computes the cusps as `natalChart()` does,
and `tools/compare-end-to-end.py` asks Swiss's `swe_houses_ex` at the engine's
UT1 Julian day (`results/end-to-end.json`). The cases are the rc.9 record's:
the ladder, 55°–66.6° every 0.2°, six instants each, both hemispheres (708
cases), and 3,000 broad draws within 66° of the equator, from 1800 to 2199.
No request was refused.

From 1850 to 2049, the largest of the twelve cusps per case:

| System | Ladder, largest | Broad, largest | rc.9's ladder, largest |
| --- | ---: | ---: | ---: |
| Koch | 0.035″ | 0.055″ | 3.73″ (1 of 353 over 3″) |
| Placidus | 0.007″ | 0.024″ | 1.28″ |
| Equal, Vehlow, Porphyry, Regiomontanus, Campanus, Topocentric, Alcabitius | 0.010″ | 0.024″ | 1.28″ |
| Equal-MC, Meridian, Morinus | 0.001″ | 0.002″ | 0.25″ (Meridian, Morinus; Equal-MC 0.23″ on rc.10) |
| Whole sign | 0 | 0 | 0 |

Koch's worst ladder case is the rc.9 record's own, 2004-01-08T16:35:29.260Z
at 65.6° N, 71.56° W (`results/worst-koch.json`): 3.73″ on rc.9, 0.035″ on
rc.16. Given Swiss's own RAMC and true obliquity there, the engine's Koch
cusps are within 0.000000003″ of Swiss's, so what remains is the two programs'
inputs, which now agree far more closely: the co-ascendants record of the same
day found the engine's RAMC within 0.0015″ of Swiss's from 1850 to 2049.

**End to end, 1850–2049: PASS for all thirteen systems on the ladder.** Koch,
which failed on rc.9, passes.

Outside 1850–2049 the differences reach 15.6″ on the ladder and 31.4″ broad,
every system that uses the ascendant, as on rc.9 (13″ and 33″). As the rc.9
record found, Swiss switches to a long-term sidereal time outside 1850–2050,
and no system is judged against it there.

## What this changes

Koch now meets its gate in the release the site and the adapter run: within
0.01″ of Swiss given its inputs, within 3″ end to end on the ladder, and polar
status agreeing. The other twelve systems pass both halves on rc.16 as they
did on rc.9 and rc.10.

## Rerun

`tools/run-all.sh` reruns everything from the site root after `npm ci`. It
needs `python3` with pyswisseph 2.10.03 and no ephemeris file. It writes
`results/` and a scratch directory only. A second run on 2026-10-04 reproduced
all three result files byte for byte.
