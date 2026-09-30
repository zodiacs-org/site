# Published event times against Swiss Ephemeris, 2026-09-30

The comparison of [2026-09-23](../events-vs-swiss-2026-09-23/README.md) and
[2026-09-25](../events-vs-swiss-2026-09-25/README.md), run again with the same
tools on the catalog the site publishes with `@zodiacs/engine` 0.1.1-rc.15.
From 1972 to 2027-10-02 rc.15 reads an instant as UTC, with TT from the IERS
leap seconds, where rc.14 read it as UT1 with the ΔT model
([`../site-engine-rc15/`](../site-engine-rc15/README.md)). In 2026 and 2027 the
two clocks' TT differ by at most 0.196 s, so the new moons, full moons and
exact aspects the site computes moved a little.

The regenerated catalog lists the same 337 events with the same ids, kinds,
signs and bodies (`../site-engine-rc15/event-catalog.json`, which compares it
with the base commit's on rc.14). 41 instants moved: 31 new and full moons and
10 exact aspects, by at most 248 ms. The lunation search halves a day twenty
times, to 82 ms, so a clock change of a fraction of a second moves a lunation
by whole steps of 82 ms or not at all. Eclipses, sign changes and stations come
from tables built on the ΔT model and did not move. The catalog takes each
event's longitude from the engine at its instant: at 44 lunations it moved by
at most 0.047″, and at 111 stations and retrograde periods, where the planet
is almost still, by less than 0.000001″. The same dump from the base commit on
rc.14 reproduces the 2026-09-25 digest, `18c186d1…`.

Every event from 2026 to 2030 was found again in Swiss Ephemeris 2.10.03 from
its compressed JPL files (`sepl_18.se1`, `semo_18.se1`; no call fell back to
Moshier), with `../events-vs-swiss-2026-09-23/tools/compare.py` on the dump
`../events-vs-swiss-2026-09-23/tools/dump-catalog.ts` writes. Swiss's own
instant for every event is the one the 2026-09-25 run found, to the
millisecond, so the site's time minus Swiss's moved by exactly as much as the
published instant, at most 0.248 s.

| Events | Count | Largest difference | 2026-09-25 (rc.8) |
| --- | ---: | ---: | ---: |
| New and full moons | 124 | 5.2 s | 5.2 s |
| Eclipse peaks | 24 | 10.5 s | 10.5 s |
| Stations | 92 | 40.9 min (Pluto) | 40.9 min |
| Sign changes of Jupiter or Saturn | 8 | 28.0 min | 28.0 min |
| Sign changes of Uranus or Neptune | 2 | 3.06 h (Neptune) | 3.06 h |
| Exact aspects between Jupiter and Saturn only | 6 | 30.3 min | 30.3 min |
| Exact aspects involving Uranus, Neptune or Pluto | 34 | 6.40 h (Neptune–Pluto) | 6.40 h |

Every largest difference is unchanged except the Jupiter–Saturn aspects',
1816.71 s on rc.8 and 1816.545 s now. The new and full moons are 0.313 s late
on average, where they were 0.286 s, and 80 of the 124 are within 2 s of Swiss,
as before; the largest is still the new moon of 2030-05-02, 5.153 s. Station
maxima by planet are rc.8's.

## Files

- `deltas.json`: the summary above and each event's id, family and published
  instant, in the 2026-09-25 format as it stands since the removal of
  2026-09-28, with the engine version. The site-minus-Swiss seconds that
  `compare.py` writes for each event were kept outside the repository and are
  not committed, nor are Swiss's positions or ΔT
  ([DECISIONS-2026-09-28 §3](../../programme/DECISIONS-2026-09-28.md)).
  `catalogSha256` is the digest of the catalog dump.

`scripts/claims-bindings.test.mjs` holds the copy on the events hub, the
full-moon calendar and the event pages to these figures, and fails if the
catalog's instants change without a new measurement.

The Moon's sign changes that end each void-of-course period are checked against
`src/data/aura-moon-ingresses.json`, which is built on the ΔT model and did not
change; its comparison with Swiss stays
[2026-09-25's](../events-vs-swiss-2026-09-25/README.md#the-moons-sign-changes).
