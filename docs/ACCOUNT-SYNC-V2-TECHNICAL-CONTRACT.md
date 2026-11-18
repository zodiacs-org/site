# Zodiacs account sync v2 technical contract

Status: launch contract (owner-approved, 2026-11-11). Encrypted sync of one
self chart is open to every signed-in adult account once the operator turns on
the switches in "Feature gates". This document still does not authorize a
migration, deployment or data copy by itself; those follow the reviewed
handoff.

## Product boundary

The Zodiacs site and future iOS app remain useful without an account. An
account adds continuity, recovery, and explicitly selected cloud features; it
does not become a prerequisite for calculating, viewing, or saving a chart on
one device.

This phase builds private account infrastructure only. It does not build a
public profile, discovery, followers, reactions, comments, direct messages, or
a feed.

## Non-negotiable invariants

1. A chart stays local until its owner selects it for synchronization, grants
   the current `chart_sync` consent, and attests that it is their own chart.
   Each account may have exactly one active synced self chart.
2. Signing in never claims every chart already present in the browser.
3. Local synchronization metadata is scoped to one authenticated account. A
   second account must explicitly import or clear unbound data; it cannot
   inherit the first account's cloud copy.
4. Chart label, exact birth input, placements, and engine receipt are one
   private encrypted payload. Public presentation data is a future, separate
   projection and may never read this owner payload directly.
5. Sync changes, tombstones, telemetry, and logs contain identifiers and
   revisions only—never birth inputs, chart labels, placements, email
   addresses, or free text.
6. Server revisions, not device clocks, decide ordering. A client mutation is
   idempotent only for the same operation, base revision, and canonical
   semantics; a stale base revision returns a conflict.
7. Withdrawing chart-sync consent immediately blocks future v2 writes and
   removes the remote chart copy. Local charts remain untouched.
8. Account deletion is terminal and recoverable across response loss: an
   authenticated, recently reauthenticated prepare erases product data and
   creates a short-lived recovery receipt before an unauthenticated
   proof-bearing finish retries the Auth hard delete.
   Product data includes the tables added after the foundation migration:
   saved pages, Living Chart moments, consent and mutation receipts, the
   weekly digest delivery and unsubscribe rows, and the account's Sky Watch
   OAuth principals with their subscriptions and outbox rows (found by
   `oauth_user`, which has no Auth foreign key). A deletion still unfinished
   once its seven days pass with no live receipt is finished by the database
   retention pass, which deletes the Auth identity itself.
   Provider cleanup is a separate durable reconciliation step and cannot
   delay or roll back first-party erasure or Auth deletion.
9. Existing v1 charts are never copied to v2 automatically. The single v2
   chart requires a fresh selection and `self_declared_v1` attestation.
10. No private v2 table is directly available through the browser Data API.
11. Remote chart storage is accepted only for an adult self chart (18+ by UTC
    calendar date), which also refuses every chart of a child under 13.
    Local/account-free charts are not subject to this server gate.
12. The stored chart is used for exactly three things: showing it to its
    owner, the owner's compatibility invitations (decrypted during the
    owner's own request), and, only with the separate `chart_emails` consent,
    the daily chart email and the weekly digest (decrypted in the sending
    job). Nothing else reads it, and no plaintext projection is stored.

## Feature gates

Admission is open: any signed-in account may create v2 state. The server
keeps the per-request checks: `chart_sync` consent before any upload, the
`self_declared_v1` attestation, and the 18+ birth-date gate on `chart-put`.
The retired `ACCOUNT_SYNC_V2_CANARY_USER_IDS` allowlist is ignored.

The switches, all off unless set exactly:

- `ACCOUNT_SYNC_V2_API_ENABLED=1` (server) enables enrollment and ordinary
  sync operations on the server-only account API. It is the kill switch.
