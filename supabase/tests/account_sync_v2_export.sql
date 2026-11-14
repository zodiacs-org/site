\set ON_ERROR_STOP on

-- Run after migration 20261113090000. Covers the account export's read of the
-- later tables, public.account_v2_export_later_tables: service-only
-- privileges, account isolation, the limit plus one rows each list stops at,
-- and both schema shapes. CI runs it on the full schema (Living Chart and the
-- assistant save columns present). It also runs on a database shaped like
-- production on 13 Nov 2026 (no Living Chart, saved_pages without source,
-- summary and detail): the Living Chart parts then check for an empty list
-- and site saves are checked for the column defaults. All people and rows are
-- synthetic test data.

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

create or replace function pg_temp.export_moment_payload(candidate_chart_id uuid)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'schema', 'zodiacs.living-chart.cloud-moment.v1',
    'primaryChartId', candidate_chart_id,
    'occurredAt', '2026-08-18T09:00:00.000Z',
    'timePrecision', 'exact',
    'category', 'relationships',
    'note', 'A test note.',
    'forecast', jsonb_build_object(
      'schema', 'zodiacs.living-chart.today-forecast.v1',
      'editionDate', '2026-08-18',
      'chartId', candidate_chart_id,
      'source', 'personalized',
      'generatorVersion', 'today-1.0.0',
      'capturedAt', '2026-08-18T08:00:00.000Z',
      'lines', jsonb_build_array(jsonb_build_object(
        'id', 'transit:mars-moon',
        'text', 'Make room before answering too quickly.',
        'receipt', 'Mars 14.2 degrees Cancer square natal Moon.'
      ))
    ),
    'reflectionQuestionId', 'reflection:notice'
  );
$$;

create temporary table export_shape (
  living_chart boolean not null,
  assistant_columns boolean not null
);
insert into export_shape
select
  pg_catalog.to_regclass('public.living_chart_moments') is not null,
  (
    select count(*) = 3
    from pg_catalog.pg_attribute
    where attrelid = 'public.saved_pages'::regclass
      and attname in ('source', 'summary', 'detail')
      and attnum > 0
      and not attisdropped
  );
grant select on export_shape to service_role, authenticated, anon;

create temporary table export_results (
  key text primary key,
  value jsonb not null
);
grant select, insert on export_results to service_role, authenticated, anon;

-- 1. Privileges ----------------------------------------------------------------

select pg_temp.assert_true(
  not exists (
    select 1
    from (values
      ('public.account_v2_export_later_tables(uuid)'),
      ('private.account_v2_export_later_tables(uuid)')
    ) as fn(signature)
    where has_function_privilege('anon', fn.signature, 'execute')
       or has_function_privilege('authenticated', fn.signature, 'execute')
       or has_function_privilege('public', fn.signature, 'execute')
       or not has_function_privilege('service_role', fn.signature, 'execute')
  )
    and (select prosecdef from pg_catalog.pg_proc
         where oid = 'private.account_v2_export_later_tables(uuid)'::regprocedure)
    and not (select prosecdef from pg_catalog.pg_proc
             where oid = 'public.account_v2_export_later_tables(uuid)'::regprocedure),
  'the export of the later tables must be service only, definer behind an invoker wrapper'
);

set role anon;
do $$
begin
  perform public.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000001');
  raise exception 'anon read an account export';
exception
  when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform private.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000001');
  raise exception 'anon read an account export through the private helper';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000001', false);
select set_config(
  'request.jwt.claims',
  '{"sub":"e1000000-0000-4000-8000-000000000001","is_anonymous":false}',
  false
);
do $$
begin
  perform public.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000001');
  raise exception 'a signed-in caller read an account export directly';
exception
  when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform private.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000001');
  raise exception 'a signed-in caller read an account export through the private helper';
exception
  when insufficient_privilege then null;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claims', '', false);

-- 2. Fixtures ------------------------------------------------------------------
-- A and B each have saves (and moments where Living Chart exists); C is the
-- account over the limits; D has nothing.

