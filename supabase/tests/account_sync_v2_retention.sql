\set ON_ERROR_STOP on

-- Run after every migration, including 20261113090000. Covers erasure of the
-- tables added after the foundation migration, the deleting gate on them, the
-- reaper for deletions prepared but never finished, and the rule that an
-- expired receipt of an account still deleting is not removed until the
-- reaper has acted. All people here are synthetic test ids.

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

create or replace function pg_temp.retention_hmac(fill text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array('v1:' || repeat(fill, 64));
$$;

create or replace function pg_temp.provider_entries(recipient_hash text, fill text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(jsonb_build_object(
    'recipient_hash', recipient_hash,
    'encrypted_payload', jsonb_build_object(
      'ciphertext', encode(decode(repeat(fill, 64), 'hex'), 'base64'),
      'nonce', encode(decode(repeat(fill, 24), 'hex'), 'base64'),
      'format', 'opaque_v1',
      'key_scope', 'service',
      'key_version', 1,
      'wrapped_key', encode(decode(repeat(fill, 136), 'hex'), 'base64')
    )
  ));
$$;

create or replace function pg_temp.retention_payload(candidate_chart_id uuid)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'schema', 'zodiacs.living-chart.cloud-moment.v1',
    'primaryChartId', candidate_chart_id,
    'occurredAt', '2026-08-18T09:00:00.000Z',
    'timePrecision', 'exact',
    'category', 'relationships',
    'note', 'A test note.',
    'forecast', jsonb_build_object(
      'schema', 'zodiacs.living-chart.today-forecast.v1',
      'editionDate', '2026-08-18',
      'chartId', candidate_chart_id,
      'source', 'personalized',
      'generatorVersion', 'today-1.0.0',
      'capturedAt', '2026-08-18T08:00:00.000Z',
      'lines', jsonb_build_array(jsonb_build_object(
        'id', 'transit:mars-moon',
        'text', 'Make room before answering too quickly.',
        'receipt', 'Mars 14.2 degrees Cancer square natal Moon.'
      ))
    ),
    'reflectionQuestionId', 'reflection:notice'
  );
$$;

create or replace function pg_temp.act_as(candidate_user_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claim.sub', candidate_user_id::text, false);
  select set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', candidate_user_id, 'is_anonymous', false)::text,
    false
  );
$$;

-- Ages a deletion as if it had been prepared eight days ago, with every
-- receipt expired a day ago.
create or replace function pg_temp.age_deletion(candidate_user_id uuid)
returns void
language sql
as $$
  update private.account_states
  set deletion_started_at = clock_timestamp() - interval '8 days',
      created_at = least(created_at, clock_timestamp() - interval '9 days'),
      updated_at = greatest(updated_at, clock_timestamp() - interval '8 days')
  where user_id = candidate_user_id;
  update private.account_deletion_receipts
  set prepared_at = clock_timestamp() - interval '8 days',
      expires_at = clock_timestamp() - interval '1 day'
  where user_id = candidate_user_id;
$$;

create temporary table retention_results (
  key text primary key,
  value jsonb not null
);
grant select, insert on retention_results to service_role, authenticated;

-- Privileges: the reaper and retention pass are service-only; the reaper's
-- helpers are SECURITY DEFINER, the public pass is SECURITY INVOKER.
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.account_v2_run_retention(integer)', 'execute')
    and not has_function_privilege('authenticated', 'public.account_v2_run_retention(integer)', 'execute')
    and has_function_privilege('service_role', 'public.account_v2_run_retention(integer)', 'execute')
    and not (select prosecdef from pg_catalog.pg_proc
             where oid = 'public.account_v2_run_retention(integer)'::regprocedure)
    and not exists (
      select 1
      from (values
        ('private.account_v2_reap_stranded_deletions(integer)'),
        ('private.account_v2_reap_deleting_account(uuid)'),
        ('private.account_v2_erase_deleting_account(uuid,uuid)'),
        ('private.account_v2_lock_owner_deleting(uuid)')
      ) as helper(signature)
      where has_function_privilege('anon', helper.signature, 'execute')
         or has_function_privilege('authenticated', helper.signature, 'execute')
         or not has_function_privilege('service_role', helper.signature, 'execute')
         or not (select prosecdef from pg_catalog.pg_proc
                 where oid = helper.signature::regprocedure)
    )
    and not has_function_privilege('anon', 'living_chart_private.living_chart_account_deleting()', 'execute')
    and not has_function_privilege('anon', 'public.zodiacs_sky_watch_v1(text,jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.zodiacs_sky_watch_v1(text,jsonb)', 'execute')
    and not (select prosecdef from pg_catalog.pg_proc
             where oid = 'public.zodiacs_sky_watch_v1(text,jsonb)'::regprocedure)
    and exists (select 1 from pg_catalog.pg_trigger
                where tgname = 'account_v2_terminal_gate'
                  and tgrelid = 'sky_watch.principals'::regclass),
  'retention functions must keep the service-only privilege pattern'
);

