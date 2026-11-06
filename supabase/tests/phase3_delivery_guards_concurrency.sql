\set ON_ERROR_STOP on

-- Run after phase3_delivery_guards.sql in a disposable PostgreSQL 17
-- database as its owner. dblink supplies genuinely independent sessions: the
-- same-account case uses a lock barrier, and the cross-account case is a
-- bounded stress smoke. This file never runs against production.
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

insert into auth.users (id) values
  ('a0000000-0000-4000-8000-000000000010'),
  ('a0000000-0000-4000-8000-000000000011'),
  ('a0000000-0000-4000-8000-000000000012')
on conflict (id) do nothing;

delete from public.daily_chart_confirmation_send_claims
where user_id in (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000012'
);

select dblink_connect(
  'chart_guard_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'chart_guard_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('chart_guard_a', 'set role service_role');
select dblink_exec('chart_guard_b', 'set role service_role');
select dblink_exec('chart_guard_a', 'set statement_timeout = ''5s''');
select dblink_exec('chart_guard_b', 'set statement_timeout = ''5s''');

-- Hold the account lock in session A, then prove session B is genuinely
-- blocked before A records the winning claim and releases the barrier.
select dblink_exec('chart_guard_a', 'begin');
select dblink_exec(
  'chart_guard_a',
  $$do $block$ begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'a0000000-0000-4000-8000-000000000010',
        7312027
      )
    );
  end $block$;$$
);
select dblink_send_query(
  'chart_guard_b',
  $$select public.claim_daily_chart_confirmation_send(
    'a0000000-0000-4000-8000-000000000010',
    'a1000000-0000-4000-8000-000000000011'
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('chart_guard_b') = 1,
  'the second account claim must be in flight behind the advisory-lock barrier'
);

create temporary table chart_guard_results (test text, outcome text);
insert into chart_guard_results
select 'same_account', value->>'outcome'
from dblink(
  'chart_guard_a',
  $$select public.claim_daily_chart_confirmation_send(
    'a0000000-0000-4000-8000-000000000010',
    'a1000000-0000-4000-8000-000000000010'
  )$$
) as result(value jsonb);
select dblink_exec('chart_guard_a', 'commit');
insert into chart_guard_results
select 'same_account', value->>'outcome'
from dblink_get_result('chart_guard_b') as result(value jsonb);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from chart_guard_results
   where test = 'same_account') = array['capped_60s', 'claimed'],
  'concurrent requests for one account must admit exactly one provider attempt'
);

