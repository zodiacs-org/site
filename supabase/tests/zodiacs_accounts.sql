-- Disposable PostgreSQL only. Runs after bootstrap.sql and every migration,
-- with 20261015150000_zodiacs_accounts_assistant_saves.sql replayed once more
-- (as a reviewed SQL Editor retry would). Every fixture is rolled back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_accounts(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'Accounts assertion: %', message; end if; end; $$;

-- Grants: only the server's service role reaches the RPC; browsers never write a saved item.
select pg_temp.assert_accounts(not has_function_privilege('anon', 'public.zodiacs_accounts_v1(text,jsonb)', 'execute'), 'anonymous RPC denied');
select pg_temp.assert_accounts(not has_function_privilege('authenticated', 'public.zodiacs_accounts_v1(text,jsonb)', 'execute'), 'browser RPC denied');
select pg_temp.assert_accounts(has_function_privilege('service_role', 'public.zodiacs_accounts_v1(text,jsonb)', 'execute'), 'server may call the RPC');
select pg_temp.assert_accounts((select not prosecdef and 'search_path=pg_catalog' = any(proconfig) from pg_proc where oid = 'public.zodiacs_accounts_v1(text,jsonb)'::regprocedure), 'RPC is security invoker with a fixed path');
select pg_temp.assert_accounts(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'zodiacs_accounts_private' and p.prosecdef), 'no SECURITY DEFINER in the private schema');
select pg_temp.assert_accounts(not has_function_privilege('service_role', 'zodiacs_accounts_private.access_token_hook(jsonb)', 'execute'), 'only Auth runs the hook');
select pg_temp.assert_accounts(has_function_privilege('supabase_auth_admin', 'zodiacs_accounts_private.access_token_hook(jsonb)', 'execute'), 'Auth runs the hook');
-- saved_pages keeps the site's grants: browsers insert only user_id, kind, title and href.
select pg_temp.assert_accounts(not has_table_privilege('authenticated', 'public.saved_pages', 'update')
  and has_table_privilege('authenticated', 'public.saved_pages', 'select')
  and has_table_privilege('authenticated', 'public.saved_pages', 'delete')
  and has_column_privilege('authenticated', 'public.saved_pages', 'href', 'insert')
  and not has_column_privilege('authenticated', 'public.saved_pages', 'source', 'insert')
  and not has_column_privilege('authenticated', 'public.saved_pages', 'summary', 'insert')
  and not has_column_privilege('authenticated', 'public.saved_pages', 'detail', 'insert'), 'browsers cannot write assistant fields');
select pg_temp.assert_accounts(not has_table_privilege('anon', 'public.saved_pages', 'select'), 'anonymous reads nothing');
select pg_temp.assert_accounts(not has_table_privilege('service_role', 'zodiacs_accounts_private.auth_state', 'insert')
  and not has_table_privilege('service_role', 'zodiacs_accounts_private.auth_state', 'update')
  and not has_table_privilege('service_role', 'zodiacs_accounts_private.auth_state', 'delete'), 'the server cannot forge authorization facts');
select pg_temp.assert_accounts((select relrowsecurity from pg_class where oid = 'public.saved_pages'::regclass), 'RLS on saved pages');
select pg_temp.assert_accounts((select count(*) = 4 from pg_trigger where tgname like 'zodiacs_accounts_auth_%' and not tgisinternal), 'one projection trigger per Auth table after replay');

do $$
declare
  u uuid := gen_random_uuid(); other uuid := gen_random_uuid(); s uuid := gen_random_uuid(); c uuid := gen_random_uuid(); stranger uuid := gen_random_uuid();
  resource text := 'https://zodiacs.org/mcp';
  who jsonb; record jsonb; first jsonb; again jsonb; next jsonb; token jsonb; seen integer;
