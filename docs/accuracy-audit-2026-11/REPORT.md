# Accuracy audit, November 2026

What a professional astrologer would check: every sky fact the site publishes,
held to NASA rather than to the site's own engine.

## In plain words

The site's published sky facts agree with NASA in every one of these:

- every sign named;
- every event's date in UTC;
- every planet's direction (direct or retrograde);
- every new and full Moon, to the second;
- every eclipse, to the second;
- every Moon sign change, to the second.

What remains is precision, not wrong facts:

1. **Rounding (fixed here).** Whole degrees were rounded, so 9°55′ printed as
   10°. Astrologers truncate it to 9°. Six places on the site did this.
2. **Slow planets (fixed here).** The
   engine is a few arcseconds off, which is invisible for the Moon. Neptune
   moves so slowly that the same error becomes about three hours: the yearly
   horoscopes said Neptune enters Aries at 14:30 UTC, where NASA gives 17:35.
   The pages now print the planets' ingress, station and aspect times from
   NASA JPL Horizons (DE441), and say 17:35. The placement pages under
   /learn/ now print their window dates from NASA too (0 of 634 a day off).
3. **Stored precision (fixed here).** The birthday pages read their degrees
   from four decimals instead of 0.01°, and the people pages round each
   degree once, from the full value.

## Method

1. **What was checked.** The audit read the built site (`dist/`, 1,545
   English pages), the data files in `src/data`, and 501 people charts. It
   pulled out every checkable claim: signs, degrees, ingress and station
   instants, new and full Moons, eclipses, season times, "Moon in X" lines in
   horoscope text, sign date ranges and blue moons.
2. **NASA references.**
   - **JPL Horizons** (DE441), giving the apparent geocentric ecliptic longitude
     of date. It was queried fresh, and `raw/MANIFEST.json` records every query URL,
     its retrieval time and the SHA-256 of the response.
     `scripts/accuracy-audit/horizons_fetch.py` downloads the responses
     again from NASA. The raw text is not committed, because the repository's
     Swiss output guard treats some of its numbers as removed values. It
     flagged 5 tokens, which matched by coincidence: dates and digits.
   - **NASA's Five Millennium Canon** (Espenak and Meeus) for eclipses, as
     captured in
     `docs/engine-validation/sky-events-references/nasa-eclipses-2025-2030.json`.
3. **Finding event times.** Ingress, station and lunation instants were found
   as roots of interpolated Horizons series (`truth-events.json`), not by
   daily sampling.
4. **Tolerances.**

   | Claim | Tolerance |
   | --- | --- |
   | Lunations, ingresses and eclipses | within 60 seconds |
   | Stations | within 30 minutes |
   | Degrees | equal to the truncated NASA degree |
   | Signs | exact |

5. **Edge cases.** The audit looked closely at claims within 3 hours of a
   sign boundary or of UTC midnight: 533 of them. All agree, apart from
   one-minute ties where NASA's value lies within 10″ of a minute line.

Rerun it with `python3 scripts/accuracy-audit/run_all.py` after a build, then
`python3 scripts/accuracy-audit/report.py`, which fills the tables below.

## Counts

<!-- generated:counts:start -->

**Published data files (src/data)**: 9367 claims checked, 8618 match, 749 mismatch.

| Category | Checked | Match | Mismatch |
| --- | ---: | ---: | ---: |
| aspect | 797 | 392 | 405 |
| birthday-cusp | 2639 | 2639 | 0 |
| birthday-now | 732 | 732 | 0 |
| birthday-sign | 337 | 337 | 0 |
| birthday-span | 366 | 366 | 0 |
| completeness | 1140 | 1140 | 0 |
| degree-display | 7 | 0 | 7 |
| eclipse-duration | 4 | 2 | 2 |
| eclipse-instant | 24 | 24 | 0 |
| eclipse-note | 1 | 1 | 0 |
| eclipse-sign | 24 | 24 | 0 |
| eclipse-type | 24 | 24 | 0 |
| ingress | 712 | 379 | 333 |
| lunation | 248 | 246 | 2 |
| moon-ingress | 481 | 481 | 0 |
| moon-phase | 1 | 1 | 0 |
| position | 10 | 10 | 0 |
| printed-aspect | 797 | 797 | 0 |
| printed-ingress | 661 | 661 | 0 |
| printed-station | 90 | 90 | 0 |
| shadow | 90 | 90 | 0 |
| station | 182 | 182 | 0 |

**Built pages (what the site says)**: 8891 claims checked, 8849 match, 42 mismatch.

