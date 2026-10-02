# Independent sanitized telemetry validation

Status: **PASS_SANITIZED_CONSISTENCY_ONLY**
Audit time: 2026-10-01T21:05:38Z (UTC supplied from the clock tool; no filesystem/host timestamp inference).

This implementation read only the three named sanitized JSON inputs and the optional sanitized deployment-binding JSON. It did not read or execute the original analyzer, private exports, requests/plan files, or earlier private validation notes. Nothing was published or uploaded.

## Reproduced results

- 120 unique request IDs; chart, positions, houses, events, time, and sky-fact each have 20 rows and rounds 0–19
- Distinct recorded platform start labels: 119 Hot, 1 Prewarmed, 0 Cold
- First chart: `4qxpn-1790886364519-db3f1d9862d4`; 424 ms execution and 7853.239128 ms client elapsed. Full sanitized sample and recorded detail URL IDs agree
- Group sums: 5470 ms CPU and 0.00481 GB-hours
- Recorded rates: $0.128/CPU-hour, $0.0106/GB-hour, and $0.60/million invocations (USD, iad1)
- Recomputed compute-plus-invocations: $0.002645624074074074/1,000; $0.00031747488888888886 for this 120-row cohort

## Checks

- Sanitized JSON schemas, metadata/window consistency, and matched-artifact SHA-256
- Optional sanitized deployment-binding identifiers and SHA-256; no live deployment recheck
- 120 unique sanitized IDs; six endpoints × 20 unique rounds; distinct 119 Hot / 1 Prewarmed / 0 Cold; timestamp and row-field consistency
- Sanitized claimed export/join counts agree with rows only; raw joins and exclusivity remain unverified
- First-chart ID, full sanitized sample, round/start label, and recorded detail/query URLs agree; response-finished assertion unverified
- Seven route/start-type group counts, CPU/unit and GB-hour display conversions, nearest-rank execution/client summaries, and recorded-rate costs
- Six route counts, nearest-rank execution/client/peak-memory summaries, independent group sums, and per-1,000 costs
- Cohort CPU/GB-hour totals, direct and weighted cost arithmetic, and observed-cohort gross estimate
- Sanitized instance/concurrency/memory metadata, message-empty flag consistency only, and unmeasured Cold metrics retained as null

Nearest-rank p50/p95 values are independently selected from sorted sample arrays. CPU display strings are converted from ms/s; memory GB-hours are summed once. Costs are recomputed independently per group, per route, and for the cohort at the recorded rates. Numerical tolerances and per-route percentile results are in the JSON receipt.

## Portable and fail-closed execution

Passed in a fresh temporary directory containing only the validator and four named sanitized inputs, with Python isolated mode and bytecode writing disabled (`-I -B`). Both adjacent-file default and explicit-directory runs passed. A separate run with the optional binding absent also passed. No extra files were created by the validator.
17 negative tests each returned status 1, a clear diagnostic, and no partial PASS receipt. They cover missing input/fields, altered hashes, duplicate IDs/JSON keys, wrong start counts/percentiles/first-chart IDs, CPU display mismatch, group/route/cohort arithmetic errors, malformed/non-finite numeric values, unexpected fields, and inconsistent binding.

Run: `python3 validate-sanitized-platform.py [directory]`

## Sanitized input SHA-256 hashes

- `platform-matched-sanitized.json`: `da428714e128f724ceffff4b69dffabc6c7134f5a32ce91c8b2885a5ab68c60b`
- `platform-summary.json`: `10b05ac40b565cd3f5333d1a201644b5257aabb60ebcf8bf9154ae6065c312fc`
- `platform-query-sanitized.json`: `c55bfe82f1bfda8078efd9e510fa912fa6281fed34da9991d55ae09214bef01a`
- `platform-deployment-binding.json`: `a44fcfde0e35b11326683ef2931beeca033619e83ce969744e67a7694105ae83`

## Explicit limits

- Sanitized consistency does not independently reconstruct or prove the raw x-vercel-id-to-requestId join.
- Raw export completeness/exclusivity, exact allowlist equality, or a closed live Query population cannot be independently reconstructed from this subset.
- Hidden original fields, including internal rewrite fields, are unavailable; exposed function labels do not prove routing or rewrite behavior.
- Actual underlying UI/private snapshots, live provider facts, deployment state, pricing verification, and start-label assignments cannot be independently authenticated here.
- messageEmpty flags and allMatchedMessagesEmpty are checked only for sanitized self-consistency; the empty raw-message assertion cannot be reconstructed without raw messages.
- The 611 ms first-chart response-finished assertion has no underlying detail/timing record in these inputs and is not independently verified.
- CPU and memory-duration are rounded group display aggregates. Per-request CPU/memory are null, and raw precision/formatter policy are unavailable.
- Cost arithmetic uses the recorded rates and group GB-hours once. It is not invoice allocation or actual billing verification and excludes unmodeled charges, discounts, credits, and tax.
- Causal explanations, population/worst-case performance, and cold-start latency/cost cannot be inferred. There are zero Cold samples and one Prewarmed sample.
- Only sanitized input byte hashes are recomputed. Private provenance references are not opened, hashed, reproduced, or treated as verified; hashes provide integrity, not authenticity.
