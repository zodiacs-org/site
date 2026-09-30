# Compute API, first version (2026-09-29, reviewed 2026-09-30)

Evidence for the hosted compute API: six POST endpoints under `/api/v1/` on
the vendored `@zodiacs/engine`, 0.1.1-rc.14 when they were built and 0.1.1-rc.15
since the site adopted it on 2026-09-30 ("Engine rc.15" below). `vercel.json`
rewrites them to the
site's existing compatibility function, which hands each to
`api/_compute/handler.ts` before any route of its own, the way the Games, the
chart previews and the Registry news are served. `docs/GAMES-SITE-MAP.md`
gives the reason those routes share functions: the function count of Vercel's
Hobby plan. The record of 2026-09-29 §5 says the team is on Vercel Pro, so that
reason no longer holds for the API. The sharing is kept because it works and
adds no function (`tests/api/runtime-imports.test.ts` pins twelve); what it
costs is that a long calculation delays the other routes of the same instance
("Contention" below). A function of its own would remove that and change
nothing else here.

Decisions: `docs/platform/programme/DECISIONS-2026-09-28.md` §5,
`DECISIONS-2026-09-29.md` §5, and `DECISIONS-2026-09-30.md` §6 (the endpoints
fail closed without their rate limit) and §7 (what one address can cost).
Documentation: `/developers/compute/`
(`src/pages/developers/compute/index.astro`); OpenAPI: the `compute` tag of
`/api/v1/openapi.json`.

## The gate is still open

P3.3 is accepted when all six endpoints are deployed and its gate holds: the
negative-control test, receipts that name the backend, and latency and cost
recorded. The first two hold here. The third does not yet: it asks for the p50
and p95 latency, warm and cold, and the cost of 1,000 requests of each kind,
on the deployed endpoints. Everything below was measured on one machine
through the handler; none of it is a measurement of the deployment. The
deployed figures can be taken once the owner publishes the two Firewall rules
(`docs/OWNER-SETUP-RUNBOOK.md` §3) and the API is deployed. An endpoint answers
503 until every rule it is counted under exists: the events endpoint needs
both, the other five only `zodiacs-compute-api`. On 2026-09-30 the owner had
published `zodiacs-compute-api` at 60 requests a minute, from this branch's
first runbook; the runbook now has it at 40, with the events rule beside it.

## What is here

| File | What it is |
| --- | --- |
| `worst-case.json` | 2026-09-30, on rc.15. The costliest request each endpoint allows, in every year from 1800 to 2199, with wall and CPU time, and what one address can spend in a minute under the rules. `tools/worst-case.ts`. Of two runs on rc.15, the one with the higher maxima. |
| `worst-case-rc15-first-run.json` | The first of those two runs. |
| `worst-case-rc14.json` | 2026-09-30. The same sweep on rc.14, before the site took rc.15. |
| `engine-per-call.json` | 2026-09-30. The CPU cost of the engine calls the API makes, rc.14 against rc.15, the two alternating call by call in one process. `tools/engine-per-call.mjs`. |
| `contention.json` | 2026-09-30, on rc.15. How long a small request waits behind events requests in the same process. `tools/contention.ts`. `contention-rc14.json` is the same on rc.14. |
| `measurements.json` | 2026-09-29. Warm single-request cost of every endpoint, through the real handler with the bundled resolver the function deploys. `tools/measure.ts` as it was then, with 366-day events windows; the tool now takes the window limit. |
| `measurements-exploratory.json` | The same run before the budgets were set, with 366 instants allowed in a positions request. |
| `cold-start.json` | 2026-09-29. The packaged compatibility function (`vercel build`) imported in a fresh Node process per run, then asked twice. `tools/cold-start.mjs`. |
| `vercel-build-routes.json` | The route sources `vercel build` (CLI 61.0.0) compiled from this branch's `vercel.json`: every header rule, the six compute rewrites, and two header routes the platform adds. `tests/api/compute-api-vercel.test.ts` holds `scripts/lib/vercel-source-pattern.mjs` to it. |
| `mutation-check.txt` | The negative control catching each leak planted in the handler: the reviewer's mutations of 2026-09-30 and the first plant of 2026-09-29. |

