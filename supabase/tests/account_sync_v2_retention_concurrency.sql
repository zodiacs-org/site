\set ON_ERROR_STOP on

-- Run after every migration, including 20261113090000. Lock order regressions
-- for the retention migration, each on a fixed schedule over dblink:
--
-- 1. The assistant save RPC replacing a site row while deletion prepare holds
--    the account owner lock. The save must wait for the owner lock before it
--    deletes the row it replaces; otherwise prepare waits on that row while
--    the save's insert waits on the owner lock.
-- 2. The reaper finishing a stranded deletion while a weekly digest
--    transition holds the Auth row. The reaper must wait on the Auth row
--    before it erases delivery rows; otherwise the digest waits on a delivery
--    row while the reaper's Auth delete waits on the digest.
-- 3. Sky Watch's subscribe and OAuth refresh while deletion prepare holds the
--    account owner lock. The watch RPC must wait for the owner lock before it
--    locks the principal that prepare erases, and must then refuse the
--    deleting account instead of writing.
-- 4. Sky Watch's OAuth refresh waiting on the owner lock while the reaper
--    deletes the Auth identity (and, by cascade, the account state) and
--    commits. The refresh must check again under the lock and create nothing,
--    not an orphan principal for an account that no longer exists.
-- 5. Sky Watch maintenance (`enqueue`) against deletion prepare holding an
--    expired principal. Maintenance must lock principals before it touches
--    their subscriptions; otherwise it holds a subscription while prepare
--    holds its principal, and each waits for the other.
--
-- All people here are synthetic test ids.

create extension if not exists dblink;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

-- Waits (up to five seconds) until the backend is queued on a lock. pg_locks
-- is read live, unlike the per-transaction pg_stat_activity snapshot.
create or replace function pg_temp.wait_for_lock_wait(candidate_pid integer, label text)
returns void
language plpgsql
as $$
begin
  for attempt in 1..500 loop
    if exists (
      select 1 from pg_catalog.pg_locks
      where pid = candidate_pid and not granted
    ) then
      return;
    end if;
    perform pg_catalog.pg_sleep(0.01);
  end loop;
  raise exception 'assertion failed: % never waited on a lock', label;
end;
$$;

create or replace function pg_temp.backend_pid(connection_name text)
returns integer
language sql
as $$
  select pid
  from dblink(connection_name, 'select pg_backend_pid()') as result(pid integer);
$$;

create temporary table retention_concurrency_results (
  key text primary key,
  value text
);

