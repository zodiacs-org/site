-- Separate, bounded aggregate counters. No arguments, IPs or caller identifiers.
-- CLI migration creation was attempted with installed 2.108.0 and npm 2.101.0;
-- both fail before execution with Unsupported Config Type. UTC filename fallback.
create schema if not exists zodiacs_mcp_private;
revoke all on schema zodiacs_mcp_private from public, anon, authenticated;
grant usage on schema zodiacs_mcp_private to service_role;

create table if not exists zodiacs_mcp_private.quota (
  scope text not null check (scope in ('preview', 'production')),
  kind text not null check (kind in ('request', 'event')),
  expires_at timestamptz not null,
  used integer not null check (used >= 1 and used <= case when kind = 'request' then 40 else 10 end),
  primary key (scope, kind)
);
alter table zodiacs_mcp_private.quota enable row level security;
revoke all on table zodiacs_mcp_private.quota from public, anon, authenticated;
grant select, insert, update on table zodiacs_mcp_private.quota to service_role;
drop policy if exists mcp_quota_service_only on zodiacs_mcp_private.quota;
create policy mcp_quota_service_only on zodiacs_mcp_private.quota
  for all to service_role using (true) with check (true);

create or replace function public.zodiacs_mcp_quota_reserve_v1(quota_scope text, quota_kind text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare
  ceiling integer;
begin
  if quota_scope is null or quota_scope not in ('preview', 'production')
    or quota_kind is null or quota_kind not in ('request', 'event') then
    raise exception using errcode = '22023', message = 'Invalid MCP quota kind or scope';
  end if;
  ceiling := case when quota_kind = 'request' then 40 else 10 end;
  -- ON CONFLICT takes the exact row lock. The predicate and update use the
  -- locked current row, including callers queued behind a concurrent writer.
  -- Reset uses the database clock after locking, never a client-supplied time.
  insert into zodiacs_mcp_private.quota as q(scope, kind, expires_at, used)
    values (quota_scope, quota_kind, pg_catalog.clock_timestamp() + interval '60 seconds', 1)
  on conflict (scope, kind) do update set
    used = case when q.expires_at <= pg_catalog.clock_timestamp() then 1 else q.used + 1 end,
    expires_at = case when q.expires_at <= pg_catalog.clock_timestamp()
      then pg_catalog.clock_timestamp() + interval '60 seconds' else q.expires_at end
  where q.expires_at <= pg_catalog.clock_timestamp() or q.used < ceiling;
  return found;
end;
$$;
revoke all on function public.zodiacs_mcp_quota_reserve_v1(text, text) from public, anon, authenticated;
grant execute on function public.zodiacs_mcp_quota_reserve_v1(text, text) to service_role;
