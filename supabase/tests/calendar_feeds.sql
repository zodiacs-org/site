\set ON_ERROR_STOP on

-- Run after all migrations in a disposable PostgreSQL 17 database. The
-- fixture proves the no-browser boundary, the stored columns, the strict
-- positions input, fetching, removal with the key's digest, the 12-month
-- retention sweep on both sides of its boundary (also at a fixed clock), and
-- the shared limit on new feeds: none while 500 made in the past hour exist.
-- Every value is synthetic.

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

-- A synthetic id: 21 characters and a final one that carries two bits.
create or replace function pg_temp.feed_id(label text)
returns text
language sql
immutable
as $$
  select rpad(label, 21, 'x') || 'A';
$$;

create or replace function pg_temp.key_hash(label text)
returns text
language sql
immutable
as $$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(label, 'UTF8')), 'hex');
$$;

create or replace function pg_temp.planets()
returns jsonb
language sql
immutable
as $$
  select '[15.5, 45.25, 75.125, 105, 135.001, 165.999, 195, 225, 255, 359.999]'::jsonb;
$$;

-- The boundary: RLS on, no policies, no table privileges for any API role.
select pg_temp.assert_true(
  (select relrowsecurity
   from pg_catalog.pg_class
   where oid = 'public.calendar_feeds'::regclass),
  'calendar_feeds must have RLS enabled'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.calendar_feeds'::regclass
  ),
  'calendar_feeds must expose zero browser policies'
);

select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.calendar_feeds', 'select,insert,update,delete,truncate,references,trigger')
    and not has_table_privilege('authenticated', 'public.calendar_feeds', 'select,insert,update,delete,truncate,references,trigger')
    and not has_table_privilege('service_role', 'public.calendar_feeds', 'select,insert,update,delete,truncate,references,trigger'),
  'calendar feeds must be RPC-only, including for service_role'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.create_calendar_feed(text,text,jsonb,integer,integer)'),
      ('public.fetch_calendar_feed(text)'),
      ('public.revoke_calendar_feed(text,text)'),
      ('public.prune_calendar_feeds(integer)')
    ) as rpc(signature)
    where has_function_privilege('anon', rpc.signature, 'execute')
      or has_function_privilege('authenticated', rpc.signature, 'execute')
      or not has_function_privilege('service_role', rpc.signature, 'execute')
      or not (
        select prosecdef
        from pg_catalog.pg_proc
        where oid = rpc.signature::regprocedure
      )
  ),
  'only service_role may execute the SECURITY DEFINER feed RPCs'
);

-- Every feed function looks up names in pg_catalog first and in the caller's
-- temporary schema last, never in public or before the catalog.
select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.is_valid_calendar_feed_id(text)'),
      ('public.is_valid_calendar_feed_secret_hash(text)'),
      ('public.calendar_feed_secret_hash_matches(text,text)'),
      ('public.calendar_feed_planets(jsonb)'),
      ('public.create_calendar_feed_at(text,text,jsonb,integer,integer,timestamptz)'),
      ('public.create_calendar_feed(text,text,jsonb,integer,integer)'),
      ('public.fetch_calendar_feed(text)'),
      ('public.revoke_calendar_feed(text,text)'),
      ('public.prune_calendar_feeds_at(integer,timestamptz)'),
      ('public.prune_calendar_feeds(integer)')
    ) as feed_function(signature)
    where (
      select pg_catalog.array_agg(setting)
      from pg_catalog.pg_proc
      cross join pg_catalog.unnest(proconfig) as setting
      where oid = feed_function.signature::regprocedure
        and setting like 'search\_path=%'
    ) is distinct from array['search_path=pg_catalog, pg_temp']
  ),
  'every feed function runs with search_path pg_catalog, pg_temp'
);

