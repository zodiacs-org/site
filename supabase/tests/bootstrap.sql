\set ON_ERROR_STOP on

-- Minimal Supabase-owned objects for portable migration tests. This is used
-- only in a disposable PostgreSQL 17 container; production Supabase already
-- provides these roles and the auth schema.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth authorization postgres;

create table if not exists auth.users (
  id uuid primary key
);

create or replace function auth.uid()
returns uuid
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- Supabase's automatic grants on schema public: API roles may use the schema,
-- and every table, function and sequence that postgres creates there is
-- granted to anon, authenticated and service_role. Projects made before the
-- 2026 secure defaults still carry these grants, so a migration's tests run
-- with them in place: a table or function that a migration forgets to revoke
-- stays reachable here exactly as it would in such a project.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

revoke all on schema auth from public;
grant usage on schema auth to anon, authenticated, service_role;

revoke all on function auth.uid() from public;
grant execute on function auth.uid() to anon, authenticated, service_role;
revoke all on function auth.jwt() from public;
grant execute on function auth.jwt() to anon, authenticated, service_role;
