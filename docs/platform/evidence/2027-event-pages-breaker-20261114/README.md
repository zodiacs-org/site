# 2027 event pages: independent check of every time (ZOD-211, breaker)

A second session, separate from the one that wrote the pages, checked draft PR
1030 at head `7953051aa`. It read the sources itself, asked NASA JPL Horizons
again with its own queries and its own solver, rebuilt the site, and read the
built HTML of the 22 pages. Nothing in the product was changed. This folder is
the only thing the session added.

Checked 13 November 2026, 17:50 to 18:20 UTC (14 November, 00:50 to 01:20 ICT).

## Result in one table

| Test | Result | Short reason |
| --- | --- | --- |
| E1 Started after PR 1023 merged | Pass | 1023 merged 2026-11-13 11:00:19 UTC (`d2d9e97ef`). The branch was created 16:45:17 UTC from `fc329bc37`, which contains that merge. |
| E2 Inventory | Pass, with a scope call for the owner | 12 full moons, 5 eclipses, 4 retrogrades, 1 sign change. None missing, none invented, within what the site's format gives a page. |
| E3 Times against Horizons | Pass | All 69 events solved again. Every instant, every one of the 170 five-clock cells and every time in the prose agrees. Two minutes rest on under a second. |
| E4 Style guide and 1023 format | Pass on the named fails, with should-fix items | Advice first, each term explained, a reason to return, five clocks, Updated date, mirrored questions. Readings run longer than the guide asks. One visible spacing error. |
| E5 Draft only | Pass | PR 1030 is an open draft. No tag, no release, no merge. This branch touches no engine file. See the note on engine PRs 91 and 92. |

No blocker to E1 to E5 was found. The should-fix items are listed at the end.

## E3: how the times were checked

### The queries

`tools/breaker_solve.py` asked the Horizons API
(`https://ssd.jpl.nasa.gov/api/horizons.api`) for 145 tables.
`breaker-queries.json` keeps each one's full URL, parameters, retrieval time,
byte count, SHA-256 and the header lines Horizons printed. The raw responses
are kept outside git.

- Table: `EPHEM_TYPE OBSERVER`, `CENTER 500@399` (the geocentre),
  `QUANTITIES 31` (apparent ecliptic longitude and latitude of date), with
  `20` (range) added for eclipses. `APPARENT AIRLESS`, `EXTRA_PREC YES`,
  `ANG_FORMAT DEG`, `CAL_FORMAT JD`.
- Ephemeris: DE441 for the Sun, Moon and Mercury. For Mars to Pluto the
  breaker asked for the planet's own centre (499, 599, 799, 899, 999), which
  Horizons builds from DE441 and its satellite solutions (`mar099`,
  `jup365_merged`, `ura184_merged`, `nep098_merged`, `plu060_merged`). The
  builder asked for the system barycentres (4 to 9). The difference is a
  deliberate second opinion.
- Epoch: a window around each event. One minute steps for 12 minutes either
  side of a full or new moon, 30 minutes either side of an eclipse and 15
  minutes either side of a sign change or shadow edge. Ten minute steps for
  12 hours either side of a Mercury or Mars station. One hour steps for three
  days either side of a slow planet's station.
- Time scale: `TIME_TYPE UT`. Horizons prints UTC and holds the last announced
  leap second for future dates, so TT minus UTC is 69.184 s throughout.
- Earth orientation file in every response: `eop.261112.p270208`.
- Retrieved 13 November 2026, 17:55 to 18:08 UTC, one request at a time, a
  second apart, with an application name and contact in the User-Agent.
- No HTTP 429 or 403. One pass lost about half its requests to dropped TLS
  connections (not refusals); the script was given a retry and run again.

### The solver

Written without the builder's code.

