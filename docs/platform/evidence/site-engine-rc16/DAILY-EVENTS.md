# rc.16 daily and event-data review, 2026-10-01

Local preparation only. No commit, push, release, deployment, changed gate,
or accepted programme unit is recorded here. **The monthly/catalogue station
agreement gate remains failing**; the successful checks below do not override
it.

## Inputs and repeatable comparisons

The old side is site main `ed55dacb449ada6e4893676c80bd0d9ba73db576`, read
from git objects and bundled with `vendor/zodiacs-engine-0.1.1-rc.15.tgz`
(SHA-256 `24eeb597b0157598c0faa26bb615c0cb5dfaaeac0393d62c73fbd37c5da4d348`).
The current side is this checkout with the already verified rc.16 archive
(SHA-256 `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`).
Both JavaScript sides run in one process on Node 22.22.2 and esbuild 0.28.1.
These are site-to-site comparisons, not independent accuracy claims.

Run from the repository root, with Node 22.22.2 on `PATH`:

```sh
node docs/platform/evidence/site-engine-rc16/tools/compare-daily-editions.mjs \
  ed55dacb449ada6e4893676c80bd0d9ba73db576 vendor/zodiacs-engine-0.1.1-rc.15.tgz \
  > docs/platform/evidence/site-engine-rc16/daily-editions.json
node docs/platform/evidence/site-engine-rc16/tools/compare-event-catalog.mjs \
  ed55dacb449ada6e4893676c80bd0d9ba73db576 vendor/zodiacs-engine-0.1.1-rc.15.tgz \
  /tmp/rc16-event-catalog-dump.json \
  > docs/platform/evidence/site-engine-rc16/event-catalog.json
```

## Daily editions and reviewed replay goldens

Both 2026-09-30 and 2026-10-01 were rebuilt in this order:

```sh
node scripts/build-daily.mjs YYYY-MM-DD
npm run editorial:daily:build -- --date YYYY-MM-DD
npm run editorial:horoscopes:build -- --date YYYY-MM-DD
node scripts/build-registry-outlook.mjs
```

The retained September 30 output is in `daily-editions/2026-09-30/` (daily
facts, publication, manifest, horoscope program, and Registry outlook). The
current source files are the October 1 edition. Their rendered daily copy,
body signs, motion directions, and Moon metadata are unchanged from rc.15.
September 30's Mercury ingress is 62 ms earlier, with the associated fact
references updated. October 1 has no daily event. The Registry weekly
outlook's Venus station moves 24.308 s, without changing its displayed minute.

The six fixed replay cases were generated with:

```sh
./node_modules/.bin/vite-node --script scripts/replay-daily-publication.ts \
  --print-goldens > /tmp/rc16-daily-goldens.json
```

Before replacing `src/data/daily-replay-goldens.json`, the old and new
fact/publication hashes were independently reproduced by
`compare-daily-editions.mjs`. All old hashes match the prior committed
goldens, and all new hashes match `--print-goldens`. Body longitudes move by
a common rotation at each edition, with a largest across-body spread below
`4.1e-10` arcseconds in these eight cases. No body sign, motion direction,
Moon metadata, or unexplained fact field changes.

One visible receipt changes in the golden editions: Neptune's July 7
station is now `11:01 UTC`, previously `11:21 UTC`. All 12 signs carry the
same corrected time. The narration is unchanged. This is not a rounding-only
change: the station moves −1,210.254 seconds. The common correction to
longitude cancels in differences between two bodies at one instant, but its
time derivative does not cancel in one body's speed. Hence lunation/aspect
instants remain fixed while station/ingress roots move.

## Sixty transit months and the unresolved source mismatch

`daily-editions.json` compares all 60 committed months. Event identities,
counts, signs, directions, ordering, and calendar dates are unchanged:

| Family | Events | Instants moved | Displayed minute moved | Largest time shift |
| --- | ---: | ---: | ---: | ---: |
| Ingress | 243 | 243 | 11 | 56.603 s |
| Lunation | 124 | 0 | 0 | 0 |
| Station | 90 | 90 | 52 | 2,651.961 s |
| Aspect | 797 | 0 | 0 | 0 |

The largest station shift is Pluto on 2028-05-09, from 08:48:34.782 to
09:32:46.743 UTC. The comparison evaluates both engines with the generator's
unchanged ±0.25-day central difference at both instants. Each engine has
speed within `3e-10` degrees/day of zero at its own root, while the other
engine gives about `1.36e-5` degrees/day there. The difference is the
time-varying full-nutation correction, not a changed root-finding tolerance.

`build-sky.mjs` still uses astronomy-engine's five-term rotation and model
clock for retrograde windows; monthly transits use the authoritative rc.16
engine. The catalogue derives its stations from those sky windows. Thus the
pre-existing agreement assertion in `src/lib/events/catalog.test.ts` fails
at Uranus 2026-02-04: a 903,240 ms difference against the unchanged 2,000 ms
limit. The statement in `build-transits.mjs` that the two generators name the
same station instant is no longer true. This requires a source-alignment
decision and subsequent regeneration/revalidation, not a looser test pin.
Neither the assertion nor either station generator was changed in this work.

The Phase 1 station pins and the 1970 Mercury double-ingress pins in
`scripts/build-transits.test.mjs` were updated to the new roots, with cause
comments. The same two cusp crossings and opposite directions persist.
`src/data/almanac.test.ts` was updated for the new August ingress roots and
lunation/aspect longitude digits; all cited rounded labels remain unchanged.
The Registry outlook test's Mercury ingress moves 130 ms. No edit was needed
in the daily snapshot or daily fact audit tests after data regeneration.

