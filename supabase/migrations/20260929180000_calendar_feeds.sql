-- Transit calendar feeds addressed by random opaque ids (owner decision of
-- 2026-09-28, §2; finding F-20).
--
-- A subscription made on the site stores only what the transit feed computes
-- from: the longitudes of the ten planets, Sun to Pluto, to 0.001°, and the
-- ascendant and midheaven to the whole degree (neither for a chart without a
-- birth time). No name, place, birth date or birth time is stored. The id is
-- 128 random bits made by the server; it is the only thing in the feed's URL.
-- The key that removes a feed is returned once to the browser that made it
-- and is stored here only as its SHA-256 digest.
--
-- The table is server-owned. Browser roles get no policy or privilege, and
-- service_role reaches it only through the four RPCs below. A feed that has
-- not been fetched for 12 months (or, if never fetched, made 12 months ago)
-- is deleted by prune_calendar_feeds, run by a scheduled sweep.
--
-- New feeds share one limit for all visitors together: while 500 feeds made
-- in the last hour still exist, create_calendar_feed answers 'busy' and
-- writes nothing. So no more than 500 feeds made in the hour before any
-- moment exist at that moment; a feed removed within its hour frees its
-- place, so more than 500 can be made in an hour when some are removed. The
-- count holds only at READ COMMITTED, and a creation at any other isolation
-- level is refused (see create_calendar_feed_at). Nothing about who asked (no
-- address or other per-client value) is stored or counted; the per-client
-- limit is the Vercel Firewall rule zodiacs-calendar-feed-write, which takes
-- effect only once it is created there.
--
-- Every function runs with search_path pg_catalog, pg_temp, so a caller's
-- temporary objects are looked up after the system catalog and never before
-- it, and every table and function of this migration is named with its
-- schema. The two *_at functions take the time as an argument so the SQL
-- tests can run them at a fixed instant; only the table owner may call them.
--
-- Replay-safe: a reviewed SQL Editor retry converges on the same objects.

