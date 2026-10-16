-- Saved pages contract tests (disposable PostgreSQL only).
\set ON_ERROR_STOP 1

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
  ('00000000-0000-4000-8000-0000000000a1'),
  ('00000000-0000-4000-8000-0000000000b2')
on conflict do nothing;

-- 1. RLS is on, with exactly the three owner policies and no update policy.
do $$
declare enabled boolean; names text[];
begin
  select relrowsecurity into enabled from pg_class where oid = 'public.saved_pages'::regclass;
  perform pg_temp.assert_true(enabled, 'saved_pages must have RLS enabled');
  select array_agg(policyname order by policyname) into names
    from pg_policies where schemaname = 'public' and tablename = 'saved_pages';
  perform pg_temp.assert_true(
    names = array['saved_pages_delete_own', 'saved_pages_insert_own', 'saved_pages_select_own'],
    format('unexpected policies: %s', names)
  );
end $$;

-- 2. anon holds nothing; authenticated may select, insert and delete, never update.
do $$
begin
  perform pg_temp.assert_true(not has_table_privilege('anon', 'public.saved_pages', 'SELECT'), 'anon must not select');
  perform pg_temp.assert_true(not has_table_privilege('anon', 'public.saved_pages', 'INSERT'), 'anon must not insert');
  perform pg_temp.assert_true(not has_table_privilege('anon', 'public.saved_pages', 'DELETE'), 'anon must not delete');
  perform pg_temp.assert_true(has_table_privilege('authenticated', 'public.saved_pages', 'SELECT'), 'authenticated selects');
  perform pg_temp.assert_true(has_table_privilege('authenticated', 'public.saved_pages', 'DELETE'), 'authenticated deletes');
  perform pg_temp.assert_true(not has_table_privilege('authenticated', 'public.saved_pages', 'UPDATE'), 'authenticated must not update');
  perform pg_temp.assert_true(has_column_privilege('authenticated', 'public.saved_pages', 'href', 'INSERT'), 'authenticated inserts href');
  perform pg_temp.assert_true(not has_column_privilege('authenticated', 'public.saved_pages', 'saved_at', 'INSERT'), 'saved_at is server-set');
  perform pg_temp.assert_true(not has_column_privilege('authenticated', 'public.saved_pages', 'id', 'INSERT'), 'id is server-set');
end $$;

-- 3. An owner saves and reads their own rows.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', false);

insert into public.saved_pages (kind, title, href)
values ('occasion', 'The sky on our wedding day', '/occasions/#o=wedding&d=2027-06-12');
insert into public.saved_pages (user_id, kind, title, href)
values ('00000000-0000-4000-8000-0000000000a1', 'compatibility', 'Ana and Ben · compatibility', '/compatibility/#a=1.x&b=1.y');

do $$
begin
  perform pg_temp.assert_true((select count(*) from public.saved_pages) = 2, 'owner sees both rows');
  perform pg_temp.assert_true(
    (select bool_and(user_id = '00000000-0000-4000-8000-0000000000a1') from public.saved_pages),
    'user_id defaults to auth.uid()'
  );
end $$;

-- 4. The same link twice is a unique violation (the client reports "already saved").
do $$
begin
  insert into public.saved_pages (kind, title, href)
  values ('occasion', 'Again', '/occasions/#o=wedding&d=2027-06-12');
  raise exception 'duplicate href was accepted';
exception when unique_violation then
  null;
end $$;

-- 5. Shapes the table refuses.
do $$
declare bad record;
begin
  for bad in
    select * from (values
      ('chart', 'Chart', '/birth-chart/#x'),
      ('occasion', 'Wrong path', '/compatibility/#a=1'),
      ('compatibility', 'Wrong path', '/occasions/#d=1'),
      ('occasion', 'Off site', '//evil.example/occasions/'),
      ('occasion', 'Absolute', 'https://zodiacs.org/occasions/#d=1'),
      ('occasion', 'Space', '/occasions/#n=a b'),
      ('occasion', 'Backslash', '/occasions/\evil'),
      ('occasion', '', '/occasions/#d=2'),
      ('occasion', repeat('t', 161), '/occasions/#d=3'),
      ('occasion', 'Long', '/occasions/#' || repeat('d', 2048))
    ) as v(kind, title, href)
  loop
    begin
      insert into public.saved_pages (kind, title, href) values (bad.kind, bad.title, bad.href);
      raise exception 'accepted bad row: % %', bad.kind, bad.href;
    exception when check_violation then
      null;
    end;
  end loop;
end $$;

-- 6. Rows cannot be updated.
do $$
begin
  update public.saved_pages set title = 'Changed';
  raise exception 'update was allowed';
exception when insufficient_privilege then
  null;
end $$;

-- 7. Nobody writes or reads another account's rows.
do $$
begin
  insert into public.saved_pages (user_id, kind, title, href)
  values ('00000000-0000-4000-8000-0000000000b2', 'occasion', 'Planted', '/occasions/#d=planted');
  raise exception 'insert for another account was allowed';
exception when insufficient_privilege then
  null;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', false);
do $$
begin
  perform pg_temp.assert_true((select count(*) from public.saved_pages) = 0, 'B sees none of A''s rows');
end $$;
delete from public.saved_pages;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000a1', false);
do $$
begin
  perform pg_temp.assert_true((select count(*) from public.saved_pages) = 2, 'B''s delete removed none of A''s rows');
end $$;

-- 8. The owner deletes their own row.
delete from public.saved_pages where kind = 'compatibility';
do $$
begin
  perform pg_temp.assert_true((select count(*) from public.saved_pages) = 1, 'owner deleted one row');
end $$;

-- 9. At most 100 rows per account.
insert into public.saved_pages (kind, title, href)
select 'occasion', 'Card ' || n, '/occasions/#d=' || n from generate_series(1, 99) as n;
do $$
begin
  insert into public.saved_pages (kind, title, href) values ('occasion', 'One too many', '/occasions/#d=extra');
  raise exception 'the 101st row was accepted';
exception when raise_exception then
  perform pg_temp.assert_true(sqlerrm = 'saved_pages_full', format('unexpected message %s', sqlerrm));
end $$;

-- 10. anon reads nothing.
reset role;
set role anon;
do $$
begin
  perform count(*) from public.saved_pages;
  raise exception 'anon could read saved_pages';
exception when insufficient_privilege then
  null;
end $$;

-- 11. Deleting the account deletes its rows.
reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000a1';
do $$
begin
  perform pg_temp.assert_true(
    (select count(*) from public.saved_pages where user_id = '00000000-0000-4000-8000-0000000000a1') = 0,
    'rows cascade with the auth user'
  );
end $$;

select 'saved_pages contract tests passed' as result;
