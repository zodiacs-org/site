# Compute API, first version (2026-09-29)

Evidence for the hosted compute API: six POST endpoints under `/api/v1/` on
the vendored `@zodiacs/engine` 0.1.1-rc.14. `vercel.json` rewrites them to the
site's existing compatibility function, which hands each to
`api/_compute/handler.ts` before any route of its own. The site's twelve
functions are its Hobby plan's cap (`docs/GAMES-SITE-MAP.md`), which is why
the Games, the chart previews and the Registry news are served the same way,
and the decision is to run the API on the existing plan.

Decisions: `docs/platform/programme/DECISIONS-2026-09-28.md` §5 and the record
of 2026-09-29 §5. Documentation: `/developers/compute/`
(`src/pages/developers/compute/index.astro`); OpenAPI: the `compute` tag of
`/api/v1/openapi.json`.

## What is here

| File | What it is |
| --- | --- |
| `measurements.json` | Warm single-request cost of every endpoint, through the real handler with the bundled resolver the function deploys. `tools/measure.ts`. |
| `measurements-exploratory.json` | The same run before the budgets were set, with 366 instants allowed in a positions request. |
| `cold-start.json` | The packaged compatibility function (`vercel build`) imported in a fresh Node process per run, then asked twice. `tools/cold-start.mjs`. |
| `vercel-build-routes.json` | The route sources `vercel build` (CLI 61.0.0) compiled from this branch's `vercel.json`: every header rule, the six compute rewrites, and two header routes the platform adds. `tests/api/compute-api-vercel.test.ts` holds `scripts/lib/vercel-source-pattern.mjs` to it. |
| `mutation-check.txt` | The negative control catching a planted `console.log(body)`. |

All measurements ran on one machine: Node 22.22.2, tzdb 2025c, an Intel Xeon at
2.10 GHz with 4 cores. Vercel's hardware is different; the figures are for
choosing budgets, not a service level.

## Budgets

Every budget refuses a request with `422 budget-exhausted`, naming the limit and
its maximum, rather than letting it run until the platform stops the function.
The body size refuses with `413`. The compatibility function keeps the
platform's default duration limit; the slowest request the budgets allow took
0.64 s warm on this machine.

| Limit | Value | Measured worst case at the limit | Why this value |
| --- | --- | --- | --- |
| Body (`body.bytes`) | 16,384 bytes | The largest valid request, 100 instants with all twelve bodies named, is 3,335 bytes. | Four times the largest valid request; anything bigger cannot be a valid request. |
| `positions.instants` | 100 | 100 instants, all twelve bodies: p50 59.6 ms, max 91.3 ms, 213,174-byte answer. | With 366 instants the answer was 775,473 bytes and p50 226 ms (`measurements-exploratory.json`). 100 keeps the answer near 200 KB. |
| `events.windowDays` | 366 days | A 366-day window with every body and kind, in ten years from 1800 to 2198: p50 474–592 ms, max 644 ms, 19,841–20,053 evaluations, answers under 30 KB. | A calendar year, including a leap year, in one request. |
| `events.samples` | 40,000 | The same windows used at most 20,053. | Twice the worst measured request. It is a guard against growth (a smaller step, a denser body list in a later version), counted as the searches run: when it is spent the whole request is refused and no events are returned (`tests/api/compute-api-samples.test.ts`). |
| `sky-fact.samples` | 1,000 | The worst fact measured used 33 evaluations; every fact answered in at most 15 ms. | A fact searches at most a 50-hour window; 1,000 leaves room for any body and still refuses anything pathological. |

Everything else is small: a chart p50 2.3 ms (max 13.6 ms), houses 1.8 ms, a
local time 0.5 ms, one positions instant 1.0 ms.

Per address: at the proposed Firewall limit of 60 requests per 60 seconds
(`docs/OWNER-SETUP-RUNBOOK.md` §3), an address sending only the largest events
request would use about 60 × 0.64 s ≈ 40 function-seconds a minute on this
machine. Until the Firewall rule `zodiacs-compute-api` exists the SDK answers
`not-found` and the API fails open, as `api/calendar/transits.ts` does.

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
platform's own start is not included.

| Endpoint | Import | First request | Second request | Whole process |
| --- | --- | --- | --- | --- |
| chart | 44.8 (67.3) | 118.5 (167.8) | 4.5 | 226.6 (317.5) |
| positions | 42.8 (66.7) | 115.7 (154.1) | 3.8 | 226.8 (290) |
| houses | 44.8 (59.1) | 106.8 (131.8) | 4.5 | 217 (254.6) |
| events | 47.8 (60.2) | 214.2 (266.2) | 53.8 | 383.4 (538.7) |
| time | 46 (72.8) | 129.1 (180.8) | 1.4 | 235 (330) |
| sky-fact | 45.5 (62.3) | 159.6 (237.9) | 27.6 | 293.9 (411.5) |