All measurements ran on one machine: Node 22.22.2, tzdb 2025c, an Intel Xeon at
2.10 GHz with 4 cores, which other work shared on 2026-09-30 (a load average
of between 3 and 7 while the sweeps ran). Vercel's hardware is different; the
figures are for choosing budgets and rules, not a service level. On this
machine the slowest request of a sweep varies by about a tenth from one run to
the next: the two runs on rc.15 put the slowest events request at 332.5 and
359.2 ms.

## Budgets

Every budget refuses a request with `422 budget-exhausted`, naming the limit and
its maximum, rather than letting it run until the platform stops the function.
The body size refuses with `413`. The compatibility function keeps the
platform's default duration limit.

| Limit | Value | Measured worst case at the limit | Why this value |
| --- | --- | --- | --- |
| Body (`body.bytes`) | 16,384 bytes | The largest valid request, 100 instants with all twelve bodies named, is 3,335 bytes. | Four times the largest valid request; anything bigger cannot be a valid request. |
| `positions.instants` | 100 | 100 instants, all twelve bodies, one request in every year: CPU p50 66.0 ms, p95 93.5 ms, max 170.1 ms; answers up to 231,584 bytes. | With 366 instants the answer was 775,473 bytes and p50 226 ms (`measurements-exploratory.json`). 100 keeps the answer near 230 KB. |
| `events.windowDays` | 92 days | A 92-day window with every body and kind, four windows tiling every year from 1800 to 2199 (1,600 requests): CPU p50 165.7 ms, p95 244.0 ms, max 359.2 ms; wall max 370.1 ms; at most 5,302 evaluations and 9,788 bytes. | A quarter of a year: a year of events is four requests. Until 2026-09-30 the limit was 366 days; the review measured those windows over all 399 years at p50 669 ms, p95 890 ms and at most 1,170 ms, so an address at 60 requests a minute could cost 33 to 50 CPU-seconds a minute. |
| `events.samples` | 12,000 | The windows above used at most 5,302. | About twice the worst measured request. It is a guard against growth (a smaller step, a denser body list in a later version), counted as the searches run: when it is spent the whole request is refused and no events are returned (`tests/api/compute-api-samples.test.ts`). |
| `sky-fact.samples` | 1,000 | A fact of each kind on a date in every zone, one a year: CPU max 16.2 ms, at most 33 evaluations. | A fact searches at most a 50-hour window; 1,000 leaves room for any body and still refuses anything pathological. |

Everything else is small (CPU, one request a year or every other year): a
chart in each of the thirteen house systems at most 15.0 ms, a
local time with a longitude at most 4.6 ms. The figures are rc.15's, from
`worst-case.json`; on rc.14 (`worst-case-rc14.json`) the events window took
p50 170.6 ms, p95 247.3 ms and at most 377.3 ms, and positions at most
157.6 ms.

## Rate limits: the endpoints fail closed, and the worst case per address

Two Firewall rules count requests per client address, each over 60 seconds:
`zodiacs-compute-api` counts every compute request, and
`zodiacs-compute-events` counts events requests again, so an events request is
counted under both. The runbook's rules allow 40 and 10 requests a minute
(`RATE_LIMIT_RULES` in `src/lib/compute-api/constants.ts`).

The endpoints fail closed. A request is computed only when the Firewall
counted it under every rule it falls under and let it through. When a rule is
not published (the SDK reports `not-found`), when the check errors or answers
anything else, and outside `NODE_ENV=production`, where the SDK lets every
request through without asking the Firewall, the endpoint answers
`503 rate-limit-unavailable` with `Retry-After: 300`, before reading the body.
So the API answers only while its rate limit is in place: an endpoint answers
nothing until every rule it is counted under exists. The site's other endpoints with a
Firewall rule still let requests through while their rule is missing.
`tests/api/compute-api.test.ts` checks both states and that nothing is read
or computed.

What one address can cost in a minute under the rules, at the slowest request
of each kind measured on rc.15, is 10 events requests at 359.2 ms and 30
more at the slowest other request (positions at the instant limit, 170.1 ms):

    10 × 0.359 s + 30 × 0.170 s = 8.7 CPU-seconds a minute

