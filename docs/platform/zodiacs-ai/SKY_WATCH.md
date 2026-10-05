# Sky Watch — next implementation

Status: design only; no event capability, subscription or delivery is enabled.
The present MCP endpoint is anonymous and stateless. A calendar query does not
create monitoring, and this document is not a delivery receipt.

## Platform boundary

OpenAI's [MCP Events guide](https://developers.openai.com/plugins/build/mcp-events),
checked 2026-10-06, requires MCP 2.0 (`2026-07-28`), authenticated subscription
methods, persistent state and outbound webhook delivery. Events are supported
in Work web chats, desktop Work with Cloud, and dots. Implement discovery,
list, subscribe and unsubscribe before advertising events. Verify callbacks,
sign deliveries, retain subscription ownership and expiration, refresh state,
and handle retries. These requirements exceed the current adapter's contract.

## Zodiacs service design

The first service should watch public sky events only. Proposed event families:
`zodiacs.sky.ingress`, `zodiacs.sky.station` and `zodiacs.sky.lunation`. Reuse the
existing engine-backed event search and its receipts; require explicit filters
for bodies and, for lunations, phase. No birth data or personal predictions enter
subscriptions. Label astronomical occurrence times as computed instants.

Use one version-pinned event ledger shared across subscriptions. A scheduler
fills a rolling horizon in bounded search windows; a refused or exhausted search
must not mark a window complete. Store the calculation version and receipt with
each event. Delivery starts when an occurrence is due, with UTC as the canonical
time and the subscriber's chosen zone for display only.

Persist subscriptions, verified callback destinations, encrypted signing keys,
filters, expiration, event cursors and delivery attempts. Bind each subscription
to an authenticated principal and give it a finite default lifetime. Derive its
identity from the principal, destination and canonical filters. A principal can
refresh or remove only its own subscriptions. Disconnect/revocation stops
delivery. Repeated unsubscribe calls remain successful.

Use a durable outbox with a uniqueness constraint on subscription and event.
Claim due rows transactionally with a lease. Retries retain the event ID and
stop on permanent receiver rejection, expiry or revocation; transient errors
use bounded backoff. A failed worker must release work through lease expiry.
Engine upgrades need an explicit ledger migration policy to avoid duplicate
notifications for the same occurrence.

The callback client must validate HTTPS destinations at connection time, pin
the validated public address for that connection, preserve TLS hostname checks
and reject redirects. Apply the same policy to callback verification and event
delivery. Keep keys, callback URLs, request bodies and precise subscription
filters out of application logs. Store only operational status and counts in
observability records.

## Implementation sequence and acceptance

1. Add an authenticated, backward-compatible MCP 2.0 transport and synthetic
   protocol tests. Keep existing calendar and chart entrypoints working.
2. Add the durable store, ownership policy, encrypted secrets, migrations and
   expiry/disconnect cleanup in staging.
3. Implement callback verification, safe delivery, outbox leases, idempotency,
   refresh/rotation and unsubscribe. Test with controlled synthetic receivers.
4. Add scheduler ingestion from the existing event calculation contract.
   Exercise refused searches, restarts, missed scheduler intervals, concurrency
   and version changes without skipping or duplicating due events.
5. Verify actual subscription, receipt and unsubscribe in a ChatGPT Work/Cloud
   chat. Check mismatched filters, invalid signatures, expired access and
   receiver errors. Record host evidence before upgrading plugin metadata.

No production migration, authentication expansion or notification delivery is
part of the 0.3.0 Chart Studio candidate. Production enablement and directory
submission retain the existing owner approval and release gates.
