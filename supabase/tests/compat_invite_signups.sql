\set ON_ERROR_STOP on

-- Run after all migrations in a disposable PostgreSQL database
-- (scripts/test-phase4-compat-invites-sql.sh). Proves the invite signup
-- boundary: browser roles reach nothing, only hashes are staged, a confirmed
-- signup completes a still-active invite exactly as the released completion
-- does, closed invites stay closed, and consent is recorded for both sides.

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

select pg_temp.assert_true(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.compatibility_invite_signups'::regclass)
    and (select relrowsecurity from pg_catalog.pg_class where oid = 'public.compatibility_invite_consents'::regclass)
    and not exists (select 1 from pg_catalog.pg_policy where polrelid in ('public.compatibility_invite_signups'::regclass, 'public.compatibility_invite_consents'::regclass)),
  'signup tables have RLS and no browser policies'
);

select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.compatibility_invite_signups', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'public.compatibility_invite_signups', 'select,insert,update,delete')
    and not has_table_privilege('service_role', 'public.compatibility_invite_signups', 'select,insert,update,delete')
    and not has_table_privilege('anon', 'public.compatibility_invite_consents', 'select,insert,update,delete')
    and not has_table_privilege('authenticated', 'public.compatibility_invite_consents', 'select,insert,update,delete')
    and not has_table_privilege('service_role', 'public.compatibility_invite_consents', 'select,insert,update,delete'),
  'signup persistence is RPC-only, including for service_role'
);

select pg_temp.assert_true(
  not has_function_privilege('anon', 'public.stage_compatibility_invite_signup(text,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.stage_compatibility_invite_signup(text,text)', 'execute')
    and not has_function_privilege('anon', 'public.confirm_compatibility_invite_signups(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.confirm_compatibility_invite_signups(text)', 'execute')
    and not has_function_privilege('anon', 'public.record_compatibility_invite_inviter_consent(uuid,uuid,text)', 'execute')
    and has_function_privilege('service_role', 'public.stage_compatibility_invite_signup(text,text)', 'execute')
    and has_function_privilege('service_role', 'public.confirm_compatibility_invite_signups(text)', 'execute')
    and has_function_privilege('service_role', 'public.record_compatibility_invite_inviter_consent(uuid,uuid,text)', 'execute'),
  'only the service role calls the signup functions'
);

insert into auth.users (id) values
  ('52000000-0000-4000-8000-000000000001'),
  ('52000000-0000-4000-8000-000000000002')
on conflict do nothing;

create temporary table signup_invites as
select
  (public.create_compatibility_invite('52000000-0000-4000-8000-000000000001', 'Frida', 'aries', pg_temp.wire(), true, true, repeat('1', 64))->>'invite_id')::uuid as open_one,
  (public.create_compatibility_invite('52000000-0000-4000-8000-000000000001', 'Frida', 'aries', pg_temp.wire(), true, false, repeat('2', 64))->>'invite_id')::uuid as revoked_one,
  (public.create_compatibility_invite('52000000-0000-4000-8000-000000000002', 'Ana', 'aries', pg_temp.wire(), true, false, repeat('3', 64))->>'invite_id')::uuid as other_owner;

select pg_temp.assert_true(
  (select open_one is not null and revoked_one is not null and other_owner is not null from signup_invites),
  'fixture invites were created'
);

-- The inviter's consent is recorded only by the invite's owner.
select pg_temp.assert_true(
  public.record_compatibility_invite_inviter_consent((select open_one from signup_invites), '52000000-0000-4000-8000-000000000001', 'invite-inviter-2026-11-09.v1')->>'outcome' = 'recorded'
    and public.record_compatibility_invite_inviter_consent((select other_owner from signup_invites), '52000000-0000-4000-8000-000000000001', 'invite-inviter-2026-11-09.v1')->>'outcome' = 'unavailable'
    and public.record_compatibility_invite_inviter_consent((select open_one from signup_invites), '52000000-0000-4000-8000-000000000001', 'Not A Version!')->>'outcome' = 'unavailable',
  'inviter consent is owner-only and versioned'
);

