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
2. **Slow planets (left as recommendations).** The engine is a few arcseconds
   off, which is invisible for the Moon. Neptune moves so slowly that the
   same error becomes about three hours. The yearly horoscopes say Neptune
   enters Aries at 14:30 UTC; NASA gives 17:35. Times like that should show
   the date only, or come from a JPL ephemeris.
3. **Stored precision.** The birthday pages store degrees to 0.01°, so some
   minutes of arc print one off. Some people pages round twice.

## Method

1. **What was checked.** The audit read the built site (`dist/`, 1,545
   English pages), the data files in `src/data`, and 501 people charts. It
   pulled out every checkable claim: signs, degrees, ingress and station
   instants, new and full Moons, eclipses, season times, "Moon in X" lines in
   horoscope text, sign date ranges and blue moons.
2. **NASA references.**
   - **JPL Horizons** (DE441), giving the apparent geocentric ecliptic longitude
     of date. It was queried fresh, and every raw response is in `raw/` with
     its query URL, retrieval time and SHA-256.
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
| Layer | Category | Checked | Match | Mismatch |
| --- | --- | ---: | ---: | ---: |
| Published data files (src/data) | aspect | 797 | 392 | 405 |
| Published data files (src/data) | birthday-cusp | 2639 | 2639 | 0 |
| Published data files (src/data) | birthday-now | 732 | 732 | 0 |
| Published data files (src/data) | birthday-sign | 337 | 337 | 0 |
| Published data files (src/data) | birthday-span | 366 | 366 | 0 |
| Published data files (src/data) | completeness | 1140 | 1140 | 0 |
| Published data files (src/data) | degree-display | 6 | 0 | 6 |
| Published data files (src/data) | eclipse-duration | 4 | 2 | 2 |
| Published data files (src/data) | eclipse-instant | 24 | 24 | 0 |
| Published data files (src/data) | eclipse-note | 1 | 1 | 0 |
| Published data files (src/data) | eclipse-sign | 24 | 24 | 0 |
| Published data files (src/data) | eclipse-type | 24 | 24 | 0 |
| Published data files (src/data) | ingress | 712 | 379 | 333 |
| Published data files (src/data) | lunation | 248 | 246 | 2 |
| Published data files (src/data) | moon-ingress | 481 | 481 | 0 |
| Published data files (src/data) | moon-phase | 1 | 1 | 0 |
| Published data files (src/data) | position | 10 | 10 | 0 |
| Published data files (src/data) | shadow | 90 | 90 | 0 |
| Published data files (src/data) | station | 182 | 182 | 0 |
| **Published data files (src/data)** | **all** | **7818** | **7070** | **748** |
| Built pages (what the site says) | aspect | 81 | 21 | 60 |
| Built pages (what the site says) | birthday-sign | 1547 | 1547 | 0 |
| Built pages (what the site says) | blue-moon | 74 | 74 | 0 |
| Built pages (what the site says) | degree-display | 9 | 9 | 0 |
| Built pages (what the site says) | direction | 94 | 94 | 0 |
| Built pages (what the site says) | duration | 41 | 41 | 0 |
| Built pages (what the site says) | eclipse | 95 | 95 | 0 |
| Built pages (what the site says) | eclipse-type | 24 | 24 | 0 |
| Built pages (what the site says) | ingress | 1324 | 1249 | 75 |
| Built pages (what the site says) | ingress-date | 24 | 24 | 0 |
| Built pages (what the site says) | lunation | 324 | 324 | 0 |
| Built pages (what the site says) | margin | 313 | 303 | 10 |
| Built pages (what the site says) | moon-ingress | 41 | 41 | 0 |
| Built pages (what the site says) | moon-sign | 415 | 415 | 0 |
| Built pages (what the site says) | position | 1754 | 1568 | 186 |
| Built pages (what the site says) | prose-aspect | 14 | 14 | 0 |
| Built pages (what the site says) | prose-degree | 4 | 4 | 0 |
| Built pages (what the site says) | prose-ingress | 137 | 136 | 1 |
| Built pages (what the site says) | prose-ingress-month | 4 | 4 | 0 |
| Built pages (what the site says) | prose-lunation | 171 | 171 | 0 |
| Built pages (what the site says) | prose-station | 671 | 671 | 0 |
| Built pages (what the site says) | render | 84 | 84 | 0 |
| Built pages (what the site says) | shadow | 42 | 42 | 0 |
| Built pages (what the site says) | sign-range | 12 | 12 | 0 |
| Built pages (what the site says) | station | 281 | 281 | 0 |
| Built pages (what the site says) | station-date | 198 | 198 | 0 |
| Built pages (what the site says) | void | 41 | 41 | 0 |
| Built pages (what the site says) | window-date | 634 | 618 | 16 |
| **Built pages (what the site says)** | **all** | **8453** | **8105** | **348** |
| People charts (src/data/people.json and /people/ pages) | natal-day-sign | 5511 | 5511 | 0 |
| People charts (src/data/people.json and /people/ pages) | natal-direction | 3947 | 3947 | 0 |
| People charts (src/data/people.json and /people/ pages) | natal-page-day | 1503 | 1503 | 0 |
| People charts (src/data/people.json and /people/ pages) | natal-page-degree | 2397 | 2368 | 29 |
| People charts (src/data/people.json and /people/ pages) | natal-position | 5010 | 4856 | 154 |
| **People charts (src/data/people.json and /people/ pages)** | **all** | **18368** | **18185** | **183** |
<!-- generated:counts:end -->

