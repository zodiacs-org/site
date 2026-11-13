# Supabase Account Sync

This documents the live account-sync provisioning for Zodiacs.org saved charts.

## Live Project

- Supabase project: `Zodiacs.org`
- Project ref: `mftpcdpttteuwbolobye`
- API URL: `https://mftpcdpttteuwbolobye.supabase.co`
- Region: `ap-northeast-1` (Northeast Asia / Tokyo)
- Frontend key type: modern publishable key (`sb_publishable_...`)

Do not commit publishable keys, secret keys, service-role keys, SQL connection
strings, or mailbox transcripts to this file. The publishable key is safe for a
browser bundle only because all sync tables have RLS enabled and owner policies.

## Applied Migrations

The existing repo migrations were run against the live project on 2026-07-07:

- `supabase/migrations/20260706000000_profile_sync.sql`
- `supabase/migrations/20260706130517_chart_deletions.sql`

The SQL is idempotent and was run from the Supabase SQL Editor in the
admin browser session.

## Auth Configuration

Authentication is magic-link email. Google and Apple sign-in are built but
hidden behind `PUBLIC_AUTH_GOOGLE` / `PUBLIC_AUTH_APPLE` (both off); setting
them up, and the `/auth/callback/**` redirect URLs they need, is in
`docs/platform/accounts/PROVIDER_SETUP.md`.

Current URL configuration observed in Supabase:

- Site URL: `https://zodiacs.org`
- Redirect URLs:
  - `https://zodiacs.org/profile/`
  - `https://*.vercel.app/profile/`
  - `http://localhost:4321/profile/`
  - `http://127.0.0.1:4321/profile/`

The frontend sends magic links with `emailRedirectTo` set to
`window.location.origin + '/profile/'`, so the production site, Vercel previews,
and local dev URLs must stay in the allow-list.

## Vercel Environment Variables

Project: `zodiacsofficial/zodiacs-org`

Production was verified to contain:

- `PUBLIC_SUPABASE_URL`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Production values were checked against the live Supabase project on 2026-07-07:

- `PUBLIC_SUPABASE_URL` matched `https://mftpcdpttteuwbolobye.supabase.co`
- `PUBLIC_SUPABASE_PUBLISHABLE_KEY` existed and had the `sb_publishable_` shape
- No `PUBLIC_SUPABASE_ANON_KEY` was required

Production was redeployed after verification:

- Deployment: `https://zodiacs-8o4gyyqo1-zodiacsofficial.vercel.app`
- Alias: `https://zodiacs.org`

Vercel also has Development values and a historical branch-scoped Preview value
for `claude/zodiacs-org-strategy-hevw5u`. The CLI rejected adding another
general Preview value because the variable already exists in Vercel's environment
store. If a future preview cannot sync, check Vercel's Environment Variables UI
and add unscoped Preview values for the two public Supabase envs.

## Verification Transcript

Schema/RLS verification in the live Supabase SQL Editor returned:

| check_name | table_exists | rls_enabled | policy_count |
| --- | ---: | --- | ---: |
| `profiles` | 1 | `true` | 4 |
| `charts` | 1 | `true` | 4 |
| `chart_deletions` | 1 | `true` | 4 |

The same migration was also applied and inspected through the Supabase connector
on a zero-cost unused project (`wlzzboekuffmagakvxaq`) before the already-open
admin browser project was discovered. That project is not wired to Vercel or
production.

Connector security advisor result on the schema:

```text
security lints: []
```

Connector performance advisor result on the fresh schema:

```text
INFO unused_index: public.charts.charts_user_updated_idx has not been used
INFO unused_index: public.chart_deletions.chart_deletions_user_deleted_idx has not been used
```

This is expected immediately after provisioning, before real sync traffic.

Anonymous REST probes against the live Production envs:

```text
GET /rest/v1/charts?select=id&limit=1
status: 401
body: {"code":"42501","message":"permission denied for table charts",...}
```

```text
POST /rest/v1/charts with forged user_id
status: 401
body: {"code":"42501","message":"permission denied for table charts",...}
```

The original QA target said anonymous select should return zero rows. The live
schema is stricter: `anon` has no table privileges, so unauthenticated reads and
forged inserts are denied before row filtering.

Source security scan:

```text
No service-role key, secret Supabase key, or backend secret was found in source.
Only public env names appear in client code:
PUBLIC_SUPABASE_URL
PUBLIC_SUPABASE_PUBLISHABLE_KEY
PUBLIC_SUPABASE_ANON_KEY
```

