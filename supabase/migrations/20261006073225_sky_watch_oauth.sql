-- Isolated preview OAuth adapter. No browser role can read the watch store.
-- The issuer signs identity; these live checks enforce client/session/consent revocation.
create table sky_watch.oauth_clients (
  id uuid primary key,
  resource text not null check (resource ~ '^https://[a-z0-9-]+\.vercel\.app/mcp$'),
  enabled boolean not null default true
);
alter table sky_watch.oauth_clients enable row level security;
revoke all on sky_watch.oauth_clients from public, anon, authenticated;
grant select, insert, update, delete on sky_watch.oauth_clients to service_role;
grant usage on schema sky_watch to supabase_auth_admin;
grant select on sky_watch.oauth_clients to supabase_auth_admin;
create policy oauth_hook_client_lookup on sky_watch.oauth_clients for select to supabase_auth_admin using (true);

alter table sky_watch.principals alter column token_hash drop not null;
alter table sky_watch.principals add column oauth_session uuid unique;
alter table sky_watch.principals add column oauth_user uuid;
alter table sky_watch.principals add column oauth_client uuid;
alter table sky_watch.principals add constraint principal_credential_kind check (
  (token_hash is not null and oauth_session is null and oauth_user is null and oauth_client is null)
  or (token_hash is null and oauth_session is not null and oauth_user is not null and oauth_client is not null)
);

-- Column-limited access keeps both functions SECURITY INVOKER. Auth is not an
-- exposed Data API schema; callers still require the server's service credential.
grant usage on schema auth to service_role;
grant select (id,user_id,oauth_client_id,not_after,scopes) on auth.sessions to service_role;
grant select (user_id,client_id,scopes,revoked_at) on auth.oauth_consents to service_role;
grant select (id,deleted_at) on auth.oauth_clients to service_role;
grant select (id,banned_until,deleted_at) on auth.users to service_role;

create function sky_watch.oauth_active(user_id uuid, session_id uuid, client_id uuid, at_time timestamptz)
returns boolean language sql stable security invoker set search_path=pg_catalog as $$
  select exists (
    select 1 from auth.sessions s
    join auth.users u on u.id=s.user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<=$4)
    join auth.oauth_clients c on c.id=s.oauth_client_id and c.deleted_at is null
    join sky_watch.oauth_clients allowed on allowed.id=c.id and allowed.enabled
    join auth.oauth_consents consent on consent.client_id=c.id and consent.user_id=u.id and consent.revoked_at is null
    where s.id=$2 and s.user_id=$1 and s.oauth_client_id=$3
      and (s.not_after is null or s.not_after>$4)
      and 'openid'=any(string_to_array(s.scopes,' ')) and 'openid'=any(string_to_array(consent.scopes,' '))
  );