select pg_temp.assert_true(
  (
    select coalesce('TimeZone=UTC' = any(proconfig), false)
    from pg_catalog.pg_proc
    where oid = 'public.prune_calendar_feeds_at(integer,timestamptz)'::regprocedure
  ),
  'the retention sweep counts its 12 months in UTC'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.is_valid_calendar_feed_id(text)'),
      ('public.is_valid_calendar_feed_secret_hash(text)'),
      ('public.calendar_feed_secret_hash_matches(text,text)'),
      ('public.calendar_feed_planets(jsonb)')
    ) as helper(signature)
    where has_function_privilege('anon', helper.signature, 'execute')
      or has_function_privilege('authenticated', helper.signature, 'execute')
  ),
  'browser roles may not execute the feed helpers'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.create_calendar_feed_at(text,text,jsonb,integer,integer,timestamptz)'),
      ('public.prune_calendar_feeds_at(integer,timestamptz)')
    ) as fixed_clock(signature)
    where has_function_privilege('anon', fixed_clock.signature, 'execute')
      or has_function_privilege('authenticated', fixed_clock.signature, 'execute')
      or has_function_privilege('service_role', fixed_clock.signature, 'execute')
      or (
        select prosecdef
        from pg_catalog.pg_proc
        where oid = fixed_clock.signature::regprocedure
      )
  ),
  'only the table owner may run creation or the sweep at a chosen time'
);

