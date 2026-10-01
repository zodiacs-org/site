# Post-release production compute telemetry

## Result

All **120 requests join exactly and uniquely** to the platform export for production deployment `dpl_AsJc5MrDgH4PpgoZSGMe7XTZePe4`, source `fd1ce88af66eca158c24a92569a9101281b964f7`, canonical host `zodiacs.org`, execution region `iad1`, function `/api/compatibility`. The connector independently verified the deployment as READY and its source, target, regions and production aliases.

The request cohort spans **2026-10-01 20:25:57.295–20:30:24.868 UTC**. Vercel Query reports **119 Hot, 1 Prewarmed, 0 Cold**. Prewarmed is preserved as its own platform category. Cold-start performance and cost remain unmeasured.

The first chart request is the Prewarmed record, explicitly shown by its exact-request detail as **Hot (prewarmed)**. Its function execution is **424 ms**, the UI's response-finished interval is **611 ms**, and client elapsed time is **7,853.239 ms**. These are separate measurement boundaries. No cause for the remaining client delay is established, and it is not a demonstrated cold start.

## Execution, resource totals and estimated cost

Nearest-rank percentiles are used. All resource totals below are the rounded strings displayed by Query, grouped by request path and platform start type.

| Endpoint / platform start label | n | Execution p50 / p95 ms | Active CPU sum | Duration GB-hours sum | Approx. gross compute + invocation USD / 1,000 |
|---|---:|---:|---:|---:|---:|
| chart / Hot | 19 | 53 / 75 | 680 ms | 0.00060 | $0.00221 |
| chart / Prewarmed | 1 | Single observation: 424 | 260 ms | 0.00024 | $0.01239* |
| positions / Hot | 20 | 43 / 67 | 540 ms | 0.00054 | $0.00185 |
| houses / Hot | 20 | 37 / 51 | 510 ms | 0.00046 | $0.00175 |
| events / Hot | 20 | 123 / 176 | 1.98 s | 0.0016 | $0.00497 |
| time / Hot | 20 | 37 / 86 | 270 ms | 0.00048 | $0.00133 |
| sky-fact / Hot | 20 | 71 / 104 | 1.23 s | 0.00089 | $0.00326 |

*The Prewarmed value is arithmetic normalization from one observation, not a representative rate, distribution or acceptance result. It must not be described as Cold cost.

For all 20 chart requests combined, the displayed subgroup totals sum to approximately **940 ms CPU**, **0.00084 GB-hours**, and **$0.00272 per 1,000**. This is a mixed 19-Hot/1-Prewarmed sample. Its execution p50/p95 is 53/75 ms and maximum is 424 ms.

Recorded peak-memory gauges across the cohort range from **200 to 287 MB** against **2048 MB** provisioned memory. Every row reports Peak Concurrency 1. These gauges are not allocation totals, are not summed for billing, and do not prove a memory leak or absence of retained state.

The full observed 120-request mix totals approximately **5,470 CPU ms**, **0.00481 GB-hours**, and **$0.0003175** gross compute plus invocations. Its normalized figure is approximately **$0.00265/1,000** for this exact equal-route sample mix, not general traffic.

## Cost method and precision

For each start-type group, with N equal to its observed count:

`USD / 1,000 = (1,000/N) × [(CPU ms / 3,600,000) × 0.128 + Duration GB-hours × 0.0106] + 0.0006`

