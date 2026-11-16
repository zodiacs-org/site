-- Compatibility invites: consent on both sides, recorded by policy version.
--
-- Recorded only while INVITE_SIGNUP_ENABLED=1 joins the released invite
-- contract. An invite completes when its recipient's reading is made, exactly
-- as complete_compatibility_invite completes one; nothing here changes that.
-- The daily email the recipient may ask for afterwards is a separate opt-in
-- through the public subscribe route, with no link to the invite, so no table
-- here ties an address to an invite.
--
-- Each row names the version of the text a person saw: the inviter's when they
-- create the invite, the recipient's when their reading completes it. Only
-- versions in the allowlists below are recorded, so a row never names text
-- nobody saw. A new text needs a new version here and in
-- src/lib/invite/consent.ts.
--
-- Nothing here holds a birth date, time, place, position, name or address.
-- Server-owned: browser roles receive no policies or privileges, and only the
-- service role may call the two functions.
-- UTC filename; not applied to any database until the owner approves it.

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

-- The inviter's consent, recorded by the creation route right after the
-- invite is made (the released create function takes no consent argument),
-- only by the invite's owner and only for a known version.
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
  if candidate_policy_version is null
    or candidate_policy_version not in ('invite-inviter-2026-11-16.v1')
  then
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

-- The recipient's consent, recorded by the completion route for the invite
-- their reading has just completed, only for a known version.
create or replace function public.record_compatibility_invite_recipient_consent(
  candidate_invite_id uuid,
  candidate_policy_version text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if candidate_policy_version is null
    or candidate_policy_version not in ('invite-recipient-2026-11-16.v2')
  then
    return jsonb_build_object('outcome', 'unavailable');
  end if;
  insert into public.compatibility_invite_consents (invite_id, party, policy_version)
  select i.id, 'recipient', candidate_policy_version
  from public.compatibility_invites i
  where i.id = candidate_invite_id
    and i.status = 'completed'
  on conflict (invite_id, party) do nothing;
  return jsonb_build_object('outcome', case when found then 'recorded' else 'unavailable' end);
end;
$$;

revoke all on function public.record_compatibility_invite_inviter_consent(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_compatibility_invite_inviter_consent(uuid, uuid, text)
  to service_role;
revoke all on function public.record_compatibility_invite_recipient_consent(uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_compatibility_invite_recipient_consent(uuid, text)
  to service_role;
