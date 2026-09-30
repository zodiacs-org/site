# Published event times against Swiss Ephemeris, 2026-09-23

Every event in the site's events catalog (`src/lib/events/catalog.ts`, built
from `sky.json`, `eclipses.json`, `ingresses.json` and the monthly transit
files) from 2026 to 2030, compared with the same event found in Swiss
Ephemeris 2.10.03 from its compressed JPL files (`sepl_18.se1`,
`semo_18.se1`; no call fell back to Moshier). The site's times are measured
after 3d279d73, which moved new and full moons onto the apparent Sun.

| Events | Count | Largest difference |
| --- | ---: | ---: |
| New and full moons | 124 | 11.8 s |
| Eclipse peaks | 24 | 13.8 s |
| Stations | 92 | 41.0 min (Pluto) |
| Sign changes of Jupiter or Saturn | 8 | 27.9 min |
| Sign changes of Uranus or Neptune | 2 | 3.07 h (Neptune) |
| Exact aspects between Jupiter and Saturn only | 6 | 30.4 min |
| Exact aspects involving Uranus, Neptune or Pluto | 34 | 6.40 h (Neptune–Pluto) |

Station maxima by planet: Mercury 5.6 min, Venus 6.5, Mars 2.8, Jupiter 4.9,
Saturn 13.6, Uranus 15.9, Neptune 36.4, Pluto 41.0.

## What this says

New and full moons and eclipses are within a minute of Swiss; the site's
figure differs by about 7 seconds on average, most of it the engine's ΔT,
which reads 75.5 s in 2026 where Swiss reads 68.8 s
(`docs/platform/evidence/deltat-2026-09-23/`).

The slow events are not. When a planet is nearly stationary, or two slow
planets draw level, a few arcseconds of position error move the instant by
minutes or hours: Neptune and Pluto close on each other at a few thousandths
of a degree a day, so an alignment between them moves by hours. The engine's
positions for the outer planets are the limit here, and for stations so is
the ±0.25-day speed estimate `build-sky.mjs` uses; both are Phase 1 package
work (steps 1.8 and 1.4 in the engine brief). Until then the site states
these limits where it shows the times.

## Files

- `deltas.json`: the summary above, and the site time minus the Swiss time
  in seconds for each event. Swiss positions themselves are not committed.
  `catalogSha256` is the digest of the catalog dump the tools produce, so a
  regenerated catalog is visible.
- `tools/dump-catalog.ts`: writes the catalog's event facts as JSON (run with
  `vite-node --script` from a checkout, `<site>` standing for its root).
- `tools/compare.py`: finds each event in Swiss near the site's instant (a
  sign change of the Moon–Sun elongation, of the speed, of the distance to a
  sign edge, or of the separation minus the aspect angle, bisected to
  1e-8 day; `sol_eclipse_when_glob` and `lun_eclipse_when` for eclipses).

`scripts/claims-bindings.test.mjs` holds the copy on the events hub, the
full-moon calendar and the event pages to these figures, and fails if the
catalog's instants change without a new measurement.

## Addition, 2026-09-24: the station speed step

`@zodiacs/engine` 0.1.1-rc.7 takes speeds over ±0.001 day instead of
±0.25 day (step 1.4). `tools/station-step.mjs` finds the 92 stations with both
steps and adds the shift to each station's difference from Swiss above. No
station moves by more than 66 seconds, and no planet's RMS difference moves by
more than 0.07 minute:

| Planet | Largest, ±0.25 day | Largest, ±0.001 day | RMS, ±0.25 day | RMS, ±0.001 day |
| --- | ---: | ---: | ---: | ---: |
| Mercury | 5.63 min | 6.16 min | 2.77 min | 2.73 min |
| Venus | 6.46 | 6.65 | 3.70 | 3.70 |
| Mars | 2.77 | 2.90 | 2.45 | 2.44 |
| Jupiter | 4.93 | 4.89 | 2.64 | 2.64 |
| Saturn | 13.56 | 13.58 | 6.26 | 6.27 |
| Uranus | 15.86 | 15.76 | 8.76 | 8.72 |
| Neptune | 36.43 | 36.33 | 18.42 | 18.35 |
| Pluto | 40.99 | 40.97 | 21.81 | 21.82 |

The positions set the limit, not the step. So `sky.json` and the monthly
transit files (`scripts/build-transits.mjs`) keep the ±0.25-day step and name
the same instant for each station, and the figures above stand.

## Addition, 2026-09-25: engine rc.8's clock

`@zodiacs/engine` 0.1.1-rc.8 computes on observed ΔT, and the regenerated
catalog moved every instant. The same comparison on it is
[`../events-vs-swiss-2026-09-25/`](../events-vs-swiss-2026-09-25/README.md):
new and full moons within 5.2 s of Swiss instead of 11.8 s, eclipse peaks
within 10.5 s instead of 13.8 s, the slow events as above. This record stays
as it was measured, on rc.7's catalog.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the per-event differences left `deltas.json`. Each event keeps
its id, family and published instant; the site-minus-Swiss seconds
(`deltaSeconds`, 290 values) and `summary.swissDeltaTSeconds2026` were
removed, because with the published instants they give Swiss's times back.
The summary figures stay, and the file records the SHA-256 of what it lost
under `swissOutputRemoved`. Commit `2ca93d41` still has the values, and
`tools/compare.py` regenerates them from the catalog dump; keep what it
writes outside the repository. The record of everything removed is
[`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
