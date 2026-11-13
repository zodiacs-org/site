# Living Chart cloud sync boundary

Living Chart sync is a convenience-first, opt-in feature on the site's existing
Supabase Auth and Data API foundation. It is intentionally independent of the
unreleased Account Sync v2 migration.

## What the privacy boundary does

- The browser uses the existing Supabase publishable key and the signed-in
  account's JWT. No service-role credential is shipped to the browser.
- `public.living_chart_sync_consents` and `public.living_chart_moments` have RLS
  enabled and explicit least-privilege grants. A signed-in account can select
  only its own consent and only rows from its currently granted consent epoch.
- Inserts, updates, and deletes are not granted on either table. Replay-safe
  public `SECURITY INVOKER` RPCs call a narrowly scoped implementation in the
  unexposed `living_chart_private` schema.
- Consent is separate from chart sync and uses purpose `living_chart_sync` and
  policy `living-chart-sync-2026-08-18.v1`.
- Withdrawal and remote-row erasure happen in one database transaction. It
  advances `consent_epoch`, clears all moment rows plus put/delete receipts,
  and prevents an old tab or offline queue from restoring withdrawn data.
- Auth user deletion cascades through consent, moments, and mutation receipts.
  Account deletion prepare erases them earlier, and while an account is
  deleting the RPC wrappers answer `temporarily_disabled` and the account
  terminal trigger refuses direct writes (migration 20261113090000).
  The paginated owner snapshot is also the cloud export surface; the account
  JSON export lists the same moments.

## Explicit tradeoff

Moment payloads are ordinary JSON stored in Supabase Postgres. They benefit from
Supabase's platform encryption at rest and owner-only RLS, but they are **not
end-to-end encrypted** and are **not opaque to Zodiacs/Supabase operators**.
Product copy must not claim otherwise. This is the deliberate Phase 7 tradeoff:
low-friction multi-device continuity over a local-only or user-key-managed
cryptographic workflow.

## Retention and conflict behavior

- Up to 250 active cloud moments are allowed per active consent epoch. The
  epoch also has a lifetime ceiling of 1,000 distinct moment IDs, including
  payload-free tombstones.
- Regular deletion replaces the payload with a tombstone. Tombstones are not
  age-pruned while the consent epoch remains active, so a delayed base-zero
  create cannot resurrect a deleted moment after its replay receipt expires.
  Withdrawal erases the epoch and a later grant starts a fresh budget.
- A delete with base revision zero creates a revision-one tombstone when the
  row is missing and may delete an active revision-one row after a lost create
  acknowledgement. For later revisions, normal optimistic concurrency applies.
- At most 512 replay receipts are retained per account. Consent receipts are
  retained across consent transitions (subject to that bound); withdrawal
  removes put/delete receipts and all moment rows before recording its receipt.
- Snapshot/export is cursor-paginated by `moment_id`, at 50 rows per response.
  Clients send the returned `next_after` cursor until `has_more` is false.

## Operational rollback control

`living_chart_private.living_chart_runtime_settings` is a service-role-only,
single-row control. Setting `new_writes_enabled = false` stops new grants and
puts with a retryable `temporarily_disabled` result. Reads, snapshots,
withdrawals, and deletes remain available. Disabled attempts are not added to
the mutation ledger, so the same queued mutation can succeed after re-enable.

## Release gate

Apply `20260818112526_living_chart_sync.sql` and its ordered
`20260819111145_living_chart_rls_initplan.sql` follow-up through the reviewed
Supabase migration process before enabling public Living Chart sync. The
migrations are replay-safe, but they must not be pasted into production without
the SQL privacy and concurrency gate in
`scripts/test-living-chart-sync-sql.sh` passing.