- `PUBLIC_ACCOUNT_SYNC_V2_ENABLED=1` (build time) ships the v2 client to every
  visitor of the deployment and suppresses the v1 sync client. The site is
  static, so the switch is global per deployment and needs a redeploy. The
  former second interlock, `PUBLIC_ACCOUNT_SYNC_V2_PREVIEW_ACK`, is retired
  and ignored.

`ACCOUNT_SYNC_V2_API_ENABLED` is a sync kill switch, not a privacy rights
switch. Same-origin export and deletion prepare/status/finish, withdrawal of
any consent (including `chart_emails`), and deletion of an existing remote
chart remain available when it is off, so rollback cannot strand a deletion
receipt or prevent an owner from exporting or erasing data.

`ACCOUNT_SYNC_V2_CLEANUP_SECRET` is a separate server/GitHub secret of 32 to 512
characters. It authenticates only `POST /api/account/cleanup-receipts`; the
endpoint runs one retention pass (`account_v2_run_retention`, at most 256 rows
of each kind): it finishes deletions past their seven days, then removes
expired receipts that are complete and expired provider leases. It answers 500
`retention_incomplete` when a deletion past its window is left unfinished. It
remains callable while the sync feature flags are off. Missing or mismatched
configuration returns a not-found response and performs no database call.
Production has no pg_cron (13 November 2026), so the hourly GitHub workflow
`account-deletion-receipt-cleanup.yml` is what runs the pass there; it fails
when its secret is missing. Where pg_cron is installed, the migration also
schedules the `account-v2-retention` job, which runs the same pass hourly
inside the database, and the workflow is the backup.

The email jobs (`.github/workflows/daily-email.yml` and `weekly-digest.yml`)
receive `ACCOUNT_SYNC_V2_ENCRYPTION_KEYS` and
`ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION` from their production environments'
secrets. They use them only to decrypt the charts of accounts that hold
`chart_emails` (see "Chart emails").

## Remote analytics

The access-controlled preview turned Plausible and Vercel Web Analytics off
on every page while the v2 client was built in. The reason, recorded with the
original change, was privacy: account-bound charts are browser-wide state, not
profile-page state, and the preview did not yet separate the pages that render
account data. That protection is kept, scoped to where account data is shown:
remote analytics never run on a `privateSurface` page, and the account, sync
and profile surfaces are private whenever the v2 client is on (the profile in
every locale, the auth callback; the chart tools that were already private
stay so). Every other page that reads the browser's saved charts, the living
chart or the account and can render them passes `accountSurface` to the
layout, which keeps both analytics loaders off there while the v2 client is
on. That covers the homepages (welcome back), the birth chart, Today,
transits, the daily sign horoscope (its saved chart line), moon and rising
sign, the pair pages, solar and lunar return, the return tools, Learn and the
Registry collection, in every locale where they exist.
`tests/analytics-account-surfaces.test.ts` finds these pages by following each
page's imports to the profile, living chart and account readers, and fails if
one keeps analytics. The walk stops at the shared layout: the navigation
avatar on every page shows one initial or a photo, never a chart, and is not
counted. Ordinary content pages keep the same privacy-scoped analytics they
had with the v1 client: canonical path only, no referrer, no query, no account
or chart data. The privacy policy describes the same split.

## Data planes

| Plane | Contents | Browser access | Retention |
| --- | --- | --- | --- |
| Identity | Supabase Auth user ID and provider identity | Auth SDK only | Until account deletion |
| Lifecycle and consent | Account state, current purpose grants, append-only decisions | Server API, owner only | Until account deletion |
| Private chart | One self-attested opaque envelope containing label, birth input, placements, and engine receipt | Server API, owner only; service-only sources for the owner's invitations and, with `chart_emails`, the email jobs | Until chart removal, consent withdrawal, or account deletion |
| Sync authority | Devices, revisions, idempotency keys, cursor changes, tombstones | Server API, owner only | Bounded; tombstones survive stale devices |
| Provider cleanup | Opaque encrypted email locators and request-bound deletion outbox payloads | Service-only RPCs; never returned by HTTP | Through the seven-day deletion receipt reconciliation window |
| Presentation | Not part of this phase | None | Not applicable |

