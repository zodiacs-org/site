\set ON_ERROR_STOP on

-- Run after all migrations in a disposable PostgreSQL database
-- (scripts/test-phase4-compat-invites-sql.sh). Proves the invite consent
-- boundary: the migration adds the consent table and nothing that ties an
-- address to an invite, browser roles reach nothing, and a consent row is
-- written only for an allowlisted version: the inviter's by the owner, the
-- recipient's once the released completion has completed the invite.

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

create or replace function pg_temp.wire()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'b', jsonb_build_array(15, 45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345),
    'h', 'w', 'v', '3.2.1', 'a', jsonb_build_array(100, 190)
  );
$$;

-- The migration creates the consent table only: no signup table, and no
-- function that stages or completes an invite from an email confirmation.
select pg_temp.assert_true(
  to_regclass('public.compatibility_invite_consents') is not null
    and to_regclass('public.compatibility_invite_signups') is null
    and to_regprocedure('public.stage_compatibility_invite_signup(text,text)') is null
    and to_regprocedure('public.confirm_compatibility_invite_signups(text)') is null,
  'the migration creates compatibility_invite_consents only'
);

select pg_temp.assert_true(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.compatibility_invite_consents'::regclass)
    and not exists (select 1 from pg_catalog.pg_policy where polrelid = 'public.compatibility_invite_consents'::regclass),
  'the consent table has RLS and no browser policies'
);

select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.compatibility_invite_consents', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'public.compatibility_invite_consents', 'select,insert,update,delete')
    and not has_table_privilege('service_role', 'public.compatibility_invite_consents', 'select,insert,update,delete'),
  'consent persistence is RPC-only, including for service_role'
);

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.record_compatibility_invite_inviter_consent(uuid,uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_compatibility_invite_inviter_consent(uuid,uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.record_compatibility_invite_recipient_consent(uuid,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.record_compatibility_invite_recipient_consent(uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.record_compatibility_invite_inviter_consent(uuid,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.record_compatibility_invite_recipient_consent(uuid,text)', 'execute'),
  'only the service role calls the consent functions'
);

insert into auth.users (id) values
  ('52000000-0000-4000-8000-000000000001'),
  ('52000000-0000-4000-8000-000000000002')
on conflict do nothing;

create temporary table consent_invites as
select
  (public.create_compatibility_invite('52000000-0000-4000-8000-000000000001', 'Frida', 'aries', pg_temp.wire(), true, true, repeat('1', 64))->>'invite_id')::uuid as open_one,
  (public.create_compatibility_invite('52000000-0000-4000-8000-000000000001', 'Frida', 'aries', pg_temp.wire(), true, false, repeat('2', 64))->>'invite_id')::uuid as unknown_version,
  (public.create_compatibility_invite('52000000-0000-4000-8000-000000000002', 'Ana', 'aries', pg_temp.wire(), true, false, repeat('3', 64))->>'invite_id')::uuid as other_owner;

select pg_temp.assert_true(
  (select open_one is not null and unknown_version is not null and other_owner is not null from consent_invites),
  'fixture invites were created'
);

-- The inviter's consent: recorded only by the owner and only for an allowlisted version.
select pg_temp.assert_true(
  public.record_compatibility_invite_inviter_consent((select open_one from consent_invites), '52000000-0000-4000-8000-000000000001', 'invite-inviter-2026-11-16.v1')->>'outcome' = 'recorded'
    and public.record_compatibility_invite_inviter_consent((select other_owner from consent_invites), '52000000-0000-4000-8000-000000000001', 'invite-inviter-2026-11-16.v1')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_inviter_consent((select unknown_version from consent_invites), '52000000-0000-4000-8000-000000000001', 'invite-inviter-2026-11-09.v1')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_inviter_consent((select unknown_version from consent_invites), '52000000-0000-4000-8000-000000000001', 'invite-recipient-2026-11-16.v2')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_inviter_consent((select unknown_version from consent_invites), '52000000-0000-4000-8000-000000000001', null)->>'outcome' = 'unavailable',
  'an inviter consent row is written only by the owner and for an allowlisted version'
);
select pg_temp.assert_true(
  (select count(*) from public.compatibility_invite_consents where party = 'inviter') = 1
    and exists (select 1 from public.compatibility_invite_consents where invite_id = (select open_one from consent_invites) and party = 'inviter' and policy_version = 'invite-inviter-2026-11-16.v1')
    and not exists (select 1 from public.compatibility_invite_consents where invite_id = (select unknown_version from consent_invites)),
  'one inviter row, for the allowlisted version only'
);

-- The recipient's consent waits for the released completion.
select pg_temp.assert_true(
  public.record_compatibility_invite_recipient_consent((select open_one from consent_invites), 'invite-recipient-2026-11-16.v2')->>'outcome' = 'unavailable',
  'no recipient row while the invite is still active'
);

-- The released completion runs unchanged: token and positions destroyed when the reading is made.
select pg_temp.assert_true(
  public.complete_compatibility_invite(repeat('1', 64))->>'outcome' = 'completed',
  'the released completion completes the invite'
);
select pg_temp.assert_true(
  (select status = 'completed' and token_hash is null and positions is null and authority_destroyed_at is not null
   from public.compatibility_invites where id = (select open_one from consent_invites)),
  'completion destroys the token and positions'
);

select pg_temp.assert_true(
  public.record_compatibility_invite_recipient_consent((select open_one from consent_invites), 'invite-recipient-2026-11-09.v1')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_recipient_consent((select open_one from consent_invites), 'invite-recipient-2026-11-16.v1')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_recipient_consent((select open_one from consent_invites), 'invite-inviter-2026-11-16.v1')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_recipient_consent((select open_one from consent_invites), null)->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_recipient_consent((select open_one from consent_invites), 'invite-recipient-2026-11-16.v2')->>'outcome' = 'recorded',
  'a recipient consent row is written only for an allowlisted version, after completion'
);
select pg_temp.assert_true(
  (select count(*) from public.compatibility_invite_consents where party = 'recipient') = 1
    and exists (select 1 from public.compatibility_invite_consents where invite_id = (select open_one from consent_invites) and party = 'recipient' and policy_version = 'invite-recipient-2026-11-16.v2'),
  'one recipient row'
);

-- Nothing in the consent table can hold an address, a birth detail or a name.
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'compatibility_invite_consents'
      and column_name ~ '(^|_)(email|address|recipient_hash|birth|date|place|lat|lon|name|label|position|ip)(_|$)'
  ),
  'no column for an address, birth detail, name or position'
);
