# The house systems against Swiss Ephemeris on rc.16, 2026-10-04

Engine 0.1.1-rc.16, the archive the site and the MCP adapter 0.1.0-rc.16 run
(`vendor/zodiacs-engine-0.1.1-rc.16.tgz`, SHA-256 `43a72d30…15d8`, the npm
tarball's bytes), against Swiss Ephemeris 2.10.03 (pyswisseph 2.10.03) as an
instrument. Nothing Swiss computed is committed: `results/` holds statistics,
and the worst Koch case keeps its instant, place and two differences.

**Verdict for the ledger: Koch is validated, not accepted.** It meets its
criterion only with Swiss given the engine's own UT1, a reading chosen with
both outcomes already on main; see
[*What this record does not settle*](#what-this-record-does-not-settle).

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
day found the engine's RAMC within 0.0016″ of Swiss's from 1850 to 2049.

**End to end, 1850–2049, with both programs given the same UT1: all thirteen
systems within 3″ on the ladder.** Koch, which failed on rc.9, is within 3″.

Outside 1850–2049 the ladder differences reach 31.4″ for Koch, 15.6″ for
Regiomontanus and 13.4″ for the other systems that use the ascendant, and the
broad ones 31.4″. On rc.9 the ladder reached 31.6″ for Koch, 15.2″ for
Regiomontanus and 13.2″ for the others, and the broad set 32.9″ (the rc.9
README gives only the 13″). As the rc.9 record found, Swiss switches to a
long-term sidereal time outside 1850–2050, and no system is judged against it
there.

## What this changes

Given Swiss's inputs, all thirteen systems meet the 0.01″ half on rc.16, the
release the site and the adapter run, with polar status agreeing. End to end,
all thirteen are within 3″ on the ladder from 1850 to 2049 with Swiss given the
engine's UT1. Koch had failed that half on rc.9. Under the programme's rules
the shared-UT1 result counts for Koch as validated, not accepted; see below.

## What this record does not settle

Added after two independent reviews of this record, before it was merged.

**This had been measured on rc.16 before.** The rc.16 accuracy refresh of
2026-10-01,
[`../site-engine-rc16/accuracy-refresh/`](../site-engine-rc16/accuracy-refresh/README.md),
already on main, ran these cases on rc.16 both ways. With the aligned clock its
figures are this record's: 47 of the 48 end-to-end statistics of the twelve
rc.9 systems are identical (Campanus's ladder 95th percentile differs by
0.001″), and so are all of its given-input statistics. `PREREGISTRATION.md`
says it was committed before any measurement on rc.16 was run, and it did not
cite that record.

**The clock reading.** The preregistration gives Swiss the engine's UT1 Julian
day. With the rc.9 tool's own reading, Swiss reading the UTC instant as UT1,
the same refresh found every system but whole sign over 3″ on the 1850–2049
ladder in 33 to 51 of its cases, Koch in 48 of 353 with 82.677″ the largest
(`houses-default-utc.json` there). The site's rc.16 record then kept Koch
failed: "an aligned-clock pass does not substitute for the original failed
comparison". Under the programme's rule that a gate passing only under a change
adopted after its residual was seen counts as validated until the owner
ratifies it, Koch is recorded as **validated**, pending the owner's decision on
the reading (FINDINGS F-71).

The other twelve systems keep their acceptance, which rests on the rc.9 and
rc.10 records, where both programs read the UTC instant as UT1. On rc.16 they
too stay within 3″ end to end only under the shared reading; F-71 puts that to
the owner as well.

**Repeated draws.** The tools' generator, inherited from the rc.9 record,
computes `(seed × 1103515245 + 12345) mod 2³¹` in double precision, which loses
digits and falls into a cycle of 10,466 draws. Of the given-input set's 20,000
broad draws, 12,515 are distinct, and of its 5,199 broad cases undefined on
both sides, 3,258. The rc.9 record's sets are the same. The verdicts rest on
the largest differences and on agreement in every case, so repeats change
none; they shrink the coverage the counts suggest. The end-to-end sets stay
within one cycle: all 3,708 cases are distinct.

**Departures from the preregistration.** `results/given.json` gives the median
and the largest difference but not the 95th percentile the preregistration
listed. `tools/worst-koch.mjs` calls `kochCusps`, the function
`computeHouses` runs for Koch outside the polar case, rather than
`computeHouses`; the worst case is not polar. The end-to-end instants stop at
2199-12-31T00:00Z rather than at the end of 2199.

**Commits.** The preregistration (author time 2026-10-04T15:55:10Z) was
committed before the tools and the run (15:57:24Z). Rebasing onto main
`67aa32d8` set both commits' committer time to 17:53:01Z and changed no
content.

## Rerun

`tools/run-all.sh` reruns everything from the site root after `npm ci`. It
needs `python3` with pyswisseph 2.10.03 and no ephemeris file. It writes
`results/` and a scratch directory only. A second run on 2026-10-04 reproduced
all three result files byte for byte.