insert into auth.users (id) values
  ('e1000000-0000-4000-8000-000000000001'),
  ('e1000000-0000-4000-8000-000000000002'),
  ('e1000000-0000-4000-8000-000000000003'),
  ('e1000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

insert into public.saved_pages (id, user_id, kind, title, href, saved_at) values
  ('e2000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000001',
   'occasion', 'Export test A first', '/occasions/export-test-a-1/',
   '2026-11-01T10:00:00Z'),
  ('e2000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001',
   'compatibility', 'Export test A second', '/compatibility/aries-and-libra/',
   '2026-11-02T10:00:00Z'),
  ('e2000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000002',
   'occasion', 'Export test B', '/occasions/export-test-b/',
   '2026-11-01T09:00:00Z');

-- Where the assistant columns exist, A also has an assistant save, the last
-- in time order.
do $$
begin
  if (select assistant_columns from export_shape) then
    execute $insert$
      insert into public.saved_pages (
        id, user_id, kind, title, href, source, summary, detail, saved_at
      ) values (
        'e2000000-0000-4000-8000-000000000004',
        'e1000000-0000-4000-8000-000000000001',
        'occasion',
        'Export test A assistant',
        '/occasions/export-test-a-assistant/',
        'assistant',
        'A short summary.',
        '{"schema":"zodiacs.assistant-save.v1","note":"export test"}'::jsonb,
        '2026-11-03T10:00:00Z'
      )
    $insert$;
  end if;
end;
$$;

-- C: 105 saves, past the 100 save limit the table's own trigger keeps. The
-- export must still stop at 101 so the API can refuse the account.
alter table public.saved_pages disable trigger saved_pages_limit;
insert into public.saved_pages (id, user_id, kind, title, href, saved_at)
select
  ('e3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  'e1000000-0000-4000-8000-000000000003',
  'occasion',
  'Export limit ' || n,
  '/occasions/export-limit-' || n || '/',
  timestamptz '2026-10-01T00:00:00Z' + make_interval(mins => n)
from generate_series(1, 105) as n;
alter table public.saved_pages enable trigger saved_pages_limit;

select pg_temp.assert_true(
  (select count(*) from public.saved_pages
   where user_id = 'e1000000-0000-4000-8000-000000000003') = 105,
  'the limit fixture must hold 105 saves'
);

do $$
begin
  if not (select living_chart from export_shape) then
    return;
  end if;

  insert into public.living_chart_moments (
    user_id, moment_id, consent_epoch, revision, payload, created_at, updated_at, deleted_at
  ) values
    ('e1000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 1, 1,
     pg_temp.export_moment_payload('e5000000-0000-4000-8000-000000000001'),
     '2026-11-01T10:00:00Z', '2026-11-01T10:00:00Z', null),
    ('e1000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002', 1, 2,
     null, '2026-11-02T10:00:00Z', '2026-11-02T11:00:00Z', '2026-11-02T11:00:00Z'),
    ('e1000000-0000-4000-8000-000000000002', 'e4000000-0000-4000-8000-000000000003', 1, 1,
     pg_temp.export_moment_payload('e5000000-0000-4000-8000-000000000002'),
     '2026-11-01T09:00:00Z', '2026-11-01T09:00:00Z', null);

  -- C: 1,005 moments, past the 1,000 moment limit the write RPC keeps.
  insert into public.living_chart_moments (
    user_id, moment_id, consent_epoch, revision, payload, created_at, updated_at, deleted_at
  )
  select
    'e1000000-0000-4000-8000-000000000003',
    ('e6000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    1,
    1,
    pg_temp.export_moment_payload('e5000000-0000-4000-8000-000000000003'),
    timestamptz '2026-10-01T00:00:00Z' + make_interval(mins => n),
    timestamptz '2026-10-01T00:00:00Z' + make_interval(mins => n),
    null
  from generate_series(1, 1005) as n;
end;
$$;

-- 3. Read as the service role ---------------------------------------------------

set role service_role;
insert into export_results (key, value) values
  ('a', public.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000001')),
  ('b', public.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000002')),
  ('c', public.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000003')),
  ('d', public.account_v2_export_later_tables('e1000000-0000-4000-8000-000000000004')),
  ('missing', public.account_v2_export_later_tables('e1000000-0000-4000-8000-0000000000ff')),
  ('null', public.account_v2_export_later_tables(null));
reset role;

-- 4. Answers -------------------------------------------------------------------

select pg_temp.assert_true(
  (select value from export_results where key = 'null') = '{"outcome":"invalid"}'::jsonb,
  'a missing account id must answer invalid and nothing else'
);

select pg_temp.assert_true(
  (select bool_and(
     (select array_agg(k order by k) from jsonb_object_keys(value) as k)
       = array['living_chart_moments', 'outcome', 'saved_pages']
     and value->>'outcome' = 'ready'
     and jsonb_typeof(value->'saved_pages') = 'array'
     and jsonb_typeof(value->'living_chart_moments') = 'array')
   from export_results where key <> 'null'),
  'every answer for an account must be ready with exactly the two lists'
);

select pg_temp.assert_true(
  (select value from export_results where key = 'd')
    = '{"outcome":"ready","saved_pages":[],"living_chart_moments":[]}'::jsonb
  and (select value from export_results where key = 'missing')
    = '{"outcome":"ready","saved_pages":[],"living_chart_moments":[]}'::jsonb,
  'an account with nothing saved, or no account, must export two empty lists'
);

-- Isolation: each export holds exactly its own account's rows.
select pg_temp.assert_true(
  (select array_agg(row_value->>'id' order by ordinal)
   from export_results,
     jsonb_array_elements(value->'saved_pages') with ordinality as listed(row_value, ordinal)
   where key = 'a')
  = case when (select assistant_columns from export_shape)
      then array[
        'e2000000-0000-4000-8000-000000000001',
        'e2000000-0000-4000-8000-000000000002',
        'e2000000-0000-4000-8000-000000000004']
      else array[
        'e2000000-0000-4000-8000-000000000001',
        'e2000000-0000-4000-8000-000000000002']
    end,
  'account A must export its own saves in time order and no one else''s'
);

select pg_temp.assert_true(
  (select array_agg(row_value->>'id')
   from export_results,
     jsonb_array_elements(value->'saved_pages') as listed(row_value)
   where key = 'b')
  = array['e2000000-0000-4000-8000-000000000003'],
  'account B must export only its own save'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from export_results,
      jsonb_array_elements(value->'saved_pages') as listed(row_value)
    join public.saved_pages page on page.id = (listed.row_value->>'id')::uuid
    where export_results.key in ('a', 'b', 'c')
      and page.user_id <> case export_results.key
        when 'a' then 'e1000000-0000-4000-8000-000000000001'::uuid
        when 'b' then 'e1000000-0000-4000-8000-000000000002'::uuid
        else 'e1000000-0000-4000-8000-000000000003'::uuid
      end
  ),
  'no export may list a save of another account'
);

-- Saved page rows carry exactly the eight exported keys, and never user_id.
select pg_temp.assert_true(
  (select bool_and(
     (select array_agg(k order by k) from jsonb_object_keys(row_value) as k)
       = array['detail', 'href', 'id', 'kind', 'saved_at', 'source', 'summary', 'title'])
   from export_results,
     jsonb_array_elements(value->'saved_pages') as listed(row_value)
   where key in ('a', 'b', 'c')),
  'each exported save must carry exactly the eight exported keys'
);

-- Site saves read as the column defaults on either shape; the assistant save
-- keeps its columns where they exist.
select pg_temp.assert_true(
  (select bool_and(
     row_value->>'source' = 'site'
     and row_value->'summary' = 'null'::jsonb
     and row_value->'detail' = 'null'::jsonb)
   from export_results,
     jsonb_array_elements(value->'saved_pages') as listed(row_value)
   where key in ('a', 'b', 'c')
     and row_value->>'id' <> 'e2000000-0000-4000-8000-000000000004'),
  'site saves must export source site with no summary or detail'
);

select pg_temp.assert_true(
  not (select assistant_columns from export_shape)
  or (
    select row_value->>'source' = 'assistant'
      and row_value->>'summary' = 'A short summary.'
      and row_value->'detail' = '{"schema":"zodiacs.assistant-save.v1","note":"export test"}'::jsonb
    from export_results,
      jsonb_array_elements(value->'saved_pages') as listed(row_value)
    where key = 'a'
      and row_value->>'id' = 'e2000000-0000-4000-8000-000000000004'
  ),
  'the assistant save must export its source, summary and detail'
);

-- Limit plus one: 105 saves export as the first 101 in time order.
select pg_temp.assert_true(
  (select jsonb_array_length(value->'saved_pages') from export_results where key = 'c') = 101
  and (select value->'saved_pages'->0->>'id' from export_results where key = 'c')
    = 'e3000000-0000-4000-8000-000000000001'
  and (select value->'saved_pages'->100->>'id' from export_results where key = 'c')
    = 'e3000000-0000-4000-8000-000000000101',
  'an account over the save limit must export exactly 101 saves, the oldest first'
);

-- Living Chart moments.
select pg_temp.assert_true(
  (select living_chart from export_shape)
  or (
    select bool_and(value->'living_chart_moments' = '[]'::jsonb)
    from export_results where key <> 'null'
  ),
  'without Living Chart every export must list no moments'
);

select pg_temp.assert_true(
  not (select living_chart from export_shape)
  or (
    (select array_agg(row_value->>'moment_id' order by ordinal)
     from export_results,
       jsonb_array_elements(value->'living_chart_moments') with ordinality as listed(row_value, ordinal)
     where key = 'a')
      = array['e4000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000002']
    and (select array_agg(row_value->>'moment_id')
         from export_results,
           jsonb_array_elements(value->'living_chart_moments') as listed(row_value)
         where key = 'b')
      = array['e4000000-0000-4000-8000-000000000003']
    and (select bool_and(
           (select array_agg(k order by k) from jsonb_object_keys(row_value) as k)
             = array['consent_epoch', 'created_at', 'deleted_at', 'moment_id',
                     'payload', 'revision', 'updated_at'])
         from export_results,
           jsonb_array_elements(value->'living_chart_moments') as listed(row_value)
         where key in ('a', 'b'))
    and (select row_value->'payload' = 'null'::jsonb and row_value->'deleted_at' <> 'null'::jsonb
         from export_results,
           jsonb_array_elements(value->'living_chart_moments') as listed(row_value)
         where key = 'a'
           and row_value->>'moment_id' = 'e4000000-0000-4000-8000-000000000002')
    and (select row_value->'payload'->>'primaryChartId' = 'e5000000-0000-4000-8000-000000000001'
         from export_results,
           jsonb_array_elements(value->'living_chart_moments') as listed(row_value)
         where key = 'a'
           and row_value->>'moment_id' = 'e4000000-0000-4000-8000-000000000001')
  ),
  'each account must export only its own moments, tombstones included, with the seven keys'
);

select pg_temp.assert_true(
  not (select living_chart from export_shape)
  or (
    (select jsonb_array_length(value->'living_chart_moments') from export_results where key = 'c') = 1001
    and (select value->'living_chart_moments'->0->>'moment_id' from export_results where key = 'c')
      = 'e6000000-0000-4000-8000-000000000001'
    and (select value->'living_chart_moments'->1000->>'moment_id' from export_results where key = 'c')
      = 'e6000000-0000-4000-8000-000000001001'
  ),
  'an account over the moment limit must export exactly 1,001 moments, the oldest first'
);

-- 5. Clean up --------------------------------------------------------------------

delete from auth.users
where id in (
  'e1000000-0000-4000-8000-000000000001',
  'e1000000-0000-4000-8000-000000000002',
  'e1000000-0000-4000-8000-000000000003',
  'e1000000-0000-4000-8000-000000000004'
);

select pg_temp.assert_true(
  not exists (select 1 from public.saved_pages
              where user_id::text like 'e1000000-0000-4000-8000-00000000000_'),
  'the export fixtures must be gone'
);

select
  case when (select living_chart from export_shape) then 'full' else 'production' end
    || ' shape: account export of the later tables tests passed' as result;
