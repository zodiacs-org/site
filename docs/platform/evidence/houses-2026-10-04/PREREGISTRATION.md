# Preregistration: the house systems against Swiss Ephemeris on rc.16

Written 2026-10-04 on the site branch `next-gates`, made from main at
`9d7dd31d`. It is committed before the tools below are written and before any
measurement on rc.16 is run, and it is not edited after a measurement. A
failure is recorded as a failure, with its numbers; no grid, tolerance or
criterion below changes after a result is seen.

## Why this measurement

Each house system's ledger unit, `P2.A.house.<system>` (weight 0.2), has the
gate: within 0.01″ of Swiss `houses_armc` given its inputs, and within 3″ end
to end on the 55°–66.6° ladder; polar status agrees; in a released engine
adopted by the site and the MCP adapter. Eleven systems were accepted on
engine rc.9 ([`../houses-2026-09-26/`](../houses-2026-09-26/README.md)) and
Equal-MC on rc.10 ([`../points-2026-09-26/`](../points-2026-09-26/README.md)).
Koch failed end to end: 3.73″ in 1 of 353 ladder cases from 1850 to 2049, at
65.6°, where the given-inputs half agreed to 0.000000005″. The record traced it
to the two programs' sidereal times, which the Koch cusps magnify near the
polar circle.

The site and the MCP adapter now run engine 0.1.1-rc.16. Since rc.9 the
engine reads UT1 from the IERS tables (rc.15) and takes the IAU 2000B nutation
(rc.16), and the co-ascendants record of the same day
([`../co-ascendants-2026-10-04/`](../co-ascendants-2026-10-04/README.md))
found its RAMC within 0.0015″ of Swiss's from 1850 to 2049. This record runs
both halves again, for all thirteen systems, on the engine the site and the
adapter serve.

## Instrument

Swiss Ephemeris 2.10.03 (pyswisseph 2.10.03), as a comparison instrument
only, as in the two earlier records: its values stay in memory and the
committed files hold statistics and, for the worst Koch case, its instant,
place and differences. No ephemeris file is needed for the house functions.

## Engine

The released archive the site vendors, `vendor/zodiacs-engine-0.1.1-rc.16.tgz`,
SHA-256 `43a72d30e483d8ff22024e403c4bd0d86d81bb6e1d0ad138f857cd001ab015d8`.

## Given the same inputs

The method of `../houses-2026-09-26/tools/dump-given.mjs` and
`compare-given.py`, with the same seed (20260926) and the same two sets: the
ladder every 0.1° from 55° to 66.6°, both hemispheres, at 24 RAMCs (5,616
cases), and 20,000 broad draws over every latitude from −89.9° to 89.9° with
the obliquities of 1800–2200. The engine's `computeAngles` and
`computeHouses` take the RAMC, latitude and obliquity directly; Swiss's
`swe_houses_armc` takes the same three. One change: Equal-MC, Swiss's `D`, is
compared too; the rc.9 tools predate it.

- **Pass, for each system:** on both sets, no case over 0.01″ (the largest of
  the twelve cusps), and no case undefined on one side only.

## End to end

The cases of `../houses-2026-09-26/tools/dump-end-to-end.mjs`, drawn the same
way with the same seed (1234567), so the same instants and places: the ladder
from 55° to 66.6° every 0.2°, both hemispheres, six instants each, then
3,000 broad draws within 66° of the equator, instants from 1800 to the end of
2199. Two changes:

- The engine side asks `houses({ time, place, system })` of
  `@zodiacs/engine/calc` for each system, which computes the cusps as
  `natalChart()` does, and records the instant's UT1 Julian day from its
  receipt. Since rc.15 the engine reads a UTC instant from 1972 to 2027-10-02
  through the IERS tables' UT1 − UTC; the rc.9 tool gave Swiss the UTC as UT1,
  which no longer matches the engine's own reading. Swiss's `swe_houses_ex`
  receives the engine's UT1 Julian day, so both programs read the same
  instant as UT1, as the rc.9 record intended.
- Equal-MC (`D`) is compared too.

A system that falls back (Placidus or Koch where undefined) is not compared
end to end, as in the rc.9 record; the given-inputs half judges polar status.

- **Windows:** 1850–2049 (by the UTC year), where Swiss's sidereal time is the
  IAU one, and the whole span, reported.
- **Pass, for each system:** on the ladder from 1850 to 2049, no case over 3″
  (the largest of the twelve cusps). The broad set and 1800–2199 are reported
  and not judged, as in the rc.9 record.

## Reported

For each system and set: the cases compared, the median, the 95th percentile,
the largest difference and the count over the tolerance, and the undefined
counts for the given-inputs half. For the worst Koch ladder case from 1850 to
2049: its instant, place and difference, and the difference again with the
engine's `computeHouses` given Swiss's own RAMC and true obliquity, as the rc.9
record's `worst-koch` tools did.

## What a result would decide

A system that passes both halves on rc.16 meets its gate in the release the
site and the adapter run. Koch's unit moves from failed to accepted only if it
passes both. A system that passed on rc.9 or rc.10 and fails here is recorded
as failing on rc.16, and its acceptance is reopened.