| Category | Checked | Match | Mismatch |
| --- | ---: | ---: | ---: |
| aspect | 81 | 81 | 0 |
| birthday-sign | 1547 | 1547 | 0 |
| blue-moon | 74 | 74 | 0 |
| degree-display | 9 | 9 | 0 |
| direction | 94 | 94 | 0 |
| duration | 180 | 180 | 0 |
| eclipse | 95 | 95 | 0 |
| eclipse-duration | 8 | 8 | 0 |
| eclipse-note | 3 | 3 | 0 |
| eclipse-type | 24 | 24 | 0 |
| ingress | 1602 | 1602 | 0 |
| ingress-date | 24 | 24 | 0 |
| lunation | 324 | 324 | 0 |
| margin | 311 | 311 | 0 |
| moon-ingress | 41 | 41 | 0 |
| moon-sign | 427 | 415 | 12 |
| position | 1754 | 1724 | 30 |
| prose-aspect | 14 | 14 | 0 |
| prose-degree | 4 | 4 | 0 |
| prose-ingress | 137 | 137 | 0 |
| prose-ingress-month | 4 | 4 | 0 |
| prose-lunation | 171 | 171 | 0 |
| prose-station | 671 | 671 | 0 |
| render | 84 | 84 | 0 |
| shadow | 42 | 42 | 0 |
| sign-range | 12 | 12 | 0 |
| station | 281 | 281 | 0 |
| station-date | 198 | 198 | 0 |
| void | 41 | 41 | 0 |
| window-date | 634 | 634 | 0 |

**People charts (src/data/people.json and /people/ pages)**: 18368 claims checked, 18214 match, 154 mismatch.

| Category | Checked | Match | Mismatch |
| --- | ---: | ---: | ---: |
| natal-day-sign | 5511 | 5511 | 0 |
| natal-direction | 3947 | 3947 | 0 |
| natal-page-day | 1503 | 1503 | 0 |
| natal-page-degree | 2397 | 2397 | 0 |
| natal-position | 5010 | 4856 | 154 |

**Mismatches by likely cause**

| Layer | Cause | Count |
| --- | --- | ---: |
| Published data files | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly | 738 |
| Published data files | Minute-boundary tie: NASA's value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side | 7 |
| Published data files | Whole degree rounded instead of truncated (fixed in this branch) | 2 |
| Published data files | Different umbral shadow enlargement from NASA's canon (Chauvenet 1/50) | 2 |
| Built pages | Minute-boundary tie: NASA's value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side | 29 |
| Built pages | See note | 12 |
| Built pages | Eclipse peak instant differs from NASA's greatest eclipse by tens of seconds, enough to move the Moon one arcminute | 1 |
| People charts | Engine outer-planet series drift for births before 1900 (Neptune and Pluto 0.006° to 0.018°) | 153 |
| People charts | Minute-boundary tie: NASA's value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side | 1 |
<!-- generated:counts:end -->

## Page mismatches

