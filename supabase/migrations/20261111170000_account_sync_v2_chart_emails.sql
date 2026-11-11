-- Account sync v2 launch: the chart_emails consent purpose, the service-only
-- chart sources for the email jobs and invitations, and the end of every
-- reader of the v1 chart table (public.charts).
--
-- Additive. No user data is deleted. It:
--   1. widens the consent purpose checks with chart_emails ("Use my chart for
--      my emails"), off by default, with its own policy version;
--   2. replaces account_v2_record_consent and account_v2_current_policy_version
--      so chart_emails can be granted and withdrawn like every other purpose;
--   3. replaces account_v2_bootstrap so it no longer reads public.charts and
--      reports the chart_emails consent state;
--   4. adds account_v2_chart_email_sources (service only): the encrypted self
--      chart of each listed account that is active and currently holds BOTH
--      chart_sync and chart_emails. Withdrawing either consent, removing the
--      chart, or starting account deletion drops the account at once;
--   5. adds account_v2_owner_self_chart (service only): the account's own
--      encrypted self chart while chart_sync is granted, for an invitation the
--      owner creates during their own signed-in request;
--   6. drops daily_chart_preferences_chart_owner_fkey, the last dependency on
--      public.charts, and clears confirmed chart_id values that point at no v2
--      chart. That FK was "on delete set null (chart_id)", so this is the same
--      state the retirement of the v1 rows would have produced; the
--      confirmation, timezone and recipient stay. Pending requests are left
--      as they are (they can no longer be confirmed for a v1 chart);
--   7. replaces weekly_digest_candidates_v1 and weekly_digest_content_v1 so the
--      weekly digest no longer requires or reads a v1 chart. Content carries
--      only the destination and, for an opted-in account, the id and revision
--      of the encrypted self chart. The sender decrypts that chart itself.
--
-- Replay-safe: every constraint is dropped before it is added, every function
-- is created or replaced, and the update is idempotent.
--
-- Rollback: re-apply the functions from 20260811153303 and 20260827090000.
-- The chart_emails rows can stay; with the old functions nothing reads them.

-- 1. Purpose checks.
alter table private.account_consents
  drop constraint if exists account_consents_purpose_valid;
alter table private.account_consents
  add constraint account_consents_purpose_valid
    check (purpose in (
      'chart_sync',
      'chart_emails',
      'weekly_digest',
      'daily_chart_email',
      'compatibility_invites',
      'ai_memory',
      'public_presentation'
    ));

alter table private.account_consent_events
  drop constraint if exists account_consent_events_purpose_valid;
alter table private.account_consent_events
  add constraint account_consent_events_purpose_valid
    check (purpose in (
      'chart_sync',
      'chart_emails',
      'weekly_digest',
      'daily_chart_email',
      'compatibility_invites',
      'ai_memory',
      'public_presentation'
    ));

-- 2. Policy versions and consent recording.
create or replace function private.account_v2_current_policy_version(
  candidate_purpose text
)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog
as $$
  select case candidate_purpose
    when 'chart_sync' then 'chart-sync-2026-08-12.v1'
    when 'chart_emails' then 'chart-emails-2026-11-11.v1'
    when 'weekly_digest' then 'weekly-digest-2026-08-12.v1'
    when 'daily_chart_email' then 'daily-chart-email-2026-08-12.v1'
    when 'compatibility_invites' then 'compatibility-invites-2026-08-12.v1'
    when 'ai_memory' then 'ai-memory-2026-08-12.v1'
    when 'public_presentation' then 'public-presentation-2026-08-12.v1'
    else null
  end;
$$;

revoke all on function private.account_v2_current_policy_version(text)
  from public, anon, authenticated;
grant execute on function private.account_v2_current_policy_version(text)
  to service_role;

-- Same function as 20260811153303 with chart_emails added to the purposes.
create or replace function public.account_v2_record_consent(
  candidate_user_id uuid,
  candidate_purpose text,
  candidate_decision text,
  candidate_policy_version text,
  candidate_source text,
  candidate_mutation_id uuid,
  candidate_request_fingerprints jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  current_state private.account_states%rowtype;
  current_consent private.account_consents%rowtype;
  replay_mutation private.account_sync_mutations%rowtype;
  event_number bigint;
  effective_policy_version text;
  operation_time timestamptz := clock_timestamp();
  current_chart record;
  deletion_revision bigint;
  result_value jsonb;
begin
  if candidate_user_id is null
    or candidate_mutation_id is null
    or candidate_purpose not in (
      'chart_sync',
      'chart_emails',
      'weekly_digest',
      'daily_chart_email',
      'compatibility_invites',
      'ai_memory',
      'public_presentation'
    )
    or candidate_decision not in ('grant', 'withdraw')
    or candidate_source not in ('web', 'ios', 'support', 'system')
    or not private.account_v2_valid_request_fingerprints(
      candidate_request_fingerprints
    )
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select * into current_state
  from private.account_states
  where user_id = candidate_user_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_bootstrapped');
  end if;

  select * into replay_mutation
  from private.account_sync_mutations
  where user_id = candidate_user_id
    and mutation_id = candidate_mutation_id;

  if found then
    if replay_mutation.operation <> 'consent'
      or not exists (
        select 1
        from jsonb_array_elements_text(candidate_request_fingerprints) as supplied(verifier)
        where supplied.verifier = replay_mutation.request_fingerprint_verifier
      )
    then
      return jsonb_build_object('outcome', 'mutation_conflict');
    end if;
    return replay_mutation.result;
  end if;

  if current_state.status = 'deleting' then
    return jsonb_build_object('outcome', 'deleting');
  end if;

  effective_policy_version := private.account_v2_current_policy_version(
    candidate_purpose
  );

  if effective_policy_version is null
    or (
      candidate_decision = 'grant'
      and candidate_policy_version is distinct from effective_policy_version
    )
  then
    return jsonb_build_object('outcome', 'policy_version_required');
  end if;

  if candidate_decision = 'withdraw' then
    select policy_version into effective_policy_version
    from private.account_consents
    where user_id = candidate_user_id
      and purpose = candidate_purpose;

    effective_policy_version := coalesce(
      effective_policy_version,
      private.account_v2_current_policy_version(candidate_purpose)
    );
  end if;

  -- A fresh mutation UUID must not turn an already-effective consent choice
  -- into unbounded immutable events/changes. Return the existing audit event;
  -- the no-op UUID is deliberately not persisted in the replay ledger.
  select * into current_consent
  from private.account_consents
  where user_id = candidate_user_id
    and purpose = candidate_purpose;

  if found
    and (
      (candidate_decision = 'grant' and current_consent.state = 'granted')
      or
      (candidate_decision = 'withdraw' and current_consent.state = 'withdrawn')
    )
    and (
      candidate_decision = 'withdraw'
      or current_consent.policy_version = effective_policy_version
    )
  then
    select event_id into event_number
    from private.account_consent_events
    where user_id = candidate_user_id
      and purpose = candidate_purpose
      and decision = candidate_decision
    order by event_id desc
    limit 1;

    if event_number is not null then
      return jsonb_build_object(
        'outcome', case
          when candidate_decision = 'grant' then 'granted'
          else 'withdrawn'
        end,
        'purpose', candidate_purpose,
        'event_id', event_number
      );
    end if;
  end if;

  insert into private.account_consent_events (
    user_id,
    purpose,
    decision,
    policy_version,
    source,
    idempotency_key,
    occurred_at
  ) values (
    candidate_user_id,
    candidate_purpose,
    candidate_decision,
    effective_policy_version,
    candidate_source,
    candidate_mutation_id,
    operation_time
  )
  returning event_id into event_number;

  insert into private.account_consents (
    user_id,
    purpose,
    state,
    policy_version,
    granted_at,
    withdrawn_at,
    updated_at
  ) values (
    candidate_user_id,
    candidate_purpose,
    case when candidate_decision = 'grant' then 'granted' else 'withdrawn' end,
    effective_policy_version,
    case when candidate_decision = 'grant' then operation_time else null end,
    case when candidate_decision = 'withdraw' then operation_time else null end,
    operation_time
  )
  on conflict (user_id, purpose) do update
  set state = excluded.state,
      policy_version = excluded.policy_version,
      granted_at = excluded.granted_at,
      withdrawn_at = excluded.withdrawn_at,
      updated_at = excluded.updated_at;

  if candidate_purpose = 'chart_sync' and candidate_decision = 'withdraw' then
    for current_chart in
      select chart_id, revision
      from private.account_chart_records
      where user_id = candidate_user_id
      order by chart_id
      for update
    loop
      deletion_revision := current_chart.revision + 1;

      insert into private.account_sync_tombstones (
        user_id,
        chart_id,
        revision,
        mutation_id,
        deleted_at
      ) values (
        candidate_user_id,
        current_chart.chart_id,
        deletion_revision,
        candidate_mutation_id,
        operation_time
      )
      on conflict (user_id, chart_id) do update
      set revision = greatest(
            private.account_sync_tombstones.revision,
            excluded.revision
          ),
          mutation_id = excluded.mutation_id,
          deleted_at = excluded.deleted_at;

      delete from private.account_chart_records
      where user_id = candidate_user_id
        and chart_id = current_chart.chart_id;

      insert into private.account_sync_changes (
        user_id,
        entity_type,
        entity_id,
        operation,
        revision,
        mutation_id,
        created_at
      ) values (
        candidate_user_id,
        'chart',
        current_chart.chart_id,
        'delete',
        deletion_revision,
        candidate_mutation_id,
        operation_time
      );
    end loop;
  end if;

  insert into private.account_sync_changes (
    user_id,
    entity_type,
    entity_id,
    operation,
    revision,
    mutation_id,
    created_at
  ) values (
    candidate_user_id,
    'consent',
    null,
    candidate_decision,
    event_number,
    candidate_mutation_id,
    operation_time
  );

  result_value := jsonb_build_object(
    'outcome', case when candidate_decision = 'grant' then 'granted' else 'withdrawn' end,
    'purpose', candidate_purpose,
    'event_id', event_number
  );

  insert into private.account_sync_mutations (
    user_id,
    mutation_id,
    operation,
    request_fingerprint_verifier,
    result
  ) values (
    candidate_user_id,
    candidate_mutation_id,
    'consent',
    candidate_request_fingerprints->>0,
    result_value
  );

  return result_value;
exception
  when foreign_key_violation then
    return jsonb_build_object('outcome', 'user_not_found');
end;
$$;

revoke all on function public.account_v2_record_consent(uuid, text, text, text, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.account_v2_record_consent(uuid, text, text, text, text, uuid, jsonb)
  to service_role;

-- 3. Bootstrap without the v1 chart check, reporting chart_emails.
create or replace function public.account_v2_bootstrap(
  candidate_user_id uuid,
  candidate_device_id uuid,
  candidate_platform text,
  candidate_daily_sun_recipient_hash text,
  candidate_daily_sun_encrypted_locator jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  current_state private.account_states%rowtype;
  current_device private.account_sync_devices%rowtype;
  chart_sync_state text;
  chart_emails_state text;
  existing_alias_count integer;
  existing_device_count integer;
  current_authority_attempt_id uuid;
begin
  if candidate_user_id is null
    or candidate_device_id is null
    or candidate_platform not in ('web', 'ios', 'unknown')
    or candidate_daily_sun_recipient_hash is null
    or octet_length(candidate_daily_sun_recipient_hash) <> 64
    or candidate_daily_sun_recipient_hash !~ '^[0-9a-f]{64}$'
    or not private.account_v2_valid_encrypted_json(
      candidate_daily_sun_encrypted_locator,
      528
    )
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(candidate_user_id::text, 7312030)
  );
  perform pg_advisory_xact_lock(
    hashtextextended(candidate_user_id::text, 7312025)
  );

  -- v1 chart rows no longer block bootstrap. v1 writes are paused by
  -- restrictive RLS (20261111140000), so no v1 write can race this cutover,
  -- and the remaining v1 rows are retired separately by the operator. This
  -- function no longer reads public.charts at all.

  insert into private.account_states (user_id, daily_sun_recipient_hash)
  values (candidate_user_id, candidate_daily_sun_recipient_hash)
  on conflict (user_id) do nothing;

  select * into current_state
  from private.account_states
  where user_id = candidate_user_id
  for update;

  if current_state.status = 'deleting' then
    return jsonb_build_object('outcome', 'deleting');
  end if;

  select count(*)::integer into existing_device_count
  from private.account_sync_devices
  where user_id = candidate_user_id;

  if existing_device_count >= 100
    and not exists (
      select 1
      from private.account_sync_devices
      where user_id = candidate_user_id
        and device_id = candidate_device_id
    )
  then
    return jsonb_build_object('outcome', 'device_limit_reached');
  end if;

  select count(*)::integer into existing_alias_count
  from private.account_daily_sun_recipient_aliases
  where user_id = candidate_user_id;

  if existing_alias_count >= 16
    and not exists (
      select 1
      from private.account_daily_sun_recipient_aliases
      where user_id = candidate_user_id
        and recipient_hash = candidate_daily_sun_recipient_hash
    )
  then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  select confirmed_by_attempt_id
  into current_authority_attempt_id
  from public.daily_sun_preferences
  where recipient_hash = candidate_daily_sun_recipient_hash;

  insert into private.account_daily_sun_recipient_aliases (
    user_id,
    recipient_hash,
    locator_ciphertext,
    locator_nonce,
    locator_encryption_format,
    locator_key_scope,
    locator_key_version,
    locator_wrapped_key,
    authority_attempt_id
  ) values (
    candidate_user_id,
    candidate_daily_sun_recipient_hash,
    decode(candidate_daily_sun_encrypted_locator->>'ciphertext', 'base64'),
    decode(candidate_daily_sun_encrypted_locator->>'nonce', 'base64'),
    candidate_daily_sun_encrypted_locator->>'format',
    candidate_daily_sun_encrypted_locator->>'key_scope',
    (candidate_daily_sun_encrypted_locator->>'key_version')::integer,
    decode(candidate_daily_sun_encrypted_locator->>'wrapped_key', 'base64'),
    current_authority_attempt_id
  )
  on conflict (user_id, recipient_hash) do update
  set locator_ciphertext = excluded.locator_ciphertext,
      locator_nonce = excluded.locator_nonce,
      locator_encryption_format = excluded.locator_encryption_format,
      locator_key_scope = excluded.locator_key_scope,
      locator_key_version = excluded.locator_key_version,
      locator_wrapped_key = excluded.locator_wrapped_key,
      authority_attempt_id = excluded.authority_attempt_id,
      updated_at = clock_timestamp();

  update private.account_states
  set daily_sun_recipient_hash = candidate_daily_sun_recipient_hash,
      updated_at = case
        when daily_sun_recipient_hash is distinct from candidate_daily_sun_recipient_hash
          then clock_timestamp()
        else updated_at
      end
  where user_id = candidate_user_id;

  insert into private.account_sync_devices (
    user_id,
    device_id,
    platform
  ) values (
    candidate_user_id,
    candidate_device_id,
    candidate_platform
  )
  on conflict (user_id, device_id) do update
  set platform = excluded.platform,
      last_seen_at = clock_timestamp()
  where private.account_sync_devices.revoked_at is null;

  select * into current_device
  from private.account_sync_devices
  where user_id = candidate_user_id
    and device_id = candidate_device_id;

  if current_device.revoked_at is not null then
    return jsonb_build_object('outcome', 'device_revoked');
  end if;

  select state into chart_sync_state
  from private.account_consents
  where user_id = candidate_user_id
    and purpose = 'chart_sync';

  select state into chart_emails_state
  from private.account_consents
  where user_id = candidate_user_id
    and purpose = 'chart_emails';

  return jsonb_build_object(
    'outcome', 'ready',
    'account_state', 'active',
    'chart_sync_consent', coalesce(chart_sync_state, 'pending'),
    'chart_emails_consent', coalesce(chart_emails_state, 'pending'),
    'cursor', current_device.last_cursor
  );
exception
  when foreign_key_violation then
    return jsonb_build_object('outcome', 'user_not_found');
end;
$$;

revoke all on function public.account_v2_bootstrap(uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.account_v2_bootstrap(uuid, uuid, text, text, jsonb)
  to service_role;

-- 4. Chart sources for the email jobs. Only accounts that are active and
-- currently hold both chart_sync and chart_emails are returned, with the
-- envelope of their one active self chart at its current revision. Nothing
-- here is plaintext; the job decrypts with the service keyring it holds.
create or replace function public.account_v2_chart_email_sources(
  candidate_user_ids uuid[]
)
returns table (
  user_id uuid,
  chart_id uuid,
  revision bigint,
  ciphertext text,
  nonce text,
  format text,
  key_scope text,
  key_version integer,
  wrapped_key text
)
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select
    records.user_id,
    records.chart_id,
    records.revision,
    encode(secrets.ciphertext, 'base64'),
    encode(secrets.nonce, 'base64'),
    secrets.encryption_format,
    secrets.key_scope,
    secrets.key_version,
    encode(secrets.wrapped_key, 'base64')
  from private.account_chart_records as records
  join private.account_chart_secret_envelopes as secrets
    on secrets.user_id = records.user_id
   and secrets.chart_id = records.chart_id
   and secrets.revision = records.revision
  join private.account_states as states
    on states.user_id = records.user_id
   and states.status = 'active'
  where candidate_user_ids is not null
    and cardinality(candidate_user_ids) between 1 and 500
    and records.user_id = any(candidate_user_ids)
    and records.subject_kind = 'self'
    and records.subject_attestation = 'self_declared_v1'
    and exists (
      select 1
      from private.account_consents as sync_consent
      where sync_consent.user_id = records.user_id
        and sync_consent.purpose = 'chart_sync'
        and sync_consent.state = 'granted'
    )
    and exists (
      select 1
      from private.account_consents as email_consent
      where email_consent.user_id = records.user_id
        and email_consent.purpose = 'chart_emails'
        and email_consent.state = 'granted'
    )
  order by records.user_id, records.chart_id;
$$;

revoke all on function public.account_v2_chart_email_sources(uuid[])
  from public, anon, authenticated;
grant execute on function public.account_v2_chart_email_sources(uuid[])
  to service_role;

-- 5. The owner's own self chart for a compatibility invitation. Called only
-- by the server during the owner's authenticated request; it returns the
-- envelope, never plaintext, and only while chart_sync is granted.
create or replace function public.account_v2_owner_self_chart(
  candidate_user_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  chart_value jsonb;
begin
  if candidate_user_id is null then
    return jsonb_build_object('outcome', 'invalid');
  end if;

  if not exists (
    select 1
    from private.account_states
    where user_id = candidate_user_id
      and status = 'active'
  ) or not exists (
    select 1
    from private.account_consents
    where user_id = candidate_user_id
      and purpose = 'chart_sync'
      and state = 'granted'
  ) then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select jsonb_build_object(
    'outcome', 'ready',
    'chart_id', records.chart_id,
    'revision', records.revision,
    'encrypted_source', jsonb_build_object(
      'ciphertext', encode(secrets.ciphertext, 'base64'),
      'nonce', encode(secrets.nonce, 'base64'),
      'format', secrets.encryption_format,
      'key_scope', secrets.key_scope,
      'key_version', secrets.key_version,
      'wrapped_key', encode(secrets.wrapped_key, 'base64')
    )
  ) into chart_value
  from private.account_chart_records as records
  join private.account_chart_secret_envelopes as secrets
    on secrets.user_id = records.user_id
   and secrets.chart_id = records.chart_id
   and secrets.revision = records.revision
  where records.user_id = candidate_user_id
    and records.subject_kind = 'self'
    and records.subject_attestation = 'self_declared_v1'
  order by records.updated_at desc, records.chart_id
  limit 1;

  return coalesce(chart_value, jsonb_build_object('outcome', 'not_found'));
end;
$$;

revoke all on function public.account_v2_owner_self_chart(uuid)
  from public, anon, authenticated;
grant execute on function public.account_v2_owner_self_chart(uuid)
  to service_role;

-- 6. The daily chart preference no longer references public.charts. Its
-- chart_id now names the account's v2 self chart (unconstrained: a removed
-- chart simply stops qualifying in account_v2_chart_email_sources).
alter table public.daily_chart_preferences
  drop constraint if exists daily_chart_preferences_chart_owner_fkey;

update public.daily_chart_preferences as preferences
set chart_id = null
where preferences.confirmed_at is not null
  and preferences.chart_id is not null
  and not exists (
    select 1
    from private.account_chart_records as records
    where records.user_id = preferences.user_id
      and records.chart_id = preferences.chart_id
  )
  -- The terminal gate refuses writes for an account in deletion; its
  -- preference is erased by that deletion anyway.
  and not exists (
    select 1
    from private.account_states as states
    where states.user_id = preferences.user_id
      and states.status = 'deleting'
  );

-- 7. Weekly digest. Eligibility is the opt-in and a deliverable address; a
-- chart is no longer required. The content snapshot names the destination
-- and, only for an opted-in account, the encrypted self chart's id and
-- revision, so withdrawing chart_emails between selection and dispatch moves
-- the digest and the authorization recheck refuses the stale envelope.
create or replace function public.weekly_digest_candidates_v1(
  candidate_week_start date,
  candidate_limit integer
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_week date := pg_catalog.date_trunc(
    'week', pg_catalog.statement_timestamp() at time zone 'UTC'
  )::date;
begin
  if candidate_week_start is null
    or candidate_week_start <> current_week
    or candidate_limit is null
    or candidate_limit not between 1 and 80
  then
    return;
  end if;

  return query
  select profiles.user_id
  from public.profiles as profiles
  join auth.users as users on users.id = profiles.user_id
  where profiles.digest_opt_in
    and pg_catalog.octet_length(pg_catalog.btrim(users.email)) between 3 and 320
    and pg_catalog.btrim(users.email) ~ '^[^[:space:]@]+@[^[:space:]@]+$'
    and not exists (
      select 1
      from public.weekly_digest_deliveries as deliveries
      where deliveries.week_start = candidate_week_start
        and deliveries.user_id = profiles.user_id
    )
  order by pg_catalog.encode(
    pg_catalog.sha256(
      pg_catalog.convert_to('weekly-digest-order-v1', 'UTF8')
      || pg_catalog.decode('00', 'hex')
      || pg_catalog.convert_to(candidate_week_start::text, 'UTF8')
      || pg_catalog.decode('00', 'hex')
      || pg_catalog.convert_to(pg_catalog.lower(profiles.user_id::text), 'UTF8')
    ),
    'hex'
  )
  limit candidate_limit;
end;
$$;

create or replace function public.weekly_digest_content_v1(
  candidate_user_id uuid,
  candidate_max_charts integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot jsonb;
  chart_reference jsonb;
  destination text;
begin
  if candidate_user_id is null
    or candidate_max_charts is null
    or candidate_max_charts not between 1 and 5
  then
    return null;
  end if;

  select pg_catalog.btrim(users.email)
  into destination
  from auth.users as users
  join public.profiles as profiles on profiles.user_id = users.id
  where users.id = candidate_user_id
    and profiles.digest_opt_in
    and pg_catalog.octet_length(pg_catalog.btrim(users.email)) between 3 and 320
    and pg_catalog.btrim(users.email) ~ '^[^[:space:]@]+@[^[:space:]@]+$';

  if not found then
    return null;
  end if;

  select pg_catalog.jsonb_build_object(
    'chart_id', sources.chart_id,
    'revision', sources.revision
  )
  into chart_reference
  from public.account_v2_chart_email_sources(
    array[candidate_user_id]::uuid[]
  ) as sources
  order by sources.chart_id
  limit 1;

  snapshot := pg_catalog.jsonb_build_object(
    'email', destination,
    'chart', coalesce(chart_reference, 'null'::jsonb)
  );

  return pg_catalog.jsonb_build_object(
    'snapshot', snapshot,
    'digest', pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(snapshot::text, 'UTF8')),
      'hex'
    )
  );
end;
$$;

revoke all on function public.weekly_digest_candidates_v1(date, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.weekly_digest_content_v1(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.weekly_digest_candidates_v1(date, integer)
  to service_role;
grant execute on function public.weekly_digest_content_v1(uuid, integer)
  to service_role;
