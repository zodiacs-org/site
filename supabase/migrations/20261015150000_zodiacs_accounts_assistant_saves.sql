-- "Save to my Zodiacs account" from ChatGPT and Claude (docs/platform/zodiacs-ai/ACCOUNTS.md).
--
-- The hosted MCP's save_to_zodiacs tool is the only tool that needs a signed-in
-- person. Supabase Auth's OAuth server issues the token; this migration adds:
--   1. the predefined OAuth clients allowed to save, each with its exact MCP audience;
--   2. a projection of the Auth facts the live authorization check needs, kept in
--      the same transaction as Auth's own writes (hosted Auth tables cannot grant
--      SELECT onward), the design Sky Watch's preview verified;
--   3. the access-token hook that sets the exact audience and the separate
--      profile:save permission for those clients only, and changes nothing else;
--   4. assistant rows in the site's own public.saved_pages (20261015090000), so
--      the profile lists and removes them with everything else saved there: a
--      source column, a plain-text summary and the worked-out result, and the
--      chart and week kinds, which only the server's RPC may write;
--   5. that RPC, which repeats the live check inside the save transaction.
-- saved_pages keeps its owner-only RLS, its no-update rule, its 100-row limit per
-- account and its deletion with the account. Run after 20261015090000_saved_pages.sql.
--
-- Same private-schema, RLS, grants and security-invoker pattern as the Sky Watch
-- OAuth adapter and the MCP usage counters. Replay-safe.
-- UTC filename; not applied to any database until the owner approves it.

create schema if not exists zodiacs_accounts_private;
revoke all on schema zodiacs_accounts_private from public, anon, authenticated;
grant usage on schema zodiacs_accounts_private to service_role, supabase_auth_admin;

-- 1. Enabled clients. One row per predefined public client, with its one audience.
create table if not exists zodiacs_accounts_private.oauth_clients (
  id uuid primary key,
  resource text not null check (resource = 'https://zodiacs.org/mcp' or resource ~ '^https://[a-z0-9-]+\.vercel\.app/mcp$'),
  enabled boolean not null default true
);
alter table zodiacs_accounts_private.oauth_clients enable row level security;
revoke all on zodiacs_accounts_private.oauth_clients from public, anon, authenticated;
grant select, insert, update, delete on zodiacs_accounts_private.oauth_clients to service_role;
grant select on zodiacs_accounts_private.oauth_clients to supabase_auth_admin;
drop policy if exists accounts_hook_client_lookup on zodiacs_accounts_private.oauth_clients;
create policy accounts_hook_client_lookup on zodiacs_accounts_private.oauth_clients for select to supabase_auth_admin using (true);

-- 2. Authorization facts only: no email, password, token or profile is copied.
create table if not exists zodiacs_accounts_private.auth_state (
  kind text not null check (kind in ('user', 'session', 'client', 'consent')),
  key text not null,
  state jsonb not null,
  primary key (kind, key)
);
alter table zodiacs_accounts_private.auth_state enable row level security;
revoke all on zodiacs_accounts_private.auth_state from public, anon, authenticated, service_role;
grant select on zodiacs_accounts_private.auth_state to service_role;
grant select, insert, update, delete on zodiacs_accounts_private.auth_state to supabase_auth_admin;
drop policy if exists accounts_auth_maintains_facts on zodiacs_accounts_private.auth_state;
create policy accounts_auth_maintains_facts on zodiacs_accounts_private.auth_state
  for all to supabase_auth_admin using (true) with check (true);

create or replace function zodiacs_accounts_private.capture_auth_state() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
declare row_data jsonb; kind_name text; key_value text; fact jsonb;
begin
  row_data := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  if TG_TABLE_NAME = 'users' then
    kind_name := 'user'; key_value := row_data->>'id';
    fact := jsonb_build_object('banned_until', row_data->'banned_until', 'deleted_at', row_data->'deleted_at');
  elsif TG_TABLE_NAME = 'sessions' then
    kind_name := 'session'; key_value := row_data->>'id';
    fact := jsonb_build_object('user', row_data->'user_id', 'client', row_data->'oauth_client_id', 'not_after', row_data->'not_after', 'scopes', row_data->'scopes');
    -- Ordinary website sessions carry no OAuth client and are not projected.
    if TG_OP <> 'DELETE' and row_data->>'oauth_client_id' is null then
      delete from zodiacs_accounts_private.auth_state where kind = kind_name and key = key_value;
      return NEW;
    end if;
  elsif TG_TABLE_NAME = 'oauth_clients' then
    kind_name := 'client'; key_value := row_data->>'id';
    fact := jsonb_build_object('deleted_at', row_data->'deleted_at');
  elsif TG_TABLE_NAME = 'oauth_consents' then
    kind_name := 'consent'; key_value := (row_data->>'user_id') || ':' || (row_data->>'client_id');
    fact := jsonb_build_object('revoked_at', row_data->'revoked_at', 'scopes', row_data->'scopes');
  else raise exception 'unsupported authorization source'; end if;
  if TG_OP = 'DELETE' then
    delete from zodiacs_accounts_private.auth_state where kind = kind_name and key = key_value;
    return OLD;
  end if;
  insert into zodiacs_accounts_private.auth_state(kind, key, state) values (kind_name, key_value, fact)
    on conflict (kind, key) do update set state = excluded.state;
  return NEW;
