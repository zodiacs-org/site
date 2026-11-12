\set ON_ERROR_STOP on

-- Run after every migration, including 20261111180000. Covers
-- weekly_digest_dispatch_recheck_v1, the check the weekly sender makes after
-- every provider queue wait and immediately before each POST attempt.

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

create or replace function pg_temp.recheck_hmac(fill text)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_array('v1:' || repeat(fill, 64));
$$;

create or replace function pg_temp.recheck_locator(fill text)
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

create or replace function pg_temp.monday()
returns date
language sql
stable
as $$
  select date_trunc('week', statement_timestamp() at time zone 'UTC')::date;
$$;

create or replace function pg_temp.weekly_key(candidate_user uuid)
returns text
language sql
stable
as $$
  select 'weekly-digest-v1/' || encode(
    sha256(
      convert_to('weekly-digest-v1', 'UTF8')
      || decode('00', 'hex')
      || convert_to(pg_temp.monday()::text, 'UTF8')
      || decode('00', 'hex')
      || convert_to(lower(candidate_user::text), 'UTF8')
    ),
    'hex'
  );
$$;

-- Reserve and authorize one delivery for the current content, as the sender
-- does, under the given lease.
create or replace function pg_temp.dispatching(candidate_user uuid, lease uuid, token_fill text)
returns void
language plpgsql
as $$
declare
  content jsonb;
begin
  if not public.weekly_digest_issue_v1(
    pg_temp.monday(), candidate_user, lease, repeat(token_fill, 64),
    statement_timestamp() + interval '30 days'
  ) then
    raise exception 'weekly reservation failed';
  end if;
  content := public.weekly_digest_content_v1(candidate_user, 5);
  if not public.weekly_digest_authorized_v1(
    pg_temp.monday(), candidate_user, lease, pg_temp.weekly_key(candidate_user),
    repeat('d', 64), content ->> 'digest', 'wd1.' || repeat('A', 80), 5
  ) then
    raise exception 'weekly authorization failed';
  end if;
end;
$$;

create or replace function pg_temp.recheck(candidate_user uuid, lease uuid)
returns text
language sql
as $$
  select public.weekly_digest_dispatch_recheck_v1(pg_temp.monday(), candidate_user, lease);
$$;

-- Boundary: service only, and definer rights (the delivery table is revoked
-- from every API role, as for the other weekly sender functions).
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.weekly_digest_dispatch_recheck_v1(date,uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.weekly_digest_dispatch_recheck_v1(date,uuid,uuid)', 'execute')
    and has_function_privilege('service_role', 'public.weekly_digest_dispatch_recheck_v1(date,uuid,uuid)', 'execute')
    and (select prosecdef from pg_proc
         where oid = 'public.weekly_digest_dispatch_recheck_v1(date,uuid,uuid)'::regprocedure),
  'the dispatch recheck must be a service-only definer function'
);

alter table auth.users add column if not exists email text;

insert into auth.users (id, email) values
  ('76000000-0000-4000-8000-000000000001', 'recheck-chart@example.com'),
  ('76000000-0000-4000-8000-000000000002', 'recheck-sky@example.com'),
  ('76000000-0000-4000-8000-000000000003', 'recheck-optout@example.com')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (user_id, digest_opt_in) values
  ('76000000-0000-4000-8000-000000000001', true),
  ('76000000-0000-4000-8000-000000000002', true),
  ('76000000-0000-4000-8000-000000000003', true)
on conflict (user_id) do update set digest_opt_in = true;

set role service_role;

-- One v2 account with chart_sync, a self chart and chart_emails.
select pg_temp.assert_true(
  public.account_v2_bootstrap(
    '76000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000001',
    'web',
    repeat('6', 64),
    pg_temp.recheck_locator('e')
  )->>'outcome' = 'ready'
  and public.account_v2_record_consent(
    '76000000-0000-4000-8000-000000000001', 'chart_sync', 'grant',
    'chart-sync-2026-08-12.v1', 'web',
    '78000000-0000-4000-8000-000000000001', pg_temp.recheck_hmac('1')
  )->>'outcome' = 'granted',
  'fixture account must bootstrap and grant chart_sync'
);

