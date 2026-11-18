-- Account Sync v2 retention: later account tables, the deleting gate, and a
-- reaper for deletions that were prepared but never finished.
--
-- 1. Erasure. Deletion prepare (and every later status, terminal cleanup and
--    finish call) runs private.account_v2_destroy_legacy_account. It now also
--    erases the account tables added after the foundation migration:
--    public.saved_pages (including assistant summary and detail),
--    public.living_chart_moments, public.living_chart_sync_consents,
--    living_chart_private.living_chart_mutations,
--    public.weekly_digest_deliveries, public.weekly_digest_unsubscribe_tokens
--    and Sky Watch's OAuth principals (sky_watch.principals by oauth_user,
--    which cascades their subscriptions and outbox rows). The Living Chart
--    and Sky Watch tables are erased wherever they exist (see "Production
--    shape" below).
-- 2. The deleting gate. The foundation's terminal trigger now also guards
--    saved_pages and the three Living Chart tables, so an account in deletion
--    cannot write them again. The Living Chart RPC wrappers take the account
--    owner lock before their own lock and answer `temporarily_disabled`, an
--    outcome the client already understands. The weekly digest tables get no
--    trigger: the digest only writes for an opted-in profile, prepare erases
--    the profile and the profile's own terminal trigger keeps it erased, and a
--    trigger there would invert the digest's Auth, profile, delivery lock order.
--    The assistant save RPC (public.zodiacs_accounts_v1) now takes the owner
--    lock before it replaces a site row, so the replacement and prepare take
--    the owner lock and the saved row in the same order. Sky Watch
--    (public.zodiacs_sky_watch_v1) takes the owner lock before it creates,
--    refreshes or uses an OAuth principal and refuses an account in deletion
--    or without an Auth identity, checking the OAuth authorization again under
--    the lock, and a trigger on sky_watch.principals refuses the same writes
--    from any other path. Subscriptions and outbox rows need a live principal.
--    Sky Watch maintenance (`enqueue`) deletes expired principals before it
--    touches subscriptions, the principal, subscription order deletion uses.
-- 3. The reaper. Once an account has been deleting for seven days and holds no
--    live deletion receipt, private.account_v2_reap_stranded_deletions repeats
--    the terminal erasure, deletes the Auth identity (auth.users, which
--    cascades the rest) and records the receipts as completed. It locks the
--    Auth row before anything else, the weekly digest's order. The seven day
--    window is the existing one; nothing here lengthens or shortens it.
-- 4. Receipt cleanup. public.account_v2_run_retention reaps first and then
--    removes expired receipts that are completed, or whose account is no
--    longer deleting. An expired receipt of an account that is still deleting
--    stays, with its Daily Sun provider reconciliation record, until the
--    reaper has acted. Deletion prepare's recovery rotation prune follows the
--    same rule. public.account_v2_cleanup_deletion_receipts keeps its
--    signature for the deployed API and now runs the same retention pass.
-- 5. Cadence. When pg_cron is installed, the retention pass is scheduled
--    hourly as `account-v2-retention`. Production has no pg_cron (13 Nov 2026)
--    and neither do the portable SQL tests: there the schedule is skipped with
--    a NOTICE, and the retention pass runs from the GitHub workflow
--    account-deletion-receipt-cleanup.yml through POST
--    /api/account/cleanup-receipts, which calls account_v2_run_retention.
-- 6. Key rotation. Service-only RPCs list rows still wrapped under an old key
--    version and swap in re-wrapped data keys, for
--    scripts/account-sync-v2-rewrap.ts. They never read or write ciphertext.
-- 7. Export. public.account_v2_export_later_tables returns the saved pages and
--    Living Chart moments for the account export, reading only what exists.
--
-- Production shape. Production (13 Nov 2026) has the Account Sync v2
-- foundation, the weekly digest tables and saved_pages without the assistant
-- columns (source, summary, detail), but no Living Chart, no Sky Watch, no
-- assistant accounts layer (zodiacs_accounts_private, zodiacs_accounts_v1)
-- and no pg_cron. This file applies there as it is:
-- - At run time, the erase helper and the export look up each optional table
--   when they run and skip one that is missing, so retention, deletion and
--   export work today and cover Living Chart and Sky Watch from the day those
--   tables exist, with no further change.
-- - At install time, the parts that attach to an optional feature (Living
--   Chart's gate triggers and owner-lock wrappers; Sky Watch's principal gate,
--   index and watch RPC; the assistant save RPC) are installed only when that
--   feature is present, and are otherwise skipped with a NOTICE.
-- Apply this file again after Living Chart, Sky Watch or the assistant
-- accounts layer reaches a database that already has it. Their own migrations
-- replace the RPCs this file changes and do not know the deleting gate;
-- applying this file again installs the skipped parts and puts the gated RPCs
-- back. Until then, deletion still erases their rows (the run time checks
-- above), but a deleting account is not refused new writes to them.
-- docs/SUPABASE.md records this step; query A7 of
-- docs/sql/verify-20261113090000-account-sync-v2-retention.sql checks it.
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
  watch_principals_removed bigint;
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

  -- Living Chart and Sky Watch are not in every database (production has
  -- neither yet). Each optional table is looked up when this runs and erased
  -- only if it exists, so the same function covers them from the day they
  -- arrive. A missing table counts as zero rows.
  living_moments_removed := 0;
  living_mutations_removed := 0;
  living_consents_removed := 0;
  watch_principals_removed := 0;

  if pg_catalog.to_regclass('public.living_chart_moments') is not null then
    execute 'delete from public.living_chart_moments where user_id = $1'
      using candidate_user_id;
    get diagnostics living_moments_removed = row_count;
  end if;

  if pg_catalog.to_regclass('living_chart_private.living_chart_mutations') is not null then
    execute 'delete from living_chart_private.living_chart_mutations where user_id = $1'
      using candidate_user_id;
    get diagnostics living_mutations_removed = row_count;
  end if;

  if pg_catalog.to_regclass('public.living_chart_sync_consents') is not null then
    execute 'delete from public.living_chart_sync_consents where user_id = $1'
      using candidate_user_id;
    get diagnostics living_consents_removed = row_count;
  end if;

  -- Sky Watch's OAuth principals name the account only in oauth_user, which
  -- has no Auth foreign key, so the Auth deletion would leave them. Deleting
  -- a principal cascades its subscriptions and their outbox rows, the
  -- principal, subscription, outbox order the watch RPC uses. The principals
  -- are locked in id order first, the order Sky Watch maintenance locks
  -- expired principals in before it touches any subscription. Token
  -- principals and other accounts' principals are untouched.
  if pg_catalog.to_regclass('sky_watch.principals') is not null then
    execute 'select 1 from sky_watch.principals where oauth_user = $1 order by id for update'
      using candidate_user_id;

    execute 'delete from sky_watch.principals where oauth_user = $1'
      using candidate_user_id;
    get diagnostics watch_principals_removed = row_count;
  end if;

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
    'living_chart_sync_consents', living_consents_removed,
    'sky_watch_principals', watch_principals_removed
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

-- Living Chart: installed only where Living Chart is (not production yet).
-- Apply this migration again after Living Chart launches.
do $do$
begin
  if pg_catalog.to_regclass('public.living_chart_sync_consents') is null
    or pg_catalog.to_regclass('public.living_chart_moments') is null
    or pg_catalog.to_regclass('living_chart_private.living_chart_mutations') is null
    or pg_catalog.to_regprocedure('living_chart_private.living_chart_actor_id()') is null
    or pg_catalog.to_regprocedure('living_chart_private.set_living_chart_sync_consent_impl(text,uuid,bigint,text)') is null
    or pg_catalog.to_regprocedure('living_chart_private.put_living_chart_moment_impl(uuid,bigint,bigint,uuid,jsonb)') is null
    or pg_catalog.to_regprocedure('living_chart_private.delete_living_chart_moment_impl(uuid,bigint,bigint,uuid)') is null then
    raise notice 'account retention: Living Chart is not installed; its deleting gate and owner-lock wrappers were skipped (apply this migration again after Living Chart launches)';
    return;
  end if;

  execute $ddl$
drop trigger if exists account_v2_terminal_gate on public.living_chart_sync_consents
$ddl$;

  execute $ddl$
create trigger account_v2_terminal_gate
before insert or update on public.living_chart_sync_consents
for each row execute function private.account_v2_reject_terminal_recreation()
$ddl$;

  execute $ddl$
drop trigger if exists account_v2_terminal_gate on public.living_chart_moments
$ddl$;

  execute $ddl$
create trigger account_v2_terminal_gate
before insert or update on public.living_chart_moments
for each row execute function private.account_v2_reject_terminal_recreation()
$ddl$;

  execute $ddl$
drop trigger if exists account_v2_terminal_gate on living_chart_private.living_chart_mutations
$ddl$;

  execute $ddl$
create trigger account_v2_terminal_gate
before insert or update on living_chart_private.living_chart_mutations
for each row execute function private.account_v2_reject_terminal_recreation()
$ddl$;

  -- Takes the account owner lock that deletion prepare takes first, so a Living
  -- Chart write and a prepare for the same account never wait on each other in
  -- opposite orders, and answers whether the caller's account is deleting. It
  -- takes no argument: the account is always the caller's own.
  execute $ddl$
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
$$
$ddl$;

  execute $ddl$
revoke all on function living_chart_private.living_chart_account_deleting()
  from public, anon
$ddl$;

  execute $ddl$
grant execute on function living_chart_private.living_chart_account_deleting()
  to authenticated, service_role
$ddl$;

  execute $ddl$
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
$$
$ddl$;

  execute $ddl$
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
$$
$ddl$;

  execute $ddl$
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
$$
$ddl$;

  execute $ddl$
revoke all on function public.set_living_chart_sync_consent(text, uuid, bigint, text)
  from public, anon
$ddl$;

  execute $ddl$
revoke all on function public.put_living_chart_moment(uuid, bigint, bigint, uuid, jsonb)
  from public, anon
$ddl$;

  execute $ddl$
revoke all on function public.delete_living_chart_moment(uuid, bigint, bigint, uuid)
  from public, anon
$ddl$;

  execute $ddl$
grant execute on function public.set_living_chart_sync_consent(text, uuid, bigint, text)
  to authenticated, service_role
$ddl$;

  execute $ddl$
grant execute on function public.put_living_chart_moment(uuid, bigint, bigint, uuid, jsonb)
  to authenticated, service_role
$ddl$;

  execute $ddl$
grant execute on function public.delete_living_chart_moment(uuid, bigint, bigint, uuid)
  to authenticated, service_role
$ddl$;

end;
$do$;

-- The assistant save RPC (20261015150000), unchanged except that it takes the
-- account owner lock before it replaces a site row: saved_pages' terminal
-- gate makes the owner lock part of every saved_pages insert, so the delete
-- that precedes the insert must come after that lock, as in prepare.
-- Installed only where the assistant accounts layer is (not production yet).
-- Apply this migration again after it launches.
do $do$
begin
  if pg_catalog.to_regprocedure('public.zodiacs_accounts_v1(text,jsonb)') is null
    or pg_catalog.to_regprocedure('zodiacs_accounts_private.oauth_active(uuid,uuid,uuid,text,timestamptz)') is null
    or (
      select count(*)
      from pg_catalog.pg_attribute
      where attrelid = 'public.saved_pages'::regclass
        and attname in ('source', 'summary', 'detail')
        and attnum > 0
        and not attisdropped
    ) <> 3 then
    raise notice 'account retention: the assistant accounts layer is not installed; zodiacs_accounts_v1 was not replaced (apply this migration again after it launches)';
    return;
  end if;

  execute $ddl$
create or replace function public.zodiacs_accounts_v1(operation text, input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  now_at timestamptz := clock_timestamp();
  owner uuid; saved public.saved_pages%rowtype;
begin
  if operation not in ('oauth', 'save') then raise exception using errcode = '22023', message = 'Unsupported accounts operation'; end if;
  if input->>'user' is null or input->>'session' is null or input->>'client' is null or input->>'resource' is null
    or not zodiacs_accounts_private.oauth_active((input->>'user')::uuid, (input->>'session')::uuid, (input->>'client')::uuid, input->>'resource', now_at) then
    return case when operation = 'oauth' then to_jsonb(false) else 'null'::jsonb end;
  end if;
  if operation = 'oauth' then return to_jsonb(true); end if;
  owner := (input->>'user')::uuid;
  -- The account owner lock that deletion prepare takes before it erases
  -- saved_pages, taken before the replacement below deletes a row. Without it
  -- the replacement holds that row and then waits on the owner lock in the
  -- insert's terminal gate while prepare holds the lock and waits on the row.
  perform pg_advisory_xact_lock(hashtextextended(owner::text, 7312025));
  -- The same link saved by the assistant again: one row, left exactly as it was.
  -- The same link saved on the site holds only the link, so the assistant's
  -- record (with its summary and worked-out result) takes its place.
  select * into saved from public.saved_pages where user_id = owner and href = input->>'href';
  if found and saved.source = 'assistant' then
    return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
  end if;
  if found then delete from public.saved_pages where id = saved.id; end if;
  begin
    -- saved_pages' own trigger serialises per account and enforces the 100-row limit.
    insert into public.saved_pages(user_id, kind, title, href, source, summary, detail)
      values (owner, input->>'kind', input->>'title', input->>'href', 'assistant', input->>'summary', input->'detail')
      returning * into saved;
  exception
    when unique_violation then
      select * into saved from public.saved_pages where user_id = owner and href = input->>'href';
      return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
    when raise_exception then
      if sqlerrm = 'saved_pages_full' then return to_jsonb('full'::text); end if;
      raise;
  end;
  return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', true);
end;
$$
$ddl$;

  execute $ddl$
revoke all on function public.zodiacs_accounts_v1(text, jsonb) from public, anon, authenticated
$ddl$;

  execute $ddl$
grant execute on function public.zodiacs_accounts_v1(text, jsonb) to service_role
$ddl$;

end;
$do$;

-- Sky Watch. The account owner lock, then the account state, the order of
-- prepare and terminal cleanup, which then erase the principals. Answers
-- whether the account must be refused: it is deleting, or its Auth identity
-- is gone (the reaper deletes Auth and, by cascade, the account state under
-- this same owner lock, so a caller that waited through it finds neither).
-- The checks run after the lock, on a fresh snapshot. Service only: the
-- watch RPC runs as the service role with invoker rights and cannot read
-- account state itself.
create or replace function private.account_v2_lock_owner_deleting(
  candidate_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if candidate_user_id is null then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(candidate_user_id::text, 7312025)
  );

  perform 1
  from private.account_states
  where user_id = candidate_user_id
  for update;

  if not exists (
    select 1
    from auth.users
    where id = candidate_user_id
      and deleted_at is null
  ) then
    return true;
  end if;

  return exists (
    select 1
    from private.account_states
    where user_id = candidate_user_id
      and status = 'deleting'
  );
end;
$$;

revoke all on function private.account_v2_lock_owner_deleting(uuid)
  from public, anon, authenticated;
grant execute on function private.account_v2_lock_owner_deleting(uuid)
  to service_role;

-- Refuses a new or refreshed OAuth principal for an account in deletion or
-- without an Auth identity, whatever path writes it. Revoking one (which only takes access away) and
-- token principals, which name no account, pass. The watch RPC takes the
-- owner lock before it touches a principal, so when this runs inside the RPC
-- the lock is already held and the order stays owner, then principal.
create or replace function private.account_v2_reject_deleting_watch_principal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.oauth_user is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.revoked
    and new.oauth_user is not distinct from old.oauth_user
  then
    return new;
  end if;

  if private.account_v2_lock_owner_deleting(new.oauth_user) then
    raise exception 'account is deleting'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.account_v2_reject_deleting_watch_principal()
  from public, anon, authenticated, service_role;

-- Sky Watch: installed only where Sky Watch is (not production yet).
-- Apply this migration again after Sky Watch launches.
do $do$
begin
  if pg_catalog.to_regclass('sky_watch.principals') is null
    or pg_catalog.to_regclass('sky_watch.subscriptions') is null
    or pg_catalog.to_regclass('sky_watch.outbox') is null
    or pg_catalog.to_regclass('sky_watch.oauth_clients') is null
    or pg_catalog.to_regclass('sky_watch.worker_state') is null
    or pg_catalog.to_regprocedure('sky_watch.oauth_active(uuid,uuid,uuid,timestamptz)') is null
    or pg_catalog.to_regprocedure('sky_watch.access_active(uuid,timestamptz)') is null
    or pg_catalog.to_regprocedure('public.zodiacs_sky_watch_v1(text,jsonb)') is null then
    raise notice 'account retention: Sky Watch is not installed; its principal gate, index and watch RPC changes were skipped (apply this migration again after Sky Watch launches)';
    return;
  end if;

  execute $ddl$
drop trigger if exists account_v2_terminal_gate on sky_watch.principals
$ddl$;

  execute $ddl$
create trigger account_v2_terminal_gate
before insert or update on sky_watch.principals
for each row execute function private.account_v2_reject_deleting_watch_principal()
$ddl$;

  -- Erasure finds an account's principals by oauth_user.
  execute $ddl$
create index if not exists principals_oauth_user_idx
on sky_watch.principals (oauth_user)
where oauth_user is not null
$ddl$;

  -- The Sky Watch RPC as of 20261006074029, with three changes: `oauth` takes
  -- the owner lock, answers null for an account in deletion or without an Auth
  -- identity, and checks the OAuth authorization again under the lock before it
  -- creates or refreshes a principal; `get`, `subscribe` and `unsubscribe` take
  -- the owner lock of an OAuth principal's account before they lock the
  -- principal, answering 'watch access unavailable' while that account is
  -- deleting or gone; and `enqueue` deletes expired principals first, in id
  -- order, before it touches any subscription. Everything else is unchanged.
  execute $ddl$
create or replace function public.zodiacs_sky_watch_v1(operation text, input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  now_at timestamptz := clock_timestamp();
  principal sky_watch.principals%rowtype;
  sub sky_watch.subscriptions%rowtype;
  work sky_watch.outbox%rowtype;
  progress sky_watch.progress%rowtype;
  item jsonb;
  until_at timestamptz;
  new_lease uuid;
  worker_lease uuid;
  watch_user uuid;
begin
  if operation = 'workerclaim' then
    insert into sky_watch.worker_state(singleton) values(true) on conflict do nothing;
    update sky_watch.worker_state set lease=gen_random_uuid(),lease_until=now_at+interval '3 minutes',last_started=now_at
      where singleton and (lease_until is null or lease_until<=now_at) returning lease into worker_lease;
    return to_jsonb(worker_lease);
  elsif operation = 'workerdone' then
    update sky_watch.worker_state set lease=null,lease_until=null,
      last_finished=now_at,last_ok=(input->>'ok')::boolean,
      last_result=input-'lease'
      where singleton and lease=(input->>'lease')::uuid;
    return '{}'::jsonb;
  end if;
  if operation = 'oauth' then
    if not exists(select 1 from sky_watch.oauth_clients where id=(input->>'client')::uuid and enabled and resource=input->>'resource')
      or not sky_watch.oauth_active((input->>'user')::uuid,(input->>'session')::uuid,(input->>'client')::uuid,now_at) then return null; end if;
    -- Account deletion erases this account's principals under the owner lock.
    if private.account_v2_lock_owner_deleting((input->>'user')::uuid) then return null; end if;
    -- The wait may have outlasted the session, the consent or the account:
    -- check the authorization again now that the owner lock is held.
    if not exists(select 1 from sky_watch.oauth_clients where id=(input->>'client')::uuid and enabled and resource=input->>'resource')
      or not sky_watch.oauth_active((input->>'user')::uuid,(input->>'session')::uuid,(input->>'client')::uuid,clock_timestamp()) then return null; end if;
    insert into sky_watch.principals(oauth_user,oauth_session,oauth_client,expires_at)
      values((input->>'user')::uuid,(input->>'session')::uuid,(input->>'client')::uuid,now_at+interval '7 days')
      on conflict(oauth_session) do update set expires_at=excluded.expires_at
      where not sky_watch.principals.revoked and sky_watch.principals.oauth_user=excluded.oauth_user and sky_watch.principals.oauth_client=excluded.oauth_client
      returning * into principal;
    if principal.id is null then return null; end if;
    return jsonb_build_object('id',principal.id,'expires_at',principal.expires_at);
  end if;
  if operation = 'grant' then
    insert into sky_watch.principals(token_hash,expires_at) values(input->>'token_hash',now_at+interval '7 days') returning * into principal;
    return jsonb_build_object('id',principal.id,'expires_at',principal.expires_at);
  end if;
  if operation = 'authenticate' then
    select * into principal from sky_watch.principals
      where token_hash = input->>'token_hash' and not revoked and expires_at > now_at;
    if not found then return null; end if;
    return jsonb_build_object('id', principal.id, 'expires_at', principal.expires_at);
  end if;
  if operation in ('get','subscribe','unsubscribe') then
    -- The owner lock before the principal's row lock, the order deletion uses.
    select p.oauth_user into watch_user from sky_watch.principals p where p.id = (input->>'owner')::uuid;
    if private.account_v2_lock_owner_deleting(watch_user) then raise exception 'watch access unavailable'; end if;
    select * into principal from sky_watch.principals where id = (input->>'owner')::uuid and sky_watch.access_active(id,now_at) for update;
    if not found then raise exception 'watch access unavailable'; end if;
    if exists(select 1 from sky_watch.subscriptions where id=input->>'id' and owner<>principal.id) then raise exception 'watch ownership mismatch'; end if;
    select * into sub from sky_watch.subscriptions where id = input->>'id' and owner = principal.id for update;
    if sub.id is null and (select count(*) from sky_watch.subscriptions where owner=principal.id) >= 1000 then raise exception 'watch metadata limit'; end if;
    if operation = 'get' then
      if sub.id is null then return null; end if;
      return jsonb_build_object('sealed',case when sub.active and sub.expires_at > now_at then sub.sealed else null end,
        'verified_until',sub.verified_until,'revision',sub.revision);
    elsif operation = 'unsubscribe' then
      -- A tombstone also cancels a creation whose callback is still being verified.
      insert into sky_watch.subscriptions(id,owner,name,filters,verified_until,expires_at,active)
        values(input->>'id',principal.id,input->>'name',input->'filters',now_at,now_at,false)
      on conflict(id) do update set active=false,sealed=null,previous_sealed=null,expires_at=now_at,revision=sky_watch.subscriptions.revision+1;
      delete from sky_watch.outbox where subscription_id=input->>'id';
      return '{}'::jsonb;
    end if;
    if coalesce(sub.revision,0) <> (input->>'expected_revision')::bigint then return null; end if;
    if (sub.id is null or not sub.active or sub.expires_at<=now_at) and (select count(*) from sky_watch.subscriptions where owner=principal.id and active and expires_at>now_at) >= 20 then
      raise exception 'watch subscription limit';
    end if;
    if sub.id is not null and (not sub.active or sub.expires_at<=now_at) then delete from sky_watch.outbox where subscription_id=sub.id; end if;
    until_at := least(principal.expires_at, now_at + make_interval(secs => least(604800000, greatest(1,(input->>'ttl_ms')::bigint))/1000.0));
    insert into sky_watch.subscriptions(id,owner,name,filters,sealed,verified_until,expires_at)
      values(input->>'id',principal.id,input->>'name',input->'filters',input->>'sealed',now_at+interval '10 minutes',until_at)
    on conflict(id) do update set
      sealed=excluded.sealed,
      previous_sealed=case when (input->>'rotated')::boolean then sky_watch.subscriptions.sealed
        when sky_watch.subscriptions.rotate_until > now_at then sky_watch.subscriptions.previous_sealed else null end,
      rotate_until=case when (input->>'rotated')::boolean then now_at+interval '5 minutes' else sky_watch.subscriptions.rotate_until end,
      started_at=case when not sky_watch.subscriptions.active or sky_watch.subscriptions.expires_at <= now_at then now_at else sky_watch.subscriptions.started_at end,
      verified_until=case when (input->>'verified')::boolean then excluded.verified_until else sky_watch.subscriptions.verified_until end,
      expires_at=excluded.expires_at,active=true,revision=sky_watch.subscriptions.revision+1;
    return jsonb_build_object('expires_at',until_at);
  elsif operation = 'revoke' then
    update sky_watch.principals set revoked=true where id=(input->>'owner')::uuid;
    update sky_watch.subscriptions set active=false,sealed=null,previous_sealed=null,expires_at=now_at,revision=revision+1 where owner=(input->>'owner')::uuid;
    delete from sky_watch.outbox where subscription_id in (select id from sky_watch.subscriptions where owner=(input->>'owner')::uuid);
    return '{}'::jsonb;
  elsif operation = 'window' then
    insert into sky_watch.progress(singleton,version,next_from) values(true,input->>'version',(input->>'start')::timestamptz) on conflict do nothing;
    select * into progress from sky_watch.progress;
    if progress.version <> input->>'version' then raise exception 'watch engine migration required'; end if;
    return to_jsonb(progress.next_from);
  elsif operation = 'ingest' then
    select * into progress from sky_watch.progress for update;
    if progress.version is null or progress.version <> input->>'version' then raise exception 'watch engine migration required'; end if;
    if progress.next_from <> (input->>'from')::timestamptz then return to_jsonb(false); end if;
    if (input->>'to')::timestamptz <> progress.next_from + interval '24 hours' or jsonb_array_length(input->'events') > 100 then raise exception 'watch window invalid'; end if;
    for item in select value from jsonb_array_elements(input->'events') loop
      if (item->>'timestamp')::timestamptz <= progress.next_from or (item->>'timestamp')::timestamptz > (input->>'to')::timestamptz then raise exception 'watch event outside window'; end if;
      insert into sky_watch.ledger(id,name,at,payload) values(item->>'eventId',item->>'name',(item->>'timestamp')::timestamptz,item) on conflict do nothing;
    end loop;
    update sky_watch.progress set next_from=(input->>'to')::timestamptz where singleton = true;
    return to_jsonb(true);
  elsif operation = 'enqueue' then
    -- Maintenance is bounded by the short preview TTL and the one-month ledger retention.
    -- Expired principals go first, locked in id order, so maintenance takes
    -- principal before subscription like account deletion does (deleting a
    -- principal cascades its subscriptions and their outbox rows).
    perform 1 from sky_watch.principals where expires_at < now_at-interval '30 days' order by id for update;
    delete from sky_watch.principals where expires_at < now_at-interval '30 days';
    update sky_watch.subscriptions s set active=false,sealed=null,previous_sealed=null,revision=revision+1
      where s.active and (s.expires_at<=now_at or not exists(select 1 from sky_watch.principals p where p.id=s.owner and sky_watch.access_active(p.id,now_at)));
    update sky_watch.subscriptions set previous_sealed=null where previous_sealed is not null and rotate_until<=now_at;
    delete from sky_watch.outbox o where exists(select 1 from sky_watch.subscriptions s where s.id=o.subscription_id and not s.active);
    delete from sky_watch.ledger where at < now_at-interval '30 days';
    delete from sky_watch.subscriptions where not active and expires_at < now_at-interval '30 days';
    update sky_watch.outbox set state='failed',lease=null,lease_until=null where state='leased' and lease_until<=now_at and attempts>=8;
    insert into sky_watch.outbox(subscription_id,event_id,due_at)
      select s.id,e.id,e.at from sky_watch.subscriptions s join sky_watch.principals p on p.id=s.owner
      join sky_watch.ledger e on e.name=s.name and e.at>s.started_at and e.at<=s.expires_at
      where s.active and s.expires_at>now_at and sky_watch.access_active(p.id,now_at)
        and (case when e.name='zodiacs.sky.lunation' then (s.filters->'phases') ? (e.payload#>>'{data,event,type}')
          else (s.filters->'bodies') ? (e.payload#>>'{data,event,body}') end)
      on conflict do nothing;
    return '{}'::jsonb;
  elsif operation = 'claim' then
    select o.* into work from sky_watch.outbox o join sky_watch.subscriptions s on s.id=o.subscription_id
      join sky_watch.principals p on p.id=s.owner
      where ((o.state='pending' and o.due_at<=now_at) or (o.state='leased' and o.lease_until<=now_at))
        and o.attempts<8 and s.active and s.expires_at>now_at and sky_watch.access_active(p.id,now_at)
      order by o.due_at,o.subscription_id,o.event_id limit 1 for update of o skip locked;
    if not found then return null; end if;
    new_lease:=gen_random_uuid();
    update sky_watch.outbox set state='leased',attempts=attempts+1,lease=new_lease,lease_until=now_at+interval '2 minutes'
      where subscription_id=work.subscription_id and event_id=work.event_id;
    select * into sub from sky_watch.subscriptions where id=work.subscription_id;
    return jsonb_build_object('subscription_id',sub.id,'event_id',work.event_id,'lease',new_lease,'attempts',work.attempts+1,
      'sealed',sub.sealed,'previous_sealed',sub.previous_sealed,'rotate_until',sub.rotate_until,'filters',sub.filters,'revision',sub.revision,
      'payload',(select payload from sky_watch.ledger where id=work.event_id));
  elsif operation = 'permit' then
    return to_jsonb(exists(select 1 from sky_watch.outbox o join sky_watch.subscriptions s on s.id=o.subscription_id join sky_watch.principals p on p.id=s.owner
      where o.subscription_id=input->>'id' and o.event_id=input->>'event' and o.lease=(input->>'lease')::uuid and o.state='leased' and o.lease_until>now_at
        and s.revision=(input->>'revision')::bigint and s.active and s.expires_at>now_at and sky_watch.access_active(p.id,now_at)));
  elsif operation = 'settle' then
    -- Keep cancellation, refresh, maintenance and completion in sub -> outbox lock order.
    perform 1 from sky_watch.subscriptions where id=input->>'id' for update;
    update sky_watch.outbox set state=case input->>'outcome' when 'sent' then 'sent' when 'retry' then 'pending' else 'failed' end,
      due_at=now_at+make_interval(secs=>least(3600,greatest(0,(input->>'delay_seconds')::integer))),lease=null,lease_until=null
      where subscription_id=input->>'id' and event_id=input->>'event' and lease=(input->>'lease')::uuid and state='leased' and lease_until>now_at;
    if found and input->>'outcome'='gone' then
      update sky_watch.subscriptions set active=false,sealed=null,previous_sealed=null,expires_at=now_at,revision=revision+1 where id=input->>'id';
      delete from sky_watch.outbox where subscription_id=input->>'id';
    end if;
    return '{}'::jsonb;
  end if;
  raise exception 'watch operation unavailable';
end;
$$
$ddl$;

  execute $ddl$
revoke all on function public.zodiacs_sky_watch_v1(text,jsonb) from public,anon,authenticated
$ddl$;

  execute $ddl$
grant execute on function public.zodiacs_sky_watch_v1(text,jsonb) to service_role
$ddl$;

end;
$do$;

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

  -- The Auth parent first, the order every weekly digest transition and the
  -- Auth deletion's own cascade use (Auth, then profile, owner, delivery and
  -- capability). Erasing delivery rows before this lock could wait in a cycle
  -- with a digest transition that holds Auth and waits on a delivery row.
  -- When the identity is already gone there is nothing to lock or wait for.
  perform 1
  from auth.users as users
  where users.id = candidate_user_id
  for update;

  -- Then the lock order of prepare and terminal cleanup: every recipient alias
  -- the account or its receipts know, then invite authority, then the owner.
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

-- Deletion prepare (20260811153303), unchanged except for the recovery
-- rotation prune: an expired receipt that is not completed, of an account that
-- is still deleting, is no longer removed here (its delete would cascade the
-- Daily Sun provider reconciliation records) but kept for the reaper. A kept
-- expired receipt is treated as absent, as before: it counts against no cap,
-- and a prepare that names it again gives it a fresh seven day window in
-- place, which is what deleting and inserting it again used to give.
create or replace function public.account_v2_prepare_deletion(
  candidate_user_id uuid,
  candidate_request_id uuid,
  candidate_request_fingerprints jsonb,
  candidate_provider_cleanup_entries jsonb,
  candidate_provider_cleanup_inventory_complete boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  current_state private.account_states%rowtype;
  current_receipt private.account_deletion_receipts%rowtype;
  replay_mutation private.account_sync_mutations%rowtype;
  result_value jsonb;
  operation_time timestamptz := clock_timestamp();
  response_outcome text;
  current_alias text;
begin
  if candidate_user_id is null
    or candidate_request_id is null
    or not private.account_v2_valid_request_fingerprints(
      candidate_request_fingerprints
    )
    or not private.account_v2_valid_provider_cleanup_entries(
      candidate_provider_cleanup_entries
    )
    or candidate_provider_cleanup_inventory_complete is null
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  -- Lock every known/supplied recipient before the owner row, matching Daily
  -- Sun subscribe/confirm ordering. The API supplies the current alias first;
  -- the stable alias table contributes historical aliases, including overflow.
  for current_alias in
    select distinct aliases.recipient_hash
    from (
      select recipient_hash
      from private.account_daily_sun_recipient_aliases
      where user_id = candidate_user_id
      union all
      select value->>'recipient_hash'
      from jsonb_array_elements(candidate_provider_cleanup_entries)
    ) as aliases
    order by aliases.recipient_hash
  loop
    perform pg_advisory_xact_lock(hashtextextended(current_alias, 7312026));
  end loop;

  -- Match compatibility-invite and terminal-cleanup lock ordering. Taking the
  -- invite authority before the legacy cutover lock prevents prepare from
  -- deadlocking with an invite transaction whose terminal trigger acquires
  -- the cutover lock after its own authority lock.
  perform pg_advisory_xact_lock(
    hashtextextended(candidate_user_id::text, 7312030)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(candidate_user_id::text, 7312025)
  );

  insert into private.account_states (user_id)
  values (candidate_user_id)
  on conflict (user_id) do nothing;

  select * into current_state
  from private.account_states
  where user_id = candidate_user_id
  for update;

  select * into replay_mutation
  from private.account_sync_mutations
  where user_id = candidate_user_id
    and mutation_id = candidate_request_id;

  if found and (
    replay_mutation.operation <> 'prepare_deletion'
    or not exists (
      select 1
      from jsonb_array_elements_text(candidate_request_fingerprints)
        as supplied(verifier)
      where supplied.verifier = replay_mutation.request_fingerprint_verifier
    )
  ) then
    return jsonb_build_object('outcome', 'mutation_conflict');
  end if;

  -- Recovery rotation is serialized by the owner row above. Prune this
  -- account's expired capabilities inline, then cap live receipts so repeated
  -- fresh request IDs cannot amplify durable/provider work without bound.
  -- An expired receipt that is not completed while the account is deleting
  -- stays, with its Daily Sun provider reconciliation records, until the
  -- retention reaper has finished the deletion (20261113090000).
  delete from private.account_deletion_receipts
  where user_id = candidate_user_id
    and expires_at <= operation_time
    and (
      completed_at is not null
      or current_state.status <> 'deleting'
    );

  select * into current_receipt
  from private.account_deletion_receipts
  where request_id = candidate_request_id
  for update;

  if found and (
    current_receipt.user_id <> candidate_user_id
    or not exists (
      select 1
      from jsonb_array_elements_text(candidate_request_fingerprints)
        as supplied(verifier)
      where supplied.verifier = current_receipt.recovery_verifier
    )
  ) then
    return jsonb_build_object('outcome', 'mutation_conflict');
  end if;

  -- A kept expired receipt counts as absent, exactly as when prune removed
  -- it: it is subject to the cap and, when the same request ID comes back,
  -- gets a fresh seven day window in place (its provider records stay).
  if (
    current_receipt.request_id is null
    or current_receipt.expires_at <= operation_time
  ) and (
    select count(*)
    from private.account_deletion_receipts
    where user_id = candidate_user_id
      and expires_at > operation_time
  ) >= 3 then
    return jsonb_build_object('outcome', 'receipt_limit_reached');
  end if;

  if current_receipt.request_id is not null
    and current_receipt.expires_at <= operation_time
  then
    update private.account_deletion_receipts
    set expires_at = operation_time + interval '7 days'
    where request_id = candidate_request_id
    returning * into current_receipt;
  end if;

  if current_state.status = 'active' then
    update private.account_states
    set status = 'deleting',
        deletion_request_id = candidate_request_id,
        deletion_started_at = operation_time,
        updated_at = operation_time
    where user_id = candidate_user_id
    returning * into current_state;
    response_outcome := 'prepared';
  else
    response_outcome := case
      when current_state.deletion_request_id = candidate_request_id
        then 'prepared'
      else 'already_prepared'
    end;
  end if;

  if current_receipt.request_id is null then
    insert into private.account_deletion_receipts (
      request_id,
      user_id,
      recovery_verifier,
      prepared_at,
      daily_sun_was_confirmed,
      provider_cleanup_alias_count,
      provider_cleanup_inventory_complete,
      daily_sun_revoked,
      daily_sun_reconciliation_required,
      expires_at
    ) values (
      candidate_request_id,
      candidate_user_id,
      candidate_request_fingerprints->>0,
      current_state.deletion_started_at,
      current_state.daily_sun_was_confirmed or coalesce((
        select bool_or(existing.daily_sun_was_confirmed)
        from private.account_deletion_receipts as existing
        where existing.user_id = candidate_user_id
      ), false),
      0,
      candidate_provider_cleanup_inventory_complete,
      false,
      true,
      operation_time + interval '7 days'
    );
  end if;

  current_receipt := private.account_v2_reassert_terminal_cleanup(
    candidate_request_id,
    candidate_provider_cleanup_entries,
    candidate_provider_cleanup_inventory_complete
  );

  result_value := jsonb_build_object(
    'outcome', response_outcome,
    'request_id', candidate_request_id,
    'daily_sun_revoked', current_receipt.daily_sun_revoked,
    'daily_sun_reconciliation_required',
      current_receipt.daily_sun_reconciliation_required,
    'prepared_at', current_receipt.prepared_at
  );

  return result_value;
exception
  when foreign_key_violation then
    return jsonb_build_object('outcome', 'user_not_found');
  when unique_violation then
    return jsonb_build_object('outcome', 'mutation_conflict');
end;
$$;

revoke all on function public.account_v2_prepare_deletion(uuid, uuid, jsonb, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.account_v2_prepare_deletion(uuid, uuid, jsonb, jsonb, boolean)
  to service_role;

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

-- 6. Key rotation support ------------------------------------------------------
--
-- Service-only RPCs for scripts/account-sync-v2-rewrap.ts. Envelope AEAD binds
-- the key version only in the data-key wrap, so a rotation re-wraps the data
-- key and leaves ciphertext and nonce untouched. Nothing here returns or
-- accepts ciphertext. See docs/ACCOUNT-SYNC-V2-KEY-ROTATION.md.

-- Rows per kind and key version: the evidence that an old version is unused.
create or replace function public.account_v2_key_version_inventory()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', inventory.kind,
    'key_version', inventory.key_version,
    'rows', inventory.row_count
  ) order by inventory.kind, inventory.key_version), '[]'::jsonb)
  from (
    select 'chart' as kind, key_version, count(*) as row_count
    from private.account_chart_secret_envelopes
    group by key_version
    union all
    select 'alias', locator_key_version, count(*)
    from private.account_daily_sun_recipient_aliases
    where locator_key_version is not null
    group by locator_key_version
    union all
    select 'provider', payload_key_version, count(*)
    from private.account_deletion_provider_cleanup
    where payload_key_version is not null
    group by payload_key_version
  ) as inventory;
$$;

revoke all on function public.account_v2_key_version_inventory()
  from public, anon, authenticated;
grant execute on function public.account_v2_key_version_inventory()
  to service_role;

-- One ordered page of rows still wrapped under candidate_key_version, with
-- only the ids, the AEAD context and the wrapped data key. PostgreSQL's base64
-- breaks lines every 76 characters, so the line breaks are removed and the
-- wrapped key travels as one unbroken string.
create or replace function public.account_v2_rewrap_candidates(
  candidate_kind text,
  candidate_key_version integer,
  candidate_limit integer
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  result_rows jsonb;
begin
  if candidate_kind is null
    or candidate_kind not in ('chart', 'alias', 'provider')
    or candidate_key_version is null
    or candidate_key_version not between 1 and 1000000
    or candidate_limit is null
    or candidate_limit not between 1 and 500
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  if candidate_kind = 'chart' then
    select coalesce(jsonb_agg(page.row_value order by page.user_id, page.chart_id), '[]'::jsonb)
    into result_rows
    from (
      select user_id, chart_id, jsonb_build_object(
        'user_id', user_id,
        'chart_id', chart_id,
        'revision', revision,
        'key_version', key_version,
        'wrapped_key', translate(encode(wrapped_key, 'base64'), E'\n\r', '')
      ) as row_value
      from private.account_chart_secret_envelopes
      where key_version = candidate_key_version
      order by user_id, chart_id
      limit candidate_limit
    ) as page;
  elsif candidate_kind = 'alias' then
    select coalesce(jsonb_agg(page.row_value order by page.user_id, page.recipient_hash), '[]'::jsonb)
    into result_rows
    from (
      select user_id, recipient_hash, jsonb_build_object(
        'user_id', user_id,
        'recipient_hash', recipient_hash,
        'key_version', locator_key_version,
        'wrapped_key', translate(encode(locator_wrapped_key, 'base64'), E'\n\r', '')
      ) as row_value
      from private.account_daily_sun_recipient_aliases
      where locator_key_version = candidate_key_version
      order by user_id, recipient_hash
      limit candidate_limit
    ) as page;
  else
    select coalesce(jsonb_agg(page.row_value order by page.request_id, page.recipient_hash), '[]'::jsonb)
    into result_rows
    from (
      select request_id, recipient_hash, jsonb_build_object(
        'request_id', request_id,
        'recipient_hash', recipient_hash,
        'key_version', payload_key_version,
        'wrapped_key', translate(encode(payload_wrapped_key, 'base64'), E'\n\r', '')
      ) as row_value
      from private.account_deletion_provider_cleanup
      where payload_key_version = candidate_key_version
      order by request_id, recipient_hash
      limit candidate_limit
    ) as page;
  end if;

  return jsonb_build_object('outcome', 'ready', 'rows', result_rows);
end;
$$;

revoke all on function public.account_v2_rewrap_candidates(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.account_v2_rewrap_candidates(text, integer, integer)
  to service_role;

-- Applies re-wrapped data keys. Each row is a compare-and-swap on its ids, its
-- old key version and old wrapped key (and, for a chart, its revision): a row
-- that changed since it was listed is skipped, so the call is idempotent and
-- never overwrites a newer write.
create or replace function public.account_v2_rewrap_apply(
  candidate_kind text,
  candidate_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  row_value jsonb;
  new_wrapped bytea;
  old_wrapped bytea;
  new_version integer;
  old_version integer;
  changed integer;
  updated_count integer := 0;
  skipped_count integer := 0;
begin
  if candidate_kind is null
    or candidate_kind not in ('chart', 'alias', 'provider')
    or jsonb_typeof(candidate_rows) <> 'array'
    or jsonb_array_length(candidate_rows) not between 1 and 500
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  for row_value in select value from jsonb_array_elements(candidate_rows)
  loop
    begin
      old_version := (row_value->>'old_key_version')::integer;
      new_version := (row_value->>'new_key_version')::integer;
      old_wrapped := decode(row_value->>'old_wrapped_key', 'base64');
      new_wrapped := decode(row_value->>'new_wrapped_key', 'base64');
    exception
      when others then
        return jsonb_build_object('outcome', 'invalid');
    end;
    if old_version is null or new_version is null
      or old_version = new_version
      or new_version not between 1 and 1000000
      or octet_length(old_wrapped) <> 68
      or octet_length(new_wrapped) <> 68
    then
      return jsonb_build_object('outcome', 'invalid');
    end if;

    if candidate_kind = 'chart' then
      update private.account_chart_secret_envelopes
      set key_version = new_version,
          wrapped_key = new_wrapped
      where user_id = (row_value->>'user_id')::uuid
        and chart_id = (row_value->>'chart_id')::uuid
        and revision = (row_value->>'revision')::bigint
        and key_version = old_version
        and wrapped_key = old_wrapped;
    elsif candidate_kind = 'alias' then
      update private.account_daily_sun_recipient_aliases
      set locator_key_version = new_version,
          locator_wrapped_key = new_wrapped
      where user_id = (row_value->>'user_id')::uuid
        and recipient_hash = row_value->>'recipient_hash'
        and locator_key_version = old_version
        and locator_wrapped_key = old_wrapped;
    else
      update private.account_deletion_provider_cleanup
      set payload_key_version = new_version,
          payload_wrapped_key = new_wrapped
      where request_id = (row_value->>'request_id')::uuid
        and recipient_hash = row_value->>'recipient_hash'
        and payload_key_version = old_version
        and payload_wrapped_key = old_wrapped;
    end if;
    get diagnostics changed = row_count;
    if changed = 1 then
      updated_count := updated_count + 1;
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'outcome', 'applied',
    'updated', updated_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.account_v2_rewrap_apply(text, jsonb)
  from public, anon, authenticated;
grant execute on function public.account_v2_rewrap_apply(text, jsonb)
  to service_role;

-- 7. Export of the later tables ---------------------------------------------
--
-- The account export's saved pages and Living Chart moments, read in one call
-- that works whatever is installed. Production has saved_pages without the
-- assistant columns and no Living Chart yet; reading those through the REST
-- API would fail the whole export. A site save without the assistant columns
-- is exported as the column defaults would make it: source 'site', no summary,
-- no detail. A missing table exports no rows. Each list stops one row past
-- the export's own limit, so the API can refuse an account over the limit
-- exactly as before.
create or replace function private.account_v2_export_later_tables(
  candidate_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  saved_rows jsonb := '[]'::jsonb;
  moment_rows jsonb := '[]'::jsonb;
begin
  if candidate_user_id is null then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  if pg_catalog.to_regclass('public.saved_pages') is not null then
    if (
      select count(*)
      from pg_catalog.pg_attribute
      where attrelid = 'public.saved_pages'::regclass
        and attname in ('source', 'summary', 'detail')
        and attnum > 0
        and not attisdropped
    ) = 3 then
      execute $query$
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', page.id,
          'kind', page.kind,
          'title', page.title,
          'href', page.href,
          'source', page.source,
          'summary', page.summary,
          'detail', page.detail,
          'saved_at', page.saved_at
        ) order by page.saved_at, page.id), '[]'::jsonb)
        from (
          select id, kind, title, href, source, summary, detail, saved_at
          from public.saved_pages
          where user_id = $1
          order by saved_at, id
          limit 101
        ) as page
      $query$
      into saved_rows
      using candidate_user_id;
    else
      execute $query$
        select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
          'id', page.id,
          'kind', page.kind,
          'title', page.title,
          'href', page.href,
          'source', 'site',
          'summary', null,
          'detail', null,
          'saved_at', page.saved_at
        ) order by page.saved_at, page.id), '[]'::jsonb)
        from (
          select id, kind, title, href, saved_at
          from public.saved_pages
          where user_id = $1
          order by saved_at, id
          limit 101
        ) as page
      $query$
      into saved_rows
      using candidate_user_id;
    end if;
  end if;

  if pg_catalog.to_regclass('public.living_chart_moments') is not null then
    execute $query$
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'moment_id', moment.moment_id,
        'consent_epoch', moment.consent_epoch,
        'revision', moment.revision,
        'payload', moment.payload,
        'created_at', moment.created_at,
        'updated_at', moment.updated_at,
        'deleted_at', moment.deleted_at
      ) order by moment.created_at, moment.moment_id), '[]'::jsonb)
      from (
        select moment_id, consent_epoch, revision, payload, created_at,
          updated_at, deleted_at
        from public.living_chart_moments
        where user_id = $1
        order by created_at, moment_id
        limit 1001
      ) as moment
    $query$
    into moment_rows
    using candidate_user_id;
  end if;

  return jsonb_build_object(
    'outcome', 'ready',
    'saved_pages', saved_rows,
    'living_chart_moments', moment_rows
  );
end;
$$;

revoke all on function private.account_v2_export_later_tables(uuid)
  from public, anon, authenticated;
grant execute on function private.account_v2_export_later_tables(uuid)
  to service_role;

create or replace function public.account_v2_export_later_tables(
  candidate_user_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select private.account_v2_export_later_tables(candidate_user_id);
$$;

revoke all on function public.account_v2_export_later_tables(uuid)
  from public, anon, authenticated;
grant execute on function public.account_v2_export_later_tables(uuid)
  to service_role;
