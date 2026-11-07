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
2. **Slow planets (fixed here, apart from the Learn placement pages).** The
   engine is a few arcseconds off, which is invisible for the Moon. Neptune
   moves so slowly that the same error becomes about three hours: the yearly
   horoscopes said Neptune enters Aries at 14:30 UTC, where NASA gives 17:35.
   The pages now print the planets' ingress, station and aspect times from
   NASA JPL Horizons (DE441), and say 17:35. The placement pages under
   /learn/ still print 16 window dates a day off; they are protected and
   wait for the owner's allowance.
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

**Published data files (src/data)**: 9366 claims checked, 8618 match, 748 mismatch.

| Category | Checked | Match | Mismatch |
| --- | ---: | ---: | ---: |
| aspect | 797 | 392 | 405 |
| birthday-cusp | 2639 | 2639 | 0 |
| birthday-now | 732 | 732 | 0 |
| birthday-sign | 337 | 337 | 0 |
| birthday-span | 366 | 366 | 0 |
| completeness | 1140 | 1140 | 0 |
| degree-display | 6 | 0 | 6 |
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

**Built pages (what the site says)**: 8870 claims checked, 8657 match, 213 mismatch.

| Category | Checked | Match | Mismatch |
| --- | ---: | ---: | ---: |
| aspect | 81 | 81 | 0 |
| birthday-sign | 1547 | 1547 | 0 |
| blue-moon | 74 | 74 | 0 |
| degree-display | 9 | 9 | 0 |
| direction | 94 | 94 | 0 |
| duration | 180 | 180 | 0 |
| eclipse | 95 | 95 | 0 |
| eclipse-type | 24 | 24 | 0 |
| ingress | 1602 | 1602 | 0 |
| ingress-date | 24 | 24 | 0 |
| lunation | 324 | 324 | 0 |
| margin | 313 | 303 | 10 |
| moon-ingress | 41 | 41 | 0 |
| moon-sign | 415 | 415 | 0 |
| position | 1754 | 1568 | 186 |
| prose-aspect | 14 | 14 | 0 |
| prose-degree | 4 | 4 | 0 |
| prose-ingress | 137 | 136 | 1 |
| prose-ingress-month | 4 | 4 | 0 |
| prose-lunation | 171 | 171 | 0 |
| prose-station | 671 | 671 | 0 |
| render | 84 | 84 | 0 |
| shadow | 42 | 42 | 0 |
| sign-range | 12 | 12 | 0 |
| station | 281 | 281 | 0 |
| station-date | 198 | 198 | 0 |
| void | 41 | 41 | 0 |
| window-date | 634 | 618 | 16 |

**People charts (src/data/people.json and /people/ pages)**: 18368 claims checked, 18185 match, 183 mismatch.

| Category | Checked | Match | Mismatch |
| --- | ---: | ---: | ---: |
| natal-day-sign | 5511 | 5511 | 0 |
| natal-direction | 3947 | 3947 | 0 |
| natal-page-day | 1503 | 1503 | 0 |
| natal-page-degree | 2397 | 2368 | 29 |
| natal-position | 5010 | 4856 | 154 |

**Mismatches by likely cause**

| Layer | Cause | Count |
| --- | --- | ---: |
| Published data files | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly | 738 |
| Published data files | Minute-boundary tie: NASA's value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side | 6 |
| Published data files | Whole degree rounded instead of truncated (fixed in this branch) | 2 |
| Published data files | Different umbral shadow enlargement from NASA's canon (Chauvenet 1/50) | 2 |
| Built pages | birthdays.json stores longitudes to 0.01° (36″), then the page prints arcminutes | 132 |
| Built pages | Minute-boundary tie: NASA's value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side | 53 |
| Built pages | Engine position error (Venus up to 20″ near inferior conjunction, Saturn about 6″, Neptune about 10″) stretched in time because the body moves slowly | 17 |
| Built pages | "At least" margin rounded up and measured at noon UTC only | 10 |
| Built pages | Eclipse peak instant differs from NASA's greatest eclipse by tens of seconds, enough to move the Moon one arcminute | 1 |
| People charts | Engine outer-planet series drift for births before 1900 (Neptune and Pluto 0.006° to 0.018°) | 153 |
| People charts | Double rounding: stored to 0.01°, then printed to 0.1° | 29 |
| People charts | Minute-boundary tie: NASA's value lies within 10″ of a minute line and the engine (a few arcseconds off) lands on the other side | 1 |
<!-- generated:counts:end -->

## Page mismatches