select dblink_disconnect('chart_guard_a');
select dblink_disconnect('chart_guard_b');
select dblink_connect(
  'chart_guard_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'chart_guard_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('chart_guard_a', 'set role service_role');
select dblink_exec('chart_guard_b', 'set role service_role');
select dblink_exec('chart_guard_a', 'set statement_timeout = ''5s''');
select dblink_exec('chart_guard_b', 'set statement_timeout = ''5s''');

-- Cross-account stress smoke: seed two unrelated stale accounts so each
-- claimant can encounter the other during bounded global pruning. Both
-- sessions must finish inside the timeout; the source-order assertion in the
-- primary SQL suite proves the blocking lock precedes try-only pruning.
insert into public.daily_chart_confirmation_send_claims (
  user_id,
  claim_token,
  claimed_at
) values
  (
    'a0000000-0000-4000-8000-000000000011',
    'a1000000-0000-4000-8000-000000000012',
    clock_timestamp() - interval '25 hours'
  ),
  (
    'a0000000-0000-4000-8000-000000000012',
    'a1000000-0000-4000-8000-000000000013',
    clock_timestamp() - interval '25 hours'
  );

select dblink_send_query(
  'chart_guard_a',
  $$select public.claim_daily_chart_confirmation_send(
    'a0000000-0000-4000-8000-000000000011',
    'a1000000-0000-4000-8000-000000000014'
  )$$
);
select dblink_send_query(
  'chart_guard_b',
  $$select public.claim_daily_chart_confirmation_send(
    'a0000000-0000-4000-8000-000000000012',
    'a1000000-0000-4000-8000-000000000015'
  )$$
);

insert into chart_guard_results
select 'cross_account', value->>'outcome'
from dblink_get_result('chart_guard_a') as result(value jsonb);
insert into chart_guard_results
select 'cross_account', value->>'outcome'
from dblink_get_result('chart_guard_b') as result(value jsonb);

select pg_temp.assert_true(
  (select count(*) = 2 and bool_and(outcome = 'claimed')
   from chart_guard_results
   where test = 'cross_account'),
  'cross-account claims must complete without a prune/claim deadlock'
);

select dblink_disconnect('chart_guard_a');
select dblink_disconnect('chart_guard_b');

-- Global editorial scheduling is a single stream, so even different workers
-- presenting different candidates for the same UTC date must serialize. The
-- winner is durable, the loser observes a conflict, and a retry by the winner
-- remains idempotent without adding another row.
delete from public.push_alert_schedule
where utc_date = '2031-01-10'
   or event_id in (
     'concurrency-schedule-a-2031-01-10',
     'concurrency-schedule-b-2031-01-10'
   );

select dblink_connect(
  'schedule_guard_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'schedule_guard_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('schedule_guard_a', 'set role service_role');
select dblink_exec('schedule_guard_b', 'set role service_role');
select dblink_exec('schedule_guard_a', 'set statement_timeout = ''5s''');
select dblink_exec('schedule_guard_b', 'set statement_timeout = ''5s''');

select dblink_exec('schedule_guard_a', 'begin');
select dblink_exec(
  'schedule_guard_a',
  $$do $block$ begin
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('zodiacs.sky-alert-schedule', 7312029)
    );
  end $block$;$$
);
select dblink_send_query(
  'schedule_guard_b',
  $$select public.select_push_alert_event(
    '2031-01-10',
    'concurrency-schedule-b-2031-01-10',
    3::smallint,
    null
  )$$
);

select pg_temp.assert_true(
  dblink_is_busy('schedule_guard_b') = 1,
  'the competing schedule selection must wait behind the global advisory lock'
);

create temporary table schedule_guard_results (test text, outcome text);
insert into schedule_guard_results
select 'same_date', value->>'outcome'
from dblink(
  'schedule_guard_a',
  $$select public.select_push_alert_event(
    '2031-01-10',
    'concurrency-schedule-a-2031-01-10',
    3::smallint,
    null
  )$$
) as result(value jsonb);
select dblink_exec('schedule_guard_a', 'commit');
insert into schedule_guard_results
select 'same_date', value->>'outcome'
from dblink_get_result('schedule_guard_b') as result(value jsonb);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from schedule_guard_results
   where test = 'same_date') = array['conflict', 'selected'],
  'same-date schedule candidates must produce one selected winner and one conflict'
);

insert into schedule_guard_results
select 'winner_retry', value->>'outcome'
from dblink(
  'schedule_guard_a',
  $$select public.select_push_alert_event(
    '2031-01-10',
    'concurrency-schedule-a-2031-01-10',
    3::smallint,
    null
  )$$
) as result(value jsonb);

select pg_temp.assert_true(
  (select outcome = 'selected'
   from schedule_guard_results
   where test = 'winner_retry')
    and (select count(*) = 1
         from public.push_alert_schedule
         where utc_date = '2031-01-10')
    and exists (
      select 1
      from public.push_alert_schedule
      where utc_date = '2031-01-10'
        and event_id = 'concurrency-schedule-a-2031-01-10'
    ),
  'the selected schedule winner must be durable and idempotent'
);

select dblink_disconnect('schedule_guard_a');
select dblink_disconnect('schedule_guard_b');

-- Provider reservations also need a real two-session proof. Session A owns
-- the exact subscription row while B starts the same event with an independent
-- claim token. A reserves and commits; B then observes the durable event claim
-- as a duplicate. Exactly one provider-attempt row survives the race.
delete from public.push_delivery_claims
where endpoint_hash = encode(
  pg_catalog.sha256(
    pg_catalog.convert_to('https://push.test/concurrency-guard', 'UTF8')
  ),
  'hex'
);
delete from public.push_subscriptions
where endpoint = 'https://push.test/concurrency-guard';
insert into public.push_subscriptions (endpoint, p256dh, auth, lang, sky_alerts) values (
  'https://push.test/concurrency-guard',
  'public_concurrency_guard',
  'auth_concurrency_guard',
  'en',
  true
);

