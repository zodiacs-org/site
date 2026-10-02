# Production compute telemetry inspection, 2026-10-01

## Finding

The connected Vercel tool can corroborate HTTP result metadata and visible application log output. It cannot supply the metrics required to accept the deployed warm/cold latency and cost gate. Keep the gate open until metered execution evidence is available. No production calls were sent by this telemetry task.

Deployment: dpl_6uGzGxdgxboMZ5jeFwQMTL24demr
Source: 9cfafa3e742de943062c9174338472781724a4b5
Project: prj_nRTO3q3aNYLfaM3dotAowOc028fO
Team: team_Ue0ac8HT1b3TAzaDDZBTFhQt
Domain: zodiacs.org
Execution region returned by get_deployment: iad1

## What the connector actually returns

The available get_runtime_logs tool supports time/deployment/environment/source/status filters, a full-text query, a requestId filter, and grouped counts. Maximum result count is 100; no pagination/detail/export parameter is offered.

Observed per-request text fields: second-resolution timestamp, HTTP method, request path, HTTP status, severity/source, deployment ID, branch, CDN cache result. It returns no structured per-request record. No cold-start flag/start type, execution duration, active CPU time, provisioned-memory amount, GB-hours, billed duration, runtime request ID, instance ID or concurrency is present in the observed text.

Passing the sample response's x-vercel-id as requestId returned no rows. A response identifier must not be relabeled as the runtime-only request identifier. Its absence also limits precise correlation: path+second+status can be matched, but competing requests in the same second cannot be disambiguated.

The available connector has no Observability Query, function-metrics export, billing usage, or runtime-log detail action. get_project has a schema mismatch: projectId passes the connector but upstream requires idOrName; idOrName-only is rejected by the connector for missing projectId; supplying both still loses idOrName upstream. No further attempts were made.

## Dashboard fallback

A read-only visit in dot's cloud browser to the project Logs dashboard redirected to Vercel login. There was no existing authenticated dashboard session. No login, permission request, token handling, environment-variable reading, or settings change was performed. The fallback therefore yielded no metrics.

## Documented recovery route

Official Runtime Logs documentation says the dashboard's individual-request sidebar provides a runtime Request Id and function metadata including duration, memory usage, and start type. Inspect those for the exact synthetic request window and retain evidence of the type; do not infer coldness from request order. Runtime-log retention is one day on Pro without Observability Plus, 30 days with Plus.
Source: https://vercel.com/docs/logs/runtime (updated 2026-08-28)

Official Query documentation provides CSV/JSON export. Full queries/filters need Observability Plus; free observability can open an existing query. Do not activate a paid feature just for this inspection.
Source: https://vercel.com/docs/query (updated 2026-09-16)

In Function Invocations, relevant metrics are Count, Duration (ms), Active CPU Time, Duration (Gb-hrs), Peak Memory and Provisioned Memory. P50/P95 are supported aggregations where the selected metric allows them. Filter the exact deployment/environment/window and group by Request Path if available; mapped Route may combine all six endpoints through compatibility. Start type is not listed in the public Query dimension table, so verify its actual availability rather than assuming.
Source: https://vercel.com/docs/query/reference (updated 2026-09-14)

An already configured Log Drain could contain requestId and proxy.vercelId for correlation. Its public schema also includes the path with query parameters and client IP, but does not promise the required CPU, billed memory or cold-start fields. Creating a new drain would change access/data transmission and was not done.
Source: https://vercel.com/docs/drains/reference/logs

## Pricing and measurement discipline

See pricing-metadata.json for dated sources, unit rates, formula and exclusions. Fluid compute is not confirmed enabled by the accessible live metadata. Do not silently apply Fluid rates if the deployment uses legacy billing.

Compute cost is based on active CPU and billable provisioned memory. External waiting is not CPU time, and concurrent requests can share the same instance memory. Client round-trip latency includes cloud egress, network, TLS, runtime and response transfer. It is a valid client-latency observation, not a cost input.

A function invocation costs $0.0000006 at the published Pro rate, or $0.0006 for 1,000 invocations before compute and other usage. WAF rate limiting is a separate line item. Plan credits do not make underlying usage free, and this inspection has no invoice/credit-balance evidence.

## Source privacy boundary

At the inspected SHA, src/lib/compute-api/handler.ts contains no console/file/store instrumentation. It passes only request headers to the Firewall SDK and catches errors into the fixed refusal catalogue. tests/api/compute-api-privacy.test.ts is the stronger local negative-control test; this task inspected its coverage but did not execute it.

The host can retain URLs/query strings and client IP even when the handler ignores query strings. Production samples use documented synthetic POST bodies, not actual birth data. Available production rows can provide a bounded absence-of-visible-leak observation, not proof that every Vercel storage/telemetry layer is empty.


## Completed synthetic-sample log check

The bounded 06:03–06:10 UTC inspection returned 122 metadata rows, all HTTP 200: 20 per endpoint, plus one extra chart probe and one extra time probe. All 120 records in measurements/production-2026-10-01/requests.jsonl have a unique candidate by path, status and timestamp within one second. This is temporal corroboration, not a request-ID join. No free-standing application output or any of 13 distinctive synthetic input values appeared in these returned log texts. See log-privacy-correlation.json for the complete correlation and search list.

A two-minute query with limit=100 exposed a connector defect: it returned the newest 50 rows twice, omitting the earliest five of that window. That defective raw result was excluded from both the committed evidence and the correlation. The window was re-read in minute-long slices with limit=50, yielding 28 and 27 distinct rows. This is why grouped/ungrouped counts must not be blindly trusted as a full export.

These observations cover successful synthetic examples only. They do not prove error-path behaviour or a planted production leak control. Application silence is consistent with the source's no-logging boundary; host logs still retain request metadata.

## Connector completeness limitation

A limit=100 two-minute query duplicated its newest 50 rows and omitted earlier rows. The preserved minute-sized reads recovered the complete sample; the defective response is not used as evidence. Do not assume a full-size return is a complete export.
