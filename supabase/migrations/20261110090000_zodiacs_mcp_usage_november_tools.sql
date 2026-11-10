-- Adds the November 2026 tools to the hosted MCP's anonymous daily usage
-- counters in one step: get_numerology, draw_tarot, find_good_days,
-- get_year_score and get_solar_return. Each tool is offered, and counted, only
-- while its own switch is on. The same file is carried by every branch that
-- adds one of them, so the branches can merge in any order and no later
-- migration narrows the list. A name whose tool is not merged or not switched
-- on is never sent. The counter's shape, privacy, grants and atomic increment
-- are unchanged; only the allowed tool names grow. The count holds the tool
-- name, never a date, time zone or anything else the call carried.
-- Safe to replay: the constraint and function are replaced whole.
-- UTC filename; not applied to any database until the owner approves it.
alter table zodiacs_mcp_private.usage_daily drop constraint if exists usage_daily_tool_check;
alter table zodiacs_mcp_private.usage_daily add constraint usage_daily_tool_check
  check (tool in ('get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio', 'get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar', 'get_natal_chart', 'get_horoscope_period', 'get_chinese_zodiac', 'get_personal_transits', 'explain_astrology', 'find_birthplace', 'search_sky_events', 'get_numerology', 'draw_tarot', 'find_good_days', 'get_year_score', 'get_solar_return', 'save_to_zodiacs'));

create or replace function public.zodiacs_mcp_usage_count_v1(usage_scope text, usage_tool text, usage_host text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if usage_scope is null or usage_scope not in ('preview', 'production')
    or usage_tool is null or usage_tool not in ('get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio', 'get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar', 'get_natal_chart', 'get_horoscope_period', 'get_chinese_zodiac', 'get_personal_transits', 'explain_astrology', 'find_birthplace', 'search_sky_events', 'get_numerology', 'draw_tarot', 'find_good_days', 'get_year_score', 'get_solar_return', 'save_to_zodiacs')
    or usage_host is null or usage_host not in ('chatgpt', 'claude', 'other') then
    raise exception using errcode = '22023', message = 'Invalid MCP usage scope, tool or host';
  end if;
  -- One atomic statement: ON CONFLICT takes the exact row lock, so concurrent
  -- calls never lose an increment. The day is the database clock's UTC date,
  -- never a client-supplied time or the session time zone.
  insert into zodiacs_mcp_private.usage_daily as u(day, scope, tool, host, calls)
    values ((pg_catalog.clock_timestamp() at time zone 'UTC')::date, usage_scope, usage_tool, usage_host, 1)
  on conflict (day, scope, tool, host) do update set calls = u.calls + 1;
end;
$$;
revoke all on function public.zodiacs_mcp_usage_count_v1(text, text, text) from public, anon, authenticated;
grant execute on function public.zodiacs_mcp_usage_count_v1(text, text, text) to service_role;