At the 95th percentiles instead, 5.2 CPU-seconds; in wall time at the
maxima, on this shared machine, 10.3 seconds, the rest being time the machine
spent on other work. The limit the review set is 10 CPU-seconds a minute, and
`worst-case.json` records the arithmetic beside the measurements. The first
run on rc.15 gave 8.0 CPU-seconds (events at most 332.5 ms, positions
156.6 ms), and rc.14 8.5 (377.3 ms and 157.6 ms). The slowest requests could
grow by 15% before one address reached 10 CPU-seconds a minute.

The same arithmetic rules out the alternatives: with the first rule at 60 a
minute, as first proposed and as the owner first published it, 10 events
requests and 50 others come to 10 × 0.359 s + 50 × 0.170 s = 12.1
CPU-seconds, over the limit, because positions requests at the instant limit
dominate; with the 92-day window and no events rule, 40 events requests would
be 14.4. The second rule keeps the events share down without holding the
cheap endpoints to the events rate.

## Contention

The compatibility function also serves the Games, the chart previews, the
Registry news and the invite routes. When one instance serves several requests
at once, as Vercel's Fluid compute does, they share one Node process, and a
calculation holds that process's only thread until it finishes, so a request
that reaches the same instance meanwhile waits for it. `tools/contention.ts` starts n events
requests at the window limit together with one local-time request, in one
process, and times the small one (median of seven trials, `contention.json`):

| Events requests alongside | Small request answered after, rc.15 | rc.14 |
| --- | --- | --- |
| 0 | 0.9 ms | 1.4 ms |
| 1 | 322 ms (at most 473) | 287 ms (at most 312) |
| 4 | 884 ms (at most 1,199) | 1,017 ms (at most 1,199) |
| 10 | 2,348 ms (at most 2,565) | 1,937 ms (at most 2,414) |

So each events request in flight on an instance adds about 0.2 to 0.3 s to
every other request that instance is serving, the Games and the previews
included. An address at its events limit keeps that up for at most about
3.6 seconds a minute. A function of the API's own, with its own
instances, would keep this from the site's other routes.

## Cold start

A functions-only `vercel build` of this branch (the install and the site build
switched off in a local copy of `vercel.json`) packaged twelve functions, the
same number as `main`. The compatibility function is 154 files, 4.63 MB, and
carries `api/_compute/handler.js`, the seven transpiled `src/lib/compute-api`
modules, `api/_compute/local-time.mjs` byte for byte, and `@zodiacs/engine`,
`astronomy-engine` and `@vercel/firewall` beside its own dependencies.

`tools/cold-start.mjs` starts a fresh Node process for each run, imports that
package's `api/compatibility.js`, then sends the endpoint's documented example
through it twice. The compute modules load on the first compute request, so
the first request includes them. Ten runs each; milliseconds, p50 (max). The
platform's own start is not included. Measured on 2026-09-29, before the
bundle's tables became JSON strings (below).

| Endpoint | Import | First request | Second request | Whole process |
| --- | --- | --- | --- | --- |
| chart | 44.8 (67.3) | 118.5 (167.8) | 4.5 | 226.6 (317.5) |
| positions | 42.8 (66.7) | 115.7 (154.1) | 3.8 | 226.8 (290) |
| houses | 44.8 (59.1) | 106.8 (131.8) | 4.5 | 217 (254.6) |
| events | 47.8 (60.2) | 214.2 (266.2) | 53.8 | 383.4 (538.7) |
| time | 46 (72.8) | 129.1 (180.8) | 1.4 | 235 (330) |
| sky-fact | 45.5 (62.3) | 159.6 (237.9) | 27.6 | 293.9 (411.5) |

The Firewall call is not in these figures: on 2026-09-29 the handler let a
request without an `x-real-ip` header through before any network request.
Since the endpoints fail closed, the tool now sends a client address and
stubs the Firewall's answer, so a new run includes the SDK's own work but no
network.

## The function build includes the zone data

