\set ON_ERROR_STOP on

-- Independent PostgreSQL sessions prove the races between fetching, removing,
-- the retention sweep and the hourly limit on new feeds; all of this runs
-- only in the disposable test database, with synthetic ids, keys and
-- positions.
create extension if not exists dblink;

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

create or replace function pg_temp.feed_id(label text)
returns text
language sql
immutable
as $$
  select rpad(label, 21, 'x') || 'Q';
$$;

create or replace function pg_temp.key_hash(label text)
returns text
language sql
immutable
as $$
  select encode(pg_catalog.sha256(pg_catalog.convert_to(label, 'UTF8')), 'hex');
$$;

delete from public.calendar_feeds;

-- Two feeds already overdue for the sweep, and one ordinary feed.
insert into public.calendar_feeds (id, secret_hash, planets, created_at, last_fetched_at)
values
  (pg_temp.feed_id('overdue-fetched'), pg_temp.key_hash('overdue-fetched'),
   array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
   clock_timestamp() - interval '2 years', clock_timestamp() - interval '13 months'),
  (pg_temp.feed_id('overdue-removed'), pg_temp.key_hash('overdue-removed'),
   array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
   clock_timestamp() - interval '2 years', clock_timestamp() - interval '13 months'),
  (pg_temp.feed_id('ordinary'), pg_temp.key_hash('ordinary'),
   array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
   clock_timestamp() - interval '1 day', null);

select dblink_connect(
  'feeds_a',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_connect(
  'feeds_b',
  format('dbname=%L user=%L', current_database(), current_user)
);
select dblink_exec('feeds_a', 'set role service_role');
select dblink_exec('feeds_b', 'set role service_role');
select dblink_exec('feeds_a', 'set statement_timeout = ''5s''');
select dblink_exec('feeds_b', 'set statement_timeout = ''5s''');

create temporary table feed_concurrency_results (
  test text,
  outcome text
);

-- 1. A fetch in flight holds its feed: the sweep skips it rather than
-- waiting or deleting it, and once the fetch commits the feed is kept.
select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'sweep_vs_fetch', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.fetch_calendar_feed(%L)',
    pg_temp.feed_id('overdue-fetched')
  )
) as result(value jsonb);

select dblink_exec('feeds_b', 'begin');
insert into feed_concurrency_results
select 'sweep_vs_fetch', value->>'pruned'
from dblink(
  'feeds_b',
  'select public.prune_calendar_feeds(256)'
) as result(value jsonb);
select dblink_exec('feeds_b', 'commit');
select dblink_exec('feeds_a', 'commit');

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'sweep_vs_fetch') = array['1', 'ready'],
  'the sweep deletes the other overdue feed and skips the one being fetched'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.calendar_feeds
    where id = pg_temp.feed_id('overdue-fetched')
      and last_fetched_at > clock_timestamp() - interval '1 minute'
  )
    and not exists (
      select 1
      from public.calendar_feeds
      where id = pg_temp.feed_id('overdue-removed')
    ),
  'a feed fetched while the sweep ran is kept with its new fetch time'
);

select pg_temp.assert_true(
  (select value->>'pruned'
   from dblink('feeds_b', 'select public.prune_calendar_feeds(256)') as result(value jsonb)) = '0',
  'a later sweep keeps the feed its fetch renewed'
);

-- 2. A removal waits for a fetch in flight, then removes the feed.
select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'remove_vs_fetch', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.fetch_calendar_feed(%L)',
    pg_temp.feed_id('ordinary')
  )
) as result(value jsonb);

select dblink_send_query(
  'feeds_b',
  format(
    'select public.revoke_calendar_feed(%L, %L)',
    pg_temp.feed_id('ordinary'),
    pg_temp.key_hash('ordinary')
  )
);
select pg_sleep(0.2);
select pg_temp.assert_true(
  dblink_is_busy('feeds_b') = 1,
  'the removal waits behind the fetch that holds the feed'
);
select dblink_exec('feeds_a', 'commit');
insert into feed_concurrency_results
select 'remove_vs_fetch', value->>'outcome'
from dblink_get_result('feeds_b') as result(value jsonb);
-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (select 1 from dblink_get_result('feeds_b') as drained(value jsonb)),
  'the async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'remove_vs_fetch') = array['ready', 'revoked']
    and not exists (
      select 1 from public.calendar_feeds where id = pg_temp.feed_id('ordinary')
    ),
  'a removal that waited for a fetch still removes the feed'
);

