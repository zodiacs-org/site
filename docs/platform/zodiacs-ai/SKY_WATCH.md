# Sky Watch private preview

Implemented 2026-10-06. Default off for ordinary plugin packages and production.
A separate OAuth-protected host and scheduled worker are active for the private
preview. No human watches or successful ChatGPT deliveries have been established.
After the corrected deployment and native tool refresh, a fresh Work chat
exposed all three event types and created a Moon ingress watch. Server state
confirms callback verification and finite expiry. Pausing the native task set
the subscription inactive and cleared callback credentials; no active test
watch or polling substitute remains. The older conversation could not use the
new events. Actual arrival and automatic renewal remain unverified. See
[current native evidence](evidence/native-2026-10-06/README.md).
The existing ChatGPT Chart Studio preview remains on its original deployment.

A separate Free Plan project, **Zodiacs Sky Watch Test**, is now provisioned in
the Zodiacs.org organization at the confirmed $0/month database quote. Its schema,
access controls and actual runtime/Data API path have been verified. The dedicated
host is `https://zodiacs-sky-watch-test.vercel.app`; its MCP endpoint requires
OAuth. Hosted sign-in, refresh and grant revocation pass with synthetic accounts.
See the original [database staging record](evidence/sky-watch/staging.json) and
the later [hosted acceptance record](evidence/sky-watch/hosted.json).

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

The hosted preview uses Supabase OAuth with predefined public clients, PKCE S256,
protected-resource discovery and an exact MCP audience. A custom access-token
hook adds the separate `sky:watch` application permission; `openid` is the
identity scope. The server verifies the signature, issuer, audience, expiry,
session, client, user and permission, then checks live authorization on every
request and before delivery. Unapproved clients, anonymous accounts and legacy
operator tokens are refused in OAuth mode.

Hosted Auth tables cannot delegate their SELECT grants through postgres. Small
invoker triggers therefore maintain essential authorization facts in a private
table in the same transaction as Auth updates. Only Auth writes these facts;
the worker has read access. No email, password or token is copied. Consent
revocation, session deletion/expiry, user suspension and client disablement stop
access. The account page exposes Disconnect. Signing out of that page does not
disconnect the application; the page explains this distinction.

The loopback operator runner retains seven-day synthetic bearer grants for
offline integration tests. Neither mode is enabled in production. Preview
accounts are separate from the main Zodiacs website.

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

The hosted worker also takes a three-minute database lease to bound overlapping
invocations and saves aggregate completion health. Supabase Cron checks every
five minutes and calls the worker through `pg_net` only when a watch is active
or the previous maintenance completion is at least a day old. The worker bearer
secret lives in Vault and the preview deployment, never in committed SQL.
Five-minute polling is not a promised delivery latency. Scheduler/HTTP failures
and platform pauses can delay events. Review aggregate health and queue state;
there is no production alerting/SLA in this private preview.

The database uses the approved Free Plan. The isolated host uses the existing
Vercel team; no paid upgrade was added, but usage is not guaranteed to cost zero.
The signup page requires 12 characters. The provider's last verified minimum is
six; increasing the server-side setting remains an operator task because the
CLI credential lookup timed out. Client-side validation is not an enforcement
boundary. Supabase's leaked-password check is unavailable on this Free Plan
(the security advisor reports one warning). Before a wider beta, configure the
email sender, server-side password policy and account-recovery experience.
See [Supabase password security](https://supabase.com/docs/guides/auth/password-security).

The reviewed scheduling recipe is in [SKY_WATCH_OPERATIONS.md](./SKY_WATCH_OPERATIONS.md).

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
- `supabase/migrations/20261006073225_sky_watch_oauth.sql`
- `supabase/migrations/20261006074029_sky_watch_worker_lease.sql`
- `supabase/migrations/20261006075332_sky_watch_auth_lifecycle_projection.sql`

All six are applied to the Free Plan test project. The singleton migration makes
the ledger boundary update explicitly select its singleton row, as required by
Supabase's Data API `safeupdate` protection. That protection remains enabled.

Configure server-side secrets through the deployment's secret manager:

- `VERCEL_ENV=preview`
- `ZODIACS_MCP_ENABLED=1`
- `ZODIACS_SKY_WATCH_ENABLED=1`
- `ZODIACS_SKY_WATCH_KEY`: base64 encoding of 32 random bytes
- `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: staging project
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the same project's public browser key
- `ZODIACS_SKY_WATCH_AUTH=oauth`: required on the hosted preview
- `ZODIACS_WATCH_OAUTH_CLIENTS`: comma-separated, predefined client IDs
- `ZODIACS_SKY_WATCH_WORKER_KEY`: at least 43 random base64url characters
- Existing exact MCP staging host and Firewall/atomic quota configuration

Allow each client and exact resource in the private `sky_watch.oauth_clients`
table. Enable the provider's OAuth server and `sky_watch.access_token_hook`,
keep dynamic registration disabled and register only the exact callback shown
by ChatGPT. Set the provider's site URL to the test host and authorization path
to `/oauth/consent`. Confirm email addresses. The default Supabase mail service
is limited; broad beta invitations need a separately reviewed email setup.

Build the dedicated deployment with
`node scripts/build-sky-watch-preview.mjs /absolute/external/output-directory`.
Its deployment must actually report `preview` before assigning the test alias.
Vercel can promote the first deployment of a new project to production even
when preview was requested; that deployment's MCP is refused by the preview gate.
The existing production project and old Chart Studio alias are not repointed.
The standalone test project keeps the same 40/10 Firewall rules and atomic quota.

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
calculates due events and sends queued callbacks. The dedicated hosted preview
uses the guarded `/worker` route and five-minute schedule described above.
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

The OAuth SQL tests run Auth writes under `supabase_auth_admin`, verify the
worker cannot forge the projection, and exercise live revocation, expiry, scope
downgrade, client disablement, account isolation and worker leases. Signature
tests use a real ES256 key/JWKS and reject tampering and wrong audiences.
The hosted synthetic check exercised authorization code + S256, refresh,
six-tool/three-event discovery, anonymous worker refusal and actual provider
grant revocation. Both old and refreshed tokens returned 401 afterward.

Run the drive with `SKY_WATCH_TEST_DATABASE_URL` pointing to an isolated local
PostgreSQL database whose name ends in `_test`, after applying the bootstrap,
Sky Watch migration and singleton update correction. It intentionally refuses nonlocal databases and truncates
only Sky Watch tables in the test database.

The original [verification record](evidence/sky-watch/verification.json) and
current [hosted acceptance record](evidence/sky-watch/hosted.json) distinguish
their runtime, migration and package hashes, checks and deployment status.

## Remaining release gates

1. Completed: **Zodiacs Sky Watch Preview** connected the existing synthetic
   preview account in ChatGPT. No human beta feedback is implied.
2. Verify subscription, arrival, refresh and stop in ChatGPT Work/Cloud. Rescan
   and record host evidence. Do not repoint the existing Chart Studio alias or
   reuse its deployment-bound share credential. Synthetic/local callback tests
   and scheduler invocation are not evidence of ChatGPT receiving an event.
3. Complete the existing beta evidence and owner review before production
   enablement or directory submission. No human feedback has been fabricated.

Protocol reference: [OpenAI MCP Events guide](https://developers.openai.com/plugins/build/mcp-events),
checked 2026-10-06. Signature format follows
[Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md).
