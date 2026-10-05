# Election search, version 0

Ledger unit B5.b, "Election grammar with five predicates compiled to the
interval search", whose gate reads: "query results against brute force at
10 s on 100 random queries". `PREREGISTRATION.md` quotes the unit and its
gate loosely, as "election search: five-predicate grammar on the compute
API" and "verified against brute force"; it stays as it was committed.

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

Two changes reached the search's code after the run, both from its
independent review. A request whose station searches pass the allowance
between their steps and the positions they read is now refused; one such
request had been answered with 6,040 evaluations of 6,000. And the
`outside-reference-span` flag now covers the days a void-of-course
condition reads around the window. Run again with both, the endpoint's part
of the evaluation (`tools/run.ts endpoint 2026100505 100`) wrote the same
`endpoint.json`, byte for byte.

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
  replaced, as preregistered: Venus not angular, the Sun not angular,
  Uranus in Aquarius and the Moon waxing, over 47 hours at 50.5° south in
  Vehlow houses.

The 100 queries hold 233 conditions: 45 of the Moon's phase, 45 of void of
course (24 void, 21 not void), 46 of a sign, 52 of retrograde motion and 45
of angular houses, in 41 queries. None of the phase conditions is negated,
and one of the sign conditions is. They hold one condition 33 times, two 28
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
cost 0.03 to 0.06 milliseconds of CPU, and a full calculation, every body's
position at an instant or a `natalChart` for a house, 0.7 to 1.2. A station
search reads every body's position at each instant it samples, and the
election search counts each new instant as a full calculation beside the
step. The allowance counts a step as one evaluation and a full calculation as
25, so it bounds a request's time whatever its conditions ask for, and a
request that would pass 6,000 is refused whole.

Houses cost the most: one angular condition alone fits a window of about
three to four days in Placidus, Koch or Campanus houses, and about two in
whole signs, whose changes of house are found by halving (the longest
answered, by quarter days, from four start dates: 3 to 4.25 days and 1.75
to 2). Without an angular
condition every condition is searched over the whole window, so another
condition does not make room, and a month of void of course alone can pass
the allowance: of the 400 monthly windows in `tools/worst-case.ts`, March
2138 needs 6,327 evaluations and is refused.

An elections request is counted under both of the API's rate limits, as an
events request is, so it adds nothing to what one address can cost as long
as no elections request costs more than the costliest events request; in
each run that timed elections requests, none did.
`tools/cost-sweep.ts` asked each of seven shapes once in every fourth year
from 1800 to 2196, 100 requests each, through the real handler with its real
allowance, on one machine (`cost-sweep.txt`). A refused request is timed until
it was refused. The sweep's void-of-course months, every fourth year, do not
include March 2138.

| shape | refused | most evaluations in an answer | CPU, 95th percentile | CPU, most |
| --- | ---: | ---: | ---: | ---: |
| events, 92 days, every body and kind | 0 | 5,279 of 12,000 | 386 ms | 476 ms |
| the Moon void of course, 31 days | 0 | 5,551 | 186 ms | 211 ms |
| five conditions without houses, 31 days | 10 | 5,941 | 205 ms | 233 ms |
| five planets retrograde or direct, 31 days | 0 | 2,737 | 56 ms | 68 ms |
| the Moon angular, 4 days | 32 | 6,000 | 248 ms | 303 ms |
| not void of course and the Sun angular, 31 days | 100 | none answered | 158 ms | 180 ms |
| the Moon in a sign, waxing, and Mars angular, 31 days | 9 | 5,924 | 189 ms | 236 ms |

The slowest elections request in the sweep, the Moon angular over four days,
took 303 ms before it was refused for its allowance; the slowest events
request took 476 ms. `tools/worst-case.ts` ran every endpoint's costliest shapes, four of
these elections shapes among them, over every year from 1800 to 2199 on the
same machine within the hour, once with engine rc.15 installed and once with
rc.16 (`../compute-api-2026-10-05/`). The slowest elections requests took
343 ms on rc.15 and 384 ms on rc.16, and the slowest events requests 403 ms
and 539 ms. What one address can cost at both rate limits is still set by
events and positions requests. On rc.16 it is more than the 10 CPU-seconds
a minute the rules were set for, in each of three runs, which F-78 records.

## Faults planted in the search

After the evaluation, 28 faults were planted in a copy of the search and its
records, one at a time, each undone before the next, and the compute API's
tests were run against each (`tests/api/compute-api*.test.ts`,
`tests/api/runtime-imports.test.ts`). In the first round of 23, two exposed
gaps: `not` ignored on an angular condition passed every test, and a 32-day
window failed only the test of the deployed bundle, because the bundle had
not been rebuilt to match. Two tests were added, a negated angular condition
held to a scan every minute and a window of exactly 31 days answered and one
a second longer refused, and in a second round both faults failed them, the
second with its bundle rebuilt. A third round planted faults in the two
changes from the review.

| fault | the test that failed |
| --- | --- |
| the sextiles left out of void of course; Pluto left out | the void periods against the engine's `voidOfCourseWindows` |
| waxing and waning swapped at new and full moon; a sign's second boundary read the wrong way; retrograde at the start read as direct; `not` ignored | the sign, retrograde and phase conditions against a scan every 10 minutes |
| conditions joined instead of intersected | that test, the void periods, the house sampling and the examples |
| a void period from the sign change, not the last aspect | the void periods, the combination of conditions, the response and the examples |
| the 11th house counted as angular instead of the 10th | the house search against a scan every minute |
| the wrong cusp interpolated as a body moves back a house | the count of house samples, the response and the examples |
| `not` ignored on an angular condition only | the negated angular condition (added) |
| no refusal before the house search | the refusal before any house is sampled |
| a full calculation charged as one evaluation | the examples' committed receipt |
| a search's steps added without checking the allowance again | the station searches over the allowance (added), the private state |
| the reference-span flag reading the window only | the flag for the days a void condition reads (added) |
| elections counted under the general rate limit only | the rate-limit rules |
| no rewrite for `/api/v1/elections` | the routing of the seven endpoints |
| no 422 for elections in the OpenAPI document | the OpenAPI operations |
| the request written to the console | the privacy tests |
| a window of 32 days, the bundle rebuilt; a window of exactly 31 days refused | the window of exactly 31 days (added) |
| 61° allowed; six conditions; a repeated condition; a place without an angular condition | the malformed requests |
| the receipt calling the search proven | the response and the examples |
| the wrong cusp interpolated as a body moves forward a house | none: no request reaches that branch, since the sky turns every body back through the houses far faster than any body moves |

## Not done, and not claimed

- **Completeness is tested, not proven.** The crossing search samples every
  5 days, or every day for the Moon and for new and full moons, and can miss
  a pair of crossings that fall between two samples. The receipt says so.
- **The search reads the engine.** Its positions, houses and phases are the
  engine's, as accurate as the engine is; the evaluation does not check them.
- **The sweep is one machine's.** A request takes a different time on the
  host that serves the API; the slowest elections and events requests were
  compared on one machine, in one run of each tool on each engine and one
  earlier run on rc.16.
