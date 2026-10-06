-- Run in the isolated local test database; every fixture is rolled back.
begin;
do $$
declare u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); p jsonb; same jsonb; token jsonb; lease jsonb;
begin
  -- Auth's actual role must update the projection through invoker triggers.
  set local role supabase_auth_admin;
  insert into auth.users(id) values(u);
  insert into auth.oauth_clients(id) values(c);
  insert into auth.sessions(id,user_id,oauth_client_id,scopes) values(s,u,c,'openid email');
  insert into auth.oauth_consents(user_id,client_id,scopes) values(u,c,'openid email');
  reset role;
  if has_table_privilege('service_role','sky_watch.auth_state','insert')
    or has_table_privilege('service_role','sky_watch.auth_state','update')
    or has_table_privilege('service_role','sky_watch.auth_state','delete') then raise exception 'worker can forge authorization facts'; end if;
  insert into sky_watch.oauth_clients(id,resource) values(c,'https://zodiacs-sky-watch-test.vercel.app/mcp');
  set local role service_role;
  p:=public.zodiacs_sky_watch_v1('oauth',jsonb_build_object('user',u,'session',s,'client',c,'resource','https://zodiacs-sky-watch-test.vercel.app/mcp'));
  if p is null then raise exception 'valid OAuth access refused'; end if;
  same:=public.zodiacs_sky_watch_v1('oauth',jsonb_build_object('user',u,'session',s,'client',c,'resource','https://zodiacs-sky-watch-test.vercel.app/mcp'));
  if same->>'id'<>p->>'id' then raise exception 'refresh changed identity'; end if;
  if public.zodiacs_sky_watch_v1('oauth',jsonb_build_object('user',gen_random_uuid(),'session',s,'client',c,'resource','https://zodiacs-sky-watch-test.vercel.app/mcp')) is not null then raise exception 'cross-account session accepted'; end if;
  if public.zodiacs_sky_watch_v1('oauth',jsonb_build_object('user',u,'session',s,'client',c,'resource','https://other.example/mcp')) is not null then raise exception 'wrong resource accepted'; end if;
  reset role;
  set local role supabase_auth_admin;
  token:=sky_watch.access_token_hook(jsonb_build_object('claims',jsonb_build_object('client_id',c,'scope','openid','aud','authenticated')));
  if token#>>'{claims,aud}'<>'https://zodiacs-sky-watch-test.vercel.app/mcp' or not (token#>'{claims,zodiacs_permissions}') ? 'sky:watch' then raise exception 'hook did not bind resource permission'; end if;
  reset role;
  set local role supabase_auth_admin;
  update auth.oauth_consents set revoked_at=clock_timestamp() where user_id=u and client_id=c;
  reset role;
  set local role service_role;
  if sky_watch.access_active((p->>'id')::uuid,clock_timestamp()) then raise exception 'revoked consent still active'; end if;
  reset role;
  update auth.oauth_consents set revoked_at=null where user_id=u and client_id=c;
  update auth.sessions set scopes='email' where id=s;
  if sky_watch.access_active((p->>'id')::uuid,clock_timestamp()) then raise exception 'scope downgrade still active'; end if;
  update auth.sessions set scopes='openid',not_after=clock_timestamp()-interval '1 second' where id=s;
  if sky_watch.access_active((p->>'id')::uuid,clock_timestamp()) then raise exception 'expired session still active'; end if;
  update auth.sessions set not_after=null where id=s;
  update auth.users set banned_until=clock_timestamp()+interval '1 day' where id=u;
  if sky_watch.access_active((p->>'id')::uuid,clock_timestamp()) then raise exception 'banned user still active'; end if;
  update auth.users set banned_until=null where id=u;
  update sky_watch.oauth_clients set enabled=false where id=c;
  if sky_watch.access_active((p->>'id')::uuid,clock_timestamp()) then raise exception 'disabled client still active'; end if;
  update sky_watch.oauth_clients set enabled=true where id=c;
  set local role supabase_auth_admin;
  delete from auth.sessions where id=s;
  reset role;
  if sky_watch.access_active((p->>'id')::uuid,clock_timestamp()) then raise exception 'deleted session still active'; end if;
  set local role service_role;
  lease:=public.zodiacs_sky_watch_v1('workerclaim');
  if lease is null then raise exception 'worker could not claim'; end if;
  if public.zodiacs_sky_watch_v1('workerclaim') is not null then raise exception 'overlapping worker permitted'; end if;
  perform public.zodiacs_sky_watch_v1('workerdone',jsonb_build_object('lease',lease,'ok',true));
  if not (select last_ok from sky_watch.worker_state where singleton) then raise exception 'worker health not saved'; end if;
  reset role;
end $$;
rollback;
