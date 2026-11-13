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
        ('private.account_v2_erase_deleting_account(uuid,uuid)')
      ) as helper(signature)
      where has_function_privilege('anon', helper.signature, 'execute')
         or has_function_privilege('authenticated', helper.signature, 'execute')
         or not has_function_privilege('service_role', helper.signature, 'execute')
         or not (select prosecdef from pg_catalog.pg_proc
                 where oid = helper.signature::regprocedure)
    )
    and not has_function_privilege('anon', 'living_chart_private.living_chart_account_deleting()', 'execute'),
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
