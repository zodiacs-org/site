# 2027 event pages: where every time comes from (ZOD-211)

This folder is the evidence for the 22 event pages of 2027 that were rewritten
to the reading style guide and to the format of the 2027 year pages (site PR
1023): each event's time in five time zones, a visible Updated date, questions
mirrored in FAQPage data, and a line on where the times come from.

Every time on those pages was solved again on NASA JPL Horizons in this job.
Nothing here is taken from a secondary page.

## The pages

One page for each 2027 full moon, eclipse, Mercury or Mars retrograde and
slow-planet sign change that the site's format gives a page of its own.

| Kind | Count | Pages |
| --- | ---: | --- |
| Full moons | 12 | `/full-moon/2027-01-22/`, `02-20`, `03-22`, `04-20`, `05-20`, `06-19`, `07-18`, `08-17`, `09-15`, `10-15`, `11-14`, `12-13` |
| Eclipses | 5 | `/eclipses/2027-02-06/` (annular solar), `02-20` (penumbral lunar), `07-18` (penumbral lunar), `08-02` (total solar), `08-17` (penumbral lunar) |
| Retrogrades | 4 | `/mars-retrograde/2027-01-10/`, `/mercury-retrograde/2027-02-09/`, `2027-06-10`, `2027-10-07` (each page covers the start and the end) |
| Sign changes | 1 | `/events/jupiter-enters-virgo-2027-07-26/` |

`referenced-events.json` lists the 22 pages and the 69 sky events they name:
the event itself, the edges of a retrograde's shadow, the events before and
after it, the nearby events, and the eclipse or full moon it pairs with.

What 2027 does not have, checked against the sky data (`src/data/sky.json`,
`eclipses.json`, `ingresses.json`):

- No Venus retrograde. Venus turns direct on 14 November 2026 and next turns
  retrograde in 2028.
- No other slow-planet sign change. Saturn, Uranus, Neptune and Pluto stay in
  one sign all year.
- No blue moon: no calendar month of 2027 holds two full moons.

What the site's format does not give a page of its own, so none was written:

- The retrogrades of Jupiter, Saturn, Uranus, Neptune and Pluto. They are rows
  of the table on `/retrogrades/` (`RETRO_PAGE_PLANETS` in
  `src/lib/events/catalog.ts`).
- The Sun's twelve sign changes. They are the season pages under `/seasons/`,
  one per sign, not one per year.
- The sign changes of the Moon, Mercury, Venus and Mars. They are in the daily
  and monthly pages only.

## The Horizons queries

`tools/horizons_event_times.py` asks the Horizons API
(`https://ssd.jpl.nasa.gov/api/horizons.api`) for 120 short tables and solves
each event on them.

- Table: `EPHEM_TYPE OBSERVER`, `CENTER 500@399` (the geocentre),
  `QUANTITIES 31` (ecliptic longitude and latitude of date of the apparent
  position: light-time, gravitational deflection of light, stellar
  aberration). Eclipses add `20` (range). `APPARENT AIRLESS`,
  `EXTRA_PREC YES`, `ANG_FORMAT DEG`, `CAL_FORMAT JD`.
- Ephemeris: DE441, as each response's header states.
- Targets: Sun 10, Moon 301, Mercury 199, and the system barycentres 4 to 9
  for Mars to Pluto, as `scripts/accuracy-audit/horizons_fetch.py` uses.
- Epochs: a window around the instant the site's data files give. 1 minute
  steps for 20 minutes either side of a full or new moon and 40 minutes either
  side of an eclipse; 10 minute steps for a day either side of a Mercury or
  Mars station; 1 minute steps around a sign change or a shadow edge, after a
  10 minute pass to find it. Each query's own start, stop and step are in
  `horizons-queries.json`.
- Time scale: `TIME_TYPE UT`. Horizons prints UT as UTC from 1962. For dates
  after the last announced leap second it holds that leap second, so TT minus
  UTC is 69.184 s throughout 2027. If a leap second is announced before an
  event, its UTC time moves by that second.
- Fair use: one request at a time, a second apart, each with a User-Agent that
  names the application and a contact address
  (`zodiacs.org-event-pages-check/1.0 (+https://zodiacs.org; admin@zodiacs.org)`).
- Retrieved: 13 November 2026, 16:54 to 17:10 UTC.

`horizons-queries.json` keeps, for each of the 120 queries, the full URL, the
parameters, the retrieval time in UTC, the byte count and SHA-256 of the
response, and the header lines Horizons printed (target, centre, start, stop,
step, Earth orientation file). The responses themselves are not committed,
for the reason `docs/accuracy-audit-2026-11/raw/.gitignore` gives; the script
fetches them again and checks a kept copy against its SHA-256.

## How each event is solved