select pg_temp.assert_true(
  public.account_v2_put_chart(
    '76000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000001',
    '79000000-0000-4000-8000-000000000001',
    0,
    '78000000-0000-4000-8000-000000000002',
    pg_temp.recheck_hmac('2'),
    'self',
    'self_declared_v1',
    decode(repeat('30', 68), 'hex'),
    decode(repeat('31', 12), 'hex'),
    'opaque_v1',
    'service',
    1,
    decode(repeat('32', 68), 'hex')
  )->>'outcome' = 'saved'
  and public.account_v2_record_consent(
    '76000000-0000-4000-8000-000000000001', 'chart_emails', 'grant',
    'chart-emails-2026-11-11.v1', 'web',
    '78000000-0000-4000-8000-000000000003', pg_temp.recheck_hmac('3')
  )->>'outcome' = 'granted',
  'fixture account must save its self chart and grant chart_emails'
);

select pg_temp.assert_true(
  public.weekly_digest_content_v1('76000000-0000-4000-8000-000000000001', 5)
    #>> '{snapshot,chart,chart_id}' = '79000000-0000-4000-8000-000000000001',
  'fixture account must get the chart edition'
);

-- A chart edition authorized for dispatch, unchanged: dispatch.
select pg_temp.dispatching(
  '76000000-0000-4000-8000-000000000001',
  '7a000000-0000-4000-8000-000000000001',
  'a'
);
select pg_temp.assert_true(
  pg_temp.recheck('76000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001') = 'dispatch'
    and pg_temp.recheck('76000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000009') = 'missing'
    and public.weekly_digest_dispatch_recheck_v1(null, null, null) = 'missing',
  'an unchanged delivery must dispatch; another lease or no input must send nothing'
);

-- Chart emails withdrawn while the sender waits: the delivery goes back to
-- reserved under the same lease and capability, its envelope dropped.
select pg_temp.assert_true(
  public.account_v2_record_consent(
    '76000000-0000-4000-8000-000000000001', 'chart_emails', 'withdraw',
    null, 'web',
    '78000000-0000-4000-8000-000000000004', pg_temp.recheck_hmac('4')
  )->>'outcome' = 'withdrawn',
  'chart_emails withdrawal must succeed'
);

select pg_temp.assert_true(
  pg_temp.recheck('76000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001') = 'released',
  'a withdrawn chart edition must be released before its next attempt'
);

reset role;
select pg_temp.assert_true(
  (select status = 'reserved'
      and lease_token = '7a000000-0000-4000-8000-000000000001'
      and slot is not null
      and idempotency_key is null
      and envelope_digest is null
      and content_digest is null
      and sealed_envelope is null
      and max_charts is null
      and dispatch_started_at is null
   from public.weekly_digest_deliveries
   where week_start = pg_temp.monday()
     and user_id = '76000000-0000-4000-8000-000000000001')
    and exists (
      select 1 from public.weekly_digest_unsubscribe_tokens
      where user_id = '76000000-0000-4000-8000-000000000001'
        and lease_token = '7a000000-0000-4000-8000-000000000001'
        and used_at is null
    ),
  'a released delivery must be reserved again with no envelope and its capability kept'
);
set role service_role;

-- The sender rebuilds it from the current content: the sky edition.
do $$
declare
  content jsonb := public.weekly_digest_content_v1('76000000-0000-4000-8000-000000000001', 5);
begin
  if content #> '{snapshot,chart}' <> 'null'::jsonb then
    raise exception 'withdrawn account must get the sky edition';
  end if;
  if not public.weekly_digest_authorized_v1(
    pg_temp.monday(), '76000000-0000-4000-8000-000000000001',
    '7a000000-0000-4000-8000-000000000001',
    pg_temp.weekly_key('76000000-0000-4000-8000-000000000001'),
    repeat('e', 64), content ->> 'digest', 'wd1.' || repeat('B', 80), 5
  ) then
    raise exception 'released delivery must authorize again from current content';
  end if;
