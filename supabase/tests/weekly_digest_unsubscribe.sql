\set ON_ERROR_STOP on

begin;

-- The portable Auth stub intentionally has only `id`; production Supabase
-- already provides the email column used by the narrow content projection.
alter table auth.users add column if not exists email text;

create or replace function pg_temp.weekly_test_monday()
returns date
language sql
stable
set search_path = pg_catalog
as $$
  select pg_catalog.date_trunc(
    'week', pg_catalog.statement_timestamp() at time zone 'UTC'
  )::date;
$$;

create or replace function pg_temp.weekly_test_key(candidate_user uuid)
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select 'weekly-digest-v1/' || pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to('weekly-digest-v1', 'UTF8')
      || pg_catalog.decode('00', 'hex')
      || pg_catalog.convert_to(pg_temp.weekly_test_monday()::text, 'UTF8')
      || pg_catalog.decode('00', 'hex')
      || pg_catalog.convert_to(pg_catalog.lower(candidate_user::text), 'UTF8')
    ),
    'hex'
  );
$$;

insert into auth.users (id, email)
select
  ('10000000-0000-4000-8000-' || pg_catalog.lpad(account_number::text, 12, '0'))::uuid,
  'weekly-' || account_number::text || '@example.com'
from pg_catalog.generate_series(1, 86) as accounts(account_number);

insert into public.profiles (user_id, digest_opt_in)
select users.id, true
from auth.users as users
where users.id::text like '10000000-0000-4000-8000-%';

insert into public.charts (id, user_id, payload, created_at, updated_at)
select
  ('11000000-0000-4000-8000-' || pg_catalog.lpad(account_number::text, 12, '0'))::uuid,
  ('10000000-0000-4000-8000-' || pg_catalog.lpad(account_number::text, 12, '0'))::uuid,
  pg_catalog.jsonb_build_object(
    'name', 'Private chart ' || account_number::text,
    'birth', pg_catalog.jsonb_build_object(
      'date', '1990-01-01',
      'place', 'Must not cross the digest boundary'
    ),
    'summary', pg_catalog.jsonb_build_object(
      'bodies', pg_catalog.jsonb_build_array(
        pg_catalog.jsonb_build_object('body', 'Sun', 'lon', 15.25),
        pg_catalog.jsonb_build_object('body', 'Moon', 'lon', 48.5)
      )
    )
  ),
  pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp()
from pg_catalog.generate_series(1, 86) as accounts(account_number);

do $$
declare
  role_name text;
  privilege_name text;
  function_signature text;
begin
  foreach role_name in array array['anon', 'authenticated', 'service_role'] loop
    foreach privilege_name in array array['select', 'insert', 'update', 'delete'] loop
      if pg_catalog.has_table_privilege(
        role_name,
        'public.weekly_digest_unsubscribe_tokens',
        privilege_name
      ) then
        raise exception '% gained direct % unsubscribe-token access', role_name, privilege_name;
      end if;
      if pg_catalog.has_table_privilege(
        role_name,
        'public.weekly_digest_deliveries',
        privilege_name
      ) then
        raise exception '% gained direct % weekly-delivery access', role_name, privilege_name;
      end if;
    end loop;
  end loop;

  if not pg_catalog.has_function_privilege(
    'anon', 'public.weekly_digest_unsubscribe_v1(text)', 'execute'
  ) then
    raise exception 'anonymous unsubscribe RPC execution is required';
  end if;
  if pg_catalog.has_function_privilege(
    'authenticated', 'public.weekly_digest_unsubscribe_v1(text)', 'execute'
  ) or pg_catalog.has_function_privilege(
    'service_role', 'public.weekly_digest_unsubscribe_v1(text)', 'execute'
  ) then
    raise exception 'unsubscribe RPC exceeded its anonymous-only grant';
  end if;

  foreach function_signature in array array[
    'public.weekly_digest_candidates_v1(date,integer)',
    'public.weekly_digest_content_v1(uuid,integer)',
    'public.weekly_digest_issue_v1(date,uuid,uuid,text,timestamptz)',
    'public.weekly_digest_authorized_v1(date,uuid,uuid,text,text,text,text,integer)',
    'public.weekly_digest_recover_v1(uuid)',
    'public.weekly_digest_cancel_v1(date,uuid,uuid)',
    'public.weekly_digest_finish_v1(date,uuid,uuid,boolean,text,integer,text)',
    'public.weekly_digest_prune_v1()'
  ] loop
    if not pg_catalog.has_function_privilege('service_role', function_signature, 'execute') then
      raise exception 'service-role execution missing for %', function_signature;
    end if;
    if pg_catalog.has_function_privilege('anon', function_signature, 'execute')
      or pg_catalog.has_function_privilege('authenticated', function_signature, 'execute')
    then
      raise exception 'service-only function escaped its boundary: %', function_signature;
    end if;
  end loop;
