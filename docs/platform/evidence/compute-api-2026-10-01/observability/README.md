# Production observability supplement — 1 October 2026

The authenticated read-only dashboard recovered measurements unavailable through
our earlier connector. Historical connector/export files remain unchanged; this
supplement records the additional evidence and supersedes only their stated lack
of start-type and aggregate CPU/memory observations.

## Warm measurements

The exact 120 documented synthetic requests from the original production baseline
match the runtime export uniquely by the final segment of `x-vercel-id`. A closed
06:05–06:10 UTC population reconciliation matches those same 120 IDs to Query's
six paths ×20 invocations, all labelled **Hot**. Warm classification is observed,
not inferred from an instance ID, sequence position or slow network response.
The measured deployment is `dpl_6uGzGxdgxboMZ5jeFwQMTL24demr`, source
`9cfafa3e742de943062c9174338472781724a4b5`, execution region iad1.

| Endpoint under /api/v1/ | Hot n | Execution p50/p95 ms | Approx. gross compute + invocations USD / 1,000 |
| --- | ---: | ---: | ---: |
| chart | 20 | 22 / 44 | 0.00118 |
| positions | 20 | 25 / 49 | 0.00120 |
| houses | 20 | 38 / 72 | 0.00131 |
| events | 20 | 116 / 168 | 0.00445 |
| time | 20 | 26 / 45 | 0.00114 |
| sky-fact | 20 | 47 / 76 | 0.00242 |

These are small repeated-input samples, not general workload guarantees. The
original 6,220.7 ms client chart outlier is retained: its exact platform match
executed in 42 ms. Client round-trip latency is not function CPU or a cold flag.

Cost uses rounded **measured aggregate** Query CPU and Duration (Gb-hrs), normalized
from 20 to 1,000 requests, at published iad1 Fluid rates. Pro/Fluid was observed in
the dashboard. This is a nominal gross compute subtotal, **not an invoice or the
whole request bill**: Firewall, network/transfer, routing, observability, base fees,
tax and plan credits are excluded. The Query memory metric is not an invoice field.
No unknown formatter policy is used to invent a guaranteed rounding interval.
See `vercel-hot-cost-supplement.{json,md}` for inputs, formula, components and limits.

## Cold and rate-limit gaps

The baseline contains no Cold invocation. A separate retained-window query from
06:00–10:40 UTC found 227 API invocations, all Hot. Its project/path scope lacks a
deployment filter and is recorded separately in `expanded-start-types.json`.
Cold p50/p95 and cold cost remain unknown; no redeployment or extra probe was used
to manufacture a cold sample.

The active general rule was read in the dashboard as 40 requests/60 seconds,
fixed-window/IP/429, with no system bypass rule. The earlier bounded 41-request
probe still returned 41 successes in 5.938 seconds, within one UTC minute. Its
export exposes no incoming IP/counting key or counter/window state.

A subsequent CDN aggregate shows one source IP for those 41 API requests, and the
same-window SDK path shows 41 HTTP 204/allow responses, all in iad1 and the same
deployment. This weakens client-IP rotation, missing SDK calls and observed CDN
region splitting as explanations. The production source awaits each decision;
a synthetic offline replay confirms its fail-closed behavior and stable keys.

Neither those aggregates nor an empty rule-filtered view expose the effective
SDK key or counter/window association. Fixed-window boundaries beyond UTC-minute
alignment are not established. No undocumented one-request tolerance or specific
platform defect is assumed. F60 remains unresolved. See the successive
`f60-counting-identity-diagnosis` and `f60-cdn-identity-supplement` records, which
preserve what was known at each stage without publishing raw addresses.

## Privacy, reproduction and remaining release gate

Only the explicit synthetic allow-list was projected into these public records.
Unrelated requests, raw log messages, incoming headers, addresses and private
export contents are excluded. Matched message fields were empty; this is bounded
log evidence, not proof about every telemetry/storage layer.

Run `python verify-public.py` to recompute all public statistics and cost arithmetic.
The original three `analyze-*.py` scripts show the private-source reconciliation.
They require authorized access to the original export/DOM captures and the stated
baseline files; copy the scripts to a **private scratch directory** to reproduce
that phase. Never put private exports or dashboard authentication data in this
repository. Source hashes and nonsecret query URLs are retained in the outputs.

**P3.3 remains unaccepted.** The stateless-cache fix has not yet been released;
required CI is blocked by preserved owner-managed frontend failures. Cold evidence,
the unresolved general429 check, and post-fix deployment verification also remain
open. The existing denominator and gate are unchanged. No request, security setting,
plan upgrade, token or new access grant was created for this supplement.