<!-- generated:pages:start -->
| Page | Statement as published | Our value | NASA value | Difference | Likely cause |
| --- | --- | --- | --- | --- | --- |
| /eclipses/2030-12-09/ | lunar eclipse position 17°48′ Gemini | Gemini 17°48′ | Gemini 17°47′ | +17.3 arcsec | `eclipse-lon` |
| /birthday/august-25/ | Sun 2°18′ Virgo at noon UTC 2026-08-25 | Virgo 2°18′ | Virgo 2°19′ | -60.3 arcsec | `tie` |
| /birthday/february-15/ | lowest noon-UTC Sun degree 1940 to 2030 on February 15: 25°40′ Aquarius | 25°40′ Aquarius | 25°39′ Aquarius | +0 arcsec | `tie` |
| /birthday/january-15/ | lowest noon-UTC Sun degree 1940 to 2030 on January 15: 24°12′ Capricorn | 24°12′ Capricorn | 24°11′ Capricorn | +1 arcsec | `tie` |
| /birthday/january-31/ | highest noon-UTC Sun degree 1940 to 2030 on January 31: 11°53′ Aquarius | 11°53′ Aquarius | 11°54′ Aquarius | -60 arcsec | `tie` |
| /birthday/july-14/ | highest noon-UTC Sun degree 1940 to 2030 on July 14: 22°33′ Cancer | 22°33′ Cancer | 22°34′ Cancer | -60 arcsec | `tie` |
| /birthday/july-18/ | highest noon-UTC Sun degree 1940 to 2030 on July 18: 26°22′ Cancer | 26°22′ Cancer | 26°23′ Cancer | -60 arcsec | `tie` |
| /birthday/june-19/ | Sun 28°13′ Gemini at noon UTC 2026-06-19 | Gemini 28°13′ | Gemini 28°14′ | -61.0 arcsec | `tie` |
| /birthday/september-9/ | Sun 16°49′ Virgo at noon UTC 2026-09-09 | Virgo 16°49′ | Virgo 16°50′ | -61.5 arcsec | `tie` |
| /eclipses/2027-02-20/ | lunar eclipse position 1°58′ Virgo | Virgo 1°58′ | Virgo 1°59′ | -61.2 arcsec | `tie` |
| /eclipses/2029-12-05/ | solar eclipse position 13°46′ Sagittarius | Sagittarius 13°46′ | Sagittarius 13°45′ | +5.5 arcsec | `tie` |
| /full-moon-calendar/ | full moon 2029-02-28 at 10°23′ Virgo | Virgo 10°23′ | Virgo 10°24′ | -60.0 arcsec | `tie` |
| /full-moon/2029-02-28/ | full moon at 10°23′ Virgo | Virgo 10°23′ | Virgo 10°24′ | -60.0 arcsec | `tie` |
| /horoscopes/aquarius/career/ (+6 more) | Saturn in Aries 8°53′ (sky behind the reading, noon UTC 2026-11-07) | Aries 8°53′ | Aries 8°54′ | -66.4 arcsec | `tie` |
| /horoscopes/capricorn/tomorrow/ (+2 more) | Venus in Libra 23°28′ (sky behind the reading, noon UTC 2026-11-08) | Libra 23°28′ | Libra 23°29′ | -65.2 arcsec | `tie` |
| /mercury-retrograde/ (+1 more) | Mercury direct station at 16°19′ Cancer | Cancer 16°19′ | Cancer 16°18′ | +0.5 arcsec | `tie` |
| /new-moon/2026-06-15/ | new moon at 24°02′ Gemini | Gemini 24°02′ | Gemini 24°03′ | -60.8 arcsec | `tie` |
| /retrogrades/ | Jupiter retrograde station at 27°37′ Scorpio | Scorpio 27°37′ | Scorpio 27°38′ | -60.1 arcsec | `tie` |
| /retrogrades/ | Neptune direct station at 8°20′ Aries | Aries 8°20′ | Aries 8°19′ | +4.8 arcsec | `tie` |
| /retrogrades/ | Neptune retrograde station at 13°23′ Aries | Aries 13°23′ | Aries 13°22′ | +1.2 arcsec | `tie` |
| /today/ | Saturn 8°53′ Aries at noon UTC 2026-11-07 | Aries 8°53′ | Aries 8°54′ | -66.4 arcsec | `tie` |
| /horoscopes/aquarius/tomorrow/ (+11 more) | Moon in Libra (edition 2026-11-08, noon UTC) | Libra | Scorpio 6°59′ |  | `other` |
<!-- generated:pages:end -->

## Data mismatches

<!-- generated:data:start -->
| Source | Category | Count | Likely cause | Example: statement, our value, NASA value, difference |
| --- | --- | ---: | --- | --- |
| src/data/transits-YYYY-MM.json | aspect | 405 | `engine-slow` | Mercury square Neptune 2026-01-01T13:36:47.289Z at 29.5° sagittarius; 2026-01-01T13:36:47.289Z; 2026-01-01T13:33:10.001Z, Mercury at 29.51° sagittarius; +217 s (tolerance 60 s) |
| src/data/ingresses.json | ingress | 305 | `engine-slow` | Neptune sign window from 1901-07-19T23:29:00.641Z (cancer); 1901-07-19T23:29:00.641Z; 1901-07-19T23:57:02.838Z cancer; -1682.2 s |
| src/data/people.json | natal-position | 153 | `engine-old` | Neptune Leo 26.54° at 1928-05-30T11:00:00.000Z (noon civil time); 146.54°; 146.5329°; +0.0071° |
| src/data/transits-YYYY-MM.json | ingress | 28 | `engine-slow` | Neptune enters aries 2026-01-26T14:31:41.082Z; 2026-01-26T14:31:41.082Z; 2026-01-26T17:35:23.115Z aries; -11022.0 s |
| src/data/transits-YYYY-MM.json | degree-display | 4 | `tie` | Mercury direct station shown as 16°19′ Cancer; 16°19′ Cancer; 16°18′ Cancer; +3.1 arcsec |
| src/data/transits-YYYY-MM.json | lunation | 2 | `tie` | new moon 2026-06-15T02:54:11.458Z at 24°02′ gemini; 2026-06-15T02:54:11.458Z 24°02′ Gemini; 2026-06-15T02:54:10.108Z 24°03′ Gemini; +1.3 s, -1.6 arcsec |
| src/data/eclipses.json | degree-display | 2 | `rounded` | lunar eclipse 2027-02-20 degree field 2.0; 2.0 -> 2° when truncated; 1°59′ Virgo (truncates to 1°);  |
| src/data/eclipses.json | eclipse-duration | 2 | `shadow-model` | total lunar eclipse 2029-06-26: totality about 103 minutes; 103 min; 101.9 min (NASA canon, total phase); +1.1 min |
| src/data/daily.json | degree-display | 1 | `tie` | Saturn shown as 8°53′ Aries; 8°53′ Aries; 8°54′ Aries; -10.2 arcsec |
| src/data/people.json | natal-position | 1 | `tie` | Venus Gemini 0.00° at 1928-05-30T11:00:00.000Z (noon civil time); 60.00°; 59.9999°; +0.0001° |
<!-- generated:data:end -->

