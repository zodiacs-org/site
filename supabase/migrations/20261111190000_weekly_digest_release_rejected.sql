-- Weekly digest: release a chart edition the provider definitively rejected.
--
-- A delivery in `dispatching` that a later run finds is replayed byte for
-- byte by `weekly_digest_recover_v1`, and that replay's first attempt is not
-- rechecked: the original dispatch may already have been accepted under the
-- same idempotency key (a timeout, a network failure, a 5xx, a 408 or 409, a
-- malformed success). That exception is only for such ambiguous outcomes.
--
-- When the provider answered a new chart edition with an explicit rejection
-- instead (a 4xx other than 408 and 409, an exhausted run of 429s included),
-- nothing was accepted under the request. The sender then calls this
-- function before it stops the batch, so the delivery never reaches the
-- recovery replay. It returns to `reserved` under the same lease, with its
-- sealed envelope and dispatch fields cleared, exactly as
-- `weekly_digest_dispatch_recheck_v1` releases a moved delivery. The next run
-- that may create deliveries prunes the stale reservation and builds the
-- digest again from current content, so a chart edition is sent only through
-- the normal path, rechecked before every provider attempt, and an account
-- that withdrew chart emails gets the sky edition or nothing.
--
-- Answers:
--   released   back to `reserved`, as above.
--   cancelled  an unsubscribe already marked it, so it is cancelled instead
--              (the reserved state forbids a cancel marker) and its unused
--              capability removed.
--   missing    no never-recovered dispatching row under this lease. A
--              recovery replay is never released: its first dispatch stays
--              ambiguous whatever the replay was told.
--
-- Additive: one new service-only function, no table or data change.
-- Replay-safe: create or replace, and the grants are idempotent.

create or replace function public.weekly_digest_release_rejected_v1(
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
  released_at timestamptz := pg_catalog.statement_timestamp();
  delivery public.weekly_digest_deliveries%rowtype;
begin
  if candidate_week_start is null
    or candidate_user_id is null
    or candidate_lease_token is null
  then
    return 'missing';
  end if;

  -- Same Auth -> delivery -> capability lock order as every other sender
  -- transition and account deletion.
  perform 1
  from auth.users as users
  where users.id = candidate_user_id
  for update;

  if not found then
    return 'missing';
  end if;

  select *
  into delivery
  from public.weekly_digest_deliveries as deliveries
  where deliveries.week_start = candidate_week_start
    and deliveries.user_id = candidate_user_id
    and deliveries.status = 'dispatching'
    and deliveries.lease_token = candidate_lease_token
    and deliveries.recovery_claimed_at is null
  for update;

  if not found then
    return 'missing';
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
        updated_at = released_at
    where week_start = candidate_week_start
      and user_id = candidate_user_id
      and status = 'dispatching'
      and lease_token = candidate_lease_token
      and recovery_claimed_at is null;

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
      updated_at = released_at
  where week_start = candidate_week_start
    and user_id = candidate_user_id
    and status = 'dispatching'
    and lease_token = candidate_lease_token
    and recovery_claimed_at is null;
  return 'released';
end;
$$;

alter function public.weekly_digest_release_rejected_v1(date, uuid, uuid)
  owner to postgres;

revoke all on function public.weekly_digest_release_rejected_v1(date, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_digest_release_rejected_v1(date, uuid, uuid)
  to service_role;
