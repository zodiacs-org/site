-- Compatibility invites: a completed invite is a confirmed opt-in signup.
--
-- Offered only while INVITE_SIGNUP_ENABLED=1 joins the released invite
-- contract and the daily email's double opt-in. After seeing the result, the
-- person who received an invite may ask for their own daily horoscope by
-- email. That request stages one row here: the invite, a keyed hash of their
-- address (never the address) and the invite's completion replay hash. When
-- they click the confirmation link, every staged invite for that hash that is
-- still active completes exactly as complete_compatibility_invite completes
-- one, and its inviter is notified if they asked to be.
--
-- Nothing here holds a birth date, time, place, position, name or address.
-- Server-owned: browser roles receive no policies or privileges, and only the
-- service role may call the two functions.
-- UTC filename; not applied to any database until the owner approves it.

create table if not exists public.compatibility_invite_signups (
  invite_id uuid not null references public.compatibility_invites(id) on delete cascade,
  recipient_hash text not null check (recipient_hash ~ '^[0-9a-f]{64}$'),
  completion_replay_hash text not null check (completion_replay_hash ~ '^[0-9a-f]{64}$'),
  staged_at timestamptz not null default clock_timestamp(),
  confirmed_at timestamptz,
  primary key (invite_id, recipient_hash)
);

-- Consent on both sides, recorded as the policy text each person agreed to:
-- the inviter when they create the invite (sharing their own chart's
-- positions), the recipient when they ask for the signup (their own details,
-- 18 or older, and the daily email). No identity, birth detail or address.
create table if not exists public.compatibility_invite_consents (
  invite_id uuid not null references public.compatibility_invites(id) on delete cascade,
  party text not null check (party in ('inviter', 'recipient')),
  policy_version text not null check (policy_version ~ '^[a-z0-9.-]{1,64}$'),
  consented_at timestamptz not null default clock_timestamp(),
  primary key (invite_id, party)
);
alter table public.compatibility_invite_consents enable row level security;
revoke all on table public.compatibility_invite_consents
  from public, anon, authenticated, service_role;

create index if not exists compatibility_invite_signups_recipient
  on public.compatibility_invite_signups (recipient_hash)
  where confirmed_at is null;

alter table public.compatibility_invite_signups enable row level security;
revoke all on table public.compatibility_invite_signups
  from public, anon, authenticated, service_role;

-- Stage a signup against an invite the caller still holds the capability for.
-- Returns {outcome: 'staged' | 'unavailable'}; never says why an invite is unavailable.
create or replace function public.stage_compatibility_invite_signup(
  candidate_token_hash text,
  candidate_recipient_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  operation_time timestamptz := clock_timestamp();
  current_invite public.compatibility_invites%rowtype;
begin
  if not public.is_valid_compatibility_invite_token_hash(candidate_token_hash)
    or candidate_recipient_hash is null
    or candidate_recipient_hash !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('outcome', 'unavailable');
  end if;

  select *
  into current_invite
  from public.compatibility_invites
  where token_hash = candidate_token_hash
  for update;

  if not found
    or current_invite.status <> 'active'
    or current_invite.expires_at <= operation_time
  then
    return jsonb_build_object('outcome', 'unavailable');
  end if;

  insert into public.compatibility_invite_signups (
    invite_id,
    recipient_hash,
    completion_replay_hash
  ) values (
    current_invite.id,
    candidate_recipient_hash,
    encode(
      pg_catalog.sha256(
        pg_catalog.convert_to(
          'zodiacs.compatibility.complete.v1:' || candidate_token_hash,
          'UTF8'
        )
      ),
      'hex'
    )
  ) on conflict (invite_id, recipient_hash) do nothing;

  insert into public.compatibility_invite_consents (invite_id, party, policy_version)
  values (current_invite.id, 'recipient', 'invite-recipient-2026-11-09.v1')
  on conflict (invite_id, party) do nothing;

  return jsonb_build_object('outcome', 'staged');
end;
$$;

-- Complete every still-active invite staged for a confirmed recipient, as
-- complete_compatibility_invite does, and return what the inviter's optional
-- notification needs. Invites that closed meanwhile are left as they are.
create or replace function public.confirm_compatibility_invite_signups(
  candidate_recipient_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  operation_time timestamptz := clock_timestamp();
  staged record;
  completed jsonb := '[]'::jsonb;
begin
  if candidate_recipient_hash is null
    or candidate_recipient_hash !~ '^[0-9a-f]{64}$'
  then
    return jsonb_build_object('completed', completed);
  end if;

  for staged in
    select s.invite_id, s.completion_replay_hash
    from public.compatibility_invite_signups s
    where s.recipient_hash = candidate_recipient_hash
      and s.confirmed_at is null
    order by s.staged_at
    limit 24
    for update of s
  loop
    update public.compatibility_invite_signups
    set confirmed_at = operation_time
    where invite_id = staged.invite_id
      and recipient_hash = candidate_recipient_hash;

    update public.compatibility_invites
    set status = 'completed',
        token_hash = null,
        completion_replay_hash = staged.completion_replay_hash,
        positions = null,
        completed_at = operation_time,
        authority_destroyed_at = operation_time,
        delete_after = operation_time + interval '30 days'
    where id = staged.invite_id
      and status = 'active'
      and expires_at > operation_time;

    if found then
      insert into public.compatibility_invite_events (
        invite_id,
        event,
        occurred_at
      ) values (
        staged.invite_id,
        'completed',
        operation_time
      ) on conflict (invite_id, event) do nothing;

      completed := completed || (
        select jsonb_build_array(jsonb_build_object(
          'invite_id', i.id,
          'owner_user_id', i.owner_user_id,
          'label', i.label,
          'notify_on_complete', i.notify_on_complete,
          'completed_at', i.completed_at
        ))
        from public.compatibility_invites i
        where i.id = staged.invite_id
      );
    end if;
  end loop;

  return jsonb_build_object('completed', completed);
end;
$$;

-- The inviter's consent, recorded by the creation route right after the
-- invite is made (the released create function takes no consent argument).
create or replace function public.record_compatibility_invite_inviter_consent(
  candidate_invite_id uuid,
  candidate_owner_user_id uuid,
  candidate_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if candidate_policy_version is null or candidate_policy_version !~ '^[a-z0-9.-]{1,64}$' then
    return jsonb_build_object('outcome', 'unavailable');
  end if;
  insert into public.compatibility_invite_consents (invite_id, party, policy_version)
  select i.id, 'inviter', candidate_policy_version
  from public.compatibility_invites i
  where i.id = candidate_invite_id
    and i.owner_user_id = candidate_owner_user_id
  on conflict (invite_id, party) do nothing;
  return jsonb_build_object('outcome', case when found then 'recorded' else 'unavailable' end);
end;
$$;

revoke all on function public.record_compatibility_invite_inviter_consent(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_compatibility_invite_inviter_consent(uuid, uuid, text)
  to service_role;
revoke all on function public.stage_compatibility_invite_signup(text, text)
  from public, anon, authenticated;
revoke all on function public.confirm_compatibility_invite_signups(text)
  from public, anon, authenticated;
grant execute on function public.stage_compatibility_invite_signup(text, text)
  to service_role;
grant execute on function public.confirm_compatibility_invite_signups(text)
  to service_role;