select dblink_connect(
  'retention_owner',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'retention_writer',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('retention_owner', 'set role service_role');
select dblink_exec('retention_writer', 'set role service_role');
select dblink_exec('retention_owner', 'set statement_timeout = ''10s''');
select dblink_exec('retention_writer', 'set statement_timeout = ''10s''');

create temporary table retention_concurrency_pids as
select name, pg_temp.backend_pid(name) as pid
from (values ('retention_owner'), ('retention_writer')) as connections(name);

-- 1. Assistant save replacement against deletion prepare ----------------------

set role supabase_auth_admin;
insert into auth.users (id) values ('a1000000-0000-4000-8000-000000000001');
insert into auth.oauth_clients (id) values ('a3000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id, oauth_client_id, scopes) values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'openid email'
);
insert into auth.oauth_consents (user_id, client_id, scopes) values (
  'a1000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'openid email'
);
reset role;
insert into zodiacs_accounts_private.oauth_clients (id, resource) values (
  'a3000000-0000-4000-8000-000000000001',
  'https://zodiacs.org/mcp'
);

-- The site row the assistant's save replaces.
insert into public.saved_pages (user_id, kind, title, href) values (
  'a1000000-0000-4000-8000-000000000001',
  'occasion',
  'A saved card',
  '/occasions/#retention-race'
);

-- Deletion prepare's first steps: the owner lock, held open.
select dblink_exec('retention_owner', 'begin');
select dblink_exec(
  'retention_owner',
  $$do $lock$ begin
    perform pg_advisory_xact_lock(
      hashtextextended('a1000000-0000-4000-8000-000000000001', 7312025)
    );
  end $lock$;$$
);

select dblink_send_query(
  'retention_writer',
  $$select public.zodiacs_accounts_v1('save', jsonb_build_object(
    'user', 'a1000000-0000-4000-8000-000000000001',
    'session', 'a2000000-0000-4000-8000-000000000001',
    'client', 'a3000000-0000-4000-8000-000000000001',
    'resource', 'https://zodiacs.org/mcp',
    'kind', 'occasion',
    'title', 'A saved card',
    'href', '/occasions/#retention-race',
    'summary', 'A good day.',
    'detail', jsonb_build_object(
      'schema', 'zodiacs.assistant-save.v1',
      'kind', 'occasion',
      'title', 'A saved card',
      'summary', 'A good day.',
      'data', '{}'::jsonb,
      'links', '[]'::jsonb
    )
  ))::text$$
);

select pg_temp.wait_for_lock_wait(
  (select pid from retention_concurrency_pids where name = 'retention_writer'),
  'the save'
);

select pg_temp.assert_true(
  dblink_is_busy('retention_writer') = 1,
  'the save must wait behind the deletion owner lock'
);

-- The saved row must still be free while the save waits; a save that had
-- already deleted it would hold its lock.
select pg_temp.assert_true(
  (
    select count(*) = 1
    from (
      select 1
      from public.saved_pages
      where user_id = 'a1000000-0000-4000-8000-000000000001'
      for update skip locked
    ) as free_rows
  ),
  'the save must not hold the saved row while it waits for the owner lock'
);

-- The rest of prepare in the same transaction: it erases saved_pages, which
-- must not wait on the save.
select dblink_send_query(
  'retention_owner',
  $$select public.account_v2_prepare_deletion(
    'a1000000-0000-4000-8000-000000000001',
    'a6000000-0000-4000-8000-000000000001',
    jsonb_build_array('v1:' || repeat('a', 64)),
    '[]'::jsonb,
    true
  )::text$$
);

insert into retention_concurrency_results
select 'save_race_prepare', value
from dblink_get_result('retention_owner', false) as result(value text);
insert into retention_concurrency_results
select 'save_race_prepare_error', dblink_error_message('retention_owner');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_owner', false) as drained(value text)
  ),
  'the prepare result must be fully drained'
);
select dblink_exec('retention_owner', 'commit');

insert into retention_concurrency_results
select 'save_race_save', value
from dblink_get_result('retention_writer', false) as result(value text);
insert into retention_concurrency_results
select 'save_race_save_error', dblink_error_message('retention_writer');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_writer', false) as drained(value text)
  ),
  'the save result must be fully drained'
);

select pg_temp.assert_true(
  (select value::jsonb->>'outcome' = 'prepared'
   from retention_concurrency_results where key = 'save_race_prepare')
    and not exists (select 1 from retention_concurrency_results
                    where key = 'save_race_save')
    and (select value like '%account is deleting%'
         from retention_concurrency_results where key = 'save_race_save_error')
    and not exists (select 1 from retention_concurrency_results
                    where value like '%deadlock%')
    and not exists (select 1 from public.saved_pages
                    where user_id = 'a1000000-0000-4000-8000-000000000001')
    and exists (select 1 from private.account_states
                where user_id = 'a1000000-0000-4000-8000-000000000001'
                  and status = 'deleting'),
  format(
    'prepare must erase saved_pages and the waiting save must meet the deleting gate, not a deadlock (%s)',
    (select jsonb_object_agg(key, value) from retention_concurrency_results)
  )
);

-- 2. The reaper against a weekly digest transition ----------------------------

insert into auth.users (id) values ('a1000000-0000-4000-8000-000000000002');

set role service_role;
select public.account_v2_prepare_deletion(
  'a1000000-0000-4000-8000-000000000002',
  'a6000000-0000-4000-8000-000000000002',
  jsonb_build_array('v1:' || repeat('b', 64)),
  '[]'::jsonb,
  true
);
reset role;