end;
$$;

set local role service_role;

do $$
declare
  candidates uuid[];
  content jsonb;
begin
  select pg_catalog.array_agg(candidate.user_id)
  into candidates
  from public.weekly_digest_candidates_v1(pg_temp.weekly_test_monday(), 80) as candidate;

  if pg_catalog.array_length(candidates, 1) <> 80 then
    raise exception 'candidate RPC did not enforce the 80-account bound';
  end if;

  content := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000001',
    5
  );
  -- Since 20261111170000 the projection never reads public.charts. An
  -- account without the v2 chart_emails consent gets a null chart reference
  -- and the non-chart digest; no v1 name, body or birth field crosses.
  if content ->> 'digest' !~ '^[0-9a-f]{64}$'
    or content #>> '{snapshot,email}' <> 'weekly-1@example.com'
    or content #> '{snapshot,chart}' <> 'null'::jsonb
    or (select pg_catalog.array_agg(key order by key)
        from pg_catalog.jsonb_object_keys(content -> 'snapshot') as keys(key))
      <> array['chart', 'email']
    or content::text like '%1990-01-01%'
    or content::text like '%Must not cross%'
    or content::text like '%Private chart%'
    or content::text like '%15.25%'
  then
    raise exception 'minimal weekly content projection drifted';
  end if;

  if public.weekly_digest_issue_v1(
    pg_temp.weekly_test_monday() - 7,
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    pg_catalog.repeat('a', 64),
    pg_catalog.statement_timestamp() + interval '30 days'
  ) then
    raise exception 'historical live edition was accepted';
  end if;
end;
$$;

reset role;

-- A v1 chart payload, valid or not, no longer affects eligibility or
-- content: the digest reads only the opt-in, the address, and an opted-in v2
-- chart reference. Empty, malformed, and oversized v1 body arrays are inert.
update public.charts
set payload = pg_catalog.jsonb_build_object(
  'name', 'Empty chart',
  'summary', pg_catalog.jsonb_build_object('bodies', '[]'::jsonb)
)
where user_id = '10000000-0000-4000-8000-000000000084';

update public.charts
set payload = pg_catalog.jsonb_build_object(
  'name', 'Malformed chart',
  'summary', pg_catalog.jsonb_build_object(
    'bodies', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('body', 'Sun', 'lon', 'not-a-number')
    )
  )
)
where user_id = '10000000-0000-4000-8000-000000000085';

delete from public.charts
where user_id = '10000000-0000-4000-8000-000000000086';

set local role service_role;
do $$
declare
  account_number integer;
  account_id uuid;
  content jsonb;
begin
  for account_number in 84..86 loop
    account_id := (
      '10000000-0000-4000-8000-'
      || pg_catalog.lpad(account_number::text, 12, '0')
    )::uuid;
    content := public.weekly_digest_content_v1(account_id, 5);
    if content is null
      or content #> '{snapshot,chart}' <> 'null'::jsonb
      or content::text like '%Empty chart%'
      or content::text like '%Malformed%'
    then
      raise exception 'v1 chart % changed the weekly content boundary', account_number;
    end if;
  end loop;
