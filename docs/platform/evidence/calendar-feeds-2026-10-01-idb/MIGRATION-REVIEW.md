# Calendar production migration — prepared for later review

**Status: unapplied.** This document prepares one concrete additive schema action. It does not authorize its execution, deployment, a retention sweep or a live feed. Calendar acceptance is unchanged.

## Target and current evidence

- Project: `mftpcdpttteuwbolobye`, **Zodiacs.org**, Tokyo / `ap-northeast-1`, ACTIVE_HEALTHY
- Database: `postgres`, PostgreSQL 17.6; project engine version 17.6.1.141
- Observation: `2026-10-01T11:24:01Z`, collected by the programme coordinator through the refreshed Supabase connector
- Exact metadata export: `supabase-production-metadata.json`, SHA-256 `b9798edbe2cd18f735f53ca28543c833479d48d0ab00e85ab4f9984b30d8c968`
- Existing migration IDs returned: `20260819050930`, `20260831190940`
- `public.calendar_feeds`, the ten named calendar functions and migration version `20260929180000` are absent. No application rows or function bodies were read
- SQL role `postgres` describes the database session. The account organization-role label is unavailable; no account administrator role is inferred

The earlier unused `wlzzboekuffmagakvxaq` measurement remains excluded from production evidence. The successful new metadata report supersedes the earlier access denial only for the refreshed connector. Public browser binding to this project is recorded in `production-binding.json`; current server Production environment binding remains a separate prerequisite.

## Exact proposed action

Apply the unchanged contents of `supabase/migrations/20260929180000_calendar_feeds.sql` to the verified live project, using the authorized migration mechanism after its exact invocation is reviewed. File SHA-256: `a0bd1d713360f73ea3a53f53fb7592e0ae2b43c23205b506ec62a441b9e18438`. Do not use a broad database push or include other migrations.

The execution mechanism must run the whole file atomically and stop on error. If a migration tool assigns a new history timestamp, record its actual returned version and the source-file hash; do not claim it inserted version `20260929180000`. A SQL Editor application does not itself establish a migration-history entry. Do not manually fabricate a history row to make the filename appear installed.

On the observed absent state, this creates:

- One seven-column table: `public.calendar_feeds` (`id`, `secret_hash`, `planets`, `ascendant`, `midheaven`, `created_at`, `last_fetched_at`), its primary key and five named validation constraints
- Two explicit indexes: `calendar_feeds_last_activity_idx` and `calendar_feeds_created_at_idx`
- Four validation helpers: `is_valid_calendar_feed_id`, `is_valid_calendar_feed_secret_hash`, `calendar_feed_secret_hash_matches`, `calendar_feed_planets`
- Two owner-only fixed-clock helpers: `create_calendar_feed_at`, `prune_calendar_feeds_at`
- Four server RPCs: `create_calendar_feed`, `fetch_calendar_feed`, `revoke_calendar_feed`, `prune_calendar_feeds`

The file enables table RLS, creates no policies, and revokes table access from PUBLIC, anon, authenticated and service_role. It revokes browser execution on all ten functions. service_role receives execution on the four validators and four server RPCs; the fixed-clock helpers remain owner-only. Only the four server RPCs are SECURITY DEFINER. Every function pins `search_path` to `pg_catalog, pg_temp`; the fixed-clock prune helper additionally pins UTC.

These RLS and function-permission changes are part of the exact action requiring review. No credentials, roles, memberships or unrelated schema permissions are created or changed. Applying the definitions does not call their INSERT, UPDATE or DELETE logic, create a feed or run retention. The separate later release checks exercise those operations only after their own prerequisites are met.

## Prerequisites before execution

1. Complete the handoff's compute checkpoint and the current calendar release-source integration, date, build, typecheck, test and capture requirements. Resolve the owner frontend CI blockers in their own lane. The current native 34/34 and UI 25/25 results do not make overall CI green
2. Require Calendar feed SQL CI on the final release source. The current exact-source passing receipt is [run 36850243233 / job 110329914844](https://github.com/zodiacs-org/site/actions/runs/36850243233/job/110329914844), candidate `7a9c9fe52689fddf9338d706459bebc981e180ac`. It covers isolated PostgreSQL 17 migration replay, privacy, retention, search-path and concurrency behavior
3. Confirm the current server Production target and existing environment/Firewall prerequisites without printing or decrypting secrets. Do not recreate owner-reported settings
4. Recheck only the approved project/catalog/migration-ID metadata immediately before the action. Stop if target, calendar objects or history differ from this observation; the file contains CREATE OR REPLACE statements and must not overwrite an unexpected existing implementation
5. Obtain the required authorization for the exact production schema and function-permission action. The completed read-only checks and this local preparation do not supply it. Use only existing authorized access; stop at a new credential or privilege-expansion prompt

## Verification and failure disposition

After a confirmed commit, rerun the reviewed SELECT-only A–E packet. Require the seven columns and expected types/nullability, RLS enabled with zero policies, and no direct DML for anon/authenticated/service_role. Require exactly the ten named functions with the security/search-path/execution distinctions above; record their definition hashes without returning bodies. Record the actual migration-tool receipt/history version if one was created. Preserve the before/after exports and their SHA-256 hashes alongside the applied file hash.

If execution fails or its outcome is uncertain, stop deployment and inspect that same bounded metadata before any retry. Do not assume rollback or success from a transport error. The file is replay-safe under its tested contract, but a retry still requires review of the actual state. If installation succeeds and a later release gate fails, leave the unused schema in place while deployment remains paused. No automatic DROP, TRUNCATE, feed deletion, grant expansion or production restore is included.

Only after the migration and remaining release prerequisites are verified should the coordinator proceed with the separately authorized deployment, sweep and synthetic create/read/CDN-hit/remove/404 checks in `RELEASE-CHECKLIST.md`. Installation alone does not start the legacy-window clock or accept P1.15.