-- An account stranded before this migration: its delivery row survived the
-- old prepare, and its deletion started eight days ago.
insert into public.weekly_digest_deliveries (
  week_start, user_id, status, slot, lease_token, reserved_at, created_at, updated_at
) values (
  date_trunc('week', clock_timestamp() at time zone 'UTC')::date,
  'a1000000-0000-4000-8000-000000000002',
  'reserved',
  79,
  'a7000000-0000-4000-8000-000000000002',
  clock_timestamp(),
  clock_timestamp(),
  clock_timestamp()
);
update private.account_states
set deletion_started_at = clock_timestamp() - interval '8 days',
    created_at = least(created_at, clock_timestamp() - interval '9 days'),
    updated_at = greatest(updated_at, clock_timestamp() - interval '8 days')
where user_id = 'a1000000-0000-4000-8000-000000000002';
update private.account_deletion_receipts
set prepared_at = clock_timestamp() - interval '8 days',
    expires_at = clock_timestamp() - interval '1 day'
where user_id = 'a1000000-0000-4000-8000-000000000002';

-- A digest transition's first durable lock: the Auth parent. The digest
-- functions are SECURITY DEFINER, owned by postgres, so this session is too.
select dblink_exec('retention_writer', 'reset role');
select dblink_exec('retention_writer', 'begin');
select dblink_exec(
  'retention_writer',
  $$do $lock$ begin
    perform 1 from auth.users
    where id = 'a1000000-0000-4000-8000-000000000002'
    for update;
  end $lock$;$$
);

select dblink_send_query(
  'retention_owner',
  $$select private.account_v2_reap_deleting_account(
    'a1000000-0000-4000-8000-000000000002'
  )::text$$
);

select pg_temp.wait_for_lock_wait(
  (select pid from retention_concurrency_pids where name = 'retention_owner'),
  'the reaper'
);

select pg_temp.assert_true(
  dblink_is_busy('retention_owner') = 1,
  'the reaper must wait behind the digest''s Auth lock'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from (
      select 1
      from public.weekly_digest_deliveries
      where user_id = 'a1000000-0000-4000-8000-000000000002'
      for update skip locked
    ) as free_rows
  ),
  'the reaper must not hold a delivery row while it waits for the Auth row'
);

-- The digest's next lock, the delivery row, is free; it finishes and commits.
select dblink_exec(
  'retention_writer',
  $$do $lock$ begin
    perform 1 from public.weekly_digest_deliveries
    where user_id = 'a1000000-0000-4000-8000-000000000002'
    for update;
  end $lock$;$$
);
select dblink_exec('retention_writer', 'commit');

insert into retention_concurrency_results
select 'reaper_race', value
from dblink_get_result('retention_owner', false) as result(value text);
insert into retention_concurrency_results
select 'reaper_race_error', dblink_error_message('retention_owner');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_owner', false) as drained(value text)
  ),
  'the reaper result must be fully drained'
);

select pg_temp.assert_true(
  (select value = 'true' from retention_concurrency_results where key = 'reaper_race')
    and not exists (select 1 from auth.users
                    where id = 'a1000000-0000-4000-8000-000000000002')
    and not exists (select 1 from public.weekly_digest_deliveries
                    where user_id = 'a1000000-0000-4000-8000-000000000002'),
  format(
    'the reaper must finish after the digest commits (%s)',
    (select jsonb_object_agg(key, value) from retention_concurrency_results)
  )
);

-- 3. Sky Watch against deletion prepare --------------------------------------

set role supabase_auth_admin;
insert into auth.users (id) values ('a1000000-0000-4000-8000-000000000003');
insert into auth.oauth_clients (id) values ('a3000000-0000-4000-8000-000000000003');
insert into auth.sessions (id, user_id, oauth_client_id, scopes) values (
  'a2000000-0000-4000-8000-000000000003',
  'a1000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000003',
  'openid email'
);
insert into auth.oauth_consents (user_id, client_id, scopes) values (
  'a1000000-0000-4000-8000-000000000003',
  'a3000000-0000-4000-8000-000000000003',
  'openid email'
);
reset role;
insert into sky_watch.oauth_clients (id, resource) values (
  'a3000000-0000-4000-8000-000000000003',
  'https://zodiacs-retention-race.vercel.app/mcp'
);