The Firewall call is not in these figures: without an `x-real-ip` header the
SDK cannot form its key and the handler fails open before any network request.

## The function build includes the zone data

The site's resolver (`src/lib/time/localToUtc.ts`) loads its tables through
`src/lib/module-load.ts` and a template-literal `import()` of
`src/data/tz-history/2025c/NN.json`. Packaged by `vercel build` with the
resolver imported directly, the function failed at run time with
`ERR_MODULE_NOT_FOUND` for `../module-load`: the file tracer had not carried
those modules. `scripts/build-compute-local-time.mjs` bundles the same source with
esbuild into `api/_compute/local-time.mjs` (285,678 bytes) with `tz-lmt.json`
and all 64 history buckets inlined, and checks with the TypeScript AST that the
bundle makes no run-time import at all. `tests/api/compute-api-local-time.test.ts`
holds it to its source (rebuilt byte for byte), to every zone of the pinned
release, and to the calculator's own module on 12 zones × 14 dates × 5 times,
with and without a longitude. The packaged compatibility function above
carries the bundle byte for byte, and all six endpoints answered through it.

The build printed 39 TypeScript diagnostics, all in other modules the
functions import (email, i18n, invite, wallet and engine modules among them)
and none in the compute API's files; they do not stop a build.

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
successes and every refusal status (200, 204, 400, 405, 413, 415, 422, 429,
500, 503), on synthetic canary inputs, with the real Firewall SDK and its
network call stubbed: once through the handler, and once through
`api/compatibility.ts` as deployed, with every scenario but the failing
resolver, which cannot be planted there. It captures every console method,
stdout and stderr, anything thrown or left unhandled, every response header,
every error body and the Firewall request, and fails if any canary appears in
any of them, in every form it could take: as sent, as the resolver turns it
into an instant, and as the engine turns it into positions. Query-string
canaries must appear nowhere, success bodies included. Another test requires
silence from every console method when the rate limit is not consulted, and
another that no page, island or script of the site calls the API.
`mutation-check.txt` shows the three negative-control tests failing, with 94
and 88 leaks listed, when `console.log(body)` is planted after the body is
read.

## Events against the site's calendar

For 2026, with the Moon's ingresses left out, the events endpoint finds the same
stations, new and full moons and sign changes as `src/data/transits-2026-*.json`,
the same number of each, every one within 5 minutes of the published time
(`events find the stations, lunations and ingresses the site published for
2026, to within minutes`). That is agreement with the site's own published
data from the same engine, not a measurement of accuracy.

## What the API assumes about the engine

The calculations use only the package root of rc.14: `natalChart`,
`positions`, `moonPhase`, `searchLongitudeCrossings`,
`searchLongitudeCrossingsWith`, `deltaTAt`, `signForLongitude`,
`degreeInSign`, `outsideReferenceSpan`, `HOUSE_SYSTEMS`, `ENGINE_VERSION`,
`EPHEMERIS`, `REFERENCE_SPAN`, `DELTA_T_MODEL` and `DELTA_T_TABLE`. The chart
receipt comes from `createNatalEnvelope` in `@zodiacs/engine/receipt`, the
engine's own receipt writer, which the root does not export. Assumptions, each
pinned by a test in `tests/api/compute-api.test.ts`:

- `positions(date)` returns the twelve rows in a fixed order: the Sun to
  Pluto, then the two nodes.
- `deltaTAt((ms − Date.UTC(2000, 0, 1, 12)) / 86400000)` is the ΔT a chart at
  that instant records.
- A crossing search reports crossings in (from, to], bisected to the step
  divided by 2^24, and `searchLongitudeCrossingsWith` accepts any function of
  (body, date) in degrees: the station search passes a body's speed, the
  lunation search `moonPhase(date).angle`.
- The engine reads an instant as UT1 (`tt-minus-ut1;ut1-read-as-utc` in its
  receipt), so Terrestrial Time here is UTC plus ΔT.
- The coverage statement is not exported, so the compute receipt reads it, with
  the conventions, from a receipt the engine writes for a fixed instant.

rc.15 (unreleased) changes the time basis: from 1972 to 2027-10-02 it reads an
instant as UTC, with TT from the leap-second list and UT1 from IERS, where
rc.14 reads it as UT1 with the ΔT model; its changelog measures the angles
moving by up to 45″ in that span. When the site adopts it, `time.tt`, the ΔT
in every result and receipt, `cite.version` and `src/lib/compute-api/examples.json`
change with it, and its new receipt conventions set should be checked against
the compute receipt. Its `@zodiacs/engine/geo` entry also gains
`prepareLocalTime` and the pinned 2025c history, which could replace this
function's bundle of the site's resolver once the two are shown to agree.