The site's resolver (`src/lib/time/localToUtc.ts`) loads its tables through
`src/lib/module-load.ts` and a template-literal `import()` of
`src/data/tz-history/2025c/NN.json`. Packaged by `vercel build` with the
resolver imported directly, the function failed at run time with
`ERR_MODULE_NOT_FOUND` for `../module-load`: the file tracer had not carried
those modules. `scripts/build-compute-local-time.mjs` bundles the same source
with esbuild into `api/_compute/local-time.mjs` (271,265 bytes) with
`tz-lmt.json`, all 64 history buckets and the pinned release's list of left-out
zones inlined, and checks with the TypeScript AST that the bundle makes no
run-time import at all. `tests/api/compute-api-local-time.test.ts` holds it to
its source (rebuilt byte for byte), to every zone of the pinned release, to
the source's spelling of every zone name in three letter cases, and to the
calculator's own module on 12 zones × 14 dates × 5 times, with and without a
longitude. The packaged compatibility function above carries the bundle byte
for byte, and all six endpoints answered through it.

Since 2026-09-30 each table is inlined as one JSON string that is parsed when
it is first imported, rather than as an object literal. With the tables as
literals the bundle was 49,732 syntax nodes; with them as strings it is about
8,700, and TypeScript parses it in about a quarter of the time. That was the
branch's cost to `src/lib/profile/saved-record-inactive.test.ts`, whose
import-graph test parses every source file under `src/` and `api/` with the
TypeScript compiler: with the tables as literals the bundle took 80 to 100 ms
of its parsing, cold, and with them as strings about 25 ms. Warm, the whole
walk takes 670 ms over this branch, 744 ms with the old bundle put back, and
720 ms over main as it was before the branch. The rest of the slowdown the
review saw was the load on this shared machine: the same test, run alone
here, varies by more than a second from one run to the next.

The build printed 39 TypeScript diagnostics, all in other modules the
functions import (email, i18n, invite, wallet and engine modules among them)
and none in the compute API's files; they do not stop a build.

## Zone names in any letter case

Intl reads a zone name in any letter case, and until 2026-09-30 so did the
API, but the resolver's local mean time table was read case-sensitively: for
a birth in Buffalo at noon on 15 June 1870, `America/New_York` gave 17:15:31
UTC on the birthplace's mean time and `america/new_york` 16:56:02 UTC on New
York's. Every spelling also added two formatters to the resolver's caches,
which were never emptied.

Now `src/lib/time/zone-names.ts` maps a name in any letter case to its tzdb
spelling, from the runtime's Intl list, the local mean time table and the
pinned release (no two of those names differ only in case). The API refuses a
name none of them has, even where Intl would take it (`US/Pacific-New`,
`SystemV/AST4`), and answers with the tzdb spelling wherever it repeats the
zone. The resolver reads its tables the same way whatever the case. Its
formatter caches now hold at most 1,024 formatters each, whatever names a
caller sends, and the API passes it only a name's tzdb spelling, so 5,000
spellings of one zone sent to the API add no formatter
(`tests/api/compute-api.test.ts`). The caches stay keyed by the name as given:
a first version of this change keyed them by the lower-cased name as well,
and put the `/big-three/` page over its 30 KB script budget, which the
resolver shares. `src/lib/time/zone-case.test.ts` checks
Buffalo in 1870, Paris in 1880, all 518 zones with a local mean time era in
lower and upper case, and the bound.

## The cache header on `/api/v1/`

Before this change `vercel.json` gave everything under `/api/v1/` its static
files' headers with the source `/api/v1/(.*)`, which `vercel build` compiles to
`^/api/v1(?:/(.*))$`. That matches every compute path, so its
`Cache-Control: public, max-age=86400, must-revalidate` would have reached the
compute answers, including a 405 answering a GET with birth data in its query.
The source is now `/api/v1/:file(.*\.[^/]+)`, compiled to
`^/api/v1(?:/(.*\.[^/]+))$`: every static file under `/api/v1/` ends in a file
name with an extension, and no compute path does. The test checks, over
`vercel.json` with a port of the path-to-regexp version Vercel uses, that
every compute path (with and without a trailing slash, and the function's own
path) matches only the site-wide security rule, gets no cache lifetime and no
CORS header from `vercel.json`, that the static files still get their rule,
that the old source did match the compute paths, and that no redirect catches
them. The function sets `Cache-Control: no-store` on every answer itself.

