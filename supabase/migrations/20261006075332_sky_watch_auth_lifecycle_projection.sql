-- Hosted Auth tables do not give postgres the option to delegate their SELECT
-- grants. Copy only authorization facts in the same transaction as Auth changes.
-- Auth alone writes this projection; the worker can only read it. No identity
-- profile, email, password, access token or refresh token is copied.
create table sky_watch.auth_state (
  kind text not null check(kind in ('user','session','client','consent')),
  key text not null,
  state jsonb not null,
  primary key(kind,key)
);
alter table sky_watch.auth_state enable row level security;
revoke all on sky_watch.auth_state from public,anon,authenticated,service_role;
grant select on sky_watch.auth_state to service_role;
grant select,insert,update,delete on sky_watch.auth_state to supabase_auth_admin;
create policy auth_maintains_authorization_facts on sky_watch.auth_state
  for all to supabase_auth_admin using(true) with check(true);

create function sky_watch.capture_auth_state() returns trigger
language plpgsql security invoker set search_path=pg_catalog as $$
declare row_data jsonb; kind_name text; key_value text; fact jsonb;
begin
  row_data:=case when TG_OP='DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  if TG_TABLE_NAME='users' then
    kind_name:='user'; key_value:=row_data->>'id';
    fact:=jsonb_build_object('banned_until',row_data->'banned_until','deleted_at',row_data->'deleted_at');
  elsif TG_TABLE_NAME='sessions' then
    kind_name:='session'; key_value:=row_data->>'id';
    fact:=jsonb_build_object('user',row_data->'user_id','client',row_data->'oauth_client_id','not_after',row_data->'not_after','scopes',row_data->'scopes');
    if TG_OP<>'DELETE' and row_data->>'oauth_client_id' is null then
      delete from sky_watch.auth_state where kind=kind_name and key=key_value;
      return NEW;
    end if;
  elsif TG_TABLE_NAME='oauth_clients' then
    kind_name:='client'; key_value:=row_data->>'id';
    fact:=jsonb_build_object('deleted_at',row_data->'deleted_at');
  elsif TG_TABLE_NAME='oauth_consents' then
    kind_name:='consent'; key_value:=(row_data->>'user_id')||':'||(row_data->>'client_id');
    fact:=jsonb_build_object('revoked_at',row_data->'revoked_at','scopes',row_data->'scopes');
  else raise exception 'unsupported authorization source'; end if;
  if TG_OP='DELETE' then
    delete from sky_watch.auth_state where kind=kind_name and key=key_value;
    return OLD;
  end if;
  insert into sky_watch.auth_state(kind,key,state) values(kind_name,key_value,fact)
    on conflict(kind,key) do update set state=excluded.state;
  return NEW;
end $$;
revoke all on function sky_watch.capture_auth_state() from public,anon,authenticated,service_role;
grant execute on function sky_watch.capture_auth_state() to supabase_auth_admin;

create trigger sky_watch_auth_user after insert or update or delete on auth.users for each row execute function sky_watch.capture_auth_state();
create trigger sky_watch_auth_session after insert or update or delete on auth.sessions for each row execute function sky_watch.capture_auth_state();
create trigger sky_watch_auth_client after insert or update or delete on auth.oauth_clients for each row execute function sky_watch.capture_auth_state();
create trigger sky_watch_auth_consent after insert or update or delete on auth.oauth_consents for each row execute function sky_watch.capture_auth_state();

insert into sky_watch.auth_state select 'user',id::text,jsonb_build_object('banned_until',banned_until,'deleted_at',deleted_at) from auth.users;
insert into sky_watch.auth_state select 'session',id::text,jsonb_build_object('user',user_id,'client',oauth_client_id,'not_after',not_after,'scopes',scopes) from auth.sessions where oauth_client_id is not null;
insert into sky_watch.auth_state select 'client',id::text,jsonb_build_object('deleted_at',deleted_at) from auth.oauth_clients;
insert into sky_watch.auth_state select 'consent',user_id::text||':'||client_id::text,jsonb_build_object('revoked_at',revoked_at,'scopes',scopes) from auth.oauth_consents;

create or replace function sky_watch.oauth_active(user_id uuid, session_id uuid, client_id uuid, at_time timestamptz)
returns boolean language sql stable security invoker set search_path=pg_catalog as $$
  select exists (
    select 1 from sky_watch.auth_state s
    join sky_watch.auth_state u on u.kind='user' and u.key=$1::text
    join sky_watch.auth_state c on c.kind='client' and c.key=$3::text
    join sky_watch.auth_state consent on consent.kind='consent' and consent.key=$1::text||':'||$3::text
    join sky_watch.oauth_clients allowed on allowed.id=$3 and allowed.enabled
    where s.kind='session' and s.key=$2::text and s.state->>'user'=$1::text and s.state->>'client'=$3::text
      and u.state->>'deleted_at' is null and (u.state->>'banned_until' is null or (u.state->>'banned_until')::timestamptz<=$4)
      and c.state->>'deleted_at' is null and consent.state->>'revoked_at' is null
      and (s.state->>'not_after' is null or (s.state->>'not_after')::timestamptz>$4)
      and 'openid'=any(string_to_array(s.state->>'scopes',' ')) and 'openid'=any(string_to_array(consent.state->>'scopes',' '))
  );
$$;
revoke all on function sky_watch.oauth_active(uuid,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function sky_watch.oauth_active(uuid,uuid,uuid,timestamptz) to service_role;