| Kind | The instant |
| --- | --- |
| Full or new moon | Cubic fit to the Moon's longitude minus the Sun's, minus 180 or 0 degrees. Its root. |
| Eclipse | Positions built from longitude, latitude and range. Lunar: least distance of the Moon's centre from the line through the Sun and the geocentre. Solar: least distance of the geocentre from the line through the Sun and the Moon. Quartic fit, its minimum. |
| Station | Fifth-degree fit to the longitude over 24 hours; the root of its derivative. A second, fourth-degree fit over 12 hours agrees within 0.34 s for every Mercury and Mars station. |
| Shadow edge | The longitude of the breaker's own station solve, then the minute-step crossing of it. Each is a forward crossing. |
| Sign change | The crossing of 120, 150 or 180 degrees. |
| Aspect | The two longitudes 60 or 120 degrees apart. |

`breaker-event-times.json` holds the 69 instants. `BREAKER-COMPARISON.md` sets
each beside the builder's.

### What agreed

- **Moons and eclipses (36 events):** the two solves agree within 0.004 s.
- **Mercury stations and shadow edges:** within 0.06 s.
- **Mars stations and shadow edges:** within 0.4 s.
- **Jupiter's three sign changes:** the planet's centre crosses 2 to 4 s from
  the barycentre. Same minute each time (Virgo: 04:49:19.0 against 04:49:15.6).
- **Slow planets (4 stations, 4 aspects):** same date each time, which is all
  the pages print for them. The instants differ by up to 57 minutes (Pluto's
  station) between planet centre and barycentre, and my two fits of Pluto's
  station differ by almost six minutes. A slow planet's station is not sharp
  to the minute, and the pages are right not to print one.

### The built pages

`tools/breaker_check_pages.py` reads `dist/` (built in this session from the
PR head) and writes `breaker-built-pages.json`. It uses only the breaker's
instants and Python's `zoneinfo`.

| Check | Count | Failures |
| --- | ---: | ---: |
| Distinct `<time datetime>` instants, each matched to a breaker instant in the same minute (slow planets: same date) | 34 | 0 |
| Five-clock cells: day, clock time and UTC offset recomputed for UTC, New York, London, Kolkata, Sydney | 170 | 0 |
| "HH:MM UTC" strings | 165 | 0 |
| Sentences that give a time on four local clocks, with the date where it differs | 50 | 0 |
| Calendar dates named in words (each is the date of a breaker event on one of the five clocks, or the Updated day) | 614 | 0 |
| Updated day equals `dateModified`; FAQPage data equals the visible questions | 22 pages | 0 |

Daylight time is right on both sides of each change: New York is UTC-5 in
January and UTC-4 by 22 March; London is UTC+0 on 23 March and UTC+1 by 1
April; Sydney is UTC+11 until April and again by 7 October.

### Signs, degrees and other facts in the readings

Checked by hand against the breaker's longitudes.

- Each full moon's sign and degree, to the printed arcminute (for example 21°58′ Aries on 15 October: 21.9826°).
- The 20 April and 20 May full moons are both in Scorpio (0°36′ and 29°13′).
- Solar eclipse pages now say "The Sun stands at". The printed degree is the Sun's (6 February: Sun 17°37.8′ Aquarius, Moon 17°39.4′), so the new label is the right one.
- Mars turns retrograde at 10°25′ Virgo and direct at 20°55′ Leo. Mercury: Pisces to Aquarius, Cancer to Gemini, Scorpio to Libra.
- Durations: 22 days and 57 days (Mercury, February), 81 and 214 days (Mars), 395 days of Jupiter in Virgo.
- "Mercury seems to be moving backward this month" on the 19 June and 15 October full moons: both fall inside a retrograde.
- The 12 January 2028 lunar eclipse is partial, as the December reading says.

### A second source, for corroboration only

NASA's eclipse pages (`eclipse.gsfc.nasa.gov/LEdecade/LEdecade2021.html` and
`SEdecade/SEdecade2021.html`, read 13 November 2026) list the same five
eclipses of 2027 and no other. Their times are Terrestrial Dynamical Time.
Taking 69.184 s off gives:

| Eclipse | NASA page, TD | Minus 69.184 s | Breaker, Horizons | Printed |
| --- | --- | --- | --- | --- |
| 6 February, annular solar | 16:00:47 | 15:59:37.8 | 15:59:38.5 | 15:59 |
| 20 February, penumbral lunar | 23:14:06 | 23:12:56.8 | 23:12:52.3 | 23:12 |
| 18 July, penumbral lunar | 16:04:09 | 16:02:59.8 | 16:02:59.3 | 16:02 |
| 2 August, total solar | 10:07:49 | 10:06:39.8 | 10:06:41.0 | 10:06 |
| 17 August, penumbral lunar | 07:14:59 | 07:13:49.8 | 07:13:51.4 | 07:13 |

Same minute every time. The pages take no time from these NASA pages; the
table only shows that the Horizons solve and NASA's own catalog agree.

### Two minutes that rest on under a second

| Event | Breaker | Printed | Margin |
| --- | --- | --- | --- |
| Full moon, 15 October 2027 | 13:47:00.606 | 13:47 | 0.6 s past the line |
| Penumbral lunar eclipse, 18 July 2027 | 16:02:59.334 | 16:02 | 0.7 s before the line |

Both are right by Horizons today. Either could move if a leap second is
announced before the date (Horizons then shifts its UTC by a second), and the
eclipse also depends on the convention:

- With the apparent Sun and apparent Moon (what the pages use, and what agrees
  with NASA's catalog to half a second) the peak is 16:02:59.3.
- With purely geometric positions of both (Horizons `VECTORS`, no light-time or
  aberration) every eclipse peak lands 32 to 44 s later: 16:03:42.0 for 18
  July. `breaker-event-times.json` keeps that second solve for all nine
  eclipses. It is not a convention anyone publishes, and it is recorded only
  to show how much the choice matters. The builder's note that a geometric
  Moon alone would move the peak about 1.3 s was not solved by either session.

## E2: the inventory

Checked against the breaker's own Horizons solve and NASA's eclipse pages, not
the site's data files.

- **Full moons:** 12 between 22 January and 13 December 2027. The one before
  is 24 December 2026 and the one after is 12 January 2028. No month holds two.
- **Eclipses:** 5, the same five NASA lists.
- **Retrogrades with a page of their own** (`RETRO_PAGE_PLANETS` on `main` is
  Mercury, Venus, Mars): Mars from 10 January, Mercury from 9 February, 10
  June and 7 October. Venus has none in 2027. Each page covers the start, the
  end and both shadow edges.
- **Sign changes with a page** (slow planets only on `main`): Jupiter into
  Virgo on 26 July. The neighbours are Leo on 30 June 2026 and Libra on 24
  August 2028, so Jupiter does not cross back in 2027.
- No page exists for an event that does not occur.

For the owner to decide, since ZOD-211 says "one page per ... retrograde ...
and ingress" and adds "that the format and the sky data call for":

- The 2027 retrogrades of Jupiter, Saturn, Uranus, Neptune and Pluto have no
  page. They never had one on `main`; they are rows on `/retrogrades/`.
- The Sun's twelve sign changes and those of Mercury, Venus and Mars have no
  dated page. That is also how `main` is.
- The 13 new moon pages and 8 slow-planet aspect pages of 2027 exist and keep
  their older template readings. ZOD-211 does not name them.

## E4: style guide and format

The style guide was read in full from its artifact (revision 1) in this
session.

**Holds on all 22 pages**

- The reading opens with one sentence of advice. No sky detail comes before it
  inside the reading. (The page's heading, date and time sit above it.)
- "Why", "Try it" and a last line that names a real later event and links it.
- Sky terms are explained where they first appear in the reading: full moon,
  solar eclipse, penumbral eclipse, moving backward, the sign.
- "Astrologers read", "they link": nothing is claimed as certain.
- No health, money or outcome claim. No fear words. No em or en dash.
- "Reading confidence 40%" on every page.
- The 1023 format: the same five-clock table component and classes as
  `/full-moon-calendar/2027/`, a visible Updated date that is also
  `dateModified` and the sitemap date, and 4 to 7 questions mirrored in
  FAQPage data.

**Departs from the guide**

- Length. The guide says about 80 to 100 words and two or three "why"
  sentences. Counted with the "Why:" and "Try it:" labels, the readings run 88
  to 124 words; 18 of 22 are over 100, and 18 of 22 have four "why" sentences.
  The builder said so. The guide's named fails (advice buried, unplain words
  throughout, no reason to return) are not triggered.
- The parts of the page below the reading were not rewritten and still carry
  unexplained terms and one claim stated as fact, for example "Neptune sextile
  Pluto" and "Pluto turns direct 3 days away. A stalled thread starts moving."

## E5

- PR 1030: open, draft, base `main`, head `7953051aa`, one commit by Zodiacs
  Admin <admin@zodiacs.org>, no trailer, no model name.
- No tag points at the head. The remote has no tags and no releases.
- `git diff origin/main...HEAD` touches 40 files, all in the site repo: the
  event pages, their evidence, tests, and the sitemap.
- Engine PRs 91 and 92 show as merged on GitHub at 2026-11-13 16:43:03 and
  16:43:04 UTC by the `zodiacs-org` account. That is two minutes before this
  job's branch was created (16:45:17 UTC) and before its builder session was
  launched (16:45:23 UTC). Nothing in this job's branch, commit or PR refers
  to them. This session did not touch them. Who merged them is outside what
  this session can see.

## Should-fix (none blocks E1 to E5)

1. **Missing spaces in the sources paragraph, 17 pages.** On every 2027 full
   moon and eclipse page, "Behind this event" reads "…its Horizons
   service.So does the exact instant on this page.Other instants…". The
   conditional sentence in `src/components/events/EventEvidence.astro` is
   joined without spaces.
2. **The same two events print a different minute elsewhere on the site.**
   The builder named `/full-moon-calendar/`, `/eclipses/`, their translations,
   the all-years calendar files and the AI tools. The built site also shows the
   older minute on `/sky-calendar/` (six languages), `/moon-journal/` (five
   languages), `/your-2027-sky/` (five languages), seven of the twelve
   `/horoscopes/{sign}/2027/` pages, `/api/v1/moon-phases/2027.json` and
   `/api/v1/eclipses/2027.json`. A reader who follows "Every full moon, dated"
   from the 15 October page lands on 13:46. Owner's call, as the builder said.
3. **CI check "Changed pages carry new sitemap dates" fails because of this
   branch.** 35 pages are dated 2026-11-14 and the check ran for edition
   2026-11-13: the commit was made at 17:48 UTC on 13 November, when it was
   already the 14th in Bangkok. The printed "Updated November 14, 2026" was a
   day ahead in UTC when it was written. The check should pass on a rerun
   after 00:00 UTC on 14 November. Not waited for here.
4. **`scripts/phase1-acceptance-evidence.test.mjs` fails locally**, as the
   builder reported: the stored template fingerprint no longer matches. It was
   rerun here and fails the same way. Not checked on `main`.
5. **Reading length**, above.
6. **The 1.3 s figure** in the builder's README is an estimate that neither
   session solved. Say so there, or solve it.
7. Older template wording kept on these pages, not introduced by this branch:
   "Crosses back from Leo into Virgo" beside a retrograde that goes from Virgo
   into Leo, and the prompt "What does Mars retrograde in Leo mean?".

## Rerun

```bash
python3 docs/platform/evidence/2027-event-pages-breaker-20261114/tools/breaker_solve.py
npm run build
python3 docs/platform/evidence/2027-event-pages-breaker-20261114/tools/breaker_check_pages.py
```

The kept responses are read from `HORIZONS_RAW` (default
`/workspace/runs/fable-jobs/job10/breaker-horizons-raw`). Without them the
solver fetches all 145 again, about four minutes.