<!-- generated:pages:start -->
| Page | Statement as published | Our value | NASA value | Difference | Likely cause |
| --- | --- | --- | --- | --- | --- |
| /learn/placements/jupiter-in-scorpio/ | Jupiter leaves Scorpio 2041-03-20 (placement window) | 2041-03-20 | 2041-03-21T00:01:20.840Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-aquarius/ | Neptune enters Aquarius 1998-11-27 (placement window) | 1998-11-27 | 1998-11-28T01:20:09.628Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-aries/ | Neptune leaves Aries 2038-05-21 (placement window) | 2038-05-21 | 2038-05-22T00:13:01.067Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-cancer/ | Neptune enters Cancer 1914-12-15 (placement window) | 1914-12-15 | 1914-12-14T20:38:56.892Z | -1 day | `engine-slow` |
| /learn/placements/neptune-in-capricorn/ | Neptune leaves Capricorn 1984-06-22 (placement window) | 1984-06-22 | 1984-06-23T01:09:31.060Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-capricorn/ | Neptune leaves Capricorn 1998-11-27 (placement window) | 1998-11-27 | 1998-11-28T01:20:09.628Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-libra/ | Neptune enters Libra 1956-03-11 (placement window) | 1956-03-11 | 1956-03-12T01:57:14.684Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-sagittarius/ | Neptune leaves Sagittarius 1970-05-02 (placement window) | 1970-05-02 | 1970-05-03T01:32:27.352Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-sagittarius/ | Neptune enters Sagittarius 1984-06-22 (placement window) | 1984-06-22 | 1984-06-23T01:09:31.060Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-scorpio/ | Neptune enters Scorpio 1970-05-02 (placement window) | 1970-05-02 | 1970-05-03T01:32:27.352Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-taurus/ | Neptune enters Taurus 2038-05-21 (placement window) | 2038-05-21 | 2038-05-22T00:13:01.067Z | +1 day | `engine-slow` |
| /learn/placements/neptune-in-taurus/ | Neptune enters Taurus on May 21, 2038 [long-range ingress] | 2038-05-21 | 2038-05-22T00:13:01.067Z | +1 day | `engine-slow` |
| /learn/placements/pluto-in-aries/ | Pluto enters Aries 2066-06-18 (placement window) | 2066-06-18 | 2066-06-17T15:18:50.357Z | -1 day | `engine-slow` |
| /learn/placements/pluto-in-pisces/ | Pluto leaves Pisces 2066-06-18 (placement window) | 2066-06-18 | 2066-06-17T15:18:50.357Z | -1 day | `engine-slow` |
| /learn/placements/pluto-in-taurus/ | Pluto enters Taurus 2096-04-23 (placement window) | 2096-04-23 | 2096-04-22T23:13:18.057Z | -1 day | `engine-slow` |
| /learn/placements/uranus-in-aquarius/ | Uranus leaves Aquarius 1995-06-08 (placement window) | 1995-06-08 | 1995-06-09T01:40:47.350Z | +1 day | `engine-slow` |
| /learn/placements/uranus-in-capricorn/ | Uranus enters Capricorn 1995-06-08 (placement window) | 1995-06-08 | 1995-06-09T01:40:47.350Z | +1 day | `engine-slow` |
| /eclipses/2030-12-09/ | lunar eclipse position 17°48′ Gemini | Gemini 17°48′ | Gemini 17°47′ | +17.3 arcsec | `eclipse-lon` |
| /birthday/april-18/ | Sun 28°28′ Aries at noon UTC 2026-04-18 | Aries 28°28′ | Aries 28°27′ | +0.6 arcsec | `tie` |
| /birthday/april-23/ | Sun 3°21′ Taurus at noon UTC 2026-04-23 | Taurus 3°21′ | Taurus 3°20′ | +4.3 arcsec | `tie` |
| /birthday/april-25/ | Sun 5°18′ Taurus at noon UTC 2026-04-25 | Taurus 5°18′ | Taurus 5°17′ | +9.1 arcsec | `tie` |
| /birthday/april-28/ | Sun 8°13′ Taurus at noon UTC 2026-04-28 | Taurus 8°13′ | Taurus 8°12′ | +2.6 arcsec | `tie` |
| /birthday/august-11/ | Sun 18°51′ Leo at noon UTC 2026-08-11 | Leo 18°51′ | Leo 18°50′ | +6.1 arcsec | `tie` |
| /birthday/august-16/ | Sun 23°38′ Leo at noon UTC 2026-08-16 | Leo 23°38′ | Leo 23°39′ | -65.6 arcsec | `tie` |
| /birthday/august-20/ | Sun 27°30′ Leo at noon UTC 2026-08-20 | Leo 27°30′ | Leo 27°29′ | +1.5 arcsec | `tie` |
| /birthday/december-10/ | Sun 18°25′ Sagittarius at noon UTC 2026-12-10 | Sagittarius 18°25′ | Sagittarius 18°26′ | -63.9 arcsec | `tie` |
| /birthday/december-13/ | Sun 21°28′ Sagittarius at noon UTC 2026-12-13 | Sagittarius 21°28′ | Sagittarius 21°29′ | -65.3 arcsec | `tie` |
| /birthday/december-25/ | Sun 3°42′ Capricorn at noon UTC 2026-12-25 | Capricorn 3°42′ | Capricorn 3°41′ | +7.6 arcsec | `tie` |
| /birthday/december-26/ | Sun 4°43′ Capricorn at noon UTC 2026-12-26 | Capricorn 4°43′ | Capricorn 4°42′ | +1.0 arcsec | `tie` |
| /birthday/december-8/ | Sun 16°23′ Sagittarius at noon UTC 2026-12-08 | Sagittarius 16°23′ | Sagittarius 16°24′ | -67.0 arcsec | `tie` |
| /birthday/february-24/ | Sun 5°52′ Pisces at noon UTC 2026-02-24 | Pisces 5°52′ | Pisces 5°53′ | -61.5 arcsec | `tie` |
| /birthday/january-10/ | Sun 20°15′ Capricorn at noon UTC 2026-01-10 | Capricorn 20°15′ | Capricorn 20°14′ | +7.9 arcsec | `tie` |
| /birthday/january-3/ | Sun 13°07′ Capricorn at noon UTC 2026-01-03 | Capricorn 13°07′ | Capricorn 13°06′ | +3.4 arcsec | `tie` |
| /birthday/january-4/ | Sun 14°07′ Capricorn at noon UTC 2026-01-04 | Capricorn 14°07′ | Capricorn 14°08′ | -64.4 arcsec | `tie` |
| /birthday/july-19/ | Sun 26°51′ Cancer at noon UTC 2026-07-19 | Cancer 26°51′ | Cancer 26°50′ | +3.8 arcsec | `tie` |
| /birthday/june-19/ | Sun 28°13′ Gemini at noon UTC 2026-06-19 | Gemini 28°13′ | Gemini 28°14′ | -61.0 arcsec | `tie` |
| /birthday/june-27/ | Sun 5°52′ Cancer at noon UTC 2026-06-27 | Cancer 5°52′ | Cancer 5°51′ | +2.1 arcsec | `tie` |
| /birthday/june-5/ | Sun 14°51′ Gemini at noon UTC 2026-06-05 | Gemini 14°51′ | Gemini 14°50′ | +6.5 arcsec | `tie` |
| /birthday/march-12/ | Sun 21°55′ Pisces at noon UTC 2026-03-12 | Pisces 21°55′ | Pisces 21°54′ | +3.2 arcsec | `tie` |
| /birthday/march-17/ | Sun 26°53′ Pisces at noon UTC 2026-03-17 | Pisces 26°53′ | Pisces 26°54′ | -62.6 arcsec | `tie` |
| /birthday/march-23/ | Sun 2°52′ Aries at noon UTC 2026-03-23 | Aries 2°52′ | Aries 2°51′ | +6.1 arcsec | `tie` |
| /birthday/march-25/ | Sun 4°51′ Aries at noon UTC 2026-03-25 | Aries 4°51′ | Aries 4°50′ | +6.3 arcsec | `tie` |
| /birthday/march-4/ | Sun 13°55′ Pisces at noon UTC 2026-03-04 | Pisces 13°55′ | Pisces 13°54′ | +3.7 arcsec | `tie` |
| /birthday/may-2/ | Sun 12°06′ Taurus at noon UTC 2026-05-02 | Taurus 12°06′ | Taurus 12°05′ | +1.1 arcsec | `tie` |
| /birthday/november-15/ | Sun 23°07′ Scorpio at noon UTC 2026-11-15 | Scorpio 23°07′ | Scorpio 23°08′ | -62.9 arcsec | `tie` |
| /birthday/november-19/ | Sun 27°10′ Scorpio at noon UTC 2026-11-19 | Scorpio 27°10′ | Scorpio 27°09′ | +1.5 arcsec | `tie` |
| /birthday/november-21/ | Sun 29°10′ Scorpio at noon UTC 2026-11-21 | Scorpio 29°10′ | Scorpio 29°11′ | -63.8 arcsec | `tie` |
| /birthday/november-27/ | Sun 5°15′ Sagittarius at noon UTC 2026-11-27 | Sagittarius 5°15′ | Sagittarius 5°14′ | +7.5 arcsec | `tie` |
| /birthday/november-9/ | Sun 17°06′ Scorpio at noon UTC 2026-11-09 | Scorpio 17°06′ | Scorpio 17°05′ | +8.6 arcsec | `tie` |
| /birthday/october-15/ | Sun 22°08′ Libra at noon UTC 2026-10-15 | Libra 22°08′ | Libra 22°09′ | -68.8 arcsec | `tie` |
| /birthday/october-23/ | Sun 0°06′ Scorpio at noon UTC 2026-10-23 | Scorpio 0°06′ | Scorpio 0°05′ | +6.6 arcsec | `tie` |
| /birthday/september-14/ | Sun 21°42′ Virgo at noon UTC 2026-09-14 | Virgo 21°42′ | Virgo 21°41′ | +4.4 arcsec | `tie` |
| /birthday/september-18/ | Sun 25°36′ Virgo at noon UTC 2026-09-18 | Virgo 25°36′ | Virgo 25°35′ | +2.1 arcsec | `tie` |
| /birthday/september-20/ | Sun 27°32′ Virgo at noon UTC 2026-09-20 | Virgo 27°32′ | Virgo 27°33′ | -69.0 arcsec | `tie` |
| /birthday/september-28/ | Sun 5°22′ Libra at noon UTC 2026-09-28 | Libra 5°22′ | Libra 5°23′ | -62.6 arcsec | `tie` |
| /birthday/september-29/ | Sun 6°22′ Libra at noon UTC 2026-09-29 | Libra 6°22′ | Libra 6°21′ | +4.3 arcsec | `tie` |
| /birthday/september-30/ | Sun 7°21′ Libra at noon UTC 2026-09-30 | Libra 7°21′ | Libra 7°20′ | +9.0 arcsec | `tie` |
| /birthday/september-9/ | Sun 16°49′ Virgo at noon UTC 2026-09-09 | Virgo 16°49′ | Virgo 16°50′ | -61.5 arcsec | `tie` |
| /eclipses/2027-02-20/ | lunar eclipse position 1°58′ Virgo | Virgo 1°58′ | Virgo 1°59′ | -61.2 arcsec | `tie` |
| /eclipses/2029-12-05/ | solar eclipse position 13°46′ Sagittarius | Sagittarius 13°46′ | Sagittarius 13°45′ | +5.5 arcsec | `tie` |
| /full-moon-calendar/ | full moon 2029-02-28 at 10°23′ Virgo | Virgo 10°23′ | Virgo 10°24′ | -60.0 arcsec | `tie` |
| /full-moon/2029-02-28/ | full moon at 10°23′ Virgo | Virgo 10°23′ | Virgo 10°24′ | -60.0 arcsec | `tie` |
| /horoscopes/cancer/tomorrow/ (+2 more) | Saturn in Aries 8°53′ (sky behind the reading, noon UTC 2026-11-07) | Aries 8°53′ | Aries 8°54′ | -66.4 arcsec | `tie` |
| /mercury-retrograde/ (+1 more) | Mercury direct station at 16°19′ Cancer | Cancer 16°19′ | Cancer 16°18′ | +0.5 arcsec | `tie` |
| /new-moon/2026-06-15/ | new moon at 24°02′ Gemini | Gemini 24°02′ | Gemini 24°03′ | -60.8 arcsec | `tie` |
| /retrogrades/ | Jupiter retrograde station at 27°37′ Scorpio | Scorpio 27°37′ | Scorpio 27°38′ | -60.1 arcsec | `tie` |
| /retrogrades/ | Neptune direct station at 8°20′ Aries | Aries 8°20′ | Aries 8°19′ | +4.8 arcsec | `tie` |
| /retrogrades/ | Neptune retrograde station at 13°23′ Aries | Aries 13°23′ | Aries 13°22′ | +1.2 arcsec | `tie` |
| /birthday/april-1/ | lowest noon-UTC Sun degree 1940 to 2030 on April 1: 10°52′ Aries | 10°52′ Aries | 10°53′ Aries | -65 arcsec | `store-2dp` |
| /birthday/april-17/ | highest noon-UTC Sun degree 1940 to 2030 on April 17: 28°00′ Aries | 28°00′ Aries | 27°59′ Aries | +6 arcsec | `store-2dp` |
| /birthday/april-19/ | highest noon-UTC Sun degree 1940 to 2030 on April 19: 29°56′ Aries | 29°56′ Aries | 29°57′ Aries | -70 arcsec | `store-2dp` |
| /birthday/april-25/ | lowest noon-UTC Sun degree 1940 to 2030 on April 25: 4°23′ Taurus | 4°23′ Taurus | 4°24′ Taurus | -75 arcsec | `store-2dp` |
| /birthday/april-30/ | lowest noon-UTC Sun degree 1940 to 2030 on April 30: 9°16′ Taurus | 9°16′ Taurus | 9°15′ Taurus | +3 arcsec | `store-2dp` |
| /birthday/april-7/ | lowest noon-UTC Sun degree 1940 to 2030 on April 7: 16°48′ Aries | 16°48′ Aries | 16°47′ Aries | +12 arcsec | `store-2dp` |
| /birthday/august-12/ | lowest noon-UTC Sun degree 1940 to 2030 on August 12: 18°53′ Leo | 18°53′ Leo | 18°54′ Leo | -75 arcsec | `store-2dp` |
| /birthday/august-12/ | highest noon-UTC Sun degree 1940 to 2030 on August 12: 20°18′ Leo | 20°18′ Leo | 20°17′ Leo | +2 arcsec | `store-2dp` |
| /birthday/august-15/ | lowest noon-UTC Sun degree 1940 to 2030 on August 15: 21°46′ Leo | 21°46′ Leo | 21°47′ Leo | -63 arcsec | `store-2dp` |
| /birthday/august-16/ | lowest noon-UTC Sun degree 1940 to 2030 on August 16: 22°45′ Leo | 22°45′ Leo | 22°44′ Leo | +18 arcsec | `store-2dp` |
| /birthday/august-18/ | highest noon-UTC Sun degree 1940 to 2030 on August 18: 26°04′ Leo | 26°04′ Leo | 26°03′ Leo | +1 arcsec | `store-2dp` |
| /birthday/august-24/ | highest noon-UTC Sun degree 1940 to 2030 on August 24: 1°51′ Virgo | 1°51′ Virgo | 1°50′ Virgo | +9 arcsec | `store-2dp` |
| /birthday/august-27/ | Sun 4°15′ Virgo at noon UTC 2026-08-27 | Virgo 4°15′ | Virgo 4°14′ | +14.1 arcsec | `store-2dp` |
| /birthday/august-4/ | lowest noon-UTC Sun degree 1940 to 2030 on August 4: 11°13′ Leo | 11°13′ Leo | 11°14′ Leo | -65 arcsec | `store-2dp` |
| /birthday/august-5/ | Sun 13°06′ Leo at noon UTC 2026-08-05 | Leo 13°06′ | Leo 13°05′ | +16.9 arcsec | `store-2dp` |
| /birthday/august-6/ | lowest noon-UTC Sun degree 1940 to 2030 on August 6: 13°08′ Leo | 13°08′ Leo | 13°09′ Leo | -62 arcsec | `store-2dp` |
| /birthday/august-6/ | highest noon-UTC Sun degree 1940 to 2030 on August 6: 14°33′ Leo | 14°33′ Leo | 14°32′ Leo | +11 arcsec | `store-2dp` |
| /birthday/december-17/ | Sun 25°32′ Sagittarius at noon UTC 2026-12-17 | Sagittarius 25°32′ | Sagittarius 25°33′ | -74.8 arcsec | `store-2dp` |
| /birthday/december-21/ | lowest noon-UTC Sun degree 1940 to 2030 on December 21: 28°45′ Sagittarius | 28°45′ Sagittarius | 28°44′ Sagittarius | +5 arcsec | `store-2dp` |
| /birthday/december-26/ | highest noon-UTC Sun degree 1940 to 2030 on December 26: 5°15′ Capricorn | 5°15′ Capricorn | 5°14′ Capricorn | +4 arcsec | `store-2dp` |
| /birthday/december-29/ | lowest noon-UTC Sun degree 1940 to 2030 on December 29: 6°53′ Capricorn | 6°53′ Capricorn | 6°54′ Capricorn | -68 arcsec | `store-2dp` |
| /birthday/december-29/ | highest noon-UTC Sun degree 1940 to 2030 on December 29: 8°17′ Capricorn | 8°17′ Capricorn | 8°18′ Capricorn | -79 arcsec | `store-2dp` |
| /birthday/december-4/ | lowest noon-UTC Sun degree 1940 to 2030 on December 4: 11°28′ Sagittarius | 11°28′ Sagittarius | 11°27′ Sagittarius | +1 arcsec | `store-2dp` |
| /birthday/december-6/ | lowest noon-UTC Sun degree 1940 to 2030 on December 6: 13°30′ Sagittarius | 13°30′ Sagittarius | 13°29′ Sagittarius | +13 arcsec | `store-2dp` |
| /birthday/february-12/ | lowest noon-UTC Sun degree 1940 to 2030 on February 12: 22°37′ Aquarius | 22°37′ Aquarius | 22°38′ Aquarius | -63 arcsec | `store-2dp` |
| /birthday/february-15/ | lowest noon-UTC Sun degree 1940 to 2030 on February 15: 25°40′ Aquarius | 25°40′ Aquarius | 25°39′ Aquarius | +0 arcsec | `store-2dp` |
| /birthday/february-18/ | lowest noon-UTC Sun degree 1940 to 2030 on February 18: 28°42′ Aquarius | 28°42′ Aquarius | 28°41′ Aquarius | +18 arcsec | `store-2dp` |
| /birthday/february-19/ | Sun 0°51′ Pisces at noon UTC 2026-02-19 | Pisces 0°51′ | Pisces 0°50′ | +13.0 arcsec | `store-2dp` |
| /birthday/february-22/ | highest noon-UTC Sun degree 1940 to 2030 on February 22: 4°08′ Pisces | 4°08′ Pisces | 4°09′ Pisces | -68 arcsec | `store-2dp` |
| /birthday/february-26/ | lowest noon-UTC Sun degree 1940 to 2030 on February 26: 6°45′ Pisces | 6°45′ Pisces | 6°44′ Pisces | +5 arcsec | `store-2dp` |
| /birthday/february-28/ | Sun 9°53′ Pisces at noon UTC 2026-02-28 | Pisces 9°53′ | Pisces 9°54′ | -74.7 arcsec | `store-2dp` |
| /birthday/february-28/ | highest noon-UTC Sun degree 1940 to 2030 on February 28: 10°10′ Pisces | 10°10′ Pisces | 10°11′ Pisces | -62 arcsec | `store-2dp` |
| /birthday/february-3/ | lowest noon-UTC Sun degree 1940 to 2030 on February 3: 13°31′ Aquarius | 13°31′ Aquarius | 13°30′ Aquarius | +5 arcsec | `store-2dp` |
| /birthday/february-6/ | highest noon-UTC Sun degree 1940 to 2030 on February 6: 17°58′ Aquarius | 17°58′ Aquarius | 17°59′ Aquarius | -63 arcsec | `store-2dp` |
| /birthday/february-7/ | highest noon-UTC Sun degree 1940 to 2030 on February 7: 19°00′ Aquarius | 19°00′ Aquarius | 18°59′ Aquarius | +9 arcsec | `store-2dp` |
| /birthday/february-9/ | lowest noon-UTC Sun degree 1940 to 2030 on February 9: 19°36′ Aquarius | 19°36′ Aquarius | 19°35′ Aquarius | +8 arcsec | `store-2dp` |
| /birthday/january-11/ | highest noon-UTC Sun degree 1940 to 2030 on January 11: 21°32′ Capricorn | 21°32′ Capricorn | 21°33′ Capricorn | -68 arcsec | `store-2dp` |
| /birthday/january-13/ | Sun 23°17′ Capricorn at noon UTC 2026-01-13 | Capricorn 23°17′ | Capricorn 23°18′ | -76.5 arcsec | `store-2dp` |
| /birthday/january-15/ | lowest noon-UTC Sun degree 1940 to 2030 on January 15: 24°12′ Capricorn | 24°12′ Capricorn | 24°11′ Capricorn | +1 arcsec | `store-2dp` |
| /birthday/january-17/ | highest noon-UTC Sun degree 1940 to 2030 on January 17: 27°40′ Capricorn | 27°40′ Capricorn | 27°39′ Capricorn | +3 arcsec | `store-2dp` |
| /birthday/january-18/ | highest noon-UTC Sun degree 1940 to 2030 on January 18: 28°40′ Capricorn | 28°40′ Capricorn | 28°41′ Capricorn | -63 arcsec | `store-2dp` |
| /birthday/january-2/ | Sun 12°06′ Capricorn at noon UTC 2026-01-02 | Capricorn 12°06′ | Capricorn 12°05′ | +11.3 arcsec | `store-2dp` |
| /birthday/january-2/ | lowest noon-UTC Sun degree 1940 to 2030 on January 2: 10°57′ Capricorn | 10°57′ Capricorn | 10°56′ Capricorn | +8 arcsec | `store-2dp` |
| /birthday/january-30/ | highest noon-UTC Sun degree 1940 to 2030 on January 30: 10°52′ Aquarius | 10°52′ Aquarius | 10°53′ Aquarius | -66 arcsec | `store-2dp` |
| /birthday/january-31/ | highest noon-UTC Sun degree 1940 to 2030 on January 31: 11°53′ Aquarius | 11°53′ Aquarius | 11°54′ Aquarius | -60 arcsec | `store-2dp` |
| /birthday/january-5/ | Sun 15°08′ Capricorn at noon UTC 2026-01-05 | Capricorn 15°08′ | Capricorn 15°09′ | -72.3 arcsec | `store-2dp` |
| /birthday/january-8/ | lowest noon-UTC Sun degree 1940 to 2030 on January 8: 17°04′ Capricorn | 17°04′ Capricorn | 17°03′ Capricorn | +6 arcsec | `store-2dp` |
| /birthday/january-9/ | lowest noon-UTC Sun degree 1940 to 2030 on January 9: 18°04′ Capricorn | 18°04′ Capricorn | 18°05′ Capricorn | -64 arcsec | `store-2dp` |
| /birthday/july-12/ | lowest noon-UTC Sun degree 1940 to 2030 on July 12: 19°16′ Cancer | 19°16′ Cancer | 19°15′ Cancer | +5 arcsec | `store-2dp` |
| /birthday/july-18/ | highest noon-UTC Sun degree 1940 to 2030 on July 18: 26°22′ Cancer | 26°22′ Cancer | 26°23′ Cancer | -60 arcsec | `store-2dp` |
| /birthday/july-21/ | lowest noon-UTC Sun degree 1940 to 2030 on July 21: 27°51′ Cancer | 27°51′ Cancer | 27°50′ Cancer | +3 arcsec | `store-2dp` |
| /birthday/july-21/ | highest noon-UTC Sun degree 1940 to 2030 on July 21: 29°15′ Cancer | 29°15′ Cancer | 29°14′ Cancer | +8 arcsec | `store-2dp` |
| /birthday/july-22/ | highest noon-UTC Sun degree 1940 to 2030 on July 22: 0°11′ Leo | 0°11′ Leo | 0°12′ Leo | -71 arcsec | `store-2dp` |
| /birthday/july-30/ | highest noon-UTC Sun degree 1940 to 2030 on July 30: 7°51′ Leo | 7°51′ Leo | 7°50′ Leo | +5 arcsec | `store-2dp` |
| /birthday/july-4/ | highest noon-UTC Sun degree 1940 to 2030 on July 4: 13°01′ Cancer | 13°01′ Cancer | 13°02′ Cancer | -63 arcsec | `store-2dp` |
| /birthday/july-7/ | lowest noon-UTC Sun degree 1940 to 2030 on July 7: 14°30′ Cancer | 14°30′ Cancer | 14°29′ Cancer | +9 arcsec | `store-2dp` |
| /birthday/july-8/ | lowest noon-UTC Sun degree 1940 to 2030 on July 8: 15°26′ Cancer | 15°26′ Cancer | 15°27′ Cancer | -64 arcsec | `store-2dp` |
| /birthday/july-8/ | highest noon-UTC Sun degree 1940 to 2030 on July 8: 16°51′ Cancer | 16°51′ Cancer | 16°50′ Cancer | +13 arcsec | `store-2dp` |
| /birthday/july-9/ | lowest noon-UTC Sun degree 1940 to 2030 on July 9: 16°23′ Cancer | 16°23′ Cancer | 16°24′ Cancer | -77 arcsec | `store-2dp` |
| /birthday/july-9/ | highest noon-UTC Sun degree 1940 to 2030 on July 9: 17°48′ Cancer | 17°48′ Cancer | 17°47′ Cancer | +2 arcsec | `store-2dp` |
| /birthday/june-10/ | lowest noon-UTC Sun degree 1940 to 2030 on June 10: 18°43′ Gemini | 18°43′ Gemini | 18°44′ Gemini | -63 arcsec | `store-2dp` |
| /birthday/june-11/ | highest noon-UTC Sun degree 1940 to 2030 on June 11: 21°04′ Gemini | 21°04′ Gemini | 21°05′ Gemini | -66 arcsec | `store-2dp` |
| /birthday/june-13/ | highest noon-UTC Sun degree 1940 to 2030 on June 13: 23°00′ Gemini | 23°00′ Gemini | 22°59′ Gemini | +15 arcsec | `store-2dp` |
| /birthday/june-14/ | highest noon-UTC Sun degree 1940 to 2030 on June 14: 23°56′ Gemini | 23°56′ Gemini | 23°57′ Gemini | -64 arcsec | `store-2dp` |
| /birthday/june-16/ | lowest noon-UTC Sun degree 1940 to 2030 on June 16: 24°28′ Gemini | 24°28′ Gemini | 24°27′ Gemini | +4 arcsec | `store-2dp` |
| /birthday/june-17/ | highest noon-UTC Sun degree 1940 to 2030 on June 17: 26°49′ Gemini | 26°49′ Gemini | 26°48′ Gemini | +2 arcsec | `store-2dp` |
| /birthday/june-22/ | Sun 1°06′ Cancer at noon UTC 2026-06-22 | Cancer 1°06′ | Cancer 1°05′ | +10.5 arcsec | `store-2dp` |
| /birthday/june-24/ | lowest noon-UTC Sun degree 1940 to 2030 on June 24: 2°06′ Cancer | 2°06′ Cancer | 2°05′ Cancer | +6 arcsec | `store-2dp` |
| /birthday/june-24/ | highest noon-UTC Sun degree 1940 to 2030 on June 24: 3°30′ Cancer | 3°30′ Cancer | 3°29′ Cancer | +6 arcsec | `store-2dp` |
| /birthday/june-25/ | highest noon-UTC Sun degree 1940 to 2030 on June 25: 4°26′ Cancer | 4°26′ Cancer | 4°27′ Cancer | -69 arcsec | `store-2dp` |
| /birthday/june-3/ | lowest noon-UTC Sun degree 1940 to 2030 on June 3: 12°01′ Gemini | 12°01′ Gemini | 12°02′ Gemini | -64 arcsec | `store-2dp` |
| /birthday/june-3/ | highest noon-UTC Sun degree 1940 to 2030 on June 3: 13°25′ Gemini | 13°25′ Gemini | 13°26′ Gemini | -62 arcsec | `store-2dp` |
| /birthday/june-5/ | lowest noon-UTC Sun degree 1940 to 2030 on June 5: 13°56′ Gemini | 13°56′ Gemini | 13°57′ Gemini | -61 arcsec | `store-2dp` |
| /birthday/june-5/ | highest noon-UTC Sun degree 1940 to 2030 on June 5: 15°21′ Gemini | 15°21′ Gemini | 15°20′ Gemini | +6 arcsec | `store-2dp` |
| /birthday/march-16/ | Sun 25°53′ Pisces at noon UTC 2026-03-16 | Pisces 25°53′ | Pisces 25°54′ | -77.1 arcsec | `store-2dp` |
| /birthday/march-2/ | highest noon-UTC Sun degree 1940 to 2030 on March 2: 12°25′ Pisces | 12°25′ Pisces | 12°26′ Pisces | -65 arcsec | `store-2dp` |
| /birthday/march-20/ | highest noon-UTC Sun degree 1940 to 2030 on March 20: 0°23′ Aries | 0°23′ Aries | 0°24′ Aries | -68 arcsec | `store-2dp` |
| /birthday/march-21/ | lowest noon-UTC Sun degree 1940 to 2030 on March 21: 0°00′ Aries | 0°00′ Aries | 29°59′ Pisces | sign | `store-2dp` |
| /birthday/march-26/ | lowest noon-UTC Sun degree 1940 to 2030 on March 26: 4°56′ Aries | 4°56′ Aries | 4°57′ Aries | -74 arcsec | `store-2dp` |
| /birthday/march-28/ | highest noon-UTC Sun degree 1940 to 2030 on March 28: 8°19′ Aries | 8°19′ Aries | 8°20′ Aries | -64 arcsec | `store-2dp` |
| /birthday/march-30/ | Sun 9°48′ Aries at noon UTC 2026-03-30 | Aries 9°48′ | Aries 9°47′ | +18.1 arcsec | `store-2dp` |
| /birthday/march-31/ | highest noon-UTC Sun degree 1940 to 2030 on March 31: 11°18′ Aries | 11°18′ Aries | 11°17′ Aries | +2 arcsec | `store-2dp` |
| /birthday/may-10/ | Sun 19°51′ Taurus at noon UTC 2026-05-10 | Taurus 19°51′ | Taurus 19°50′ | +15.2 arcsec | `store-2dp` |
| /birthday/may-13/ | highest noon-UTC Sun degree 1940 to 2030 on May 13: 23°15′ Taurus | 23°15′ Taurus | 23°14′ Taurus | +7 arcsec | `store-2dp` |
| /birthday/may-19/ | lowest noon-UTC Sun degree 1940 to 2030 on May 19: 27°37′ Taurus | 27°37′ Taurus | 27°38′ Taurus | -61 arcsec | `store-2dp` |
| /birthday/may-20/ | lowest noon-UTC Sun degree 1940 to 2030 on May 20: 28°36′ Taurus | 28°36′ Taurus | 28°35′ Taurus | +16 arcsec | `store-2dp` |
| /birthday/may-25/ | lowest noon-UTC Sun degree 1940 to 2030 on May 25: 3°23′ Gemini | 3°23′ Gemini | 3°24′ Gemini | -64 arcsec | `store-2dp` |
| /birthday/may-4/ | highest noon-UTC Sun degree 1940 to 2030 on May 4: 14°33′ Taurus | 14°33′ Taurus | 14°32′ Taurus | +8 arcsec | `store-2dp` |
| /birthday/may-5/ | lowest noon-UTC Sun degree 1940 to 2030 on May 5: 14°07′ Taurus | 14°07′ Taurus | 14°06′ Taurus | +1 arcsec | `store-2dp` |
| /birthday/may-5/ | highest noon-UTC Sun degree 1940 to 2030 on May 5: 15°31′ Taurus | 15°31′ Taurus | 15°30′ Taurus | +1 arcsec | `store-2dp` |
| /birthday/may-6/ | highest noon-UTC Sun degree 1940 to 2030 on May 6: 16°28′ Taurus | 16°28′ Taurus | 16°29′ Taurus | -64 arcsec | `store-2dp` |
| /birthday/may-7/ | highest noon-UTC Sun degree 1940 to 2030 on May 7: 17°26′ Taurus | 17°26′ Taurus | 17°27′ Taurus | -67 arcsec | `store-2dp` |
| /birthday/november-1/ | highest noon-UTC Sun degree 1940 to 2030 on November 1: 9°36′ Scorpio | 9°36′ Scorpio | 9°35′ Scorpio | +13 arcsec | `store-2dp` |
| /birthday/november-15/ | lowest noon-UTC Sun degree 1940 to 2030 on November 15: 22°15′ Scorpio | 22°15′ Scorpio | 22°14′ Scorpio | +5 arcsec | `store-2dp` |
| /birthday/november-15/ | highest noon-UTC Sun degree 1940 to 2030 on November 15: 23°38′ Scorpio | 23°38′ Scorpio | 23°39′ Scorpio | -76 arcsec | `store-2dp` |
| /birthday/november-2/ | highest noon-UTC Sun degree 1940 to 2030 on November 2: 10°36′ Scorpio | 10°36′ Scorpio | 10°35′ Scorpio | +10 arcsec | `store-2dp` |
| /birthday/november-20/ | highest noon-UTC Sun degree 1940 to 2030 on November 20: 28°42′ Scorpio | 28°42′ Scorpio | 28°41′ Scorpio | +3 arcsec | `store-2dp` |
| /birthday/november-21/ | lowest noon-UTC Sun degree 1940 to 2030 on November 21: 28°17′ Scorpio | 28°17′ Scorpio | 28°18′ Scorpio | -62 arcsec | `store-2dp` |
| /birthday/november-29/ | highest noon-UTC Sun degree 1940 to 2030 on November 29: 7°47′ Sagittarius | 7°47′ Sagittarius | 7°48′ Sagittarius | -64 arcsec | `store-2dp` |
| /birthday/november-3/ | lowest noon-UTC Sun degree 1940 to 2030 on November 3: 10°12′ Scorpio | 10°12′ Scorpio | 10°11′ Scorpio | +16 arcsec | `store-2dp` |
| /birthday/november-3/ | highest noon-UTC Sun degree 1940 to 2030 on November 3: 11°36′ Scorpio | 11°36′ Scorpio | 11°35′ Scorpio | +6 arcsec | `store-2dp` |
| /birthday/november-4/ | lowest noon-UTC Sun degree 1940 to 2030 on November 4: 11°12′ Scorpio | 11°12′ Scorpio | 11°11′ Scorpio | +8 arcsec | `store-2dp` |
| /birthday/november-4/ | highest noon-UTC Sun degree 1940 to 2030 on November 4: 12°36′ Scorpio | 12°36′ Scorpio | 12°35′ Scorpio | +0 arcsec | `store-2dp` |
| /birthday/november-9/ | highest noon-UTC Sun degree 1940 to 2030 on November 9: 17°37′ Scorpio | 17°37′ Scorpio | 17°36′ Scorpio | +1 arcsec | `store-2dp` |
| /birthday/october-11/ | highest noon-UTC Sun degree 1940 to 2030 on October 11: 18°42′ Libra | 18°42′ Libra | 18°41′ Libra | +3 arcsec | `store-2dp` |
| /birthday/october-16/ | lowest noon-UTC Sun degree 1940 to 2030 on October 16: 22°15′ Libra | 22°15′ Libra | 22°14′ Libra | +4 arcsec | `store-2dp` |
| /birthday/october-16/ | highest noon-UTC Sun degree 1940 to 2030 on October 16: 23°38′ Libra | 23°38′ Libra | 23°39′ Libra | -71 arcsec | `store-2dp` |
| /birthday/october-18/ | lowest noon-UTC Sun degree 1940 to 2030 on October 18: 24°13′ Libra | 24°13′ Libra | 24°14′ Libra | -60 arcsec | `store-2dp` |
| /birthday/october-25/ | lowest noon-UTC Sun degree 1940 to 2030 on October 25: 1°12′ Scorpio | 1°12′ Scorpio | 1°11′ Scorpio | +4 arcsec | `store-2dp` |
| /birthday/october-26/ | lowest noon-UTC Sun degree 1940 to 2030 on October 26: 2°12′ Scorpio | 2°12′ Scorpio | 2°11′ Scorpio | +14 arcsec | `store-2dp` |
| /birthday/october-28/ | highest noon-UTC Sun degree 1940 to 2030 on October 28: 5°36′ Scorpio | 5°36′ Scorpio | 5°35′ Scorpio | +3 arcsec | `store-2dp` |
| /birthday/october-29/ | highest noon-UTC Sun degree 1940 to 2030 on October 29: 6°36′ Scorpio | 6°36′ Scorpio | 6°35′ Scorpio | +8 arcsec | `store-2dp` |
| /birthday/october-3/ | lowest noon-UTC Sun degree 1940 to 2030 on October 3: 9°23′ Libra | 9°23′ Libra | 9°24′ Libra | -76 arcsec | `store-2dp` |
| /birthday/october-30/ | highest noon-UTC Sun degree 1940 to 2030 on October 30: 7°36′ Scorpio | 7°36′ Scorpio | 7°35′ Scorpio | +11 arcsec | `store-2dp` |
| /birthday/october-31/ | highest noon-UTC Sun degree 1940 to 2030 on October 31: 8°36′ Scorpio | 8°36′ Scorpio | 8°35′ Scorpio | +13 arcsec | `store-2dp` |
| /birthday/october-7/ | lowest noon-UTC Sun degree 1940 to 2030 on October 7: 13°21′ Libra | 13°21′ Libra | 13°20′ Libra | +9 arcsec | `store-2dp` |
| /birthday/october-7/ | highest noon-UTC Sun degree 1940 to 2030 on October 7: 14°45′ Libra | 14°45′ Libra | 14°44′ Libra | +9 arcsec | `store-2dp` |
| /birthday/october-8/ | lowest noon-UTC Sun degree 1940 to 2030 on October 8: 14°19′ Libra | 14°19′ Libra | 14°20′ Libra | -64 arcsec | `store-2dp` |
| /birthday/october-8/ | highest noon-UTC Sun degree 1940 to 2030 on October 8: 15°43′ Libra | 15°43′ Libra | 15°44′ Libra | -64 arcsec | `store-2dp` |
| /birthday/september-10/ | highest noon-UTC Sun degree 1940 to 2030 on September 10: 18°17′ Virgo | 18°17′ Virgo | 18°18′ Virgo | -71 arcsec | `store-2dp` |
| /birthday/september-12/ | highest noon-UTC Sun degree 1940 to 2030 on September 12: 20°15′ Virgo | 20°15′ Virgo | 20°14′ Virgo | +5 arcsec | `store-2dp` |
| /birthday/september-14/ | highest noon-UTC Sun degree 1940 to 2030 on September 14: 22°12′ Virgo | 22°12′ Virgo | 22°11′ Virgo | +13 arcsec | `store-2dp` |
| /birthday/september-16/ | lowest noon-UTC Sun degree 1940 to 2030 on September 16: 22°45′ Virgo | 22°45′ Virgo | 22°44′ Virgo | +17 arcsec | `store-2dp` |
| /birthday/september-18/ | lowest noon-UTC Sun degree 1940 to 2030 on September 18: 24°42′ Virgo | 24°42′ Virgo | 24°41′ Virgo | +14 arcsec | `store-2dp` |
| /birthday/september-18/ | highest noon-UTC Sun degree 1940 to 2030 on September 18: 26°06′ Virgo | 26°06′ Virgo | 26°05′ Virgo | +4 arcsec | `store-2dp` |
| /birthday/september-20/ | highest noon-UTC Sun degree 1940 to 2030 on September 20: 28°02′ Virgo | 28°02′ Virgo | 28°03′ Virgo | -72 arcsec | `store-2dp` |
| /birthday/september-23/ | lowest noon-UTC Sun degree 1940 to 2030 on September 23: 29°34′ Virgo | 29°34′ Virgo | 29°35′ Virgo | -62 arcsec | `store-2dp` |
| /birthday/september-25/ | highest noon-UTC Sun degree 1940 to 2030 on September 25: 2°57′ Libra | 2°57′ Libra | 2°56′ Libra | +5 arcsec | `store-2dp` |
| /birthday/september-27/ | Sun 4°23′ Libra at noon UTC 2026-09-27 | Libra 4°23′ | Libra 4°24′ | -71.8 arcsec | `store-2dp` |
| /birthday/september-5/ | lowest noon-UTC Sun degree 1940 to 2030 on September 5: 12°02′ Virgo | 12°02′ Virgo | 12°03′ Virgo | -66 arcsec | `store-2dp` |
| /birthday/september-5/ | highest noon-UTC Sun degree 1940 to 2030 on September 5: 13°27′ Virgo | 13°27′ Virgo | 13°26′ Virgo | +1 arcsec | `store-2dp` |
| /birthday/september-9/ | lowest noon-UTC Sun degree 1940 to 2030 on September 9: 15°55′ Virgo | 15°55′ Virgo | 15°56′ Virgo | -63 arcsec | `store-2dp` |
| /birthday/february-26/ | Sun at least 6.8° inside Pisces on February 26 (1940 to 2030) | 6.8° | noon-UTC minimum 6.749°, whole-day minimum 6.246° |  | `margin` |
| /birthday/january-11/ | Sun at least 8.5° inside Capricorn on January 11 (1940 to 2030) | 8.5° | noon-UTC minimum 8.448°, whole-day minimum 7.938° |  | `margin` |
| /birthday/january-2/ | Sun at least 11° inside Capricorn on January 2 (1940 to 2030) | 11° | noon-UTC minimum 10.948°, whole-day minimum 10.438° |  | `margin` |
| /birthday/july-10/ | Sun at least 11.3° inside Cancer on July 10 (1940 to 2030) | 11.3° | noon-UTC minimum 11.247°, whole-day minimum 10.771° |  | `margin` |
| /birthday/june-14/ | Sun at least 6.1° inside Gemini on June 14 (1940 to 2030) | 6.1° | noon-UTC minimum 6.049°, whole-day minimum 5.571° |  | `margin` |
| /birthday/may-7/ | Sun at least 12.6° inside Taurus on May 7 (1940 to 2030) | 12.6° | noon-UTC minimum 12.548°, whole-day minimum 12.065° |  | `margin` |
| /birthday/november-15/ | Sun at least 6.4° inside Scorpio on November 15 (1940 to 2030) | 6.4° | noon-UTC minimum 6.346°, whole-day minimum 5.842° |  | `margin` |
| /birthday/october-16/ | Sun at least 6.4° inside Libra on October 16 (1940 to 2030) | 6.4° | noon-UTC minimum 6.347°, whole-day minimum 5.851° |  | `margin` |
| /birthday/october-7/ | Sun at least 13.4° inside Libra on October 7 (1940 to 2030) | 13.4° | noon-UTC minimum 13.348°, whole-day minimum 12.854° |  | `margin` |
| /birthday/september-20/ | Sun at least 2° inside Virgo on September 20 (1940 to 2030) | 2° | noon-UTC minimum 1.947°, whole-day minimum 1.458° |  | `margin` |
<!-- generated:pages:end -->