select dblink_connect(
  'push_guard_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'push_guard_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('push_guard_a', 'set role service_role');
select dblink_exec('push_guard_b', 'set role service_role');
select dblink_exec('push_guard_a', 'set statement_timeout = ''5s''');
select dblink_exec('push_guard_b', 'set statement_timeout = ''5s''');

select dblink_exec('push_guard_a', 'begin');
select dblink_exec(
  'push_guard_a',
  $$do $block$ begin
    perform 1
    from public.push_subscriptions
    where endpoint = 'https://push.test/concurrency-guard'
    for update;
  end $block$;$$
);
select dblink_send_query(
  'push_guard_b',
  format(
    $$select public.reserve_push_delivery(
      %s,
      'concurrency-push-2031-01-10',
      %L::timestamptz,
      'b8000000-0000-4000-8000-000000000002'
    )$$,
    (select subscription_id
     from public.push_subscriptions
     where endpoint = 'https://push.test/concurrency-guard'),
    (select updated_at::text
     from public.push_subscriptions
     where endpoint = 'https://push.test/concurrency-guard')
  )
);

select pg_temp.assert_true(
  dblink_is_busy('push_guard_b') = 1,
  'the competing provider reservation must wait behind the subscription-row lock'
);

create temporary table push_guard_results (test text, outcome text);
insert into push_guard_results
select 'same_event', value->>'outcome'
from dblink(
  'push_guard_a',
  format(
    $$select public.reserve_push_delivery(
      %s,
      'concurrency-push-2031-01-10',
      %L::timestamptz,
      'b8000000-0000-4000-8000-000000000001'
    )$$,
    (select subscription_id
     from public.push_subscriptions
     where endpoint = 'https://push.test/concurrency-guard'),
    (select updated_at::text
     from public.push_subscriptions
     where endpoint = 'https://push.test/concurrency-guard')
  )
) as result(value jsonb);
select dblink_exec('push_guard_a', 'commit');
insert into push_guard_results
select 'same_event', value->>'outcome'
from dblink_get_result('push_guard_b') as result(value jsonb);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from push_guard_results
   where test = 'same_event') = array['duplicate', 'reserved']
    and (select count(*) = 1
         from public.push_delivery_claims
         where event_id = 'concurrency-push-2031-01-10')
    and exists (
      select 1
      from public.push_delivery_claims
      where event_id = 'concurrency-push-2031-01-10'
        and claim_token = 'b8000000-0000-4000-8000-000000000001'
        and status = 'reserved'
    ),
  'concurrent provider reservations must create exactly one durable attempt claim'
);

insert into push_guard_results
select 'winner_retry', value->>'outcome'
from dblink(
  'push_guard_a',
  format(
    $$select public.reserve_push_delivery(
      %s,
      'concurrency-push-2031-01-10',
      %L::timestamptz,
      'b8000000-0000-4000-8000-000000000001'
    )$$,
    (select subscription_id
     from public.push_subscriptions
     where endpoint = 'https://push.test/concurrency-guard'),
    (select updated_at::text
     from public.push_subscriptions
     where endpoint = 'https://push.test/concurrency-guard')
  )
) as result(value jsonb);

select pg_temp.assert_true(
  (select outcome = 'reserved'
   from push_guard_results
   where test = 'winner_retry')
    and (select count(*) = 1
         from public.push_delivery_claims
         where event_id = 'concurrency-push-2031-01-10'),
  'the winning provider claim must remain idempotent after the race'
);

select dblink_disconnect('push_guard_a');
select dblink_disconnect('push_guard_b');

delete from public.push_delivery_claims
where event_id = 'concurrency-push-2031-01-10';
delete from public.push_subscriptions
where endpoint = 'https://push.test/concurrency-guard';
delete from public.push_alert_schedule
where utc_date = '2031-01-10';

delete from auth.users
where id in (
  'a0000000-0000-4000-8000-000000000010',
  'a0000000-0000-4000-8000-000000000011',
  'a0000000-0000-4000-8000-000000000012'
);