end;
$$;
reset role;

-- Reserve all 80 structural slots and prove account/week idempotency.
set local role service_role;
do $$
declare
  account_number integer;
  account_id uuid;
  lease_id uuid;
  token_hash text;
begin
  for account_number in 1..80 loop
    account_id := (
      '10000000-0000-4000-8000-'
      || pg_catalog.lpad(account_number::text, 12, '0')
    )::uuid;
    lease_id := (
      '20000000-0000-4000-8000-'
      || pg_catalog.lpad(account_number::text, 12, '0')
    )::uuid;
    token_hash := pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(account_id::text, 'UTF8')),
      'hex'
    );
    if not public.weekly_digest_issue_v1(
      pg_temp.weekly_test_monday(),
      account_id,
      lease_id,
      token_hash,
      pg_catalog.statement_timestamp() + interval '30 days'
    ) then
      raise exception 'weekly slot % was not reserved', account_number;
    end if;
  end loop;

  if public.weekly_digest_issue_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000099',
    pg_catalog.repeat('b', 64),
    pg_catalog.statement_timestamp() + interval '30 days'
  ) then
    raise exception 'same-account weekly rerun reserved twice';
  end if;

  if public.weekly_digest_issue_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000081',
    '20000000-0000-4000-8000-000000000081',
    pg_catalog.repeat('c', 64),
    pg_catalog.statement_timestamp() + interval '30 days'
  ) then
    raise exception 'database hard ceiling allowed weekly delivery 81';
  end if;
end;
$$;
reset role;

do $$
begin
  if (select pg_catalog.count(*)
      from public.weekly_digest_deliveries
      where week_start = pg_temp.weekly_test_monday()
        and slot is not null) <> 80
  then
    raise exception 'weekly delivery hard ceiling did not settle at 80';
  end if;
end;
$$;

-- Authorize one exact sealed envelope, unsubscribe after the fence, and prove
-- the in-flight marker plus idempotent finalization.
set local role service_role;
do $$
declare
  content jsonb;
begin
  content := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000001', 5
  );
  if not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000001'),
    pg_catalog.repeat('d', 64),
    content ->> 'digest',
    'wd1.' || pg_catalog.repeat('A', 80),
    5
  ) then
    raise exception 'reserved delivery did not enter dispatching';
  end if;
end;
$$;
reset role;

-- A lost authorization response must not let the sender's best-effort cancel
-- remove the capability from an already fenced envelope.
set local role service_role;
do $$
begin
  if public.weekly_digest_cancel_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'dispatching delivery accepted a pre-provider cancellation';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.weekly_digest_unsubscribe_tokens
    where user_id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'failed dispatch cancellation deleted an in-flight capability';
  end if;
end;
$$;

-- Replace the random digest with a known raw test capability.
update public.weekly_digest_unsubscribe_tokens
set token_hash = pg_catalog.encode(
  pg_catalog.sha256(pg_catalog.convert_to(
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'UTF8'
  )),
  'hex'
)
where user_id = '10000000-0000-4000-8000-000000000001';

set local role anon;
do $$
begin
  if not public.weekly_digest_unsubscribe_v1(
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ) then
    raise exception 'valid capability was rejected';
  end if;
  if not public.weekly_digest_unsubscribe_v1(
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
  ) then
    raise exception 'bounded capability retry was not idempotent';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1
    from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000001'
      and status = 'dispatching'
      and cancel_requested_at is not null
  ) then
    raise exception 'unsubscribe did not mark the in-flight dispatch';
  end if;
end;
$$;