The complete private chart uses service-managed envelope encryption. Each write
gets a fresh random 32-byte data-encryption key and 12-byte AES-256-GCM nonce.
The data key is independently wrapped with the active 32-byte server key. Both
AEAD operations bind their purpose, authenticated user ID, chart ID, and
server revision as associated data; the key wrap additionally binds the key
version. The database receives only ciphertext, nonces, the versioned wrapped
key, and `key_scope = 'service'`.

Server keys are supplied only through `ACCOUNT_SYNC_V2_ENCRYPTION_KEYS`, a JSON
keyring of canonical base64 32-byte keys, and
`ACCOUNT_SYNC_V2_ACTIVE_KEY_VERSION`. New writes use the active version while
reads may use retained older versions. An old key may not be retired until all
records using it have been re-encrypted or deleted;
`scripts/account-sync-v2-rewrap.ts` re-encrypts them and
`docs/ACCOUNT-SYNC-V2-KEY-ROTATION.md` gives the order of steps. Neither
variable may use a `PUBLIC_` prefix or enter a browser bundle.

The same versioned service keyring encrypts two additional minimal payloads,
with separate authenticated-data purposes from charts and from each other:

- A bootstrap alias locator contains only canonical `{ "email": "…" }` and
  binds `purpose=daily-sun-alias`, authenticated user ID, and opaque recipient
  hash. It lets deletion recover an address for each bounded alias without
  storing plaintext email.
- A deletion outbox payload contains the same minimal object but binds
  `purpose=deletion-provider`, deletion request UUID, and recipient hash. The
  database stores only its AES-256-GCM envelope. It cannot be moved to another
  request, alias, account, or AEAD purpose without authentication failure.

Data-key wrapping uses corresponding `*-key-wrap` purposes and binds the key
version. Missing keys or invalid envelopes fail closed for provider removal
and leave reconciliation required; they never expose an email or block core
account erasure.

Mutation receipts never store the browser's unsalted semantic SHA-256, which
would be an offline oracle for guessed birth details. The server instead HMACs
the canonical mutation preimage with a dedicated keyring from
`ACCOUNT_SYNC_V2_FINGERPRINT_KEYS` and
`ACCOUNT_SYNC_V2_ACTIVE_FINGERPRINT_KEY_VERSION`. The database stores only the
active `version:lowercase-hex` verifier and accepts candidates produced with
retained versions during rotation. Deletion recovery proofs are verified the
same way, so a retired fingerprint version must stay in the keyring for at
least seven days after the active version changes, or an open deletion
receipt cannot be verified. These keys are separate from the chart
encryption keys and never enter the database or browser.

The HTTP boundary is `/api/account/:action`. `bootstrap`, `consent`,
`chart-put`, `chart-delete`, `pull`, and `chart-get` are same-origin POSTs with
bounded exact JSON bodies and a Supabase bearer token. The server validates the
token, derives the user ID, and then calls service-only RPCs; no request body
may name an owner. `chart-get` decrypts on the server and omits ciphertext,
nonces, wrapped keys, and key versions from its owner response.

