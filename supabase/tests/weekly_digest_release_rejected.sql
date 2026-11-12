\set ON_ERROR_STOP on

-- Run after every migration, including 20261111190000. Covers
-- weekly_digest_release_rejected_v1, which the weekly sender calls when the
-- provider definitively rejected a new chart edition, so that delivery never
-- reaches the recovery replay (whose first attempt is not rechecked).

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

create or replace function pg_temp.release(candidate_user uuid, lease uuid)
returns text
language sql
as $$
  select public.weekly_digest_release_rejected_v1(pg_temp.monday(), candidate_user, lease);
$$;

-- Boundary: service only, and definer rights (the delivery table is revoked
-- from every API role, as for the other weekly sender functions).
select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.weekly_digest_release_rejected_v1(date,uuid,uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public.weekly_digest_release_rejected_v1(date,uuid,uuid)', 'execute')
    and has_function_privilege('service_role', 'public.weekly_digest_release_rejected_v1(date,uuid,uuid)', 'execute')
    and (select prosecdef from pg_proc
         where oid = 'public.weekly_digest_release_rejected_v1(date,uuid,uuid)'::regprocedure),
  'the rejected-dispatch release must be a service-only definer function'
);

alter table auth.users add column if not exists email text;

insert into auth.users (id, email) values
  ('86000000-0000-4000-8000-000000000001', 'release-new@example.com'),
  ('86000000-0000-4000-8000-000000000002', 'release-recovered@example.com'),
  ('86000000-0000-4000-8000-000000000003', 'release-cancelled@example.com')
on conflict (id) do update set email = excluded.email;

insert into public.profiles (user_id, digest_opt_in) values
  ('86000000-0000-4000-8000-000000000001', true),
  ('86000000-0000-4000-8000-000000000002', true),
  ('86000000-0000-4000-8000-000000000003', true)
on conflict (user_id) do update set digest_opt_in = true;

set role service_role;

-- A new dispatch the provider rejected: back to reserved under the same lease
-- and capability, its envelope dropped, and never claimed by recovery.
select pg_temp.dispatching(
  '86000000-0000-4000-8000-000000000001',
  '8a000000-0000-4000-8000-000000000001',
  '7'
);
select pg_temp.assert_true(
  pg_temp.release('86000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000009') = 'missing'
    and public.weekly_digest_release_rejected_v1(null, null, null) = 'missing'
    and pg_temp.release('86000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001') = 'released'
    and pg_temp.release('86000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000001') = 'missing',
  'only the dispatching lease may be released, once'
);

reset role;
select pg_temp.assert_true(
  (select status = 'reserved'
      and lease_token = '8a000000-0000-4000-8000-000000000001'
      and slot is not null
      and idempotency_key is null
      and envelope_digest is null
      and content_digest is null
      and sealed_envelope is null
      and max_charts is null
      and dispatch_started_at is null
      and recovery_claimed_at is null
   from public.weekly_digest_deliveries
   where week_start = pg_temp.monday()
     and user_id = '86000000-0000-4000-8000-000000000001')
    and exists (
      select 1 from public.weekly_digest_unsubscribe_tokens
      where user_id = '86000000-0000-4000-8000-000000000001'
        and lease_token = '8a000000-0000-4000-8000-000000000001'
        and used_at is null
    ),
  'a released delivery must be reserved again with no envelope and its capability kept'
);

-- Age every dispatch past the recovery claim's two-minute floor.
update public.weekly_digest_deliveries
set reserved_at = reserved_at - interval '10 minutes',
    dispatch_started_at = dispatch_started_at - interval '10 minutes'
where week_start = pg_temp.monday()
  and user_id = '86000000-0000-4000-8000-000000000001';
set role service_role;

select pg_temp.assert_true(
  public.weekly_digest_recover_v1('8b000000-0000-4000-8000-000000000001') is null,
  'recovery must not claim a released delivery'
);

-- A recovery replay is never released: its first dispatch stays ambiguous.
select pg_temp.dispatching(
  '86000000-0000-4000-8000-000000000002',
  '8a000000-0000-4000-8000-000000000002',
  '8'
);
reset role;
update public.weekly_digest_deliveries
set reserved_at = reserved_at - interval '10 minutes',
    dispatch_started_at = dispatch_started_at - interval '10 minutes'
where week_start = pg_temp.monday()
  and user_id = '86000000-0000-4000-8000-000000000002';
set role service_role;

select pg_temp.assert_true(
  public.weekly_digest_recover_v1('8a000000-0000-4000-8000-000000000012')
    ->> 'userId' = '86000000-0000-4000-8000-000000000002',
  'the ambiguous dispatch must be claimed by recovery'
);
select pg_temp.assert_true(
  pg_temp.release('86000000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-000000000012') = 'missing',
  'a recovery replay must never be released'
);

reset role;
select pg_temp.assert_true(
  (select status = 'dispatching' and sealed_envelope is not null and recovery_claimed_at is not null
   from public.weekly_digest_deliveries
   where week_start = pg_temp.monday()
     and user_id = '86000000-0000-4000-8000-000000000002'),
  'a recovery replay must stay dispatching with its sealed envelope'
);

-- An unsubscribe marked during dispatch: cancelled, capability removed.
set role service_role;
select pg_temp.dispatching(
  '86000000-0000-4000-8000-000000000003',
  '8a000000-0000-4000-8000-000000000003',
  '9'
);
reset role;
update public.weekly_digest_deliveries
set cancel_requested_at = statement_timestamp()
where week_start = pg_temp.monday()
  and user_id = '86000000-0000-4000-8000-000000000003';
set role service_role;

select pg_temp.assert_true(
  pg_temp.release('86000000-0000-4000-8000-000000000003', '8a000000-0000-4000-8000-000000000003') = 'cancelled',
  'a rejected delivery with a cancel marker must be cancelled'
);

reset role;
select pg_temp.assert_true(
  (select status = 'cancelled' and lease_token is null and slot is null and sealed_envelope is null
   from public.weekly_digest_deliveries
   where week_start = pg_temp.monday()
     and user_id = '86000000-0000-4000-8000-000000000003')
    and not exists (
      select 1 from public.weekly_digest_unsubscribe_tokens
      where user_id = '86000000-0000-4000-8000-000000000003'
        and lease_token = '8a000000-0000-4000-8000-000000000003'
        and used_at is null
    ),
  'a cancelled delivery must hold no lease, envelope or unused capability'
);

-- The released delivery is pruned once stale, so the next run may create it
-- again from current content.
update public.weekly_digest_deliveries
set reserved_at = statement_timestamp() - interval '31 minutes'
where week_start = pg_temp.monday()
  and user_id = '86000000-0000-4000-8000-000000000001';
set role service_role;
select pg_temp.assert_true(
  public.weekly_digest_prune_v1() > 0,
  'prune must remove the stale released reservation'
);
reset role;
select pg_temp.assert_true(
  not exists (
    select 1 from public.weekly_digest_deliveries
    where week_start = pg_temp.monday()
      and user_id = '86000000-0000-4000-8000-000000000001'
  ),
  'the released delivery must be gone, so the account is a candidate again'
);