set local role service_role;
do $$
begin
  if not public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    true,
    'provider-receipt-1',
    null,
    null
  ) then
    raise exception 'provider receipt did not finalize';
  end if;
  if not public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    true,
    'provider-receipt-1',
    null,
    null
  ) then
    raise exception 'provider finalization was not idempotent';
  end if;
  if public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    false,
    null,
    422,
    'validation_error'
  ) then
    raise exception 'generic provider failure was terminalized';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1
    from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000001'
      and status = 'sent'
      and sealed_envelope is null
      and provider_receipt = 'provider-receipt-1'
  ) then
    raise exception 'sent tombstone or sealed-envelope erasure drifted';
  end if;
end;
$$;

-- A cancel-marked dispatch must be quarantined even if the user opts back in
-- before recovery. It also must not remain the oldest unclaimable row and
-- starve the next ambiguous provider result.
set local role service_role;
do $$
declare
  content_a jsonb;
  content_b jsonb;
begin
  content_a := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000007', 5
  );
  content_b := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000008', 5
  );
  if not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000007',
    '20000000-0000-4000-8000-000000000007',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000007'),
    pg_catalog.repeat('7', 64),
    content_a ->> 'digest',
    'wd1.' || pg_catalog.repeat('P', 80),
    5
  ) or not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000008',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000008'),
    pg_catalog.repeat('8', 64),
    content_b ->> 'digest',
    'wd1.' || pg_catalog.repeat('Q', 80),
    5
  ) then
    raise exception 'cancel-marker recovery fixtures did not authorize';
  end if;
end;
$$;
reset role;

update public.weekly_digest_unsubscribe_tokens
set token_hash = pg_catalog.encode(
  pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.repeat('P', 43), 'UTF8')),
  'hex'
)
where user_id = '10000000-0000-4000-8000-000000000007';

set local role anon;
do $$
begin
  if not public.weekly_digest_unsubscribe_v1(pg_catalog.repeat('P', 43)) then
    raise exception 'cancel-marker recovery fixture did not unsubscribe';
  end if;
end;
$$;
reset role;

update public.profiles
set digest_opt_in = true
where user_id = '10000000-0000-4000-8000-000000000007';

update public.weekly_digest_deliveries
set reserved_at = pg_catalog.statement_timestamp() - case
      when user_id = '10000000-0000-4000-8000-000000000007' then interval '6 minutes'
      else interval '5 minutes'
    end,
    dispatch_started_at = pg_catalog.statement_timestamp() - case
      when user_id = '10000000-0000-4000-8000-000000000007' then interval '5 minutes'
      else interval '4 minutes'
    end,
    updated_at = pg_catalog.statement_timestamp() - interval '4 minutes'
where user_id in (
  '10000000-0000-4000-8000-000000000007',
  '10000000-0000-4000-8000-000000000008'
);

set local role service_role;
do $$
declare
  recovered_a jsonb;
  recovered_b jsonb;
begin
  recovered_a := public.weekly_digest_recover_v1(
    '20000000-0000-4000-8000-000000000207'
  );
  if recovered_a ->> 'outcome' <> 'reconciliation' then
    raise exception 'cancel-marked oldest dispatch was not quarantined';
  end if;

  recovered_b := public.weekly_digest_recover_v1(
    '20000000-0000-4000-8000-000000000208'
  );
  if recovered_b ->> 'outcome' <> 'claimed'
    or recovered_b ->> 'userId' <> '10000000-0000-4000-8000-000000000008'
    or recovered_b ->> 'leaseToken' <> '20000000-0000-4000-8000-000000000208'
  then
    raise exception 'cancel-marked dispatch starved the next recovery claim';
  end if;

  if not public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000008',
    '20000000-0000-4000-8000-000000000208',
    true,
    'provider-receipt-recovery-8',
    null,
    null
  ) then
    raise exception 'second recovery fixture did not finalize';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1
    from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000007'
      and status = 'reconciliation'
      and cancel_requested_at is not null
      and sealed_envelope is null
      and recovery_claimed_at is null
  ) or not exists (
    select 1
    from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000008'
      and status = 'sent'
      and provider_receipt = 'provider-receipt-recovery-8'
  ) then
    raise exception 'cancel-marker recovery terminal state drifted';
  end if;