-- 3. Two removals with the right key: exactly one removes the feed.
insert into public.calendar_feeds (id, secret_hash, planets)
values (
  pg_temp.feed_id('twice'),
  pg_temp.key_hash('twice'),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[]
);

select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'double_remove', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.revoke_calendar_feed(%L, %L)',
    pg_temp.feed_id('twice'),
    pg_temp.key_hash('twice')
  )
) as result(value jsonb);
select dblink_send_query(
  'feeds_b',
  format(
    'select public.revoke_calendar_feed(%L, %L)',
    pg_temp.feed_id('twice'),
    pg_temp.key_hash('twice')
  )
);
select pg_sleep(0.2);
select pg_temp.assert_true(
  dblink_is_busy('feeds_b') = 1,
  'the second removal waits for the first'
);
select dblink_exec('feeds_a', 'commit');
insert into feed_concurrency_results
select 'double_remove', value->>'outcome'
from dblink_get_result('feeds_b') as result(value jsonb);
-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (select 1 from dblink_get_result('feeds_b') as drained(value jsonb)),
  'the async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'double_remove') = array['not_found', 'revoked'],
  'two removals with the same key remove the feed once'
);

-- 4. Two creations with the same id: one feed, one conflict.
select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'same_id', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.create_calendar_feed(%L, %L, %L::jsonb, null, null)',
    pg_temp.feed_id('same'),
    pg_temp.key_hash('same a'),
    '[1,2,3,4,5,6,7,8,9,10]'
  )
) as result(value jsonb);
select dblink_send_query(
  'feeds_b',
  format(
    'select public.create_calendar_feed(%L, %L, %L::jsonb, 10, 20)',
    pg_temp.feed_id('same'),
    pg_temp.key_hash('same b'),
    '[1,2,3,4,5,6,7,8,9,10]'
  )
);
select pg_sleep(0.2);
select dblink_exec('feeds_a', 'commit');
insert into feed_concurrency_results
select 'same_id', value->>'outcome'
from dblink_get_result('feeds_b') as result(value jsonb);
-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (select 1 from dblink_get_result('feeds_b') as drained(value jsonb)),
  'the async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'same_id') = array['created', 'id_conflict']
    and (
      select secret_hash = pg_temp.key_hash('same a') and ascendant is null
      from public.calendar_feeds
      where id = pg_temp.feed_id('same')
    ),
  'a racing creation with a used id never replaces the first feed'
);

-- 5. Two creations racing for the last of the hour's 500 places: the second
-- waits for the first, then counts its feed and is refused.
delete from public.calendar_feeds;
insert into public.calendar_feeds (id, secret_hash, planets, created_at)
select 'race' || pg_catalog.lpad(n::text, 17, '0') || 'Q',
  pg_temp.key_hash('race ' || n),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  clock_timestamp() - interval '1 minute'
from pg_catalog.generate_series(1, 499) as n;

select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'last_place', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.create_calendar_feed(%L, %L, %L::jsonb, null, null)',
    pg_temp.feed_id('last-a'),
    pg_temp.key_hash('last a'),
    '[1,2,3,4,5,6,7,8,9,10]'
  )
) as result(value jsonb);
select dblink_send_query(
  'feeds_b',
  format(
    'select public.create_calendar_feed(%L, %L, %L::jsonb, null, null)',
    pg_temp.feed_id('last-b'),
    pg_temp.key_hash('last b'),
    '[1,2,3,4,5,6,7,8,9,10]'
  )
);
select pg_sleep(0.2);
select pg_temp.assert_true(
  dblink_is_busy('feeds_b') = 1,
  'a creation waits while another is being made'
);
select dblink_exec('feeds_a', 'commit');
insert into feed_concurrency_results
select 'last_place', value->>'outcome'
from dblink_get_result('feeds_b') as result(value jsonb);
-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (select 1 from dblink_get_result('feeds_b') as drained(value jsonb)),
  'the async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'last_place') = array['busy', 'created']
    and (select pg_catalog.count(*) from public.calendar_feeds) = 500
    and exists (select 1 from public.calendar_feeds where id = pg_temp.feed_id('last-a')),
  'two creations racing for the last place in the hour make one feed'
);