$$;
revoke all on function sky_watch.oauth_active(uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function sky_watch.oauth_active(uuid,uuid,uuid,timestamptz) to service_role;

create function sky_watch.access_active(principal_id uuid, at_time timestamptz)
returns boolean language sql stable security invoker set search_path=pg_catalog as $$
  select exists(select 1 from sky_watch.principals p where p.id=principal_id and not p.revoked and p.expires_at>at_time
    and (p.oauth_session is null or sky_watch.oauth_active(p.oauth_user,p.oauth_session,p.oauth_client,at_time)));
$$;
revoke all on function sky_watch.access_active(uuid,timestamptz) from public, anon, authenticated;
grant execute on function sky_watch.access_active(uuid,timestamptz) to service_role;

-- A dedicated registered client has exactly one MCP audience. Identity scopes
-- stay with the provider; sky:watch is a separate server-issued permission.
create function sky_watch.access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
declare claims jsonb:=event->'claims'; audience text;
begin
  select resource into audience from sky_watch.oauth_clients
    where id=(claims->>'client_id')::uuid and enabled;
  if audience is not null then
    claims:=claims || jsonb_build_object('aud',audience,'zodiacs_permissions',jsonb_build_array('sky:watch'));
  end if;
  return jsonb_build_object('claims',claims);
end;
$$;
revoke all on function sky_watch.access_token_hook(jsonb) from public, anon, authenticated, service_role;
grant execute on function sky_watch.access_token_hook(jsonb) to supabase_auth_admin;

create or replace function public.zodiacs_sky_watch_v1(operation text, input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  now_at timestamptz := clock_timestamp();
  principal sky_watch.principals%rowtype;
  sub sky_watch.subscriptions%rowtype;
  work sky_watch.outbox%rowtype;
  progress sky_watch.progress%rowtype;
  item jsonb;
  until_at timestamptz;
  new_lease uuid;
begin
  if operation = 'oauth' then
    if not exists(select 1 from sky_watch.oauth_clients where id=(input->>'client')::uuid and enabled and resource=input->>'resource')
      or not sky_watch.oauth_active((input->>'user')::uuid,(input->>'session')::uuid,(input->>'client')::uuid,now_at) then return null; end if;
    insert into sky_watch.principals(oauth_user,oauth_session,oauth_client,expires_at)
      values((input->>'user')::uuid,(input->>'session')::uuid,(input->>'client')::uuid,now_at+interval '7 days')
      on conflict(oauth_session) do update set expires_at=excluded.expires_at
      where not sky_watch.principals.revoked and sky_watch.principals.oauth_user=excluded.oauth_user and sky_watch.principals.oauth_client=excluded.oauth_client
      returning * into principal;
    if principal.id is null then return null; end if;
    return jsonb_build_object('id',principal.id,'expires_at',principal.expires_at);
  end if;
  if operation = 'grant' then
    insert into sky_watch.principals(token_hash,expires_at) values(input->>'token_hash',now_at+interval '7 days') returning * into principal;
    return jsonb_build_object('id',principal.id,'expires_at',principal.expires_at);
  end if;
  if operation = 'authenticate' then
    select * into principal from sky_watch.principals
      where token_hash = input->>'token_hash' and not revoked and expires_at > now_at;
    if not found then return null; end if;
    return jsonb_build_object('id', principal.id, 'expires_at', principal.expires_at);
  end if;
  if operation in ('get','subscribe','unsubscribe') then
    select * into principal from sky_watch.principals where id = (input->>'owner')::uuid and sky_watch.access_active(id,now_at) for update;
    if not found then raise exception 'watch access unavailable'; end if;
    if exists(select 1 from sky_watch.subscriptions where id=input->>'id' and owner<>principal.id) then raise exception 'watch ownership mismatch'; end if;
    select * into sub from sky_watch.subscriptions where id = input->>'id' and owner = principal.id for update;
    if sub.id is null and (select count(*) from sky_watch.subscriptions where owner=principal.id) >= 1000 then raise exception 'watch metadata limit'; end if;
    if operation = 'get' then
      if sub.id is null then return null; end if;
      return jsonb_build_object('sealed',case when sub.active and sub.expires_at > now_at then sub.sealed else null end,
        'verified_until',sub.verified_until,'revision',sub.revision);
    elsif operation = 'unsubscribe' then
      -- A tombstone also cancels a creation whose callback is still being verified.
      insert into sky_watch.subscriptions(id,owner,name,filters,verified_until,expires_at,active)
        values(input->>'id',principal.id,input->>'name',input->'filters',now_at,now_at,false)
      on conflict(id) do update set active=false,sealed=null,previous_sealed=null,expires_at=now_at,revision=sky_watch.subscriptions.revision+1;
      delete from sky_watch.outbox where subscription_id=input->>'id';
      return '{}'::jsonb;
    end if;
    if coalesce(sub.revision,0) <> (input->>'expected_revision')::bigint then return null; end if;
    if (sub.id is null or not sub.active or sub.expires_at<=now_at) and (select count(*) from sky_watch.subscriptions where owner=principal.id and active and expires_at>now_at) >= 20 then
      raise exception 'watch subscription limit';
    end if;
    if sub.id is not null and (not sub.active or sub.expires_at<=now_at) then delete from sky_watch.outbox where subscription_id=sub.id; end if;
    until_at := least(principal.expires_at, now_at + make_interval(secs => least(604800000, greatest(1,(input->>'ttl_ms')::bigint))/1000.0));
    insert into sky_watch.subscriptions(id,owner,name,filters,sealed,verified_until,expires_at)
      values(input->>'id',principal.id,input->>'name',input->'filters',input->>'sealed',now_at+interval '10 minutes',until_at)
    on conflict(id) do update set
      sealed=excluded.sealed,
      previous_sealed=case when (input->>'rotated')::boolean then sky_watch.subscriptions.sealed
        when sky_watch.subscriptions.rotate_until > now_at then sky_watch.subscriptions.previous_sealed else null end,
      rotate_until=case when (input->>'rotated')::boolean then now_at+interval '5 minutes' else sky_watch.subscriptions.rotate_until end,
      started_at=case when not sky_watch.subscriptions.active or sky_watch.subscriptions.expires_at <= now_at then now_at else sky_watch.subscriptions.started_at end,
      verified_until=case when (input->>'verified')::boolean then excluded.verified_until else sky_watch.subscriptions.verified_until end,
      expires_at=excluded.expires_at,active=true,revision=sky_watch.subscriptions.revision+1;
    return jsonb_build_object('expires_at',until_at);
  elsif operation = 'revoke' then
    update sky_watch.principals set revoked=true where id=(input->>'owner')::uuid;
    update sky_watch.subscriptions set active=false,sealed=null,previous_sealed=null,expires_at=now_at,revision=revision+1 where owner=(input->>'owner')::uuid;
    delete from sky_watch.outbox where subscription_id in (select id from sky_watch.subscriptions where owner=(input->>'owner')::uuid);
    return '{}'::jsonb;
  elsif operation = 'window' then
    insert into sky_watch.progress(singleton,version,next_from) values(true,input->>'version',(input->>'start')::timestamptz) on conflict do nothing;
    select * into progress from sky_watch.progress;
    if progress.version <> input->>'version' then raise exception 'watch engine migration required'; end if;
    return to_jsonb(progress.next_from);
  elsif operation = 'ingest' then
    select * into progress from sky_watch.progress for update;
    if progress.version is null or progress.version <> input->>'version' then raise exception 'watch engine migration required'; end if;
    if progress.next_from <> (input->>'from')::timestamptz then return to_jsonb(false); end if;
    if (input->>'to')::timestamptz <> progress.next_from + interval '24 hours' or jsonb_array_length(input->'events') > 100 then raise exception 'watch window invalid'; end if;
    for item in select value from jsonb_array_elements(input->'events') loop
      if (item->>'timestamp')::timestamptz <= progress.next_from or (item->>'timestamp')::timestamptz > (input->>'to')::timestamptz then raise exception 'watch event outside window'; end if;
      insert into sky_watch.ledger(id,name,at,payload) values(item->>'eventId',item->>'name',(item->>'timestamp')::timestamptz,item) on conflict do nothing;
    end loop;
    update sky_watch.progress set next_from=(input->>'to')::timestamptz where singleton = true;
    return to_jsonb(true);
  elsif operation = 'enqueue' then
    -- Maintenance is bounded by the short preview TTL and the one-month ledger retention.
    update sky_watch.subscriptions s set active=false,sealed=null,previous_sealed=null,revision=revision+1
      where s.active and (s.expires_at<=now_at or not exists(select 1 from sky_watch.principals p where p.id=s.owner and sky_watch.access_active(p.id,now_at)));
    update sky_watch.subscriptions set previous_sealed=null where previous_sealed is not null and rotate_until<=now_at;
    delete from sky_watch.outbox o where exists(select 1 from sky_watch.subscriptions s where s.id=o.subscription_id and not s.active);
    delete from sky_watch.ledger where at < now_at-interval '30 days';
    delete from sky_watch.subscriptions where not active and expires_at < now_at-interval '30 days';
    delete from sky_watch.principals where expires_at < now_at-interval '30 days';
    update sky_watch.outbox set state='failed',lease=null,lease_until=null where state='leased' and lease_until<=now_at and attempts>=8;
    insert into sky_watch.outbox(subscription_id,event_id,due_at)
      select s.id,e.id,e.at from sky_watch.subscriptions s join sky_watch.principals p on p.id=s.owner
      join sky_watch.ledger e on e.name=s.name and e.at>s.started_at and e.at<=s.expires_at
      where s.active and s.expires_at>now_at and sky_watch.access_active(p.id,now_at)
        and (case when e.name='zodiacs.sky.lunation' then (s.filters->'phases') ? (e.payload#>>'{data,event,type}')
          else (s.filters->'bodies') ? (e.payload#>>'{data,event,body}') end)
      on conflict do nothing;
    return '{}'::jsonb;
  elsif operation = 'claim' then
    select o.* into work from sky_watch.outbox o join sky_watch.subscriptions s on s.id=o.subscription_id
      join sky_watch.principals p on p.id=s.owner
      where ((o.state='pending' and o.due_at<=now_at) or (o.state='leased' and o.lease_until<=now_at))
        and o.attempts<8 and s.active and s.expires_at>now_at and sky_watch.access_active(p.id,now_at)
      order by o.due_at,o.subscription_id,o.event_id limit 1 for update of o skip locked;
    if not found then return null; end if;
    new_lease:=gen_random_uuid();
    update sky_watch.outbox set state='leased',attempts=attempts+1,lease=new_lease,lease_until=now_at+interval '2 minutes'
      where subscription_id=work.subscription_id and event_id=work.event_id;
    select * into sub from sky_watch.subscriptions where id=work.subscription_id;
    return jsonb_build_object('subscription_id',sub.id,'event_id',work.event_id,'lease',new_lease,'attempts',work.attempts+1,
      'sealed',sub.sealed,'previous_sealed',sub.previous_sealed,'rotate_until',sub.rotate_until,'filters',sub.filters,'revision',sub.revision,
      'payload',(select payload from sky_watch.ledger where id=work.event_id));
  elsif operation = 'permit' then
    return to_jsonb(exists(select 1 from sky_watch.outbox o join sky_watch.subscriptions s on s.id=o.subscription_id join sky_watch.principals p on p.id=s.owner
      where o.subscription_id=input->>'id' and o.event_id=input->>'event' and o.lease=(input->>'lease')::uuid and o.state='leased' and o.lease_until>now_at
        and s.revision=(input->>'revision')::bigint and s.active and s.expires_at>now_at and sky_watch.access_active(p.id,now_at)));
  elsif operation = 'settle' then
    -- Keep cancellation, refresh, maintenance and completion in sub -> outbox lock order.
    perform 1 from sky_watch.subscriptions where id=input->>'id' for update;
    update sky_watch.outbox set state=case input->>'outcome' when 'sent' then 'sent' when 'retry' then 'pending' else 'failed' end,
      due_at=now_at+make_interval(secs=>least(3600,greatest(0,(input->>'delay_seconds')::integer))),lease=null,lease_until=null
      where subscription_id=input->>'id' and event_id=input->>'event' and lease=(input->>'lease')::uuid and state='leased' and lease_until>now_at;
    if found and input->>'outcome'='gone' then
      update sky_watch.subscriptions set active=false,sealed=null,previous_sealed=null,expires_at=now_at,revision=revision+1 where id=input->>'id';
      delete from sky_watch.outbox where subscription_id=input->>'id';
    end if;
    return '{}'::jsonb;
  end if;
  raise exception 'watch operation unavailable';
end;
$$;
revoke all on function public.zodiacs_sky_watch_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.zodiacs_sky_watch_v1(text,jsonb) to service_role;
