-- Read-only verification for migration 20261113090000_account_sync_v2_retention,
-- safe on production as it is today (no Living Chart, no Sky Watch, no
-- assistant accounts layer, no pg_cron) and on every later shape.
--
-- Every statement is a SELECT and returns counts or booleans only. None
-- returns a name, an id, an email, a payload, a key or birth data. Queries
-- that need an optional feature look the object up first and return NULL when
-- it is missing, so the whole file runs without an error anywhere.
-- Run as postgres (the SQL editor role).
--
-- Part A: production today. Part B: after Living Chart, Sky Watch or the
-- assistant accounts layer launches (NULL until then).

-- ===========================================================================
-- Part A: production today
-- ===========================================================================

-- A0. Before applying: the applying role can delete Auth identities (the
--     migration fails before changing anything if it cannot). Expect true.
select pg_catalog.has_table_privilege(current_user, 'auth.users', 'DELETE') as can_delete_auth_users;

-- A1. Functions this migration creates or replaces that exist everywhere.
--     Expect functions_present 14 and definer_modes_correct true (SECURITY
--     DEFINER for private.*, SECURITY INVOKER for public.*).
select
  count(*) as functions_present,
  coalesce(bool_and(p.prosecdef = (n.nspname = 'private')), false) as definer_modes_correct
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where (n.nspname, p.proname) in (
  ('private', 'account_v2_destroy_legacy_account'),
  ('private', 'account_v2_lock_owner_deleting'),
  ('private', 'account_v2_reject_deleting_watch_principal'),
  ('private', 'account_v2_erase_deleting_account'),
  ('private', 'account_v2_reap_deleting_account'),
  ('private', 'account_v2_reap_stranded_deletions'),
  ('private', 'account_v2_export_later_tables'),
  ('public', 'account_v2_prepare_deletion'),
  ('public', 'account_v2_run_retention'),
  ('public', 'account_v2_cleanup_deletion_receipts'),
  ('public', 'account_v2_key_version_inventory'),
  ('public', 'account_v2_rewrap_candidates'),
  ('public', 'account_v2_rewrap_apply'),
  ('public', 'account_v2_export_later_tables')
);

-- A2. Service only: functions anon or authenticated may run, or the service
--     role may not. Expect 0.
select count(*) as functions_not_service_only
from (values
  ('public.account_v2_run_retention(integer)'),
  ('public.account_v2_cleanup_deletion_receipts(integer)'),
  ('public.account_v2_prepare_deletion(uuid,uuid,jsonb,jsonb,boolean)'),
  ('public.account_v2_key_version_inventory()'),
  ('public.account_v2_rewrap_candidates(text,integer,integer)'),
  ('public.account_v2_rewrap_apply(text,jsonb)'),
  ('public.account_v2_export_later_tables(uuid)'),
  ('private.account_v2_export_later_tables(uuid)'),
  ('private.account_v2_destroy_legacy_account(uuid,uuid)'),
  ('private.account_v2_lock_owner_deleting(uuid)'),
  ('private.account_v2_reap_stranded_deletions(integer)'),
  ('private.account_v2_reap_deleting_account(uuid)'),
  ('private.account_v2_erase_deleting_account(uuid,uuid)')
) as r(signature)
where pg_catalog.has_function_privilege('anon', r.signature, 'execute')
   or pg_catalog.has_function_privilege('authenticated', r.signature, 'execute')
   or not pg_catalog.has_function_privilege('service_role', r.signature, 'execute');

-- A3. The deleting gate on saved_pages. Expect true.
select exists (
  select 1 from pg_catalog.pg_trigger
  where tgname = 'account_v2_terminal_gate'
    and tgrelid = pg_catalog.to_regclass('public.saved_pages')
) as saved_pages_gated;