end;
$$;

-- Generic provider/configuration failures never consume a recipient or erase
-- its replay envelope. Only the narrow permanent-recipient allowlist can
-- finalize `failed` and discard its unpublished unsubscribe capability.
set local role service_role;
do $$
declare
  content jsonb;
begin
  content := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000004', 5
  );
  if not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000004'),
    pg_catalog.repeat('4', 64),
    content ->> 'digest',
    'wd1.' || pg_catalog.repeat('F', 80),
    5
  ) then
    raise exception 'provider-rejection fixture did not authorize';
  end if;

  if public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    false,
    null,
    422,
    'validation_error'
  ) then
    raise exception 'generic provider failure consumed a dispatching recipient';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000004'
      and status = 'dispatching'
      and sealed_envelope is not null
  ) then
    raise exception 'generic provider failure lost its recoverable fence';
  end if;
end;
$$;

set local role service_role;
do $$
begin
  if not public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000004',
    false,
    null,
    422,
    'invalid_recipient'
  ) then
    raise exception 'explicit permanent recipient rejection did not finalize';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000004'
      and status = 'failed'
      and provider_status = 422
      and provider_code = 'invalid_recipient'
      and sealed_envelope is null
  ) or exists (
    select 1 from public.weekly_digest_unsubscribe_tokens
    where user_id = '10000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'permanent recipient rejection tombstone cleanup drifted';
  end if;
end;
$$;

-- Recovery rotates the whole fence, including the unsubscribe capability.
-- A recovered permanent rejection must delete that unpublished capability.
set local role service_role;
do $$
declare
  content jsonb;
begin
  content := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000005', 5
  );
  if not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000005',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000005'),
    pg_catalog.repeat('5', 64),
    content ->> 'digest',
    'wd1.' || pg_catalog.repeat('G', 80),
    5
  ) then
    raise exception 'recovered-rejection fixture did not authorize';
  end if;
end;
$$;
reset role;

update public.weekly_digest_deliveries
set reserved_at = pg_catalog.statement_timestamp() - interval '4 minutes',
    dispatch_started_at = pg_catalog.statement_timestamp() - interval '3 minutes',
    updated_at = pg_catalog.statement_timestamp() - interval '3 minutes'
where user_id = '10000000-0000-4000-8000-000000000005';

set local role service_role;
do $$
declare
  recovered jsonb;
begin
  recovered := public.weekly_digest_recover_v1(
    '20000000-0000-4000-8000-000000000205'
  );
  if recovered ->> 'leaseToken' <> '20000000-0000-4000-8000-000000000205'
  then
    raise exception 'recovered-rejection fixture was not claimed';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.weekly_digest_unsubscribe_tokens
    where user_id = '10000000-0000-4000-8000-000000000005'
      and lease_token = '20000000-0000-4000-8000-000000000205'
  ) then
    raise exception 'recovery did not rotate the rejection capability lease';
  end if;
end;
$$;

set local role service_role;
do $$
begin
  if not public.weekly_digest_finish_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000005',
    '20000000-0000-4000-8000-000000000205',
    false,
    null,
    422,
    'recipient_suppressed'
  ) then
    raise exception 'recovered permanent rejection did not finalize';
  end if;
end;
$$;
reset role;

do $$
begin
  if exists (
    select 1 from public.weekly_digest_unsubscribe_tokens
    where user_id = '10000000-0000-4000-8000-000000000005'
  ) or not exists (
    select 1 from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000005'
      and status = 'failed'
      and provider_code = 'recipient_suppressed'
  ) then
    raise exception 'recovered rejection retained an unpublished capability';
  end if;
