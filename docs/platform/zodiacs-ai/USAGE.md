# Anonymous usage counts for the hosted MCP server

Status on 8 October 2026: built and tested, **not switched on**. The migration
`supabase/migrations/20261008074758_zodiacs_mcp_usage_counts.sql` has not been
applied to any database. Until the owner approves it and it is applied, the
server's counting call fails quietly and nothing is recorded. No environment
variable, Vercel setting or Supabase setting was changed for this work.

## What is counted

Each tool call that the hosted server at `https://zodiacs.org/mcp` handles adds
one to a daily counter. A counter is identified by four values and holds one
number:

| Column | Values |
| --- | --- |
| `day` | the UTC calendar date, taken from the database clock |
| `scope` | `preview` or `production` (the deployment's `VERCEL_ENV`) |
| `tool` | one of the six tool names: `get_capabilities`, `get_sky`, `get_upcoming_events`, `check_sky_fact`, `get_horoscope`, `open_chart_studio` |
| `host` | `chatgpt`, `claude` or `other` |
| `calls` | how many calls that day |

The host family comes from the request's `User-Agent` header: `chatgpt` if it
contains "openai" or "chatgpt", otherwise `claude` if it contains "claude" or
"anthropic" (upper or lower case), otherwise `other`. There are at most 36 rows a
day (2 scopes × 6 tools × 3 families).

A call is counted once, after its reply has been sent, whether the tool
answered or returned an error result (an unknown time zone, an exhausted event
budget). These are not counted:

- requests refused before a tool runs: rate limit (429), quota unavailable
  (503), the server switched off, wrong host or origin, malformed or oversized
  requests;
- `initialize`, `tools/list`, `resources/read`, health checks and every other
  protocol message, and calls naming a tool that does not exist;
- the local developer plugin, which runs on the user's machine and makes no
  outbound requests.

## What is not kept

The table has no column for anything else, and its checks refuse any value
outside the lists above. No IP address, `User-Agent` text, account, session or
connection identifier, tool argument, birth detail, location hint, result or
time finer than the UTC day is stored. The `User-Agent` header is read once to
pick the family and is not stored, logged or forwarded. The request the server
sends to the database carries exactly three fixed values: scope, tool name and
family.

The hosting platform's own request logs are separate and unchanged; the
privacy page describes them.

## How counting stays out of the way

- Counting starts only after the reply has ended, so it cannot delay, change
  or fail a reply. `src/ai-tools/http.ts` (`countAfterReply`) catches every
  error.
- On Vercel, `api/_ai/handler.ts` passes `waitUntil` from `@vercel/functions`
  (already a site dependency), so a count started after the reply can finish in
  the same invocation. Without that hook (tests, the separate Sky Watch
  preview) the count runs detached.
- The database call (`src/ai-tools/usage.ts`) gives up after 1.5 seconds. A
  count lost to a slow or unavailable database is not retried, so the numbers
  are a floor, not an exact total.
- It reuses the quota's configuration checks: without `PUBLIC_SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` and `VERCEL_ENV` set to `preview` or
  `production` (local development, tests), nothing is sent.
- The RPC `zodiacs_mcp_usage_count_v1` is one `INSERT ... ON CONFLICT DO
  UPDATE SET calls = calls + 1`, so simultaneous calls never lose a count. The
  table sits beside the quota in the private `zodiacs_mcp_private` schema with
  row-level security; only the server's service role can execute the RPC, and
  browser roles can neither count nor read.

## Reading the numbers

Run these in the Supabase SQL editor. They only read.

Calls per day for the last 30 UTC days, split by assistant:

```sql
select day,
  sum(calls) as calls,
  coalesce(sum(calls) filter (where host = 'chatgpt'), 0) as chatgpt,
  coalesce(sum(calls) filter (where host = 'claude'), 0) as claude,
  coalesce(sum(calls) filter (where host = 'other'), 0) as other
from zodiacs_mcp_private.usage_daily
where scope = 'production'
  and day > (now() at time zone 'utc')::date - 30
group by day
order by day desc;
```

Which tools are used, over the same period:

```sql
select tool, host, sum(calls) as calls
from zodiacs_mcp_private.usage_daily
where scope = 'production'
  and day > (now() at time zone 'utc')::date - 30
group by tool, host
order by calls desc;
```

How to read them:

- These are calls, not people. One conversation can make several calls, and
  nothing here can tell people apart. That is deliberate.
- Days are UTC. In Bangkok a UTC day runs from 07:00 to 07:00 the next morning.
- A day with no calls has no row.
- `other` includes test tools, the MCP Inspector, scripts and any assistant
  whose `User-Agent` names neither family. The header is chosen by the caller
  and can be missing or wrong, so treat the family split as a rough guide.
- Leave `preview` rows out of usage figures: they come from test deployments
  and review drives.

## Before switching it on (owner decisions)

1. **Approve applying the migration.** It is additive and safe to run twice.
   It and this code can go live in either order. Once the code is deployed and
   until the migration is applied, each tool call makes one background request
   that Supabase refuses (the RPC does not exist yet); replies are unaffected,
   but applying the migration first avoids those refusals.
2. **Decide the privacy wording.** No public text was changed. Sentences that
   say the hosted server saves or stores nothing are listed in the pull request
   that added this file. Counting stores no request or result, but the owner
   may want them to mention daily aggregate counts.
3. To stop counting later without a deploy, revoke the RPC from the service
   role: `revoke execute on function public.zodiacs_mcp_usage_count_v1(text,
   text, text) from service_role;`. The server's calls then fail quietly and
   the counts already kept stay in place.

Two facts for that decision: the weekly database backup
(`scripts/export-db-backup.sh`) copies `public`, `supabase_migrations`,
`private` and `living_chart_private`, not `zodiacs_mcp_private`, so these
counts, like the quota rows, are not in it. Nothing deletes old rows; at most
36 rows a day is about 13,000 a year.

If a tool is added or renamed, its name must be added to the table check and
the RPC in a new migration. `src/ai-tools/usage.test.ts` fails until the
migration's lists match the tool names.

## Tests

- `supabase/tests/zodiacs_mcp_usage.sql`, run by
  `scripts/test-phase6-assistant-sql.sh` (the "Phase 6 assistant quota SQL" CI
  job) after a replay of the migration: permissions, refusal of values outside
  the lists, 48 simultaneous backends on one row and 48 across six rows with no
  lost count, the UTC day under UTC+14 and UTC−12 session time zones, a new day
  starting a new row, and rollback.
- `src/ai-tools/usage.test.ts`: host family, the exact RPC request, a failing,
  hanging or slow counter never changing or delaying a reply, the default
  wiring making no request outside a configured deployment, nothing from
  arguments, location hints, credentials or the `User-Agent` reaching the
  counter, and the migration's lists matching the tool names.
