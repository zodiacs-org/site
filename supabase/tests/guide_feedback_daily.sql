-- Disposable PostgreSQL only. Guide's daily answer-vote counts.
\set ON_ERROR_STOP on
create extension if not exists dblink;
create function pg_temp.assert_feedback(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'Guide feedback assertion: %', message; end if; end; $$;

select pg_temp.assert_feedback(not has_function_privilege('public', 'public.guide_feedback_count_v1(text)', 'execute'), 'PUBLIC RPC denied');
select pg_temp.assert_feedback(not has_function_privilege('anon', 'public.guide_feedback_count_v1(text)', 'execute'), 'anonymous RPC denied');
select pg_temp.assert_feedback(not has_function_privilege('authenticated', 'public.guide_feedback_count_v1(text)', 'execute'), 'authenticated RPC denied');
select pg_temp.assert_feedback(has_function_privilege('service_role', 'public.guide_feedback_count_v1(text)', 'execute'), 'service role may count');
select pg_temp.assert_feedback(not has_table_privilege('anon', 'public.guide_feedback_daily', 'select'), 'anonymous read denied');
select pg_temp.assert_feedback(not has_table_privilege('anon', 'public.guide_feedback_daily', 'insert'), 'anonymous write denied');
select pg_temp.assert_feedback(not has_table_privilege('authenticated', 'public.guide_feedback_daily', 'select'), 'authenticated read denied');
select pg_temp.assert_feedback(not has_table_privilege('authenticated', 'public.guide_feedback_daily', 'update'), 'authenticated write denied');
select pg_temp.assert_feedback(has_table_privilege('service_role', 'public.guide_feedback_daily', 'select'), 'service role may read the totals');
select pg_temp.assert_feedback(not has_table_privilege('service_role', 'public.guide_feedback_daily', 'delete'), 'service role cannot delete counts');
select pg_temp.assert_feedback((select not prosecdef and 'search_path=""' = any(proconfig) from pg_proc where oid = 'public.guide_feedback_count_v1(text)'::regprocedure), 'RPC is security invoker with an empty search path');
select pg_temp.assert_feedback((select relrowsecurity from pg_class where oid = 'public.guide_feedback_daily'::regclass), 'RLS enabled');
select pg_temp.assert_feedback((select array_agg(attname::text order by attnum) = array['day', 'vote', 'votes']
  from pg_attribute where attrelid = 'public.guide_feedback_daily'::regclass and attnum > 0 and not attisdropped), 'only day, vote and count columns');

do $$ begin
  begin perform public.guide_feedback_count_v1('sideways'); raise exception 'unknown vote accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.guide_feedback_count_v1('Up'); raise exception 'mixed-case vote accepted';
  exception when invalid_parameter_value then null; end;
  begin perform public.guide_feedback_count_v1(null); raise exception 'null vote accepted';
  exception when invalid_parameter_value then null; end;
  -- The table itself refuses free text and empty counts, even from a writer that bypasses the RPC.
  begin insert into public.guide_feedback_daily values (current_date, 'what is my rising sign', 1); raise exception 'free text stored';
  exception when check_violation then null; end;
  begin insert into public.guide_feedback_daily values (current_date, 'up', 0); raise exception 'empty count stored';
  exception when check_violation then null; end;
end; $$;
select pg_temp.assert_feedback((select count(*) = 0 from public.guide_feedback_daily), 'refused votes leave no row');

-- Browser roles cannot count even when they call the RPC directly.
begin;
set local role anon;
do $$ begin
  begin perform public.guide_feedback_count_v1('up'); raise exception 'anonymous vote counted';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;
begin;
set local role authenticated;
do $$ begin
  begin perform public.guide_feedback_count_v1('down'); raise exception 'authenticated vote counted';
  exception when insufficient_privilege then null; end;
end; $$;
rollback;

-- Hold the table until every contender is sent, so all backends race for two rows.
begin;
lock table public.guide_feedback_daily in access exclusive mode;
do $$ declare i integer; name text; begin
  for i in 1..24 loop
    name := 'feedback_' || i;
    perform dblink_connect(name, format('host=127.0.0.1 port=%s dbname=%L user=%L', current_setting('port'), current_database(), current_user));
    perform dblink_exec(name, 'set role service_role');
    perform dblink_exec(name, 'set statement_timeout = ''15s''');
    perform dblink_send_query(name, format('select public.guide_feedback_count_v1(%L)', (array['up', 'down'])[i % 3 / 2 + 1]));
  end loop;
end; $$;
select pg_sleep(0.05);
select pg_temp.assert_feedback((select bool_and(dblink_is_busy('feedback_' || i) = 1) from generate_series(1, 24) i), 'all 24 backends blocked before release');
commit;
do $$ declare i integer; begin
  for i in 1..24 loop
    perform * from dblink_get_result('feedback_' || i) as r(result text);
    perform * from dblink_get_result('feedback_' || i) as r(result text);
    perform dblink_disconnect('feedback_' || i);
  end loop;
end; $$;
-- i % 3 / 2 is 1 for i % 3 = 2 (eight of 24), so 16 up and 8 down.
select pg_temp.assert_feedback((select votes = 16 from public.guide_feedback_daily where vote = 'up'), 'all 16 concurrent up votes counted');
select pg_temp.assert_feedback((select votes = 8 from public.guide_feedback_daily where vote = 'down'), 'all 8 concurrent down votes counted');

-- The day comes from the database clock in UTC, whatever the session time zone.
delete from public.guide_feedback_daily;
create temporary table feedback_clock as select (clock_timestamp() at time zone 'UTC')::date as first_day;
set time zone 'Pacific/Kiritimati';
select public.guide_feedback_count_v1('up');
set time zone 'Etc/GMT+12';
select public.guide_feedback_count_v1('up');
reset time zone;
select pg_temp.assert_feedback((select count(*) = 1 and bool_and(votes = 2 and day between (select first_day from feedback_clock) and (clock_timestamp() at time zone 'UTC')::date)
  from public.guide_feedback_daily), 'both votes land on the UTC date');
update public.guide_feedback_daily set day = day - 1;
select public.guide_feedback_count_v1('up');
select pg_temp.assert_feedback((select count(*) = 2 and sum(votes) = 3 and bool_or(votes = 1 and day = (clock_timestamp() at time zone 'UTC')::date)
  from public.guide_feedback_daily), 'a new day starts a new row and leaves earlier days unchanged');

begin;
set local role service_role;
select public.guide_feedback_count_v1('down');
do $$ begin
  if (select count(*) from public.guide_feedback_daily) <> 3 then raise exception 'Guide feedback assertion: service role reads the totals'; end if;
end; $$;
rollback;
select pg_temp.assert_feedback((select count(*) = 2 from public.guide_feedback_daily), 'aborted vote rolls back');
select 'Guide feedback SQL passed: permissions, input refusal, 24 concurrent backends without lost counts, UTC day, rollover and rollback' as result;