`delete-prepare` is also authenticated and requires an authentication method
used within five minutes. `delete-status` and `delete-finish` are same-origin
POSTs that require a request UUID plus a canonical client-generated 32-byte
base64url recovery secret, but not a bearer token after Auth deletion. Only a
server HMAC verifier is stored. Receipts expire after seven days; neither the
secret nor service-only user ID is returned to the browser. The legacy
single-step `delete` action is not routed.
An expired receipt is removed only once its deletion is complete. When an
account has been deleting for seven days and holds no live receipt, the
hourly retention pass repeats the terminal cleanup, deletes the Auth
identity in SQL, marks the receipts complete, and only then removes them with
their provider outbox rows. The pass locks the Auth row before anything else,
the order the weekly digest transitions use.
The database serializes rotation under the existing recipient/account lock
order and permits at most three live receipts per account. Rotation prunes
that account's expired receipts only where they are complete or the account
is no longer deleting; an expired, incomplete receipt of a deleting account
stays, with its provider outbox rows, until the retention pass has finished
the deletion. Such a kept receipt counts as absent: it is outside the cap,
and a prepare that names its request ID again gives it a fresh seven day
window in place. A fourth fresh request returns `receipt_limit_reached`;
exact receipt replay remains idempotent. The assistant save RPC takes the
account owner lock before it replaces a saved row, so a save and a prepare
for the same account wait in one order.
Each receipt also persists `daily_sun_revoked` and
`daily_sun_reconciliation_required`, so status and finish retries preserve the
same cleanup truth after a lost response. Reconciliation is informational and
never blocks core account erasure.

Deletion prepare atomically creates the receipt, erases first-party data,
revokes database email authority, and stages one non-cascading provider-outbox
row per known alias. Immediately before each Admin Auth deletion attempt, a
service-only terminal cleanup RPC reasserts the terminal database state and
stages any newly observed aliases. No provider network call occurs between
that RPC and Auth deletion.

After Auth deletion and receipt completion, `delete-finish` performs a bounded
best-effort outbox drain. It decrypts one request-bound payload at a time,
calls the existing Resend segment-removal path with a per-attempt timeout, and
records success only after the provider confirms the idempotent removal.
Failure or timeout remains pending and truthful in the receipt. Retrying the
same finish proof resumes the outbox even after Auth is gone or a prior HTTP
response was lost. The browser retains that proof while reconciliation is
pending; status never returns encrypted locators, cleanup payloads, emails, or
the service-only user ID.

Every confirmed Daily Sun provider add first acquires a five-minute
service-only database lease bound to recipient hash and
`confirmed_by_attempt_id`. Provider cleanup rechecks that lease under the same
recipient advisory lock before acknowledging removal. An active lease leaves
the outbox pending; an expired lease can be pruned and retried. In the other
direction, listing provider work creates a 30-second claim. A confirmation
provider add cannot begin while that claim is active, and a failed/ambiguous
removal retains the claim until expiry; successful acknowledgement clears it.
If a newer committed preference generation exists after this deletion revoked
its bound generation, the old outbox becomes `superseded` and is never sent to
the provider again. An unconfirmed request or cooldown is not consent and
cannot suppress removal of the deleted owner's provider subscription.

Bootstrap snapshots the current Daily Sun `confirmed_by_attempt_id` on each
opaque alias. The verified current address is fenced during initial prepare;
a historical alias is revoked only when its stored generation still matches,
or when no committed preference exists. This makes email recycling and later
consent generations take precedence over an old account receipt without
letting an unconfirmed opt-in request block a privacy cleanup.

The provider inventory is capped at 16 entries per deletion attempt. The
current verified email is always prioritized ahead of historical aliases. An
explicit, monotonic `inventory complete` bit becomes false if alias listing,
decryption, re-encryption, or the cap loses any candidate; reconciliation can
then never be reported complete for that receipt. Overflow never blocks core
erasure.

## Consent purposes

Purposes are narrowly defined. Each has its own policy version, is off until
granted, and can be withdrawn by its owner at any time:

- `chart_sync` (`chart-sync-2026-08-12.v1`): store one selected self chart for
  recovery and cross-device access.
- `chart_emails` (`chart-emails-2026-11-11.v1`), shown as "Use my chart for my
  emails": let the daily chart email and the weekly digest use the synced
  chart. It has no effect without `chart_sync` and a synced chart.
- `weekly_digest`, `daily_chart_email`, `compatibility_invites`: reserved in
  the schema, not used by the launch. The weekly digest subscription remains
  `profiles.digest_opt_in`; the daily chart email subscription remains the
  double opt-in `daily_chart_preferences` row; an invitation keeps its own
  per-invitation consent.

