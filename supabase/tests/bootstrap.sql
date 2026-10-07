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

  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end;
$$;

create schema if not exists auth authorization postgres;

create table if not exists auth.users (
  id uuid primary key
);

-- OAuth migrations use these provider-owned authorization facts. All migration
-- suites need the same shapes, not only the focused Sky Watch drive.
alter table auth.users add column if not exists banned_until timestamptz;
alter table auth.users add column if not exists deleted_at timestamptz;
create table if not exists auth.sessions (
  id uuid primary key, user_id uuid, oauth_client_id uuid,
  not_after timestamptz, scopes text
);
create table if not exists auth.oauth_clients (
  id uuid primary key, deleted_at timestamptz
);
create table if not exists auth.oauth_consents (
  user_id uuid, client_id uuid, scopes text, revoked_at timestamptz
);
grant usage on schema auth to supabase_auth_admin;
grant select, insert, update, delete on all tables in schema auth to supabase_auth_admin;

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

revoke all on schema auth from public;
grant usage on schema auth to anon, authenticated, service_role;

revoke all on function auth.uid() from public;
grant execute on function auth.uid() to anon, authenticated, service_role;
revoke all on function auth.jwt() from public;
grant execute on function auth.jwt() to anon, authenticated, service_role;
