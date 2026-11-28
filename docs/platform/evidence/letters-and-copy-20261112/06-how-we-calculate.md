# DRAFT page: How we calculate. Not published.

**Status: draft for review (ZOD-108). No page was added or changed on the
site.** `https://zodiacs.org/how-we-calculate/` returned 404 when this job
fetched it on 2026-11-11 at 18:16 UTC. `[L-HWC-404]` `src/pages/` is
untouched on this branch.

This file has three parts:

1. **The page draft.** Copy for a page to sit beside the live methodology
   page (`https://zodiacs.org/methodology/`).
2. **Held sentences.** Accuracy and timing figures that the evidence would
   support in some form but that need the owner's decision, and what each
   rests on. None is approved here.
3. **Flags on the live methodology page.** Sentences on that page that jobs
   1 to 4 put in question. The page was not changed.

Bracketed keys are citations for the reviewing session (`SOURCES.md`). They
come out before anything is published.

**No public accuracy sentence is approved by this draft.** Jobs 1 and 2 both
said the same of their own work. `[J1-README]` `[J2-ACC]`

---

## Part 1. The page draft

> # How we calculate
>
> The charts on Zodiacs.org and the answers of its connector for AI
> assistants are calculated by one piece of software, the Zodiacs engine.
> `[S-PKG]` `[L-CAPS]` This page says what it calculates, what it relies on,
> and where its limits are.
>
> ## The engine and its source of positions
>
> The site runs `@zodiacs/engine` version 1.1.0-rc.2. `[S-PKG]` The Zodiacs
> connector for AI assistants reports the same version. `[L-CAPS]`
>
> The engine takes the positions of the Sun, the Moon and the planets from
> Astronomy Engine 2.1.19, an open-source library. `[L-CAPS]` `[S-PKG]`
> `[E-README-EPH]`
>
> That is the only source of positions in use here today. `[L-CAPS]` The
> engine also has a second, optional path that reads positions from a file
> refitted from NASA JPL's DE440 ephemeris. `[E-DE440-PACK]` That path does
> not answer on this site or in the connector at present. `[L-CAPS]`
> `[S-PR943]`
>
> ## What kind of position
>
> - Positions are geocentric and tropical. `[L-CAPS]` (`conventions.zodiac`,
>   `limitations[0]`)
> - Planets are given on the ecliptic of date, with aberration applied and
>   without the Sun's deflection of light. `[L-CAPS]`
>   (`conventions.planetPositions`)
> - The Moon is taken from Astronomy Engine's geocentric Moon, without
>   light-time and without aberration. `[L-CAPS]`
>   (`conventions.moonPosition`)
> - Nutation follows the IAU 2000B model. `[L-CAPS]` (`conventions.nutation`)
> - The lunar node is the true node, taken from the plane of the Moon's orbit
>   at that instant. `[L-CAPS]` (`conventions.moonNodes`)
> - Natal aspects are the major aspects between the Sun, the Moon and the
>   eight planets. The nodes are not included. `[L-CAPS]`
>   (`conventions.aspects`)
>
> ## Clock time
>
> A birth time is a reading of a clock, and the sky is calculated on a
> uniform time scale. The engine has to convert one to the other.
>
> - From 1972 to 2 October 2027 it reads a time as UTC. Uniform time comes
>   from the IERS leap seconds, and the Earth's rotation from the IERS values
>   of UT1 − UTC. `[L-METH]` (line 31) `[L-CAPS]` (`conventions.timeScale`)
>   Those values come from the IERS file of 24 September 2026, which holds
>   measurements and predictions. `[S-RC2-NOTICE]` `[L-METH]` (line 31)
> - For other dates it uses a model of ΔT, the difference between uniform
>   time and the Earth's rotation. `[L-METH]` (line 31) `[L-CAPS]` Each result states
>   the value used. `[L-CAPS]` (`conventions.deltaT`)
> - Far in the future the Earth's rotation is not known, and no one's
>   forecast of it can be checked yet. NASA JPL's Horizons service, for
>   example, keeps its last predicted value for all later dates.
>   `[T-HZ-MANUAL]` Two careful programs can therefore place the Moon
>   differently for the same future clock time while agreeing about the
>   Moon's path. `[J1-BREAKER]` (finding 1, resting on `[T-HZ-MANUAL]`)
>
> ## Local time and time zones
>
> - For dates from 1970 on, a local time is resolved with the time zone data
>   of the device or server doing the calculation. `[L-CAPS]`
>   (`conventions.localTime`) `[J1-README]` ("A fact about the tz data")
>   Devices carry different releases of that data, so for a few places and
>   dates the answer can depend on the device. `[J1-README]`
> - For dates before 1970 the engine uses a fixed release of the IANA time
>   zone database, 2025c, with its older historical records. `[L-CAPS]`
>   `[S-RC2-NOTICE]` `[L-METH]` (line 54)
> - A time in the hour that repeats when clocks go back is read as the
>   earlier of the two, and the result says so. `[J1-README]` (T1) `[L-METH]`
>   (line 53)
> - A time in the hour that is skipped when clocks go forward is moved
>   forward across the gap, and the result says so. `[J1-README]` (T2)
>   `[L-METH]` (line 52)
>
> ## When the birth time is unknown
>
> No rising sign or houses are given. `[L-METH]` (line 65) `[L-TOOLS]`
> (`get_natal_chart`)
>
> - On the site, positions are taken at 12:00 local civil time and the
>   Moon's sign is marked as unverified, because the Moon can change sign
>   during the day. `[L-METH]` (line 65)
> - In the connector, a birth date given alone is read at noon UTC
>   `[J2-BREAKER]` (N4), and on a day when the Moon changed sign the Moon's
>   sign is given as the two possibilities. `[L-TOOLS]` (`get_natal_chart`)
>
> ## Rising sign and houses
>
> The rising sign and the Midheaven are calculated from sidereal time, the
> birthplace and the true obliquity of the ecliptic. `[L-CAPS]`
> (`conventions.angles`) `[L-METH]` (line 34)
>
> Placidus houses are not defined inside the polar circles. There the chart
> uses whole sign houses and says so. `[L-METH]` (line 34) `[J1-README]` (T4)
>
> At the geographic poles, and at the moments when the ecliptic lies along
> the horizon, a rising sign is not defined. `[L-CAPS]`
> (`coverage.angleExclusions`)
>
> ## Dates covered
>
> 1800 to 2199. `[L-CAPS]` (`limits`) `[L-METH]` (line 66)
>
> ## Sign-change times
>
> The times printed on the site's pages for the planets' sign changes,
> stations and exact aspects from November 2025 to May 2031 are read from
> NASA JPL Horizons (the DE441 ephemeris). `[L-METH]` (line 47)
>
> The connector prints the engine's own times. `[J3-REPORT]` (other
> findings, item 2) For a slow planet the two can differ by hours, because a
> few arcseconds of position take a slow planet hours to cover. `[L-METH]`
> (line 47) Neptune's entry into Aries on 26 January 2026 is 17:35 UTC by
> Horizons and 14:31:41 UTC by the engine. `[L-METH]` (line 47)
> `[J3-REPORT]` (call 14) `[J2-SIGN]` (line 25)
>
> ## How close the positions are
>
> [HELD. See Part 2. The owner decides which sentence, if any, goes here.]
>
> ## Where the calculation happens
>
> On the site's own tools the chart is calculated in your browser. `[L-METH]`
> (line 62) In the connector for AI assistants it is calculated on our server
> from the details sent for that answer, and none of them is saved.
> `[L-PRIV]` (line 25) `[L-TOOLS]`
>
> ## What this is not
>
> The checks on this page are about where the planets are. They say nothing
> about what a placement means. Interpretations here are traditional
> astrology and are not predictions that have been tested. `[L-METH]`
> (line 67)
>
> ## Sources and licences
>
> - Astronomy Engine, by Don Cross, MIT licence. `[J2-LIC]` (second pass
>   table: its `LICENSE` reads "MIT License / Copyright (c) 2019-2025 Don
>   Cross")
> - ΔT before 1941: 32 values from Stephenson, Morrison and Hohenkerk (2016),
>   Proceedings of the Royal Society A 472, 20160404, used under CC BY 4.0.
>   `[S-RC2-NOTICE]` `[L-METH]` (line 31)
> - Leap seconds and UT1 − UTC: the International Earth Rotation and
>   Reference Systems Service. `[S-RC2-NOTICE]`
> - Time zone history: the IANA Time Zone Database. `[S-RC2-NOTICE]`
> - Place names: GeoNames, CC BY 4.0. `[L-METH]` (line 58)

---

## Part 2. Held sentences (owner decision; none approved)

The page needs something under "How close the positions are". Each
candidate below is true of what it names and of nothing wider. Each was
measured on a build other than the one the site runs (1.1.0-rc.2), except
candidate D.

| | Candidate statement | Rests on | What limits it |
| --- | --- | --- | --- |
| A | The engine's public test suite compares 240 positions with NASA JPL Horizons (DE441) at a tolerance of one arcsecond. The engine is within it for 48 and outside it for 192. The median difference in longitude is 2.083″ and the largest is 18.774″. | `[E-RESULTS]`; `[J2-ACC]` (A5, A9) | Measured on the engine's `main` (`bc0b5a7`, version 1.1.0-rc.3 `[E-PKG]`), not on rc.2. 24 instants, 1851 to 2148. `[J2-ACC]` (A1) It is the only candidate on the engine's `main`; candidate D's evidence is on the site's `main`. |
| B | Compared with JPL's DE440 at noon Terrestrial Time on each of 146,097 days from 1800 to 2199, the longitude of the Sun, the Moon and each planet stayed within 30″; the largest difference was 29.19″, for Pluto on the last day. | `[E-SWEEP]`; reviewed by `[J1-SWEEP]` (S2) | An **unmerged draft** (engine pull request 92), on rc.3. One instant a day; Terrestrial Time, so the clock is taken out; Mars to Pluto as system barycentres. `[E-SWEEP]` `[J1-SWEEP]` (finding 7) Pluto's margin is 0.81″ and still growing at the end of the span. `[E-SWEEP]` Against Horizons (DE441) the same build is at 29.69″ in longitude at the end of 2199 `[J1-README]` (P1), and job 1's second session found the whole angle over 30″ (30.32″) on each of the last 31 days. `[J1-BREAKER]` (finding 4; its responses are not committed) Job 1 and job 2 approve no sentence built on it. `[J1-SWEEP]` `[J2-ACC]` (A2) |
| C | The same comparison for the true node: the largest difference was 32.64″. | `[E-SWEEP]`; `[J1-SWEEP]` (S2) | Same limits as B. **The 30″ of B does not apply to the true node**, and a sentence that says "Sun, Moon and planets" must not be read to cover it. `[E-SWEEP]` `[J1-SWEEP]` |
| D | Compared with Swiss Ephemeris every tenth day from 1800 to 2026 (91,201 comparisons), the median difference in longitude is 2.0″ and the largest 22.9″ (Venus, 1878). | `[S-SWISS-MULTI]`, measured on 1.1.0-rc.2; printed on the live page `[L-METH]` (line 29) | The reference is Swiss Ephemeris, which the engine repository's rules do not accept as an arbiter of accuracy. `[J2-ACC]` (A6, A8) The same file's figure for 2027 to 2199, 29.108″ (Pluto), is not printed on the live page. `[S-SWISS-MULTI]` `[J2-ACC]` (A8) |

Also held, for the "Sign-change times" and "Clock time" sections:

| | Candidate statement | Rests on | What limits it |
| --- | --- | --- | --- |
| E | Against Horizons, the engine's sign changes for Neptune differ by a median of 2.46 hours and at most 9.51 hours (1848), and for Pluto by a median of 1.77 hours and at most 31.54 hours (2185), over 1800 to 2200. | `[J2-ACC]` (A10); `[J2-SIGN]`; reproduced by `[J2-BREAKER]` (N2) | One job's measurement on the engine's `main`. Its 176 Horizons requests did not carry the application name and contact JPL's fair-use policy asks for; a rerun is an owner call that has not been made. `[J2-BREAKER]` (S8) `[T-SSD-API]` |
| F | Given the same future clock time, the engine and Horizons place the Moon up to 36″ apart at the end of the span (36.23″ at 2199-06-15 12:00 UTC), because their forecasts of the Earth's rotation differ by 56.65 s; given the same instant of Terrestrial Time the Moon is within 3″. | `[J1-BREAKER]` (finding 1); `[J1-README]` (P1: Moon 2.94″ on TT); `[T-HZ-MANUAL]` | Five instants, three bodies, on rc.3; the responses are kept outside the repository and the session calls them "leads to rerun". `[J1-BREAKER]` Horizons is **not a reference for UT at future dates**: it holds its last predicted TDB−UT constant. `[T-HZ-MANUAL]` So this is a difference between two forecasts, not an error of either. |

What the page must not say, whichever is chosen (test L4):

- **Not** that the site, the connector or the hosted API "uses DE440" or
  "uses NASA's ephemeris". The live service reports astronomy-engine
  2.1.19 on engine 1.1.0-rc.2 `[L-CAPS]`; the site depends on the rc.2
  archive `[S-PKG]`; the DE440 backend is an open draft whose own text says
  a request "is answered by astronomy-engine" until it is validated.
  `[S-PR943]` Only the engine's guide says otherwise, in the present tense:
  "zodiacs.org's hosted compute API uses it on its server".
  `[E-DE440-HOSTED]` `[J2-ACC]` (A5) `[J2-BREAKER]` (S7)
- **Not** that the engine "passes all 240 position vectors". It passes 48
  and fails 192; the row with 240 passes is Swiss Ephemeris's.
  `[E-RESULTS]` `[J2-ACC]` (A9)
- **Not** that Horizons confirms a position at a future clock time, without
  the ΔT caveat in F. `[T-HZ-MANUAL]` `[J1-BREAKER]` (finding 1)
- **Not** that the true node is within 30″. `[E-SWEEP]` `[J1-SWEEP]`
- **Not** "within 30 arcseconds" beside "the date a planet changes sign" as
  if one supported the other: 30″ is about 31 hours for Pluto at the wrong
  moment. `[J2-ACC]` (A10)

---

## Part 3. Flags on the live methodology page

The page as fetched on 2026-11-11 at 18:16:44 UTC. `[L-METH]` Line numbers
are those of `raw/pages/methodology.txt`. **Nothing on the live page was
changed.** Each row is for the owner; "flag" means a reader could be misled
or the sentence has not been rechecked, not that it is proven false.

| Line | The live sentence | Flag | Evidence |
| --- | --- | --- | --- |
| 25 | "The whole of the Moon's disagreement with Swiss Ephemeris, which does apply both, is at most 7.6 arcseconds over the span measured below, with a median of 0.9" | **Swiss sentence.** An accuracy figure whose reference is Swiss Ephemeris. Not rechecked by jobs 1 to 4. | `[J2-ACC]` (A6, A8) |
| 26 | "positions are compared against NASA JPL Horizons reference data at two dates, 1907 and 2020, with tolerances of 0.05° for the Sun and planets" | Easy to over-read. 0.05° is 180″, at two dates. | `[J2-ACC]` (A8) |
| 27 to 29 | The section "Agreement with Swiss Ephemeris": "median ... 1.6 arcseconds ... largest is 18.6 arcseconds (Pluto in 1801)"; "91,201 comparisons, with a median of 2.0 arcseconds and a largest of 22.9 arcseconds (Venus in 1878)" | **Swiss section.** A public accuracy statement whose reference is Swiss Ephemeris. The 91,201 figures match the evidence file. The file's later-years figure (29.108″, Pluto, 2199) is not printed. The page does add "this is two implementations agreeing, not a check against observation" (line 32). | `[S-SWISS-MULTI]`; `[J2-ACC]` (A8); `[J2-BREAKER]` (S7) |
| 30 | "From 2100 to 2199 their values differ by 14.3 to 36.7 seconds ... The Moon moves about half an arcsecond per second of time, so the difference alone moves it by 7.0 to 23.4 arcseconds ... at the same UT within 20.5 arcseconds." | **Moon and ΔT sentence, possibly stale or too narrow.** "Their" is this engine and Swiss Ephemeris. Against Horizons on 2026-11-11, job 1's second session found 56.65 s and 36.23″ at one instant in 2199. The two references forecast ΔT differently, and Horizons holds its value constant, so the figures need not agree; but a reader will take 20.5″ as the size of the effect. The cause of the difference was not established. | `[J1-BREAKER]` (findings 1 and 12); `[T-HZ-MANUAL]` |
| 30 | "none of them reaches one arcminute: the largest is 24.8 arcseconds, Pluto at 2190" | Refers to the 20 preselected far-future cases. The every-tenth-day run has 29.108″ for 2027 to 2199. | `[S-SWISS-MULTI]`; `[J2-BREAKER]` (S7) |
| 47 | "By NASA, Neptune entered Aries at 17:35 UTC on January 26, 2026, about three hours later than the engine alone puts it." | The page is consistent with Horizons. The **connector** still prints the engine's time, 14:31:41 UTC, so the two public surfaces disagree (ZOD-63). | `[J3-REPORT]` (other findings, item 2); `[J2-SIGN]` (line 25) |
| 48 | "New and full Moons and the Moon's sign changes keep the engine's times, because every one of them falls within a minute of NASA's. The Sun's sign changes agree within 44 seconds." | Not rechecked by jobs 1 to 4. Job 4 notes that the thesis page prints ingress times to the millisecond that are up to a minute off. | `[J4-README]` ("Small, checkable errors", F8) |
| 49 | "In November 2026 we checked 8,891 statements on the built English pages against NASA, from sign dates to eclipse times, and 8,849 agreed." | An accuracy statement not rechecked by jobs 1 to 4; none of their files mentions either figure. Its evidence was not opened in this job. | `[L-METH]` (line 49); `BREAKER.md` (S7) |
| 31 | "From 1962 on it is within 0.09 seconds of the IERS value on every day" | Not rechecked by jobs 1 to 4, and its evidence was not opened in this job. | `[L-METH]` (line 31); `BREAKER.md` (S7) |
| 62 | "The entire chart calculation happens in your browser. Your birth date, time, and place are not sent to a chart API" | True of the site's own tools as the page describes them. Not true of the connector, whose chart tools calculate on the server from birth details the assistant sends. The page does not say which it means. | `[L-TOOLS]`; `[L-PRIV]` (line 25); `[J3-BREAKER]` (S5, item 2) |
| 64 | "Chiron and the asteroids aren't included yet ... they're planned via public-domain JPL data." | "Public-domain JPL data" depends on the source. JPL's Solar System Dynamics site says its data "are considered public domain". NAIF's rules for its kernels never use those words. | `[T-SSD-FAQ]`; `[T-NAIF-RULES]`; `[S-PA-NOTICE]` |
| 65 | "When birth time is unknown, the site uses 12:00 local civil time as a reference for body positions." | The connector uses noon UTC for a birth date given alone (`"basis":"utc-noon"`). Two surfaces, two conventions; the page describes the site's only. | `[J2-BREAKER]` (N4) |
| 34 | "Placidus is mathematically undefined inside the polar circle ... we fall back to whole sign and say so on the chart." | Consistent with job 1 for Placidus and Koch. Job 1 also found that at exactly ±90° every other system returns an ordinary, unflagged ascendant, and its second session found unflagged 180° flips of the ascendant inside the polar circle. The page is silent on both. | `[J1-README]` (T4); `[J1-BREAKER]` (finding 2) |
| 51 to 53 | "For births from 1970 on, we resolve your birth time with the IANA time-zone history in your browser's host ICU data" | Consistent with job 1. Job 1's second session found that host data already differs from the pinned release for some zones and dates (791 of 136,905 wall times tried, nine zone names, 2022 to 2036), so the answer can change with the device. The page does not say so. | `[J1-README]`; `[J1-BREAKER]` (finding 3; not committed) |

One stale sentence that is not on the methodology page but belongs beside
these: the engine's guide says "zodiacs.org's hosted compute API uses it
[DE440] on its server". `[E-DE440-HOSTED]` The live service does not.
`[L-CAPS]` `[S-PR943]` That file is in the engine repository and was not
changed.

## What Part 1 leaves out on purpose

- Any accuracy figure (Part 2).
- "VSOP87", "NOVAS" and the lineage of Astronomy Engine's series. The live
  page states them `[L-METH]` (line 24); this job did not open Astronomy
  Engine's own documentation, so the draft does not repeat them.
- The numbers behind host-dependent time zones and the polar ascendant
  (uncommitted leads from job 1's second session). `[J1-BREAKER]`
- The numerology, daily publication and aspect-orb sections of the
  methodology page, which stay there.

## For the owner

1. Which of A to F, if any, may be printed, and whether B waits for engine
   pull request 92 to merge and for a rerun on the build the site runs.
2. Whether the page should be at `/how-we-calculate/` beside
   `/methodology/`, or replace parts of it. The connector's own "How we
   calculate" link points to `/methodology/` today. `[L-CAPS]` (`links[0]`)
3. Whether to correct the flagged lines of the live page (Part 3) now or
   with this page.
4. Voice: the draft keeps to the house rules as this job read them (plain
   statements, no dashes in copy). It has not had a copy review.
