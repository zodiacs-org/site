# Product station-source alignment

The dated technical decision is
`docs/platform/programme/DECISIONS-2026-10-01-rc16-stations.md`. Only
build-sky's longitude primitive/import was replaced by the same package
bodyLongitude used by build-transits. The ±0.25-day derivative, 16 bisections,
scan bounds, clamping and shadows are unchanged. No independent reference
or accuracy threshold changed.

The before state is local commit `bbba65df31aee186250bac2bf2e2de78a31785ad`;
its 90-station mixed-source evidence remains in `../DAILY-EVENTS.md` and
`../daily-editions.json`. This directory records the alignment separately.

- All 90 monthly stations across 60 months now agree with catalogue station
  instants within **1,237 ms**, under the unchanged **2,000 ms** gate
- sky.json's 179 changed station/shadow boundaries move no calendar date;
  generatedAt, ranges, count and every lunation are unchanged
- Regenerated event publication preserves 337 event IDs, 219 standalone
  event pages and the 92 approved/index-eligible pages
- 91 tests pass across 10 catalogue/daily/horoscope suites (`tests.log`)
- Independent Swiss timing rerun: 290 matched events, zero SWIEPH fallbacks;
  station max absolute residual 2,454.390 → **419.451 seconds**, across 92
  catalogue stations. Other event-family statistics are unchanged

Minutes of residual remain. This is product consistency and a finite
instrument comparison, not acceptance of an astronomical-accuracy gate.
The historical comparator still reads published UTC digits as UT1 in Swiss;
its limitations are recorded in the statistics file. No per-event Swiss
value or reference instant is stored.

## Reproduce

From the site root on Node 22.22.2:

1. Run `node scripts/build-sky.mjs --generated-at` with the existing sky.json
   generatedAt, then `npm run data:events:build`
2. Run the prescribed October 1 daily/horoscope/outlook generators
3. Run `tools/compare-event-catalog.mjs` in the parent rc16 evidence directory
   with base `bbba65df31aee186250bac2bf2e2de78a31785ad`, the rc.16 archive,
   and an external temporary dump path; write `catalog-differences.json`
4. Run `../tools/compare-events-swiss.py` with that temporary dump, the
   separately installed verified Swiss ephemeris directory, and this
   directory's `events-vs-swiss.json`. The tool verifies its data/library pins
5. Run `node docs/platform/evidence/site-engine-rc16/station-alignment/verify.mjs`
   to reproduce `validation.json`

The verification script reads the committed before state and asserts fixed
fields, matches each monthly station, and preserves the unchanged <2 s gate.
All numbers here come from its machine-readable output or the committed
statistics-only instrument run. Earlier files are not overwritten.