end;
$$;

-- A recovered successful send retains the rotated capability, and its raw
-- email link still revokes consent after finalization.
update public.weekly_digest_unsubscribe_tokens
set token_hash = pg_catalog.encode(
  pg_catalog.sha256(pg_catalog.convert_to(
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS', 'UTF8'
  )),
  'hex'
)
where user_id = '10000000-0000-4000-8000-000000000006';

set local role service_role;
do $$
declare
  content jsonb;
begin
  content := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000006', 5
  );
  if not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000006',
    '20000000-0000-4000-8000-000000000006',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000006'),
    pg_catalog.repeat('6', 64),
    content ->> 'digest',
    'wd1.' || pg_catalog.repeat('H', 80),
    5
  ) then
    raise exception 'recovered-send fixture did not authorize';
  end if;
end;
$$;
reset role;

update public.weekly_digest_deliveries
set reserved_at = pg_catalog.statement_timestamp() - interval '4 minutes',
    dispatch_started_at = pg_catalog.statement_timestamp() - interval '3 minutes',
    updated_at = pg_catalog.statement_timestamp() - interval '3 minutes'
where user_id = '10000000-0000-4000-8000-000000000006';

set local role service_role;
do $$
declare
  recovered jsonb;
begin
  recovered := public.weekly_digest_recover_v1(
    '20000000-0000-4000-8000-000000000206'
  );
  if recovered ->> 'leaseToken' <> '20000000-0000-4000-8000-000000000206'
    or not public.weekly_digest_finish_v1(
      pg_temp.weekly_test_monday(),
      '10000000-0000-4000-8000-000000000006',
      '20000000-0000-4000-8000-000000000206',
      true,
      'provider-receipt-recovered-6',
      null,
      null
    )
  then
    raise exception 'recovered successful delivery did not finalize';
  end if;
end;
$$;
reset role;

set local role anon;
do $$
begin
  if not public.weekly_digest_unsubscribe_v1(
    'SSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSS'
  ) then
    raise exception 'recovered sent capability did not unsubscribe';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = '10000000-0000-4000-8000-000000000006'
      and digest_opt_in = false
  ) or not exists (
    select 1 from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000006'
      and status = 'sent'
      and provider_receipt = 'provider-receipt-recovered-6'
  ) or not exists (
    select 1 from public.weekly_digest_unsubscribe_tokens
    where user_id = '10000000-0000-4000-8000-000000000006'
      and lease_token = '20000000-0000-4000-8000-000000000206'
      and used_at is not null
  ) then
    raise exception 'recovered sent capability association drifted';
  end if;
end;
$$;

-- Free one slot with a reserved unsubscribe, then prove the cancelled
-- account/week tombstone prevents a same-week re-opt-in delivery.
update public.weekly_digest_unsubscribe_tokens
set token_hash = pg_catalog.encode(
  pg_catalog.sha256(pg_catalog.convert_to(
    'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB', 'UTF8'
  )),
  'hex'
)
where user_id = '10000000-0000-4000-8000-000000000002';

set local role anon;
select public.weekly_digest_unsubscribe_v1(
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB'
);
reset role;

update public.profiles
set digest_opt_in = true
where user_id = '10000000-0000-4000-8000-000000000002';

set local role service_role;
do $$
begin
  if public.weekly_digest_issue_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000102',
    pg_catalog.repeat('e', 64),
    pg_catalog.statement_timestamp() + interval '30 days'
  ) then
    raise exception 'cancelled same-week tombstone allowed a resend';
  end if;
end;
$$;
reset role;

-- A never-dispatched stale reservation and its unpublished capability are
-- safely deleted, freeing both the slot and the account/week for a new lease.
update public.weekly_digest_deliveries
set reserved_at = pg_catalog.statement_timestamp() - interval '31 minutes',
    created_at = pg_catalog.statement_timestamp() - interval '31 minutes',
    updated_at = pg_catalog.statement_timestamp() - interval '31 minutes'
