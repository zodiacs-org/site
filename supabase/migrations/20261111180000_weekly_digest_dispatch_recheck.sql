-- Weekly digest: recheck an authorized delivery immediately before each
-- provider attempt.
--
-- `weekly_digest_authorized_v1` rechecks the opt-in and the content digest
-- (which carries the chart id and revision of an opted-in account) under the
-- profile lock before a delivery enters `dispatching`. The sender's provider
-- queue can then wait for pacing and retry explicit 429 responses, so the
-- account may withdraw chart emails or chart sync, remove its chart, enter
-- deletion or opt out of the digest after authorization. The sender calls
-- this function after every such wait, immediately before each POST attempt,
-- and sends only when it answers `dispatch`.
--
-- Answers:
--   dispatch        opt-in, cancel marker and content digest unchanged.
--   released        a new dispatch (no recovery claim) whose attempts, if
--                   any, were all explicit 429 rejections: it returns to
--                   `reserved` under the same lease and unsubscribe
--                   capability, its sealed envelope dropped, so the sender
--                   can rebuild it from current content or cancel it.
--   cancelled       as released, but an unsubscribe already marked it, so it
--                   is cancelled instead (the reserved state forbids a
--                   cancel marker).
--   reconciliation  a recovery replay: its first dispatch may have been
--                   accepted, so it is quarantined exactly as
--                   `weekly_digest_recover_v1` quarantines a changed
--                   recipient, and never resent.
--   missing         no dispatching row for this lease: send nothing.
--
-- Additive: one new service-only function, no table or data change.
-- Replay-safe: create or replace, and the grants are idempotent.

create or replace function public.weekly_digest_dispatch_recheck_v1(
  candidate_week_start date,
  candidate_user_id uuid,
  candidate_lease_token uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  checked_at timestamptz := pg_catalog.statement_timestamp();
  profile_digest_opt_in boolean;
  delivery public.weekly_digest_deliveries%rowtype;
  current_content jsonb;
begin
  if candidate_week_start is null
    or candidate_user_id is null
    or candidate_lease_token is null
  then
    return 'missing';
  end if;

  -- Same Auth -> profile -> delivery -> capability lock order as every other
  -- sender transition and account deletion.
  perform 1
  from auth.users as users
  where users.id = candidate_user_id
  for update;

  if not found then
    return 'missing';
  end if;

  select profiles.digest_opt_in
  into profile_digest_opt_in
  from public.profiles as profiles
  where profiles.user_id = candidate_user_id
  for update;

  select *
  into delivery
  from public.weekly_digest_deliveries as deliveries
  where deliveries.week_start = candidate_week_start
    and deliveries.user_id = candidate_user_id
    and deliveries.status = 'dispatching'
    and deliveries.lease_token = candidate_lease_token
  for update;

  if not found then
    return 'missing';
  end if;

  if coalesce(profile_digest_opt_in, false)
    and delivery.cancel_requested_at is null
  then
    current_content := public.weekly_digest_content_v1(
      candidate_user_id,
      delivery.max_charts
    );
    if current_content is not null
      and current_content ->> 'digest' = delivery.content_digest
    then
      return 'dispatch';
    end if;
  end if;

  if delivery.recovery_claimed_at is not null then
    update public.weekly_digest_deliveries
    set status = 'reconciliation',
        sealed_envelope = null,
        recovery_claimed_at = null,
        updated_at = checked_at
    where week_start = candidate_week_start
      and user_id = candidate_user_id
      and status = 'dispatching'
      and lease_token = candidate_lease_token;
    return 'reconciliation';
  end if;

  if delivery.cancel_requested_at is not null then
    update public.weekly_digest_deliveries
    set status = 'cancelled',
        slot = null,
        lease_token = null,
        idempotency_key = null,
        envelope_digest = null,
        content_digest = null,
        sealed_envelope = null,
        max_charts = null,
        dispatch_started_at = null,
        updated_at = checked_at
    where week_start = candidate_week_start
      and user_id = candidate_user_id
      and status = 'dispatching'
      and lease_token = candidate_lease_token;

    delete from public.weekly_digest_unsubscribe_tokens as tokens
    where tokens.week_start = candidate_week_start
      and tokens.user_id = candidate_user_id
      and tokens.lease_token = candidate_lease_token
      and tokens.used_at is null;
    return 'cancelled';
  end if;

  update public.weekly_digest_deliveries
  set status = 'reserved',
      idempotency_key = null,
      envelope_digest = null,
      content_digest = null,
      sealed_envelope = null,
      max_charts = null,
      dispatch_started_at = null,
      updated_at = checked_at
  where week_start = candidate_week_start
    and user_id = candidate_user_id
    and status = 'dispatching'
    and lease_token = candidate_lease_token;
  return 'released';
end;
$$;

alter function public.weekly_digest_dispatch_recheck_v1(date, uuid, uuid)
  owner to postgres;

revoke all on function public.weekly_digest_dispatch_recheck_v1(date, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_digest_dispatch_recheck_v1(date, uuid, uuid)
  to service_role;
