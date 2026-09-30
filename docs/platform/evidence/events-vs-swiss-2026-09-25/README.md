# Published event times against Swiss Ephemeris, 2026-09-25

The comparison of [2026-09-23](../events-vs-swiss-2026-09-23/README.md), run
again with the same tools on the catalog the site publishes with
`@zodiacs/engine` 0.1.1-rc.8. rc.8 computes on observed ΔT (model
`zodiacs-deltat/1`, [`../deltat-2026-09-25/`](../deltat-2026-09-25/README.md))
where rc.7 used astronomy-engine's 2004 polynomial, which read 75.5 s in 2026
against Swiss's 68.8 s. The regenerated catalog lists the same 337 events
with the same kinds and signs. Every instant moved, and the longitude recorded
at 259 of them by at most 0.05″.

Every event from 2026 to 2030 was found again in Swiss Ephemeris 2.10.03 from
its compressed JPL files (`sepl_18.se1`, `semo_18.se1`; no call fell back to
Moshier), with `../events-vs-swiss-2026-09-23/tools/compare.py` on the dump
`../events-vs-swiss-2026-09-23/tools/dump-catalog.ts` writes. Swiss's own
instant for every new moon, full moon, eclipse, ingress and aspect is the one
the 2026-09-23 run found, to the millisecond.

| Events | Count | Largest difference | 2026-09-23 (rc.7) |
| --- | ---: | ---: | ---: |
| New and full moons | 124 | 5.2 s | 11.8 s |
| Eclipse peaks | 24 | 10.5 s | 13.8 s |
| Stations | 92 | 40.9 min (Pluto) | 41.0 min |
| Sign changes of Jupiter or Saturn | 8 | 28.0 min | 27.9 min |
| Sign changes of Uranus or Neptune | 2 | 3.06 h (Neptune) | 3.07 h |
| Exact aspects between Jupiter and Saturn only | 6 | 30.3 min | 30.4 min |
| Exact aspects involving Uranus, Neptune or Pluto | 34 | 6.40 h (Neptune–Pluto) | 6.40 h |

Station maxima by planet: Mercury 5.5 min, Venus 6.3, Mars 2.6, Jupiter 4.8,
Saturn 13.4, Uranus 15.8, Neptune 36.6, Pluto 40.9.

## What this says

The clock was most of the difference for the fast events. The site's new and
full moons were 6.9 s early on average; they are now 0.29 s late on average,
with 80 of the 124 within 2 s of Swiss and the largest 5.15 s (the new moon of
2030-05-02). What remains is the positions: the engine's Moon comes from an
analytic lunar theory, and Swiss's from JPL's DE431 through its compressed
files. Amendment A4 of the preregistration
([`../engine-beyond-swiss/PREREGISTRATION.md`](../engine-beyond-swiss/PREREGISTRATION.md))
asked for this re-run and said before it what it would show: 80 of 124 within
2 s, largest 5.15 s, from the Swiss-free projection
`../deltat-2026-09-25/tools/lunations-a4.mjs`. The measurement agrees with the
projection for every lunation to the millisecond: the site's lunation search
with the model installed finds each published instant exactly, and Swiss's
instants are unchanged.

The slow events barely moved: a planet close to stationary, or two slow
planets drawing level, turn a few arcseconds of position into minutes or
hours, and a few seconds of clock into almost nothing. Those limits stand as
the 2026-09-23 record describes them, and the site's copy states them where it
shows the times.

## Files

- `deltas.json`: the summary above and the site time minus the Swiss time in
  seconds for each event, in the 2026-09-23 format, with the engine version
  added. Swiss positions themselves are not committed. `catalogSha256` is the
  digest of the catalog dump, `18c186d1…`; the same dump from the rc.7 tree
  reproduces the 2026-09-23 digest, `add338d5…`.

`scripts/claims-bindings.test.mjs` holds the copy on the events hub, the
full-moon calendar and the event pages to these figures, and fails if the
catalog's instants change without a new measurement.

## The Moon's sign changes

The void-of-course calendar ends each void at the Moon's ingress, and the
2026–2028 ingress table it checks against is
`src/data/aura-moon-ingresses.json`. `tools/moon-ingresses.py` finds each of
its 481 ingresses in Swiss with `swe.mooncross_ut` and writes statistics only,
[`moon-ingresses.json`](moon-ingresses.json): on rc.8 the site's instant is
a median 0.86 s and at most 4.48 s from Swiss's, where the table committed
with rc.7 was a median 6.26 s and at most 10.25 s from it, every one early.

## Swiss output removed, 2026-09-28

Under [DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md) the per-event differences left `deltas.json`. Each event keeps
its id, family and published instant; the site-minus-Swiss seconds
(`deltaSeconds`, 290 values) and `summary.swissDeltaTSeconds2026` were
removed, because with the published instants they give Swiss's times back.
The summary figures stay, and the file records the SHA-256 of what it lost
under `swissOutputRemoved`. Commit `2ca93d41` still has the values, and
`../events-vs-swiss-2026-09-23/tools/compare.py` regenerates them from the catalog dump; keep what it
writes outside the repository. The record of everything removed is
[`../../../engine-validation/SWISS-OUTPUT-REMOVAL.md`](../../../engine-validation/SWISS-OUTPUT-REMOVAL.md).