## Privacy: the negative control

`tests/api/compute-api-privacy.test.ts` runs every endpoint, through its
successes and every refusal status (200, 204, 400, 404, 405, 413, 415, 422,
429, 500, 503), on synthetic canary inputs, with the real Firewall SDK and its
network call stubbed: once through the handler, and once through
`api/compatibility.ts` as deployed, with every scenario but the failing
resolver, which cannot be planted there, and the request without an endpoint
name, which is one of that function's own routes. It collects every console
method, stdout and stderr, anything thrown or left unhandled, every call that
writes or changes a file, the names on `globalThis` and in `process.env`
before any request and after, the reason phrase, every response header, every
error body and the Firewall request. It fails if a canary appears in any of
them, in the forms a leak is likeliest to take: as sent, as the resolver turns
it into an instant, and as the engine turns it into positions; if the headers
are not exactly the fixed set for the status; if any field of an error (code,
message, pointer, limit, maximum, retry interval) is not from the fixed
catalogs; if the handler sets a reason phrase of its own; if anything is
written to a file; or if a global name or an environment variable appears.
Query-string canaries must appear nowhere, success bodies included. Another
test requires silence from every console method and no file writes when the
rate limit is not consulted, another plants one leak of each kind and checks
that each is caught, and another that no page, island or script of the site
calls the API.

`mutation-check.txt` records the review's 20 mutations of 2026-09-30, each
planted in the handler, validator or endpoints and run against this test file
alone: every one fails at least one of its tests, including the five the first
version of the test missed (an error repeating the refused longitude, a header
carrying the latitude to one decimal, a reason phrase carrying the zone, the
body written to a file, and the body kept in a global). Four of them log a
value in a form the canary scan does not list (the window's end, coordinates
to two decimals, a Julian day, the events found); the test that requires
silence fails under each of those.

## Events against the site's calendar

For 2026, with the Moon's ingresses left out and the year asked for in four
quarters, the events endpoint finds the same stations, new and full moons and
sign changes as `src/data/transits-2026-*.json`, the same number of each,
every one within 5 minutes of the published time (`events find the stations,
lunations and ingresses the site published for 2026, to within minutes`). That
is agreement with the site's own published data from the same engine, not a
measurement of accuracy.

## What the API assumes about the engine

The calculations use the package root of rc.15: `natalChart`, `positions`,
`moonPhase`, `searchLongitudeCrossings`, `searchLongitudeCrossingsWith`,
`signForLongitude`, `degreeInSign`, `outsideReferenceSpan`, `HOUSE_SYSTEMS`,
`ENGINE_VERSION`, `EPHEMERIS`, `REFERENCE_SPAN`, `DELTA_T_MODEL` and
`DELTA_T_TABLE`; and the engine's own time basis, which the package applies
inside its ephemeris without exporting it. `src/lib/engine/time-basis.mjs`
carries that, bundled unchanged from the package by
`scripts/build-time-basis.mjs`, which checks it against `natalChart` first;
the calendar function's server adapter reads it the same way. The chart
receipt comes from `createNatalEnvelope` in `@zodiacs/engine/receipt`, the
engine's own receipt writer, which the root does not export. Assumptions, each
pinned by a test in `tests/api/compute-api.test.ts`:

- `positions(date)` returns the twelve rows in a fixed order: the Sun to
  Pluto, then the two nodes.
- The time basis of an instant gives the ΔT and the `timeScale` record a chart
  at that instant has, and its Terrestrial Time.
- A crossing search reports crossings in (from, to], bisected to the step
  divided by 2^24, and `searchLongitudeCrossingsWith` accepts any function of
  (body, date) in degrees: the station search passes a body's speed, the
  lunation search `moonPhase(date).angle`.
- The engine reads an instant on its time basis (its receipt conventions
  `tt-from-leap-seconds-and-ut1-from-iers-1972-to-table-end;delta-t-model-otherwise;in-result`):
  from 1972 to 2027-10-02 as UTC, with TT = UTC + (TAI − UTC) + 32.184 s and
  UT1 = UTC + (UT1 − UTC) from IERS; otherwise as UT1, with TT = UT1 + ΔT from
  its model. Terrestrial Time here is TT as a chart at the instant has it.
