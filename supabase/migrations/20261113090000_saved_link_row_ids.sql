-- Saved result links carry the saved row's own id (owner approved, 13 November 2026).
--
-- An assistant save whose page cannot carry the details links to that page with
-- `saved=<value>` after the # (`/birth-chart/#saved=...`, `/occasions/#saved=...`,
-- `/compatibility/<pair>/#saved=...`, `/horoscopes/#week=<date>&saved=...`), and the
-- page sends the link on to `/profile/#saved=...`. Until now the value was the first
-- 16 hex digits of an unkeyed SHA-256 of the stored record. A saved week's record is
-- worked out from the birth date, so someone holding the link could test guessed
-- birth dates against it. From now on the value is the saved_pages row's own id, a
-- random UUID that says nothing about what was saved. This migration:
--   1. replaces public.zodiacs_accounts_v1 so a `saved=` link is stored under the id
--      it carries (the server sends it as `id`; any other value in the link is
--      replaced by the row id), and the same item saved again is found by what was
--      stored (account, kind, title, worked-out result and the link apart from its
--      id) instead of by its link, under the account's own lock;
--   2. rewrites every stored href whose `saved=` value is not its row's own id (the
--      old 16 hex digests) to carry the row id. Only href changes: the id, title,
--      summary, detail, source and saved_at of every row stay exactly as they are.
--      An old digest then matches no row, so its link opens the plain profile page;
--   3. adds a check that any `saved=` value in a stored href is that row's own id.
--
-- Count-only checks to run before and after: docs/platform/accounts/saved-link-ids-verify.sql.
-- Replay-safe: the function is replaced, the rewrite finds nothing the second time,
-- and the check is dropped and added again. Run after
-- 20261015150000_zodiacs_accounts_assistant_saves.sql.
-- UTC filename; not applied to any database until the owner approves it.

-- 1. The server's only entry point, as 20261015150000 left it except for saved= links.
create or replace function public.zodiacs_accounts_v1(operation text, input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  now_at timestamptz := clock_timestamp();
  owner uuid; saved public.saved_pages%rowtype;
  link text := input->>'href';
  stored jsonb := input->'detail';
  row_id uuid;
begin
  if operation not in ('oauth', 'save') then raise exception using errcode = '22023', message = 'Unsupported accounts operation'; end if;
  if input->>'user' is null or input->>'session' is null or input->>'client' is null or input->>'resource' is null
    or not zodiacs_accounts_private.oauth_active((input->>'user')::uuid, (input->>'session')::uuid, (input->>'client')::uuid, input->>'resource', now_at) then
    return case when operation = 'oauth' then to_jsonb(false) else 'null'::jsonb end;
  end if;
  if operation = 'oauth' then return to_jsonb(true); end if;
  owner := (input->>'user')::uuid;

  -- A saved= link: the row is stored under the random id the link carries, and
  -- nothing in the link is worked out from what was saved.
  if link ~ '^[^#]*#([^&]*&)*saved=' then
    row_id := case when input->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (input->>'id')::uuid else gen_random_uuid() end;
    link := regexp_replace(link, '^([^#]*#(?:[^&]*&)*)saved=[^&]*', '\1saved=' || row_id::text);
    if jsonb_typeof(stored) = 'object' and stored ? 'href' then stored := jsonb_set(stored, '{href}', to_jsonb(link)); end if;
    -- The same item saved again is one row, left exactly as it was: the same kind,
    -- title and worked-out result, and the same link apart from its id. The
    -- account's lock (the one saved_pages' limit trigger takes) keeps two
    -- simultaneous repeats to one row.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('saved_pages:' || owner::text, 0));
    select * into saved from public.saved_pages
      where user_id = owner and source = 'assistant' and kind = input->>'kind' and title = input->>'title'
        and detail->'data' is not distinct from stored->'data'
        and regexp_replace(href, '^([^#]*#(?:[^&]*&)*)saved=[^&]*', '\1saved=') = regexp_replace(link, '^([^#]*#(?:[^&]*&)*)saved=[^&]*', '\1saved=')
      order by saved_at, id limit 1;
    if found then
      return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
    end if;
    begin
      insert into public.saved_pages(id, user_id, kind, title, href, source, summary, detail)
        values (row_id, owner, input->>'kind', input->>'title', link, 'assistant', input->>'summary', stored)
        returning * into saved;
    exception
      when raise_exception then
        if sqlerrm = 'saved_pages_full' then return to_jsonb('full'::text); end if;
        raise;
    end;
    return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', true);
  end if;

  -- Any other link, as before. The same link saved by the assistant again: one
  -- row, left exactly as it was. The same link saved on the site holds only the
  -- link, so the assistant's record (with its summary and worked-out result)
  -- takes its place.
  select * into saved from public.saved_pages where user_id = owner and href = link;
  if found and saved.source = 'assistant' then
    return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
  end if;
  if found then delete from public.saved_pages where id = saved.id; end if;
  begin
    -- saved_pages' own trigger serialises per account and enforces the 100-row limit.
    insert into public.saved_pages(user_id, kind, title, href, source, summary, detail)
      values (owner, input->>'kind', input->>'title', link, 'assistant', input->>'summary', input->'detail')
      returning * into saved;
  exception
    when unique_violation then
      select * into saved from public.saved_pages where user_id = owner and href = link;
      return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', false);
    when raise_exception then
      if sqlerrm = 'saved_pages_full' then return to_jsonb('full'::text); end if;
      raise;
  end;
  return jsonb_build_object('id', saved.id, 'saved_at', saved.saved_at, 'created', true);
end;
$$;
revoke all on function public.zodiacs_accounts_v1(text, jsonb) from public, anon, authenticated;
grant execute on function public.zodiacs_accounts_v1(text, jsonb) to service_role;

-- 2. Stored links: the saved= value becomes the row's own id. Only href is set.
update public.saved_pages
  set href = regexp_replace(href, '^([^#]*#(?:[^&]*&)*)saved=[^&]*', '\1saved=' || id::text)
  where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') is distinct from id::text;

-- 3. From now on a saved= value in a stored link is that row's own id.
alter table public.saved_pages drop constraint if exists saved_pages_saved_link_id;
alter table public.saved_pages add constraint saved_pages_saved_link_id check (
  href !~ '^[^#]*#([^&]*&)*saved=' or substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text
);
