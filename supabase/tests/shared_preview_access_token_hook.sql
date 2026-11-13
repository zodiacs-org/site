-- Disposable PostgreSQL only; fixtures never leave this transaction.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_shared_hook(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'Shared hook assertion: %', message; end if; end; $$;

select pg_temp.assert_shared_hook(not has_function_privilege('anon', 'zodiacs_auth_private.access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'zodiacs_auth_private.access_token_hook(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'zodiacs_auth_private.access_token_hook(jsonb)', 'execute'), 'only Auth can execute');
select pg_temp.assert_shared_hook((select not prosecdef and 'search_path=pg_catalog' = any(proconfig)
  from pg_proc where oid = 'zodiacs_auth_private.access_token_hook(jsonb)'::regprocedure), 'invoker with fixed search path');

do $$
declare
  watch_client uuid := gen_random_uuid();
  account_client uuid := gen_random_uuid();
  unknown_client uuid := gen_random_uuid();
  incoming jsonb;
  actual jsonb;
begin
  insert into sky_watch.oauth_clients(id, resource) values (watch_client, 'https://zodiacs-sky-watch-test.vercel.app/mcp');
  insert into zodiacs_accounts_private.oauth_clients(id, resource) values (account_client, 'https://zodiacs-accounts-test.vercel.app/mcp');
  set local role supabase_auth_admin;
  incoming := jsonb_build_object('claims', jsonb_build_object('aud', 'authenticated', 'client_id', watch_client, 'role', 'authenticated', 'scope', 'openid'));
  actual := zodiacs_auth_private.access_token_hook(incoming);
  perform pg_temp.assert_shared_hook(actual = sky_watch.access_token_hook(incoming), 'Sky Watch token unchanged from original hook');
  perform pg_temp.assert_shared_hook(actual#>'{claims,zodiacs_permissions}' = '["sky:watch"]'::jsonb, 'watch gets only watch permission');
  incoming := jsonb_set(incoming, '{claims,client_id}', to_jsonb(account_client));
  actual := zodiacs_auth_private.access_token_hook(incoming);
  perform pg_temp.assert_shared_hook(actual = zodiacs_accounts_private.access_token_hook(incoming), 'account token matches original hook');
  perform pg_temp.assert_shared_hook(actual#>'{claims,zodiacs_permissions}' = '["profile:save"]'::jsonb, 'account gets only save permission');
  incoming := jsonb_set(incoming, '{claims,client_id}', to_jsonb(unknown_client));
  perform pg_temp.assert_shared_hook(zodiacs_auth_private.access_token_hook(incoming) = incoming, 'unlisted client unchanged');
  incoming := jsonb_set(incoming, '{claims,client_id}', '"malformed"'::jsonb);
  perform pg_temp.assert_shared_hook(zodiacs_auth_private.access_token_hook(incoming) = incoming, 'malformed client unchanged');
  incoming := incoming #- '{claims,client_id}';
  perform pg_temp.assert_shared_hook(zodiacs_auth_private.access_token_hook(incoming) = incoming, 'website sign-in unchanged');
  reset role;

  update sky_watch.oauth_clients set enabled = false where id = watch_client;
  update zodiacs_accounts_private.oauth_clients set enabled = false where id = account_client;
  set local role supabase_auth_admin;
  incoming := jsonb_set(incoming, '{claims,client_id}', to_jsonb(watch_client));
  perform pg_temp.assert_shared_hook(zodiacs_auth_private.access_token_hook(incoming) = incoming, 'disabled watch client unchanged');
  incoming := jsonb_set(incoming, '{claims,client_id}', to_jsonb(account_client));
  perform pg_temp.assert_shared_hook(zodiacs_auth_private.access_token_hook(incoming) = incoming, 'disabled account client unchanged');
  reset role;

  update sky_watch.oauth_clients set enabled = true where id = watch_client;
  insert into zodiacs_accounts_private.oauth_clients(id, resource) values (watch_client, 'https://zodiacs-accounts-test.vercel.app/mcp');
  set local role supabase_auth_admin;
  incoming := jsonb_set(incoming, '{claims,client_id}', to_jsonb(watch_client));
  perform pg_temp.assert_shared_hook(zodiacs_auth_private.access_token_hook(incoming) = incoming, 'ambiguous client receives neither preview permission');
  reset role;
end;
$$;
rollback;