-- Staging needs a valid token hash of an active invite and a 64-hex recipient hash.
select pg_temp.assert_true(
  public.stage_compatibility_invite_signup(repeat('1', 64), repeat('e', 64))->>'outcome' = 'staged'
    and public.stage_compatibility_invite_signup(repeat('1', 64), repeat('e', 64))->>'outcome' = 'staged'
    and public.stage_compatibility_invite_signup(repeat('9', 64), repeat('e', 64))->>'outcome' = 'unavailable'
    and public.stage_compatibility_invite_signup(repeat('1', 64), 'person@example.com')->>'outcome' = 'unavailable',
  'staging accepts only hashes for an active invite, and is idempotent'
);

select pg_temp.assert_true(
  (select count(*) from public.compatibility_invite_signups) = 1
    and (select count(*) from public.compatibility_invite_consents where party = 'recipient' and policy_version = 'invite-recipient-2026-11-09.v1') = 1
    and (select count(*) from public.compatibility_invite_consents where party = 'inviter') = 1,
  'one staged row and one consent per side'
);

-- A revoked invite cannot be staged.
select public.revoke_compatibility_invite('52000000-0000-4000-8000-000000000001', (select revoked_one from signup_invites));
select pg_temp.assert_true(
  public.stage_compatibility_invite_signup(repeat('2', 64), repeat('e', 64))->>'outcome' = 'unavailable',
  'a revoked invite takes no signup'
);

-- Before confirmation the invite stays active with its token and positions.
select pg_temp.assert_true(
  (select status = 'active' and token_hash = repeat('1', 64) and positions is not null from public.compatibility_invites where id = (select open_one from signup_invites)),
  'staging does not complete the invite'
);

-- Another address confirming completes nothing.
select pg_temp.assert_true(
  jsonb_array_length(public.confirm_compatibility_invite_signups(repeat('f', 64))->'completed') = 0
    and jsonb_array_length(public.confirm_compatibility_invite_signups('not-a-hash')->'completed') = 0,
  'only the staged recipient completes the invite'
);

-- The staged recipient confirming completes it as the released completion does.
create temporary table confirmed as select public.confirm_compatibility_invite_signups(repeat('e', 64)) as result;
select pg_temp.assert_true(
  (select jsonb_array_length(result->'completed') = 1
     and result->'completed'->0->>'invite_id' = (select open_one::text from signup_invites)
     and (result->'completed'->0->>'notify_on_complete')::boolean
     and result->'completed'->0->>'label' = 'Frida'
   from confirmed),
  'the confirmed recipient completes the staged invite, with the inviter notification data'
);
select pg_temp.assert_true(
  (select status = 'completed' and token_hash is null and positions is null and completed_at is not null
     and authority_destroyed_at is not null and completion_replay_hash is not null and delete_after is not null
   from public.compatibility_invites where id = (select open_one from signup_invites))
    and exists (select 1 from public.compatibility_invite_events where invite_id = (select open_one from signup_invites) and event = 'completed'),
  'completion destroys the token and positions and records the event'
);

-- The released completion route then sees the same completion as a duplicate, not a second one.
select pg_temp.assert_true(
  public.complete_compatibility_invite(repeat('1', 64))->>'outcome' = 'duplicate',
  'the released completion recognises a signup completion'
);

-- Confirming again completes nothing more.
select pg_temp.assert_true(
  jsonb_array_length(public.confirm_compatibility_invite_signups(repeat('e', 64))->'completed') = 0,
  'confirmation is one-shot'
);

-- Nothing in the signup tables can hold an address, a birth detail or a name.
select pg_temp.assert_true(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('compatibility_invite_signups', 'compatibility_invite_consents')
      and column_name ~ '(^|_)(email|address|birth|date|place|lat|lon|name|label|position|ip)(_|$)'
  ),
  'no column for an address, birth detail, name or position'
);