-- A4. The erase helper erases saved pages and the weekly digest rows, and
--     looks up each optional table when it runs. Expect five trues.
select
  def like '%delete from public.saved_pages%' as erases_saved_pages,
  def like '%delete from public.weekly_digest_deliveries%' as erases_digest_deliveries,
  def like '%delete from public.weekly_digest_unsubscribe_tokens%' as erases_digest_tokens,
  def like '%to_regclass(''public.living_chart_moments'')%'
    and def like '%to_regclass(''living_chart_private.living_chart_mutations'')%'
    and def like '%to_regclass(''public.living_chart_sync_consents'')%' as living_chart_checked_at_run_time,
  def like '%to_regclass(''sky_watch.principals'')%' as sky_watch_checked_at_run_time
from (
  select pg_catalog.pg_get_functiondef(
    'private.account_v2_destroy_legacy_account(uuid,uuid)'::regprocedure
  ) as def
) as helper;

-- A5. Review fixes in the replaced and new functions. Expect three trues.
select
  pg_catalog.pg_get_functiondef(
    'public.account_v2_prepare_deletion(uuid,uuid,jsonb,jsonb,boolean)'::regprocedure
  ) like '%current_state.status <> ''deleting''%' as prepare_keeps_stranded_receipts,
  pg_catalog.pg_get_functiondef(
    'private.account_v2_reap_deleting_account(uuid)'::regprocedure
  ) like '%from auth.users as users%for update%' as reaper_locks_auth_first,
  pg_catalog.pg_get_functiondef(
    'private.account_v2_lock_owner_deleting(uuid)'::regprocedure
  ) like '%from auth.users%' as owner_lock_helper_checks_auth;

-- A6. The export RPC answers for an account with nothing saved (the nil id
--     matches no one) and refuses a missing id. Only booleans are returned,
--     never the export itself. Expect four trues.
select
  answer->>'outcome' = 'ready' as export_ready,
  answer->'saved_pages' = '[]'::jsonb as no_saved_pages,
  answer->'living_chart_moments' = '[]'::jsonb as no_moments,
  public.account_v2_export_later_tables(null) = '{"outcome":"invalid"}'::jsonb as missing_id_refused
from (
  select public.account_v2_export_later_tables('00000000-0000-0000-0000-000000000000') as answer
) as nil_export;

-- A7. What is installed, and whether the migration's parts for it are in
--     place. Production today: every column false. After a launch, a feature
--     whose `_installed` is true needs its `_gated` true; if not, apply the
--     migration again. `reapply_needed` sums that up (expect false).
with state as (
  select
    pg_catalog.to_regclass('public.living_chart_moments') is not null
      and pg_catalog.to_regclass('public.living_chart_sync_consents') is not null
      and pg_catalog.to_regclass('living_chart_private.living_chart_mutations') is not null
      as living_chart_installed,
    (select count(*) from pg_catalog.pg_trigger
      where tgname = 'account_v2_terminal_gate'
        and tgrelid in (
          pg_catalog.to_regclass('public.living_chart_moments'),
          pg_catalog.to_regclass('public.living_chart_sync_consents'),
          pg_catalog.to_regclass('living_chart_private.living_chart_mutations')
        )) = 3
      and coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
        'public.set_living_chart_sync_consent(text,uuid,bigint,text)')), '') like '%living_chart_account_deleting%'
      and coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
        'public.put_living_chart_moment(uuid,bigint,bigint,uuid,jsonb)')), '') like '%living_chart_account_deleting%'
      and coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
        'public.delete_living_chart_moment(uuid,bigint,bigint,uuid)')), '') like '%living_chart_account_deleting%'
      as living_chart_gated,
    pg_catalog.to_regclass('sky_watch.principals') is not null as sky_watch_installed,
    exists (select 1 from pg_catalog.pg_trigger
      where tgname = 'account_v2_terminal_gate'
        and tgrelid = pg_catalog.to_regclass('sky_watch.principals'))
      and coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
        'public.zodiacs_sky_watch_v1(text,jsonb)')), '') like '%private.account_v2_lock_owner_deleting(watch_user)%'
      as sky_watch_gated,
    pg_catalog.to_regprocedure('public.zodiacs_accounts_v1(text,jsonb)') is not null as accounts_layer_installed,
    coalesce(pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure(
      'public.zodiacs_accounts_v1(text,jsonb)')), '') like '%pg_advisory_xact_lock(hashtextextended(owner::text, 7312025))%'
      as accounts_layer_gated,
    exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') as pg_cron_installed
)
select state.*,
  (living_chart_installed and not living_chart_gated)
    or (sky_watch_installed and not sky_watch_gated)
    or (accounts_layer_installed and not accounts_layer_gated) as reapply_needed
