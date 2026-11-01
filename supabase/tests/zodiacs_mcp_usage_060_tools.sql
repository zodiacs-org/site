-- Disposable PostgreSQL only. Runs after zodiacs_mcp_usage_save_tool.sql and the
-- 0.6.0 tools migration (applied twice, as a reviewed SQL Editor replay would).
\set ON_ERROR_STOP on
create function pg_temp.assert_060_usage(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'MCP 0.6.0 usage assertion: %', message; end if; end; $$;
create temporary table usage_060_before as select day, scope, tool, host, calls from zodiacs_mcp_private.usage_daily;

select pg_temp.assert_060_usage(not has_function_privilege('anon', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'anonymous RPC still denied');
select pg_temp.assert_060_usage(not has_function_privilege('authenticated', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'authenticated RPC still denied');
select pg_temp.assert_060_usage(has_function_privilege('service_role', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'service role may still count');
select pg_temp.assert_060_usage((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.zodiacs_mcp_usage_count_v1(text,text,text)'::regprocedure), 'RPC stays security invoker with an empty search path');
select pg_temp.assert_060_usage((select count(*) = 1 from pg_constraint
  where conrelid = 'zodiacs_mcp_private.usage_daily'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tool = ANY%'), 'one tool check after two replays');
select pg_temp.assert_060_usage((select array_agg(attname::text order by attnum) = array['day', 'scope', 'tool', 'host', 'calls']
  from pg_attribute where attrelid = 'zodiacs_mcp_private.usage_daily'::regclass and attnum > 0 and not attisdropped), 'still only day, scope, tool, host family and count columns');

begin;
set local role service_role;
select public.zodiacs_mcp_usage_count_v1('production', 'get_natal_chart', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('production', 'get_natal_chart', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('production', 'get_horoscope_period', 'claude');
select public.zodiacs_mcp_usage_count_v1('preview', 'get_chinese_zodiac', 'other');
select public.zodiacs_mcp_usage_count_v1('production', 'get_personal_transits', 'claude');
select public.zodiacs_mcp_usage_count_v1('production', 'explain_astrology', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('production', 'save_to_zodiacs', 'claude');
commit;
select pg_temp.assert_060_usage((select calls = 2 from zodiacs_mcp_private.usage_daily where scope = 'production' and tool = 'get_natal_chart' and host = 'chatgpt'), 'a 0.6.0 tool counted twice on one row');
select pg_temp.assert_060_usage((select count(distinct tool) = 6 from zodiacs_mcp_private.usage_daily where tool in ('get_natal_chart', 'get_horoscope_period', 'get_chinese_zodiac', 'get_personal_transits', 'explain_astrology', 'save_to_zodiacs')), 'all five new names count, and the save tool still does');
do $$ begin
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'get_tarot_reading', 'claude'); raise exception 'unknown tool accepted';
  exception when invalid_parameter_value then null; end;
end; $$;
select pg_temp.assert_060_usage((select count(*) = 0 from (
  select day, scope, tool, host, calls from usage_060_before
  except select day, scope, tool, host, calls from zodiacs_mcp_private.usage_daily) changed), 'earlier rows unchanged');
select 'MCP 0.6.0 usage SQL passed: replayable widening, the five new tools counted, unknown names refused, earlier rows kept' as result;