set role service_role;
select public.zodiacs_sky_watch_v1('oauth', jsonb_build_object(
  'user', 'a1000000-0000-4000-8000-000000000003',
  'session', 'a2000000-0000-4000-8000-000000000003',
  'client', 'a3000000-0000-4000-8000-000000000003',
  'resource', 'https://zodiacs-retention-race.vercel.app/mcp'
))->>'id' as watch_principal \gset
select public.zodiacs_sky_watch_v1('subscribe', jsonb_build_object(
  'owner', :'watch_principal',
  'id', 'sub_' || repeat('a', 64),
  'name', 'zodiacs.sky.ingress',
  'filters', '{"bodies":["mars"]}'::jsonb,
  'sealed', 'sealed-test-callback',
  'expected_revision', 0,
  'ttl_ms', 86400000
));
reset role;
insert into retention_concurrency_results values ('watch_principal', :'watch_principal');

select pg_temp.assert_true(
  exists (select 1 from sky_watch.subscriptions
          where id = 'sub_' || repeat('a', 64) and active),
  'the fixture must hold an active Sky Watch subscription before deletion'
);

-- Deletion prepare's first step: the owner lock, held open.
select dblink_exec('retention_writer', 'set role service_role');
select dblink_exec('retention_owner', 'begin');
select dblink_exec(
  'retention_owner',
  $$do $lock$ begin
    perform pg_advisory_xact_lock(
      hashtextextended('a1000000-0000-4000-8000-000000000003', 7312025)
    );
  end $lock$;$$
);

select dblink_send_query(
  'retention_writer',
  format(
    $$select public.zodiacs_sky_watch_v1('subscribe', jsonb_build_object(
      'owner', %L,
      'id', 'sub_' || repeat('a', 64),
      'name', 'zodiacs.sky.ingress',
      'filters', '{"bodies":["mars","venus"]}'::jsonb,
      'sealed', 'sealed-test-callback',
      'expected_revision', 1,
      'ttl_ms', 86400000
    ))::text$$,
    (select value from retention_concurrency_results where key = 'watch_principal')
  )
);

select pg_temp.wait_for_lock_wait(
  (select pid from retention_concurrency_pids where name = 'retention_writer'),
  'the watch subscribe'
);

select pg_temp.assert_true(
  dblink_is_busy('retention_writer') = 1,
  'the watch subscribe must wait behind the deletion owner lock'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from (
      select 1
      from sky_watch.principals
      where oauth_user = 'a1000000-0000-4000-8000-000000000003'
      for update skip locked
    ) as free_rows
  ),
  'the watch subscribe must not hold the principal while it waits for the owner lock'
);

select dblink_send_query(
  'retention_owner',
  $$select public.account_v2_prepare_deletion(
    'a1000000-0000-4000-8000-000000000003',
    'a6000000-0000-4000-8000-000000000003',
    jsonb_build_array('v1:' || repeat('c', 64)),
    '[]'::jsonb,
    true
  )::text$$
);

insert into retention_concurrency_results
select 'watch_race_prepare', value
from dblink_get_result('retention_owner', false) as result(value text);
insert into retention_concurrency_results
select 'watch_race_prepare_error', dblink_error_message('retention_owner');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_owner', false) as drained(value text)
  ),
  'the prepare result must be fully drained'
);
select dblink_exec('retention_owner', 'commit');

insert into retention_concurrency_results
select 'watch_race_subscribe', value
from dblink_get_result('retention_writer', false) as result(value text);
insert into retention_concurrency_results
select 'watch_race_subscribe_error', dblink_error_message('retention_writer');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_writer', false) as drained(value text)
  ),
  'the subscribe result must be fully drained'
);