-- What is stored: exactly these columns, and nothing that names a birth.
select pg_temp.assert_true(
  (
    select array_agg(column_name::text order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'calendar_feeds'
  ) = array[
    'id', 'secret_hash', 'planets', 'ascendant', 'midheaven',
    'created_at', 'last_fetched_at'
  ],
  'a feed stores its id, key digest, planets, whole-degree angles and two times, and nothing else'
);

-- Browser roles cannot reach the table even by name.
set role anon;
do $$
begin
  perform 1 from public.calendar_feeds;
  raise exception 'anon read calendar_feeds';
exception
  when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform public.fetch_calendar_feed('abcdefghijklmnopqrstuA');
  raise exception 'anon executed fetch_calendar_feed';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

set role authenticated;
do $$
begin
  perform public.create_calendar_feed(
    'abcdefghijklmnopqrstuA',
    repeat('a', 64),
    '[1,2,3,4,5,6,7,8,9,10]'::jsonb,
    null,
    null
  );
  raise exception 'authenticated executed create_calendar_feed';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

set role service_role;
do $$
begin
  perform 1 from public.calendar_feeds;
  raise exception 'service_role read calendar_feeds directly';
exception
  when insufficient_privilege then null;
end;
$$;

-- Creation validates every field and rounds nothing.
select pg_temp.assert_true(
  public.create_calendar_feed(
    pg_temp.feed_id('timed'),
    pg_temp.key_hash('timed key'),
    pg_temp.planets(),
    100,
    190
  )->>'outcome' = 'created',
  'a timed feed with whole-degree angles is created'
);

select pg_temp.assert_true(
  public.create_calendar_feed(
    pg_temp.feed_id('untimed'),
    pg_temp.key_hash('untimed key'),
    pg_temp.planets(),
    null,
    null
  )->>'outcome' = 'created',
  'a feed without angles is created'
);

select pg_temp.assert_true(
  public.create_calendar_feed(
    pg_temp.feed_id('timed'),
    pg_temp.key_hash('other key'),
    pg_temp.planets(),
    null,
    null
  )->>'outcome' = 'id_conflict',
  'an id already in use is refused, not replaced'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      (pg_temp.feed_id('bad-a'), pg_temp.key_hash('k'), pg_temp.planets(), 100, null),
      (pg_temp.feed_id('bad-b'), pg_temp.key_hash('k'), pg_temp.planets(), null, 190),
      (pg_temp.feed_id('bad-c'), pg_temp.key_hash('k'), pg_temp.planets(), 360, 190),
      (pg_temp.feed_id('bad-d'), pg_temp.key_hash('k'), pg_temp.planets(), -1, 190),
      (pg_temp.feed_id('bad-e'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9]'::jsonb, null, null),
      (pg_temp.feed_id('bad-f'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9,10,11]'::jsonb, null, null),
      (pg_temp.feed_id('bad-g'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9,360]'::jsonb, null, null),
      (pg_temp.feed_id('bad-h'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9,-0.001]'::jsonb, null, null),
      (pg_temp.feed_id('bad-i'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9,1.0005]'::jsonb, null, null),
      (pg_temp.feed_id('bad-j'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9,"10"]'::jsonb, null, null),
      (pg_temp.feed_id('bad-k'), pg_temp.key_hash('k'), '[1,2,3,4,5,6,7,8,9,null]'::jsonb, null, null),
      (pg_temp.feed_id('bad-l'), pg_temp.key_hash('k'), '{"b":[1,2,3,4,5,6,7,8,9,10]}'::jsonb, null, null),
      (pg_temp.feed_id('bad-m'), pg_temp.key_hash('k'), '[[1],2,3,4,5,6,7,8,9,10]'::jsonb, null, null),
      (pg_temp.feed_id('bad-n'), pg_temp.key_hash('k'), null::jsonb, null, null),
      ('abcdefghijklmnopqrstuB', pg_temp.key_hash('k'), pg_temp.planets(), null, null),
      ('abcdefghijklmnopqrstu', pg_temp.key_hash('k'), pg_temp.planets(), null, null),
      ('abcdefghijklmnopqrst!A', pg_temp.key_hash('k'), pg_temp.planets(), null, null),
      (null, pg_temp.key_hash('k'), pg_temp.planets(), null, null),
      (pg_temp.feed_id('bad-o'), upper(pg_temp.key_hash('k')), pg_temp.planets(), null, null),
      (pg_temp.feed_id('bad-p'), left(pg_temp.key_hash('k'), 63), pg_temp.planets(), null, null),
      (pg_temp.feed_id('bad-q'), null, pg_temp.planets(), null, null)
    ) as attempt(id, secret_hash, planets, ascendant, midheaven)
    where public.create_calendar_feed(
      attempt.id,
      attempt.secret_hash,
      attempt.planets,
      attempt.ascendant,
      attempt.midheaven
    )->>'outcome' <> 'invalid'
  ),
  'creation rejects half-set or out-of-range angles, a wrong planet count, range or precision, and malformed ids and digests'
);

reset role;
select pg_temp.assert_true(
  (select count(*) from public.calendar_feeds) = 2,
  'invalid creations write nothing'
);

select pg_temp.assert_true(
  (
    select planets = array[15.5, 45.25, 75.125, 105, 135.001, 165.999, 195, 225, 255, 359.999]::numeric(6,3)[]
      and ascendant = 100
      and midheaven = 190
      and secret_hash = pg_temp.key_hash('timed key')
      and last_fetched_at is null
      and created_at <= clock_timestamp()
    from public.calendar_feeds
    where id = pg_temp.feed_id('timed')
  ),
  'a feed keeps the planets to 0.001 degree, the whole-degree angles and only the key digest'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.calendar_feeds
    where secret_hash in ('timed key', 'untimed key')
  ),
  'the removal key itself is never stored'
);
set role service_role;

-- Fetching notes the time and returns only what the feed computes from.
select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_temp.feed_id('timed'))
    = jsonb_build_object(
      'outcome', 'ready',
      'planets', '[15.500, 45.250, 75.125, 105.000, 135.001, 165.999, 195.000, 225.000, 255.000, 359.999]'::jsonb,
      'ascendant', 100,
      'midheaven', 190
    ),
  'a fetch returns the ten planets and the whole-degree angles'
);

select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_temp.feed_id('untimed'))
    = jsonb_build_object(
      'outcome', 'ready',
      'planets', '[15.500, 45.250, 75.125, 105.000, 135.001, 165.999, 195.000, 225.000, 255.000, 359.999]'::jsonb,
      'ascendant', null,
      'midheaven', null
    ),
  'a feed without a birth time is fetched without angles'
);

