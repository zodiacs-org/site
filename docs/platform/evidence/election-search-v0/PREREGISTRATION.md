# Preregistration: the election search against a brute force every 10 seconds

Written 2026-10-05 on the branch `election-search`, at the commit that adds
this file. That commit holds the search under test
(`src/lib/compute-api/elections.ts`, as `POST /api/v1/elections` answers it
through `src/lib/compute-api/handler.ts`) and the three tools below. The
tools were written first and tried on trial seeds: seed 1, six queries from
an earlier draft of the generator, through the endpoint, the brute force and
the comparison (all six passed, with 4 windows between them, too few, which
is why conditions are now made to hold at the window's middle); and seed 2,
twelve queries from this generator, through the endpoint only. The seed below
has not been drawn. Nothing below changes after its result is seen. A failure
is recorded as a failure, with its numbers.

## What is held to what

The acceptance ledger's unit B5.b, "election search: five-predicate grammar on
the compute API", has the gate "verified against brute force". The search
finds each condition's changes with the engine's crossing search, scans back
from each of the Moon's sign changes for its last exact aspect, samples
natalChart hourly for houses, and narrows every change to a second. The
brute force does none of that: it reads every condition at every 10 seconds
of the window, straight from the engine.

## The brute force (`tools/brute-force.ts`)

At every instant `from + k × 10 s` before `to`:

- **phase:** `moonPhase()`'s elongation; waxing below 180°, waning from 180°.
- **sign:** the body's sign from the longitude `positions()` gives.
- **retrograde:** the body's speed from `positions()` below zero.
- **angular:** `natalChart()` at the query's place and house system, and
  `houseOf()` of the body's longitude among its cusps: house 1, 4, 7 or 10.
- **void of course,** read here, not by the engine's `voidOfCourseWindows`
  nor by the search's own code: from `positions()` at every 10 seconds, read
  on past `to` until the Moon changes sign, the Moon is void at an instant
  when no exact Ptolemaic aspect (0°, 60°, 90°, 120°, 180°, either way round)
  to the Sun, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune or Pluto
  falls between that instant and its entry into its next sign. An aspect is
  a change of sign of the Moon's distance past it, within 90°, between two
  instants. Where an aspect and the entry fall in the same 10 seconds, linear
  interpolation orders them, and an aspect after the entry belongs to the
  next sign.
- `not` negates a condition, and the windows are the stretches of instants at
  which every condition holds. Each window starts and ends at the middle of
  the 10 seconds in which the state changes, or at `from` or `to`.

## The queries (`tools/draw.ts`)

**Seed 2026100505,** mulberry32, every draw in a fixed order. Each query:

- **Conditions:** one to five, with weights 0.3, 0.3, 0.2, 0.1 and 0.1. Each
  kind is drawn uniformly from phase, void of course, sign, retrograde and
  angular. Three times in four a condition is made to hold at the window's
  middle: the phase there, the body's sign there, `not` set to what the
  planet's motion or the body's house is there. Otherwise its parameters are
  drawn uniformly, with `not` one time in four. Void of course takes `not`
  one time in two. Bodies come from the ten from the Sun to Pluto, and the
  eight planets for retrograde. A repeated condition is left out.
- **Window:** the start uniform to the minute from 1800-01-01 to 2199-11-30
  UTC; with an angular condition 6 to 48 hours long, without one 1 to 10
  days, to the minute.
- **Place,** with an angular condition: latitude uniform in [−60°, 60°],
  longitude in [−180°, 180°), to four decimals; the house system uniform
  among the thirteen.

## The run (`tools/run.ts`)

1. Queries are drawn in order and sent to the real handler with its real
   allowance (`elections.samples`), until **100 are answered**. A query
   refused with `budget-exhausted` is recorded with its limit and the next is
   drawn. Any other answer stops the run.
2. The brute force reads each of the 100 answered queries.
3. **Comparison:** in both lists of windows, gaps shorter than 20 seconds are
   closed and then windows shorter than 20 seconds are dropped, since a scan
   every 10 seconds cannot see them; how many were closed and dropped is
   counted. A query **passes** when the two lists then hold as many windows,
   each start and end within **10 seconds** of the brute force's.

## Gate

**Pass:** all 100 answered queries pass. A query that fails fails the gate:
the record lists it with its numbers and its cause. The run also reports how
many queries were refused for their allowance, the windows compared, and the
largest difference.

The run is made once. If it fails, the cause is fixed in a new commit and the
evaluation is run again on a new seed, chosen after the fix and stated in the
record before that run; this run's result stays in the record.