select pg_temp.assert_true(
  (
    select count(*) = 4
    from pg_catalog.pg_trigger
    where tgname = 'account_v2_terminal_gate'
      and tgrelid in (
        'public.saved_pages'::regclass,
        'public.living_chart_sync_consents'::regclass,
        'public.living_chart_moments'::regclass,
        'living_chart_private.living_chart_mutations'::regclass
      )
  ),
  'the terminal gate must guard saved pages and the Living Chart tables'
);

insert into auth.users (id) values
  ('81000000-0000-4000-8000-000000000001'),
  ('81000000-0000-4000-8000-000000000002'),
  ('81000000-0000-4000-8000-000000000003'),
  ('81000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- 1. Prepare erases the later tables ------------------------------------------

insert into public.profiles (user_id, digest_opt_in)
values ('81000000-0000-4000-8000-000000000001', true)
on conflict (user_id) do nothing;

insert into public.saved_pages (user_id, kind, title, href) values (
  '81000000-0000-4000-8000-000000000001',
  'occasion',
  'A saved card',
  '/occasions/retention-test/'
);
insert into public.saved_pages (
  user_id, kind, title, href, source, summary, detail
) values (
  '81000000-0000-4000-8000-000000000001',
  'chart',
  'An assistant save',
  '/birth-chart/#retention-test',
  'assistant',
  'A short summary.',
  '{"schema":"zodiacs.assistant-save.v1","result":"worked out"}'::jsonb
);

insert into public.weekly_digest_deliveries (
  week_start, user_id, status, slot, lease_token, reserved_at, created_at, updated_at
) values (
  date_trunc('week', clock_timestamp() at time zone 'UTC')::date,
  '81000000-0000-4000-8000-000000000001',
  'reserved',
  80,
  '82000000-0000-4000-8000-000000000001',
  clock_timestamp(),
  clock_timestamp(),
  clock_timestamp()
);
insert into public.weekly_digest_unsubscribe_tokens (
  token_hash, user_id, week_start, lease_token, expires_at, created_at
) values (
  repeat('7', 64),
  '81000000-0000-4000-8000-000000000001',
  date_trunc('week', clock_timestamp() at time zone 'UTC')::date,
  '82000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '30 days',
  clock_timestamp()
);

-- Sky Watch: an OAuth principal of this account with a subscription and an
-- outbox row, plus two principals that must survive: a token principal, which
-- names no account, and another account's OAuth principal.
insert into auth.users (id) values ('81000000-0000-4000-8000-000000000009')
on conflict (id) do nothing;
insert into sky_watch.principals (id, oauth_user, oauth_session, oauth_client, expires_at) values
  ('87000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001',
   '88000000-0000-4000-8000-000000000001', '89000000-0000-4000-8000-000000000001',
   clock_timestamp() + interval '7 days'),
  ('87000000-0000-4000-8000-000000000009', '81000000-0000-4000-8000-000000000009',
   '88000000-0000-4000-8000-000000000009', '89000000-0000-4000-8000-000000000001',
   clock_timestamp() + interval '7 days');
insert into sky_watch.principals (id, token_hash, expires_at) values (
  '87000000-0000-4000-8000-000000000002', repeat('5', 64), clock_timestamp() + interval '7 days'
);
insert into sky_watch.subscriptions (id, owner, name, filters, verified_until, expires_at)
select 'sub_' || repeat(fill, 64), owner_id::uuid, 'zodiacs.sky.ingress',
  '{"bodies":["mars"]}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day'
from (values
  ('1', '87000000-0000-4000-8000-000000000001'),
  ('2', '87000000-0000-4000-8000-000000000002'),
  ('9', '87000000-0000-4000-8000-000000000009')
) as fixture(fill, owner_id);
insert into sky_watch.ledger (id, name, at, payload) values (
  'retention-test-event', 'zodiacs.sky.ingress', clock_timestamp(), '{}'::jsonb
) on conflict (id) do nothing;
insert into sky_watch.outbox (subscription_id, event_id, due_at)
select 'sub_' || repeat(fill, 64), 'retention-test-event', clock_timestamp()
from (values ('1'), ('2'), ('9')) as fixture(fill);

set role authenticated;
select pg_temp.act_as('81000000-0000-4000-8000-000000000001');
insert into retention_results values (
  'living_grant',
  public.set_living_chart_sync_consent(
    'grant',
    '83000000-0000-4000-8000-000000000001',
    0,
    'living-chart-sync-2026-08-18.v1'
  )
);
insert into retention_results values (
  'living_put',
  public.put_living_chart_moment(
    '84000000-0000-4000-8000-000000000001',
    0,
    1,
    '83000000-0000-4000-8000-000000000002',
    pg_temp.retention_payload('85000000-0000-4000-8000-000000000001')
  )
);
reset role;

select pg_temp.assert_true(
  (select value->>'outcome' = 'granted' from retention_results where key = 'living_grant')
    and (select value->>'outcome' = 'saved' from retention_results where key = 'living_put')
    and exists (select 1 from public.living_chart_moments
                where user_id = '81000000-0000-4000-8000-000000000001')
    and exists (select 1 from living_chart_private.living_chart_mutations
                where user_id = '81000000-0000-4000-8000-000000000001')
    and (select count(*) = 2 from public.saved_pages
         where user_id = '81000000-0000-4000-8000-000000000001'),
  'the fixture must hold saved pages and Living Chart rows before deletion'
);

set role service_role;
insert into retention_results values (
  'prepared',
  public.account_v2_prepare_deletion(
    '81000000-0000-4000-8000-000000000001',
    '86000000-0000-4000-8000-000000000001',
    pg_temp.retention_hmac('1'),
    pg_temp.provider_entries(repeat('6', 64), '6'),
    true
  )
);
reset role;

select pg_temp.assert_true(
  (select value->>'outcome' = 'prepared' from retention_results where key = 'prepared')
    and not exists (select 1 from public.saved_pages
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.living_chart_moments
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.living_chart_sync_consents
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from living_chart_private.living_chart_mutations
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.weekly_digest_deliveries
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from public.weekly_digest_unsubscribe_tokens
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and exists (select 1 from auth.users
                where id = '81000000-0000-4000-8000-000000000001'),
  'prepare must erase saved pages, Living Chart and weekly digest rows before the Auth deletion'
);

select pg_temp.assert_true(
  not exists (select 1 from sky_watch.principals
              where oauth_user = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from sky_watch.subscriptions
                    where id = 'sub_' || repeat('1', 64))
    and not exists (select 1 from sky_watch.outbox
                    where subscription_id = 'sub_' || repeat('1', 64))
    and (select count(*) = 2 from sky_watch.principals
         where id in ('87000000-0000-4000-8000-000000000002',
                      '87000000-0000-4000-8000-000000000009'))
    and (select count(*) = 2 from sky_watch.subscriptions
         where id in ('sub_' || repeat('2', 64), 'sub_' || repeat('9', 64)))
    and (select count(*) = 2 from sky_watch.outbox
         where subscription_id in ('sub_' || repeat('2', 64), 'sub_' || repeat('9', 64))),
  'prepare must erase the account''s Sky Watch principals, subscriptions and outbox, and keep every other principal'
);

-- 2. The deleting gate ---------------------------------------------------------

set role authenticated;
select pg_temp.act_as('81000000-0000-4000-8000-000000000001');

select pg_temp.assert_true(
  public.put_living_chart_moment(
    '84000000-0000-4000-8000-000000000002',
    0,
    1,
    '83000000-0000-4000-8000-000000000003',
    pg_temp.retention_payload('85000000-0000-4000-8000-000000000001')
  ) = '{"outcome":"temporarily_disabled"}'::jsonb
    and public.set_living_chart_sync_consent(
      'grant',
      '83000000-0000-4000-8000-000000000004',
      0,
      'living-chart-sync-2026-08-18.v1'
    ) = '{"outcome":"temporarily_disabled"}'::jsonb
    and public.delete_living_chart_moment(
      '84000000-0000-4000-8000-000000000001',
      1,
      1,
      '83000000-0000-4000-8000-000000000005'
    ) = '{"outcome":"temporarily_disabled"}'::jsonb,
  'Living Chart writes must answer temporarily_disabled while the account is deleting'
);

do $$
begin
  insert into public.saved_pages (kind, title, href)
  values ('occasion', 'Too late', '/occasions/too-late/');
  raise exception 'a deleting account saved a page';
exception
  when insufficient_privilege then null;
end;
$$;

do $$
begin
  perform living_chart_private.set_living_chart_sync_consent_impl(
    'grant',
    '83000000-0000-4000-8000-000000000006',
    0,
    'living-chart-sync-2026-08-18.v1'
  );
  raise exception 'a deleting account wrote Living Chart consent directly';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

set role service_role;
do $$
begin
  insert into public.saved_pages (
    user_id, kind, title, href, source, summary, detail
  ) values (
    '81000000-0000-4000-8000-000000000001',
    'week',
    'Too late',
    '/horoscopes/too-late/',
    'assistant',
    'Too late.',
    '{"schema":"zodiacs.assistant-save.v1"}'::jsonb
  );
  raise exception 'the service role saved a page for a deleting account';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

-- Sky Watch refuses a new principal for the deleting account, through its RPC
-- (null, as for any lost access) and through a direct write, and still serves
-- a live account.
set role supabase_auth_admin;
insert into auth.oauth_clients (id) values ('89000000-0000-4000-8000-000000000001');
insert into auth.sessions (id, user_id, oauth_client_id, scopes) values
  ('88000000-0000-4000-8000-000000000011', '81000000-0000-4000-8000-000000000001',
   '89000000-0000-4000-8000-000000000001', 'openid email'),
  ('88000000-0000-4000-8000-000000000019', '81000000-0000-4000-8000-000000000009',
   '89000000-0000-4000-8000-000000000001', 'openid email');
insert into auth.oauth_consents (user_id, client_id, scopes) values
  ('81000000-0000-4000-8000-000000000001', '89000000-0000-4000-8000-000000000001', 'openid email'),
  ('81000000-0000-4000-8000-000000000009', '89000000-0000-4000-8000-000000000001', 'openid email');
reset role;
insert into sky_watch.oauth_clients (id, resource) values (
  '89000000-0000-4000-8000-000000000001', 'https://zodiacs-retention-test.vercel.app/mcp'
);

set role service_role;
select pg_temp.assert_true(
  public.zodiacs_sky_watch_v1('oauth', jsonb_build_object(
    'user', '81000000-0000-4000-8000-000000000001',
    'session', '88000000-0000-4000-8000-000000000011',
    'client', '89000000-0000-4000-8000-000000000001',
    'resource', 'https://zodiacs-retention-test.vercel.app/mcp'
  )) is null
    and public.zodiacs_sky_watch_v1('oauth', jsonb_build_object(
      'user', '81000000-0000-4000-8000-000000000009',
      'session', '88000000-0000-4000-8000-000000000019',
      'client', '89000000-0000-4000-8000-000000000001',
      'resource', 'https://zodiacs-retention-test.vercel.app/mcp'
    )) ? 'id',
  'Sky Watch must refuse OAuth access for a deleting account and still grant it to a live one'
);

do $$
begin
  insert into sky_watch.principals (oauth_user, oauth_session, oauth_client, expires_at)
  values ('81000000-0000-4000-8000-000000000001', '88000000-0000-4000-8000-000000000021',
          '89000000-0000-4000-8000-000000000001', clock_timestamp() + interval '7 days');
  raise exception 'the service role created a Sky Watch principal for a deleting account';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

select pg_temp.assert_true(
  not exists (select 1 from sky_watch.principals
              where oauth_user = '81000000-0000-4000-8000-000000000001')
    and exists (select 1 from sky_watch.principals
                where oauth_user = '81000000-0000-4000-8000-000000000009'
                  and oauth_session = '88000000-0000-4000-8000-000000000019'),
  'no Sky Watch principal may exist for the deleting account'
);

-- 3. The reaper waits for the window ------------------------------------------

set role service_role;
insert into retention_results values (
  'early_pass',
  public.account_v2_run_retention(50)
);
reset role;

select pg_temp.assert_true(
  (select value @> '{"outcome":"ready","reaped":0,"reap_failed":0,"overdue":0}'::jsonb
   from retention_results where key = 'early_pass')
    and exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000001')
    and exists (select 1 from private.account_deletion_receipts
                where request_id = '86000000-0000-4000-8000-000000000001'
                  and completed_at is null),
  'the reaper must not act inside the seven day window'
);

-- An account that started deleting eight days ago but rotated its recovery
-- (a receipt still live) is left for its owner to finish.
set role service_role;
select public.account_v2_prepare_deletion(
  '81000000-0000-4000-8000-000000000004',
  '86000000-0000-4000-8000-000000000004',
  pg_temp.retention_hmac('4'),
  '[]'::jsonb,
  true
);
reset role;
update private.account_states
set deletion_started_at = clock_timestamp() - interval '8 days',
    created_at = clock_timestamp() - interval '9 days'
where user_id = '81000000-0000-4000-8000-000000000004';
update private.account_deletion_receipts
set prepared_at = clock_timestamp() - interval '8 days'
where user_id = '81000000-0000-4000-8000-000000000004';

-- 4. A blocked Auth delete keeps the receipt and its provider record ----------

set role service_role;
select public.account_v2_prepare_deletion(
  '81000000-0000-4000-8000-000000000002',
  '86000000-0000-4000-8000-000000000002',
  pg_temp.retention_hmac('2'),
  pg_temp.provider_entries(repeat('5', 64), '5'),
  true
);
reset role;

create table public.retention_test_blocker (
  user_id uuid not null references auth.users(id)
);
insert into public.retention_test_blocker values ('81000000-0000-4000-8000-000000000002');

select pg_temp.age_deletion('81000000-0000-4000-8000-000000000001');
select pg_temp.age_deletion('81000000-0000-4000-8000-000000000002');

-- The deployed API's entry point runs the same pass and never removes the
-- incomplete receipt of an account the reaper could not finish.
set role service_role;
insert into retention_results values (
  'legacy_entry_point',
  to_jsonb(public.account_v2_cleanup_deletion_receipts(50))
);
reset role;

select pg_temp.assert_true(
  not exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from private.account_states
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and not exists (select 1 from private.account_deletion_receipts
                    where user_id = '81000000-0000-4000-8000-000000000001')
    and exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000002')
    and exists (select 1 from private.account_deletion_receipts
                where request_id = '86000000-0000-4000-8000-000000000002'
                  and completed_at is null)
    and exists (select 1 from private.account_deletion_provider_cleanup
                where request_id = '86000000-0000-4000-8000-000000000002'
                  and recipient_hash = repeat('5', 64))
    and exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000004')
    and (select value = '1'::jsonb from retention_results where key = 'legacy_entry_point'),
  format(
    'the pass must finish the expired deletion, keep the blocked one with its provider record, and skip the live one (removed %s)',
    (select value from retention_results where key = 'legacy_entry_point')
  )
);

update private.account_states
set deletion_started_at = clock_timestamp() - interval '9 days'
where user_id = '81000000-0000-4000-8000-000000000002';

set role service_role;
insert into retention_results values (
  'blocked_pass',
  public.account_v2_run_retention(50)
);
reset role;

select pg_temp.assert_true(
  (select value @> '{"outcome":"ready","reaped":0,"reap_failed":1,"overdue":1,"receipts_removed":0}'::jsonb
   from retention_results where key = 'blocked_pass')
    and exists (select 1 from private.account_deletion_receipts
                where request_id = '86000000-0000-4000-8000-000000000002'),
  format(
    'a failing reap must be counted, reported overdue and keep its receipt (%s)',
    (select value from retention_results where key = 'blocked_pass')
  )
);

delete from public.retention_test_blocker;
drop table public.retention_test_blocker;

-- 5. A deleting account whose receipts were already removed -------------------

insert into public.saved_pages (user_id, kind, title, href) values (
  '81000000-0000-4000-8000-000000000003',
  'occasion',
  'Left behind',
  '/occasions/left-behind/'
);
insert into sky_watch.principals (id, oauth_user, oauth_session, oauth_client, expires_at) values (
  '87000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000003',
  '88000000-0000-4000-8000-000000000003', '89000000-0000-4000-8000-000000000001',
  clock_timestamp() + interval '7 days'
);
insert into sky_watch.subscriptions (id, owner, name, filters, verified_until, expires_at) values (
  'sub_' || repeat('3', 64), '87000000-0000-4000-8000-000000000003', 'zodiacs.sky.ingress',
  '{"bodies":["mars"]}'::jsonb, clock_timestamp() + interval '1 day', clock_timestamp() + interval '1 day'
);
insert into private.account_states (
  user_id, status, deletion_request_id, deletion_started_at, created_at, updated_at
) values (
  '81000000-0000-4000-8000-000000000003',
  'deleting',
  '86000000-0000-4000-8000-000000000003',
  clock_timestamp() - interval '30 days',
  clock_timestamp() - interval '31 days',
  clock_timestamp() - interval '30 days'
);

-- 6. A receipt whose Auth identity is already gone ------------------------------

insert into private.account_deletion_receipts (
  request_id,
  user_id,
  recovery_verifier,
  prepared_at,
  daily_sun_revoked,
  daily_sun_reconciliation_required,
  expires_at
) values (
  '86000000-0000-4000-8000-000000000005',
  '81000000-0000-4000-8000-000000000005',
  'v1:' || repeat('3', 64),
  clock_timestamp() - interval '8 days',
  false,
  true,
  clock_timestamp() - interval '1 day'
);

set role service_role;
insert into retention_results values (
  'final_pass',
  public.account_v2_run_retention(50)
);
reset role;

select pg_temp.assert_true(
  (select value @> '{"outcome":"ready","reaped":2,"reap_failed":0,"overdue":0,"completions_recorded":1,"receipts_removed":2}'::jsonb
   from retention_results where key = 'final_pass')
    and not exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000002')
    and not exists (select 1 from private.account_deletion_receipts
                    where user_id in (
                      '81000000-0000-4000-8000-000000000002',
                      '81000000-0000-4000-8000-000000000005'
                    ))
    and not exists (select 1 from private.account_deletion_provider_cleanup
                    where request_id = '86000000-0000-4000-8000-000000000002')
    and not exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000003')
    and not exists (select 1 from public.saved_pages
                    where user_id = '81000000-0000-4000-8000-000000000003')
    and not exists (select 1 from sky_watch.principals
                    where oauth_user = '81000000-0000-4000-8000-000000000003')
    and not exists (select 1 from sky_watch.subscriptions
                    where id = 'sub_' || repeat('3', 64))
    and exists (select 1 from sky_watch.principals
                where id = '87000000-0000-4000-8000-000000000002')
    and exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000004')
    and exists (select 1 from private.account_deletion_receipts
                where user_id = '81000000-0000-4000-8000-000000000004'),
  format(
    'the pass must finish unblocked and receipt-less deletions and record an Auth deletion that finished elsewhere (%s)',
    (select value from retention_results where key = 'final_pass')
  )
);

-- A replay of the pass is a no-op.
set role service_role;
select pg_temp.assert_true(
  public.account_v2_run_retention(50)
    @> '{"outcome":"ready","reaped":0,"reap_failed":0,"overdue":0,"receipts_removed":0}'::jsonb
    and public.account_v2_run_retention(0) = '{"outcome":"invalid"}'::jsonb
    and public.account_v2_cleanup_deletion_receipts(0) = 0,
  'the retention pass must be idempotent and bounded'
);
reset role;

-- 7. Key rotation RPCs ---------------------------------------------------------

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.account_v2_key_version_inventory()'),
      ('public.account_v2_rewrap_candidates(text,integer,integer)'),
      ('public.account_v2_rewrap_apply(text,jsonb)')
    ) as rpc(signature)
    where has_function_privilege('anon', rpc.signature, 'execute')
       or has_function_privilege('authenticated', rpc.signature, 'execute')
       or not has_function_privilege('service_role', rpc.signature, 'execute')
       or (select prosecdef from pg_catalog.pg_proc where oid = rpc.signature::regprocedure)
  ),
  'rewrap RPCs must be service-only SECURITY INVOKER functions'
);

