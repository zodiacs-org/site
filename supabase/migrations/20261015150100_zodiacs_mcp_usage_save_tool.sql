-- Adds save_to_zodiacs, the account save tool (docs/platform/zodiacs-ai/ACCOUNTS.md),
-- to the hosted MCP's anonymous daily usage counters. The counter's shape,
-- privacy, grants and atomic increment are unchanged; only the allowed tool
-- names grow. The count holds the tool name, never the account, the item or
-- anything saved. The server counts this name only while ZODIACS_ACCOUNTS_ENABLED=1
-- offers the tool. Safe to replay: the constraint and function are replaced whole.
-- UTC filename; not applied to any database until the owner approves it.
alter table zodiacs_mcp_private.usage_daily drop constraint if exists usage_daily_tool_check;
alter table zodiacs_mcp_private.usage_daily add constraint usage_daily_tool_check
  check (tool in ('get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio', 'get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar', 'save_to_zodiacs'));

create or replace function public.zodiacs_mcp_usage_count_v1(usage_scope text, usage_tool text, usage_host text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if usage_scope is null or usage_scope not in ('preview', 'production')
    or usage_tool is null or usage_tool not in ('get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio', 'get_occasion_sky', 'get_life_milestones', 'get_compatibility', 'find_chart_twins', 'get_famous_chart', 'get_birthday', 'get_sky_calendar', 'save_to_zodiacs')
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
