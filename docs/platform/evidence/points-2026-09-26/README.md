# Chart points against Swiss Ephemeris, 2026-09-26

Engine 0.1.1-rc.10 adds five things:

- a thirteenth house system, Equal houses from the midheaven (`"equal-mc"`);
- the Moon's mean node;
- Black Moon Lilith, the mean lunar apogee;
- the Vertex and the East Point;
- seven Hellenistic lots.

This record measures the first four against Swiss Ephemeris 2.10.03, which is
the instrument, not a dependency. Swiss does not compute the lots, so they are
held to their formulas instead, in the engine's own tests. Nothing Swiss
computed is committed: `results/` holds statistics, and the one worst case
below keeps its inputs and two differences.

It covers part of version 1's M5 houses item (Equal-MC, the Vertex and the
East Point) and starts its points item. M5's houses item also asks for house
positions with latitude, co-ascendants and cusp speeds, which rc.10 does not
have. The brief's rules:

- **Houses:** agree with Swiss's house function to within 0.01″ given its
  inputs, and within 3″ end to end.
- **Points:** agree to within 1″ where Swiss computes them.

## Given the same inputs

`tools/dump-given.mjs` feeds the engine a sidereal time, latitude and obliquity
directly. `tools/compare-given.py` passes the same three to `swe_houses_armc`
with system `D`. It compares the twelve cusps, and the Vertex and equatorial
ascendant Swiss returns beside them (`results/given.json`). There are two sets:

- **The ladder:** every 0.1° from 55° to 66.6°, both hemispheres, at 24
  sidereal times (5,616 cases).
- **Broad:** 20,000 random draws over every latitude from −89.9° to 89.9°, with
  the obliquities of 1800–2200.

| | Ladder, largest | Broad, largest |
| --- | ---: | ---: |
| Equal-MC cusps | 0.0000000004″ | 0.0000000004″ |
| Vertex | 0.0000000003″ | 0.000000002″ |
| East Point | 0.0000000002″ | 0.0000000003″ |

**Given Swiss's inputs: PASS for Equal-MC, the Vertex and the East Point.**

## The mean node and Black Moon Lilith

`tools/dump-mean.mjs` asks the engine's `chartPoints` for the mean node and
Black Moon Lilith, with their speeds. It samples every 3.7 days from 1800 to
2199, and records the TT each was computed at. `tools/compare-mean.py` asks
Swiss for `SE_MEAN_NODE` and `SE_MEAN_APOG` at the same TT, with its default
true equinox of date (`results/mean.json`). The 39,486 instants give:

| | Largest | Median |
| --- | ---: | ---: |
| Mean node, longitude | 0.67″ | 0.19″ |
| Mean node, speed | 0.08″ a day | 0.017″ a day |
| Black Moon Lilith, longitude | 0.72″ | 0.19″ |
| Black Moon Lilith, latitude | 0.016″ | 0.002″ |
| Black Moon Lilith, speed | 0.08″ a day | 0.016″ a day |

**Where the figures come from:**

- The engine's node is Ω from the IERS Conventions' fundamental arguments
  (Simon et al. 1994).
- Its Lilith is the point of the mean orbit at argument of latitude F − l + 180°.
  The mean inclination, 5.1453964°, carries it to the ecliptic.
- The nutation in longitude puts both on the true equinox of date.

`tools/erfa-args.py` sets the engine's l, F and Ω beside ERFA's `iauFal03`,
`iauFaf03` and `iauFaom03` at 401 instants from −2 to +2 centuries of TT. The
largest difference is 0.0000004″ (`results/erfa-args.json`), so the
coefficients are the published ones.

**Mean node and Black Moon Lilith: PASS, within 0.72″ of Swiss from 1800 to
2199.**

The osculating ("true") Lilith is not in the engine. It would be the apogee of
the Moon's instantaneous orbit, and astronomy-engine's lunar series is not
precise enough in velocity for it: in a probe it was 198″ from Swiss's at the
median and up to 683″. It waits for a JPL-based Moon.

## End to end

`tools/dump-end-to-end.mjs` computes the Vertex, the East Point and the
Equal-MC cusps from a UTC instant and a place, with the engine's own sidereal
time and obliquity. `tools/compare-end-to-end.py` computes the same with
`swe_houses_ex`, reading the instant as UT1 on both sides
(`results/end-to-end.json`). There are two sets:

- **The ladder:** 55°–66.6° every 0.2°, six instants each, both hemispheres.
- **Broad:** 3,000 draws within 66° of the equator.

Both sets draw instants from 1800 to 2199. From 1850 to 2049:

| | Ladder, largest | Broad, largest | Broad, 95th percentile |
| --- | ---: | ---: | ---: |
| Equal-MC cusps | 0.23″ | 0.24″ | 0.14″ |
| East Point | 0.23″ | 0.24″ | 0.14″ |
| Vertex | 0.23″ | 3.46″ | 0.15″ |

The Vertex's 3.46″ is 1852-03-19T05:35:27Z at 23.38° N
(`results/worst-vertex.json`). There the zenith is 0.075° from the ecliptic,
so the prime vertical and the ecliptic meet at a shallow angle, and a small
difference in sidereal time moves their meeting point a long way.
`tools/worst-vertex.py` takes Swiss's own sidereal time and obliquity there,
and `tools/worst-vertex.mjs` feeds them to the engine's `vertexOf`. The Vertex
then agrees with Swiss's to 0.000014″. Where the ecliptic passes through the
zenith itself, the Vertex is on the meridian and is not defined as a western
point at all.

Outside 1850–2049 every figure grows to about 2″. The largest Vertex
difference, 42.8″, is again near the zenith. As in
[`../houses-2026-09-26/`](../houses-2026-09-26/README.md), that is Swiss's
long-term sidereal time rather than the points.

**End to end, 1850–2049: PASS for Equal-MC and the East Point. The Vertex is
within 0.25″ except where the ecliptic runs within about a degree of the
zenith, where it follows its inputs' small differences.** On the ladder, the
set M5 judges house systems on, the Vertex's largest difference is 0.231″, so
by that rule it passes too.

## Rerun

`tools/run-all.sh` reruns everything from the site root with rc.10 installed.
It needs:

- pyswisseph 2.10.03;
- pyerfa;
- Swiss's `sepl_18.se1` and `semo_18.se1` in `SWISS_EPHE`.

The scripts call `python3`; put an environment with those packages first on
`PATH`. The script writes only `results/` and a scratch directory. A rerun on
2026-09-26 reproduced every result file byte for byte.

*Appended 2026-09-28.* This record was written on 2026-09-26 but not
published with the site's rc.10 adoption. It was rerun on 2026-09-28 against
the archive production serves, `vendor/zodiacs-engine-0.1.1-rc.10.tgz`
(SHA-256 `a377cdc8…565c`), with pyswisseph 2.10.03 and pyerfa 2.0.1.5. All
five result files came out byte-identical to the 2026-09-26 run.