from state;

-- A8. The hourly job, where pg_cron exists. Production today: NULL (no
--     pg_cron; the GitHub workflow runs retention). With pg_cron: expect 1.
select case
  when pg_catalog.to_regclass('cron.job') is null then null
  else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
    $q$select count(*) as n from cron.job
       where jobname = 'account-v2-retention' and schedule = '23 * * * *' and active$q$,
    false, true, '')))[1]::text::bigint
end as retention_jobs_scheduled;

-- A9. Row counts only: the state the reaper acts on. Run before applying and
--     after the first retention pass. Production on 13 Nov 2026: all zero.
select
  (select count(*) from private.account_states where status = 'deleting') as deleting_accounts,
  (select count(*) from private.account_states s
     where s.status = 'deleting'
       and s.deletion_started_at <= now() - interval '7 days'
       and not exists (
         select 1 from private.account_deletion_receipts r
         where r.user_id = s.user_id and r.expires_at > now()
       )) as deletions_past_window,
  (select count(*) from private.account_states s
     where s.status = 'deleting'
       and not exists (
         select 1 from private.account_deletion_receipts r where r.user_id = s.user_id
       )) as deleting_without_any_receipt,
  (select count(*) from private.account_deletion_receipts) as receipts,
  (select count(*) from private.account_deletion_receipts
     where expires_at <= now() and completed_at is null) as expired_incomplete_receipts,
  (select count(*) from private.account_deletion_provider_cleanup where state = 'pending')
    as pending_provider_cleanup,
  (select count(*) from private.account_daily_sun_provider_mutation_leases
     where expires_at <= now()) as expired_provider_leases;

-- A10. Rows the migration's code paths read today (counts only). On
--      13 Nov 2026 the parent counted 10 Auth users, 2 saved pages and 0 v2
--      chart records.
select
  (select count(*) from auth.users) as auth_users,
  (select count(*) from public.saved_pages) as saved_pages,
  (select count(*) from private.account_chart_records) as v2_chart_records,
  (select count(*) from public.weekly_digest_deliveries) as digest_deliveries,
  (select count(*) from public.weekly_digest_unsubscribe_tokens) as digest_tokens;

-- A11. Owner rows of tables production has that belong to accounts in
--      deletion. Expect all zero after the first retention pass.
select
  (select count(*) from public.saved_pages t
     join private.account_states s on s.user_id = t.user_id and s.status = 'deleting') as saved_pages,
  (select count(*) from public.weekly_digest_deliveries t
     join private.account_states s on s.user_id = t.user_id and s.status = 'deleting') as weekly_digest_deliveries,
  (select count(*) from public.weekly_digest_unsubscribe_tokens t
     join private.account_states s on s.user_id = t.user_id and s.status = 'deleting') as weekly_digest_tokens;

-- A12. Key versions in use: wrapped rows per kind and the number of key
--      versions in use (counts only, no key material). Production on
--      13 Nov 2026: all zero (0 v2 chart records).
select
  coalesce(sum((entry->>'rows')::bigint) filter (where entry->>'kind' = 'chart'), 0) as chart_rows,
  coalesce(sum((entry->>'rows')::bigint) filter (where entry->>'kind' = 'alias'), 0) as alias_rows,
  coalesce(sum((entry->>'rows')::bigint) filter (where entry->>'kind' = 'provider'), 0) as provider_rows,
  count(distinct entry->>'key_version') as key_versions_in_use
from jsonb_array_elements(public.account_v2_key_version_inventory()) as listed(entry);

-- A13. Rewrap candidates carry unbroken base64. Expect zero.
select count(*) as wrapped_keys_with_line_breaks
from jsonb_array_elements(
  (public.account_v2_rewrap_candidates('chart', 1, 500))->'rows'
) as listed(row_value)
where listed.row_value->>'wrapped_key' ~ '[\r\n]';

