# House systems against Swiss Ephemeris, 2026-09-26

Engine 0.1.1-rc.9 offers twelve house systems: whole sign, Placidus and
Porphyry, as before, and Koch, Regiomontanus, Campanus, Topocentric
(Polich–Page), Alcabitius, Equal, Vehlow, Meridian (axial rotation) and
Morinus. This record measures them against Swiss Ephemeris 2.10.03, which is
the instrument, not a dependency. Nothing Swiss computed is committed:
`results/` holds statistics, and the one case below keeps its inputs and two
differences.

This is the house-system part of milestone M5 in the engine brief. Its rule:

- each system agrees with Swiss's `swe_houses_ex` to within 0.01″ given Swiss's
  inputs, on the 55°–66.6° latitude ladder;
- it agrees to within 3″ end to end;
- its polar status agrees with Swiss's.

## Given the same inputs

`tools/dump-given.mjs` feeds each system a sidereal time, latitude and
obliquity directly, and `tools/compare-given.py` passes the same three to
`swe_houses_armc` (`results/given.json`). Two sets were compared:

- **The ladder:** every 0.1° from 55° to 66.6°, both hemispheres, at 24 sidereal times (5,616 cases).
- **Broad:** 20,000 random draws over every latitude from −89.9° to 89.9°, with the obliquities of 1800–2200.

| System | Ladder, largest | Broad, largest |
| --- | ---: | ---: |
| Koch | 0.000000005″ | 0.000000004″ |
| Regiomontanus | 0.0000000007″ | 0.000000003″ |
| Campanus | 0.0000000008″ | 0.000000002″ |
| Topocentric | 0.0000000006″ | 0.000000009″ |
| Alcabitius | 0.0000000008″ | 0.00005″ |
| Equal, Vehlow | 0.0000000008″ | 0.000000002″ |
| Meridian, Morinus | 0.0000000004″ | 0.0000000008″ |
| Porphyry | 0.0000000008″ | 0.000000001″ |
| Placidus, which iterates | 0.0052″ | 0.0096″ |
| Whole sign | 0 | 0 |

Alcabitius's largest broad difference is at a latitude near a pole, where the
ascendant's semi-arc is clamped as Swiss clamps it.

Polar status agrees in every case. Placidus and Koch are undefined in 5,199
broad cases and 48 ladder cases, all inside the polar circle. In each of them
Swiss refuses too, and in no case does one side compute while the other
refuses. The engine then falls back to whole sign with the `polar-fallback`
flag, where Swiss's own houses call falls back to Porphyry. Every other system
is computed everywhere by both. Inside the polar circle, Regiomontanus,
Campanus, Topocentric, Equal and Vehlow cusps turn half a circle with the
ascendant, and Alcabitius is taken from the turned ascendant, all as Swiss does.

**Given Swiss's inputs: PASS for all twelve systems, and polar status agrees.**

## End to end

`tools/dump-end-to-end.mjs` computes each system from a UTC instant with the
engine's own sidereal time and obliquity. `tools/compare-end-to-end.py`
computes the same with `swe_houses_ex`, reading the instant as UT1 on both
sides (`results/end-to-end.json`). Two sets were compared:

- **The ladder:** 55°–66.6° every 0.2°, six instants each, both hemispheres.
- **Broad:** 3,000 draws within 66° of the equator.

Both sets draw instants from 1800 to 2199.

The two sides differ here only in their inputs. From 1850 to 2049:

| System | Ladder, largest | Broad, largest | Broad, median |
| --- | ---: | ---: | ---: |
| Meridian, Morinus | 0.25″ | 0.26″ | 0.054″ |
| Equal, Vehlow, Porphyry, Placidus, Regiomontanus, Campanus, Topocentric, Alcabitius | 1.28″ | 1.15″ | 0.047–0.063″ |
| Koch | 3.73″ (1 of 353 over 3″) | 1.95″ | 0.064″ |

The one Koch case over 3″ is 2004-01-08T16:35:29Z at 65.6° N
(`results/worst-koch.json`). `tools/worst-koch.py` takes Swiss's own sidereal
time and obliquity there, and `tools/worst-koch.mjs` feeds them to the engine's
Koch function: the cusps then agree with Swiss's to 0.0000000004″. The 3.73″
is the two sides' small difference in those inputs, magnified by Koch near the
polar circle, not the house calculation.

Outside 1850–2049 the differences grow, to 13″ on the ladder and 33″ broad, for
every system that uses the ascendant, including Placidus and Porphyry. That is
Swiss's sidereal time, not the houses. `tools/sidereal.py` sets both
programs' apparent sidereal time beside ERFA's `gst06a` (IAU 2006/2000A), UT1
read as UTC (`results/sidereal.json`):

- At the six dates sampled from 1860 to 2049, Swiss agrees with ERFA to 0.001″.
- Swiss is 1.908″ off at 2051 and 0.340″ off at 1820. Outside 1850–2050 it
  switches to a long-term model.
- The engine is within 0.113″ of ERFA at all fourteen dates, from 1820 to 2190.

**End to end: PASS for eleven systems from 1850 to 2049; Koch FAIL, in 1 case of
353 on the ladder, by input sensitivity near the polar circle.** Outside that
window no system is judged against Swiss's long-term sidereal time.

## Rerun

`tools/run-all.sh` reruns everything from the site root with rc.9 installed.
It needs:

- pyswisseph 2.10.03;
- pyerfa;
- Swiss's `sepl_18.se1` and `semo_18.se1` in `SWISS_EPHE`.

It writes only `results/` and a scratch directory.
