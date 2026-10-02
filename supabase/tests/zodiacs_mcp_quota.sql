-- Disposable PostgreSQL only. Concurrent backends, not a mocked counter.
\set ON_ERROR_STOP on
create extension if not exists dblink;
create function pg_temp.assert_mcp(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'MCP quota assertion: %', message; end if; end; $$;
select pg_temp.assert_mcp(not has_function_privilege('anon', 'public.zodiacs_mcp_quota_reserve_v1(text,text)', 'execute'), 'anonymous RPC denied');
select pg_temp.assert_mcp(not has_function_privilege('authenticated', 'public.zodiacs_mcp_quota_reserve_v1(text,text)', 'execute'), 'authenticated RPC denied');
select pg_temp.assert_mcp(not has_schema_privilege('anon', 'zodiacs_mcp_private', 'usage'), 'anonymous schema denied');
select pg_temp.assert_mcp(not has_schema_privilege('authenticated', 'zodiacs_mcp_private', 'usage'), 'authenticated schema denied');
select pg_temp.assert_mcp((select not prosecdef from pg_proc where oid = 'public.zodiacs_mcp_quota_reserve_v1(text,text)'::regprocedure), 'RPC is security invoker');
select pg_temp.assert_mcp((select relrowsecurity from pg_class where oid = 'zodiacs_mcp_private.quota'::regclass), 'RLS enabled');

do $$ begin
  begin perform public.zodiacs_mcp_quota_reserve_v1('caller-supplied', 'event'); raise exception 'scope accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.zodiacs_mcp_quota_reserve_v1('preview', null); raise exception 'null accepted';
  exception when invalid_parameter_value then null; end;
end; $$;

create temporary table mcp_results (kind text, admitted boolean);
-- Hold the table until every contender is sent, so all backends race together.
begin;
lock table zodiacs_mcp_private.quota in access exclusive mode;
do $$ declare i integer; name text; begin
  for i in 1..48 loop
    name := 'mcp_' || i;
    perform dblink_connect(name, format('host=127.0.0.1 port=%s dbname=%L user=%L', current_setting('port'), current_database(), current_user));
    perform dblink_exec(name, 'set role service_role');
    perform dblink_exec(name, 'set statement_timeout = ''15s''');
    perform dblink_send_query(name, 'select public.zodiacs_mcp_quota_reserve_v1(''preview'', ''event'')');
  end loop;
end; $$;
select pg_sleep(0.05);
select pg_temp.assert_mcp((select bool_and(dblink_is_busy('mcp_' || i) = 1) from generate_series(1,48) i), 'all 48 event backends blocked before release');
commit;
do $$ declare i integer; begin
  for i in 1..48 loop
    insert into mcp_results select 'event', admitted from dblink_get_result('mcp_' || i) as r(admitted boolean);
    perform * from dblink_get_result('mcp_' || i) as r(admitted boolean);
  end loop;
end; $$;
select pg_temp.assert_mcp((select count(*) = 10 from mcp_results where kind='event' and admitted), 'exactly 10 of 48 concurrent event requests admitted');
select pg_temp.assert_mcp((select used=10 from zodiacs_mcp_private.quota where scope='preview' and kind='event'), 'event count never exceeds 10');
select pg_temp.assert_mcp(not public.zodiacs_mcp_quota_reserve_v1('preview','event'), 'exhausted event slot refused');

begin;
lock table zodiacs_mcp_private.quota in access exclusive mode;
do $$ declare i integer; begin
  for i in 1..48 loop perform dblink_send_query('mcp_' || i, 'select public.zodiacs_mcp_quota_reserve_v1(''preview'', ''request'')'); end loop;
end; $$;
commit;
do $$ declare i integer; begin
  for i in 1..48 loop
    insert into mcp_results select 'request', admitted from dblink_get_result('mcp_' || i) as r(admitted boolean);
    perform * from dblink_get_result('mcp_' || i) as r(admitted boolean);
    perform dblink_disconnect('mcp_' || i);
  end loop;
end; $$;
select pg_temp.assert_mcp((select count(*) = 40 from mcp_results where kind='request' and admitted), 'exactly 40 of 48 concurrent incoming requests admitted');
select pg_temp.assert_mcp(public.zodiacs_mcp_quota_reserve_v1('production','event'), 'preview and production scopes independent');
update zodiacs_mcp_private.quota set expires_at = clock_timestamp() - interval '1 second' where scope='preview' and kind='event';
select pg_temp.assert_mcp(public.zodiacs_mcp_quota_reserve_v1('preview','event'), 'expired window recovers');
select pg_temp.assert_mcp((select used=1 and expires_at > clock_timestamp() from zodiacs_mcp_private.quota where scope='preview' and kind='event'), 'window resets to one from database clock');
begin;
set local role service_role;
select public.zodiacs_mcp_quota_reserve_v1('preview','event');
rollback;
select pg_temp.assert_mcp((select used=1 from zodiacs_mcp_private.quota where scope='preview' and kind='event'), 'aborted reservation rolls back');
select pg_temp.assert_mcp((select count(*) = 3 from zodiacs_mcp_private.quota), 'aggregate rows bounded, no caller rows');
select 'MCP quota SQL passed: permissions, 96 concurrent backends, exact 10/40 ceilings, reset, scope isolation and rollback' as result;
