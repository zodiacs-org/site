# Atomic hosted quotas

The earlier Firewall-only preview allowed twelve concurrent event searches under
the nominal ten-per-minute rule. Sequential evidence remains valid, but that
overshoot does not establish strict concurrency enforcement. Vercel documents
regional counters; the exact source of the observed concurrent overshoot has not
been proven. Increasing the Firewall rule would not solve this acceptance gap.

The hosted adapter now additionally reserves database slots through
`zodiacs_mcp_quota_reserve_v1`. PostgreSQL serializes updates to one exact budget
row with `INSERT ... ON CONFLICT DO UPDATE ... WHERE`. Admission and increment
are one operation, using the locked current row and database clock. Missing
configuration, permissions, malformed RPC replies, timeout or network failure
refuse computation. A timeout may consume a slot without returning success;
there is no retry or refund that could admit duplicate work.

The service-wide ceilings are 40 admitted MCP requests and ten expensive event/date
fact computations per 60-second window. A window starts at the first admission;
the first request after expiry resets it. These are fixed windows, so adjacent
windows can admit two bursts around expiry. Preview and production have distinct
rows. All instances, regions, deployments and callers within one scope share
the ceiling. The existing 40/10 per-address Firewall rules remain separate and
unchanged. These ceilings deliberately bound the initial service; they do not
promise per-user fairness or a particular number of useful chat completions.
Shared provider egress and duplicate model calls can exhaust them sooner.

Only four possible rows exist. They contain scope, budget kind, count and expiry;
no caller identifiers, IPs, arguments, outputs or operation histories are stored.
The private schema is not exposed to browser roles; RLS is enabled, the RPC uses
security invoker, and only the existing server service role can execute it.
The additive migration is applied to the existing project. No production quota
row or enabled production endpoint has been created by this continuation.

Disposable PostgreSQL 17 tests force 48 independent backends to contend together:
exactly ten event and forty admitted request slots are admitted, with reset, transaction
rollback, scope separation and permissions also checked. The same test is wired
into the existing Phase 6 SQL CI job. Real preview REST tests additionally admit
10/48 and 40/48 concurrent requests; see `evidence/atomic-quota-rpc.json`.
HTTP deployment acceptance and resource measurements are recorded separately.

The Supabase CLI initially failed before execution with `Unsupported Config
Type`. Its existing extensionless profile file caused the failure. Temporarily
moving that file allowed existing CLI authentication to retrieve the necessary
key; the original profile was restored immediately. No new key or authentication
scope was created. The migration filename was generated from the current UTC
timestamp after three CLI creation attempts failed. Credentials remain private.

References: [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html),
[Supabase functions](https://supabase.com/docs/guides/database/functions),
[Vercel regional rate limits](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting).