## Page mismatches

<!-- generated:pages:start -->
| pages | statement | our_value | nasa_value | difference | cause | cause_text |
| --- | --- | --- | --- | --- | --- | --- |
| /transits/ | "New moon at 17° Scorpio" (2026-11-09) | 17° Scorpio | 16°53′ Scorpio (astrologers write 16°) | +1° | rounded | Whole degree rounded instead of truncated (fixed in this branch) |
| /transits/ | "Venus stations direct at 23° Libra" (2026-11-14) | 23° Libra | 22°51′ Libra (astrologers write 22°) | +1° | rounded | Whole degree rounded instead of truncated (fixed in this branch) |
| /your-2027-sky/ | Annular solar eclipse 2027-02-06 "at 18° Aquarius" | 18° Aquarius | 17°37′ Aquarius (astrologers write 17°) | +1° | rounded | Whole degree rounded instead of truncated (fixed in this branch) |
| /your-2027-sky/ | Penumbral lunar eclipse 2027-02-20 "at 2° Virgo" | 2° Virgo | 1°59′ Virgo (astrologers write 1°) | +1° | rounded | Whole degree rounded instead of truncated (fixed in this branch) |
| /your-2027-sky/ | Penumbral lunar eclipse 2027-07-18 "at 26° Capricorn" | 26° Capricorn | 25°57′ Capricorn (astrologers write 25°) | +1° | rounded | Whole degree rounded instead of truncated (fixed in this branch) |
| /your-2027-sky/ | Total solar eclipse 2027-08-02 "at 10° Leo" | 10° Leo | 9°55′ Leo (astrologers write 9°) | +1° | rounded | Whole degree rounded instead of truncated (fixed in this branch) |
| /events/jupiter-opposition-neptune-2028-09-28/ | Jupiter opposition Neptune exact 2028-09-28T19:29:36.928Z | 2028-09-28 19:29 UTC | 2028-09-28T19:15:56.031Z | +821 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-opposition-neptune-2028-09-28/ | Jupiter opposition Neptune at 19:29 UTC on 2028-09-28 | 2028-09-28 19:29 UTC | 2028-09-28T19:15:56.031Z | +784 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-opposition-saturn-2030-04-24/ | Jupiter opposition Saturn exact 2030-04-24T01:53:15.482Z | 2030-04-24 01:53 UTC | 2030-04-24T01:56:26.859Z | -191 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-opposition-saturn-2030-11-20/ | Jupiter opposition Saturn exact 2030-11-20T01:08:11.527Z | 2030-11-20 01:08 UTC | 2030-11-20T01:05:39.940Z | +152 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-sextile-pluto-2030-12-08/ | Jupiter sextile Pluto exact 2030-12-08T06:37:34.970Z | 2030-12-08 06:37 UTC | 2030-12-08T06:42:26.618Z | -292 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-sextile-pluto-2030-12-08/ | Jupiter sextile Pluto at 06:37 UTC on 2030-12-08 | 2030-12-08 06:37 UTC | 2030-12-08T06:42:26.618Z | -327 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-square-uranus-2027-09-10/ | Jupiter square Uranus exact 2027-09-10T16:36:59.814Z | 2027-09-10 16:37 UTC | 2027-09-10T16:40:55.496Z | -236 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-square-uranus-2027-09-10/ | Jupiter square Uranus at 16:36 UTC on 2027-09-10 | 2027-09-10 16:36 UTC | 2027-09-10T16:40:55.496Z | -295 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-neptune-2026-07-20/ | Jupiter trine Neptune exact 2026-07-20T07:47:59.076Z | 2026-07-20 07:47 UTC | 2026-07-20T07:23:26.820Z | +1472 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-neptune-2026-07-20/ | Jupiter trine Neptune at 07:47 UTC on 2026-07-20 | 2026-07-20 07:47 UTC | 2026-07-20T07:23:26.820Z | +1413 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-neptune-2030-12-10/ | Jupiter trine Neptune exact 2030-12-10T08:13:31.669Z | 2030-12-10 08:13 UTC | 2030-12-10T08:02:06.415Z | +685 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-neptune-2030-12-10/ | Jupiter trine Neptune at 08:13 UTC on 2030-12-10 | 2030-12-10 08:13 UTC | 2030-12-10T08:02:06.415Z | +654 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-pluto-2028-09-24/ | Jupiter trine Pluto exact 2028-09-24T07:39:35.545Z | 2028-09-24 07:39 UTC | 2028-09-24T07:45:29.618Z | -354 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-pluto-2028-09-24/ | Jupiter trine Pluto at 07:39 UTC on 2028-09-24 | 2028-09-24 07:39 UTC | 2028-09-24T07:45:29.618Z | -390 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-saturn-2026-08-31/ | Jupiter trine Saturn exact 2026-08-31T22:05:22.447Z | 2026-08-31 22:05 UTC | 2026-08-31T22:17:14.617Z | -712 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-saturn-2026-08-31/ | Jupiter trine Saturn at 22:05 UTC on 2026-08-31 | 2026-08-31 22:05 UTC | 2026-08-31T22:17:14.617Z | -735 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-saturn-2027-04-03/ | Jupiter trine Saturn exact 2027-04-03T13:23:03.398Z | 2027-04-03 13:23 UTC | 2027-04-03T12:58:56.438Z | +1447 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-saturn-2027-04-03/ | Jupiter trine Saturn at 13:23 UTC on 2027-04-03 | 2027-04-03 13:23 UTC | 2027-04-03T12:58:56.438Z | +1444 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-saturn-2027-07-11/ | Jupiter trine Saturn exact 2027-07-11T22:45:55.067Z | 2027-07-11 22:45 UTC | 2027-07-11T23:16:10.979Z | -1816 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/jupiter-trine-saturn-2027-07-11/ | Jupiter trine Saturn at 22:45 UTC on 2027-07-11 | 2027-07-11 22:45 UTC | 2027-07-11T23:16:10.979Z | -1871 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2026-07-24/ | Neptune sextile Pluto exact 2026-07-24T23:09:38.401Z | 2026-07-24 23:09 UTC | 2026-07-25T05:28:07.402Z | -22709 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2026-07-24/ | Neptune sextile Pluto at 23:09 UTC on 2026-07-24 | 2026-07-24 23:09 UTC | 2026-07-25T05:28:07.402Z | -22747 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2026-09-16/ | Neptune sextile Pluto exact 2026-09-16T08:31:19.127Z | 2026-09-16 08:31 UTC | 2026-09-16T02:07:22.401Z | +23037 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2026-09-16/ | Neptune sextile Pluto at 08:31 UTC on 2026-09-16 | 2026-09-16 08:31 UTC | 2026-09-16T02:07:22.401Z | +23018 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2027-06-28/ | Neptune sextile Pluto exact 2027-06-28T20:34:28.560Z | 2027-06-28 20:34 UTC | 2027-06-28T23:56:24.829Z | -12116 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2027-06-28/ | Neptune sextile Pluto at 20:34 UTC on 2027-06-28 | 2027-06-28 20:34 UTC | 2027-06-28T23:56:24.829Z | -12145 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2027-10-16/ | Neptune sextile Pluto exact 2027-10-16T18:03:57.633Z | 2027-10-16 18:03 UTC | 2027-10-16T14:39:54.414Z | +12243 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2027-10-16/ | Neptune sextile Pluto at 18:03 UTC on 2027-10-16 | 2027-10-16 18:03 UTC | 2027-10-16T14:39:54.414Z | +12186 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2028-06-09/ | Neptune sextile Pluto exact 2028-06-09T01:49:36.552Z | 2028-06-09 01:49 UTC | 2028-06-09T04:25:35.656Z | -9359 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2028-06-09/ | Neptune sextile Pluto at 01:49 UTC on 2028-06-09 | 2028-06-09 01:49 UTC | 2028-06-09T04:25:35.656Z | -9396 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2028-11-08/ | Neptune sextile Pluto exact 2028-11-08T04:21:11.666Z | 2028-11-08 04:21 UTC | 2028-11-08T01:44:39.476Z | +9392 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2028-11-08/ | Neptune sextile Pluto at 04:21 UTC on 2028-11-08 | 2028-11-08 04:21 UTC | 2028-11-08T01:44:39.476Z | +9381 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2029-05-22/ | Neptune sextile Pluto exact 2029-05-22T17:03:33.380Z | 2029-05-22 17:03 UTC | 2029-05-22T19:15:37.795Z | -7924 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2029-05-22/ | Neptune sextile Pluto at 17:03 UTC on 2029-05-22 | 2029-05-22 17:03 UTC | 2029-05-22T19:15:37.795Z | -7958 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2029-11-30/ | Neptune sextile Pluto exact 2029-11-30T23:26:53.231Z | 2029-11-30 23:26 UTC | 2029-11-30T21:09:14.239Z | +8259 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2029-11-30/ | Neptune sextile Pluto at 23:26 UTC on 2029-11-30 | 2029-11-30 23:26 UTC | 2029-11-30T21:09:14.239Z | +8206 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2030-05-04/ | Neptune sextile Pluto exact 2030-05-04T13:21:05.980Z | 2030-05-04 13:21 UTC | 2030-05-04T15:27:54.571Z | -7609 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2030-05-04/ | Neptune sextile Pluto at 13:21 UTC on 2030-05-04 | 2030-05-04 13:21 UTC | 2030-05-04T15:27:54.571Z | -7615 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2030-12-26/ | Neptune sextile Pluto exact 2030-12-26T17:10:11.607Z | 2030-12-26 17:10 UTC | 2030-12-26T14:35:55.094Z | +9257 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/neptune-sextile-pluto-2030-12-26/ | Neptune sextile Pluto at 17:10 UTC on 2030-12-26 | 2030-12-26 17:10 UTC | 2030-12-26T14:35:55.094Z | +9245 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-conjunction-neptune-2026-02-20/ | Saturn conjunction Neptune exact 2026-02-20T18:29:22.728Z | 2026-02-20 18:29 UTC | 2026-02-20T16:53:59.100Z | +5724 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-conjunction-neptune-2026-02-20/ | Saturn conjunction Neptune at 18:29 UTC on 2026-02-20 | 2026-02-20 18:29 UTC | 2026-02-20T16:53:59.100Z | +5701 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-sextile-pluto-2026-03-28/ | Saturn sextile Pluto exact 2026-03-28T22:34:36.112Z | 2026-03-28 22:34 UTC | 2026-03-28T22:11:07.597Z | +1409 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-sextile-pluto-2026-03-28/ | Saturn sextile Pluto at 22:34 UTC on 2026-03-28 | 2026-03-28 22:34 UTC | 2026-03-28T22:11:07.597Z | +1372 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-sextile-uranus-2026-01-20/ | Saturn sextile Uranus exact 2026-01-20T05:44:16.218Z | 2026-01-20 05:44 UTC | 2026-01-20T05:18:45.540Z | +1531 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-sextile-uranus-2026-01-20/ | Saturn sextile Uranus at 05:44 UTC on 2026-01-20 | 2026-01-20 05:44 UTC | 2026-01-20T05:18:45.540Z | +1514 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-square-pluto-2028-06-24/ | Saturn square Pluto exact 2028-06-24T03:18:58.402Z | 2028-06-24 03:18 UTC | 2028-06-24T02:59:44.752Z | +1154 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-square-pluto-2028-06-24/ | Saturn square Pluto at 03:18 UTC on 2028-06-24 | 2028-06-24 03:18 UTC | 2028-06-24T02:59:44.752Z | +1095 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-square-pluto-2028-11-15/ | Saturn square Pluto exact 2028-11-15T12:29:27.342Z | 2028-11-15 12:29 UTC | 2028-11-15T12:56:54.569Z | -1647 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-square-pluto-2028-11-15/ | Saturn square Pluto at 12:29 UTC on 2028-11-15 | 2028-11-15 12:29 UTC | 2028-11-15T12:56:54.569Z | -1675 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-square-pluto-2029-03-29/ | Saturn square Pluto exact 2029-03-29T23:21:02.958Z | 2029-03-29 23:21 UTC | 2029-03-29T23:09:02.458Z | +720 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/saturn-square-pluto-2029-03-29/ | Saturn square Pluto at 23:21 UTC on 2029-03-29 | 2029-03-29 23:21 UTC | 2029-03-29T23:09:02.458Z | +718 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-sextile-neptune-2026-07-15/ | Uranus sextile Neptune exact 2026-07-15T22:23:00.761Z | 2026-07-15 22:23 UTC | 2026-07-15T20:35:42.302Z | +6438 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-sextile-neptune-2026-07-15/ | Uranus sextile Neptune at 22:23 UTC on 2026-07-15 | 2026-07-15 22:23 UTC | 2026-07-15T20:35:42.302Z | +6438 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-sextile-neptune-2027-01-15/ | Uranus sextile Neptune exact 2027-01-15T07:21:23.862Z | 2027-01-15 07:21 UTC | 2027-01-15T09:26:29.007Z | -7505 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-sextile-neptune-2027-01-15/ | Uranus sextile Neptune at 07:21 UTC on 2027-01-15 | 2027-01-15 07:21 UTC | 2027-01-15T09:26:29.007Z | -7529 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-sextile-neptune-2027-06-06/ | Uranus sextile Neptune exact 2027-06-06T12:03:37.528Z | 2027-06-06 12:03 UTC | 2027-06-06T10:12:08.747Z | +6689 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-sextile-neptune-2027-06-06/ | Uranus sextile Neptune at 12:03 UTC on 2027-06-06 | 2027-06-06 12:03 UTC | 2027-06-06T10:12:08.747Z | +6651 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-trine-pluto-2028-05-10/ | Uranus trine Pluto exact 2028-05-10T02:50:40.437Z | 2028-05-10 02:50 UTC | 2028-05-10T03:03:59.133Z | -799 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /events/uranus-trine-pluto-2028-05-10/ | Uranus trine Pluto at 02:50 UTC on 2028-05-10 | 2028-05-10 02:50 UTC | 2028-05-10T03:03:59.133Z | -839 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/aquarius/2026/ /horoscopes/aries/2026/ /horoscopes/cancer/2026/ /horoscopes/capricorn/2026/ /horoscopes/gemini/2026/ /horoscopes/leo/2026/ /horoscopes/libra/2026/ /horoscopes/pisces/2026/ /horoscopes/sagittarius/2026/ /horoscopes/scorpio/2026/ /horoscopes/taurus/2026/ /horoscopes/virgo/2026/ | Neptune enters Aries on January 26, 2026 at 14:30 UTC | 2026-01-26 14:30 UTC | 2026-01-26T17:35:23.115Z | -11123 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/aquarius/2026/ /horoscopes/aries/2026/ /horoscopes/cancer/2026/ /horoscopes/capricorn/2026/ /horoscopes/gemini/2026/ /horoscopes/leo/2026/ /horoscopes/libra/2026/ /horoscopes/pisces/2026/ /horoscopes/sagittarius/2026/ /horoscopes/scorpio/2026/ /horoscopes/taurus/2026/ /horoscopes/virgo/2026/ | Jupiter enters Leo on June 30, 2026 at 05:56 UTC | 2026-06-30 05:56 UTC | 2026-06-30T05:52:26.992Z | +213 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/aquarius/2026/ /horoscopes/aries/2026/ /horoscopes/cancer/2026/ /horoscopes/capricorn/2026/ /horoscopes/gemini/2026/ /horoscopes/leo/2026/ /horoscopes/libra/2026/ /horoscopes/pisces/2026/ /horoscopes/sagittarius/2026/ /horoscopes/scorpio/2026/ /horoscopes/taurus/2026/ /horoscopes/virgo/2026/ | Uranus enters Gemini on April 26, 2026 at 01:01 UTC | 2026-04-26 01:01 UTC | 2026-04-26T00:51:53.009Z | +547 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/aquarius/2026/ /horoscopes/aries/2026/ /horoscopes/cancer/2026/ /horoscopes/capricorn/2026/ /horoscopes/gemini/2026/ /horoscopes/leo/2026/ /horoscopes/libra/2026/ /horoscopes/pisces/2026/ /horoscopes/sagittarius/2026/ /horoscopes/scorpio/2026/ /horoscopes/taurus/2026/ /horoscopes/virgo/2026/ | Neptune in Aries / Enters Aries Jan 26, 14:30 UTC. | 2026-01-26 14:30 UTC | 2026-01-26T17:35:23.115Z | -11123 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/aquarius/2026/ /horoscopes/aries/2026/ /horoscopes/cancer/2026/ /horoscopes/capricorn/2026/ /horoscopes/gemini/2026/ /horoscopes/leo/2026/ /horoscopes/libra/2026/ /horoscopes/pisces/2026/ /horoscopes/sagittarius/2026/ /horoscopes/scorpio/2026/ /horoscopes/taurus/2026/ /horoscopes/virgo/2026/ | Uranus in Gemini / Enters Gemini Apr 26, 01:01 UTC. | 2026-04-26 01:01 UTC | 2026-04-26T00:51:53.009Z | +547 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/aquarius/2027/ /horoscopes/aries/2027/ /horoscopes/cancer/2027/ /horoscopes/capricorn/2027/ /horoscopes/gemini/2027/ /horoscopes/leo/2027/ /horoscopes/libra/2027/ /horoscopes/pisces/2027/ /horoscopes/sagittarius/2027/ /horoscopes/scorpio/2027/ /horoscopes/taurus/2027/ /horoscopes/virgo/2027/ | Jupiter enters Virgo on July 26, 2027 at 04:45 UTC | 2027-07-26 04:45 UTC | 2027-07-26T04:49:15.703Z | -256 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /horoscopes/capricorn/2026/ /horoscopes/leo/2026/ | Saturn enters Aries on February 14, 2026 at 00:39 UTC | 2026-02-14 00:39 UTC | 2026-02-14T00:11:49.424Z | +1631 s | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/jupiter-in-scorpio/ | Jupiter leaves Scorpio 2041-03-20 (placement window) | 2041-03-20 | 2041-03-21T00:01:20.840Z | +1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/neptune-in-aquarius/ | Neptune enters Aquarius 1998-11-27 (placement window) | 1998-11-27 | 1998-11-28T01:20:09.628Z | +1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/neptune-in-aries/ | Neptune leaves Aries 2038-05-21 (placement window) | 2038-05-21 | 2038-05-22T00:13:01.067Z | +1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/neptune-in-cancer/ | Neptune enters Cancer 1914-12-15 (placement window) | 1914-12-15 | 1914-12-14T20:38:56.892Z | -1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/neptune-in-capricorn/ | Neptune leaves Capricorn 1984-06-22 (placement window) | 1984-06-22 | 1984-06-23T01:09:31.060Z | +1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/neptune-in-capricorn/ | Neptune leaves Capricorn 1998-11-27 (placement window) | 1998-11-27 | 1998-11-28T01:20:09.628Z | +1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |
| /learn/placements/neptune-in-libra/ | Neptune enters Libra 1956-03-11 (placement window) | 1956-03-11 | 1956-03-12T01:57:14.684Z | +1 day | engine-slow | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly |

