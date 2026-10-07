# Production compute baseline, 1 October 2026

Source `9cfafa3e742de943062c9174338472781724a4b5`, production deployment
`dpl_6uGzGxdgxboMZ5jeFwQMTL24demr`, READY and aliased to `zodiacs.org`.
This includes the F-58 fix, merged in #607. Every endpoint answers successfully.
This is a **partial gate record**, not acceptance of P3.3.

## Measurement

`../tools/measure-production-20261001.mjs` is the exact probe run from the
checkout's parent directory with Node 24.19.0. It writes into
`measurements/production-2026-10-01/`; it sends 120 requests to production.
`plan.json` was written before the first sample. The inputs are the documented
synthetic examples, not anyone's birth data. Each endpoint was measured twenty
times, sequentially, with endpoint order rotated between rounds and
a 2.2-second pacing target between request starts. The timers reached approximately 2.2 seconds (minimum inferred spacing
2198.4 ms); this is not a hard lower-bound claim. Neither client address nor domain was
changed to evade a rate limit. All 120 responses were 200.

The plan intended an in-loop backend-mismatch stop, but the exact probe only
checks HTTP status, schema and a truthy receipt. The backend identities were
verified afterward over all recorded receipts and first response bodies.
This discrepancy is preserved rather than silently changing the plan.

Client end-to-end wall milliseconds, including response-body transfer;
nearest-rank percentiles (`ceil(n * q) - 1`). Values rounded to one decimal:

| Endpoint | n | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: |
| chart | 20 | 93.6 | 129.5 | 6220.7 |
| positions | 20 | 89.6 | 147.9 | 167.2 |
| houses | 20 | 106.2 | 161.3 | 180.6 |
| events | 20 | 182.2 | 238.0 | 302.4 |
| time | 20 | 90.1 | 116.9 | 137.9 |
| sky-fact | 20 | 118.0 | 140.4 | 173.3 |

All samples, including the 6.2-second first chart request, are kept. The first
request is **not classified as cold**. Client setup/egress, network, runtime
and response transfer are included; there is no evidence separating them.
The p95 here is the nineteenth of twenty observations, not a service-level
bound. Results apply only to these documented shapes, not worst-case budgets.
HTTP Date spans 06:05:07–06:09:27 UTC (read the raw headers for exact times).
Raw `clientAt` agrees with the server HTTP Date to within one second.
Durations use a monotonic clock; HTTP Date and connector timestamps bind
the observation window.

`requests.jsonl` preserves status, headers, receipt, response byte counts and SHA-256
for every sample. The six endpoint JSON files are their first complete
responses. Every receipt names `@zodiacs/engine` 0.1.1-rc.15 and
`astronomy-engine` 2.1.19; the first complete response of every endpoint names
the same top-level backend. Every response has `Cache-Control: no-store`.
The deployed time receipt says runtime tzdb **2026a**; the older statement
that production uses 2026c must not be relied on without fresh evidence.

## What is verified, and what is not

- F-58's deployment failure is no longer reproduced: all six endpoints work.
- The connector's minute-sized log reads correlate all 120 samples by path,
  status and server time within one second, plus two preceding smoke checks.
  No visible application-output line or one of thirteen distinctive synthetic
  input values was found in those returned rows. See
  `log-privacy-correlation.json`. This is bounded observation, not proof that
  every platform layer retains nothing, and not a runtime-request-ID join.
- Warm/cold start type, active CPU, billable memory, and execution duration are
  not exposed by the available connector. The existing cloud browser session
  reaches the Vercel login page. No login, token, access or billing change was
  made. `TELEMETRY.md` records the exact limit and official existing-dashboard
  routes; do not activate paid Observability Plus just to recover metrics.
- `pricing-metadata.json` records public rates and a conditional formula,
  explicitly leaving all six measured per-thousand costs null. Billing mode
  and live credit balance are unverified. Network elapsed is not billed CPU,
  and plan credit is not evidence of zero underlying usage cost.
- An independent source audit reproduced exact synthetic chart-time retention
  in the bundled ephemeris's private warm-process cache, which existing
  global-name checks miss. The local probe demonstrates in-memory retention; it did not instrument
  every output channel. Log observations remain limited to the returned
  production rows. The cache issue is being fixed separately; the
  no-retention gate is open.

P3.3 remains unaccepted. This baseline must not be relabeled as post-fix
measurement after the function changes. The fixed denominator is unchanged:
`node scripts/programme-ledger.mjs --summary` at the source above reports
`Overall delivery: 23% (42.5 of 182.45); blocked 2% (4)`.

`bundle-verification.json` records both supplied bundle digests, byte counts,
verification and fetched heads, all matching the owner's `BUNDLES.md`.

## Replaying the historical probes

The archived production script has a fixed output directory, appends request
rows, and labels the measured deployment explicitly. Do not run it over an
existing evidence directory or assume the domain still serves that revision.
For a future measurement, use a fresh output path and re-resolve the live
deployment before recording its plan. The script is preserved exactly as run.

The local retention reproducer is
`../tools/probe-module-retention-20261001.mjs`. It reads the two bundles and
time-basis from Git at the measured revision, instruments copies in a fresh
temporary directory, and prints the reproduction as JSON. Its `networkCalls: 0`
field describes the intended stubbed setup, not an instrumented network count.
Run it from an installed full-history checkout; it sends no production probe.

## Live rate-limit checks

The complete plans and per-request results are `rate-*.json` / `rate-*.jsonl`.
Each probe stopped at its stated cap or first rejection. No client address,
header or domain was changed to bypass a limit; there was no concurrency.

1. Eleven empty-body events requests returned 400, taking several seconds
   apiece and crossing minute boundaries. This was **inconclusive**, and the
   raw attempt is preserved. No astronomical work was performed.
2. After a clean interval, the minimum-workload events shape (one day, Sun
   ingress only) returned ten 200s followed by a 429 with `Retry-After: 60`.
   All eleven responses were within one server minute. **Events refusal PASS**.
3. After another clean interval, forty-one minimal UTC local-time requests
   returned 200; the first response fell precisely on a minute boundary.
   Counter-at-entry might have preceded response time, so this attempt was
   initially **inconclusive** rather than a configuration verdict.
4. A fresh, fixed-cap general-counter probe was scheduled ten seconds into
   a new minute after more than 65 seconds idle. Its first execution became
   unavailable before any request record; no result is claimed for it. The
   fresh bounded retry completed forty-one 200s in one server-minute window.
   The expected 41st-request refusal was **not observed**. General-threshold
   verification is **FAIL**, not a claim that the exact live threshold or
   client-address stability is known. There are no further automated probes.

The available response/log metadata does not expose the Firewall's effective
client address or rule configuration. A differing rule threshold, counting
behavior, or egress identity cannot be distinguished here. Do not infer a
cause or assert that production is bounded at forty from this record.
The local 40/10 cost arithmetic is conditional on those rules, and does not
establish a live spending bound. This gap is F-60.