reset role;
select pg_temp.assert_true(
  (
    select last_fetched_at is not null
      and last_fetched_at >= created_at
      and last_fetched_at > clock_timestamp() - interval '1 minute'
    from public.calendar_feeds
    where id = pg_temp.feed_id('timed')
  ),
  'a fetch updates the last-fetch time'
);
set role service_role;

select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_temp.feed_id('never made'))->>'outcome' = 'not_found'
    and public.fetch_calendar_feed('not an id')->>'outcome' = 'not_found'
    and public.fetch_calendar_feed(null)->>'outcome' = 'not_found',
  'an unknown or malformed id is not_found'
);

-- Removal needs the key; a wrong key and an unknown id look the same.
select pg_temp.assert_true(
  public.revoke_calendar_feed(pg_temp.feed_id('timed'), pg_temp.key_hash('wrong key'))->>'outcome' = 'not_found'
    and public.revoke_calendar_feed(pg_temp.feed_id('timed'), pg_temp.key_hash('untimed key'))->>'outcome' = 'not_found'
    and public.revoke_calendar_feed(pg_temp.feed_id('timed'), 'timed key')->>'outcome' = 'not_found'
    and public.revoke_calendar_feed(pg_temp.feed_id('timed'), null)->>'outcome' = 'not_found'
    and public.revoke_calendar_feed(pg_temp.feed_id('never made'), pg_temp.key_hash('timed key'))->>'outcome' = 'not_found',
  'a wrong key or an unknown id removes nothing'
);

select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_temp.feed_id('timed'))->>'outcome' = 'ready',
  'a failed removal leaves the feed served'
);

select pg_temp.assert_true(
  public.revoke_calendar_feed(pg_temp.feed_id('timed'), pg_temp.key_hash('timed key'))->>'outcome' = 'revoked',
  'the key that made a feed removes it'
);

select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_temp.feed_id('timed'))->>'outcome' = 'not_found'
    and public.revoke_calendar_feed(pg_temp.feed_id('timed'), pg_temp.key_hash('timed key'))->>'outcome' = 'not_found',
  'a removed feed is not_found and cannot be removed twice'
);

reset role;
select pg_temp.assert_true(
  not exists (select 1 from public.calendar_feeds where id = pg_temp.feed_id('timed')),
  'removal deletes the whole row'
);

-- The digest comparison looks at every byte.
select pg_temp.assert_true(
  public.calendar_feed_secret_hash_matches(repeat('ab', 32), repeat('ab', 32))
    and not public.calendar_feed_secret_hash_matches(repeat('ab', 32), repeat('ab', 31) || 'ac')
    and not public.calendar_feed_secret_hash_matches(repeat('ab', 32), 'ac' || repeat('ab', 31))
    and not public.calendar_feed_secret_hash_matches(repeat('ab', 32), null)
    and not public.calendar_feed_secret_hash_matches(null, repeat('ab', 32)),
  'the digest comparison finds a difference in the first or the last byte'
);

-- An early exit gives the same answers, only sooner, so it is caught by the
-- function's body: it may return only for malformed input and after reading
-- all 32 bytes, and it never leaves the loop early.
select pg_temp.assert_true(
  (
    select pg_catalog.regexp_count(prosrc, '\mreturn\M') = 2
      and pg_catalog.regexp_count(prosrc, '\mreturn false;') = 1
      and pg_catalog.regexp_count(prosrc, '\mreturn difference = 0;') = 1
      and prosrc ~ 'for byte_index in 0\.\.31 loop'
      and pg_catalog.strpos(prosrc, 'return difference = 0;') > pg_catalog.strpos(prosrc, 'end loop;')
      and prosrc !~ '\m(exit|continue)\M'
    from pg_catalog.pg_proc
    where oid = 'public.calendar_feed_secret_hash_matches(text,text)'::regprocedure
  ),
  'the digest comparison reads all 32 bytes before it answers'
);

