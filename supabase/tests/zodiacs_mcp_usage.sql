-- Disposable PostgreSQL only. Concurrent backends, not a mocked counter.
\set ON_ERROR_STOP on
create extension if not exists dblink;
create function pg_temp.assert_usage(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'MCP usage assertion: %', message; end if; end; $$;
select pg_temp.assert_usage(not has_function_privilege('public', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'PUBLIC RPC denied');
select pg_temp.assert_usage(not has_function_privilege('anon', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'anonymous RPC denied');
select pg_temp.assert_usage(not has_function_privilege('authenticated', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'authenticated RPC denied');
select pg_temp.assert_usage(has_function_privilege('service_role', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'service role may count');
select pg_temp.assert_usage(not has_schema_privilege('anon', 'zodiacs_mcp_private', 'usage'), 'anonymous schema denied');
select pg_temp.assert_usage(not has_schema_privilege('authenticated', 'zodiacs_mcp_private', 'usage'), 'authenticated schema denied');
select pg_temp.assert_usage(not has_table_privilege('anon', 'zodiacs_mcp_private.usage_daily', 'select'), 'anonymous read denied');
select pg_temp.assert_usage(not has_table_privilege('authenticated', 'zodiacs_mcp_private.usage_daily', 'select'), 'authenticated read denied');
select pg_temp.assert_usage(not has_table_privilege('service_role', 'zodiacs_mcp_private.usage_daily', 'delete'), 'service role cannot delete counts');
select pg_temp.assert_usage((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.zodiacs_mcp_usage_count_v1(text,text,text)'::regprocedure), 'RPC is security invoker with an empty search path');
select pg_temp.assert_usage((select relrowsecurity from pg_class where oid = 'zodiacs_mcp_private.usage_daily'::regclass), 'RLS enabled');
select pg_temp.assert_usage((select array_agg(attname::text order by attnum) = array['day', 'scope', 'tool', 'host', 'calls']
  from pg_attribute where attrelid = 'zodiacs_mcp_private.usage_daily'::regclass and attnum > 0 and not attisdropped), 'only day, scope, tool, host family and count columns');

do $$ begin
  begin perform public.zodiacs_mcp_usage_count_v1('caller-supplied', 'get_sky', 'claude'); raise exception 'scope accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'search_zodiacs', 'claude'); raise exception 'unknown tool accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'get_sky', 'Mozilla/5.0 (synthetic-agent)'); raise exception 'raw user agent accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_usage_count_v1(null, 'get_sky', 'other'); raise exception 'null scope accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_usage_count_v1('preview', null, 'other'); raise exception 'null tool accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'get_sky', null); raise exception 'null host accepted';
  exception when invalid_parameter_value then null; end;
  -- The table itself refuses free text and empty counts, even from a writer that bypasses the RPC.
  begin insert into zodiacs_mcp_private.usage_daily values (current_date, 'preview', 'get_sky', 'synthetic-agent/1.0', 1); raise exception 'free-text host stored';
  exception when check_violation then null; end;
  begin insert into zodiacs_mcp_private.usage_daily values (current_date, 'preview', 'get_sky', 'other', 0); raise exception 'empty count stored';
  exception when check_violation then null; end;
end; $$;
select pg_temp.assert_usage((select count(*) = 0 from zodiacs_mcp_private.usage_daily), 'refused calls leave no row');

-- Browser roles cannot count even when they call the RPC directly.
begin;
set local role anon;
do $$ begin
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'get_sky', 'other'); raise exception 'anonymous call counted';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;
begin;
set local role authenticated;
do $$ begin
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'get_sky', 'other'); raise exception 'authenticated call counted';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;

-- Hold the table until every contender is sent, so all backends race for one row.
begin;
lock table zodiacs_mcp_private.usage_daily in access exclusive mode;
do $$ declare i integer; name text; begin
  for i in 1..48 loop
    name := 'usage_' || i;
    perform dblink_connect(name, format('host=127.0.0.1 port=%s dbname=%L user=%L', current_setting('port'), current_database(), current_user));
    perform dblink_exec(name, 'set role service_role');
    perform dblink_exec(name, 'set statement_timeout = ''15s''');
    perform dblink_send_query(name, 'select public.zodiacs_mcp_usage_count_v1(''preview'', ''get_sky'', ''chatgpt'')');
  end loop;
end; $$;
select pg_sleep(0.05);
select pg_temp.assert_usage((select bool_and(dblink_is_busy('usage_' || i) = 1) from generate_series(1,48) i), 'all 48 backends blocked before release');
commit;
do $$ declare i integer; begin
  for i in 1..48 loop
    perform * from dblink_get_result('usage_' || i) as r(result text);
    perform * from dblink_get_result('usage_' || i) as r(result text);
  end loop;
end; $$;
select pg_temp.assert_usage((select calls = 48 from zodiacs_mcp_private.usage_daily where scope = 'preview' and tool = 'get_sky' and host = 'chatgpt'), 'all 48 concurrent calls counted on one row, none lost');

-- Mixed contention: each scope and host family keeps its own row.
begin;
lock table zodiacs_mcp_private.usage_daily in access exclusive mode;
do $$ declare i integer; begin
  for i in 1..48 loop
    perform dblink_send_query('usage_' || i, format('select public.zodiacs_mcp_usage_count_v1(%L, ''get_horoscope'', %L)',
      (array['preview', 'production'])[i % 2 + 1], (array['chatgpt', 'claude', 'other'])[i % 3 + 1]));
  end loop;
end; $$;
commit;
do $$ declare i integer; begin
  for i in 1..48 loop
    perform * from dblink_get_result('usage_' || i) as r(result text);
    perform * from dblink_get_result('usage_' || i) as r(result text);
    perform dblink_disconnect('usage_' || i);
  end loop;
end; $$;
select pg_temp.assert_usage((select count(*) = 6 and bool_and(calls = 8) from zodiacs_mcp_private.usage_daily where tool = 'get_horoscope'), 'six independent scope and host rows of eight calls each');

-- The day comes from the database clock in UTC, whatever the session time zone.
-- At any instant at least one of UTC+14 and UTC-12 has a different local date.
create temporary table usage_clock as select (clock_timestamp() at time zone 'UTC')::date as first_day;
set time zone 'Pacific/Kiritimati';
select public.zodiacs_mcp_usage_count_v1('production', 'open_chart_studio', 'other');
set time zone 'Etc/GMT+12';
select public.zodiacs_mcp_usage_count_v1('production', 'open_chart_studio', 'other');
reset time zone;
select pg_temp.assert_usage((select count(*) = 1 and bool_and(calls = 2 and day between (select first_day from usage_clock) and (clock_timestamp() at time zone 'UTC')::date)
  from zodiacs_mcp_private.usage_daily where scope = 'production' and tool = 'open_chart_studio'), 'both calls land on the UTC date');
update zodiacs_mcp_private.usage_daily set day = day - 1 where scope = 'production' and tool = 'open_chart_studio';
select public.zodiacs_mcp_usage_count_v1('production', 'open_chart_studio', 'other');
select pg_temp.assert_usage((select count(*) = 2 and sum(calls) = 3 and bool_or(calls = 1 and day = (clock_timestamp() at time zone 'UTC')::date)
  from zodiacs_mcp_private.usage_daily where scope = 'production' and tool = 'open_chart_studio'), 'a new day starts a new row and leaves earlier days unchanged');

begin;
set local role service_role;
select public.zodiacs_mcp_usage_count_v1('preview', 'get_sky', 'chatgpt');
rollback;
select pg_temp.assert_usage((select calls = 48 from zodiacs_mcp_private.usage_daily where scope = 'preview' and tool = 'get_sky' and host = 'chatgpt'), 'aborted count rolls back');
select pg_temp.assert_usage((select count(*) = 9 from zodiacs_mcp_private.usage_daily), 'one bounded row per day, scope, tool and host family; no caller rows');
select 'MCP usage SQL passed: permissions, input refusal, 96 concurrent backends without lost counts, UTC day, rollover and rollback' as result;