end $$;
revoke all on function zodiacs_accounts_private.capture_auth_state() from public, anon, authenticated, service_role;
grant execute on function zodiacs_accounts_private.capture_auth_state() to supabase_auth_admin;

drop trigger if exists zodiacs_accounts_auth_user on auth.users;
drop trigger if exists zodiacs_accounts_auth_session on auth.sessions;
drop trigger if exists zodiacs_accounts_auth_client on auth.oauth_clients;
drop trigger if exists zodiacs_accounts_auth_consent on auth.oauth_consents;
-- Users only when an authorization fact changes, so ordinary profile writes stay as they are.
create trigger zodiacs_accounts_auth_user after insert or delete or update of banned_until, deleted_at on auth.users
  for each row execute function zodiacs_accounts_private.capture_auth_state();
create trigger zodiacs_accounts_auth_session after insert or update or delete on auth.sessions
  for each row execute function zodiacs_accounts_private.capture_auth_state();
create trigger zodiacs_accounts_auth_client after insert or update or delete on auth.oauth_clients
  for each row execute function zodiacs_accounts_private.capture_auth_state();
create trigger zodiacs_accounts_auth_consent after insert or update or delete on auth.oauth_consents
  for each row execute function zodiacs_accounts_private.capture_auth_state();

insert into zodiacs_accounts_private.auth_state
  select 'user', id::text, jsonb_build_object('banned_until', banned_until, 'deleted_at', deleted_at) from auth.users
  on conflict (kind, key) do update set state = excluded.state;
insert into zodiacs_accounts_private.auth_state
  select 'session', id::text, jsonb_build_object('user', user_id, 'client', oauth_client_id, 'not_after', not_after, 'scopes', scopes)
  from auth.sessions where oauth_client_id is not null
  on conflict (kind, key) do update set state = excluded.state;
insert into zodiacs_accounts_private.auth_state
  select 'client', id::text, jsonb_build_object('deleted_at', deleted_at) from auth.oauth_clients
  on conflict (kind, key) do update set state = excluded.state;
insert into zodiacs_accounts_private.auth_state
  select 'consent', user_id::text || ':' || client_id::text, jsonb_build_object('revoked_at', revoked_at, 'scopes', scopes) from auth.oauth_consents
  on conflict (kind, key) do update set state = excluded.state;

-- The live check: an enabled client for this exact resource, an unexpired OAuth
-- session of that user and client with openid, an unrevoked consent, an
-- undeleted client and an undeleted, unbanned account.
create or replace function zodiacs_accounts_private.oauth_active(user_id uuid, session_id uuid, client_id uuid, resource text, at_time timestamptz)
returns boolean language sql stable security invoker set search_path = pg_catalog as $$
  select exists (
    select 1 from zodiacs_accounts_private.auth_state s
    join zodiacs_accounts_private.auth_state u on u.kind = 'user' and u.key = $1::text
    join zodiacs_accounts_private.auth_state c on c.kind = 'client' and c.key = $3::text
    join zodiacs_accounts_private.auth_state consent on consent.kind = 'consent' and consent.key = $1::text || ':' || $3::text
    join zodiacs_accounts_private.oauth_clients allowed on allowed.id = $3 and allowed.enabled and allowed.resource = $4
    where s.kind = 'session' and s.key = $2::text and s.state->>'user' = $1::text and s.state->>'client' = $3::text
      and u.state->>'deleted_at' is null and (u.state->>'banned_until' is null or (u.state->>'banned_until')::timestamptz <= $5)
      and c.state->>'deleted_at' is null and consent.state->>'revoked_at' is null
      and (s.state->>'not_after' is null or (s.state->>'not_after')::timestamptz > $5)
      and 'openid' = any(string_to_array(s.state->>'scopes', ' ')) and 'openid' = any(string_to_array(consent.state->>'scopes', ' '))
  );