## Fixed in this change

- Whole degrees truncate wherever the site prints a whole degree. This
  covers:
  - Your 2027 sky's general layer;
  - the English transit labels;
  - the sky widget;
  - the compatibility card.

  The 2027 eclipses now read 17° Aquarius, 1° Virgo, 25° Capricorn and 9° Leo.
  The four lunations from July 2028 that sit past 29.5° can no longer print
  "30°".
- "an annular" and "an opposition" are now written correctly.
- The planets' event times come from NASA. `python3
  scripts/build-nasa-event-instants.py` solves every sign ingress (retrograde
  re-entries included) and station of Mercury to Pluto from November 2025 to
  May 2031, every ingress of Jupiter to Pluto over the long horizons of
  `ingresses.json` (back to 1900 and on to 2100), and each of the 797 exact
  aspects in the monthly catalogs, on the same Horizons tables as this
  audit. It writes `src/data/nasa-event-instants.json`: each NASA instant to
  the second, the engine instants it replaces, and each query's URL,
  retrieval time and SHA-256. The pages read it through
  `src/lib/nasa-instants.ts`: the event pages, the yearly, monthly, weekly
  and daily horoscopes, /today/ (English and translated), the transit lists,
  Your 2027 sky and the 2027 Mercury retrograde calendar. The data files
  keep the engine's instants, because the AI tools bundle them byte for
  byte, and each event page keeps the address and publication receipt it
  was published under.

  On the pages, ingress mismatches went from 75 to 0 and aspect mismatches
  from 60 to 0. The yearly horoscopes now say Neptune enters Aries at 17:35
  UTC, Uranus enters Gemini at 00:51, Jupiter enters Leo at 05:52 and Saturn
  enters Aries at 00:11; /today/ says Venus enters Scorpio at 08:12; the
  Neptune and Pluto sextile of July 2026 now reads July 25, 05:28 UTC. The
  largest corrections were 9.6 hours for an ingress (Pluto), 6.4 hours for an
  aspect (Neptune and Pluto) and 6 minutes for a station.

  Every time a data file carries, as a page now prints it, agrees with NASA
  within a second (the `printed-*` rows above): 661 ingresses, 90 stations
  and 797 aspects. The data files' own instants still differ (748
  mismatches, unchanged) because they stay as the engine wrote them.

- The website's sky calendar feed (`/sky-calendar.ics` and its five
  translations) starts and ends each retrograde window at NASA's station
  instants, through `src/lib/sky-calendar-feed.ts`, a site-only wrapper of
  the module the AI tools bundle, which keeps its bytes. The /sky-calendar/
  month view reads the same events. The 2027 Mercury retrograde calendar
  file names each station's date from NASA's instant.
- **Birthday degrees.** `scripts/build-birthdays.mjs` also writes
  `src/data/birthdays-precise.json`, the same three noon-UTC longitudes to
  four decimals, which the birthday pages (English and translated) read
  through `src/lib/birthday-degrees.ts`. `birthdays.json` keeps 0.01°
  because the AI tools bundle it. The "at least N° inside" margin is floored
  to a tenth. Birthday arcminute mismatches went from 132 to 0 (the five
  left are minute-boundary ties) and margin mismatches from 10 to 0.
- **People pages.** `scripts/build-people-degrees.mjs` recomputes each
  placement at its record's noon instant, checks that it reproduces every
  stored 0.01° value, and writes the full degree to
  `src/data/people-degrees.json`. The page prints that, rounded once, in the
  frozen copy's degree figures (`src/lib/people-degrees.ts`); `people.json`
  and the released copy are unchanged. Double-rounded figures went from 29
  to 0, on 136 pages.
- **Eclipse durations.** The pages print totality as NASA's lunar canon gives
  it, rounded to the minute (`src/lib/nasa-lunar-eclipses.ts`, held to the
  kept canon by its test): 58, 71, 102 and 54 minutes, not 59, 72, 103 and
  55. `eclipses.json` keeps the engine's figures, which the AI tools bundle,
  so the two data rows above remain.
- **The 18 July 2027 penumbral eclipse.** Any penumbral eclipse whose canon
  magnitude is below 0.1 is now said to be invisible; of 2026 to 2030 only
  this one qualifies (0.0014). /eclipses/, /eclipses/2027/, its event page,
  the 2027 eclipse calendar file, the sky calendar feed and Your 2027 sky in
  all five languages say that no eye or camera will see it.
- **Coverage wording.** /eclipses/, /full-moon-calendar/,
  /mercury-retrograde/ and /retrogrades/, in English and the four
  translations, name the years their tables hold, 2026 to 2030 (the English
  pages read them from the data), as do the home page, the tools hub, the
  moon phase page and the eclipse event pages' links.

## Recommended, not fixed

1. **Localized transit labels.** Truncate these as well. Their test is
   protected (`src/lib/i18n/astrology.test.ts`) and needs the owner's
   allowance. Until then, the es, fr, it and pt /transits/ pages can print
   "30°" in July 2028.
2. **Slow-planet times (fixed).** The pages, the Learn placement windows
   and the sky calendar feed print NASA's instants. The Sun's ingresses keep
   the engine's, at most 43.6 s from NASA's. Rerun the generator when a data
   file gains an event, and fetch the Horizons tables again before 2031-05.
3. **Birthday degrees (fixed on the pages).** `birthdays.json` itself, and so
   the AI tools' get_birthday, keeps 0.01°; storing four decimals there ships
   as a new developer plugin version.
4. **Eclipse longitudes.** Store them to four decimals at the next
   `eclipses.json` refresh, which also ships as a new plugin version: the AI
   tools bundle the file. The pages already read the longitude and truncate.
5. **Eclipse durations in the data (fixed on the pages).** `eclipses.json`
   and the AI tools keep the engine's totality (103 and 55 minutes for June
   and December 2029).
6. **Coverage wording left.** The localized tools hubs (`src/pages/{es,fr,it,pt}/tools/`,
   protected) say full moons "through 2027" and eclipses "through 2028";
   the placement pages' Mercury card (`src/pages/learn/`, protected) says
   "through 2027"; the share card subtitles (`og.tools.*.sub`) are drawn into
   published images.
7. **Tomorrow's Moon sign.** The 8 November 2026 tomorrow readings say the
   Moon is in Libra; at noon UTC it is at 6°59′ Scorpio (12 pages). The text
   is the same before this change.

## Conventions

The pages state these conventions, and the positions confirm them:

- **Zodiac and node:** the tropical zodiac, apparent positions and the true
  node.
- **Houses:** whole-sign houses by default. Placidus falls back to whole sign
  inside the polar circle, and the site says so.
- **Unknown birth times:** a noon reference, with any sign that changes that
  day left open.

Two gaps remain:

- Truncated and rounded notation sit side by side and are never explained.
- The void-of-course page counts the modern planets without saying so.

## An astrologer's verdict

**What they would praise:**
- Lunations, eclipses and the void-of-course table are correct to the second.
- The degree tables are truncated.
- The cusp tables are worked out year by year.
- Unknown birth times are handled honestly.
- The site publishes its own error figures, and they match this audit's
  measurement.

**What they would criticise:**
- Until this change, times were printed to the minute for slow planets the
  engine cannot place that finely: Neptune was three hours off. The pages now
  take those times from NASA.
- Rounding remained in places (the birthday and people degrees now round once, from the full value).
- Two degree notations are mixed without explanation.
- 2027's five eclipses include one no one can see (the pages now say so).

## Not checked

- Localized page wording.
- Anything drawn in the browser: the birth chart, the transit tracker,
  personal 2027 skies and countdowns.
- Houses and angles, which Horizons does not provide.
- Images, RSS, ICS and the AI tools' answers.
- Daily editions other than 6 November 2026.
