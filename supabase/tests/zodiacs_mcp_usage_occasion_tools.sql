-- Disposable PostgreSQL only. Runs after zodiacs_mcp_usage.sql and the occasion-tools
-- migration (applied twice, as a reviewed SQL Editor replay would).
\set ON_ERROR_STOP on
create function pg_temp.assert_occasion_usage(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'MCP occasion usage assertion: %', message; end if; end; $$;
create temporary table occasion_usage_before as select day, scope, tool, host, calls from zodiacs_mcp_private.usage_daily;

-- Permissions and shape are unchanged by the replacement.
select pg_temp.assert_occasion_usage(not has_function_privilege('anon', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'anonymous RPC still denied');
select pg_temp.assert_occasion_usage(not has_function_privilege('authenticated', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'authenticated RPC still denied');
select pg_temp.assert_occasion_usage(has_function_privilege('service_role', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'service role may still count');
select pg_temp.assert_occasion_usage((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.zodiacs_mcp_usage_count_v1(text,text,text)'::regprocedure), 'RPC stays security invoker with an empty search path');
select pg_temp.assert_occasion_usage((select count(*) = 1 and bool_and(conname = 'usage_daily_tool_check') from pg_constraint
  where conrelid = 'zodiacs_mcp_private.usage_daily'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tool = ANY%'), 'one tool check, the widened one, after two replays');
select pg_temp.assert_occasion_usage((select array_agg(attname::text order by attnum) = array['day', 'scope', 'tool', 'host', 'calls']
  from pg_attribute where attrelid = 'zodiacs_mcp_private.usage_daily'::regclass and attnum > 0 and not attisdropped), 'still only day, scope, tool, host family and count columns');

-- Earlier counts survive the migration untouched.
select pg_temp.assert_occasion_usage((select count(*) = 9 from zodiacs_mcp_private.usage_daily), 'existing rows kept');

-- The two occasion tools count; anything else is still refused.
begin;
set local role service_role;
select public.zodiacs_mcp_usage_count_v1('production', 'get_occasion_sky', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('production', 'get_occasion_sky', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('preview', 'get_life_milestones', 'claude');
commit;
select pg_temp.assert_occasion_usage((select calls = 2 from zodiacs_mcp_private.usage_daily where scope = 'production' and tool = 'get_occasion_sky' and host = 'chatgpt'), 'occasion sky counted twice on one row');
select pg_temp.assert_occasion_usage((select calls = 1 from zodiacs_mcp_private.usage_daily where scope = 'preview' and tool = 'get_life_milestones' and host = 'claude'), 'life milestones counted');
do $$ begin
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'search_zodiacs', 'claude'); raise exception 'unknown tool accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'get_occasion_sky', 'Mozilla/5.0'); raise exception 'raw user agent accepted';
  exception when invalid_parameter_value then null; end;
  begin insert into zodiacs_mcp_private.usage_daily values (current_date, 'preview', 'get_remembrance', 'other', 1); raise exception 'unlisted tool stored';
  exception when check_violation then null; end;
end; $$;
select pg_temp.assert_occasion_usage((select count(*) = 0 from (
  select day, scope, tool, host, calls from occasion_usage_before
  except select day, scope, tool, host, calls from zodiacs_mcp_private.usage_daily) changed), 'earlier rows unchanged');
select 'MCP occasion usage SQL passed: replayable widening, two new tool names counted, unknown names refused, earlier rows kept' as result;
