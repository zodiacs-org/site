\set ON_ERROR_STOP on

-- Run after every migration, including 20261111170000. Covers the
-- chart_emails consent purpose, the two service-only chart sources, bootstrap
-- without the v1 chart check, the dropped daily chart preference FK, and the
-- weekly digest content that no longer reads public.charts.

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

create or replace function pg_temp.chart_emails_hmac(fill text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array('v1:' || repeat(fill, 64));
$$;

create or replace function pg_temp.locator(fill text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'ciphertext', encode(decode(repeat(fill, 64), 'hex'), 'base64'),
    'nonce', encode(decode(repeat(fill, 24), 'hex'), 'base64'),
    'format', 'opaque_v1',
    'key_scope', 'service',
    'key_version', 1,
    'wrapped_key', encode(decode(repeat(fill, 136), 'hex'), 'base64')
  );
$$;

create or replace function pg_temp.source_count(candidate uuid)
returns integer
language sql
as $$
  select count(*)::integer
  from public.account_v2_chart_email_sources(array[candidate]::uuid[]);
$$;

-- The production Auth table has an email column; the portable stub does not.
alter table auth.users add column if not exists email text;

insert into auth.users (id, email) values
  ('71000000-0000-4000-8000-000000000001', 'chart-emails-a@example.com'),
  ('71000000-0000-4000-8000-000000000002', 'chart-emails-b@example.com')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (user_id, digest_opt_in) values
  ('71000000-0000-4000-8000-000000000001', true),
  ('71000000-0000-4000-8000-000000000002', true)
on conflict (user_id) do update set digest_opt_in = true;

-- A v1 chart row that bootstrap must ignore and leave untouched.
insert into public.charts (id, user_id, payload) values (
  '74000000-0000-4000-8000-000000000099',
  '71000000-0000-4000-8000-000000000001',
  '{"name":"v1 fixture","birth":{"date":"1980-02-02"}}'::jsonb
);

-- Boundary: both new chart sources are service only and invoker-rights.
select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.account_v2_chart_email_sources(uuid[])'),
      ('public.account_v2_owner_self_chart(uuid)')
    ) as rpc(signature)
    where has_function_privilege('anon', rpc.signature, 'execute')
       or has_function_privilege('authenticated', rpc.signature, 'execute')
       or not has_function_privilege('service_role', rpc.signature, 'execute')
       or (select prosecdef from pg_proc where oid = rpc.signature::regprocedure)
  ),
  'chart sources must be service-only security-invoker functions'
);

select pg_temp.assert_true(
  private.account_v2_current_policy_version('chart_emails') = 'chart-emails-2026-11-11.v1'
    and private.account_v2_current_policy_version('chart_sync') = 'chart-sync-2026-08-12.v1',
  'chart_emails must carry its own policy version'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_proc
    where proname in (
      'account_v2_bootstrap',
      'account_v2_chart_email_sources',
      'account_v2_owner_self_chart',
      'weekly_digest_candidates_v1',
      'weekly_digest_content_v1'
    )
      and pg_get_functiondef(oid) ~* '(from|join)\s+public\.charts\M'
  ),
  'no launched reader may query public.charts'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_constraint
    where conname = 'daily_chart_preferences_chart_owner_fkey'
  )
    and not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.daily_chart_preferences'::regclass
        and contype = 'f'
        and confrelid = 'public.charts'::regclass
    ),
  'daily chart preferences must not depend on public.charts'
);

set role service_role;

-- Bootstrap with a v1 row present: ready, chart_emails pending by default.
select pg_temp.assert_true(
  public.account_v2_bootstrap(
    '71000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001',
    'web',
    repeat('7', 64),
    pg_temp.locator('e')
  ) @> '{"outcome":"ready","chart_sync_consent":"pending","chart_emails_consent":"pending"}'::jsonb,
  'bootstrap must ignore a v1 row and report chart_emails as pending'
);

reset role;
select pg_temp.assert_true(
  (select payload from public.charts where id = '74000000-0000-4000-8000-000000000099')
    = '{"name":"v1 fixture","birth":{"date":"1980-02-02"}}'::jsonb,
  'bootstrap must leave the v1 row exactly as it was'
);
set role service_role;

select pg_temp.assert_true(
  pg_temp.source_count('71000000-0000-4000-8000-000000000001') = 0
    and public.account_v2_owner_self_chart('71000000-0000-4000-8000-000000000001')
      = '{"outcome":"not_found"}'::jsonb
    and public.account_v2_owner_self_chart(null) = '{"outcome":"invalid"}'::jsonb,
  'no chart source exists before consent and a chart'
);