Later purposes such as AI memory or public presentation require new consent
copy and may not reuse `chart_sync` or `chart_emails`.

An account with no consent row is treated as pending, never granted. Consent
events are immutable and current state is derived or updated transactionally.
Only `chart_sync` decisions are written to the purpose-less sync change feed,
which clients read as `chart_sync`; other devices learn the `chart_emails`
state from bootstrap.

## Chart emails

Granting `chart_emails` changes no subscription. It lets emails a person
already chose use their synced chart:

- Daily chart email. A person who holds `chart_emails` and a synced self
  chart can ask for the daily chart email from the profile. The existing
  double opt-in stores a confirmed `daily_chart_preferences` row whose
  `chart_id` is the v2 chart id (the FK to `public.charts` is dropped). The
  hourly job reads confirmed rows and, for each account, immediately before
  decrypting, calls the service-only `account_v2_chart_email_sources` for
  that one account. It receives an envelope only for an account that is
  active and holds both `chart_sync` and `chart_emails` at that moment, and
  uses it only when the self chart is the chart the preference names (a
  preference that still names a removed chart A after chart B was synced
  stays paused). It decrypts in memory, renders the chart edition, and keeps
  nothing. Before dispatch, and again inside the provider queue after its
  pacing wait and after every 429 backoff, immediately before each POST
  attempt, it asks for the exact chart id and revision it decrypted; if the
  account is no longer eligible, no further POST is made, the reservation is
  released unsent (any earlier attempt was an explicit 429, so nothing was
  accepted) and the address gets the Sun edition when it is a confirmed Daily
  Sun subscriber due in that run, or nothing. A
  chart that cannot be decrypted falls back to the Sun edition for that
  person. Everyone else, including preferences paused when v1 sync was
  retired, gets the Sun edition only if they are a confirmed Daily Sun
  subscriber; nothing new is stored about them. Delivery logs name a
  recipient only by a 12 character prefix of its keyed recipient hash.