$$;
revoke all on function zodiacs_accounts_private.oauth_active(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function zodiacs_accounts_private.oauth_active(uuid, uuid, uuid, text, timestamptz) to service_role;

-- 3. The access-token hook runs for every token this project issues, including
-- ordinary website sign-ins. It adds the audience and permission only for an
-- enabled assistant client, and never fails a sign-in: anything unexpected
-- returns the claims unchanged.
create or replace function zodiacs_accounts_private.access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare claims jsonb := event->'claims'; audience text;
begin
  if claims->>'client_id' is not null and claims->>'client_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select resource into audience from zodiacs_accounts_private.oauth_clients
      where id = (claims->>'client_id')::uuid and enabled;
    if audience is not null then
      claims := claims || jsonb_build_object('aud', audience, 'zodiacs_permissions', jsonb_build_array('profile:save'));
    end if;
  end if;
  return jsonb_build_object('claims', claims);
exception when others then
  return jsonb_build_object('claims', event->'claims');
end;
$$;
revoke all on function zodiacs_accounts_private.access_token_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function zodiacs_accounts_private.access_token_hook(jsonb) to supabase_auth_admin;

-- 4. Assistant saves in public.saved_pages. Browsers keep their column-limited
-- insert (user_id, kind, title, href), so only the service role can write
-- source, summary or detail, and a site row stays a compatibility or occasion
-- link exactly as before. An assistant row also carries the plain-text summary
-- and the worked-out result (the server bounds it at 8 KB of compact JSON; this
-- check is a looser backstop for jsonb's own text form).
alter table public.saved_pages add column if not exists source text not null default 'site';
alter table public.saved_pages add column if not exists summary text;
alter table public.saved_pages add column if not exists detail jsonb;
alter table public.saved_pages drop constraint if exists saved_pages_kind;
alter table public.saved_pages add constraint saved_pages_kind check (kind in ('compatibility', 'occasion', 'chart', 'week'));
alter table public.saved_pages drop constraint if exists saved_pages_kind_path;
alter table public.saved_pages add constraint saved_pages_kind_path check (
  (kind = 'compatibility' and href ~ '^/([a-z]{2}/)?compatibility/')
  or (kind = 'occasion' and href ~ '^/occasions/')
  or (kind = 'chart' and href ~ '^/(birth-chart|people)/')
  or (kind = 'week' and href ~ '^/horoscopes/')
);
alter table public.saved_pages drop constraint if exists saved_pages_source;
alter table public.saved_pages add constraint saved_pages_source check (
  (source = 'site' and summary is null and detail is null and kind in ('compatibility', 'occasion'))
  or (source = 'assistant' and summary is not null and detail is not null)
);
alter table public.saved_pages drop constraint if exists saved_pages_assistant_detail;
alter table public.saved_pages add constraint saved_pages_assistant_detail check (
  (summary is null or (char_length(summary) between 1 and 600 and summary !~ '[[:cntrl:]<>]'))
  and (detail is null or (jsonb_typeof(detail) = 'object' and octet_length(detail::text) <= 16384
    and detail->>'schema' = 'zodiacs.assistant-save.v1'))
);
-- Delete only for the RPC's replacement of a site row with the assistant's fuller record.
grant select, insert, delete on public.saved_pages to service_role;

-- 5. The server's only entry point. Security invoker with an empty-ish path; only
-- the service role may call it.
create or replace function public.zodiacs_accounts_v1(operation text, input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  now_at timestamptz := clock_timestamp();
  owner uuid; saved public.saved_pages%rowtype;
begin
  if operation not in ('oauth', 'save') then raise exception using errcode = '22023', message = 'Unsupported accounts operation'; end if;
  if input->>'user' is null or input->>'session' is null or input->>'client' is null or input->>'resource' is null
    or not zodiacs_accounts_private.oauth_active((input->>'user')::uuid, (input->>'session')::uuid, (input->>'client')::uuid, input->>'resource', now_at) then
    return case when operation = 'oauth' then to_jsonb(false) else 'null'::jsonb end;
  end if;
  if operation = 'oauth' then return to_jsonb(true); end if;
  owner := (input->>'user')::uuid;
  -- The same link saved by the assistant again: one row, left exactly as it was.
  -- The same link saved on the site holds only the link, so the assistant's
  -- record (with its summary and worked-out result) takes its place.
  select * into saved from public.saved_pages where user_id = owner and href = input->>'href';
  if found and saved.source = 'assistant' then
    return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
  end if;
  if found then delete from public.saved_pages where id = saved.id; end if;
  begin
    -- saved_pages' own trigger serialises per account and enforces the 100-row limit.
    insert into public.saved_pages(user_id, kind, title, href, source, summary, detail)
      values (owner, input->>'kind', input->>'title', input->>'href', 'assistant', input->>'summary', input->'detail')
      returning * into saved;
  exception
    when unique_violation then
      select * into saved from public.saved_pages where user_id = owner and href = input->>'href';
      return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
    when raise_exception then
      if sqlerrm = 'saved_pages_full' then return to_jsonb('full'::text); end if;
      raise;
  end;
  return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', true);
end;
$$;
revoke all on function public.zodiacs_accounts_v1(text, jsonb) from public, anon, authenticated;
grant execute on function public.zodiacs_accounts_v1(text, jsonb) to service_role;