where user_id = '10000000-0000-4000-8000-000000000003';
update public.weekly_digest_unsubscribe_tokens
set created_at = pg_catalog.statement_timestamp() - interval '31 minutes'
where user_id = '10000000-0000-4000-8000-000000000003';

set local role service_role;
select public.weekly_digest_prune_v1();
do $$
begin
  if not public.weekly_digest_issue_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000103',
    pg_catalog.repeat('f', 64),
    pg_catalog.statement_timestamp() + interval '30 days'
  ) then
    raise exception 'stale reserved slot was not safely reusable';
  end if;
end;
$$;
reset role;

-- The sealed recovery claim returns byte-preserving fields only inside 24h.
set local role service_role;
do $$
declare
  content jsonb;
begin
  content := public.weekly_digest_content_v1(
    '10000000-0000-4000-8000-000000000003', 5
  );
  if not public.weekly_digest_authorized_v1(
    pg_temp.weekly_test_monday(),
    '10000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000103',
    pg_temp.weekly_test_key('10000000-0000-4000-8000-000000000003'),
    pg_catalog.repeat('1', 64),
    content ->> 'digest',
    'wd1.' || pg_catalog.repeat('B', 80),
    5
  ) then
    raise exception 'recovery fixture did not authorize';
  end if;
end;
$$;
reset role;

update public.weekly_digest_deliveries
set reserved_at = pg_catalog.statement_timestamp() - interval '4 minutes',
    dispatch_started_at = pg_catalog.statement_timestamp() - interval '3 minutes',
    updated_at = pg_catalog.statement_timestamp() - interval '3 minutes'
where user_id = '10000000-0000-4000-8000-000000000003';

set local role service_role;
do $$
declare
  recovered jsonb;
begin
  recovered := public.weekly_digest_recover_v1(
    '20000000-0000-4000-8000-000000000203'
  );
  if recovered ->> 'sealedEnvelope' <> ('wd1.' || pg_catalog.repeat('B', 80))
    or recovered ->> 'envelopeDigest' <> pg_catalog.repeat('1', 64)
    or recovered ->> 'leaseToken' <> '20000000-0000-4000-8000-000000000203'
  then
    raise exception 'sealed recovery claim drifted';
  end if;
end;
$$;
reset role;

-- A dispatch beyond Resend's 24-hour idempotency retention is quarantined,
-- never deleted and never offered for automatic replay.
update public.weekly_digest_deliveries
set reserved_at = pg_catalog.statement_timestamp() - interval '26 hours',
    dispatch_started_at = pg_catalog.statement_timestamp() - interval '25 hours',
    recovery_claimed_at = null,
    updated_at = pg_catalog.statement_timestamp() - interval '25 hours'
where user_id = '10000000-0000-4000-8000-000000000003';

set local role service_role;
select public.weekly_digest_prune_v1();
do $$
begin
  if public.weekly_digest_recover_v1(
    '20000000-0000-4000-8000-000000000303'
  ) is not null then
    raise exception 'expired dispatch was offered for unsafe replay';
  end if;
end;
$$;
reset role;

do $$
begin
  if not exists (
    select 1
    from public.weekly_digest_deliveries
    where user_id = '10000000-0000-4000-8000-000000000003'
      and status = 'reconciliation'
      and sealed_envelope is null
  ) then
    raise exception 'expired dispatch tombstone was deleted or retained sealed PII';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname like 'weekly_digest_%_v1'
      and (
        not procedure.prosecdef
        or not ('search_path=""' = any(
          coalesce(procedure.proconfig, array[]::text[])
        ))
        or pg_catalog.pg_get_userbyid(procedure.proowner) <> 'postgres'
      )
  ) then
    raise exception 'weekly digest definer contract drifted';
  end if;
end;
$$;

rollback;
