-- Optional shared-project hook for the two isolated previews. Creating this
-- function does not switch Auth's configured hook or enable either preview.
-- Each client belongs to exactly one allowlist; ambiguous clients receive no
-- preview audience or permission. Existing hooks remain unchanged for rollback.
create schema if not exists zodiacs_auth_private;
revoke all on schema zodiacs_auth_private from public, anon, authenticated, service_role;
grant usage on schema zodiacs_auth_private to supabase_auth_admin;

create or replace function zodiacs_auth_private.access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare
  claims jsonb := event->'claims';
  client uuid;
  is_watch boolean;
  is_accounts boolean;
begin
  if claims->>'client_id' is null or claims->>'client_id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('claims', claims);
  end if;
  client := (claims->>'client_id')::uuid;
  select exists(select 1 from sky_watch.oauth_clients where id = client and enabled) into is_watch;
  select exists(select 1 from zodiacs_accounts_private.oauth_clients where id = client and enabled) into is_accounts;
  if is_watch and not is_accounts then
    return sky_watch.access_token_hook(event);
  elsif is_accounts and not is_watch then
    return zodiacs_accounts_private.access_token_hook(event);
  end if;
  return jsonb_build_object('claims', claims);
exception when others then
  -- Preserve ordinary Auth availability while refusing to add preview claims.
  return jsonb_build_object('claims', event->'claims');
end;
$$;
revoke all on function zodiacs_auth_private.access_token_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function zodiacs_auth_private.access_token_hook(jsonb) to supabase_auth_admin;