-- 6. The RPC reads the clock only once it holds the lock, so feeds are
-- stamped in the order the limit counted them: a creation that waited for
-- another is stamped after the other finished, not when it was asked for.
delete from public.calendar_feeds;
create temporary table feed_lock_released (released timestamptz);

select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'stamped_after_wait', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.create_calendar_feed(%L, %L, %L::jsonb, null, null)',
    pg_temp.feed_id('first-in-line'),
    pg_temp.key_hash('first in line'),
    '[1,2,3,4,5,6,7,8,9,10]'
  )
) as result(value jsonb);
select dblink_send_query(
  'feeds_b',
  format(
    'select public.create_calendar_feed(%L, %L, %L::jsonb, null, null)',
    pg_temp.feed_id('waited-in-line'),
    pg_temp.key_hash('waited in line'),
    '[1,2,3,4,5,6,7,8,9,10]'
  )
);
select pg_sleep(0.3);
select pg_temp.assert_true(
  dblink_is_busy('feeds_b') = 1,
  'a second creation waits for the lock the first holds'
);
insert into feed_lock_released values (clock_timestamp());
select dblink_exec('feeds_a', 'commit');
insert into feed_concurrency_results
select 'stamped_after_wait', value->>'outcome'
from dblink_get_result('feeds_b') as result(value jsonb);
-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (select 1 from dblink_get_result('feeds_b') as drained(value jsonb)),
  'the async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'stamped_after_wait') = array['created', 'created']
    and (select created_at from public.calendar_feeds where id = pg_temp.feed_id('waited-in-line'))
      >= (select released from feed_lock_released),
  'the RPC reads the clock once it holds the lock, so a creation that waited is stamped after the one it waited for'
);

-- 7. The fixed-clock function takes the lock itself, so two owner callers
-- racing at one instant for the last place in the hour make one feed.
delete from public.calendar_feeds;
insert into public.calendar_feeds (id, secret_hash, planets, created_at)
select 'fixed' || pg_catalog.lpad(n::text, 16, '0') || 'Q',
  pg_temp.key_hash('fixed ' || n),
  array[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]::numeric(6,3)[],
  '2027-06-01 11:30:00+00'::timestamptz
from pg_catalog.generate_series(1, 499) as n;
select dblink_exec('feeds_a', 'reset role');
select dblink_exec('feeds_b', 'reset role');

select dblink_exec('feeds_a', 'begin');
insert into feed_concurrency_results
select 'fixed_clock_last_place', value->>'outcome'
from dblink(
  'feeds_a',
  format(
    'select public.create_calendar_feed_at(%L, %L, %L::jsonb, null, null, %L)',
    pg_temp.feed_id('fixed-a'),
    pg_temp.key_hash('fixed a'),
    '[1,2,3,4,5,6,7,8,9,10]',
    '2027-06-01 12:00:00+00'
  )
) as result(value jsonb);
select dblink_send_query(
  'feeds_b',
  format(
    'select public.create_calendar_feed_at(%L, %L, %L::jsonb, null, null, %L)',
    pg_temp.feed_id('fixed-b'),
    pg_temp.key_hash('fixed b'),
    '[1,2,3,4,5,6,7,8,9,10]',
    '2027-06-01 12:00:00+00'
  )
);
select pg_sleep(0.2);
select pg_temp.assert_true(
  dblink_is_busy('feeds_b') = 1,
  'a creation at a fixed clock waits while another is being made'
);
select dblink_exec('feeds_a', 'commit');
insert into feed_concurrency_results
select 'fixed_clock_last_place', value->>'outcome'
from dblink_get_result('feeds_b') as result(value jsonb);
-- libpq keeps an async dblink connection busy until one final empty result is
-- consumed after the query result.
select pg_temp.assert_true(
  not exists (select 1 from dblink_get_result('feeds_b') as drained(value jsonb)),
  'the async result must be fully drained'
);

select pg_temp.assert_true(
  (select array_agg(outcome order by outcome)
   from feed_concurrency_results
   where test = 'fixed_clock_last_place') = array['busy', 'created']
    and (select pg_catalog.count(*) from public.calendar_feeds) = 500,
  'two creations at a fixed clock racing for the last place in the hour make one feed'
);

select dblink_disconnect('feeds_a');
select dblink_disconnect('feeds_b');

delete from public.calendar_feeds;

select 'calendar feed SQL concurrency passed' as result;