-- ===========================================================================
-- Part B: after Living Chart, Sky Watch or the assistant accounts layer
-- launches. Each column is NULL while its feature is missing. After a launch
-- (and applying this migration again, see A7) run Part A and Part B again.
-- ===========================================================================

-- B1. Owner rows of Living Chart and Sky Watch that belong to accounts in
--     deletion. Expect zero (or NULL while missing).
select
  case when pg_catalog.to_regclass('public.living_chart_moments') is null then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from public.living_chart_moments t
         join private.account_states s on s.user_id = t.user_id and s.status = 'deleting'$q$,
      false, true, '')))[1]::text::bigint end as living_chart_moments,
  case when pg_catalog.to_regclass('public.living_chart_sync_consents') is null then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from public.living_chart_sync_consents t
         join private.account_states s on s.user_id = t.user_id and s.status = 'deleting'$q$,
      false, true, '')))[1]::text::bigint end as living_chart_consents,
  case when pg_catalog.to_regclass('living_chart_private.living_chart_mutations') is null then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from living_chart_private.living_chart_mutations t
         join private.account_states s on s.user_id = t.user_id and s.status = 'deleting'$q$,
      false, true, '')))[1]::text::bigint end as living_chart_mutations,
  case when pg_catalog.to_regclass('sky_watch.principals') is null then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from sky_watch.principals t
         join private.account_states s on s.user_id = t.oauth_user and s.status = 'deleting'$q$,
      false, true, '')))[1]::text::bigint end as watch_principals_of_deleting_accounts,
  case when pg_catalog.to_regclass('sky_watch.principals') is null then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from sky_watch.principals t
         left join auth.users u on u.id = t.oauth_user
         where t.oauth_user is not null and u.id is null$q$,
      false, true, '')))[1]::text::bigint end as watch_principals_without_auth_identity;

-- B2. Sky Watch: the review fixes in the watch RPC. Expect true, true
--     (NULL while Sky Watch is missing).
select
  case when pg_catalog.to_regprocedure('public.zodiacs_sky_watch_v1(text,jsonb)') is null then null
    else pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.zodiacs_sky_watch_v1(text,jsonb)'))
      like '%account_v2_lock_owner_deleting((input->>''user'')::uuid)%sky_watch.oauth_active(%clock_timestamp()) then return null%'
  end as oauth_rechecks_under_lock,
  case when pg_catalog.to_regprocedure('public.zodiacs_sky_watch_v1(text,jsonb)') is null then null
    else position(
      'delete from sky_watch.principals where expires_at' in
      pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.zodiacs_sky_watch_v1(text,jsonb)'))
    ) between 1 and position(
      'update sky_watch.subscriptions s set active=false' in
      pg_catalog.pg_get_functiondef(pg_catalog.to_regprocedure('public.zodiacs_sky_watch_v1(text,jsonb)'))
    )
  end as enqueue_principals_first;

-- B3. Rows the export's shape checks would refuse. Expect zero (NULL while
--     the assistant columns or Living Chart are missing). Assistant saves whose
--     detail has no schema name pass the table's check (its comparison is
--     NULL) but fail the export closed.
select
  case when (
    select count(*) from pg_catalog.pg_attribute
    where attrelid = 'public.saved_pages'::regclass
      and attname in ('source', 'detail') and attnum > 0 and not attisdropped
  ) <> 2 then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from public.saved_pages
         where source = 'assistant'
           and (detail->>'schema') is distinct from 'zodiacs.assistant-save.v1'$q$,
      false, true, '')))[1]::text::bigint end as assistant_details_without_schema,
  case when pg_catalog.to_regprocedure('living_chart_private.living_chart_payload_valid(jsonb)') is null then null
    else (pg_catalog.xpath('/row/n/text()', pg_catalog.query_to_xml(
      $q$select count(*) as n from public.living_chart_moments
         where deleted_at is null
           and not living_chart_private.living_chart_payload_valid(payload)$q$,
      false, true, '')))[1]::text::bigint end as live_moments_outside_payload_shape;
