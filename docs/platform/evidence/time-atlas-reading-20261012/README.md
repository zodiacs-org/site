# The time atlas feeds resolve_birth_time (B3.b), 2026-10-12

The brief's B3 asks for an open historical time atlas "feeding
`resolve_birth_time`", and B3.b's gate is that the resolver "uses the atlas
with its uncertainty flag". B3.a, accepted on 2026-09-29, is the atlas itself:
the engine repository's `atlas/`, which records with primary citations what
the clocks said in 21 places of France and the United States from 1870 to
1919, every rule flagged `documented`, `inferred` or `uncertain`.

## What the site carries

- `src/data/time-atlas/`: the ten data files of `atlas/data/` at engine commit
  `7307665bdbc432269fdac006104f661be16000bc`, byte for byte, under CC BY 4.0.
  `src/lib/time-atlas/index.test.ts` holds each to its SHA-256.
- `src/lib/time-atlas/lib.mjs`: the engine repository's resolver,
  `atlas/tools/lib.mjs` at that commit, under MIT, with one change: its loader
  takes the manifest and the files it lists instead of reading a directory, so
  it opens no file. The test holds everything after the loader to the
  original's digest.
- `tests/fixtures/time-atlas-readings.json`: 2,100 readings by the engine
  repository's own resolver, for every place at 12 seeded wall times from
  1869-12-31 to 1920-01-02 and at minutes around every change of its civil
  clock: 1,482 of one instant, 261 of a time the clocks repeated, 231 of a
  time they skipped and 126 outside the window. The port gives every one of
  them, compared through each instant, rule and flag and a digest of the whole
  result.

The data directory is outside the claims ledger's scope: its statements are
the atlas's own, cited per rule and checked by the atlas's checks in the engine
repository (B3.a).

## What a request gets

`POST /api/v1/time` and the adapter's `resolve_birth_time` take
`atlasPlace`, one of the atlas's 21 places, and the answer adds `atlas`: the
atlas's reading of the same wall time at that place, beside tzdb's. Each
instant names the rule, the rule's uncertainty flag with its reasons, and the
rule's citations, titled and linked; `secondsFromTzdb` is the atlas's first
instant minus tzdb's. In the tests:

- Strasbourg, at noon on 1 June 1916, was German and kept German summer time:
  the atlas's instant is 10:00 UTC, two hours before tzdb's answer for
  Europe/Paris (`secondsFromTzdb: -7200`).
- Paris at noon on 1 June 1900, on Paris mean time: the two agree
  (`secondsFromTzdb: 0`).
- New York at 12:00 on 18 November 1883, when the city's clocks went back to
  Eastern time: two instants, both flagged `uncertain`.
- Chicago in 1925: outside the window, no instant.
- Brest at noon on 1 June 1880, before France's legal time: the atlas reads
  Brest's mean time, and so does tzdb, on Brest's longitude, so the two agree
  within a second (`secondsFromTzdb: -0.293`; tzdb's instant is to the
  second, the atlas's to the millisecond).

The place must lie in the request's `local.zone`, and tzdb's reading uses
the place's own longitude, from the atlas's `places.json`: one sent with
`atlasPlace` must be the place's, to 0.01°, and a `country` the place's, FR
or US. A place in another zone (`/atlasPlace`), another longitude
(`/longitude`) or another country (`/country`) is refused, so the two
readings are always of one place's clock, with that place's calendar
history. #742's reviews found each fault: before them, New York's reading
could stand beside tzdb's for Paris; without a longitude, Brest's beside
Paris mean time, about 27 minutes apart; and Paris's clock beside Russia's
calendar history.

`src/mcp/time-places.test.ts` adds 25 atlas requests to the adapter's corpus,
one at each place at a seeded time and four at its changes, each answered as
the compute API's handler answers it, and held to the output schemas and the
OpenAPI response; together they reach all 21 places and all four statuses.

## Production

In production since #742 (`ef463943`, `dpl_BQLq9CNADcAhSKT3NCdyTASBBmxF`): the
time endpoint reads Strasbourg in 1916 on the atlas as documented, Brest in
1880 on its own longitude, and refuses another zone, longitude or country
([the record](../birth-time-tools-20261012/README.md#production)).

## Not done

The atlas is read only for a place it lists. It is not read for an unlisted
place by longitude, which the atlas allows in France with the place's
département, nor for a railway clock, which it records for some places.