The [official Fluid compute pricing page](https://vercel.com/docs/functions/usage-and-pricing), rechecked October 1, 2026 at 20:40 UTC, lists iad1 CPU at $0.128/hour and provisioned memory at $0.0106/GB-hour. Its Pro invocation example uses $0.60 per million. Pro and Fluid are visible in the dashboard. These published rates are not an account-specific invoice.

The Query memory metric is named `Duration (Gb-hrs)` / `functionDurationGbhr`. It is used once at the provisioned-memory rate, without multiplying by memory size again. No overlapping per-request memory intervals are summed. No WAF charge is inferred from rate-limit SDK calls.

The estimates exclude network/CDN requests and transfer, WAF, observability, subscription fees, taxes, credits and discounts. They are gross resource-plus-invocation estimates for this synthetic sample, not all-in request cost, a bill, a 1,000-request run, or worst-case capacity forecasts.

CPU and GB-hour values are rounded UI totals. Numeric Query JSON download did not complete. The formatter's rounding policy and underlying values are unavailable, so there is no justified guaranteed rounding interval; additional JSON arithmetic digits do not convey extra measurement precision.

## Exact join and start-type reconciliation

1. Read the explicit 120-request allow-list; require 20 samples for each of six endpoints and 120 unique endpoint/round pairs.
2. Split each captured synthetic request ID at its final `::`; require exactly one exported `requestId` equal to that suffix. No fuzzy or time-only join is accepted.
3. Require exact project, deployment, source-plan binding, production environment, canonical host, POST method, endpoint path, 200 status, function path, region and internal rewrite parameter. Require the timestamp encoded in each request ID to equal the exported millisecond timestamp.
4. The private Logs export covers 20:25–20:31 UTC and contains exactly 120 rows. Every row lies inside the tighter Query window, and its ID set equals the allow-list exactly. No other rows enter the output or aggregate reconciliation.
5. Count Sum Query uses the project and exact tighter UTC window, grouped by Request Path and Function Start Type, with no extra deployment/environment filter. It has one table page and exactly seven groups totaling 120: five 20-Hot routes, chart 19 Hot, chart 1 Prewarmed.
6. Exact first-chart detail independently identifies the sole Prewarmed chart. The closed-population reconciliation then classifies the other 119 as Hot. No class is inferred from elapsed time, request sequence or instance reuse.
7. CPU Sum and Duration GB-hours Sum use the same Query project, window and two grouping dimensions. No per-request CPU values are fabricated from group averages.

## Scoped privacy result

All **120 matched exported message fields are empty**. The output retains only that boolean. The connector's exact-first-request result also contained the invocation metadata without an application message. This supports a bounded log-message finding for the captured synthetic cohort.

It does **not** prove absence of sensitive data in other logs, traces, host request metadata, telemetry layers, storage or module state. The raw export and full UI captures stay private. Sanitized outputs omit raw messages, headers, query strings, user-agent, IP addresses, bodies, input-bearing receipts, trace/session/invocation IDs and raw instance IDs. Instance IDs are replaced with local labels. Synthetic request IDs, response hashes and engine identity are retained for auditability.

## Comparison limits

The earlier baseline was 120 Hot requests on a different deployment. The new cohort is mostly Hot with one Prewarmed chart; sample sizes and runtime conditions differ. The new Hot chart cost estimate is approximately $0.00221/1,000 versus the earlier $0.00118/1,000; this is an observed cohort comparison, not proof of a causal change or generalized regression. All routes' earlier and current data remain separate and unchanged.

The sample is a small deterministic synthetic workload. It does not establish worst-case budgets, general-traffic percentiles, cold acceptance or workload-wide privacy guarantees. No additional traffic, setting changes, Drain creation, credentials or user-computer access were used for this verification.

## Deliverables

- `platform-matched-sanitized.json`: 120 allowlisted joined records with explicit start-type evidence
- `platform-summary.json`: route and route/start-type statistics, costs, limits and evidence hashes
- `platform-query-sanitized.json`: bounded Query groups, verified URLs and pricing inputs
- `analyze-platform.py`: reproducible, fail-closed local analysis
- `platform-analysis-result.txt`: safe aggregate console output
- `validate-sanitized-platform.py`: separate, standalone Python-standard-library consistency validator
- `platform-sanitized-validation.json` and `.md`: sanitized independent validation receipt and limitations

## Two distinct validation methods

The original `analyze-platform.py` method uses the private export and UI captures to establish the exact original request join and provider evidence, then projects only allowed fields. It remains a distinct method; the private inputs are not part of the portable sanitized package.

The independent `validate-sanitized-platform.py` implementation reads only `platform-matched-sanitized.json`, `platform-summary.json`, `platform-query-sanitized.json`, and optionally `platform-deployment-binding.json`. It independently recomputes sample counts, distinct start labels, nearest-rank execution/client percentiles, displayed CPU and GB-hour conversions, route/start-type/route/cohort cost arithmetic, and applicable sanitized file hashes. Run `python3 validate-sanitized-platform.py` beside those sanitized files, or pass their directory as its first argument. It needs no private inputs, network access or third-party packages.

This second method establishes **sanitized internal consistency only**. It cannot independently reconstruct the original full response `x-vercel-id` to raw export join, raw export completeness or exclusion of unrelated traffic, hidden original fields such as the internal rewrite parameter, the live Query population, private UI snapshots, or the underlying empty raw-message assertion. The 611 ms first-chart response-finished figure appears only as a summary assertion in this subset. Sanitized checks also do not independently authenticate deployment, pricing or start-label facts, establish causal explanations, verify a bill, or supply absent Cold evidence. File hashes establish integrity, not source authenticity. The validation receipts state these limits explicitly.

Raw files ending `-private.json` must not be published or attached with the sanitized deliverables.
