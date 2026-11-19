-- Keep event and outbox keys while the worker reconciles neighboring UTC partitions.
create function public.zodiacs_sky_watch_timing_v1(operation text, input jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  cursor_row sky_watch.progress%rowtype;
  revision text := input->>'version';
  candidates jsonb;
  item jsonb;
  event_at timestamptz;
  event_key text;
begin
  if revision is null or revision !~ '^sky-watch-v2:[a-z0-9.-]+$' then
    raise exception 'watch timing revision invalid';
  end if;

  if operation = 'timingwindow' then
    insert into sky_watch.progress(singleton,version,next_from)
      values(true, revision, (input->>'start')::timestamptz) on conflict do nothing;
  end if;
  select * into cursor_row from sky_watch.progress where singleton for update;

  if operation = 'timingwindow' then
    if cursor_row.version <> revision then
      if cursor_row.version !~ '^sky-watch-v1:[a-z0-9.-]+$' then
        raise exception 'watch timing migration required';
      end if;
      -- Replay across the old cursor so an event moved into the preceding day is still ingested.
      update sky_watch.progress set version=revision, next_from=cursor_row.next_from-interval '48 hours'
        where singleton returning * into cursor_row;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
      'eventId', id, 'name', name, 'timestamp', at, 'data', jsonb_build_object('event', payload#>'{data,event}')
    ) order by at, id), '[]'::jsonb) into candidates
    from sky_watch.ledger
    where at >= cursor_row.next_from-interval '48 hours' and at <= cursor_row.next_from+interval '72 hours';
    return jsonb_build_object('from', cursor_row.next_from, 'existing', candidates);
  end if;

  if operation <> 'timingingest' or cursor_row.version is distinct from revision then
    raise exception 'watch timing migration required';
  end if;
  if cursor_row.next_from is distinct from (input->>'from')::timestamptz then
    return to_jsonb(false);
  end if;
  if (input->>'to')::timestamptz is distinct from cursor_row.next_from+interval '24 hours'
    or jsonb_typeof(input->'events') is distinct from 'array' or jsonb_array_length(input->'events') > 100 then
    raise exception 'watch window invalid';
  end if;

  for item in select value from jsonb_array_elements(input->'events') loop
    event_at := (item->>'timestamp')::timestamptz;
    event_key := item->>'eventId';
    if event_at is null or event_at <= cursor_row.next_from or event_at > (input->>'to')::timestamptz
      or event_key is null or event_key !~ '^evt_[a-f0-9]{64}$' then
      raise exception 'watch event outside window';
    end if;
    insert into sky_watch.ledger(id,name,at,payload) values(event_key,item->>'name',event_at,item)
      on conflict (id) do update set at=excluded.at, payload=excluded.payload
      where sky_watch.ledger.name=excluded.name;
    if not found then raise exception 'watch event identity changed'; end if;
    -- An unattempted delivery follows the corrected time. Sent and in-flight deliveries retain their key and state.
    update sky_watch.outbox set due_at=event_at
      where event_id=event_key and state='pending' and attempts=0;
  end loop;
  update sky_watch.progress set next_from=(input->>'to')::timestamptz where singleton;
  return to_jsonb(true);
end;
$$;

revoke all on function public.zodiacs_sky_watch_timing_v1(text,jsonb) from public, anon, authenticated;
grant execute on function public.zodiacs_sky_watch_timing_v1(text,jsonb) to service_role;