-- Retention: 12 months without a fetch, on both sides of the boundary.
delete from public.calendar_feeds;
insert into public.calendar_feeds (id, secret_hash, planets, created_at, last_fetched_at)
select pg_temp.feed_id(fixture.label),
  pg_temp.key_hash(fixture.label),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  fixture.created_at,
  fixture.last_fetched_at
from (values
  ('fetched-over', clock_timestamp() - interval '3 years', clock_timestamp() - interval '12 months' - interval '1 minute'),
  ('fetched-under', clock_timestamp() - interval '3 years', clock_timestamp() - interval '12 months' + interval '1 minute'),
  ('never-over', clock_timestamp() - interval '12 months' - interval '1 minute', null::timestamptz),
  ('never-under', clock_timestamp() - interval '12 months' + interval '1 minute', null::timestamptz),
  ('old-but-fetched', clock_timestamp() - interval '5 years', clock_timestamp() - interval '1 day'),
  ('fresh', clock_timestamp() - interval '1 hour', null::timestamptz)
) as fixture(label, created_at, last_fetched_at);

set role service_role;
do $$
begin
  perform public.prune_calendar_feeds(0);
  raise exception 'a zero prune limit was accepted';
exception
  when invalid_parameter_value then null;
end;
$$;
do $$
begin
  perform public.prune_calendar_feeds(1025);
  raise exception 'an oversized prune limit was accepted';
exception
  when invalid_parameter_value then null;
end;
$$;

select pg_temp.assert_true(
  public.prune_calendar_feeds(1) = '{"pruned": 1}'::jsonb
    and public.prune_calendar_feeds(256) = '{"pruned": 1}'::jsonb
    and public.prune_calendar_feeds(256) = '{"pruned": 0}'::jsonb,
  'the sweep deletes in bounded batches until nothing is due'
);
reset role;

select pg_temp.assert_true(
  (
    select array_agg(id order by id)
    from public.calendar_feeds
  ) = (
    select array_agg(pg_temp.feed_id(label) order by pg_temp.feed_id(label))
    from (values ('fetched-under'), ('never-under'), ('old-but-fetched'), ('fresh')) as kept(label)
  ),
  'the sweep deletes feeds with no fetch for 12 months and keeps those fetched or made more recently'
);

-- A fetch resets the clock: an overdue feed that is fetched is kept.
update public.calendar_feeds
set created_at = clock_timestamp() - interval '2 years',
    last_fetched_at = clock_timestamp() - interval '13 months'
where id = pg_temp.feed_id('fresh');
set role service_role;
select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_temp.feed_id('fresh'))->>'outcome' = 'ready'
    and public.prune_calendar_feeds(256) = '{"pruned": 0}'::jsonb,
  'a fetch before the sweep keeps an overdue feed'
);
reset role;

-- Retention at a fixed clock. The sweep runs at 12:00 UTC on 13 March 2028,
-- so the cutoff is 12:00 UTC on 13 March 2027. The session's time zone is New
-- York, where daylight saving time had begun by the sweep but not by the
-- cutoff: months counted in New York time would put the cutoff an hour later.
-- The 12 months include 29 February 2028, so 365 days would put it a day
-- later. Feeds sit on the cutoff, just after it, in that hour and in that day.
delete from public.calendar_feeds;
insert into public.calendar_feeds (id, secret_hash, planets, created_at, last_fetched_at)
select pg_temp.feed_id(fixture.label),
  pg_temp.key_hash(fixture.label),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  fixture.created_at,
  fixture.last_fetched_at
from (values
  ('fetched-at-cutoff', '2026-01-01 00:00:00+00'::timestamptz, '2027-03-13 12:00:00+00'::timestamptz),
  ('fetched-after-cutoff', '2026-01-01 00:00:00+00', '2027-03-13 12:00:00.000001+00'),
  ('fetched-in-dst-hour', '2026-01-01 00:00:00+00', '2027-03-13 12:30:00+00'),
  ('fetched-in-leap-day', '2026-01-01 00:00:00+00', '2027-03-13 18:00:00+00'),
  ('fetched-long-ago', '2026-01-01 00:00:00+00', '2027-03-12 00:00:00+00'),
  ('made-at-cutoff', '2027-03-13 12:00:00+00', null),
  ('made-after-cutoff', '2027-03-13 12:00:00.000001+00', null)
) as fixture(label, created_at, last_fetched_at);

