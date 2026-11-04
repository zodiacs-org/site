# Chiron from NASA JPL Horizons

The engine has no Chiron. With `ZODIACS_SKY_EVENTS_ENABLED=1` the hosted
`get_natal_chart` and `search_sky_events` take 2060 Chiron's position from a
table of NASA JPL Horizons values instead: `src/data/chiron.json`, read by
`src/ai-tools/features/chiron.ts`. This directory keeps where those values came
from and how close the table stays to them. Nothing here comes from Swiss
Ephemeris, and no Swiss value was used to build or check anything.

## Source

- **Service.** The Horizons API, `https://ssd.jpl.nasa.gov/api/horizons.api`,
  version 1.2, run by the Solar System Dynamics group at NASA's Jet Propulsion
  Laboratory. Public domain.
- **Target.** Record `2060;`, 2060 Chiron (1977 UB), orbit solution JPL#171
  (solution date 2026-06-05, 6,026 observations from 1895 to 2026), with the
  small-body perturbers SB441-N16 and the planetary ephemeris DE441.
- **Quantity.** Observer quantity 31 from the geocentre (`500@399`): the
  apparent ecliptic longitude and latitude of date (light-time, gravitational
  deflection and stellar aberration; IAU76/80 ecliptic of date), airless, on a
  TT clock. This is the quantity the independent references use for the
  planets (`../independent-references/`), so it is tropical and of date as the
  engine's own longitudes are.
- **Span.** Horizons integrates this solution from 1599-12-11 to 2501-01-01
  TT, so it covers all of 1800 to 2199: the table is kept to the span the
  site's charts and scans already use (`src/lib/engine/reference-span.ts`),
  1800-01-01T00:00Z up to 2200-01-01T00:00Z. Outside it the tools leave Chiron
  out with a plain sentence and never extrapolate.
- **Fetched.** 2026-11-04 between 17:04 and 17:07 UTC, by `fetch.py`, through
  the independent references' own client. Each response is kept byte for byte
  under `horizons/`, and `horizons/MANIFEST.json` records its query, retrieval
  time, size and SHA-256.

| Response | What it is | Read by |
| --- | --- | --- |
| `chiron-every-24-days` | the table: every 24 days from 1799-09-27 to 2200-04-22 TT, 6,097 rows | `scripts/build-chiron.mjs` |
| `chiron-checks-1` to `-14` | 280 instants the table does not hold, each with the instants 12 hours either side: 240 at random over the span (seed 2060) and 20 in each of its first and last 120 days | `chiron.test.ts` |
| `chiron-hourly-<date>` | hourly values for four days around twelve stations and sign changes: 1800 and 2199 at the span's ends, 1976, and every step between Aries and Taurus from 2025 to 2028 | `chiron.test.ts` |

## The table

`scripts/build-chiron.mjs` checks the table response against its recorded
SHA-256, reads each longitude as written (to 1e-7 degree), unwraps it across
360 degrees, rounds it to 1e-5 degree (0.036″) and writes the first value and
then each change, as whole numbers. It computes nothing else.
`chiron.test.ts` rebuilds the file and requires the committed bytes.

- **Step.** 24 days on Terrestrial Time, four rows past each end of the span,
  6,097 rows: 43 KB on disk and about 50 KB in each runtime bundle, where
  Chiron's table and code together add 64 KB.
- **Interpolation.** A longitude between rows comes from the eight-point
  Lagrange polynomial through the four rows on each side of it, and its daily
  motion from that polynomial's derivative. Chiron is retrograde when that
  motion is negative. An instant is put on TT with the engine's own clock
  (`src/lib/engine/time-basis.mjs`), as the charts are.
- **Events.** `chironEvents` samples the daily motion every four days, narrows
  each change of sign to a second for a station, and in each stretch between
  stations, where the longitude only rises or only falls, narrows each multiple
  of 30 degrees it passes to a second for a sign change. Over the whole span
  stations are at least 128 days apart.

## Error bound

Measured against Horizons values the table does not hold:

| Check | Count | Longitude | Daily motion |
| --- | --- | --- | --- |
| Every day from 1800-01-01 to 2199-12-31 TT not on a table row (`dense-check.json`) | 140,009 | median 0.36″, 99th percentile 1.54″, worst 2.51″ | median 0.08″, worst 1.03″ a day |
| The 280 kept checks, edges included | 280 | worst 2.22″ (in the first 120 days of 1800) | worst 0.32″ a day |

The tests hold the table to 3″ in longitude and 1.5″ a day in daily motion,
the dense run's worst figures rounded up: well inside the one arcminute asked
of it. Two things set that floor, and a finer step would not remove them. The
Earth swings around the Earth-Moon centre every month, which moves Chiron by up
to about 0.8″, and Horizons includes the Sun's bending of light, which changes
by a few arcseconds within a day when Chiron passes within a degree of the Sun.
A 24-day table cannot follow either; the worst days are at those conjunctions.
The engine applies no light bending to the planets (`deflection:none` in the
conventions registry), so near a conjunction the table is the one that differs
from the engine's convention, by those few arcseconds.

Events, against the same Horizons values:

- **Sign changes** fall within 8.5 minutes of the hourly Horizons values in the
  five windows that hold one, and the dense run finds the same 235 sign changes
  from 1800 to 2199 as the daily values.
- **Stations** fall within 90 minutes of the hourly Horizons values in the
  seven windows that hold one, and the dense run finds the same 784. A station
  is the moment the daily motion passes zero, so the monthly 0.8″ swing,
  which the table smooths out, moves it by up to an hour or two while Chiron
  barely moves for days. The tests allow two hours, and `search_sky_events`
  says so beside any Chiron station it lists.

## Regenerating

```bash
python3 docs/engine-validation/chiron/fetch.py             # what is missing; --refresh fetches everything again
node scripts/build-chiron.mjs                              # src/data/chiron.json; --check for drift
python3 docs/engine-validation/chiron/fetch.py --dense DIR # every day of the span, about 7 MB, not kept
npx vite-node --script docs/engine-validation/chiron/measure.ts DIR   # dense-check.json, statistics only
```

A refreshed response carries a new retrieval banner, so its SHA-256 changes
even when its values do not; JPL may also publish a new orbit solution. Either
way the table, the manifest and `dense-check.json` are rebuilt together, and
`chiron.test.ts` holds them to each other.