-- chart_sync and one self chart.
select pg_temp.assert_true(
  public.account_v2_record_consent(
    '71000000-0000-4000-8000-000000000001', 'chart_sync', 'grant',
    'chart-sync-2026-08-12.v1', 'web',
    '73000000-0000-4000-8000-000000000001', pg_temp.chart_emails_hmac('1')
  )->>'outcome' = 'granted',
  'chart_sync grant must succeed'
);

select pg_temp.assert_true(
  public.account_v2_put_chart(
    '71000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001',
    '74000000-0000-4000-8000-000000000001',
    0,
    '73000000-0000-4000-8000-000000000002',
    pg_temp.chart_emails_hmac('2'),
    'self',
    'self_declared_v1',
    decode(repeat('20', 68), 'hex'),
    decode(repeat('21', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('22', 68), 'hex')
  )->>'outcome' = 'saved',
  'self chart must save'
);

select pg_temp.assert_true(
  public.account_v2_owner_self_chart('71000000-0000-4000-8000-000000000001')
    @> '{"outcome":"ready","chart_id":"74000000-0000-4000-8000-000000000001","revision":1}'::jsonb
    and public.account_v2_owner_self_chart('71000000-0000-4000-8000-000000000001')
      #>> '{encrypted_source,format}' = 'opaque_v1'
    and pg_temp.source_count('71000000-0000-4000-8000-000000000001') = 0,
  'owner chart needs only chart_sync; email sources still need chart_emails'
);

-- chart_emails: wrong version refused, right version granted.
select pg_temp.assert_true(
  public.account_v2_record_consent(
    '71000000-0000-4000-8000-000000000001', 'chart_emails', 'grant',
    'chart-sync-2026-08-12.v1', 'web',
    '73000000-0000-4000-8000-000000000003', pg_temp.chart_emails_hmac('3')
  ) = '{"outcome":"policy_version_required"}'::jsonb,
  'chart_emails must refuse another purpose''s policy version'
);

select pg_temp.assert_true(
  public.account_v2_record_consent(
    '71000000-0000-4000-8000-000000000001', 'chart_emails', 'grant',
    'chart-emails-2026-11-11.v1', 'web',
    '73000000-0000-4000-8000-000000000004', pg_temp.chart_emails_hmac('4')
  ) @> '{"outcome":"granted","purpose":"chart_emails"}'::jsonb,
  'chart_emails grant must succeed with its own version'
);

select pg_temp.assert_true(
  public.account_v2_bootstrap(
    '71000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001',
    'web',
    repeat('7', 64),
    pg_temp.locator('e')
  ) @> '{"outcome":"ready","chart_sync_consent":"granted","chart_emails_consent":"granted"}'::jsonb,
  'bootstrap must report the granted chart_emails consent'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
      and bool_and(
        sources.chart_id = '74000000-0000-4000-8000-000000000001'
        and sources.revision = 1
        and decode(sources.ciphertext, 'base64') = decode(repeat('20', 68), 'hex')
        and decode(sources.nonce, 'base64') = decode(repeat('21', 12), 'hex')
        and decode(sources.wrapped_key, 'base64') = decode(repeat('22', 68), 'hex')
        and sources.format = 'opaque_v1'
        and sources.key_scope = 'service'
        and sources.key_version = 1
      )
    from public.account_v2_chart_email_sources(array[
      '71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000002'
    ]::uuid[]) as sources
  ),
  'an opted-in account must list exactly its one encrypted self chart'
);

select pg_temp.assert_true(
  (select count(*) from public.account_v2_chart_email_sources(null)) = 0
    and (select count(*) from public.account_v2_chart_email_sources('{}'::uuid[])) = 0
    and (
      select count(*)
      from public.account_v2_chart_email_sources(
        array_append(
          array(select gen_random_uuid() from generate_series(1, 500)),
          '71000000-0000-4000-8000-000000000001'::uuid
        )
      )
    ) = 0,
  'chart sources must refuse empty, null and oversized id lists'
);

-- Weekly digest content: chart reference only, never chart contents.
select pg_temp.assert_true(
  public.weekly_digest_content_v1('71000000-0000-4000-8000-000000000001', 5)
    #> '{snapshot}' = '{"email":"chart-emails-a@example.com","chart":{"chart_id":"74000000-0000-4000-8000-000000000001","revision":1}}'::jsonb
    and public.weekly_digest_content_v1('71000000-0000-4000-8000-000000000002', 5)
      #> '{snapshot}' = '{"email":"chart-emails-b@example.com","chart":null}'::jsonb,
  'weekly content must reference an opted-in chart by id and revision only'
);

