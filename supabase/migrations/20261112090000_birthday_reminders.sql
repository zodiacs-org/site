-- Birthday reminders: one email a year, on the birthday, for people who ask
-- for it after scoring their year (src/lib/birthday-reminder/). Kept, with
-- consent: the email address and the birthday's month and day. Never a birth
-- year, time, place or name. Double opt-in: a request is pending until its
-- confirmation link is followed, and a pending request older than 48 hours is
-- deleted. Unsubscribing deletes the row. Only the service role can reach it.
-- Besides those, the row keeps when it was asked for and confirmed, when this
-- year's email went, and the confirmation count and start of its 24-hour
-- window (at most six). Delivery uses a temporary reservation token and time,
-- the date being celebrated, the first dispatch time, its token and a request hash.
-- Additive: a new schema, table and functions; nothing existing changes.
-- UTC filename; not applied to any database until the owner approves it.
create schema if not exists zodiacs_reminders_private;
revoke all on schema zodiacs_reminders_private from public, anon, authenticated;

create table if not exists zodiacs_reminders_private.birthday_reminders (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (char_length(email) between 3 and 254 and email = lower(email)),
  month smallint not null check (month between 1 and 12),
  day smallint not null check (day between 1 and 31),
  confirm_hash text check (confirm_hash is null or confirm_hash ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default pg_catalog.now(),
  confirmed_at timestamptz,
  last_sent_on date,
  claim_token uuid,
  claimed_at timestamptz,
  claim_dispatched boolean not null default false,
  dispatch_on date,
  dispatch_started_at timestamptz,
  dispatch_owner uuid,
  dispatch_hash text,
  request_count smallint not null default 0 check (request_count between 0 and 6),
  window_started_at timestamptz
);
alter table zodiacs_reminders_private.birthday_reminders enable row level security;
revoke all on zodiacs_reminders_private.birthday_reminders from public, anon, authenticated;

-- Unconfirmed requests older than 48 hours are deleted: on every request, every daily run, and by
-- birthday_reminders_sweep, which the daily workflow calls even while sending is off.
create or replace function public.birthday_reminders_sweep()
returns integer language plpgsql security definer set search_path = '' as $$
declare swept integer;
begin
  delete from zodiacs_reminders_private.birthday_reminders
    where confirmed_at is null and requested_at < pg_catalog.now() - interval '48 hours';
  get diagnostics swept = row_count;
  return swept;
end;
$$;

-- A new or repeated request waits for confirmation with the new month and day. A confirmed reminder is
-- never changed by a request: knowing an address is not enough to undo it. Its owner stops it with the
-- link in its email, then asks again. A new request answers with its row id, so the confirmation email
-- can carry a stop link that works before and after confirming.
-- One address gets at most one confirmation email a minute and six in 24 hours. Requests for the same
-- address queue on an advisory lock, so two at once cannot both pass either cap.
create or replace function public.birthday_reminder_request(p_email text, p_month int, p_day int, p_confirm_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous timestamptz; confirmed timestamptz; sent smallint; window_start timestamptz; reminder_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email, 0));
  perform public.birthday_reminders_sweep();
  select requested_at, confirmed_at, request_count, window_started_at into previous, confirmed, sent, window_start
    from zodiacs_reminders_private.birthday_reminders where email = p_email;
  if confirmed is not null then return pg_catalog.jsonb_build_object('outcome', 'confirmed'); end if;
  -- A new 24-hour window starts with the first request after the last one ended.
  if window_start is null or window_start <= pg_catalog.now() - interval '24 hours' then
    window_start := pg_catalog.now();
    sent := 0;
  end if;
  if sent >= 6 then return pg_catalog.jsonb_build_object('outcome', 'capped'); end if;
  if previous is not null and previous > pg_catalog.now() - interval '60 seconds' then return pg_catalog.jsonb_build_object('outcome', 'capped'); end if;
  insert into zodiacs_reminders_private.birthday_reminders as r (email, month, day, confirm_hash, requested_at, confirmed_at, request_count, window_started_at)
    values (p_email, p_month, p_day, p_confirm_hash, pg_catalog.now(), null, sent + 1, window_start)
  on conflict (email) do update set month = excluded.month, day = excluded.day, confirm_hash = excluded.confirm_hash,
    requested_at = excluded.requested_at, request_count = excluded.request_count, window_started_at = excluded.window_started_at
    where r.confirmed_at is null
  returning r.id into reminder_id;
  -- No row back means it was confirmed in the meantime: it is left as it is.
  if reminder_id is null then return pg_catalog.jsonb_build_object('outcome', 'confirmed'); end if;
  return pg_catalog.jsonb_build_object('outcome', 'requested', 'id', reminder_id);
end;
$$;