- Weekly digest. `profiles.digest_opt_in` still decides who gets any digest.
  With the v2 client on, the profile's account panel shows the same opt in
  and opt out ("Send me the Monday digest") whenever
  `PUBLIC_WEEKLY_DIGEST_ENABLED=1`, the condition the earlier checkbox used.
  `weekly_digest_content_v1` returns the address and, only for an opted-in
  account, the chart id and revision. The job decrypts that chart only after
  a fresh read for that account, immediately before decryption, still shows
  the same id and revision, and sends the chart edition; everyone else gets
  the sky edition (the week's published events). Because the chart reference
  is part of the content digest, the authorization recheck immediately before
  dispatch refuses an envelope whose consent or chart moved; the job then
  reads the content again and, if it is now the sky edition, rebuilds and
  sends that. Authorization comes before the provider queue, which can wait
  for pacing and retry explicit 429 responses, so a chart edition is checked
  again after each of those waits, immediately before every POST attempt,
  with the service-only `weekly_digest_dispatch_recheck_v1` (migration
  `20261111180000`): it recomputes the opt-in, the unsubscribe marker and the
  content digest under the same locks. If anything moved, no further POST is
  made; the delivery returns to reserved under the same lease with its sealed
  envelope dropped, and the job rebuilds it from current content (the sky
  edition) once, or cancels it. The job tells a definitive provider
  rejection from an ambiguous outcome. An explicit 4xx other than 408 and
  409, an exhausted run of 429s included, means nothing was accepted under
  the request; for a chart edition (and when its recheck cannot be read) the
  job releases the delivery with the service-only
  `weekly_digest_release_rejected_v1` (migration `20261111190000`) before it
  stops the batch, so it is rebuilt rather than replayed. The delivery
  returns to reserved under the same lease with its sealed envelope dropped;
  the next run that may create deliveries prunes the stale reservation and
  builds the digest again from current content through the path above,
  checked before every POST, so an account that withdrew chart emails in the
  meantime gets the sky edition or nothing. A delivery still in dispatching
  (an ambiguous dispatch: transport failure, timeout, 5xx, 408, 409, a
  malformed success; or a release that could not be written, logged as
  `release=failed`) is replayed byte for byte under the provider idempotency
  key within 24 hours. Unchecked replay is denied by default: it would be
  safe only with a durable record that a POST of that exact envelope was
  sent with an unknown outcome, and the job keeps no such record (a
  delivery in dispatching may never have been sent). So every attempt of a
  replay, the first included, is rechecked immediately before its POST like
  a new chart edition; a replay whose content moved is quarantined for
  reconciliation and never resent, a recheck that cannot be read sends
  nothing, and a replay is never released. A chart edition released after
  the last Monday creation run is not sent that week.

Withdrawing `chart_emails`, withdrawing `chart_sync`, removing the synced
chart, or starting account deletion removes the account from
`account_v2_chart_email_sources` immediately. Job logs carry counts only:
never a birth detail, a chart label or an address from this path.

## Compatibility invitations

An invitation is created from the owner's one synced self chart. During the
owner's own authenticated request the server reads it with the service-only
`account_v2_owner_self_chart(user_id)` (active account, `chart_sync`
granted), checks that its id is the one the owner chose, decrypts it in
memory, re-applies the 18+ gate, and resolves the instant with the bundled
local-time resolver. The existing derivation keeps a bounded label and
whole-degree positions; the birth date, time and place are never stored with
the invitation, logged or put in a URL. The invitee's side and both consents
are unchanged.

## Retirement of v1 cloud charts

v1 chart writes are blocked by restrictive RLS (20261111140000). Since
20261111170000 nothing in the launched code path reads `public.charts`:
bootstrap no longer checks it, the v1 browser sync client is suppressed when
the public switch is on, the email jobs and invitations use the v2 chart, and
`daily_chart_preferences` no longer has a foreign key to it. v1 charts are
never copied into v2. The operator then deletes the remaining v1 rows; until
then, and afterwards on an empty table, the owner-scoped export and account
deletion still include and erase them.

## Local account hand-off

The account-v2 namespace stores only a random per-account device ID and
account-scoped sync metadata. It does not reuse a global installation ID
across accounts. Existing local-only charts remain in the
site's local profile store; account-v2 metadata never duplicates their birth
inputs, email address, or bearer token.

When the authenticated account differs from the stored owner, the client must
stop before synchronization. Data already bound to the previous account may
only stay isolated, be cleared from the browser, or cancel the hand-off; it is
never offered for import into the new account. Only charts that have always
been account-free may be selected for a new account after an explicit preview.

Account-v2 starts private profile access locked. A tab may read or write the
five account-bound local profile surfaces only while it holds a tab-lifetime
shared Web Lock and its session grant still matches the stored owner. Every
owner-changing action first revokes all same- and cross-tab grants, waits for
their shared leases to release, and then performs the checked transition under
the exclusive lock. Missing or failed Web Locks/storage fail closed. Async work
that captured a chart, pair, session, or derived reading also carries a
tab-local access generation; a revocation scrubs rendered copies and prevents
late completions from writing, sending, or repainting prior-owner data.

An involuntary missing/error session only locks and unmounts account-owned
local data. Signed-out access is granted solely after the explicit keep-on-this-
device choice records a matching retained-owner marker. Reauthentication
relocks that marker before restoring account access.

Sign-out separately asks whether to keep charts on this browser or remove all
Zodiacs data from it. Sign-out uses a local session scope so signing out of
one browser does not silently revoke sessions on other devices. A deliberate
"sign out everywhere" control is a later account-security enhancement.

## Conflict and deletion behavior

- Updates include a client-generated mutation ID and the last server revision.
- Replaying a mutation ID returns its original result.
- Reusing that ID for another operation, base revision, or semantic payload
  returns `mutation_conflict`; PUT and DELETE never share an ID.
- Two writes from one base revision produce one winner and one conflict.
- Birth fields are never merged independently. A conflict preserves a complete
  chart version for an explicit user choice.
- A deletion creates server authority that prevents an offline device from
  recreating the chart.
- Pull drains all bounded upstream pages and collapses them to the latest
  operation per entity before returning. A new device therefore observes a
  create-then-delete as a delete and is not stranded by a stale upsert.
- Consent withdrawal outranks concurrent chart writes and deletes the remote
  source and derived copy in one transaction.
- A second active chart receives the stable `chart_limit_reached` outcome. A
  tombstoned chart is not active, so the owner may deliberately select one
  replacement while the old tombstone still defeats stale devices.
- Bootstrap binds the authenticated account's lowercase HMAC-SHA256 recipient
  hash to its encrypted locator. Private account state retains at most 16
  aliases across email changes or HMAC-key rotation. Prepare and terminal
  cleanup revoke the verified current address plus historical aliases whose
  stored consent generation still matches; later/recycled authority is marked
  superseded and retained. Request-bound encrypted provider work lives on the
  non-cascading seven-day receipt. Missing locators, unavailable encryption or
  provider credentials, timeouts, and provider failures keep
  `daily_sun_reconciliation_required=true`; they never block account erasure.
  Receipt status is refreshed after each provider attempt and survives Auth
  deletion and lost responses.

## Staged cutover

1. Apply and verify the additive private schema with both feature gates off
   (done: 20260811153303).
2. Stop v1 writes (done: 20261111140000).
3. Apply 20261111170000 (chart_emails, chart sources, no reader of
   `public.charts`).
4. Turn on `ACCOUNT_SYNC_V2_API_ENABLED=1` and
   `PUBLIC_ACCOUNT_SYNC_V2_ENABLED=1`, and redeploy.
5. Delete the remaining v1 rows. Owner export and deletion tolerate the empty
   table.

Long-lived dual writes are not allowed because they preserve the sensitive
fused payload and create two competing authorities.

## Approved decisions

- Label, raw birth input, placements, and engine receipt use the single
  service-managed AES-256-GCM envelope described above. Keys remain outside
  the database and client.
- Sync is self-chart-only and limited to one active chart per account.
- No legacy chart is auto-migrated; every v2 chart starts with an explicit
  selection and self attestation.
- Account deletion uses prepare/status/finish recovery receipts. A fresh
  authenticated prepare may issue another request UUID and recovery secret
  while the Auth identity still exists, so loss of one browser capability does
  not strand an account already in deleting state. Existing receipts remain
  valid until their seven-day expiry, with at most three live receipts at once.
  An account in deleting state refuses writes to every owner table, including
  saved pages, Living Chart and Sky Watch OAuth principals, and the retention
  pass finishes it once its seven days pass without a live receipt. Once the
  Auth identity is gone, Sky Watch refuses any new principal for it, so no
  principal can outlive the account it names.

The approved export is a versioned JSON owner export containing an
allowlisted decrypted private-chart representation plus the opaque service
envelopes for completeness. Any decryption, schema, or revision mismatch fails
the complete export rather than silently omitting data. It also decrypts each
available historical Daily Sun alias locator into an allowlisted email and
binding timestamps; recipient HMACs are omitted. A legacy alias without a
locator is represented explicitly as unavailable rather than silently omitted,
while an invalid non-null locator fails the export closed. The export also
lists the account's saved pages (with each assistant save's summary and
detail) and its Living Chart moments, allowlisted column by column with no
owner id. `src/lib/account-api/export-shapes.ts` mirrors the tables' check
constraints, including the moment payload's nested forecast and the assistant
detail's schema name, and a row outside them fails the export closed. Its one
departure: the export also refuses an assistant detail without a schema name,
which `saved_pages_assistant_detail` lets through because the comparison is
NULL. The cases in `export-shapes.cases.ts` record each answer the database
gives.