Live page checks:

- `/profile/` renders the signed-out saved-charts UI with magic-link email copy.
- `/birth-chart/` does not load the profile manager island.
- Calculator copy was tightened so account-sync language stays on `/profile/`
  and methodology surfaces, not inside the calculator UI.

## Key Rotation

If the publishable key is rotated:

1. Create or rotate the publishable key in Supabase API Keys.
2. Update Vercel Production, Preview, and Development values for
   `PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Redeploy Production.
4. Verify `/profile/` signed-out UI loads and anonymous REST probes still fail.

Do not add a service-role key to Vercel for the browser sync path.

## Production Account-Sync Acceptance

The real mailbox and two-device acceptance was completed on 2026-07-23 against
production SHA `ad91e7ebb2987067e9b7258224fa94bf7702cc45`, using only the
approved `admin@zodiacs.org` account:

- A clean signed-out browser saved a temporary chart locally before sign-in.
- The first magic link was requested at `2026-07-23T14:33:46.020Z`, arrived in
  the approved mailbox, completed the `/profile/` round trip, and uploaded the
  local chart.
- A second clean browser began with zero local charts. Its magic link was
  requested at `2026-07-23T14:36:55.246Z`; after sign-in, the uploaded chart
  restored from the account.
- Renaming the temporary chart in the first browser and syncing the second
  reproduced the new name there.
- Deleting it in the second browser and syncing the first removed it there.
  The temporary chart was removed from both local contexts and the account.
- After signing out, the first browser saved and removed a second temporary
  local-only chart successfully.
- Both browser contexts completed without page or console errors. No address
  other than the approved admin mailbox was used, and the existing canary chart
  was not changed.

## Since this was written (2026-07-14 addendum)

Two more Supabase surfaces were added after the provisioning above:

- **Assistant quota** (`api/assistant.ts`): the `assistant_quota` table and
  `assistant_quota_bump` definer function — the SQL and its security notes
  live in PR #77's description. Applied during the assistant's preview
  verification.
- **Push subscriptions** (`api/push/subscribe.ts`): the `push_subscriptions`
  table from the push setup packet. Preview-scoped until the push launch
  flip.

Keep this file's rule: no keys, no connection strings, ever.

## Live-state reconciliation (read-only, last checked 2026-08-27)

Read-only inspection of the live project (pg_class/pg_proc/columns plus
`supabase_migrations.schema_migrations`) reconciled which of the repo's
15 migration files are actually applied in production:

| Migration file | Live? | Evidence |
| --- | --- | --- |
| `20260706000000_profile_sync` | yes | `profiles`, `charts` tables |
| `20260706130517_chart_deletions` | yes | `chart_deletions` table |
| `20260707125552_weekly_digest_opt_in` | yes | `profiles.digest_opt_in` column |
| `20260720074516_phase3_habit_layer` | yes | push/daily tables + phase-3 functions |
| `20260720145526_phase3_delivery_guards` | yes | delivery-claim tables + claim functions |
| `20260724003109_phase4_compat_invites` | yes | `compatibility_*` tables + invite RPCs |
| `20260727050000_phase6_assistant_quota` | yes | `assistant_quota` + `assistant_quota_bump` |
| `20260727180000_phase6_assistant_global_ceiling` | yes | `assistant_quota_bump_v2` |
| `20260811153303_account_sync_v2_foundation` | **no** | no private schema exists |
| `20260813102035_guide_atomic_quota_reservation` | yes | `guide_quota_reserve_v1` + receipts table |
| `20260814062255_guide_quota_legacy_shape_repair` | presumed | data-shape repair; not distinguishable by object inspection, applied in the same operator batch as the reservation migration |
| `20260817080000_zodiac_games` | yes | all four tables + three `zodiac_games_*_v1` RPCs; also the ONLY entry in `supabase_migrations.schema_migrations` (recorded there as version `20260819050930`, name `zodiac_games`) |
| `20260818112526_living_chart_sync` | **no** | no living-chart tables exist |
| `20260819111145_living_chart_rls_initplan` | **no** | follow-up to the above; n/a until it lands |
| `20260827090000_weekly_digest_unsubscribe_capability` | **no** | PR-only least-privilege unsubscribe capability; do not apply without separate owner authorization |

So Account Sync v2 and Living Chart sync are genuinely unreleased at the
database layer, exactly as their contracts require, and everything the
live serverless functions call exists. Going forward, apply migrations
through a path that records them in `supabase_migrations` (Supabase CLI
`migration up`, or the connector's apply_migration) instead of the SQL
Editor, and update this table in the same change.

## Operational decisions still owed (tracked 2026-08-24)

- **Leaked-password protection is OFF** (live security advisor WARN).
  Auth is magic-link-only today so nothing is exposed. The toggle
  (Dashboard → Authentication → Sign In / Up → password security) is a
  **Pro Plan and above** feature per Supabase's docs — not free as an
  earlier revision of this note said — and must be ON before any
  password auth method ever ships; the native-app work makes that
  likely. Until then the WARN is accepted.
- **Backups: workflow and acceptance wrapper shipped; owner setup remains.**
  `.github/workflows/db-backup.yml` fails visibly until the owner provisions
  `SUPABASE_DB_URL` and a one-line, control-free, 32–1024-byte
  `BACKUP_PASSPHRASE` in the exact-`main`
  `database-backup-production` GitHub environment; repository- and
  organization-level Actions secrets must remain empty. A green run must
  contain exactly one nonempty encrypted artifact. It uses PostgreSQL
  17 and one exported repeatable-read snapshot for
  `public`, the complete `supabase_migrations` ledger, `auth.users`, and
  `auth.identities`. If later authorized migrations create `private` or
  `living_chart_private`, schema discovery automatically adds them to that same
  dump. Owners and GRANT/REVOKE ACLs remain intact. The workflow generates
  ordered SQL, records content digests without plaintext source rows, then uses
  GnuPG loopback pinentry with a protected passphrase descriptor. Neither the
  database URL nor the passphrase is a process argument.

  A decrypt check is not a restore drill. After a separately authorized owner
  creates a fresh throwaway Supabase project, use only:

  ```sh
  bash scripts/restore-db-backup.sh /absolute/path/to/zodiacs-db-....tar.gz.gpg
  ```

  The path is the only argument. The wrapper prompts invisibly for both
  protected values, rejects the current production project ref, verifies the
  fresh target has no application rows, has no residual Auth state outside the
  managed `instances`, `schema_migrations`, `users`, and `identities`
  relations, and has never had its migration ledger initialized. It requires
  `RESTORE` before changing anything. Do not run
  `supabase db push` first: `supabase_migrations` must be absent and is created
  transactionally from the source. The managed Auth column contract is checked
  before any mutation. Auth users and identities restore before
  application data. The remaining generated
  sections and acceptance checks run under `psql -X`, `ON_ERROR_STOP=1`, and a
  single transaction, so any mismatch rolls back. Acceptance compares every
  manifest record, row count, application-content digest, sequence definition
  and state, Auth
  linkage, application foreign-key orphan, validated constraint, RLS/policy,
  owner/ACL and SECURITY DEFINER state, and
  effective `anon`/`authenticated`/`service_role` privilege. The owner must then prove a
  restored account reauthenticates and sees only its own data in the application.

  Prerequisites are PostgreSQL 17 client tools, GnuPG with loopback pinentry,
  Node.js, and GNU tar (`gtar` on macOS; BSD tar is rejected). The interim
  contract remains: weekly RPO (up to seven
  days after a successful run, longer after failures), 90-day GitHub artifact
  retention, publicly downloadable ciphertext with the passphrase as its only
  confidentiality boundary, excluded sessions/refresh/audit and short-lived
  OAuth-flow rows and therefore expected reauthentication, and
  fresh-project-first restores only. Detected durable MFA, passkey, SSO, SAML,
  OAuth-client, OAuth-consent, or custom-OAuth rows make export fail until their
  ordered recovery boundary is implemented. Keep the target traffic-disabled:
  the atomic restore repeats the destructive guard and holds exclusive locks on
  managed Auth tables, while a generated replay section preserves the source
  `public` schema ACL that `pg_dump` otherwise omits.
  If production ever moves to a different Supabase project, update and review
  the wrapper's explicit production-project guard before the next drill.
- **Key escrow.** When `ACCOUNT_SYNC_V2_ENCRYPTION_KEYS` is provisioned,
  record where the keyring is escrowed (outside Vercel env) — losing the
  wrapping keys silently bricks every v2 envelope, and no runbook covers
  rotation-under-loss.
- **Unused-index cleanup** (live performance advisor, 7 INFO entries) can
  wait for real traffic before pruning.
