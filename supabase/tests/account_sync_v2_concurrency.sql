\set ON_ERROR_STOP on

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

create or replace function pg_temp.envelope(fill text)
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

insert into auth.users (id) values
  ('61000000-0000-4000-8000-000000000001'),
  ('61000000-0000-4000-8000-000000000002'),
  ('61000000-0000-4000-8000-000000000003'),
  ('61000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

set role service_role;

select public.account_v2_bootstrap(
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  'web',
  repeat('a', 64),
  pg_temp.envelope('a')
);

select public.account_v2_record_consent(
  '61000000-0000-4000-8000-000000000001',
  'chart_sync',
  'grant',
  'chart-sync-2026-08-12.v1',
  'web',
  '63000000-0000-4000-8000-000000000001',
  jsonb_build_array('v1:' || repeat('1', 64))
);

select public.account_v2_put_chart(
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001',
  0,
  '63000000-0000-4000-8000-000000000002',
  jsonb_build_array('v1:' || repeat('2', 64)),
  'self',
  'self_declared_v1',
  decode(repeat('aa', 68), 'hex'),
  decode(repeat('ab', 12), 'hex'),
  'opaque_v1',
  'service',
  1,
  decode(repeat('ac', 68), 'hex')
);

reset role;

select dblink_connect(
  'account_v2_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'account_v2_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('account_v2_a', 'set role service_role');
select dblink_exec('account_v2_b', 'set role service_role');
select dblink_exec('account_v2_a', 'set statement_timeout = ''5s''');
select dblink_exec('account_v2_b', 'set statement_timeout = ''5s''');

create temporary table account_v2_concurrency_results (
  test text not null,
  value jsonb not null
);

-- Authenticated v1 chart inserts are paused, so the old "legacy write wins
-- the cutover race" schedule can no longer commit a row. Hold the same
-- per-user lock with the helper the insert policy used to call, after seeding
-- an existing row as the table owner. Bootstrap must still wait, observe the
-- committed raw chart, and leave zero v2 authority.
insert into public.charts (id, user_id, payload) values (
  '64000000-0000-4000-8000-000000000099',
  '61000000-0000-4000-8000-000000000003',
  '{"fixture":"write-block-existing"}'::jsonb
);

select dblink_exec('account_v2_a', 'reset role');
select dblink_exec(
  'account_v2_a',
  $$set request.jwt.claim.sub =
    '61000000-0000-4000-8000-000000000003'$$
);
select dblink_exec('account_v2_a', 'set role authenticated');
select dblink_exec('account_v2_a', 'begin');
select dblink_exec(
  'account_v2_a',
  $$select public.account_v2_legacy_sync_allowed()$$
);

select dblink_send_query(
  'account_v2_b',
  $$select public.account_v2_bootstrap(
    '61000000-0000-4000-8000-000000000003',
    '62000000-0000-4000-8000-000000000003',
    'web',
    repeat('c', 64),
    jsonb_build_object(
      'ciphertext', encode(decode(repeat('ca', 32), 'hex'), 'base64'),
      'nonce', encode(decode(repeat('cb', 12), 'hex'), 'base64'),
      'format', 'opaque_v1',
      'key_scope', 'service',
      'key_version', 1,
      'wrapped_key', encode(decode(repeat('cc', 68), 'hex'), 'base64')
    )
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('account_v2_b') = 1,
  'bootstrap must wait behind an in-flight legacy sync lock'
);

select dblink_exec('account_v2_a', 'commit');

insert into account_v2_concurrency_results
select 'legacy_cutover', value
from dblink_get_result('account_v2_b') as result(value jsonb);

-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (
    select 1
    from dblink_get_result('account_v2_b') as drained(value jsonb)
  ),
  'legacy-cutover async result must be fully drained'
);

select pg_temp.assert_true(
  (select value = '{"outcome":"legacy_migration_required"}'::jsonb
   from account_v2_concurrency_results where test = 'legacy_cutover')
    and exists (
      select 1
      from public.charts
      where user_id = '61000000-0000-4000-8000-000000000003'
    )
    and not exists (
      select 1
      from private.account_states
      where user_id = '61000000-0000-4000-8000-000000000003'
    )
    and not exists (
      select 1
      from private.account_sync_devices
      where user_id = '61000000-0000-4000-8000-000000000003'
    )
    and not exists (
      select 1
      from private.account_daily_sun_recipient_aliases
      where user_id = '61000000-0000-4000-8000-000000000003'
    ),
  'an existing v1 row must force zero-write legacy_migration_required behind the shared lock'
);

select dblink_exec('account_v2_a', 'reset role');
select dblink_exec('account_v2_a', 'set role service_role');

-- Two writers sharing revision one serialize on the account authority row.
select dblink_exec('account_v2_a', 'begin');
select dblink_exec(
  'account_v2_a',
  $$do $block$ begin
    perform 1
    from private.account_states
    where user_id = '61000000-0000-4000-8000-000000000001'
    for update;
  end $block$;$$
);
select dblink_send_query(
  'account_v2_b',
  $$select public.account_v2_put_chart(
    '61000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000004',
    jsonb_build_array('v1:' || repeat('4', 64)),
    'self',
    'self_declared_v1',
    decode(repeat('ba', 68), 'hex'),
    decode(repeat('bb', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('bc', 68), 'hex')
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('account_v2_b') = 1,
  'the second same-chart writer must wait on the account lock'
);

insert into account_v2_concurrency_results
select 'same_base', value
from dblink(
  'account_v2_a',
  $$select public.account_v2_put_chart(
    '61000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000001',
    1,
    '63000000-0000-4000-8000-000000000003',
    jsonb_build_array('v1:' || repeat('3', 64)),
    'self',
    'self_declared_v1',
    decode(repeat('bd', 68), 'hex'),
    decode(repeat('be', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('bf', 68), 'hex')
  )$$
) as result(value jsonb);

select dblink_exec('account_v2_a', 'commit');

insert into account_v2_concurrency_results
select 'same_base', value
from dblink_get_result('account_v2_b') as result(value jsonb);

select pg_temp.assert_true(
  not exists (
    select 1
    from dblink_get_result('account_v2_b') as drained(value jsonb)
  ),
  'same-base async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(value->>'outcome' order by value->>'outcome')
   from account_v2_concurrency_results
   where test = 'same_base') = array['conflict', 'saved']
    and (
      select revision = 2
      from private.account_chart_records
      where user_id = '61000000-0000-4000-8000-000000000001'
        and chart_id = '64000000-0000-4000-8000-000000000001'
    ),
  'one same-base writer must save revision two and one must conflict'
);

set role service_role;
select public.account_v2_bootstrap(
  '61000000-0000-4000-8000-000000000002',
  '62000000-0000-4000-8000-000000000002',
  'web',
  repeat('b', 64),
  pg_temp.envelope('b')
);
select public.account_v2_record_consent(
  '61000000-0000-4000-8000-000000000002',
  'chart_sync',
  'grant',
  'chart-sync-2026-08-12.v1',
  'web',
  '63000000-0000-4000-8000-000000000009',
  jsonb_build_array('v1:' || repeat('9', 64))
);
reset role;

select dblink_disconnect('account_v2_a');
select dblink_disconnect('account_v2_b');
select dblink_connect(
  'account_v2_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'account_v2_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('account_v2_a', 'set role service_role');
select dblink_exec('account_v2_b', 'set role service_role');
select dblink_exec('account_v2_a', 'set statement_timeout = ''5s''');
select dblink_exec('account_v2_b', 'set statement_timeout = ''5s''');

-- Different revision-zero chart IDs race for the one active self-chart slot.
select dblink_exec('account_v2_a', 'begin');
select dblink_exec(
  'account_v2_a',
  $$do $block$ begin
    perform 1
    from private.account_states
    where user_id = '61000000-0000-4000-8000-000000000002'
    for update;
  end $block$;$$
);
select dblink_send_query(
  'account_v2_b',
  $$select public.account_v2_put_chart(
    '61000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000002',
    '64000000-0000-4000-8000-000000000003',
    0,
    '63000000-0000-4000-8000-000000000011',
    jsonb_build_array('v1:' || repeat('b', 64)),
    'self',
    'self_declared_v1',
    decode(repeat('ca', 68), 'hex'),
    decode(repeat('cb', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('cc', 68), 'hex')
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('account_v2_b') = 1,
  'the second new chart ID must wait on the account lock'
);

insert into account_v2_concurrency_results
select 'different_chart_ids', value
from dblink(
  'account_v2_a',
  $$select public.account_v2_put_chart(
    '61000000-0000-4000-8000-000000000002',
    '62000000-0000-4000-8000-000000000002',
    '64000000-0000-4000-8000-000000000002',
    0,
    '63000000-0000-4000-8000-000000000010',
    jsonb_build_array('v1:' || repeat('a', 64)),
    'self',
    'self_declared_v1',
    decode(repeat('cd', 68), 'hex'),
    decode(repeat('ce', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('cf', 68), 'hex')
  )$$
) as result(value jsonb);

select dblink_exec('account_v2_a', 'commit');

insert into account_v2_concurrency_results
select 'different_chart_ids', value
from dblink_get_result('account_v2_b') as result(value jsonb);

select pg_temp.assert_true(
  not exists (
    select 1
    from dblink_get_result('account_v2_b') as drained(value jsonb)
  ),
  'different-chart async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(value->>'outcome' order by value->>'outcome')
   from account_v2_concurrency_results
   where test = 'different_chart_ids') = array['chart_limit_reached', 'saved']
    and (
      select count(*) = 1
      from private.account_chart_records
      where user_id = '61000000-0000-4000-8000-000000000002'
    ),
  'two distinct chart IDs must produce one saved row and chart_limit_reached'
);

select dblink_disconnect('account_v2_a');
select dblink_disconnect('account_v2_b');
select dblink_connect(
  'account_v2_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'account_v2_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('account_v2_a', 'set role service_role');
select dblink_exec('account_v2_b', 'set role service_role');
select dblink_exec('account_v2_a', 'set statement_timeout = ''5s''');
select dblink_exec('account_v2_b', 'set statement_timeout = ''5s''');

-- A waiting stale write must observe consent withdrawal after the lock wakes.
select dblink_exec('account_v2_a', 'begin');
select dblink_exec(
  'account_v2_a',
  $$do $block$ begin
    perform 1
    from private.account_states
    where user_id = '61000000-0000-4000-8000-000000000001'
    for update;
  end $block$;$$
);
select dblink_send_query(
  'account_v2_b',
  $$select public.account_v2_put_chart(
    '61000000-0000-4000-8000-000000000001',
    '62000000-0000-4000-8000-000000000001',
    '64000000-0000-4000-8000-000000000001',
    2,
    '63000000-0000-4000-8000-000000000006',
    jsonb_build_array('v1:' || repeat('6', 64)),
    'self',
    'self_declared_v1',
    decode(repeat('da', 68), 'hex'),
    decode(repeat('db', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('dc', 68), 'hex')
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('account_v2_b') = 1,
  'the stale writer must wait while withdrawal owns the account lock'
);

insert into account_v2_concurrency_results
select 'withdrawal', value
from dblink(
  'account_v2_a',
  $$select public.account_v2_withdraw_chart_sync(
    '61000000-0000-4000-8000-000000000001',
    null,
    'web',
    '63000000-0000-4000-8000-000000000005',
    jsonb_build_array('v1:' || repeat('5', 64))
  )$$
) as result(value jsonb);

select dblink_exec('account_v2_a', 'commit');

insert into account_v2_concurrency_results
select 'withdrawal', value
from dblink_get_result('account_v2_b') as result(value jsonb);

select pg_temp.assert_true(
  not exists (
    select 1
    from dblink_get_result('account_v2_b') as drained(value jsonb)
  ),
  'withdrawal async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(value->>'outcome' order by value->>'outcome')
   from account_v2_concurrency_results
   where test = 'withdrawal') = array['consent_required', 'withdrawn']
    and not exists (
      select 1
      from private.account_chart_records
      where user_id = '61000000-0000-4000-8000-000000000001'
    )
    and exists (
      select 1
      from private.account_sync_tombstones
      where user_id = '61000000-0000-4000-8000-000000000001'
        and chart_id = '64000000-0000-4000-8000-000000000001'
        and revision = 3
    ),
  'consent withdrawal must be terminal against a waiting stale write'
);

-- Two simultaneous recovery rotations behind an already-deleting account are
-- serialized by the same recipient/owner lock order. With two active receipts,
-- exactly one contender can consume the final bounded slot.
set role service_role;
select public.account_v2_bootstrap(
  '61000000-0000-4000-8000-000000000004',
  '62000000-0000-4000-8000-000000000004',
  'web',
  repeat('d', 64),
  pg_temp.envelope('d')
);
select public.account_v2_prepare_deletion(
  '61000000-0000-4000-8000-000000000004',
  '63000000-0000-4000-8000-000000000020',
  jsonb_build_array('v1:' || repeat('a', 64)),
  '[]'::jsonb,
  false
);
select public.account_v2_prepare_deletion(
  '61000000-0000-4000-8000-000000000004',
  '63000000-0000-4000-8000-000000000021',
  jsonb_build_array('v1:' || repeat('b', 64)),
  '[]'::jsonb,
  false
);
reset role;

select dblink_exec('account_v2_a', 'begin');
select dblink_exec(
  'account_v2_a',
  $$do $block$ begin
    perform pg_advisory_xact_lock(hashtextextended(repeat('d', 64), 7312026));
    perform 1
    from private.account_states
    where user_id = '61000000-0000-4000-8000-000000000004'
    for update;
  end $block$;$$
);
select dblink_send_query(
  'account_v2_b',
  $$select public.account_v2_prepare_deletion(
    '61000000-0000-4000-8000-000000000004',
    '63000000-0000-4000-8000-000000000023',
    jsonb_build_array('v1:' || repeat('d', 64)),
    '[]'::jsonb,
    false
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('account_v2_b') = 1,
  'the competing receipt rotation must wait on the shared account lock'
);

insert into account_v2_concurrency_results
select 'receipt_cap', value
from dblink(
  'account_v2_a',
  $$select public.account_v2_prepare_deletion(
    '61000000-0000-4000-8000-000000000004',
    '63000000-0000-4000-8000-000000000022',
    jsonb_build_array('v1:' || repeat('c', 64)),
    '[]'::jsonb,
    false
  )$$
) as result(value jsonb);

select dblink_exec('account_v2_a', 'commit');

insert into account_v2_concurrency_results
select 'receipt_cap', value
from dblink_get_result('account_v2_b') as result(value jsonb);

select pg_temp.assert_true(
  not exists (
    select 1
    from dblink_get_result('account_v2_b') as drained(value jsonb)
  ),
  'receipt-cap async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(value->>'outcome' order by value->>'outcome')
   from account_v2_concurrency_results
   where test = 'receipt_cap') = array['already_prepared', 'receipt_limit_reached']
    and (
      select count(*) = 3
      from private.account_deletion_receipts
      where user_id = '61000000-0000-4000-8000-000000000004'
        and expires_at > clock_timestamp()
    ),
  'concurrent rotations must leave no more than three active receipts'
);

select dblink_disconnect('account_v2_a');
select dblink_disconnect('account_v2_b');