insert into auth.users (id) values ('81000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;
insert into private.account_states (user_id)
values ('81000000-0000-4000-8000-000000000006');
insert into private.account_chart_records (
  user_id, chart_id, subject_kind, subject_attestation, revision
) values (
  '81000000-0000-4000-8000-000000000006',
  '87000000-0000-4000-8000-000000000006',
  'self',
  'self_declared_v1',
  3
);
insert into private.account_chart_secret_envelopes (
  user_id, chart_id, revision, ciphertext, nonce, encryption_format,
  key_scope, key_version, wrapped_key
) values (
  '81000000-0000-4000-8000-000000000006',
  '87000000-0000-4000-8000-000000000006',
  3,
  decode(repeat('ab', 40), 'hex'),
  decode(repeat('cd', 12), 'hex'),
  'opaque_v1',
  'service',
  1,
  decode(repeat('01', 68), 'hex')
);
insert into private.account_daily_sun_recipient_aliases (
  user_id, recipient_hash, locator_ciphertext, locator_nonce,
  locator_encryption_format, locator_key_scope, locator_key_version,
  locator_wrapped_key
) values (
  '81000000-0000-4000-8000-000000000006',
  repeat('4', 64),
  decode(repeat('ef', 40), 'hex'),
  decode(repeat('12', 12), 'hex'),
  'opaque_v1',
  'service',
  1,
  decode(repeat('02', 68), 'hex')
);

set role service_role;

insert into retention_results values (
  'rewrap_candidates',
  public.account_v2_rewrap_candidates('chart', 1, 500)
);

select pg_temp.assert_true(
  (select value->>'outcome' = 'ready'
     and value->'rows' @> jsonb_build_array(jsonb_build_object(
       'user_id', '81000000-0000-4000-8000-000000000006',
       'chart_id', '87000000-0000-4000-8000-000000000006',
       'revision', 3,
       'key_version', 1,
       'wrapped_key', translate(encode(decode(repeat('01', 68), 'hex'), 'base64'), E'\n', '')
     ))
     and not (value::text like '%ciphertext%')
   from retention_results where key = 'rewrap_candidates')
    and public.account_v2_rewrap_candidates('alias', 1, 500)->'rows' @> jsonb_build_array(
      jsonb_build_object(
        'user_id', '81000000-0000-4000-8000-000000000006',
        'recipient_hash', repeat('4', 64),
        'key_version', 1
      )
    )
    and public.account_v2_rewrap_candidates('chart', 1, 0) = '{"outcome":"invalid"}'::jsonb
    and public.account_v2_rewrap_candidates('secret', 1, 10) = '{"outcome":"invalid"}'::jsonb
    and public.account_v2_key_version_inventory() @> '[{"kind":"chart","key_version":1},{"kind":"alias","key_version":1}]'::jsonb,
  'rewrap candidates must list ids, context and the wrapped key only'
);

-- PostgreSQL's base64 breaks a 68-byte key after 76 characters. The rewrap
-- tool reads the candidates as JSON, so every wrapped key must arrive as one
-- unbroken 92-character string that decodes back to the stored bytes.
select pg_temp.assert_true(
  octet_length(encode(decode(repeat('01', 68), 'hex'), 'base64')) = 93
    and not exists (
      select 1
      from (values ('chart'), ('alias'), ('provider')) as kinds(kind),
        jsonb_array_elements(
          public.account_v2_rewrap_candidates(kinds.kind, 1, 500)->'rows'
        ) as listed(row_value)
      where listed.row_value->>'wrapped_key' !~ '^[A-Za-z0-9+/]{91}=$'
         or octet_length(decode(listed.row_value->>'wrapped_key', 'base64')) <> 68
    )
    and (
      select count(*) >= 2
      from (values ('chart'), ('alias')) as kinds(kind),
        jsonb_array_elements(
          public.account_v2_rewrap_candidates(kinds.kind, 1, 500)->'rows'
        ) as listed(row_value)
    ),
  'rewrap candidates must carry each wrapped key as unbroken base64'
);

create or replace function pg_temp.rewrap_chart_row(old_fill text, new_fill text, revision integer)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array(jsonb_build_object(
    'user_id', '81000000-0000-4000-8000-000000000006',
    'chart_id', '87000000-0000-4000-8000-000000000006',
    'revision', revision,
    'old_key_version', 1,
    'old_wrapped_key', encode(decode(repeat(old_fill, 68), 'hex'), 'base64'),
    'new_key_version', 2,
    'new_wrapped_key', encode(decode(repeat(new_fill, 68), 'hex'), 'base64')
  ));
$$;

select pg_temp.assert_true(
  public.account_v2_rewrap_apply('chart', pg_temp.rewrap_chart_row('09', '03', 3))
    = '{"outcome":"applied","updated":0,"skipped":1}'::jsonb
    and public.account_v2_rewrap_apply('chart', pg_temp.rewrap_chart_row('01', '03', 4))
      = '{"outcome":"applied","updated":0,"skipped":1}'::jsonb
    and public.account_v2_rewrap_apply('chart', pg_temp.rewrap_chart_row('01', '03', 3))
      = '{"outcome":"applied","updated":1,"skipped":0}'::jsonb
    and public.account_v2_rewrap_apply('chart', pg_temp.rewrap_chart_row('01', '03', 3))
      = '{"outcome":"applied","updated":0,"skipped":1}'::jsonb
    and public.account_v2_rewrap_apply('chart', '[]'::jsonb) = '{"outcome":"invalid"}'::jsonb
    and public.account_v2_rewrap_apply('alias', jsonb_build_array(jsonb_build_object(
      'user_id', '81000000-0000-4000-8000-000000000006',
      'recipient_hash', repeat('4', 64),
      'old_key_version', 1,
      'old_wrapped_key', encode(decode(repeat('02', 68), 'hex'), 'base64'),
      'new_key_version', 1,
      'new_wrapped_key', encode(decode(repeat('05', 68), 'hex'), 'base64')
    ))) = '{"outcome":"invalid"}'::jsonb
    and public.account_v2_rewrap_apply('alias', jsonb_build_array(jsonb_build_object(
      'user_id', '81000000-0000-4000-8000-000000000006',
      'recipient_hash', repeat('4', 64),
      'old_key_version', 1,
      'old_wrapped_key', encode(decode(repeat('02', 68), 'hex'), 'base64'),
      'new_key_version', 2,
      'new_wrapped_key', encode(decode(repeat('05', 68), 'hex'), 'base64')
    ))) = '{"outcome":"applied","updated":1,"skipped":0}'::jsonb,
  'rewrap apply must be a compare-and-swap that skips changed rows and replays'
);

reset role;

select pg_temp.assert_true(
  exists (
    select 1 from private.account_chart_secret_envelopes
    where user_id = '81000000-0000-4000-8000-000000000006'
      and key_version = 2
      and wrapped_key = decode(repeat('03', 68), 'hex')
      and ciphertext = decode(repeat('ab', 40), 'hex')
      and nonce = decode(repeat('cd', 12), 'hex')
  )
    and exists (
      select 1 from private.account_daily_sun_recipient_aliases
      where user_id = '81000000-0000-4000-8000-000000000006'
        and locator_key_version = 2
        and locator_wrapped_key = decode(repeat('05', 68), 'hex')
        and locator_ciphertext = decode(repeat('ef', 40), 'hex')
    ),
  'rewrap must change only the key version and wrapped key'
);

-- 8. Recovery rotation keeps an expired incomplete receipt ---------------------
--
-- A fresh prepare after the first receipt expired used to prune that receipt,
-- cascading its Daily Sun provider reconciliation record while the account was
-- still deleting and its Auth identity still existed. The record must stay
-- until the reaper has finished the deletion.

insert into auth.users (id) values
  ('81000000-0000-4000-8000-000000000007'),
  ('81000000-0000-4000-8000-000000000008')
on conflict (id) do nothing;

set role service_role;
select public.account_v2_prepare_deletion(
  '81000000-0000-4000-8000-000000000007',
  '86000000-0000-4000-8000-000000000007',
  pg_temp.retention_hmac('7'),
  pg_temp.provider_entries(repeat('8', 64), '8'),
  true
);
select public.account_v2_prepare_deletion(
  '81000000-0000-4000-8000-000000000008',
  '86000000-0000-4000-8000-000000000008',
  pg_temp.retention_hmac('8'),
  pg_temp.provider_entries(repeat('9', 64), '9'),
  true
);
reset role;

select pg_temp.age_deletion('81000000-0000-4000-8000-000000000007');
select pg_temp.age_deletion('81000000-0000-4000-8000-000000000008');

set role service_role;
insert into retention_results values (
  'rotation_new_id',
  public.account_v2_prepare_deletion(
    '81000000-0000-4000-8000-000000000007',
    '86000000-0000-4000-8000-000000000017',
    pg_temp.retention_hmac('a'),
    '[]'::jsonb,
    true
  )
);
insert into retention_results values (
  'rotation_same_id',
  public.account_v2_prepare_deletion(
    '81000000-0000-4000-8000-000000000008',
    '86000000-0000-4000-8000-000000000008',
    pg_temp.retention_hmac('8'),
    '[]'::jsonb,
    true
  )
);
reset role;

select pg_temp.assert_true(
  (select value->>'outcome' = 'already_prepared'
   from retention_results where key = 'rotation_new_id')
    and exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000007')
    and exists (select 1 from private.account_states
                where user_id = '81000000-0000-4000-8000-000000000007'
                  and status = 'deleting')
    and exists (select 1 from private.account_deletion_receipts
                where request_id = '86000000-0000-4000-8000-000000000007'
                  and completed_at is null
                  and expires_at <= clock_timestamp())
    and exists (select 1 from private.account_deletion_provider_cleanup
                where request_id = '86000000-0000-4000-8000-000000000007'
                  and recipient_hash = repeat('8', 64))
    and exists (select 1 from private.account_deletion_receipts
                where request_id = '86000000-0000-4000-8000-000000000017'
                  and expires_at > clock_timestamp()),
  format(
    'a fresh prepare must keep the expired incomplete receipt and its provider record (%s)',
    (select value from retention_results where key = 'rotation_new_id')
  )
);

select pg_temp.assert_true(
  (select value->>'outcome' = 'prepared'
   from retention_results where key = 'rotation_same_id')
    and exists (select 1 from private.account_deletion_receipts
                where request_id = '86000000-0000-4000-8000-000000000008'
                  and completed_at is null
                  and expires_at > clock_timestamp() + interval '6 days 23 hours'
                  and expires_at <= clock_timestamp() + interval '7 days')
    and exists (select 1 from private.account_deletion_provider_cleanup
                where request_id = '86000000-0000-4000-8000-000000000008'
                  and recipient_hash = repeat('9', 64))
    and (select count(*) = 1 from private.account_deletion_receipts
         where user_id = '81000000-0000-4000-8000-000000000008'),
  format(
    'a prepare naming its own expired receipt must renew it in place (%s)',
    (select value from retention_results where key = 'rotation_same_id')
  )
);

-- A live receipt leaves the deletion to its owner; once every receipt has
-- expired the reaper finishes it and only then do the receipts go.
set role service_role;
insert into retention_results values (
  'rotation_live_pass',
  public.account_v2_run_retention(50)
);
reset role;

select pg_temp.assert_true(
  exists (select 1 from auth.users where id = '81000000-0000-4000-8000-000000000007')
    and exists (select 1 from private.account_deletion_provider_cleanup
                where request_id = '86000000-0000-4000-8000-000000000007'),
  'the retention pass must not remove a kept receipt while a live one exists'
);

select pg_temp.age_deletion('81000000-0000-4000-8000-000000000007');
select pg_temp.age_deletion('81000000-0000-4000-8000-000000000008');

set role service_role;
insert into retention_results values (
  'rotation_reaped_pass',
  public.account_v2_run_retention(50)
);
reset role;

select pg_temp.assert_true(
  (select (value->>'reaped')::integer >= 2 and (value->>'reap_failed')::integer = 0
   from retention_results where key = 'rotation_reaped_pass')
    and not exists (select 1 from auth.users
                    where id in ('81000000-0000-4000-8000-000000000007',
                                 '81000000-0000-4000-8000-000000000008'))
    and not exists (select 1 from private.account_deletion_receipts
                    where user_id in ('81000000-0000-4000-8000-000000000007',
                                      '81000000-0000-4000-8000-000000000008'))
    and not exists (select 1 from private.account_deletion_provider_cleanup
                    where request_id in ('86000000-0000-4000-8000-000000000007',
                                         '86000000-0000-4000-8000-000000000017',
                                         '86000000-0000-4000-8000-000000000008')),
  format(
    'the reaper must finish both deletions before their receipts go (%s)',
    (select value from retention_results where key = 'rotation_reaped_pass')
  )
);
