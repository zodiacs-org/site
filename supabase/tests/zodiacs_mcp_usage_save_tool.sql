-- Disposable PostgreSQL only. Runs after zodiacs_mcp_usage_occasion_tools.sql and the
-- save-tool migration (applied twice, as a reviewed SQL Editor replay would).
\set ON_ERROR_STOP on
create function pg_temp.assert_save_usage(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'MCP save-tool usage assertion: %', message; end if; end; $$;
create temporary table save_usage_before as select day, scope, tool, host, calls from zodiacs_mcp_private.usage_daily;

select pg_temp.assert_save_usage(not has_function_privilege('anon', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'anonymous RPC still denied');
select pg_temp.assert_save_usage(not has_function_privilege('authenticated', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'authenticated RPC still denied');
select pg_temp.assert_save_usage(has_function_privilege('service_role', 'public.zodiacs_mcp_usage_count_v1(text,text,text)', 'execute'), 'service role may still count');
select pg_temp.assert_save_usage((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.zodiacs_mcp_usage_count_v1(text,text,text)'::regprocedure), 'RPC stays security invoker with an empty search path');
select pg_temp.assert_save_usage((select count(*) = 1 from pg_constraint
  where conrelid = 'zodiacs_mcp_private.usage_daily'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%tool = ANY%'), 'one tool check after two replays');
select pg_temp.assert_save_usage((select array_agg(attname::text order by attnum) = array['day', 'scope', 'tool', 'host', 'calls']
  from pg_attribute where attrelid = 'zodiacs_mcp_private.usage_daily'::regclass and attnum > 0 and not attisdropped), 'still only day, scope, tool, host family and count columns');

begin;
set local role service_role;
select public.zodiacs_mcp_usage_count_v1('production', 'save_to_zodiacs', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('production', 'save_to_zodiacs', 'chatgpt');
select public.zodiacs_mcp_usage_count_v1('production', 'get_occasion_sky', 'claude');
commit;
select pg_temp.assert_save_usage((select calls = 2 from zodiacs_mcp_private.usage_daily where scope = 'production' and tool = 'save_to_zodiacs' and host = 'chatgpt'), 'save tool counted twice on one row');
do $$ begin
  begin perform public.zodiacs_mcp_usage_count_v1('preview', 'delete_from_zodiacs', 'claude'); raise exception 'unknown tool accepted';
  exception when invalid_parameter_value then null; end;
end; $$;
select pg_temp.assert_save_usage((select count(*) = 0 from (
  select day, scope, tool, host, calls from save_usage_before
  except select day, scope, tool, host, calls from zodiacs_mcp_private.usage_daily) changed), 'earlier rows unchanged');
select 'MCP save-tool usage SQL passed: replayable widening, the save tool counted, unknown names refused, earlier rows kept' as result;