select pg_temp.assert_true(
  (select value::jsonb->>'outcome' = 'prepared'
   from retention_concurrency_results where key = 'watch_race_prepare')
    and not exists (select 1 from retention_concurrency_results
                    where key = 'watch_race_subscribe')
    and (select value like '%watch access unavailable%'
         from retention_concurrency_results where key = 'watch_race_subscribe_error')
    and not exists (select 1 from retention_concurrency_results
                    where value like '%deadlock%')
    and not exists (select 1 from sky_watch.principals
                    where oauth_user = 'a1000000-0000-4000-8000-000000000003')
    and not exists (select 1 from sky_watch.subscriptions
                    where id = 'sub_' || repeat('a', 64)),
  format(
    'prepare must erase the Sky Watch principal and the waiting subscribe must be refused, not deadlock (%s)',
    (select jsonb_object_agg(key, value) from retention_concurrency_results)
  )
);

-- An OAuth refresh that waits on the owner lock of a deleting account must
-- answer null and create nothing.
select dblink_exec('retention_owner', 'begin');
select dblink_exec(
  'retention_owner',
  $$do $lock$ begin
    perform pg_advisory_xact_lock(
      hashtextextended('a1000000-0000-4000-8000-000000000003', 7312025)
    );
  end $lock$;$$
);

select dblink_send_query(
  'retention_writer',
  $$select coalesce(public.zodiacs_sky_watch_v1('oauth', jsonb_build_object(
    'user', 'a1000000-0000-4000-8000-000000000003',
    'session', 'a2000000-0000-4000-8000-000000000003',
    'client', 'a3000000-0000-4000-8000-000000000003',
    'resource', 'https://zodiacs-retention-race.vercel.app/mcp'
  ))::text, 'refused')$$
);

select pg_temp.wait_for_lock_wait(
  (select pid from retention_concurrency_pids where name = 'retention_writer'),
  'the watch OAuth refresh'
);
select pg_temp.assert_true(
  dblink_is_busy('retention_writer') = 1,
  'the watch OAuth refresh must wait behind the deletion owner lock'
);
select dblink_exec('retention_owner', 'commit');

insert into retention_concurrency_results
select 'watch_race_oauth', value
from dblink_get_result('retention_writer', false) as result(value text);
insert into retention_concurrency_results
select 'watch_race_oauth_error', dblink_error_message('retention_writer');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_writer', false) as drained(value text)
  ),
  'the OAuth refresh result must be fully drained'
);

select pg_temp.assert_true(
  (select value = 'refused' from retention_concurrency_results where key = 'watch_race_oauth')
    and not exists (select 1 from sky_watch.principals
                    where oauth_user = 'a1000000-0000-4000-8000-000000000003'),
  format(
    'an OAuth refresh for a deleting account must be refused (%s)',
    (select jsonb_object_agg(key, value) from retention_concurrency_results)
  )
);

-- 4. Sky Watch OAuth against the reaper's Auth deletion ----------------------

set role supabase_auth_admin;
insert into auth.users (id) values ('a1000000-0000-4000-8000-000000000004');
insert into auth.oauth_clients (id) values ('a3000000-0000-4000-8000-000000000004');
insert into auth.sessions (id, user_id, oauth_client_id, scopes) values (
  'a2000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000004',
  'a3000000-0000-4000-8000-000000000004',
  'openid email'
);
insert into auth.oauth_consents (user_id, client_id, scopes) values (
  'a1000000-0000-4000-8000-000000000004',
  'a3000000-0000-4000-8000-000000000004',
  'openid email'
);
reset role;
insert into sky_watch.oauth_clients (id, resource) values (
  'a3000000-0000-4000-8000-000000000004',
  'https://zodiacs-retention-reaper-race.vercel.app/mcp'
);

-- A deletion prepared eight days ago and never finished.
set role service_role;
select public.account_v2_prepare_deletion(
  'a1000000-0000-4000-8000-000000000004',
  'a6000000-0000-4000-8000-000000000004',
  jsonb_build_array('v1:' || repeat('d', 64)),
  '[]'::jsonb,
  true
);
reset role;
update private.account_states
set deletion_started_at = clock_timestamp() - interval '8 days',
    created_at = least(created_at, clock_timestamp() - interval '9 days'),
    updated_at = greatest(updated_at, clock_timestamp() - interval '8 days')