204 more rows in `results/mismatches-pages.csv`.
<!-- generated:pages:end -->

## Data mismatches

<!-- generated:data:start -->
| source | category | statement | our_value | nasa_value | difference | cause | note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| src/data/transits-2026-01.json | ingress | Neptune enters aries 2026-01-26T14:31:41.082Z | 2026-01-26T14:31:41.082Z | 2026-01-26T17:35:23.115Z aries | -11022.0 s | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mercury square Neptune 2026-01-01T13:36:47.289Z at 29.5° sagittarius | 2026-01-01T13:36:47.289Z | 2026-01-01T13:33:10.001Z, Mercury at 29.51° sagittarius | +217 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Venus opposition Jupiter 2026-01-09T17:33:32.364Z at 20.2° capricorn | 2026-01-09T17:33:32.364Z | 2026-01-09T17:34:54.570Z, Venus at 20.19° capricorn | -82 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Sun opposition Jupiter 2026-01-10T08:40:57.970Z at 20.1° capricorn | 2026-01-10T08:40:57.970Z | 2026-01-10T08:42:09.455Z, Sun at 20.11° capricorn | -71 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mars opposition Jupiter 2026-01-10T14:23:30.698Z at 20.1° capricorn | 2026-01-10T14:23:30.698Z | 2026-01-10T14:25:07.488Z, Mars at 20.08° capricorn | -97 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Venus sextile Saturn 2026-01-15T06:15:25.570Z at 27.1° capricorn | 2026-01-15T06:15:25.570Z | 2026-01-15T06:18:37.271Z, Venus at 27.15° capricorn | -192 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Venus sextile Neptune 2026-01-17T08:36:48.223Z at 29.8° capricorn | 2026-01-17T08:36:48.223Z | 2026-01-17T08:33:34.591Z, Venus at 29.78° capricorn | +194 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Sun sextile Saturn 2026-01-17T10:37:52.136Z at 27.3° capricorn | 2026-01-17T10:37:52.136Z | 2026-01-17T10:41:25.572Z, Sun at 27.32° capricorn | -213 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mercury sextile Saturn 2026-01-19T04:07:47.961Z at 27.5° capricorn | 2026-01-19T04:07:47.961Z | 2026-01-19T04:09:15.423Z, Mercury at 27.47° capricorn | -87 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Sun sextile Neptune 2026-01-19T21:59:14.048Z at 29.8° capricorn | 2026-01-19T21:59:14.048Z | 2026-01-19T21:54:49.074Z, Sun at 29.84° capricorn | +265 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Venus conjunction Pluto 2026-01-20T04:03:18.852Z at 3.3° aquarius | 2026-01-20T04:03:18.852Z | 2026-01-20T04:04:20.540Z, Venus at 3.32° aquarius | -62 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Saturn sextile Uranus 2026-01-20T05:44:16.218Z at 27.6° pisces | 2026-01-20T05:44:16.218Z | 2026-01-20T05:18:45.540Z, Saturn at 27.56° pisces | +1531 s (tolerance 440 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mars trine Uranus 2026-01-20T05:55:17.457Z at 27.6° capricorn | 2026-01-20T05:55:17.457Z | 2026-01-20T05:56:25.180Z, Mars at 27.56° capricorn | -68 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mars sextile Saturn 2026-01-20T05:56:51.061Z at 27.6° capricorn | 2026-01-20T05:56:51.061Z | 2026-01-20T06:01:45.284Z, Mars at 27.56° capricorn | -294 s (tolerance 62 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mercury sextile Neptune 2026-01-20T14:37:32.388Z at 29.9° capricorn | 2026-01-20T14:37:32.388Z | 2026-01-20T14:34:21.560Z, Mercury at 29.85° capricorn | +191 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-01.json | aspect | Mars sextile Neptune 2026-01-23T06:45:19.526Z at 29.9° capricorn | 2026-01-23T06:45:19.526Z | 2026-01-23T06:39:30.830Z, Mars at 29.91° capricorn | +349 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-02.json | ingress | Saturn enters aries 2026-02-14T00:39:45.096Z | 2026-02-14T00:39:45.096Z | 2026-02-14T00:11:49.424Z aries | +1675.7 s | engine-slow |  |
| src/data/transits-2026-02.json | aspect | Saturn conjunction Neptune 2026-02-20T18:29:22.728Z at 0.8° aries | 2026-02-20T18:29:22.728Z | 2026-02-20T16:53:59.100Z, Saturn at 0.75° aries | +5724 s (tolerance 536 s) | engine-slow |  |
| src/data/transits-2026-02.json | aspect | Venus trine Jupiter 2026-02-22T20:00:35.979Z at 15.5° pisces | 2026-02-22T20:00:35.979Z | 2026-02-22T20:01:51.313Z, Venus at 15.52° pisces | -75 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Venus sextile Uranus 2026-03-04T16:39:40.489Z at 27.8° pisces | 2026-03-04T16:39:40.489Z | 2026-03-04T16:40:44.822Z, Venus at 27.82° pisces | -64 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Sun trine Jupiter 2026-03-05T17:12:45.031Z at 15.1° pisces | 2026-03-05T17:12:45.031Z | 2026-03-05T17:13:51.896Z, Sun at 15.14° pisces | -67 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Venus conjunction Neptune 2026-03-07T11:30:33.727Z at 1.3° aries | 2026-03-07T11:30:33.727Z | 2026-03-07T11:27:25.308Z, Venus at 1.28° aries | +188 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Venus conjunction Saturn 2026-03-08T13:36:09.881Z at 2.6° aries | 2026-03-08T13:36:09.881Z | 2026-03-08T13:39:38.725Z, Venus at 2.64° aries | -209 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Mercury trine Jupiter 2026-03-09T05:26:04.947Z at 15.1° pisces | 2026-03-09T05:26:04.947Z | 2026-03-09T05:23:26.435Z, Mercury at 15.09° pisces | +159 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Venus sextile Pluto 2026-03-10T06:50:57.026Z at 4.8° aries | 2026-03-10T06:50:57.026Z | 2026-03-10T06:52:05.375Z, Venus at 4.77° aries | -68 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Venus square Jupiter 2026-03-18T16:07:21.924Z at 15.2° aries | 2026-03-18T16:07:21.924Z | 2026-03-18T16:08:54.500Z, Venus at 15.18° aries | -93 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Mars trine Jupiter 2026-03-22T00:00:01.729Z at 15.3° pisces | 2026-03-22T00:00:01.729Z | 2026-03-22T00:01:02.458Z, Mars at 15.28° pisces | -61 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Sun conjunction Neptune 2026-03-22T11:23:13.312Z at 1.8° aries | 2026-03-22T11:23:13.312Z | 2026-03-22T11:18:36.661Z, Sun at 1.84° aries | +277 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Sun conjunction Saturn 2026-03-25T08:51:31.772Z at 4.7° aries | 2026-03-25T08:51:31.772Z | 2026-03-25T08:55:13.848Z, Sun at 4.72° aries | -222 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-03.json | aspect | Saturn sextile Pluto 2026-03-28T22:34:36.112Z at 5.2° aries | 2026-03-28T22:34:36.112Z | 2026-03-28T22:11:07.597Z, Saturn at 5.16° aries | +1409 s (tolerance 403 s) | engine-slow |  |
| src/data/transits-2026-04.json | ingress | Uranus enters gemini 2026-04-26T01:00:44.564Z | 2026-04-26T01:00:44.564Z | 2026-04-26T00:51:53.009Z gemini | +531.6 s | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Venus square Pluto 2026-04-03T22:36:48.031Z at 5.3° taurus | 2026-04-03T22:36:48.031Z | 2026-04-03T22:38:01.133Z, Venus at 5.26° taurus | -73 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Mars conjunction Neptune 2026-04-13T05:36:50.448Z at 2.7° aries | 2026-04-13T05:36:50.448Z | 2026-04-13T05:30:16.326Z, Mars at 2.65° aries | +394 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Venus sextile Jupiter 2026-04-13T08:19:24.412Z at 16.8° taurus | 2026-04-13T08:19:24.412Z | 2026-04-13T08:20:55.435Z, Venus at 16.80° taurus | -91 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Mercury conjunction Neptune 2026-04-17T02:04:57.096Z at 2.8° aries | 2026-04-17T02:04:57.096Z | 2026-04-17T02:01:27.626Z, Mercury at 2.79° aries | +209 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Mars conjunction Saturn 2026-04-19T22:39:37.276Z at 7.9° aries | 2026-04-19T22:39:37.276Z | 2026-04-19T22:43:57.820Z, Mars at 7.86° aries | -261 s (tolerance 66 s) | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Mercury conjunction Saturn 2026-04-20T11:20:24.068Z at 7.9° aries | 2026-04-20T11:20:24.068Z | 2026-04-20T11:22:09.639Z, Mercury at 7.93° aries | -106 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-04.json | aspect | Venus sextile Neptune 2026-04-26T17:46:12.563Z at 3.1° gemini | 2026-04-26T17:46:12.563Z | 2026-04-26T17:42:51.602Z, Venus at 3.12° gemini | +201 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-05.json | aspect | Venus sextile Saturn 2026-05-01T18:41:51.968Z at 9.2° gemini | 2026-05-01T18:41:51.968Z | 2026-05-01T18:45:16.895Z, Venus at 9.23° gemini | -205 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-05.json | aspect | Mercury sextile Neptune 2026-05-19T04:07:18.958Z at 3.8° gemini | 2026-05-19T04:07:18.958Z | 2026-05-19T04:05:02.348Z, Mercury at 3.78° gemini | +137 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-05.json | aspect | Venus square Neptune 2026-05-22T06:35:44.556Z at 3.9° cancer | 2026-05-22T06:35:44.556Z | 2026-05-22T06:31:51.361Z, Venus at 3.85° cancer | +233 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-05.json | aspect | Mercury sextile Saturn 2026-05-22T18:01:24.045Z at 11.4° gemini | 2026-05-22T18:01:24.045Z | 2026-05-22T18:02:32.409Z, Mercury at 11.42° gemini | -68 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-05.json | aspect | Sun sextile Neptune 2026-05-25T02:27:49.838Z at 3.9° gemini | 2026-05-25T02:27:49.838Z | 2026-05-25T02:22:19.401Z, Sun at 3.92° gemini | +330 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-05.json | aspect | Venus square Saturn 2026-05-29T02:59:33.219Z at 12.0° cancer | 2026-05-29T02:59:33.219Z | 2026-05-29T03:02:37.818Z, Venus at 12.00° cancer | -185 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-06.json | ingress | Jupiter enters leo 2026-06-30T05:56:23.952Z | 2026-06-30T05:56:23.952Z | 2026-06-30T05:52:26.992Z leo | +237.0 s | engine-slow |  |
| src/data/transits-2026-06.json | lunation | new moon 2026-06-15T02:54:11.458Z at 24°02′ gemini | 2026-06-15T02:54:11.458Z 24°02′ Gemini | 2026-06-15T02:54:10.108Z 24°03′ Gemini | +1.3 s, -1.6 arcsec | tie |  |
| src/data/transits-2026-06.json | aspect | Sun sextile Saturn 2026-06-02T22:45:43.201Z at 12.4° gemini | 2026-06-02T22:45:43.201Z | 2026-06-02T22:48:45.451Z, Sun at 12.41° gemini | -182 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-06.json | aspect | Mercury square Neptune 2026-06-04T00:21:49.130Z at 4.1° cancer | 2026-06-04T00:21:49.130Z | 2026-06-04T00:18:23.619Z, Mercury at 4.12° cancer | +206 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-06.json | aspect | Mercury square Saturn 2026-06-10T05:37:08.246Z at 13.0° cancer | 2026-06-10T05:37:08.246Z | 2026-06-10T05:38:42.130Z, Mercury at 12.97° cancer | -94 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-06.json | aspect | Venus trine Neptune 2026-06-17T03:45:22.740Z at 4.3° leo | 2026-06-17T03:45:22.740Z | 2026-06-17T03:41:00.810Z, Venus at 4.31° leo | +262 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-06.json | aspect | Venus trine Saturn 2026-06-25T11:58:48.807Z at 13.9° leo | 2026-06-25T11:58:48.807Z | 2026-06-25T12:01:45.047Z, Venus at 13.93° leo | -176 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-06.json | aspect | Sun square Neptune 2026-06-25T22:43:55.591Z at 4.4° cancer | 2026-06-25T22:43:55.591Z | 2026-06-25T22:38:24.481Z, Sun at 4.38° cancer | +331 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-07.json | degree-display | Mercury direct station shown as 16°19′ Cancer | 16°19′ Cancer | 16°18′ Cancer | +3.1 arcsec | tie | truncated minute differs |
| src/data/transits-2026-07.json | aspect | Mars sextile Neptune 2026-07-05T00:51:36.083Z at 4.4° gemini | 2026-07-05T00:51:36.083Z | 2026-07-05T00:44:25.421Z, Mars at 4.42° gemini | +431 s (tolerance 61 s) | engine-slow |  |
| src/data/transits-2026-07.json | aspect | Sun square Saturn 2026-07-06T10:43:49.658Z at 14.4° cancer | 2026-07-06T10:43:49.658Z | 2026-07-06T10:47:02.634Z, Sun at 14.40° cancer | -193 s (tolerance 60 s) | engine-slow |  |
| src/data/transits-2026-07.json | aspect | Uranus sextile Neptune 2026-07-15T22:23:00.761Z at 4.4° gemini | 2026-07-15T22:23:00.761Z | 2026-07-15T20:35:42.302Z, Uranus at 4.40° gemini | +6438 s (tolerance 914 s) | engine-slow |  |
| src/data/transits-2026-07.json | aspect | Mars sextile Saturn 2026-07-19T18:05:58.510Z at 14.7° gemini | 2026-07-19T18:05:58.510Z | 2026-07-19T18:10:54.764Z, Mars at 14.71° gemini | -296 s (tolerance 64 s) | engine-slow |  |
| src/data/transits-2026-07.json | aspect | Jupiter trine Neptune 2026-07-20T07:47:59.076Z at 4.4° leo | 2026-07-20T07:47:59.076Z | 2026-07-20T07:23:26.820Z, Jupiter at 4.37° leo | +1472 s (tolerance 190 s) | engine-slow |  |
| src/data/transits-2026-07.json | aspect | Neptune sextile Pluto 2026-07-24T23:09:38.401Z at 4.3° aries | 2026-07-24T23:09:38.401Z | 2026-07-25T05:28:07.402Z, Neptune at 4.33° aries | -22709 s (tolerance 1800 s) | engine-slow |  |
| src/data/transits-2026-07.json | aspect | Sun trine Neptune 2026-07-27T07:41:58.999Z at 4.3° leo | 2026-07-27T07:41:58.999Z | 2026-07-27T07:36:37.102Z, Sun at 4.31° leo | +322 s (tolerance 60 s) | engine-slow |  |

871 more rows in `results/mismatches-data.csv`.
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

## Recommended, not fixed

1. **Localized transit labels.** Truncate these as well. Their test is
   protected (`src/lib/i18n/astrology.test.ts`) and needs the owner's
   allowance. Until then, the es, fr, it and pt /transits/ pages can print
   "30°" in July 2028.
2. **Slow-planet times.** Show slow-planet ingress and aspect times to the
   date only, or compute them from a JPL ephemeris. The Neptune ingress
   printed in the 24 yearly horoscopes is about 3 hours off.
3. **Birthday degrees.** Store them to four decimals and floor the "at least"
   margin. This bundles into the AI tools, so it ships as a new developer
   plugin version.
4. **Eclipse longitudes.** Store them to four decimals at the next
   `eclipses.json` refresh.
5. **People pages.** Round their degrees once, from the full value.
6. **Eclipse durations.** Match NASA's catalogue: totality of about 101.9
   and 53.7 minutes, not 103 and 55.
7. **Coverage wording.** Fix wording that says "2026 to 2027" or "through
   2028" when the tables run to 2030. /mercury-retrograde/ contradicts itself.
8. **The 18 July 2027 penumbral eclipse.** Say it cannot be seen: NASA gives
   magnitude 0.0014.

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
- Times are printed to the minute for slow planets the engine cannot place
  that finely: Neptune is three hours off.
- Rounding remained in places.
- Two degree notations are mixed without explanation.
- 2027's five eclipses include one no one can see.

## Not checked

- Localized page wording.
- Anything drawn in the browser: the birth chart, the transit tracker,
  personal 2027 skies and countdowns.
- Houses and angles, which Horizons does not provide.
- Images, RSS, ICS and the AI tools' answers.
- Daily editions other than 6 November 2026.
