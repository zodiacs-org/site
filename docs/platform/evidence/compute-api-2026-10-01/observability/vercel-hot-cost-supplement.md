# Hot-path latency and compute-cost supplement

## What the new evidence establishes

The saved project Query covers 2026-10-01 06:05:00–06:10:00 UTC. Its Count Sum table, grouped by Request Path and Function Start Type, has exactly six rows: 20 invocations per endpoint, all labelled `hot`, and no further table page.

The private export contains exactly 120 records in that interval. Their request-ID set equals the 120-request baseline exactly, with all records on production deployment `dpl_6uGzGxdgxboMZ5jeFwQMTL24demr`, source `9cfafa3e742de943062c9174338472781724a4b5`. Thus the aggregate start-type population is reconciled to the exact baseline rather than inferred from request order or instance reuse.

The Query URLs are project-scoped with no explicit environment/deployment filter. The separate exact export reconciliation is what establishes that this complete observed window is the desired production baseline. CPU and memory queries use the same window and project, Sum aggregation, and Request Path grouping.

## Measured inputs and usage-cost estimates

Each row below has 20 platform-labelled Hot requests. CPU and memory-duration totals are the rounded strings actually displayed by Query. Execution p50/p95 come from the exact-matched per-request export, using nearest-rank percentiles.

| Endpoint | Hot execution p50 / p95 ms | CPU sum, 20 requests | Duration GB-hrs sum, 20 requests | Approximate compute + invocation USD per 1,000 |
|---|---:|---:|---:|---:|
| chart | 22 / 44 | 230 ms | 0.00032 | $0.00118 |
| positions | 25 / 49 | 240 ms | 0.00032 | $0.00120 |
| houses | 38 / 72 | 260 ms | 0.00046 | $0.00131 |
| events | 116 / 168 | 1.75 s | 0.0014 | $0.00445 |
| time | 26 / 45 | 210 ms | 0.00032 | $0.00114 |
| sky-fact | 47 / 76 | 840 ms | 0.00062 | $0.00242 |

These are gross compute-plus-invocation estimates for the observed synthetic workloads, normalized from 20 to 1,000 requests. They exclude network/CDN transfer and requests, Firewall, observability, base subscription, taxes, credits and discounts. They are not an entire-request bill, invoice, net bill, measured 1,000-request run or worst-case workload forecast. In particular, two events SDK rate-limit checks are not assumed to be two billable WAF units; no WAF charge is included.

### Formula and rates

For each endpoint, with N=20:

`Cost per 1,000 = (1000/N) × [(CPU sum ms / 3,600,000) × 0.128 + Duration GB-hours sum × 0.0106] + 1000 × 0.60/1,000,000`

The [official Fluid pricing page](https://vercel.com/docs/functions/usage-and-pricing), independently checked October 1, 2026, lists iad1 at $0.128 per active CPU-hour and $0.0106 per provisioned GB-hour; its Pro example prices invocations at $0.60 per million. The page was updated June 16, 2026. Project UI evidence establishes Pro and Fluid.

The memory input retains its exact observed name, `Duration (Gb-hrs)` / `functionDurationGbhr`. Applying the provisioned-memory rate produces a usage-based estimate, not invoice allocation. The Query GB-hour total is used once; it is not multiplied by memory size again. The baseline reports Peak Concurrency 1, and this calculation does not double-count overlapping per-request memory intervals.

## Precision limits

The raw numeric Query export did not complete. CPU/GB-hour sums are rounded UI values. We have not verified the formatter's rounding policy, so a guaranteed numerical rounding interval cannot be claimed. Extra digits in JSON preserve the arithmetic, not extra measurement precision.

Use the approximate nominal estimates in the main table. No numerical rounding interval is provided because the raw source values and formatter policy are unavailable.

## What remains unmeasured

- Cold count is zero in this window. Cold p50/p95 and cold cost are null; there is no cold-start acceptance evidence.
- The observed platform start label is Hot. No start type was guessed or derived from sharing an instance.
- Aggregate CPU is measured, but per-request CPU is unavailable. Dividing by 20 gives an average, not measured CPU for each call.
- Peak memory is a different metric from GB-hour consumption. It is not a substitute for the Query cost input.
- A small, repeated documented-input sample cannot establish worst-case or general traffic performance.

## Evidence and supersession

- `vercel-start-types-query.txt`: saved Count Sum / start-type DOM and URL
- `vercel-cpu-query.txt`: saved CPU Sum DOM and URL
- `vercel-memory-query.txt`: saved Duration GB-hrs Sum DOM and URL
- `vercel-hot-cost-supplement.json`: sanitized reconciled aggregates, cost components, limits and evidence hashes
- `vercel-query-pricing-provenance.json`: bounded independently verified rates and billing scope
- `analyze-vercel-query-supplement.py`: reproducible local analysis

Earlier connector/export-only evidence remains unchanged, including its historical null fields. This supplement supersedes only the prior lack of aggregate start-type and CPU/memory-query evidence. It does not rewrite the raw connector response or pretend the export itself contained those fields. The analysis verifies hashes of the earlier baseline artifacts after writing its new files.
