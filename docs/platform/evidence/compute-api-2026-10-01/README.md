# Stateless compute path: local cost recheck, 1 October 2026

This is a new local measurement after the server-only private-cache fix. It
preserves the old datasets under `compute-api-2026-09-29/`. It is not a
production measurement and does not close P3.3's deployed warm/cold or cost
gate.

`tools/worst-case.ts` sends synthetic requests through the actual production
adapter (`api/_compute/handler.ts`), its generated engine bundle with
post-request cleanup, and a new local-time resolver module for every request.
The real Firewall SDK runs with an in-process 204 network stub. No production
requests are sent. The JSON pins both generated bundle digests.

Run from the repository root:

```sh
npx vite-node --script docs/platform/evidence/compute-api-2026-10-01/tools/worst-case.ts
```

The process loads modules before the measurement; this is not a cold-start
sample. Engine timestamp/Pluto caches are cleared and resolver instances are
disposed for every request, including warmups. The tool records local process
CPU time (user + system) and wall time. Neither is a Vercel bill. Concurrent
runtime work such as garbage collection can make process CPU exceed wall
time; the host's other tasks affect elapsed time too.

Runtime: Node 24.19.0, tzdb 2026b; AMD EPYC 9V74 80-Core Processor, 9 logical
cores reported to this process. The old dataset used a different Intel Xeon
machine. The figures must not be treated as a before/after speed comparison.

The 3,200 measured requests all returned 200; two per-shape warmups are not
included in that count. The events samples are 1,600 maximum-window requests
across 1800–2199; positions has 400 maximum-count requests, one per year.
The chart and houses rows each rotate all thirteen house systems across 200
even years, rather than exercising every system in every year. Sky-fact has
400 dates with no specified zone, rotating the four fact kinds, so each asks
about the entire current UTC-offset range. Time has 400 local-date requests
with one fixed zone and longitude. This is an empirical sampling envelope,
not a proof of a universal upper bound across every input.

| Endpoint | Measured requests | CPU p50 ms | CPU p95 ms | CPU max ms |
| --- | ---: | ---: | ---: | ---: |
| events | 1600 | 125.3 | 186.3 | 274.3 |
| positions | 400 | 54.2 | 68.2 | 132.4 |
| chart | 200 | 7.7 | 10.4 | 35.1 |
| houses | 200 | 7.7 | 11.2 | 34.8 |
| sky-fact | 400 | 7.0 | 10.1 | 39.6 |
| time | 400 | 0.9 | 2.0 | 32.2 |

Conditional on the source-required 40/10 rules, ten events requests plus thirty positions requests
cost **6.7 CPU-seconds per minute** using the measured maxima, or 3.9 using
the measured p95s. This remains under the existing local 10-second criterion
for this sampled workload, without raising a budget or changing a Firewall
rule. Events used at most 5,302 evaluations; the largest positions response
was 231,584 bytes.

See `stateless-worst-case.json` and `stateless-worst-case.log`. The CPU maximum
and wall maximum can come from different requests; `slowestRequest` is the
wall-maximum request, following the earlier tool's convention.

The live general 40-request refusal was not reproduced (F-60). This local
arithmetic therefore does not establish a production spending bound.

## Packaged-function and repository checks

`local-validation.json` pins the changed bundle/source bytes and records passed,
failed and unavailable checks separately. The full repository suite passes on
its required Node 22: 6,352 tests passed, four skipped. Node 24 independently
failed three pre-existing composite timeout-cleanup tests; those failures remain
recorded rather than being hidden or weakened.

A local functions-only Vercel CLI 62.0.0 build packaged twelve functions.
The fixture used the repository routing configuration, empty local preview
environment, and blank site build/install commands; it fetched no remote
environment values. The CLI still performed a dependency reconciliation, whose
lockfile-only changes were discarded. Its existing TypeScript diagnostics are
retained in `vercel-functions-build.log`; the command completed successfully.
The packaged compatibility function is `nodejs22.x` with no configured env.

The original `compute-api-2026-09-29/tools/cold-start.mjs` ran with
`NODE_OPTIONS=--no-experimental-detect-module` against that packaged function:
60 fresh Node processes, ten per endpoint, each answering its synthetic example
twice, all 200. The Firewall network was stubbed locally. Results are in
`packaged-stateless-cold-start.json`. These timings exclude platform startup and
are not production cold-start evidence.

The Phase 1 source/build receipt is unchanged and its five-test evidence gate
passes. A retake attempt could not launch Chromium because this executor denies
its Unix socket, including the escalated attempt. No fresh captures are claimed
and no gate was relaxed; the existing committed captures remain valid for the
unchanged render-source hash.

Two verified pre-existing gate failures were corrected without changing the
claims: the assistant context was regenerated for October; the historical
rc.15 Chromium version is now bound to the dated rc.15 validation record rather
than the latest mutable screenshot manifest.

## Independent review: scope of the result

An independent review reran focused tests, generator drift checks, overlapping
completion observations and archive comparisons. Eleven tracked vendor archives
are byte-identical to baseline (`vendor-archive-check.json`). Its fresh-context
claim check did not assume exact floating-point parity:

- Two synthetic charts one millisecond apart expose the upstream nutation
  cache's roughly 86-ms reuse threshold. Clearing between sequential requests
  changes five low-order numerical fields, at most 1.6370904631912708e-9 arcsec;
  the new sequential result exactly matches a fresh isolated baseline module.
  Receipt and citation fields remain equal for this example.
- Overlapping invocations can still reuse that cache while both are in flight,
  before either completion cleanup, so complete bitwise history independence
  is not claimed. In the explicit completion observers, both invocations leave
  the timestamp cache null and Pluto-cache keys empty; the DeltaT callback is
  restored to its input-independent function.
- The upstream aggregate `CalcMoonCount` diagnostic remains mutable. It is an
  execution counter, not a retained date, position, zone or input-body record.
  The claim is cleanup of request-bearing caches, not erasure of every mutable
  bit or cryptographic erasure of JavaScript heap memory.

The two-chart results are preserved in `review-numerical-parity.json`, reproduced
by `node docs/platform/evidence/compute-api-2026-10-01/tools/review-numerical-parity.mjs`
from an installed full-history checkout. Source fix: `9d6d36ad`. No
numerical threshold was relaxed and no superiority or universal accuracy claim
is made from this review.