## Event catalogue and independent timing rerun

`event-catalog.json` compares 337 events: all IDs, instants, kinds, bodies,
signs, and non-longitude fields agree. Longitude changes are confined to
124 lunations, 92 stations, and 45 non-clamped retrograde windows (261 total),
at most 0.174734 arcseconds. The old dump digest exactly reproduces rc.15's
`fe237dc189103b296fcefbb8f0a70a312892d9a51c58b54d440ed774f449df62`.
The new digest is
`c8ba7c3ba0c8fd3e9dfc8aa25678112d9e103e53dbe9de218aebebc4a1aab66f`.

`node scripts/build-sky.mjs --generated-at 2026-09-30T07:54:56.476Z`
reproduces `src/data/sky.json` byte for byte, including all 124 lunations
and 47 retrograde windows. `npm run data:events:build` also reproduces the
committed event publication without a diff: 92 pages and 119 timeline rows.
This records their unchanged state; it does not resolve the station mismatch.

`events-vs-swiss.json` reruns the historical event-timing comparator through
the adapted `tools/compare-events-swiss.py`. It verifies the pinned binding
(pyswisseph 2.10.3.2 / Swiss 2.10.03), byte sizes, and full SHA-256 of both
official ephemeris files before measuring. Python is 3.11.15. Acquisition
URLs and digests are in the result, matching the existing benchmark
configuration and reference receipts. The downloaded files are outside the
repository and are not distributed.

```sh
../reference-swiss-env/bin/python \
  docs/platform/evidence/site-engine-rc16/tools/compare-events-swiss.py \
  /tmp/rc16-event-catalog-dump.json ../reference-swiss-ephe \
  docs/platform/evidence/site-engine-rc16/events-vs-swiss.json
```

All 290 non-cycle event instants matched; zero calls fell back from SWIEPH.
Every aggregate statistic exactly matches the prior rc.15 measurement,
including maxima: lunations 5.153 s, eclipse peaks 10.468 s, stations
2,454.390 s, ingresses 11,033.914 s, and slow-pair aspects 23,035.490 s.
The tool writes only aggregate statistics and the site's own IDs/instants;
it never writes per-event Swiss instants, positions, residuals, or ΔT.

The historical comparator treats ISO UTC as UT in Swiss. This rerun preserves
that convention; it is not a same-UT1 residual study or proof of observational
accuracy. These statistics cover the unchanged unified catalogue, **not**
the new monthly station instants, and cannot close that source mismatch.

## Checks run

All commands below used Node 22.22.2. No full build, full test suite, browser,
publication, holdout Moon study, or DE440 process was run by this worker.

- `./node_modules/.bin/vitest run scripts/daily-snapshot-lib.test.mjs scripts/daily-fact-audit.test.mjs src/data/almanac.test.ts scripts/registry-outlook.test.mjs scripts/sky-lunations.test.mjs scripts/horoscope-program-files.test.ts src/lib/daily.test.ts src/lib/daily-publication.test.ts src/lib/horoscope-program.test.ts`: 9 files, 64 tests passed
- `./node_modules/.bin/vitest run scripts/build-transits.test.mjs --testNamePattern='pins event coverage|preserves both Mercury'`: 2 passed, 62 skipped; the coordinating full run had already passed the 60 regeneration tests
- `./node_modules/.bin/vitest run src/lib/events/catalog.test.ts`: 26 passed, 1 failed; unchanged 2,000 ms source-agreement gate, first mismatch 903,240 ms at Uranus 2026-02-04
- `npm run editorial:daily:verify`: passed, October 1, 12 signs, 58 facts
- `npm run editorial:daily:replay`: passed, 30 days, 360 sign editions, 2,136 outputs, 6 fixed goldens
- `npm run editorial:daily:freshness`: passed, zero UTC days old
- `npm run editorial:horoscopes:verify`: passed, 12 signs, 491 receipts
- `npm run editorial:horoscopes:freshness`: passed, daily October 1 and monthly October 2026
- `npm run data:events:verify`: passed, 92 approved pages, 119 timeline rows, 93 existing OG cards
- Swiss summary comparison: all old/current statistics equal; all 290 published ID/instant rows equal

Still failing: the catalogue/monthly station agreement gate above. Overall
rc.16 adoption readiness remains with the coordinating review and its other
checks; these results are a partial preparation record.

## Files owned by this work

Modified generated outputs:

- `src/data/daily.json`
- `src/data/daily-publication.json`
- `src/data/daily-publication-manifest.json`
- `src/data/daily-replay-goldens.json` (reviewed before replacement)
- `src/data/horoscope-program.json`
- `public/assets/registry-outlook.json`

Modified numerical tests only:

- `src/data/almanac.test.ts`
- `scripts/build-transits.test.mjs`
- `scripts/registry-outlook.test.mjs`

New evidence, all under `docs/platform/evidence/site-engine-rc16/`:

- `DAILY-EVENTS.md`
- `daily-editions.json`
- `event-catalog.json`
- `events-vs-swiss.json`
- `daily-editions/2026-09-30/{daily.json,daily-publication.json,daily-publication-manifest.json,horoscope-program.json,registry-outlook.json}`
- `tools/compare-daily-editions.mjs`
- `tools/compare-event-catalog.mjs`
- `tools/compare-events-swiss.py`

Regenerated with no diff: `src/data/sky.json` and
`src/data/events-publication.json`. The 60 rc.16 transit files were already
present and were measured here, not rewritten. No other worker's files were
edited. Scoped `git diff --check` and both JavaScript syntax checks pass;
Python syntax is checked with `ast.parse` without writing bytecode.
