-- Anonymous daily usage counters for the hosted MCP tools: one row per UTC day,
-- deployment scope, tool and coarse assistant family, holding only a call count.
-- No IPs, user agents, arguments, outputs or caller identifiers. Same private
-- schema, RLS, grants and security-invoker pattern as the atomic quota.
-- UTC filename; not applied to any database until the owner approves it.
create schema if not exists zodiacs_mcp_private;
revoke all on schema zodiacs_mcp_private from public, anon, authenticated;
grant usage on schema zodiacs_mcp_private to service_role;

create table if not exists zodiacs_mcp_private.usage_daily (
  day date not null,
  scope text not null check (scope in ('preview', 'production')),
  tool text not null check (tool in ('get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio')),
  host text not null check (host in ('chatgpt', 'claude', 'other')),
  calls bigint not null check (calls >= 1),
  primary key (day, scope, tool, host)
);
alter table zodiacs_mcp_private.usage_daily enable row level security;
revoke all on table zodiacs_mcp_private.usage_daily from public, anon, authenticated;
grant select, insert, update on table zodiacs_mcp_private.usage_daily to service_role;
drop policy if exists mcp_usage_service_only on zodiacs_mcp_private.usage_daily;
create policy mcp_usage_service_only on zodiacs_mcp_private.usage_daily
  for all to service_role using (true) with check (true);

create or replace function public.zodiacs_mcp_usage_count_v1(usage_scope text, usage_tool text, usage_host text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if usage_scope is null or usage_scope not in ('preview', 'production')
    or usage_tool is null or usage_tool not in ('get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'get_horoscope', 'open_chart_studio')
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
