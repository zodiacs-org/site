-- Account Sync v2 retention: later account tables, the deleting gate, and a
-- reaper for deletions that were prepared but never finished.
--
-- 1. Erasure. Deletion prepare (and every later status, terminal cleanup and
--    finish call) runs private.account_v2_destroy_legacy_account. It now also
--    erases the account tables added after the foundation migration:
--    public.saved_pages (including assistant summary and detail),
--    public.living_chart_moments, public.living_chart_sync_consents,
--    living_chart_private.living_chart_mutations,
--    public.weekly_digest_deliveries and public.weekly_digest_unsubscribe_tokens.
-- 2. The deleting gate. The foundation's terminal trigger now also guards
--    saved_pages and the three Living Chart tables, so an account in deletion
--    cannot write them again. The Living Chart RPC wrappers take the account
--    owner lock before their own lock and answer `temporarily_disabled`, an
--    outcome the client already understands. The weekly digest tables get no
--    trigger: the digest only writes for an opted-in profile, prepare erases
--    the profile and the profile's own terminal trigger keeps it erased, and a
--    trigger there would invert the digest's Auth, profile, delivery lock order.
-- 3. The reaper. Once an account has been deleting for seven days and holds no
--    live deletion receipt, private.account_v2_reap_stranded_deletions repeats
--    the terminal erasure, deletes the Auth identity (auth.users, which
--    cascades the rest) and records the receipts as completed. The seven day
--    window is the existing one; nothing here lengthens or shortens it.
-- 4. Receipt cleanup. public.account_v2_run_retention reaps first and then
--    removes expired receipts that are completed, or whose account is no
--    longer deleting. An expired receipt of an account that is still deleting
--    stays, with its Daily Sun provider reconciliation record, until the
--    reaper has acted. public.account_v2_cleanup_deletion_receipts keeps its
--    signature for the deployed API and now runs the same retention pass.
-- 5. Cadence. When pg_cron is installed (production), the retention pass is
--    scheduled hourly as `account-v2-retention`. The GitHub workflow stays as
--    a backup. Without pg_cron (the portable SQL tests) the schedule is skipped.
--
-- Replay-safe: every statement can run again without change. UTC filename.

-- The reaper deletes Auth identities as the function owner. Fail the whole
-- migration, before anything changes, if the applying role cannot.
do $$
begin
  if not pg_catalog.has_table_privilege(current_user, 'auth.users', 'DELETE') then
    raise exception 'account retention migration: % cannot delete from auth.users', current_user;
  end if;
end;
$$;

-- 1. Erasure ------------------------------------------------------------------