end;
$$;

select pg_temp.assert_true(
  pg_temp.recheck('76000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001') = 'dispatch',
  'the rebuilt sky edition must dispatch'
);

-- A recovery replay whose content moved is quarantined, never released.
reset role;
update public.weekly_digest_deliveries
set recovery_claimed_at = dispatch_started_at
where week_start = pg_temp.monday()
  and user_id = '76000000-0000-4000-8000-000000000001';
set role service_role;

select pg_temp.assert_true(
  public.account_v2_record_consent(
    '76000000-0000-4000-8000-000000000001', 'chart_emails', 'grant',
    'chart-emails-2026-11-11.v1', 'web',
    '78000000-0000-4000-8000-000000000005', pg_temp.recheck_hmac('5')
  )->>'outcome' = 'granted',
  'chart_emails regrant must succeed'
);

select pg_temp.assert_true(
  pg_temp.recheck('76000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001') = 'reconciliation'
    and pg_temp.recheck('76000000-0000-4000-8000-000000000001', '7a000000-0000-4000-8000-000000000001') = 'missing',
  'a changed recovery replay must be quarantined and then send nothing'
);

reset role;
select pg_temp.assert_true(
  (select status = 'reconciliation' and sealed_envelope is null and recovery_claimed_at is null
   from public.weekly_digest_deliveries
   where week_start = pg_temp.monday()
     and user_id = '76000000-0000-4000-8000-000000000001'),
  'a quarantined replay must drop its sealed envelope'
);
set role service_role;

-- An unsubscribe marked during dispatch: cancelled, capability removed.
select pg_temp.dispatching(
  '76000000-0000-4000-8000-000000000002',
  '7a000000-0000-4000-8000-000000000002',
  'b'
);
reset role;
update public.weekly_digest_deliveries
set cancel_requested_at = statement_timestamp()
where week_start = pg_temp.monday()
  and user_id = '76000000-0000-4000-8000-000000000002';
set role service_role;

select pg_temp.assert_true(
  pg_temp.recheck('76000000-0000-4000-8000-000000000002', '7a000000-0000-4000-8000-000000000002') = 'cancelled',
  'a delivery with a cancel marker must be cancelled'
);

reset role;
select pg_temp.assert_true(
  (select status = 'cancelled' and lease_token is null and slot is null and sealed_envelope is null
   from public.weekly_digest_deliveries
   where week_start = pg_temp.monday()
     and user_id = '76000000-0000-4000-8000-000000000002')
    and not exists (
      select 1 from public.weekly_digest_unsubscribe_tokens
      where user_id = '76000000-0000-4000-8000-000000000002'
        and lease_token = '7a000000-0000-4000-8000-000000000002'
        and used_at is null
    ),
  'a cancelled delivery must hold no lease, envelope or unused capability'
);
set role service_role;

-- Opted out of the digest after authorization: released, and the sender's
-- next authorization refuses it.
select pg_temp.dispatching(
  '76000000-0000-4000-8000-000000000003',
  '7a000000-0000-4000-8000-000000000003',
  'c'
);
reset role;
update public.profiles set digest_opt_in = false
where user_id = '76000000-0000-4000-8000-000000000003';
set role service_role;

select pg_temp.assert_true(
  pg_temp.recheck('76000000-0000-4000-8000-000000000003', '7a000000-0000-4000-8000-000000000003') = 'released'
    and public.weekly_digest_cancel_v1(
      pg_temp.monday(), '76000000-0000-4000-8000-000000000003',
      '7a000000-0000-4000-8000-000000000003'
    ),
  'an opted-out delivery must be released and then cancellable'
);

reset role;