- The coverage statement and the IERS table's name are not exported, so the
  compute receipt reads them, with the conventions, from a chart and a receipt
  the engine writes for 2000-01-01T12:00Z, an instant it reads on IERS.

## Engine rc.15

The site adopted rc.15 on 2026-09-30 (#603), and this branch took it with
main the same day. What changed for the API:

- Time. rc.14 read every instant as UT1 with its ΔT model, and the time,
  positions and sky-fact results took ΔT from `deltaTAt`, the model alone.
  They now take ΔT from the engine's time basis, with its `timeScale` record,
  so they give what a chart at the same instant has; chart and houses results
  carry the chart's `timeScale` too. `time.tt` is TT on that basis: from 1972,
  UTC plus the leap seconds and 32.184 s. The compute receipt names both
  sources of ΔT, IERS (`iers-utc/1`, with its UT1 table) and the model
  (`zodiacs-deltat/1`, with its table), where it named the model alone. The
  OpenAPI document gains a `TimeScale` schema for the record.
- Local mean time. main's resolver now flags `lmt` only where the birthplace's
  own mean time read the time, which needs a longitude, as rc.15 defines the
  flag; a local time given without one is no longer flagged. Its new check for
  a zone's local mean time era reads the table in any letter case, as the rest
  of the resolver does (`src/lib/time/zone-case.test.ts`, whose Buffalo, Paris
  and 518-zone tests failed on the merge until it did).
- The examples and their `cite` digests were generated again on Node 24.21.0
  with rc.15, and the local-time bundle was built again from the merged
  resolver.
- Cost. rc.15 was expected to cost about a fifth more per call. On this
  machine it did not: the calls the API makes cost between 2% and 7% more
  (`engine-per-call.json`: `positions` 1.070 times rc.14's CPU time,
  `natalChart` 1.041, a 92-day crossing search 1.022; an earlier run of the
  same comparison gave 0.991, 1.073 and 0.956). The sweep over every year
  was run twice on rc.15: its slowest events request took 332.5 ms and
  359.2 ms of CPU against rc.14's 377.3, within the spread between runs; the
  events window's median moved by less than 3%, and the positions request's
  fell. Under the rules of 40 and 10 requests a
  minute one address can cost at most 8.7 CPU-seconds a minute, under the
  limit of 10, so the rules, the window and the instant limit stay as they
  were (`DECISIONS-2026-09-30.md` §7).

## The documented examples and the runtime's tzdb

`src/lib/compute-api/examples.json` holds the handler's own answers to the
documented requests. A time or local chart receipt names the runtime's tzdb
release, so its `cite.receipt` digest depends on the Node the handler ran on.
Production runs Node 24.x, and the committed examples were generated on Node
24.21.0 (tzdb 2026c), so their digests are the ones production gives.
`tests/api/compute-api-openapi.test.ts` compares everything else on any
runtime, and the whole file byte for byte on a runtime with the same tzdb.

## The OpenAPI document

Each compute path has a POST operation and an OPTIONS operation for the CORS
preflight. The POST documents every status the handler answers with,
including 404 (the function reached by a path that is not one of the six) and
the headers a client acts on: `Allow` with a 405 and `Retry-After` with a 429
or a 503. The licence names its SPDX identifier alone, as OpenAPI 3.1 asks.
The whole document validated against the OpenAPI 3.1 schema when checked on
2026-09-30 with `@seriousme/openapi-schema-validator` 2.11.0, installed
outside the repository (it carries the OpenAPI Initiative's schema of
2026-08-03). After the move to rc.15 the document, with its new `TimeScale`
schema, validated again against that schema of 2026-08-03 with the site's own
Ajv, its `$dynamicRef` to the Schema Object read as a plain reference, as that
validator reads it. No OpenAPI validator is among the site's dependencies, so no test
repeats that check. Ajv is a dependency, but a test would also need the
OpenAPI Initiative's schema (Apache-2.0) copied into the repository: a new
third-party dependency in all but name, which the review asked not to add
just for this.
`tests/api/compute-api-openapi.test.ts` validates every example against its
schema with Ajv.