where user_id = 'a1000000-0000-4000-8000-000000000004';
update private.account_deletion_receipts
set prepared_at = clock_timestamp() - interval '8 days',
    expires_at = clock_timestamp() - interval '1 day'
where user_id = 'a1000000-0000-4000-8000-000000000004';

-- The reaper finishes the deletion and holds its transaction open.
select dblink_exec('retention_owner', 'reset role');
select dblink_exec('retention_writer', 'set role service_role');
select dblink_exec('retention_owner', 'begin');
insert into retention_concurrency_results
select 'oauth_reaper_race_reaper', value
from dblink(
  'retention_owner',
  $$select private.account_v2_reap_deleting_account(
    'a1000000-0000-4000-8000-000000000004'
  )::text$$
) as result(value text);

-- The OAuth refresh still sees the Auth identity and its session, passes its
-- first authorization check, and waits on the owner lock.
select dblink_send_query(
  'retention_writer',
  $$select coalesce(public.zodiacs_sky_watch_v1('oauth', jsonb_build_object(
    'user', 'a1000000-0000-4000-8000-000000000004',
    'session', 'a2000000-0000-4000-8000-000000000004',
    'client', 'a3000000-0000-4000-8000-000000000004',
    'resource', 'https://zodiacs-retention-reaper-race.vercel.app/mcp'
  ))::text, 'refused')$$
);

select pg_temp.wait_for_lock_wait(
  (select pid from retention_concurrency_pids where name = 'retention_writer'),
  'the watch OAuth refresh behind the reaper'
);
select pg_temp.assert_true(
  dblink_is_busy('retention_writer') = 1,
  'the watch OAuth refresh must wait behind the reaper''s owner lock'
);
select dblink_exec('retention_owner', 'commit');

insert into retention_concurrency_results
select 'oauth_reaper_race_oauth', value
from dblink_get_result('retention_writer', false) as result(value text);
insert into retention_concurrency_results
select 'oauth_reaper_race_oauth_error', dblink_error_message('retention_writer');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_writer', false) as drained(value text)
  ),
  'the OAuth refresh result must be fully drained'
);

select pg_temp.assert_true(
  (select value = 'true' from retention_concurrency_results
   where key = 'oauth_reaper_race_reaper')
    and (select value = 'refused' from retention_concurrency_results
         where key = 'oauth_reaper_race_oauth')
    and not exists (select 1 from auth.users
                    where id = 'a1000000-0000-4000-8000-000000000004')
    and not exists (select 1 from private.account_states
                    where user_id = 'a1000000-0000-4000-8000-000000000004')
    and not exists (select 1 from sky_watch.principals
                    where oauth_user = 'a1000000-0000-4000-8000-000000000004'),
  format(
    'an OAuth refresh that waited through the reaper must create no principal (%s)',
    (select jsonb_object_agg(key, value) from retention_concurrency_results)
  )
);

-- A principal written straight to the table, past the RPC, is refused too.
do $orphan$
begin
  begin
    insert into sky_watch.principals (oauth_user, oauth_session, oauth_client, expires_at)
    values (
      'a1000000-0000-4000-8000-000000000004',
      'a2000000-0000-4000-8000-000000000044',
      'a3000000-0000-4000-8000-000000000004',
      clock_timestamp() + interval '7 days'
    );
  exception when insufficient_privilege then
    return;
  end;
  raise exception 'assertion failed: a principal was created for an account without an Auth identity';
end;
$orphan$;

-- 5. Sky Watch maintenance against deletion prepare --------------------------