-- Answers with the confirmed row's id (null when the link is unknown or expired), so the confirmed page
-- can carry a stop link from the moment the reminder is confirmed.
create or replace function public.birthday_reminder_confirm(p_confirm_hash text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  update zodiacs_reminders_private.birthday_reminders set confirmed_at = pg_catalog.now(), confirm_hash = null
    where confirm_hash = p_confirm_hash and requested_at > pg_catalog.now() - interval '48 hours'
    returning id into found_id;
  return found_id;
end;
$$;

create or replace function public.birthday_reminder_delete(p_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  delete from zodiacs_reminders_private.birthday_reminders where id = p_id returning id into found_id;
  return found_id is not null;
end;
$$;

-- Reads only: the expired requests are deleted by birthday_reminders_sweep, so a dry run changes nothing.
-- The daily run asks for today's and yesterday's birthdays, so one skipped run loses nothing. A reminder
-- counts as sent for 300 days after its email, not until the calendar year ends, so a 31 December
-- birthday sent on the day is not sent again by the 1 January run. The month and day come back so the
-- run can key each email on the birthday it celebrates.
create or replace function public.birthday_reminders_due(p_days jsonb)
returns table (id uuid, email text, month smallint, day smallint) language plpgsql stable security definer set search_path = '' as $$
begin
  return query select r.id, r.email, r.month, r.day from zodiacs_reminders_private.birthday_reminders r
    join pg_catalog.jsonb_to_recordset(p_days) as d(month int, day int) on r.month = d.month and r.day = d.day
    where r.confirmed_at is not null
      and (r.last_sent_on is null or r.last_sent_on < (pg_catalog.now() at time zone 'UTC')::date - 300);
end;
$$;

-- A reservation outlives the 15-minute job but expires if the worker stops.
-- Only provider acceptance marks the reminder as delivered.
create or replace function public.birthday_reminder_claim(p_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare token uuid;
begin
  update zodiacs_reminders_private.birthday_reminders
    set claim_token = pg_catalog.gen_random_uuid(), claimed_at = pg_catalog.now(), claim_dispatched = false
    where id = p_id and confirmed_at is not null
      and (claimed_at is null or claimed_at <= pg_catalog.now() - interval '20 minutes')
      and (last_sent_on is null or last_sent_on < (pg_catalog.now() at time zone 'UTC')::date - 300)
    returning claim_token into token;
  return token;
end;
$$;

-- Run after pacing, immediately before each provider attempt. A retry of an
-- uncertain send keeps the original clock, occurrence and payload. The
-- five-minute margin is longer than the bounded provider request.
create or replace function public.birthday_reminder_dispatch(p_id uuid, p_claim uuid, p_on date, p_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  update zodiacs_reminders_private.birthday_reminders
    set dispatch_started_at = case when dispatch_on = p_on then dispatch_started_at else pg_catalog.now() end,
        dispatch_owner = case when dispatch_on = p_on then dispatch_owner else p_claim end,
        dispatch_on = p_on, dispatch_hash = p_hash, claim_dispatched = true
    where id = p_id and confirmed_at is not null and claim_token = p_claim
      and claimed_at > pg_catalog.now() - interval '20 minutes'
      and p_on is not null and p_hash ~ '^[0-9a-f]{64}$'
      and (dispatch_on is null
        or (dispatch_on = p_on and dispatch_hash = p_hash
            and dispatch_started_at > pg_catalog.now() - interval '23 hours 55 minutes')
        or (p_on >= dispatch_on + 300 and dispatch_started_at < pg_catalog.now() - interval '300 days'))
    returning id into found_id;
  if found_id is not null then return true; end if;
  if exists (select 1 from zodiacs_reminders_private.birthday_reminders
             where id = p_id and claim_token = p_claim
               and claimed_at > pg_catalog.now() - interval '20 minutes') then
    raise exception 'Birthday reminder dispatch needs reconciliation';
  end if;
  return false;
end;
$$;

create or replace function public.birthday_reminder_complete(p_id uuid, p_claim uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  update zodiacs_reminders_private.birthday_reminders
    set last_sent_on = (pg_catalog.now() at time zone 'UTC')::date,
        claim_token = null, claimed_at = null, claim_dispatched = false, dispatch_owner = null, dispatch_hash = null
    where id = p_id and claim_token = p_claim and claim_dispatched
    returning id into found_id;
  return found_id is not null;
end;
$$;

-- A definitive rejection clears a dispatch first attempted by this worker.
-- A timeout, lost receipt or rejection during recovery preserves the original
-- attempt, so an expired provider key cannot send that occurrence again.
create or replace function public.birthday_reminder_release(p_id uuid, p_claim uuid, p_rejected boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare found_id uuid;
begin
  if p_rejected then
    update zodiacs_reminders_private.birthday_reminders
      set dispatch_on = null, dispatch_started_at = null, dispatch_owner = null, dispatch_hash = null
      where id = p_id and claim_token = p_claim and dispatch_owner = p_claim;
  end if;
  update zodiacs_reminders_private.birthday_reminders
    set claim_token = null, claimed_at = null, claim_dispatched = false
    where id = p_id and claim_token = p_claim
    returning id into found_id;
  return found_id is not null;
end;
$$;

revoke all on function public.birthday_reminders_sweep() from public, anon, authenticated;
revoke all on function public.birthday_reminder_request(text, int, int, text) from public, anon, authenticated;
revoke all on function public.birthday_reminder_confirm(text) from public, anon, authenticated;
revoke all on function public.birthday_reminder_delete(uuid) from public, anon, authenticated;
revoke all on function public.birthday_reminders_due(jsonb) from public, anon, authenticated;
revoke all on function public.birthday_reminder_claim(uuid) from public, anon, authenticated;
revoke all on function public.birthday_reminder_dispatch(uuid, uuid, date, text) from public, anon, authenticated;
revoke all on function public.birthday_reminder_complete(uuid, uuid) from public, anon, authenticated;
revoke all on function public.birthday_reminder_release(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.birthday_reminders_sweep() to service_role;
grant execute on function public.birthday_reminder_request(text, int, int, text) to service_role;
grant execute on function public.birthday_reminder_confirm(text) to service_role;
grant execute on function public.birthday_reminder_delete(uuid) to service_role;
grant execute on function public.birthday_reminders_due(jsonb) to service_role;
grant execute on function public.birthday_reminder_claim(uuid) to service_role;
grant execute on function public.birthday_reminder_dispatch(uuid, uuid, date, text) to service_role;
grant execute on function public.birthday_reminder_complete(uuid, uuid) to service_role;
grant execute on function public.birthday_reminder_release(uuid, uuid, boolean) to service_role;