set timezone = 'America/New_York';
do $$
begin
  perform public.prune_calendar_feeds_at(256, null);
  raise exception 'a sweep without a time was accepted';
exception
  when invalid_parameter_value then null;
end;
$$;
select pg_temp.assert_true(
  public.prune_calendar_feeds_at(256, '2028-03-13 12:00:00+00') = '{"pruned": 3}'::jsonb,
  'at a fixed clock the sweep deletes the three feeds idle for 12 calendar months'
);
-- A separate statement, so its snapshot includes the sweep's deletions.
select pg_temp.assert_true(
  (
    select array_agg(id order by id)
    from public.calendar_feeds
  ) = (
    select array_agg(pg_temp.feed_id(label) order by pg_temp.feed_id(label))
    from (values
      ('fetched-after-cutoff'),
      ('fetched-in-dst-hour'),
      ('fetched-in-leap-day'),
      ('made-after-cutoff')
    ) as kept(label)
  ),
  'at a fixed clock the sweep deletes feeds idle for 12 calendar months counted in UTC, the boundary instant included, and nothing newer'
);
reset timezone;

-- No feed is made while 500 made in the past hour exist. At a fixed clock,
-- 499 feeds made 59 minutes earlier leave room for one more; the next waits
-- until they are an hour old, and a feed made exactly an hour earlier no
-- longer counts.
delete from public.calendar_feeds;
insert into public.calendar_feeds (id, secret_hash, planets, created_at)
select 'hour' || pg_catalog.lpad(n::text, 17, '0') || 'A',
  pg_temp.key_hash('hour ' || n),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  '2027-06-01 11:01:00+00'::timestamptz
from pg_catalog.generate_series(1, 499) as n;
insert into public.calendar_feeds (id, secret_hash, planets, created_at)
values (
  pg_temp.feed_id('an-hour-old'),
  pg_temp.key_hash('an hour old'),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  '2027-06-01 11:00:00+00'
);

do $$
begin
  perform public.create_calendar_feed_at(
    pg_temp.feed_id('no-time'), pg_temp.key_hash('no time'), pg_temp.planets(), null, null, null
  );
  raise exception 'a creation without a time was accepted';
exception
  when invalid_parameter_value then null;
end;
$$;
select pg_temp.assert_true(
  public.create_calendar_feed_at(
    pg_temp.feed_id('the-500th'), pg_temp.key_hash('the 500th'), pg_temp.planets(), null, null,
    '2027-06-01 12:00:00+00'
  )->>'outcome' = 'created',
  'with 499 feeds made in the last hour, and one made exactly an hour ago, a feed is made'
);
select pg_temp.assert_true(
  public.create_calendar_feed_at(
    pg_temp.feed_id('the-501st'), pg_temp.key_hash('the 501st'), pg_temp.planets(), null, null,
    '2027-06-01 12:00:00+00'
  )->>'outcome' = 'busy'
    and public.create_calendar_feed_at(
      pg_temp.feed_id('the-501st'), pg_temp.key_hash('the 501st'), pg_temp.planets(), null, null,
      '2027-06-01 12:00:59.999999+00'
    )->>'outcome' = 'busy',
  'with 500 feeds made in the last hour, the next is refused'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.calendar_feeds where id = pg_temp.feed_id('the-501st')
  )
    and (select pg_catalog.count(*) from public.calendar_feeds) = 501,
  'a refused creation writes nothing'
);
select pg_temp.assert_true(
  public.create_calendar_feed_at(
    pg_temp.feed_id('the-501st'), pg_temp.key_hash('the 501st'), pg_temp.planets(), null, null,
    '2027-06-01 12:01:00+00'
  )->>'outcome' = 'created',
  'no feed is made while 500 made in the past hour exist: once the earlier 499 are an hour old, a feed is made again'
);

