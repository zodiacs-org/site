\set ON_ERROR_STOP on

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users (id) values
  ('71000000-0000-4000-8000-000000000001'),
  ('71000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- Seed one existing v1 row as the table owner, the same privilege the
-- service role has. The payload is fake non-personal fixture data only.
insert into public.charts (id, user_id, payload) values (
  '74000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000001',
  '{"fixture":"write-block-existing"}'::jsonb
);

select pg_temp.assert_true(
  (select count(*) from public.charts
   where user_id = '71000000-0000-4000-8000-000000000001') = 1,
  'the fixture row must be present before the write-block probes'
);

select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000001',
  false
);
set role authenticated;

select pg_temp.assert_true(
  (select payload->>'fixture'
   from public.charts
   where id = '74000000-0000-4000-8000-000000000001') = 'write-block-existing',
  'authenticated select of an existing v1 row must still work'
);

do $block$
declare
  write_blocked boolean := false;
begin
  begin
    insert into public.charts (id, user_id, payload) values (
      '74000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000001',
      '{"fixture":"write-block-new"}'::jsonb
    );
  exception when insufficient_privilege then
    write_blocked := true;
  end;
  if not write_blocked then
    raise exception 'assertion failed: authenticated insert into public.charts must be refused';
  end if;
end;
$block$;

with changed as (
  update public.charts
  set payload = '{"fixture":"write-block-updated"}'::jsonb
  where id = '74000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  not exists (select 1 from changed)
    and (select payload->>'fixture'
         from public.charts
         where id = '74000000-0000-4000-8000-000000000001') = 'write-block-existing',
  'authenticated update of an existing v1 row must change nothing'
);

select pg_temp.assert_true(
  (select count(*) from public.charts
   where user_id = '71000000-0000-4000-8000-000000000001') = 1,
  'refused writes must leave the existing v1 row count unchanged'
);

insert into public.profiles (user_id)
values ('71000000-0000-4000-8000-000000000001')
on conflict (user_id) do update set updated_at = now();

insert into public.chart_deletions (user_id, id) values (
  '71000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000099'
);

with removed as (
  delete from public.charts
  where id = '74000000-0000-4000-8000-000000000001'
  returning 1
)
select pg_temp.assert_true(
  exists (select 1 from removed),
  'authenticated delete of an existing v1 row must still return the removed row'
);

select pg_temp.assert_true(
  not exists (
    select 1 from public.charts
    where id = '74000000-0000-4000-8000-000000000001'
  ),
  'authenticated delete of an existing v1 row must leave no row behind'
);

reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from pg_catalog.pg_policy
    where polrelid = 'public.charts'::regclass
      and polname = 'charts_writes_paused_insert'
      and not polpermissive
      and polcmd = 'a'
  )
    and exists (
      select 1
      from pg_catalog.pg_policy
      where polrelid = 'public.charts'::regclass
        and polname = 'charts_writes_paused_update'
        and not polpermissive
        and polcmd = 'w'
    )
    and exists (
      select 1
      from pg_catalog.pg_policy
      where polrelid = 'public.charts'::regclass
        and polname = 'charts_select_own'
        and polcmd = 'r'
    )
    and exists (
      select 1
      from pg_catalog.pg_policy
      where polrelid = 'public.charts'::regclass
        and polname = 'charts_delete_own'
        and polcmd = 'd'
    ),
  'the pause must be two restrictive write policies, with select and delete left in place'
);

select 'charts_writes_paused tests passed' as ok;
