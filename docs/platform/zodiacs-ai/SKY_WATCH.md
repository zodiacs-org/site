# Sky Watch private preview

Implemented 2026-10-06. Default off; no watches or external notifications are
active. The existing ChatGPT Chart Studio preview remains on its original
deployment. This implementation is a candidate for review, not evidence of
ChatGPT receiving an event.

A separate Free Plan project, **Zodiacs Sky Watch Test**, is now provisioned in
the Zodiacs.org organization at the confirmed $0/month database quote. Its schema,
access controls and actual runtime/Data API path have been verified. The HTTP
server used for this check was local; no public Sky Watch deployment or scheduler
is active. See the [staging record](evidence/sky-watch/staging.json).

## What is implemented

The same authenticated MCP endpoint serves the existing six tools and three
public-sky events: `zodiacs.sky.ingress`, `zodiacs.sky.station`, and
`zodiacs.sky.lunation`. Discovery, listing, subscribe, refresh and unsubscribe
use the installed MCP 2.0 SDK's custom-method API. Event calls require protocol
`2026-07-28`; the default anonymous plugin still advertises no events.

Subscribers explicitly select bodies or new/full Moon phases, with an optional
IANA zone. No birth details are accepted. Occurrence time is UTC; the zone adds
a display time. Data carries the engine event, calculation receipt and method
link. Search completeness remains `tested-not-proven`.

Private preview access uses random, individual seven-day bearer grants whose
SHA-256 hashes are stored in PostgreSQL. Grants are revocable. This is an
operator-managed preview credential bridge; **public OAuth onboarding is not
implemented**. Production mode refuses this bridge. No site account or email
is silently associated with a grant.

Subscriptions default to one day, accept shorter requests, and cap at seven
days or grant expiry. `ttlMs: null` receives a finite lifetime. Identity includes
the principal, canonical filters and callback URL. There is no protocol replay
cursor. Repeated calls reuse the identity; refresh uses a database revision to
avoid overwriting a concurrent cancellation. A stopped or expired watch begins
again at resubscription time.

Callbacks require HTTPS on port 443 and a successful signed challenge echo.
Every connection resolves the hostname anew, blocks nonpublic IP addresses,
pins an approved IP and verifies TLS against the original hostname. Redirects,
IP-literal destinations, credentials in URLs, oversized bodies and slow
responses are refused. Successful verification is reused for ten minutes only
with the same owner, identity and secret. Signing keys must decode to 24–64
bytes. Rotation sends both signatures for five minutes.

Destinations and signing keys are encrypted with AES-256-GCM, bound to the
subscription ID. Public and authenticated browser roles have no schema or RPC
access. The server-only RPC runs as invoker with a fixed search path; it does
not use `SECURITY DEFINER`. Credentials are cleared on unsubscribe, revocation,
receiver `410`, or expiry cleanup. Metadata is removed 30 days after expiry;
public event records and their delivery rows are retained for 30 days. Cleanup
runs with the worker, so a stopped worker must be restarted to finish retention.

The worker calculates fixed UTC-day partitions with the site's pinned engine.
After merging main, this is the vendored rc.17 candidate, which is not published
on npm. The already-connected Chart Studio preview still uses published rc.16.
It fills at most three days per run toward a two-day horizon and persists its
next boundary transactionally. Failed searches never advance it. Concurrent
workers use compare-and-swap ingestion and unique subscription/event outbox
rows. Engine changes refuse the ledger until an explicit migration is reviewed.

Delivery claims have two-minute leases and recheck access, subscription revision
and expiry immediately before sending. Failed workers are recovered after lease
expiry. Transient failures retry at most eight attempts, retaining event IDs,
with delays from 30 seconds up to one hour. `410` stops the watch; `413` and other
permanent failures stop that delivery. Retries can duplicate an accepted event
if its acknowledgement was lost; consumers must deduplicate by `eventId`.
An HTTPS request already in flight cannot be recalled by an unsubscribe.

## Running the private candidate

Use a separate staging database. Apply these reviewed migrations in order:

- `supabase/migrations/20261002115707_zodiacs_mcp_atomic_quota.sql`
- `supabase/migrations/20261006060504_sky_watch_preview.sql`
- `supabase/migrations/20261006070234_sky_watch_singleton_update.sql`

All three are applied to the Free Plan test project. The last migration makes
the ledger boundary update explicitly select its singleton row, as required by
Supabase's Data API `safeupdate` protection. That protection remains enabled.

Configure server-side secrets through the deployment's secret manager:

- `VERCEL_ENV=preview`
- `ZODIACS_MCP_ENABLED=1`
- `ZODIACS_SKY_WATCH_ENABLED=1`
- `ZODIACS_SKY_WATCH_KEY`: base64 encoding of 32 random bytes
- `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: staging project
- Existing exact MCP staging host and Firewall/atomic quota configuration

Keep the encryption key stable. Replacing it requires decrypting and resealing
destinations with both keys available; an arbitrary replacement makes existing
watches unreadable. Never place any of these credentials in plugin packages.

Build with `npm run ai:build`. The operator runner supports:

```sh
node scripts/sky-watch-preview.mjs grant /private/path/preview-grant.json
node scripts/sky-watch-preview.mjs serve
node scripts/sky-watch-preview.mjs tick
node scripts/sky-watch-preview.mjs revoke <principal-id>
```

`grant` writes a new file with mode 0600 and refuses overwriting. `serve` binds
only to `127.0.0.1:8793`, accepts the saved bearer token and limits local calls.
The deployed `/mcp` retains the existing Firewall and database quotas. `tick`
calculates due events and sends queued callbacks; schedule it every minute only
after staging configuration and host acceptance. No scheduler was activated.
The runner logs counts or fixed errors, never credentials or callback data.

## Verification

Unit tests cover callback URL/IP restrictions, DNS rebinding, address pinning,
redirect refusal, response budgets, exact-byte signatures, authenticated
encryption, challenge verification, filters, disabled/production gates, retry
policy, failed searches and deterministic engine event IDs.

`tests/sky-watch-drive.ts` uses real PostgreSQL 17 and the real MCP HTTP transport
with an injected synthetic callback receiver. It checks discovery and tool
compatibility, authentication, ownership, durable refresh across a fresh server
instance, key rotation, short TTL, cancellation during verification, concurrent
ingestion/claims, stale lease completion, retry IDs, filters, permanent rejection,
expiry, unsubscribe and revocation. Real engine calculations also verify ledger
restart without duplicates and bounded catch-up after missed worker runs. It
checks RLS and role grants too. The new
CI job **Sky Watch subscription lifecycle** repeats that drive on a disposable
database. It sends no external notifications and uses no real personal data.

Run the drive with `SKY_WATCH_TEST_DATABASE_URL` pointing to an isolated local
PostgreSQL database whose name ends in `_test`, after applying the bootstrap,
Sky Watch migration and singleton update correction. It intentionally refuses nonlocal databases and truncates
only Sky Watch tables in the test database.

The [verification record](evidence/sky-watch/verification.json) records the
reviewed runtime, migration and package hashes, check results and deployment
status.

## Remaining release gates

1. Add an OAuth connection flow suitable for real users, with scoped grants and
   disconnect/revocation mapped to delivery authorization.
2. Deploy the authenticated endpoint against the verified staging database,
   configure hosted secrets and a scheduled worker, and exercise the real HTTPS
   callback path there. The hosted database and local-to-hosted runtime checks
   are complete; they do not establish public endpoint or callback acceptance.
3. Connect a separate plugin and verify subscription, arrival, refresh and stop
   in ChatGPT Work/Cloud. Rescan and record host evidence. Do not repoint the
   existing Chart Studio alias or reuse its deployment-bound share credential.
4. Complete the existing beta evidence and owner review before production
   enablement or directory submission. No human feedback has been fabricated.

Protocol reference: [OpenAI MCP Events guide](https://developers.openai.com/plugins/build/mcp-events),
checked 2026-10-06. Signature format follows
[Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md).