create or replace function public.is_valid_calendar_feed_id(
  candidate text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
  -- 16 random bytes as unpadded base64url: 22 characters, the last of which
  -- carries only two bits.
  select candidate is not null
    and pg_catalog.octet_length(candidate) = 22
    and candidate ~ '^[A-Za-z0-9_-]{21}[AQgw]$';
$$;

create or replace function public.is_valid_calendar_feed_secret_hash(
  candidate text
)
returns boolean
language sql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
  select candidate is not null
    and pg_catalog.octet_length(candidate) = 64
    and candidate ~ '^[0-9a-f]{64}$';
$$;

-- Compare two digests without stopping at the first difference.
create or replace function public.calendar_feed_secret_hash_matches(
  stored text,
  candidate text
)
returns boolean
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  stored_bytes bytea;
  candidate_bytes bytea;
  difference integer := 0;
  byte_index integer;
begin
  if not public.is_valid_calendar_feed_secret_hash(stored)
    or not public.is_valid_calendar_feed_secret_hash(candidate)
  then
    return false;
  end if;
  stored_bytes := pg_catalog.decode(stored, 'hex');
  candidate_bytes := pg_catalog.decode(candidate, 'hex');
  for byte_index in 0..31 loop
    difference := difference
      | (pg_catalog.get_byte(stored_bytes, byte_index)
        # pg_catalog.get_byte(candidate_bytes, byte_index));
  end loop;
  return difference = 0;
end;
$$;

-- The ten planets' longitudes, Sun to Pluto, as a JSON array of numbers,
-- each in [0, 360) with at most three decimals. Anything else is null, so a
-- value is rejected rather than rounded.
create or replace function public.calendar_feed_planets(
  candidate jsonb
)
returns numeric[]
language plpgsql
immutable
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  element jsonb;
  longitude numeric;
  planets numeric[] := array[]::numeric[];
begin
  if candidate is null
    or pg_catalog.jsonb_typeof(candidate) <> 'array'
    or pg_catalog.jsonb_array_length(candidate) <> 10
    or pg_catalog.octet_length(candidate::text) > 256
  then
    return null;
  end if;

  for element in
    select item.value
    from pg_catalog.jsonb_array_elements(candidate) with ordinality as item(value, position)
    order by item.position
  loop
    if pg_catalog.jsonb_typeof(element) <> 'number' then
      return null;
    end if;
    longitude := (element #>> '{}')::numeric;
    if longitude < 0
      or longitude >= 360
      or longitude <> pg_catalog.round(longitude, 3)
    then
      return null;
    end if;
    planets := planets || longitude;
  end loop;

  return planets;
exception
  when others then
    return null;
end;
$$;

create table if not exists public.calendar_feeds (
  id text primary key,
  secret_hash text not null,
  planets numeric(6,3)[] not null,
  ascendant smallint,
  midheaven smallint,
  created_at timestamptz not null default clock_timestamp(),
  last_fetched_at timestamptz,
  constraint calendar_feeds_id_valid
    check (public.is_valid_calendar_feed_id(id)),
  constraint calendar_feeds_secret_hash_valid
    check (public.is_valid_calendar_feed_secret_hash(secret_hash)),
  constraint calendar_feeds_planets_valid
    check (
      array_ndims(planets) = 1
      and cardinality(planets) = 10
      and array_position(planets, null) is null
      and 0 <= all(planets)
      and 360 > all(planets)
    ),
  constraint calendar_feeds_angles_valid
    check (
      (ascendant is null) = (midheaven is null)
      and (
        ascendant is null
        or (ascendant between 0 and 359 and midheaven between 0 and 359)
      )
    ),
  constraint calendar_feeds_fetch_after_creation
    check (last_fetched_at is null or last_fetched_at >= created_at)
);

create index if not exists calendar_feeds_last_activity_idx
  on public.calendar_feeds ((coalesce(last_fetched_at, created_at)), id);

-- The hourly limit counts feeds by the time they were made.
create index if not exists calendar_feeds_created_at_idx
  on public.calendar_feeds (created_at);

-- Make one feed at the given instant. Owner only: create_calendar_feed calls
-- it with the database clock, and the SQL tests with a fixed one.
create or replace function public.create_calendar_feed_at(
  candidate_id text,
  candidate_secret_hash text,
  candidate_planets jsonb,
  candidate_ascendant integer,
  candidate_midheaven integer,
  operation_time timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  planets numeric[];
  made_last_hour integer;
begin
  if operation_time is null then
    raise exception 'invalid calendar feed creation time'
      using errcode = '22023';
  end if;

  planets := public.calendar_feed_planets(candidate_planets);
  if not public.is_valid_calendar_feed_id(candidate_id)
    or not public.is_valid_calendar_feed_secret_hash(candidate_secret_hash)
    or planets is null
    or (candidate_ascendant is null) <> (candidate_midheaven is null)
    or (candidate_ascendant is not null and candidate_ascendant not between 0 and 359)
    or (candidate_midheaven is not null and candidate_midheaven not between 0 and 359)
  then
    return pg_catalog.jsonb_build_object('outcome', 'invalid');
  end if;

  -- The count below sees the feeds of creations that finished while this one
  -- waited for the lock only at READ COMMITTED, where each statement reads a
  -- new snapshot; PostgREST runs an RPC at that level unless the function or
  -- a role sets another. At REPEATABLE READ the transaction's snapshot
  -- predates the wait, so two creations racing for the last place in the
  -- hour could both be made. Any level but READ COMMITTED is refused.
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'calendar feeds are made only at READ COMMITTED'
      using errcode = '25000';
  end if;

  -- One creation at a time, so creations racing each other cannot pass the
  -- hourly limit together. The lock ends with the transaction.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.calendar_feeds creation', 20260929)
  );
  select pg_catalog.count(*)
  into made_last_hour
  from public.calendar_feeds
  where created_at > operation_time - interval '1 hour';
  if made_last_hour >= 500 then
    return pg_catalog.jsonb_build_object('outcome', 'busy');
  end if;

  begin
    insert into public.calendar_feeds (
      id,
      secret_hash,
      planets,
      ascendant,
      midheaven,
      created_at
    ) values (
      candidate_id,
      candidate_secret_hash,
      planets,
      candidate_ascendant,
      candidate_midheaven,
      operation_time
    );
  exception
    when unique_violation then
      return pg_catalog.jsonb_build_object('outcome', 'id_conflict');
  end;

  return pg_catalog.jsonb_build_object(
    'outcome', 'created',
    'id', candidate_id,
    'created_at', operation_time
  );
end;
$$;

create or replace function public.create_calendar_feed(
  candidate_id text,
  candidate_secret_hash text,
  candidate_planets jsonb,
  candidate_ascendant integer,
  candidate_midheaven integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  -- The lock is taken before the clock is read, so the feeds' creation times
  -- follow the order in which the hourly limit counted them.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('public.calendar_feeds creation', 20260929)
  );
  return public.create_calendar_feed_at(
    candidate_id,
    candidate_secret_hash,
    candidate_planets,
    candidate_ascendant,
    candidate_midheaven,
    pg_catalog.clock_timestamp()
  );
end;
$$;

-- Serve one feed: note the fetch and return what the feed computes from.
-- An unknown or removed id is not_found; the two are indistinguishable.
create or replace function public.fetch_calendar_feed(
  candidate_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  operation_time timestamptz := pg_catalog.clock_timestamp();
  feed public.calendar_feeds%rowtype;
begin
  if not public.is_valid_calendar_feed_id(candidate_id) then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  update public.calendar_feeds
  set last_fetched_at = greatest(operation_time, created_at)
  where id = candidate_id
  returning * into feed;
  if not found then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  return pg_catalog.jsonb_build_object(
    'outcome', 'ready',
    'planets', pg_catalog.to_jsonb(feed.planets),
    'ascendant', feed.ascendant,
    'midheaven', feed.midheaven
  );
end;
$$;

-- Remove a feed with the key returned when it was made. A wrong key and an
-- unknown id give the same answer, and nothing of the row is kept.
create or replace function public.revoke_calendar_feed(
  candidate_id text,
  candidate_secret_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  stored_hash text;
begin
  if not public.is_valid_calendar_feed_id(candidate_id)
    or not public.is_valid_calendar_feed_secret_hash(candidate_secret_hash)
  then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  select secret_hash
  into stored_hash
  from public.calendar_feeds
  where id = candidate_id
  for update;
  if not found
    or not public.calendar_feed_secret_hash_matches(stored_hash, candidate_secret_hash)
  then
    return pg_catalog.jsonb_build_object('outcome', 'not_found');
  end if;

  delete from public.calendar_feeds
  where id = candidate_id;

  return pg_catalog.jsonb_build_object('outcome', 'revoked');
end;
$$;

-- Delete, in bounded batches, feeds with no fetch in the 12 months before
-- the given instant (or, never fetched, made 12 months before it or more).
-- The months are counted in UTC whatever the session's time zone. SKIP
-- LOCKED leaves a feed that is being fetched or removed right now to that
-- request; the DELETE checks the age again, so a fetch that lands first
-- keeps its feed. Owner only: prune_calendar_feeds calls it with the
-- database clock, and the SQL tests with a fixed one.
create or replace function public.prune_calendar_feeds_at(
  candidate_limit integer,
  operation_time timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, pg_temp
set timezone = 'UTC'
as $$
declare
  cutoff timestamptz;
  removed_count integer;
begin
  if candidate_limit is null or candidate_limit < 1 or candidate_limit > 1024 then
    raise exception 'invalid calendar feed prune limit'
      using errcode = '22023';
  end if;
  if operation_time is null then
    raise exception 'invalid calendar feed prune time'
      using errcode = '22023';
  end if;
  cutoff := operation_time - interval '12 months';

  with candidates as materialized (
    select id
    from public.calendar_feeds
    where coalesce(last_fetched_at, created_at) <= cutoff
    order by coalesce(last_fetched_at, created_at), id
    for update skip locked
    limit candidate_limit
  ), removed as (
    delete from public.calendar_feeds as feeds
    using candidates
    where feeds.id = candidates.id
      and coalesce(feeds.last_fetched_at, feeds.created_at) <= cutoff
    returning feeds.id
  )
  select pg_catalog.count(*)
  into removed_count
  from removed;

  return pg_catalog.jsonb_build_object('pruned', removed_count);
end;
$$;

create or replace function public.prune_calendar_feeds(
  candidate_limit integer default 256
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  return public.prune_calendar_feeds_at(candidate_limit, pg_catalog.clock_timestamp());
end;
$$;

alter table public.calendar_feeds enable row level security;

-- Revoke first so both legacy automatic grants and the 2026 secure defaults
-- converge on the same no-browser, RPC-only posture.
revoke all on table public.calendar_feeds
  from public, anon, authenticated, service_role;

revoke all on function public.is_valid_calendar_feed_id(text)
  from public, anon, authenticated;
revoke all on function public.is_valid_calendar_feed_secret_hash(text)
  from public, anon, authenticated;
revoke all on function public.calendar_feed_secret_hash_matches(text, text)
  from public, anon, authenticated;
revoke all on function public.calendar_feed_planets(jsonb)
  from public, anon, authenticated;
revoke all on function public.create_calendar_feed(text, text, jsonb, integer, integer)
  from public, anon, authenticated;
revoke all on function public.fetch_calendar_feed(text)
  from public, anon, authenticated;
revoke all on function public.revoke_calendar_feed(text, text)
  from public, anon, authenticated;
revoke all on function public.prune_calendar_feeds(integer)
  from public, anon, authenticated;
-- The fixed-clock functions are the owner's alone, service_role included.
revoke all on function public.create_calendar_feed_at(text, text, jsonb, integer, integer, timestamptz)
  from public, anon, authenticated, service_role;
revoke all on function public.prune_calendar_feeds_at(integer, timestamptz)
  from public, anon, authenticated, service_role;

grant execute on function public.is_valid_calendar_feed_id(text)
  to service_role;
grant execute on function public.is_valid_calendar_feed_secret_hash(text)
  to service_role;
grant execute on function public.calendar_feed_secret_hash_matches(text, text)
  to service_role;
grant execute on function public.calendar_feed_planets(jsonb)
  to service_role;
grant execute on function public.create_calendar_feed(text, text, jsonb, integer, integer)
  to service_role;
grant execute on function public.fetch_calendar_feed(text)
  to service_role;
grant execute on function public.revoke_calendar_feed(text, text)
  to service_role;
grant execute on function public.prune_calendar_feeds(integer)
  to service_role;

comment on table public.calendar_feeds is
  'Transit calendar subscriptions addressed by a random 128-bit id. Only what the feed computes from is stored: no name, place, birth date or birth time. Deleted after 12 months without a fetch, or at once with the removal key. None is made while 500 made in the past hour exist.';
comment on column public.calendar_feeds.id is
  '16 random bytes from the server, unpadded base64url; the only thing in the feed URL.';
comment on column public.calendar_feeds.secret_hash is
  'SHA-256 of the removal key returned once to the browser that made the feed; the key itself is never stored.';
comment on column public.calendar_feeds.planets is
  'Longitudes of the Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune and Pluto, in that order, to 0.001°.';
comment on column public.calendar_feeds.ascendant is
  'Whole degree of the ascendant, 0-359; null for a chart without a birth time. The feed uses the middle of the degree.';
comment on column public.calendar_feeds.midheaven is
  'Whole degree of the midheaven, 0-359; null for a chart without a birth time. The feed uses the middle of the degree.';
comment on column public.calendar_feeds.last_fetched_at is
  'When the feed server last read this feed for a calendar; null until the first fetch.';
comment on function public.create_calendar_feed_at(text, text, jsonb, integer, integer, timestamptz) is
  'create_calendar_feed at a given instant. Table owner only; the SQL tests call it with a fixed clock.';
comment on function public.prune_calendar_feeds_at(integer, timestamptz) is
  'prune_calendar_feeds at a given instant. Table owner only; the SQL tests call it with a fixed clock.';