-- Withdrawal stops inclusion immediately and keeps the synced chart.
select pg_temp.assert_true(
  public.account_v2_record_consent(
    '71000000-0000-4000-8000-000000000001', 'chart_emails', 'withdraw',
    null, 'web',
    '73000000-0000-4000-8000-000000000005', pg_temp.chart_emails_hmac('5')
  ) @> '{"outcome":"withdrawn","purpose":"chart_emails"}'::jsonb,
  'chart_emails withdrawal must succeed'
);

select pg_temp.assert_true(
  pg_temp.source_count('71000000-0000-4000-8000-000000000001') = 0
    and public.weekly_digest_content_v1('71000000-0000-4000-8000-000000000001', 5)
      #> '{snapshot,chart}' = 'null'::jsonb
    and public.account_v2_owner_self_chart('71000000-0000-4000-8000-000000000001')
      ->>'outcome' = 'ready',
  'withdrawing chart_emails must stop email use at once and leave chart sync alone'
);

reset role;
select pg_temp.assert_true(
  (
    select array_agg(decision || ':' || policy_version order by event_id)
    from private.account_consent_events
    where user_id = '71000000-0000-4000-8000-000000000001'
      and purpose = 'chart_emails'
  ) = array[
    'grant:chart-emails-2026-11-11.v1',
    'withdraw:chart-emails-2026-11-11.v1'
  ]
    and exists (
      select 1
      from private.account_consents
      where user_id = '71000000-0000-4000-8000-000000000001'
        and purpose = 'chart_emails'
        and state = 'withdrawn'
        and withdrawn_at is not null
    ),
  'chart_emails decisions must be recorded as immutable events with current state'
);

select pg_temp.assert_true(
  (
    select count(*)
    from private.account_sync_changes
    where user_id = '71000000-0000-4000-8000-000000000001'
      and entity_type = 'consent'
  ) = 1,
  'only the chart_sync grant may enter the purpose-less consent change feed'
);
set role service_role;

-- Withdrawing chart_sync removes the chart, so the account leaves both
-- sources even while chart_emails is granted again.
select pg_temp.assert_true(
  public.account_v2_record_consent(
    '71000000-0000-4000-8000-000000000001', 'chart_emails', 'grant',
    'chart-emails-2026-11-11.v1', 'web',
    '73000000-0000-4000-8000-000000000006', pg_temp.chart_emails_hmac('6')
  )->>'outcome' = 'granted',
  'chart_emails regrant must succeed'
);

select pg_temp.assert_true(
  pg_temp.source_count('71000000-0000-4000-8000-000000000001') = 1,
  'regrant must restore inclusion'
);

-- A deleting account is never listed.
reset role;
update private.account_states
set status = 'deleting',
    deletion_request_id = '75000000-0000-4000-8000-000000000001',
    deletion_started_at = clock_timestamp()
where user_id = '71000000-0000-4000-8000-000000000001';
set role service_role;
select pg_temp.assert_true(
  pg_temp.source_count('71000000-0000-4000-8000-000000000001') = 0
    and public.account_v2_owner_self_chart('71000000-0000-4000-8000-000000000001')
      = '{"outcome":"not_found"}'::jsonb,
  'an account in deletion must leave both chart sources'
);
reset role;
update private.account_states
set status = 'active',
    deletion_request_id = null,
    deletion_started_at = null
where user_id = '71000000-0000-4000-8000-000000000001';
set role service_role;

select pg_temp.assert_true(
  public.account_v2_record_consent(
    '71000000-0000-4000-8000-000000000001', 'chart_sync', 'withdraw',
    null, 'web',
    '73000000-0000-4000-8000-000000000007', pg_temp.chart_emails_hmac('7')
  )->>'outcome' = 'withdrawn',
  'chart_sync withdrawal must succeed'
);

-- Checked in a later statement: the sources are stable functions and read
-- the snapshot of the statement that calls them.
select pg_temp.assert_true(
  pg_temp.source_count('71000000-0000-4000-8000-000000000001') = 0
    and public.account_v2_owner_self_chart('71000000-0000-4000-8000-000000000001')
      = '{"outcome":"not_found"}'::jsonb,
  'withdrawing chart_sync must remove the chart from every source'
);

reset role;

-- A daily chart preference may now name a v2 chart id: no FK to public.charts.
insert into public.daily_chart_preferences (
  user_id, chart_id, recipient_hash, confirmation_token_hash, timezone, confirmed_at
) values (
  '71000000-0000-4000-8000-000000000002',
  '74000000-0000-4000-8000-000000000002',
  repeat('8', 64),
  null,
  'UTC',
  clock_timestamp()
);
delete from public.charts where id = '74000000-0000-4000-8000-000000000099';
select pg_temp.assert_true(
  (select chart_id from public.daily_chart_preferences
   where user_id = '71000000-0000-4000-8000-000000000002')
    = '74000000-0000-4000-8000-000000000002',
  'removing v1 rows must not touch daily chart preferences'
);