-- The RPC counts with the database clock.
delete from public.calendar_feeds;
insert into public.calendar_feeds (id, secret_hash, planets, created_at)
select 'recent' || pg_catalog.lpad(n::text, 15, '0') || 'A',
  pg_temp.key_hash('recent ' || n),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  clock_timestamp() - interval '1 minute'
from pg_catalog.generate_series(1, 500) as n;
set role service_role;
select pg_temp.assert_true(
  public.create_calendar_feed(
    pg_temp.feed_id('busy-now'), pg_temp.key_hash('busy now'), pg_temp.planets(), null, null
  ) = '{"outcome": "busy"}'::jsonb,
  'the RPC answers busy while 500 feeds made in the last hour exist'
);
reset role;
select pg_temp.assert_true(
  (select pg_catalog.count(*) from public.calendar_feeds) = 500,
  'a busy RPC writes nothing'
);

-- The limit counts the feeds made in the past hour that still exist, so a
-- feed removed within its hour frees its place.
set role service_role;
select pg_temp.assert_true(
  public.revoke_calendar_feed(
    'recent' || pg_catalog.lpad('1', 15, '0') || 'A', pg_temp.key_hash('recent 1')
  )->>'outcome' = 'revoked'
    and public.create_calendar_feed(
      pg_temp.feed_id('freed-place'), pg_temp.key_hash('freed place'), pg_temp.planets(), null, null
    )->>'outcome' = 'created'
    and public.create_calendar_feed(
      pg_temp.feed_id('no-place-left'), pg_temp.key_hash('no place left'), pg_temp.planets(), null, null
    )->>'outcome' = 'busy',
  'a feed removed within its hour frees its place for one more'
);
reset role;

-- The hourly count holds only at READ COMMITTED: at REPEATABLE READ a
-- creation's snapshot predates its wait for the lock, so it would not see a
-- feed made while it waited. Every other level is refused, through the RPC
-- and at a fixed clock, before anything is counted or written.
delete from public.calendar_feeds;
begin transaction isolation level repeatable read;
do $$
begin
  perform public.create_calendar_feed_at(
    pg_temp.feed_id('repeatable'), pg_temp.key_hash('repeatable'), pg_temp.planets(), null, null,
    '2027-06-01 12:00:00+00'
  );
  raise exception 'a creation at REPEATABLE READ was accepted';
exception
  when invalid_transaction_state then null;
end;
$$;
commit;
begin transaction isolation level serializable;
do $$
begin
  perform public.create_calendar_feed_at(
    pg_temp.feed_id('serializable'), pg_temp.key_hash('serializable'), pg_temp.planets(), null, null,
    '2027-06-01 12:00:00+00'
  );
  raise exception 'a creation at SERIALIZABLE was accepted';
exception
  when invalid_transaction_state then null;
end;
$$;
commit;
begin transaction isolation level repeatable read;
set local role service_role;
do $$
begin
  perform public.create_calendar_feed(
    pg_temp.feed_id('repeatable-rpc'), pg_temp.key_hash('repeatable rpc'), pg_temp.planets(), null, null
  );
  raise exception 'an RPC creation at REPEATABLE READ was accepted';
exception
  when invalid_transaction_state then null;
end;
$$;
commit;
select pg_temp.assert_true(
  (select pg_catalog.count(*) from public.calendar_feeds) = 0,
  'a creation at REPEATABLE READ or SERIALIZABLE is refused and writes nothing'
);
begin transaction isolation level read committed;
set local role service_role;
select pg_temp.assert_true(
  public.create_calendar_feed(
    pg_temp.feed_id('read-committed'), pg_temp.key_hash('read committed'), pg_temp.planets(), null, null
  )->>'outcome' = 'created',
  'a creation at READ COMMITTED is made'
);
commit;

delete from public.calendar_feeds;

select 'calendar feed SQL contract passed' as result;
