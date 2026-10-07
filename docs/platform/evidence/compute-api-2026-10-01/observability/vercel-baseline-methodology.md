# Exact synthetic baseline / Vercel export join

## Result

All 120 baseline requests match exactly and uniquely to a platform record. The baseline has 20 requests for each of six endpoints. Only those 120 records enter the sanitized artifact and statistics. The two earlier sanity probes, rate-limit checks, unrelated site traffic and every other export row are excluded.

Deployment: `dpl_6uGzGxdgxboMZ5jeFwQMTL24demr`  
Source SHA: `9cfafa3e742de943062c9174338472781724a4b5`  
Platform request timestamps: 2026-10-01 06:05:07.477–06:09:27.255 UTC  
Function: `/api/compatibility`  
Execution region: `iad1`

### Platform execution duration

These are Vercel export `durationMs` values, whose UI label is Execution Duration. They are not client round-trip latency, active CPU time or demonstrated billable duration.

| Endpoint | n | Minimum ms | p50 ms | p95 ms | Maximum ms | Mean ms |
|---|---:|---:|---:|---:|---:|---:|
| chart | 20 | 17 | 22 | 44 | 63 | 27.85 |
| positions | 20 | 17 | 25 | 49 | 55 | 27.75 |
| houses | 20 | 20 | 38 | 72 | 74 | 40.50 |
| events | 20 | 91 | 116 | 168 | 254 | 126.50 |
| time | 20 | 18 | 26 | 45 | 57 | 27.85 |
| sky-fact | 20 | 41 | 47 | 76 | 123 | 54.80 |

All records report maximum memory 2048 MB and Peak Concurrency 1. There is one distinct instance identifier, replaced by `instance-01` in the sanitized file. Exported peak-memory values range from 208 to 249 MB. The separate UI capture verifies the MB and Peak Concurrency labels; it is not added to the sample.

The first baseline chart is 42 ms in the platform export and 6220.69967 ms in the client measurement. Its request ID joins exactly, so the difference does not come from accidentally using the earlier sanity chart. The 6.2-second client sample is not a 6.2-second function execution or a confirmed cold start. No causal breakdown of that excess latency is available here.

## Exact join procedure

1. Read the explicit allow-list from `production-2026-10-01/requests.jsonl` and its `plan.json`. Require 120 unique endpoint/round pairs and exactly 20 records per endpoint.
2. Take the substring after the final `::` in the captured response `x-vercel-id`.
3. Require that substring to equal exactly one exported `requestId`. No fuzzy or timestamp-only fallback is used.
4. Validate project, deployment, production environment, host, POST method, exact endpoint path, HTTP 200, compatibility function and expected internal rewrite parameter.
5. Require the millisecond timestamp encoded in that request-ID suffix to equal exported `timestampInMs`. HTTP Date is retained for provenance but is not the join key because it has one-second resolution.
6. Project only the allow-listed record fields into the sanitized output. Replace raw instance IDs with stable local labels. Preserve synthetic response identifiers, schema and SHA-256 for later verification without retaining response bodies or input data.

The source export, baseline and plan SHA-256 hashes are recorded in the artifacts. The raw private export is not copied or published. The script runs locally without network calls or external changes.

## Statistics

Percentiles use the same nearest-rank convention as the baseline: sort ascending and select position `ceil(p × n)`, one-indexed. With n=20, p50 is the 10th observation and p95 the 19th. Means are arithmetic means. The recorded memory peaks are descriptive gauges; they are not summed into a consumption or billing estimate.

These are a small, deterministic synthetic workload sample, not a population estimate, confidence interval, load test or worst-case-budget benchmark. Client elapsed measurements are retained separately in the summary and per-sample records.

## Privacy and sanitization

Every matched record has an empty `message` field. The artifact stores only that boolean, not arbitrary raw log-message content. Nonbaseline records, raw messages, query text, user-agent, trace/session IDs and invocation IDs are omitted. Raw instance IDs are pseudonymized. Bodies and receipts are omitted except for the synthetic response's engine identity/version and body hash.

This supports only the statement that the matched export records have empty messages. It does not prove absence of data in other log streams, private module state, host request metadata, telemetry layers or storage.

## Limits that remain open

- The export has no start-type field or cold-start flag. The same instance ID, sequence position and relative latency do not establish cold/warm class. A separate sanity request marked Hot in the UI does not classify all baseline requests.
- No active-CPU measurement, billed-memory GB-hours, shared-memory allocation accounting or billing receipt is in this export. Cost per 1,000 remains null.
- Peak memory is not billable provisioned-memory consumption and may include instance state accumulated across requests. Do not interpret it as the isolated allocation of the current endpoint or evidence of a memory leak.
- Peak Concurrency 1 is the platform's reported value for these records. It does not reconstruct all scheduling or classify function starts.
- The UI unit/semantic check used a separate known sanity request, expressly excluded from every baseline statistic. Its timing and start type must not be substituted for the 42 ms first baseline chart.

## Files

- `vercel-baseline-matched.json`: sanitized exact-match records, 120 samples
- `vercel-baseline-summary.json`: endpoint/platform/client distributions and evidence hashes
- `analyze-vercel-baseline.py`: reproducible, fail-closed local join and analysis
- `vercel-baseline-analysis-result.txt`: safe console summary from the analysis
- `vercel-baseline-methodology.md`: this report

No repository, browser, service setting or production endpoint was changed by this analysis.
