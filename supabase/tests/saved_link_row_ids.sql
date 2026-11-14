-- Disposable PostgreSQL only. Runs after saved_link_row_ids_fixture.sql and a
-- replay of 20261113091500_saved_link_row_ids.sql (as a reviewed SQL Editor retry
-- would): the old 16 hex digest links and the records' copies of them carry their
-- row's own id (an account being deleted included), every other saved= value and
-- every other column is as it was, rows a UUID would push past a size limit are
-- left whole, the old digests match nothing, the deleting gate is back on, and the
-- save RPC stores a saved= link under the random id it carries, taking the account
-- owner lock before the saved pages lock. Every value is synthetic; the fixture's rows
-- are removed at the end.
\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_saved_links(ok boolean, message text) returns void language plpgsql as $$
begin if not coalesce(ok, false) then raise exception 'Saved link assertion: %', message; end if; end; $$;

-- 1. The stored links: each saved= value is now the row's own id, and only href changed.
select pg_temp.assert_saved_links((select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000a1')
  = '/birth-chart/#saved=00000000-0000-4000-8000-0000000000a1', 'a chart link carries its row id');
select pg_temp.assert_saved_links((select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000a2')
  = '/compatibility/aries-leo/#saved=00000000-0000-4000-8000-0000000000a2', 'a comparison link keeps its pair page');
select pg_temp.assert_saved_links((select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000a3')
  = '/occasions/#saved=00000000-0000-4000-8000-0000000000a3', 'an occasion link carries its row id');
select pg_temp.assert_saved_links((select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000a4')
  = '/horoscopes/#week=2026-10-19&saved=00000000-0000-4000-8000-0000000000a4', 'a week link keeps its week');
select pg_temp.assert_saved_links((select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000d1')
  = '/birth-chart/#saved=00000000-0000-4000-8000-0000000000d1'
  and (select detail->>'href' from public.saved_pages where id = '00000000-0000-4000-8000-0000000000d1')
  = '/birth-chart/#saved=00000000-0000-4000-8000-0000000000d1', 'an account being deleted has its digest link rewritten too');
select pg_temp.assert_saved_links((select status = 'deleting' from private.account_states where user_id = '00000000-0000-4000-8000-00000000f002')
  and (select count(*) = 1 from public.saved_pages where user_id = '00000000-0000-4000-8000-00000000f002'), 'the deleting account is still deleting and kept its one row');
-- Only the old digests are rewritten: any other saved= value stays as it was.
select pg_temp.assert_saved_links((select href = '/birth-chart/#saved=00000000-0000-4000-8000-0000000000ff'
  and detail->>'href' = href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000a5'), 'a UUID that is not the row id is left alone');
select pg_temp.assert_saved_links((select href = '/occasions/#saved=0123456789ABCDEF' and detail->>'href' = href
  from public.saved_pages where id = '00000000-0000-4000-8000-0000000000b3'), 'upper case hex is not an old digest');
select pg_temp.assert_saved_links((select href = '/occasions/#saved=testvalue' and detail->>'href' = href
  from public.saved_pages where id = '00000000-0000-4000-8000-0000000000b4'), 'a word is not an old digest');
-- Size limits: nothing is cut. A link a UUID would make too long stays whole, and so does
-- its record; a record a UUID would make too large keeps its copy while the link moves.
select pg_temp.assert_saved_links((select href ~ '&saved=8888888888888888$' and char_length(href) = 2040 and detail->>'href' = href
  from public.saved_pages where id = '00000000-0000-4000-8000-0000000000e1'), 'an href that would pass 2,048 characters is left whole');
select pg_temp.assert_saved_links((select href = '/occasions/#saved=00000000-0000-4000-8000-0000000000e2'
  and detail->>'href' = '/occasions/#saved=9999999999999999' and octet_length(detail::text) = 16379
  from public.saved_pages where id = '00000000-0000-4000-8000-0000000000e2'), 'a record that would pass 16,384 bytes is left whole');
select pg_temp.assert_saved_links((select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000b1') = '/people/test-person/'
  and (select href from public.saved_pages where id = '00000000-0000-4000-8000-0000000000b2') = '/occasions/#o=wedding&d=2027-06-12',
  'links without saved= are untouched');
-- The record's copy of the link follows the link where it held a digest; the rest of the record is as it was.
select pg_temp.assert_saved_links((select count(*) = 4 and bool_and(detail->>'href' = href)
  from public.saved_pages where id::text ~ '^00000000-0000-4000-8000-0000000000a[1-4]$'), 'a digest in the record''s copy of the link becomes the row''s link');
select pg_temp.assert_saved_links((select count(*) = 5 from public.saved_pages p join (values
  ('00000000-0000-4000-8000-0000000000a1'::uuid, '{"schema":"zodiacs.assistant-save.v1","kind":"chart","title":"Birth chart","summary":"Sun in Aries.","data":{"sun":"aries"},"links":[]}'::jsonb),
  ('00000000-0000-4000-8000-0000000000a2', '{"schema":"zodiacs.assistant-save.v1","kind":"comparison","title":"Aries and Leo: 70 out of 100","summary":"Good. Test pair.","data":{"score":70},"links":[]}'),
  ('00000000-0000-4000-8000-0000000000a3', '{"schema":"zodiacs.assistant-save.v1","kind":"occasion","title":"Birthday: 70 out of 100","summary":"Good.","data":{"occasion":"birthday"},"links":[]}'),
  ('00000000-0000-4000-8000-0000000000a4', '{"schema":"zodiacs.assistant-save.v1","kind":"week","title":"Your week from 2026-10-19","summary":"No close contacts to your chart this week.","data":{"from":"2026-10-19","items":[]},"links":[]}'),
  ('00000000-0000-4000-8000-0000000000d1', '{"schema":"zodiacs.assistant-save.v1","kind":"chart","title":"Birth chart","summary":"Sun in Aries.","data":{"sun":"aries"},"links":[]}')
  ) as kept(id, record) on p.id = kept.id where p.detail - 'href' = kept.record), 'the rest of each stored record is left exactly as it was');
select pg_temp.assert_saved_links((select detail->>'href' = '/people/test-person/' from public.saved_pages where id = '00000000-0000-4000-8000-0000000000b1')
  and (select detail is null from public.saved_pages where id = '00000000-0000-4000-8000-0000000000b2'), 'records without a digest are untouched');
select pg_temp.assert_saved_links((select count(*) = 11 and bool_and(saved_at < '2026-10-30T00:00:00Z')
  from public.saved_pages where user_id = '00000000-0000-4000-8000-00000000f001'), 'no row was added, removed or re-dated');
select pg_temp.assert_saved_links((select title = 'Your week from 2026-10-19' and summary = 'No close contacts to your chart this week.' and source = 'assistant'
  and saved_at = '2026-10-23T00:00:00Z' from public.saved_pages where id = '00000000-0000-4000-8000-0000000000a4'), 'title, summary, source and date unchanged');
-- The old digests open nothing: no stored link carries one, apart from the rows a size limit held back.
select pg_temp.assert_saved_links((select array_agg(id::text order by id) = array['00000000-0000-4000-8000-0000000000e1']
  from public.saved_pages where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'), 'no other 16 hex digest is left in a link');
select pg_temp.assert_saved_links((select array_agg(id::text order by id) = array['00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2']
  from public.saved_pages where coalesce(detail->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'), 'no other 16 hex digest is left in a record''s copy of its link');

-- 2. The deleting gate is on again and still refuses the deleting account's writes.
select pg_temp.assert_saved_links((select tgenabled = 'O' from pg_catalog.pg_trigger
  where tgrelid = 'public.saved_pages'::regclass and tgname = 'account_v2_terminal_gate'), 'the deleting gate is enabled after the migration');
do $$
begin
  begin
    insert into public.saved_pages(user_id, kind, title, href) values ('00000000-0000-4000-8000-00000000f002', 'occasion', 'After', '/occasions/#o=after');
    raise exception 'a deleting account was written to';
  exception when insufficient_privilege then null; end;
end $$;

-- 3. The check: no new row carries a 16 hex saved= value. It waits, NOT VALID, while a held-back row has one.
select pg_temp.assert_saved_links((select count(*) = 1 and not bool_or(convalidated) from pg_catalog.pg_constraint
  where conrelid = 'public.saved_pages'::regclass and conname = 'saved_pages_no_digest_link'), 'the check is present and waits for the held-back rows');
select pg_temp.assert_saved_links((select count(*) = 0 from pg_catalog.pg_constraint
  where conrelid = 'public.saved_pages'::regclass and conname = 'saved_pages_saved_link_id'), 'the earlier draft''s check is gone');
do $$
begin
  begin
    insert into public.saved_pages(user_id, kind, title, href, source, summary, detail)
      values ('00000000-0000-4000-8000-00000000f001', 'occasion', 'Digest', '/occasions/#saved=4444444444444444', 'assistant', 's',
        '{"schema":"zodiacs.assistant-save.v1"}');
    raise exception 'a digest link was stored';
  exception when check_violation then null; end;
  begin
    insert into public.saved_pages(user_id, kind, title, href, source, summary, detail)
      values ('00000000-0000-4000-8000-00000000f001', 'occasion', 'Digest copy', '/occasions/#saved=00000000-0000-4000-8000-0000000000c2', 'assistant', 's',
        '{"schema":"zodiacs.assistant-save.v1","href":"/occasions/#saved=4444444444444444"}');
    raise exception 'a digest in a record''s copy of its link was stored';
  exception when check_violation then null; end;
end $$;

-- 4. Lock order: the save function takes the account owner lock before the saved pages
-- lock, as account_v2_terminal_gate and saved_pages_limit do on every insert.
-- supabase/tests/saved_link_lock_order.sql runs a save against a held owner lock.
select pg_temp.assert_saved_links((select position('7312025' in d) > 0 and position('7312025' in d) < position('saved_pages:' in d)
  from (select pg_catalog.pg_get_functiondef('public.zodiacs_accounts_v1(text, jsonb)'::regprocedure) as d) f),
  'the owner lock comes before the saved pages lock');

-- 5. The RPC: a saved= link is stored under the id it carries; a repeat is found by what was stored.
do $$
declare
  u uuid := gen_random_uuid(); s uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  first_id uuid := gen_random_uuid(); second_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid();
  who jsonb; week jsonb; first jsonb; again jsonb; labelled jsonb; old_shape jsonb; mismatched jsonb; kept integer;
  link text;
begin
  set local role supabase_auth_admin;
  insert into auth.users(id) values (u);
  insert into auth.oauth_clients(id) values (c);
  insert into auth.sessions(id, user_id, oauth_client_id, scopes) values (s, u, c, 'openid');
  insert into auth.oauth_consents(user_id, client_id, scopes) values (u, c, 'openid');
  reset role;
  insert into zodiacs_accounts_private.oauth_clients(id, resource) values (c, 'https://zodiacs.org/mcp');
  who := jsonb_build_object('user', u, 'session', s, 'client', c, 'resource', 'https://zodiacs.org/mcp');
  week := jsonb_build_object('schema', 'zodiacs.assistant-save.v1', 'kind', 'week', 'title', 'Your week from 2026-11-09', 'summary', 'No close contacts to your chart this week.',
    'data', jsonb_build_object('from', '2026-11-09', 'items', '[]'::jsonb), 'links', '[]'::jsonb);

  set local role service_role;
  link := '/horoscopes/#week=2026-11-09&saved=' || first_id;
  first := public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', first_id, 'kind', 'week', 'title', 'Your week from 2026-11-09', 'href', link,
    'summary', 'No close contacts to your chart this week.', 'detail', week || jsonb_build_object('href', link)));
  perform pg_temp.assert_saved_links((first->>'created')::boolean and first->>'id' = first_id::text, 'stored under the id its link carries');
  reset role;
  perform pg_temp.assert_saved_links((select href = link and detail->>'href' = link and detail - 'href' = week from public.saved_pages where id = first_id), 'link and record as sent');

  -- The same week saved again gets a fresh id from the server; the database finds the row it already holds.
  set local role service_role;
  link := '/horoscopes/#week=2026-11-09&saved=' || second_id;
  again := public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', second_id, 'kind', 'week', 'title', 'Your week from 2026-11-09', 'href', link,
    'summary', 'No close contacts to your chart this week.', 'detail', week || jsonb_build_object('href', link)));
  perform pg_temp.assert_saved_links(not (again->>'created')::boolean and again->>'id' = first_id::text, 'a repeat keeps one row');
  -- A label is a different saved item.
  labelled := public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', second_id, 'kind', 'week', 'title', 'Mine', 'href', link,
    'summary', 'No close contacts to your chart this week.', 'detail', week || jsonb_build_object('title', 'Mine', 'href', link)));
  perform pg_temp.assert_saved_links((labelled->>'created')::boolean and labelled->>'id' = second_id::text, 'a labelled save is its own row');
  -- A different week is a different item.
  perform pg_temp.assert_saved_links((public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', gen_random_uuid(), 'kind', 'week', 'title', 'Your week from 2026-11-09',
    'href', '/horoscopes/#week=2026-11-09&saved=' || gen_random_uuid(), 'summary', 'Venus meets your Sun.',
    'detail', week || jsonb_build_object('data', jsonb_build_object('from', '2026-11-09', 'items', jsonb_build_array('Venus meets your Sun'))))) ->>'created')::boolean,
    'other contacts are another row');
  -- A server still writing the digest, or a link whose value is not the id it sends: the row id goes in the link.
  old_shape := public.zodiacs_accounts_v1('save', who || jsonb_build_object('kind', 'occasion', 'title', 'Birthday: 70 out of 100', 'href', '/occasions/#saved=5555555555555555',
    'summary', 'Good.', 'detail', jsonb_build_object('schema', 'zodiacs.assistant-save.v1', 'data', jsonb_build_object('occasion', 'birthday'), 'href', '/occasions/#saved=5555555555555555')));
  mismatched := public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', other_id, 'kind', 'chart', 'title', 'Birth chart', 'href', '/birth-chart/#saved=' || gen_random_uuid(),
    'summary', 'Sun in Aries.', 'detail', jsonb_build_object('schema', 'zodiacs.assistant-save.v1', 'data', jsonb_build_object('sun', 'aries'))));
  reset role;
  perform pg_temp.assert_saved_links((select href = '/occasions/#saved=' || id and detail->>'href' = href from public.saved_pages where id = (old_shape->>'id')::uuid),
    'a digest sent by the server is replaced by the row id');
  perform pg_temp.assert_saved_links((select id = other_id and href = '/birth-chart/#saved=' || other_id and not (detail ? 'href') from public.saved_pages where id = (mismatched->>'id')::uuid),
    'the link carries the id the row is stored under');
  perform pg_temp.assert_saved_links((select count(*) = 5 from public.saved_pages where user_id = u), 'five items saved');

  -- At the limit a repeat still answers with its row, and a new item is refused.
  insert into public.saved_pages(user_id, kind, title, href) select u, 'occasion', 'Filler', '/occasions/#filler=' || n from generate_series(1, 95) n;
  set local role service_role;
  link := '/horoscopes/#week=2026-11-09&saved=' || gen_random_uuid();
  again := public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', substring(link from 'saved=(.*)$'), 'kind', 'week', 'title', 'Your week from 2026-11-09', 'href', link,
    'summary', 'No close contacts to your chart this week.', 'detail', week || jsonb_build_object('href', link)));
  perform pg_temp.assert_saved_links(not (again->>'created')::boolean and again->>'id' = first_id::text, 'a repeat still answers at the limit');
  perform pg_temp.assert_saved_links(public.zodiacs_accounts_v1('save', who || jsonb_build_object('id', gen_random_uuid(), 'kind', 'chart', 'title', 'One more',
    'href', '/birth-chart/#saved=' || gen_random_uuid(), 'summary', 's', 'detail', jsonb_build_object('schema', 'zodiacs.assistant-save.v1'))) = '"full"'::jsonb, 'one hundred rows is the limit');
  reset role;
  select count(*) into kept from public.saved_pages where user_id = u;
  perform pg_temp.assert_saved_links(kept = 100, 'nothing added past the limit');
end $$;

rollback;

-- The fixture's rows and accounts go; with no held-back row left, the check validates.
alter table public.saved_pages disable trigger account_v2_terminal_gate;
delete from public.saved_pages where user_id in ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000f002');
alter table public.saved_pages enable trigger account_v2_terminal_gate;
delete from auth.users where id in ('00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-00000000f002');
alter table public.saved_pages validate constraint saved_pages_no_digest_link;
do $$
begin
  if not (select bool_and(convalidated) from pg_catalog.pg_constraint
    where conrelid = 'public.saved_pages'::regclass and conname = 'saved_pages_no_digest_link') then
    raise exception 'Saved link assertion: the check validates once no digest is stored';
  end if;
end $$;
select 'Saved link SQL passed: old digest links and their record copies carry their row id, other values are left alone, a field a UUID would push past its limit keeps its old value, the deleting gate is back, and saves take the owner lock first' as result;
