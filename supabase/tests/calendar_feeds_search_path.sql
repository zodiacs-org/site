\set ON_ERROR_STOP on

-- The feed RPCs run as the table's owner, so nothing a caller makes may stand
-- in for a name they use. This file runs in its own session, before any feed
-- function has run in it. As service_role, the only role allowed to call the
-- RPCs, it makes temporary types named like the ones the functions declare
-- (text, bytea, jsonb, timestamptz) and a temporary table named like theirs.
-- Each decoy type's check raises, so a function that looked a name up in the
-- caller's temporary schema before pg_catalog would fail here. The values are
-- synthetic.

set role service_role;

create function pg_temp.decoy_reached(what pg_catalog.text)
returns pg_catalog.bool
language plpgsql
as $$
begin
  raise exception 'a feed function used the caller''s temporary %', what;
end;
$$;

create domain pg_temp.text as pg_catalog.text
  check (pg_temp.decoy_reached('text'));
create domain pg_temp.bytea as pg_catalog.bytea
  check (pg_temp.decoy_reached('bytea'));
create domain pg_temp.jsonb as pg_catalog.jsonb
  check (pg_temp.decoy_reached('jsonb'));
create domain pg_temp.timestamptz as pg_catalog.timestamptz
  check (pg_temp.decoy_reached('timestamptz'));
create table pg_temp.calendar_feeds (id pg_catalog.text);

create function pg_temp.assert_true(ok pg_catalog.bool, message pg_catalog.text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.assert_true(
  public.create_calendar_feed(
    pg_catalog.rpad('searchpath', 21, 'x') || 'A',
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('search path key', 'UTF8')), 'hex'),
    pg_catalog.jsonb_build_array(15.5, 45.25, 75.125, 105, 135.001, 165.999, 195, 225, 255, 359.999),
    100,
    190
  )->>'outcome' = 'created',
  'a feed is made while the caller has decoys in its temporary schema'
);

select pg_temp.assert_true(
  public.fetch_calendar_feed(pg_catalog.rpad('searchpath', 21, 'x') || 'A')->>'outcome' = 'ready',
  'the feed is fetched while the caller has decoys in its temporary schema'
);

select pg_temp.assert_true(
  public.revoke_calendar_feed(
    pg_catalog.rpad('searchpath', 21, 'x') || 'A',
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to('search path key', 'UTF8')), 'hex')
  )->>'outcome' = 'revoked',
  'the feed is removed while the caller has decoys in its temporary schema'
);

select pg_temp.assert_true(
  public.prune_calendar_feeds(256)->>'pruned' = '0',
  'the sweep runs while the caller has decoys in its temporary schema'
);

select pg_temp.assert_true(
  not exists (select 1 from pg_temp.calendar_feeds),
  'nothing was written to the caller''s decoy table'
);

reset role;

select pg_temp.assert_true(
  not exists (select 1 from public.calendar_feeds),
  'the feed made here is gone'
);

select 'calendar feed search path test passed' as result;