create or replace function private.account_v2_destroy_legacy_account(
  candidate_user_id uuid,
  candidate_request_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_preferences_removed bigint;
  confirmation_claims_removed bigint;
  tombstones_removed bigint;
  charts_removed bigint;
  profiles_removed bigint;
  digest_deliveries_removed bigint;
  digest_tokens_removed bigint;
  saved_pages_removed bigint;
  living_moments_removed bigint;
  living_mutations_removed bigint;
  living_consents_removed bigint;
begin
  if candidate_user_id is null
    or candidate_request_id is null
    or not exists (
      select 1
      from private.account_states
      where user_id = candidate_user_id
        and status = 'deleting'
        and deletion_request_id = candidate_request_id
    )
  then
    raise exception 'account deletion authority is invalid'
      using errcode = '42501';
  end if;

  delete from public.daily_chart_preferences
  where user_id = candidate_user_id;
  get diagnostics daily_preferences_removed = row_count;

  delete from public.daily_chart_confirmation_send_claims
  where user_id = candidate_user_id;
  get diagnostics confirmation_claims_removed = row_count;

  delete from public.chart_deletions
  where user_id = candidate_user_id;
  get diagnostics tombstones_removed = row_count;

  delete from public.charts
  where user_id = candidate_user_id;
  get diagnostics charts_removed = row_count;

  delete from public.profiles
  where user_id = candidate_user_id;
  get diagnostics profiles_removed = row_count;

  -- The weekly digest's own order is profile, delivery, capability.
  delete from public.weekly_digest_deliveries
  where user_id = candidate_user_id;
  get diagnostics digest_deliveries_removed = row_count;

  delete from public.weekly_digest_unsubscribe_tokens
  where user_id = candidate_user_id;
  get diagnostics digest_tokens_removed = row_count;

  delete from public.saved_pages
  where user_id = candidate_user_id;
  get diagnostics saved_pages_removed = row_count;

  delete from public.living_chart_moments
  where user_id = candidate_user_id;
  get diagnostics living_moments_removed = row_count;

  delete from living_chart_private.living_chart_mutations
  where user_id = candidate_user_id;
  get diagnostics living_mutations_removed = row_count;

  delete from public.living_chart_sync_consents
  where user_id = candidate_user_id;
  get diagnostics living_consents_removed = row_count;

  return jsonb_build_object(
    'daily_chart_preferences', daily_preferences_removed,
    'daily_chart_confirmation_send_claims', confirmation_claims_removed,
    'chart_deletions', tombstones_removed,
    'charts', charts_removed,
    'profiles', profiles_removed,
    'weekly_digest_deliveries', digest_deliveries_removed,
    'weekly_digest_unsubscribe_tokens', digest_tokens_removed,
    'saved_pages', saved_pages_removed,
    'living_chart_moments', living_moments_removed,
    'living_chart_mutations', living_mutations_removed,
    'living_chart_sync_consents', living_consents_removed
  );
end;
$$;

revoke all on function private.account_v2_destroy_legacy_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.account_v2_destroy_legacy_account(uuid, uuid)
  to service_role;

-- 2. The deleting gate ---------------------------------------------------------

drop trigger if exists account_v2_terminal_gate on public.saved_pages;
create trigger account_v2_terminal_gate
before insert or update on public.saved_pages
for each row execute function private.account_v2_reject_terminal_recreation();

drop trigger if exists account_v2_terminal_gate on public.living_chart_sync_consents;
create trigger account_v2_terminal_gate
before insert or update on public.living_chart_sync_consents
for each row execute function private.account_v2_reject_terminal_recreation();

drop trigger if exists account_v2_terminal_gate on public.living_chart_moments;
create trigger account_v2_terminal_gate
before insert or update on public.living_chart_moments
for each row execute function private.account_v2_reject_terminal_recreation();

drop trigger if exists account_v2_terminal_gate on living_chart_private.living_chart_mutations;
create trigger account_v2_terminal_gate
before insert or update on living_chart_private.living_chart_mutations
for each row execute function private.account_v2_reject_terminal_recreation();

-- Takes the account owner lock that deletion prepare takes first, so a Living
-- Chart write and a prepare for the same account never wait on each other in
-- opposite orders, and answers whether the caller's account is deleting. It
-- takes no argument: the account is always the caller's own.
create or replace function living_chart_private.living_chart_account_deleting()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  actor_id := living_chart_private.living_chart_actor_id();
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text, 7312025)
  );
  return exists (
    select 1
    from private.account_states
    where user_id = actor_id
      and status = 'deleting'
  );
end;
$$;

revoke all on function living_chart_private.living_chart_account_deleting()
  from public, anon;
grant execute on function living_chart_private.living_chart_account_deleting()
  to authenticated, service_role;