begin
  -- Auth's own role writes Auth; the invoker triggers keep the projection in the same transaction.
  set local role supabase_auth_admin;
  insert into auth.users(id) values (u), (other);
  insert into auth.oauth_clients(id) values (c), (stranger);
  insert into auth.sessions(id, user_id, oauth_client_id, scopes) values (s, u, c, 'openid email');
  insert into auth.sessions(id, user_id, scopes) values (gen_random_uuid(), u, 'openid');
  insert into auth.oauth_consents(user_id, client_id, scopes) values (u, c, 'openid email');
  reset role;
  perform pg_temp.assert_accounts((select count(*) = 1 from zodiacs_accounts_private.auth_state where kind = 'session'), 'website sessions are not projected');
  insert into zodiacs_accounts_private.oauth_clients(id, resource) values (c, resource);
  begin insert into zodiacs_accounts_private.oauth_clients(id, resource) values (stranger, 'https://attacker.example/mcp'); raise exception 'foreign audience allowed';
  exception when check_violation then null; end;

  -- The hook: audience and permission only for an enabled client; everything else unchanged and never failing.
  set local role supabase_auth_admin;
  token := zodiacs_accounts_private.access_token_hook(jsonb_build_object('claims', jsonb_build_object('client_id', c, 'scope', 'openid', 'aud', 'authenticated', 'sub', u)));
  perform pg_temp.assert_accounts(token#>>'{claims,aud}' = resource and (token#>'{claims,zodiacs_permissions}') ? 'profile:save', 'hook binds the exact audience and permission');
  token := zodiacs_accounts_private.access_token_hook(jsonb_build_object('claims', jsonb_build_object('aud', 'authenticated', 'sub', u)));
  perform pg_temp.assert_accounts(token = jsonb_build_object('claims', jsonb_build_object('aud', 'authenticated', 'sub', u)), 'website sign-in token unchanged');
  token := zodiacs_accounts_private.access_token_hook(jsonb_build_object('claims', jsonb_build_object('client_id', 'not-a-uuid', 'aud', 'authenticated')));
  perform pg_temp.assert_accounts(token#>>'{claims,aud}' = 'authenticated' and token#>'{claims,zodiacs_permissions}' is null, 'malformed client id unchanged');
  token := zodiacs_accounts_private.access_token_hook(jsonb_build_object('claims', jsonb_build_object('client_id', stranger, 'aud', 'authenticated')));
  perform pg_temp.assert_accounts(token#>>'{claims,aud}' = 'authenticated', 'unlisted client unchanged');
  reset role;

  set local role service_role;
  who := jsonb_build_object('user', u, 'session', s, 'client', c, 'resource', resource);
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('oauth', who) = 'true'::jsonb, 'valid connection accepted');
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('oauth', who || jsonb_build_object('resource', 'https://zodiacs-staging.vercel.app/mcp')) = 'false'::jsonb, 'wrong audience refused');
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('oauth', who || jsonb_build_object('user', other)) = 'false'::jsonb, 'another account refused');
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('oauth', who || jsonb_build_object('session', gen_random_uuid())) = 'false'::jsonb, 'unknown session refused');

  record := jsonb_build_object('schema', 'zodiacs.assistant-save.v1', 'kind', 'occasion', 'title', 'Wedding', 'summary', 'A good day.', 'data', jsonb_build_object('date', '2027-06-12'), 'links', '[]'::jsonb);
  first := public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Wedding, 2027-06-12', 'href', '/occasions/#o=wedding&d=2027-06-12', 'summary', 'A good day.', 'detail', record));
  perform pg_temp.assert_accounts((first->>'created')::boolean and first->>'id' is not null, 'first save created');
  perform pg_temp.assert_accounts((select source = 'assistant' and summary = 'A good day.' and detail = record from public.saved_pages where id = (first->>'id')::uuid), 'stored as an assistant row');
  again := public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Renamed', 'href', '/occasions/#o=wedding&d=2027-06-12', 'summary', 'Other.', 'detail', record));
  perform pg_temp.assert_accounts(not (again->>'created')::boolean and again->>'id' = first->>'id', 'the same link keeps one row');
  perform pg_temp.assert_accounts((select title from public.saved_pages where id = (first->>'id')::uuid) = 'Wedding, 2027-06-12', 'a repeat changes nothing already saved');
  next := public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'week', 'title', 'Your week from 2026-10-14', 'href', '/horoscopes/#week=2026-10-14', 'summary', 'Venus meets your Sun.', 'detail', record));
  perform pg_temp.assert_accounts((next->>'created')::boolean, 'a week is saved');
  perform pg_temp.assert_accounts((public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'chart', 'title', 'Ana', 'href', '/birth-chart/#c=abc', 'summary', 'Sun in Taurus.', 'detail', record))->>'created')::boolean, 'a chart is saved');
  begin perform public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'chart', 'title', 'Wrong path', 'href', '/occasions/#x', 'summary', 's', 'detail', record)); raise exception 'kind path mismatch stored';
  exception when check_violation then null; end;
  begin perform public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Markup', 'href', '/occasions/#m', 'summary', '<b>x</b>', 'detail', record)); raise exception 'markup summary stored';
  exception when check_violation then null; end;
  begin perform public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Huge', 'href', '/occasions/#h', 'summary', 's', 'detail', record || jsonb_build_object('data', repeat('x', 17000)))); raise exception 'oversized detail stored';
  exception when check_violation then null; end;
  begin perform public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Bare', 'href', '/occasions/#b')); raise exception 'assistant row without summary stored';
  exception when check_violation then null; end;
  begin perform public.zodiacs_accounts_v1('purge', who); raise exception 'unknown operation ran';
  exception when invalid_parameter_value then null; end;
  reset role;

  -- The owner reads and removes through RLS; another account sees nothing; a browser cannot forge an assistant row.
  perform set_config('request.jwt.claim.sub', other::text, true);
  set local role authenticated;
  select count(*) into seen from public.saved_pages;
  perform pg_temp.assert_accounts(seen = 0, 'another account sees nothing');
  delete from public.saved_pages;
  reset role;
  perform set_config('request.jwt.claim.sub', u::text, true);
  set local role authenticated;
  select count(*) into seen from public.saved_pages;
  perform pg_temp.assert_accounts(seen = 3, 'the owner sees all three items');
  begin insert into public.saved_pages(user_id, kind, title, href, source, summary, detail) values (u, 'occasion', 'Forged', '/occasions/#f', 'assistant', 's', record); raise exception 'browser assistant insert allowed';
  exception when insufficient_privilege then null; end;
  begin insert into public.saved_pages(user_id, kind, title, href) values (u, 'chart', 'Site chart', '/birth-chart/#c=x'); raise exception 'browser chart row allowed';
  exception when check_violation then null; end;
  insert into public.saved_pages(user_id, kind, title, href) values (u, 'compatibility', 'Site pair', '/compatibility/#a=x&b=y');
  begin update public.saved_pages set title = 'Changed'; raise exception 'browser update allowed';
  exception when insufficient_privilege then null; end;
  delete from public.saved_pages where id = (next->>'id')::uuid;
  reset role;
  perform pg_temp.assert_accounts((select count(*) = 3 from public.saved_pages where user_id = u), 'the owner removed one item; site and assistant rows share the list');

  -- One limit for both: 100 rows per account.
  insert into public.saved_pages(user_id, kind, title, href)
    select u, 'occasion', 'Filler', '/occasions/#filler=' || n from generate_series(1, 97) n;
  set local role service_role;
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'One more', 'href', '/occasions/#more', 'summary', 's', 'detail', record)) = '"full"'::jsonb, 'one hundred rows is the limit');
  perform pg_temp.assert_accounts(not (public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Again', 'href', '/occasions/#o=wedding&d=2027-06-12', 'summary', 's', 'detail', record))->>'created')::boolean, 'a repeat still answers at the limit');
  reset role;
  delete from public.saved_pages where title = 'Filler';

  -- Live revocation: consent, scope, expiry, session, ban, client deletion and disabling each stop saving.
  set local role supabase_auth_admin;
  update auth.oauth_consents set revoked_at = clock_timestamp() where user_id = u and client_id = c;
  reset role;
  set local role service_role;
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('oauth', who) = 'false'::jsonb, 'revoked consent refused');
  perform pg_temp.assert_accounts(public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Late', 'href', '/occasions/#late', 'summary', 's', 'detail', record)) = 'null'::jsonb, 'revoked consent saves nothing');
  reset role;
  set local role supabase_auth_admin;
  update auth.oauth_consents set revoked_at = null where user_id = u and client_id = c;
  update auth.sessions set scopes = 'email' where id = s;
  reset role;
  perform pg_temp.assert_accounts(not zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'scope downgrade refused');
  set local role supabase_auth_admin;
  update auth.sessions set scopes = 'openid', not_after = clock_timestamp() - interval '1 second' where id = s;
  reset role;
  perform pg_temp.assert_accounts(not zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'expired session refused');
  set local role supabase_auth_admin;
  update auth.sessions set not_after = null where id = s;
  reset role;
  perform pg_temp.assert_accounts(zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'restored session accepted');
  update zodiacs_accounts_private.oauth_clients set enabled = false where id = c;
  perform pg_temp.assert_accounts(not zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'disabled client refused');
  update zodiacs_accounts_private.oauth_clients set enabled = true where id = c;
  set local role supabase_auth_admin;
  update auth.users set banned_until = clock_timestamp() + interval '1 day' where id = u;
  reset role;
  perform pg_temp.assert_accounts(not zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'banned account refused');
  set local role supabase_auth_admin;
  update auth.users set banned_until = null where id = u;
  update auth.oauth_clients set deleted_at = clock_timestamp() where id = c;
  reset role;
  perform pg_temp.assert_accounts(not zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'deleted client refused');
  set local role supabase_auth_admin;
  update auth.oauth_clients set deleted_at = null where id = c;
  delete from auth.sessions where id = s;
  reset role;
  perform pg_temp.assert_accounts(not zodiacs_accounts_private.oauth_active(u, s, c, resource, clock_timestamp()), 'signed-out session refused');

  -- Deleting the account deletes its saved items and its projected facts.
  delete from auth.users where id = u;
  perform pg_temp.assert_accounts(not exists (select 1 from public.saved_pages where user_id = u), 'account deletion removes saved pages');
  perform pg_temp.assert_accounts(not exists (select 1 from zodiacs_accounts_private.auth_state where kind = 'user' and key = u::text), 'account deletion removes its facts');
end $$;
rollback;
select 'Accounts SQL passed: grants, hook, live checks, one row per link in saved_pages, owner-only RLS, the shared limit, revocation and deletion' as result;
