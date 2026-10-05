# Election search, version 0

Ledger unit B5.b, "election search: five-predicate grammar on the compute
API", whose gate reads: "verified against brute force".

| file | what it holds |
| --- | --- |
| `PREREGISTRATION.md` | the evaluation, written before its seed was drawn |
| `tools/draw.ts` | the queries, drawn from a seed |
| `tools/brute-force.ts` | the brute force: every condition read every 10 seconds, with its own void of course |
| `tools/run.ts` | the evaluation's three steps: the endpoint, the brute force, the comparison |
| `endpoint.json` | the endpoint's windows for the 100 answered queries, and the query it refused |
| `brute-0.json`, `brute-1.json`, `brute-2.json` | the brute force's windows, in three shards |
| `results.json` | the comparison, query by query |
| `tools/cost-sweep.ts`, `cost-sweep.txt` | the costliest requests the limits allow, timed beside the costliest events request |
| `src/lib/compute-api/elections.ts` | the search |
| `tests/api/compute-api-elections.test.ts` | the search under test |
| `src/pages/developers/compute/index.astro` | the page, `/developers/compute/#elections` |

## What the endpoint does

`POST /api/v1/elections` takes a window of at most 31 days and one to five
conditions, and returns every stretch of the window in which all of them
hold. The conditions are the Moon waxing or waning; the Moon void of course,
under the engine's own rule (from its last exact Ptolemaic aspect to the Sun
or a planet, Mercury to Pluto, to its entry into the next sign); a body in a
sign; a planet retrograde; and a body in the 1st, 4th, 7th or 10th house at a
place within 60° of the equator. Each can be negated.

Sign changes, stations and new and full moons come from the engine's crossing
search, the one the events endpoint uses. A void period runs from the Moon's
last exact aspect, found by scanning back in 3-hour steps from each of its
sign changes, to that sign change. Houses come from `natalChart`, sampled
every hour only where the other conditions all hold, and more often where a
body passes more than one house between two samples. Every boundary is
narrowed to a second.

## The evaluation

`PREREGISTRATION.md` was committed before seed 2026100505 was drawn, and
says what the brute force reads, how the queries are drawn, how the windows
are compared and what passes. The run was made once, on 2026-10-05, at the
commit that added it, with the search's code as this branch keeps it. The
branch was moved onto a later main before it was published, so that commit
and the one that adds the results have new identifiers. They keep their
order and their author times, 06:58 and 07:56 UTC, and the files the run
read are the same in both.

**All 100 answered queries passed.** In each, the endpoint and the brute
force found as many windows, and every start and end of the endpoint's was
within 10 seconds of the brute force's.

- **Windows compared:** 206. In 29 queries neither found any window.
- **Largest difference:** 5.4 seconds. The brute force places a change at
  the middle of the 10 seconds in which it happens, so it can be 5 seconds
  off, and the endpoint's change is within a second.
- **Closed or dropped:** none. The comparison closes gaps and drops windows
  shorter than 20 seconds, which a scan every 10 seconds cannot see; neither
  list held one.
- **Refused for the allowance:** one query, which the run recorded and
  replaced, as preregistered: two angular conditions, Uranus in Aquarius and
  the Moon waxing, over 47 hours at 50.5° south in Vehlow houses.

The 100 queries hold 233 conditions: 45 of the Moon's phase, 45 of void of
course (24 void, 21 not void), 46 of a sign, 52 of retrograde motion and 45
of angular houses, in 41 queries. They hold one condition 33 times, two 28
times, three 18 times, four 15 times and five 6 times. Their windows start
from 1800 to 2195 and run from 6.8 hours to 9.5 days, 352.5 days in all. The
angular queries fell in 12 of the 13 house systems; none drew whole signs,
whose cusps jump rather than move, so the search halves those crossings
rather than interpolating them. A unit test holds whole signs, with Placidus
and Koch, to a scan every minute. The queries used a median of 746
evaluations, and at most 3,100 of the 6,000 allowed.

The brute force reads the same engine as the search: `positions()`,
`moonPhase()`, `natalChart()` and `houseOf()`. So the evaluation checks the
search, its crossing steps, its scan for the Moon's last aspect, its house
sampling and its narrowing, and not the engine. Void of course is read by the
brute force's own code, not by the engine's `voidOfCourseWindows` or the
search's; a unit test separately holds the search's void periods to
`voidOfCourseWindows`, within 2 seconds, in every month of 2026 and in March
1952 and July 2041, more than 150 periods in all.

## The cost of a request

In three runs on one machine (`unit-cost.txt`), a step of a crossing search
cost 0.03 to 0.07 milliseconds of CPU, and a full calculation, every body's
position at an instant or a `natalChart` for a house, 0.7 to 1.2. A station
search reads every body's position at each instant it samples, and the
election search counts each new instant as a full calculation beside the
step. The allowance counts a step as one evaluation and a full calculation as
25, so it bounds a request's time whatever its conditions ask for, and a
request that would pass 6,000 is refused whole.

An elections request is counted under both of the API's rate limits, as an
events request is, so it adds nothing to what one address can cost while the
costliest elections request costs no more than the costliest events request.
`tools/cost-sweep.ts` asked each of seven shapes once in every fourth year
from 1800 to 2196, 100 requests each, through the real handler with its real
allowance, on one machine (`cost-sweep.txt`). A refused request is timed until
it was refused.

| shape | refused | most evaluations in an answer | CPU, 95th percentile | CPU, most |
| --- | ---: | ---: | ---: | ---: |
| events, 92 days, every body and kind | 0 | 5,279 of 12,000 | 386 ms | 476 ms |
| the Moon void of course, 31 days | 0 | 5,551 | 186 ms | 211 ms |
| five conditions without houses, 31 days | 10 | 5,941 | 205 ms | 233 ms |
| five planets retrograde or direct, 31 days | 0 | 2,737 | 56 ms | 68 ms |
| the Moon angular, 4 days | 32 | 6,000 | 248 ms | 303 ms |
| not void of course and the Sun angular, 31 days | 100 | none answered | 158 ms | 180 ms |
| the Moon in a sign, waxing, and Mars angular, 31 days | 9 | 5,924 | 189 ms | 236 ms |

The slowest elections request, the Moon angular over four days, took 303 ms
before it was refused for its allowance; the slowest events request took
476 ms. `tools/worst-case.ts` ran every endpoint's costliest shapes, four of
these elections shapes among them, over every year from 1800 to 2199 on the
same machine within the hour, once with engine rc.15 installed and once with
rc.16 (`../compute-api-2026-10-05/`). The elections shapes took at most
343 ms on rc.15 and 384 ms on rc.16, and the events shape 403 ms and 539 ms.
What one address can cost at both rate limits is still set by events and
positions requests. On rc.16 it is more than the 10 CPU-seconds a minute the
rules were set for, which F-78 records.

## Not done, and not claimed

- **Completeness is tested, not proven.** The crossing search samples every
  5 days, or every day for the Moon and for new and full moons, and can miss
  a pair of crossings that fall between two samples. The receipt says so.
- **The search reads the engine.** Its positions, houses and phases are the
  engine's, as accurate as the engine is; the evaluation does not check them.
- **The sweep is one machine's.** A request takes a different time on the
  host that serves the API; the costliest elections and events requests
  were compared on one machine, in one run of each tool.