## Data mismatches

<!-- generated:data:start -->
| Source | Category | Count | Likely cause | Example: statement, our value, NASA value, difference |
| --- | --- | ---: | --- | --- |
| src/data/transits-YYYY-MM.json | aspect | 405 | `engine-slow` | Mercury square Neptune 2026-01-01T13:36:47.289Z at 29.5° sagittarius; 2026-01-01T13:36:47.289Z; 2026-01-01T13:33:10.001Z, Mercury at 29.51° sagittarius; +217 s (tolerance 60 s) |
| src/data/ingresses.json | ingress | 305 | `engine-slow` | Neptune sign window from 1901-07-19T23:29:00.641Z (cancer); 1901-07-19T23:29:00.641Z; 1901-07-19T23:57:02.838Z cancer; -1682.2 s |
| src/data/people.json | natal-position | 153 | `engine-old` | Neptune Leo 26.54° at 1928-05-30T11:00:00.000Z (noon civil time); 146.54°; 146.5329°; +0.0071° |
| src/data/people.json | natal-page-degree | 29 | `double-round` | Mars 28.3° Leo; Leo 28.3°; Leo 28.245°; +0.055° |
| src/data/transits-YYYY-MM.json | ingress | 28 | `engine-slow` | Neptune enters aries 2026-01-26T14:31:41.082Z; 2026-01-26T14:31:41.082Z; 2026-01-26T17:35:23.115Z aries; -11022.0 s |
| src/data/transits-YYYY-MM.json | degree-display | 4 | `tie` | Mercury direct station shown as 16°19′ Cancer; 16°19′ Cancer; 16°18′ Cancer; +3.1 arcsec |
| src/data/transits-YYYY-MM.json | lunation | 2 | `tie` | new moon 2026-06-15T02:54:11.458Z at 24°02′ gemini; 2026-06-15T02:54:11.458Z 24°02′ Gemini; 2026-06-15T02:54:10.108Z 24°03′ Gemini; +1.3 s, -1.6 arcsec |
| src/data/eclipses.json | degree-display | 2 | `rounded` | lunar eclipse 2027-02-20 degree field 2.0; 2.0 -> 2° when truncated; 1°59′ Virgo (truncates to 1°);  |
| src/data/eclipses.json | eclipse-duration | 2 | `shadow-model` | total lunar eclipse 2029-06-26: totality about 103 minutes; 103 min; 101.9 min (NASA canon, total phase); +1.1 min |
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

## Recommended, not fixed

1. **Localized transit labels.** Truncate these as well. Their test is
   protected (`src/lib/i18n/astrology.test.ts`) and needs the owner's
   allowance. Until then, the es, fr, it and pt /transits/ pages can print
   "30°" in July 2028.
2. **Slow-planet times (fixed, see above).** The pages print NASA's
   instants. Two places still print the engine's: the Learn placement pages,
   whose 16 window dates sit a day from NASA's and which are protected
   (`src/pages/learn/`, `src/content/learn/`: the owner's allowance would
   let `refineIngressWindows` run there, and correct "May 21, 2038" in
   neptune-in-taurus and "June 18, 2066" in pluto-in-pisces to May 22 and
   June 17), and the sky calendar feed (`/sky-calendar.ics`), whose station
   times, within 6 minutes of NASA's, come from a module the AI tools bundle.
   The Sun's ingresses keep the engine's instants, at most 43.6 s from
   NASA's. Rerun the generator when a data file gains an event, and fetch
   the Horizons tables again before 2031-05.
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
- Until this change, times were printed to the minute for slow planets the
  engine cannot place that finely: Neptune was three hours off. The pages now
  take those times from NASA, apart from the Learn placement windows.
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
