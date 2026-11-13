-- Disposable PostgreSQL 17 only. The save function and an ordinary saved_pages
-- insert take the same two account locks in the same order: the account owner
-- lock (account_v2_terminal_gate, 20261113090000_account_sync_v2_retention.sql)
-- first, then the account's saved pages lock (saved_pages_limit). Session A holds
-- the owner lock, as an ordinary insert does between its two triggers. Session B
-- runs a save for the same account: it must wait on the owner lock holding
-- nothing, so A's insert then passes saved_pages_limit, and both writes finish.
-- With the saved pages lock taken first, B would hold it while waiting for A and
-- A's insert would wait for B: a deadlock, which PostgreSQL ends by failing one.
-- Every value is synthetic; the rows are removed at the end.
\set ON_ERROR_STOP on

create extension if not exists dblink;

begin;
set local role supabase_auth_admin;
insert into auth.users(id) values ('00000000-0000-4000-8000-00000000f101');
insert into auth.oauth_clients(id) values ('00000000-0000-4000-8000-00000000f103');
insert into auth.sessions(id, user_id, oauth_client_id, scopes)
  values ('00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f103', 'openid');
insert into auth.oauth_consents(user_id, client_id, scopes)
  values ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f103', 'openid');
reset role;
insert into zodiacs_accounts_private.oauth_clients(id, resource)
  values ('00000000-0000-4000-8000-00000000f103', 'https://zodiacs.org/mcp');
commit;

create temporary table saved_lock_order (
  name text primary key,
  value bigint not null
);
insert into saved_lock_order values
  ('owner_key', pg_catalog.hashtextextended('00000000-0000-4000-8000-00000000f101', 7312025)),
  ('saved_pages_key', pg_catalog.hashtextextended('saved_pages:00000000-0000-4000-8000-00000000f101', 0));

select dblink_connect('saved_lock_a', format('dbname=%L user=%L', current_database(), current_user));
select dblink_connect('saved_lock_b', format('dbname=%L user=%L', current_database(), current_user));
select dblink_exec('saved_lock_a', 'set statement_timeout = ''10s''');
select dblink_exec('saved_lock_b', 'set statement_timeout = ''10s''');
select dblink_exec('saved_lock_b', 'set role service_role');
insert into saved_lock_order
  select 'b_pid', pid from dblink('saved_lock_b', 'select pg_catalog.pg_backend_pid()') as b(pid integer);

-- A: an ordinary write's first step, the account owner lock.
select dblink_exec('saved_lock_a', 'begin');
select dblink_exec('saved_lock_a', $$do $block$ begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('00000000-0000-4000-8000-00000000f101', 7312025));
end $block$;$$);

-- B: a save for the same account.
select dblink_send_query('saved_lock_b', $$select public.zodiacs_accounts_v1('save', jsonb_build_object(
  'user', '00000000-0000-4000-8000-00000000f101', 'session', '00000000-0000-4000-8000-00000000f102',
  'client', '00000000-0000-4000-8000-00000000f103', 'resource', 'https://zodiacs.org/mcp',
  'id', '00000000-0000-4000-8000-00000000f1b1', 'kind', 'chart', 'title', 'Lock order chart',
  'href', '/birth-chart/#saved=00000000-0000-4000-8000-00000000f1b1', 'summary', 'Sun in Aries.',
  'detail', jsonb_build_object('schema', 'zodiacs.assistant-save.v1', 'data', jsonb_build_object('sun', 'aries'),
    'href', '/birth-chart/#saved=00000000-0000-4000-8000-00000000f1b1')))::text$$);

-- B waits on the owner lock, holding no saved pages lock.
do $$
declare
  b integer := (select value from saved_lock_order where name = 'b_pid');
  owner_key bigint := (select value from saved_lock_order where name = 'owner_key');
  pages_key bigint := (select value from saved_lock_order where name = 'saved_pages_key');
begin
  for attempt in 1..200 loop
    exit when exists (select 1 from pg_catalog.pg_locks where pid = b and not granted);
    perform pg_catalog.pg_sleep(0.05);
  end loop;
  if not exists (
    select 1 from pg_catalog.pg_locks
    where pid = b and not granted and locktype = 'advisory' and objsubid = 1
      and classid = ((owner_key >> 32) & 4294967295)::oid and objid = (owner_key & 4294967295)::oid
  ) then
    raise exception 'Lock order assertion: the save does not wait on the account owner lock';
  end if;
  if exists (
    select 1 from pg_catalog.pg_locks
    where pid = b and granted and locktype = 'advisory' and objsubid = 1
      and classid = ((pages_key >> 32) & 4294967295)::oid and objid = (pages_key & 4294967295)::oid
  ) then
    raise exception 'Lock order assertion: the save holds the saved pages lock while it waits for the owner lock';
  end if;
end $$;

-- A finishes its ordinary insert (gate, then limit) and commits; B then saves.
select dblink_exec('saved_lock_a', $$insert into public.saved_pages(user_id, kind, title, href)
  values ('00000000-0000-4000-8000-00000000f101', 'occasion', 'Lock order occasion', '/occasions/#o=wedding&d=2030-01-01')$$);
select dblink_exec('saved_lock_a', 'commit');

create temporary table saved_lock_result as
  select result::jsonb as result from dblink_get_result('saved_lock_b') as b(result text);

do $$
begin
  if exists (select 1 from dblink_get_result('saved_lock_b') as drained(result text)) then
    raise exception 'Lock order assertion: the save result was not drained';
  end if;
  if not (select (result->>'created')::boolean and result->>'id' = '00000000-0000-4000-8000-00000000f1b1' from saved_lock_result) then
    raise exception 'Lock order assertion: the save did not finish after the ordinary insert';
  end if;
  if (select count(*) from public.saved_pages where user_id = '00000000-0000-4000-8000-00000000f101') <> 2 then
    raise exception 'Lock order assertion: both writes are stored';
  end if;
end $$;

select dblink_disconnect('saved_lock_a');
select dblink_disconnect('saved_lock_b');

delete from public.saved_pages where user_id = '00000000-0000-4000-8000-00000000f101';
delete from zodiacs_accounts_private.oauth_clients where id = '00000000-0000-4000-8000-00000000f103';
begin;
set local role supabase_auth_admin;
delete from auth.oauth_consents where user_id = '00000000-0000-4000-8000-00000000f101';
delete from auth.sessions where id = '00000000-0000-4000-8000-00000000f102';
delete from auth.oauth_clients where id = '00000000-0000-4000-8000-00000000f103';
delete from auth.users where id = '00000000-0000-4000-8000-00000000f101';
commit;

select 'Saved link lock order SQL passed: a save waits on the account owner lock before the saved pages lock, and an ordinary insert beside it finishes' as result;