insert into auth.users (id) values ('a1000000-0000-4000-8000-000000000005');
-- An OAuth principal that expired forty days ago, which maintenance deletes,
-- still owning an active subscription, which maintenance deactivates.
insert into sky_watch.principals (id, oauth_user, oauth_session, oauth_client, expires_at)
values (
  'a8000000-0000-4000-8000-000000000005',
  'a1000000-0000-4000-8000-000000000005',
  'a2000000-0000-4000-8000-000000000005',
  'a3000000-0000-4000-8000-000000000003',
  clock_timestamp() - interval '40 days'
);
insert into sky_watch.subscriptions (id, owner, name, filters, verified_until, expires_at)
values (
  'sub_' || repeat('5', 64),
  'a8000000-0000-4000-8000-000000000005',
  'zodiacs.sky.ingress',
  '{"bodies":["mars"]}'::jsonb,
  clock_timestamp(),
  clock_timestamp() + interval '1 day'
);

-- Deletion's Sky Watch step, held open: the account's principals, locked.
select dblink_exec('retention_owner', 'begin');
select dblink_exec(
  'retention_owner',
  $$do $lock$ begin
    perform 1 from sky_watch.principals
    where oauth_user = 'a1000000-0000-4000-8000-000000000005'
    order by id
    for update;
  end $lock$;$$
);

select dblink_send_query(
  'retention_writer',
  $$select public.zodiacs_sky_watch_v1('enqueue', '{}'::jsonb)::text$$
);

select pg_temp.wait_for_lock_wait(
  (select pid from retention_concurrency_pids where name = 'retention_writer'),
  'Sky Watch maintenance'
);
select pg_temp.assert_true(
  dblink_is_busy('retention_writer') = 1,
  'Sky Watch maintenance must wait behind the principal deletion holds'
);
select pg_temp.assert_true(
  (
    select count(*) = 1
    from (
      select 1
      from sky_watch.subscriptions
      where id = 'sub_' || repeat('5', 64)
      for update skip locked
    ) as free_rows
  ),
  'Sky Watch maintenance must not hold the subscription while it waits for the principal'
);

-- The rest of prepare in the same transaction erases the principal and,
-- by cascade, the subscription; it must not wait on maintenance.
select dblink_send_query(
  'retention_owner',
  $$select public.account_v2_prepare_deletion(
    'a1000000-0000-4000-8000-000000000005',
    'a6000000-0000-4000-8000-000000000005',
    jsonb_build_array('v1:' || repeat('e', 64)),
    '[]'::jsonb,
    true
  )::text$$
);

insert into retention_concurrency_results
select 'enqueue_race_prepare', value
from dblink_get_result('retention_owner', false) as result(value text);
insert into retention_concurrency_results
select 'enqueue_race_prepare_error', dblink_error_message('retention_owner');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_owner', false) as drained(value text)
  ),
  'the prepare result must be fully drained'
);
select dblink_exec('retention_owner', 'commit');

insert into retention_concurrency_results
select 'enqueue_race_enqueue', value
from dblink_get_result('retention_writer', false) as result(value text);
insert into retention_concurrency_results
select 'enqueue_race_enqueue_error', dblink_error_message('retention_writer');
select pg_temp.assert_true(
  not exists (
    select 1 from dblink_get_result('retention_writer', false) as drained(value text)
  ),
  'the enqueue result must be fully drained'
);

select pg_temp.assert_true(
  (select value::jsonb->>'outcome' = 'prepared'
   from retention_concurrency_results where key = 'enqueue_race_prepare')
    and (select value = '{}' from retention_concurrency_results
         where key = 'enqueue_race_enqueue')
    and not exists (select 1 from retention_concurrency_results
                    where value like '%deadlock%')
    and not exists (select 1 from sky_watch.principals
                    where oauth_user = 'a1000000-0000-4000-8000-000000000005')
    and not exists (select 1 from sky_watch.subscriptions
                    where id = 'sub_' || repeat('5', 64)),
  format(
    'prepare and Sky Watch maintenance must both finish without a deadlock (%s)',
    (select jsonb_object_agg(key, value) from retention_concurrency_results)
  )
);

select dblink_disconnect('retention_owner');
select dblink_disconnect('retention_writer');
