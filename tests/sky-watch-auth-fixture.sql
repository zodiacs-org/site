-- Local PostgreSQL CI only: minimal shapes of the Supabase-owned Auth tables.
create schema if not exists auth;
do $$ begin
  if not exists(select 1 from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin; end if;
end $$;
create table if not exists auth.users(id uuid primary key);
alter table auth.users add column if not exists banned_until timestamptz;
alter table auth.users add column if not exists deleted_at timestamptz;
create table if not exists auth.sessions(id uuid primary key,user_id uuid,oauth_client_id uuid,not_after timestamptz,scopes text);
create table if not exists auth.oauth_clients(id uuid primary key,deleted_at timestamptz);
create table if not exists auth.oauth_consents(user_id uuid,client_id uuid,scopes text,revoked_at timestamptz);
grant usage on schema auth to supabase_auth_admin;
grant select,insert,update,delete on all tables in schema auth to supabase_auth_admin;
