# Staging resources and initial capacity

Measured 2026-10-02 on enabled preview `dpl_CSFWTPqDyZ3ZF4e32wSXsFnMfspM`,
source `5468423bac0675336949ab16839f40ac5def3e92`, engine rc.16. Production
`/mcp/` remains unavailable (observed 404); no production switch or alias changed.

## Representative serial drive

Three repetitions of six public/synthetic tasks all succeed. SDK 2.0.0 makes
18 tool calls and three protocol requests, including its automatic GET 405.
The matching preview-only provider window is 12:45–12:47 UTC. No raw provider
IDs, headers, cookies or credentials are in the evidence.

| Task, three repetitions each | Median client RTT | Median handler duration | Median process CPU |
| --- | ---: | ---: | ---: |
| Capabilities | 541 ms | 253 ms | 14 ms |
| Exact sky, Bangkok | 1,027 ms | 726 ms | 37 ms |
| Seven-day events | 1,999 ms | 675 ms | 134 ms |
| 31-day events, New York | 1,286 ms | 838 ms | 191 ms |
| Date-only ingress fact, Bangkok | 772 ms | 490 ms | 27 ms |
| Curated search | 531 ms | 235 ms | 13 ms |

Overall client RTT: median 904 ms, nearest-rank p95/max 4,252 ms, minimum 515 ms.
With only 18 samples, that p95 is the maximum, not a production percentile.
RTT includes the client's network, transport, admission round trips to the
existing Japan database and computation. Handler measurements omit platform
startup and adapter work outside the timed boundary. A first handled request
is not proof of a cold platform instance.

Actual provider metrics for the matching 21 invocations: 673 ms average duration,
833 ms p75, 1,570 ms p95; average active CPU 94 ms, p75 127 ms, p95 257 ms;
2048 MB allocated and 243 MB average measured usage. Billing uses provisioned
memory, not the smaller heap usage. Start Type reports 95.2% hot and 4.8%
prewarmed; no cold start is reported in this serial window.

## Incremental function-cost estimate

The verified public iad1 rates are $0.128/CPU-hour, $0.0106/GB-hour and
$0.60/million invocations. Applying the rounded provider averages to this
isolated serial drive, with 2 GB provisioned memory:

`CPU = 21 × 94 ms / 3,600,000 × $0.128 = $0.0000702`

`Memory = 21 × 673 ms × 2 GB / 3,600,000 × $0.0106 = $0.0000832`

`Invocations = 21 × $0.60 / 1,000,000 = $0.0000126`

The function-only estimate is $0.000166 for the drive, or approximately
**$0.0092 per 1,000 successful tool calls**, with protocol overhead amortized
across these 18 calls. The application-timer estimate is about $0.0083 per
1,000; the provider-based figure includes more execution boundary work.
These are measured-resource rate-card estimates, not an invoice or a complete
per-chat cost. Pro credits can offset charges; they do not make the rate zero.
Shared Supabase CPU/egress, Vercel edge/network/Observability charges, existing
subscriptions and model tokens are unallocated. Provider Usage supplies project
totals rather than an isolated bill for this drive.

## Concurrency and cold-start mixture

The calendar burst at 12:47:09–12:47:16 UTC makes twelve simultaneous calls:
ten succeed and two refuse with `rate-limited`. Its matching 12:47–12:48 UTC
provider window contains fifteen invocations, including SDK protocol overhead.
Start Type reports **60% cold / 40% hot**. Average duration is 1.78 s, p75
2.45 s, p95 2.61 s; average active CPU is 439 ms, p75 670 ms, p95 730 ms.
This is actual cold-containing burst evidence. Aggregate provider start types
do not identify an individual tool's cold latency, and refusals are included.
Do not add overlapping per-request memory durations to infer Fluid billing:
instances can serve multiple concurrent requests.

A separate quiet-window 48-call general burst admits 38 tools and returns ten
HTTP 429s. Two preceding SDK requests use the remaining two atomic slots.
No unavailable-limiter response or quota overshoot is observed. Exact 40/10
database admissions are independently tested in 48-way PostgreSQL and REST
contention tests. See `QUOTAS.md` and the `staging-*-rc16.json` evidence.

The initial global ceilings are forty admitted MCP requests and ten expensive
computations per fixed minute, shared by all callers and regions in each scope.
OPTIONS and early host/origin/method refusals do not reserve calculation slots;
refused requests can still incur hosting charges. These are computation ceilings,
not an upper bound on total incoming traffic or spend. Retain the separate
Firewall and deployment protections. Two model calendar calls can consume two
expensive slots for one useful completion, leaving at most five such completions
in an otherwise empty minute. Shared provider addresses can reduce availability
further. No public-capacity, fairness or latency SLA is accepted by these tests.

The owner reviews these limits, provider costs and consenting beta aggregates
before activation. The beta packet staggers participants within the small shared
ceilings. A higher capacity requires a separately justified budget and load test.

References: [Fluid rates](https://vercel.com/docs/functions/usage-and-pricing),
[provisioned memory](https://vercel.com/docs/functions/configuring-functions/memory).