| Kind | The instant |
| --- | --- |
| Full or new moon | The Moon's longitude minus the Sun's is exactly 180 or 0 degrees. |
| Lunar eclipse | The Moon's centre is closest to the axis of Earth's shadow, the line from the Sun through the geocentre. |
| Solar eclipse | The line from the Sun through the Moon passes closest to the geocentre. |
| Station | The planet's longitude stops changing (least-squares polynomial through the table). |
| Shadow edge | Before a retrograde: the planet, moving forward, first reaches the longitude of its direct station. After it: it passes the longitude of its retrograde station. |
| Sign change | The planet's longitude crosses a multiple of 30 degrees. |
| Aspect | The two longitudes differ by exactly the aspect's angle. |

The eclipse peaks use the apparent positions of both the Sun and the Moon, the
convention of NASA's Five Millennium Canon. `horizons-event-times.json` keeps
each event's instant to the millisecond, the queries it was solved on, and the
largest residual of the fit.

## The result

`tools/compare.py` holds what the pages print to these instants and writes
`COMPARISON.md` and `comparison.json`.

- 69 events. 61 are held to the printed minute and 8 (a station or an aspect
  of a slow planet, which these pages name by date only) to the date. None
  fails.
- The planets' stations and sign changes the pages already printed from
  `src/data/nasa-event-instants.json` agree with this job's solve: within 0.6 s
  for Mercury and for Jupiter's sign changes, within 1.7 s for Mars.
- The engine's full moons are within 3.4 s of Horizons and its eclipse peaks
  within 2.2 s. That is enough to move a printed minute twice:

  | Event | Engine | Horizons, this job | Printed |
  | --- | --- | --- | --- |
  | Full moon, 15 October 2027 | 13:46:59.502 UTC | 13:47:00.606 UTC | 13:47 |
  | Penumbral lunar eclipse, 18 July 2027 | 16:03:01.519 UTC | 16:02:59.330 UTC | 16:02 |

So the 2027 full moons, eclipse peaks and shadow edges are now printed from
this solve (`src/data/nasa-event-times-2027.json`, written by
`tools/write_site_table.py`, read by `src/lib/nasa-event-times-2027.ts`), on
the 22 pages, on `/full-moon-calendar/2027/` and `/eclipses/2027/`, in
their two calendar files, and on the surfaces that follow a page's own time
(the heads-up calendar, the upcoming events on `/today/` and the event short
videos, through `refinePublishedAnchors`). `src/lib/nasa-event-times-2027.test.ts`
holds the table to this folder row for row.

`tools/check_built_pages.py` then reads the built HTML of the 22 pages
(`built-pages.json`): every `<time datetime>` is an instant solved here, every
"HH:MM UTC" is the minute of one, and each of the 170 five-clock cells was
recomputed with Python's `zoneinfo`, independently of the build. It also holds
the Updated day to `dateModified` and the sitemap, and the FAQPage data to the
visible questions. No failure.

The signs and degrees still come from the site's engine. `COMPARISON.md` sets
each beside the position Horizons gives: all 21 agree to the sign and to the
printed arcminute.

## What a reader of this evidence should know

1. **Two instants sit about a second from a minute line.** The pages cut the
   seconds off, so a second decides the minute. The full moon of 15 October
   2027 is 0.6 s past 13:47. The eclipse of 18 July 2027 peaks 0.7 s before
   16:03, and that one depends on the convention too: taking the Moon's
   geometric place instead of its apparent place moves the peak by about the
   Moon's light-time, 1.3 s, which would cross the line. (That figure is an
   estimate, not a second solve.) A leap second announced before either date
   would also move it. Three more are within three seconds of a line and are
   listed in `COMPARISON.md`.
2. **The all-years tables still print the engine's minute for those two.**
   `/full-moon-calendar/`, `/eclipses/`, their translations, the all-years
   calendar files and the AI tools read `sky.json` and `eclipses.json`, which
   are bundled byte for byte into the published tools. They say 13:46 and
   16:03. Changing them is a wider decision than this job.
3. **New moons and other years keep the engine's instants**, as their own
   pages do. All 13 new moons of 2027 were solved here as well, and each
   agrees with the engine to the printed minute.
4. **A slow planet's station is not sharp to the minute.** Neptune's direct
   station of 15 December 2027 solves 64 s from the committed NASA table, and
   Uranus's and Pluto's 16 to 21 s. The 22 pages name those by date only.

## Rerun

```bash
npx vite-node --script docs/platform/evidence/event-pages-2027-20261113/tools/dump-referenced-events.ts
python3 docs/platform/evidence/event-pages-2027-20261113/tools/horizons_event_times.py   # --refresh fetches again
python3 docs/platform/evidence/event-pages-2027-20261113/tools/write_site_table.py --check
python3 docs/platform/evidence/event-pages-2027-20261113/tools/compare.py
npm run build && python3 docs/platform/evidence/event-pages-2027-20261113/tools/check_built_pages.py
```

The kept responses are read from `HORIZONS_RAW` (default
`/workspace/runs/fable-jobs/job10/horizons-raw`). Without them the solver
fetches all 120 again, about 15 minutes.