create or replace function public.set_living_chart_sync_consent(
  candidate_decision text,
  candidate_mutation_id uuid,
  candidate_expected_consent_epoch bigint,
  candidate_policy_version text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if living_chart_private.living_chart_account_deleting() then
    return jsonb_build_object('outcome', 'temporarily_disabled');
  end if;
  return living_chart_private.set_living_chart_sync_consent_impl(
    candidate_decision,
    candidate_mutation_id,
    candidate_expected_consent_epoch,
    candidate_policy_version
  );
end;
$$;

create or replace function public.put_living_chart_moment(
  candidate_moment_id uuid,
  candidate_base_revision bigint,
  candidate_consent_epoch bigint,
  candidate_mutation_id uuid,
  candidate_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if living_chart_private.living_chart_account_deleting() then
    return jsonb_build_object('outcome', 'temporarily_disabled');
  end if;
  return living_chart_private.put_living_chart_moment_impl(
    candidate_moment_id,
    candidate_base_revision,
    candidate_consent_epoch,
    candidate_mutation_id,
    candidate_payload
  );
end;
$$;

create or replace function public.delete_living_chart_moment(
  candidate_moment_id uuid,
  candidate_base_revision bigint,
  candidate_consent_epoch bigint,
  candidate_mutation_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if living_chart_private.living_chart_account_deleting() then
    return jsonb_build_object('outcome', 'temporarily_disabled');
  end if;
  return living_chart_private.delete_living_chart_moment_impl(
    candidate_moment_id,
    candidate_base_revision,
    candidate_consent_epoch,
    candidate_mutation_id
  );
end;
$$;

revoke all on function public.set_living_chart_sync_consent(text, uuid, bigint, text)
  from public, anon;
revoke all on function public.put_living_chart_moment(uuid, bigint, bigint, uuid, jsonb)
  from public, anon;
revoke all on function public.delete_living_chart_moment(uuid, bigint, bigint, uuid)
  from public, anon;
grant execute on function public.set_living_chart_sync_consent(text, uuid, bigint, text)
  to authenticated, service_role;
grant execute on function public.put_living_chart_moment(uuid, bigint, bigint, uuid, jsonb)
  to authenticated, service_role;
grant execute on function public.delete_living_chart_moment(uuid, bigint, bigint, uuid)
  to authenticated, service_role;

-- 3. The reaper ---------------------------------------------------------------

-- Erasure for a deleting account that no longer has any receipt (one whose
-- receipts the earlier cleanup removed before this migration). The Auth
-- deletion that follows cascades the same rows; erasing them first keeps the
-- order the receipt path uses.
create or replace function private.account_v2_erase_deleting_account(
  candidate_user_id uuid,
  candidate_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.account_v2_destroy_consent_events(
    candidate_user_id,
    candidate_request_id
  );

  delete from private.account_consents where user_id = candidate_user_id;
  delete from private.account_sync_devices where user_id = candidate_user_id;
  delete from private.account_chart_records where user_id = candidate_user_id;
  delete from private.account_sync_tombstones where user_id = candidate_user_id;
  delete from private.account_sync_changes where user_id = candidate_user_id;
  delete from private.account_sync_mutations where user_id = candidate_user_id;

  perform private.account_v2_destroy_legacy_account(
    candidate_user_id,
    candidate_request_id
  );
  perform private.account_v2_destroy_legacy_invites(
    candidate_user_id,
    candidate_request_id
  );
end;
$$;

revoke all on function private.account_v2_erase_deleting_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.account_v2_erase_deleting_account(uuid, uuid)
  to service_role;

-- Finishes one account's deletion. Returns false, changing nothing, unless the
-- account is deleting, started at least seven days ago and holds no live
-- receipt (a person who can still finish it themselves keeps that chance).
create or replace function private.account_v2_reap_deleting_account(
  candidate_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_state private.account_states%rowtype;
  current_alias text;
  current_request_id uuid;
  operation_time timestamptz := pg_catalog.clock_timestamp();
begin
  if candidate_user_id is null then
    return false;
  end if;

  -- The lock order of prepare and terminal cleanup: every recipient alias the
  -- account or its receipts know, then invite authority, then the owner.
  for current_alias in
    select distinct aliases.recipient_hash
    from (
      select recipient_hash
      from private.account_daily_sun_recipient_aliases
      where user_id = candidate_user_id
      union all
      select cleanup.recipient_hash
      from private.account_deletion_provider_cleanup as cleanup
      join private.account_deletion_receipts as receipts
        on receipts.request_id = cleanup.request_id
      where receipts.user_id = candidate_user_id
    ) as aliases
    order by aliases.recipient_hash
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(current_alias, 7312026)
    );
  end loop;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(candidate_user_id::text, 7312030)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(candidate_user_id::text, 7312025)
  );

  select * into current_state
  from private.account_states
  where user_id = candidate_user_id
  for update;

  if not found
    or current_state.status <> 'deleting'
    or current_state.deletion_started_at > operation_time - interval '7 days'
    or exists (
      select 1
      from private.account_deletion_receipts
      where user_id = candidate_user_id
        and expires_at > operation_time
    )
  then
    return false;
  end if;

  -- Prefer the receipt that started the deletion, then the newest.
  select receipts.request_id
  into current_request_id
  from private.account_deletion_receipts as receipts
  where receipts.user_id = candidate_user_id
  order by
    (receipts.request_id = current_state.deletion_request_id) desc,
    receipts.expires_at desc,
    receipts.request_id
  limit 1;

  if current_request_id is not null then
    -- The same erasure and Daily Sun revocation every finish runs.
    perform private.account_v2_reassert_terminal_cleanup(
      current_request_id,
      '[]'::jsonb,
      true
    );
  else
    perform private.account_v2_erase_deleting_account(
      candidate_user_id,
      current_state.deletion_request_id
    );
  end if;

  -- The Auth identity: email address, identities and sessions. Deleting the
  -- user cascades the account state and every remaining owner row.
  delete from auth.users
  where id = candidate_user_id;

  update private.account_deletion_receipts
  set completed_at = coalesce(completed_at, greatest(operation_time, prepared_at))
  where user_id = candidate_user_id;

  return true;
end;
$$;

revoke all on function private.account_v2_reap_deleting_account(uuid)
  from public, anon, authenticated;
grant execute on function private.account_v2_reap_deleting_account(uuid)
  to service_role;

-- One bounded reaper pass. Each account runs in its own subtransaction, so one
-- account that cannot be deleted (for example a row elsewhere that blocks the
-- Auth delete) is counted and left for the next pass without undoing others.
create or replace function private.account_v2_reap_stranded_deletions(
  candidate_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate_user_id uuid;
  reaped_count integer := 0;
  failed_count integer := 0;
  recorded_count integer := 0;
  operation_time timestamptz := pg_catalog.clock_timestamp();
begin
  if candidate_limit is null
    or candidate_limit < 1
    or candidate_limit > 1000
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  -- An expired receipt whose Auth identity is already gone finished outside
  -- this function (the Auth delete went through but finish never recorded
  -- it). Record that, so cleanup can remove it.
  with finished as (
    select receipts.request_id
    from private.account_deletion_receipts as receipts
    where receipts.completed_at is null
      and receipts.expires_at <= operation_time
      and not exists (
        select 1 from auth.users as users where users.id = receipts.user_id
      )
    order by receipts.expires_at, receipts.request_id
    for update skip locked
    limit candidate_limit
  ), recorded as (
    update private.account_deletion_receipts as receipts
    set completed_at = greatest(operation_time, receipts.prepared_at)
    from finished
    where receipts.request_id = finished.request_id
    returning 1
  )
  select count(*)::integer into recorded_count from recorded;

  for candidate_user_id in
    select states.user_id
    from private.account_states as states
    where states.status = 'deleting'
      and states.deletion_started_at <= operation_time - interval '7 days'
      and not exists (
        select 1
        from private.account_deletion_receipts as receipts
        where receipts.user_id = states.user_id
          and receipts.expires_at > operation_time
      )
    order by states.deletion_started_at, states.user_id
    limit candidate_limit
  loop
    begin
      if private.account_v2_reap_deleting_account(candidate_user_id) then
        reaped_count := reaped_count + 1;
      end if;
    exception
      when others then
        failed_count := failed_count + 1;
        raise warning 'account deletion reaper left one account for the next pass (sqlstate %)', sqlstate;
    end;
  end loop;

  return jsonb_build_object(
    'outcome', 'ready',
    'reaped', reaped_count,
    'reap_failed', failed_count,
    'completions_recorded', recorded_count
  );
end;
$$;

revoke all on function private.account_v2_reap_stranded_deletions(integer)
  from public, anon, authenticated;
grant execute on function private.account_v2_reap_stranded_deletions(integer)
  to service_role;

-- 4. Receipt cleanup -----------------------------------------------------------

-- The hourly retention pass: reap, prune provider leases, then remove expired
-- receipts that are completed or whose account is no longer deleting.
-- `overdue` counts deleting accounts more than an hour past their window after
-- this pass; it is zero unless the reaper is failing or falling behind.
create or replace function public.account_v2_run_retention(
  candidate_limit integer default 256
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  reap_result jsonb;
  leases_removed bigint;
  receipts_removed bigint;
  overdue_count bigint;
begin
  if candidate_limit is null
    or candidate_limit < 1
    or candidate_limit > 1000
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  reap_result := private.account_v2_reap_stranded_deletions(candidate_limit);

  with removed as (
    delete from private.account_daily_sun_provider_mutation_leases as leases
    where leases.recipient_hash in (
      select expired_leases.recipient_hash
      from private.account_daily_sun_provider_mutation_leases as expired_leases
      where expired_leases.expires_at <= clock_timestamp()
      order by expired_leases.expires_at, expired_leases.recipient_hash
      for update skip locked
      limit candidate_limit
    )
    returning 1
  )
  select count(*) into leases_removed from removed;

  with expired as (
    select receipts.request_id
    from private.account_deletion_receipts as receipts
    where receipts.expires_at <= clock_timestamp()
      and (
        receipts.completed_at is not null
        or not exists (
          select 1
          from private.account_states as states
          where states.user_id = receipts.user_id
            and states.status = 'deleting'
        )
      )
    order by receipts.expires_at, receipts.request_id
    for update skip locked
    limit candidate_limit
  ), removed as (
    delete from private.account_deletion_receipts as receipts
    using expired
    where receipts.request_id = expired.request_id
    returning 1
  )
  select count(*) into receipts_removed from removed;

  select count(*)
  into overdue_count
  from private.account_states as states
  where states.status = 'deleting'
    and states.deletion_started_at
      <= clock_timestamp() - interval '7 days' - interval '1 hour'
    and not exists (
      select 1
      from private.account_deletion_receipts as receipts
      where receipts.user_id = states.user_id
        and receipts.expires_at > clock_timestamp()
    );

  if (reap_result->>'reap_failed')::integer > 0 or overdue_count > 0 then
    raise warning 'account retention: % reap failures, % deleting accounts overdue',
      reap_result->>'reap_failed', overdue_count;
  end if;

  return jsonb_build_object(
    'outcome', 'ready',
    'receipts_removed', receipts_removed,
    'leases_removed', leases_removed,
    'reaped', (reap_result->>'reaped')::integer,
    'reap_failed', (reap_result->>'reap_failed')::integer,
    'completions_recorded', (reap_result->>'completions_recorded')::integer,
    'overdue', overdue_count
  );
end;
$$;

revoke all on function public.account_v2_run_retention(integer)
  from public, anon, authenticated;
grant execute on function public.account_v2_run_retention(integer)
  to service_role;

-- The deployed API's entry point keeps its signature and answer (receipts
-- removed) and now runs the full retention pass.
create or replace function public.account_v2_cleanup_deletion_receipts(
  candidate_limit integer default 100
)
returns bigint
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  retention jsonb;
begin
  if candidate_limit is null
    or candidate_limit < 1
    or candidate_limit > 1000
  then
    return 0;
  end if;

  retention := public.account_v2_run_retention(candidate_limit);
  return coalesce((retention->>'receipts_removed')::bigint, 0);
end;
$$;

revoke all on function public.account_v2_cleanup_deletion_receipts(integer)
  from public, anon, authenticated;
grant execute on function public.account_v2_cleanup_deletion_receipts(integer)
  to service_role;

-- 5. Cadence -----------------------------------------------------------------

-- pg_cron's schedule() replaces a job of the same name, so a replay keeps one
-- job. The job runs as the applying role, which owns the functions above.
do $$
begin
  if exists (select 1 from pg_catalog.pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'account-v2-retention',
      '23 * * * *',
      'select public.account_v2_run_retention(256)'
    );
  else
    raise notice 'pg_cron is not installed; account-v2-retention was not scheduled';
  end if;
end;
$$;
