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
--   1. where the accounts layer is installed, replaces public.zodiacs_accounts_v1
--      so a `saved=` link is stored under the id it carries (the server sends it
--      as `id`; any other value in the link is replaced by the row id), and the same item saved again is found by what was
--      stored (account, kind, title, worked-out result and the link apart from its
--      id) instead of by its link. Lock order is the one every saved_pages insert
--      uses since 20261113090000_account_sync_v2_retention.sql: the account owner
--      lock (account_v2_terminal_gate) first, taken before either path reads,
--      deletes or inserts a row (as that migration's own version of the function
--      does, so a site row is never deleted before it), then the account's saved
--      pages lock (saved_pages_limit);
--   2. rewrites the old digest links, and only those: a stored href whose `saved=`
--      value is exactly 16 lowercase hex digits gets the row's own id in its place,
--      and where the stored record's own copy of the link (detail's href) carries
--      such a value, that copy is set to the rewritten href (where the detail column
--      exists). Any other `saved=` value (a UUID, or anything else) is left exactly
--      as it is. Nothing else changes: the id, title, summary, source, saved_at and
--      the rest of detail stay as they are.
--      An old digest then matches no row, so its link opens the plain profile page.
--      Size limits: a UUID is 20 characters longer than a digest, and nothing is
--      cut short. Each field is held to its own limit. A row whose rewritten href
--      would pass 2,048 characters keeps both its href and detail's href as they
--      were (detail's copy follows href only once href is rewritten). A row whose
--      href fits but whose rewritten detail would pass 16,384 bytes gets the new
--      href while detail's href keeps the old value. They show in the verify
--      file's `digest_href_too_long` and `digest_detail_too_long` counts.
--      The deleting gate: account_v2_terminal_gate refuses any write to the rows of
--      an account being deleted. The rewrite must not skip those rows, so for this
--      one statement block the gate is switched off on saved_pages only, under an
--      ACCESS EXCLUSIVE lock on saved_pages that no other session's read or write
--      can pass until this transaction ends, and switched back on before the block
--      ends (a failure rolls the whole block back, gate included). The rewrite
--      changes links in place; it adds and removes no row and touches no other
--      table;
--   3. adds check `saved_pages_no_digest_link`: no new or changed row may carry a
--      16 hex `saved=` value in its href or, where the detail column exists, in
--      detail's href. It is added NOT VALID (saved_pages rows are inserted and
--      deleted, never updated, so it holds every new write) and validated straight
--      away when no stored row still has one, which is every row unless a size
--      limit above held one back.
--
-- Two database shapes. With the accounts layer
-- (20261015150000_zodiacs_accounts_assistant_saves.sql: the zodiacs_accounts_private
-- schema, public.zodiacs_accounts_v1, and saved_pages' source, summary and detail
-- columns) every step above runs. Without it (production on 13 November 2026:
-- saved_pages is id, user_id, kind, title, href, saved_at) step 1 is skipped, so the
-- accounts layer's own migration stays the definition there, and steps 2 and 3 cover
-- href only. Every statement that names a column or function only one shape has
-- runs through EXECUTE, so the file parses and runs on both.
--
-- Re-apply after the accounts layer reaches a database. 20261015150000 defines the
-- save RPC without row ids (it finds a repeat by its link), and 20261113090000
-- defines it with the owner lock but still without row ids. Either one applied
-- after this file puts that version back, and the detail column arrives after this
-- file wrote its check for href only. Run this file again right after them: it
-- replaces the RPC and adds the check again with the detail clause (the rewrites
-- normally find nothing by then). The verify file's accounts_function_row_ids and
-- check_covers_detail counts show whether it is needed.
--
-- Count-only checks to run before and after: docs/platform/accounts/saved-link-ids-verify.sql.
-- Replay-safe: the function is replaced, the rewrites find nothing the second time,
-- and the check is dropped and added again. Run after
-- 20261015150000_zodiacs_accounts_assistant_saves.sql (where it is applied) and
-- 20261113090000_account_sync_v2_retention.sql.
-- UTC filename; not applied to any database until the owner approves it.

-- 1. The server's only entry point, as 20261015150000 left it except for saved= links.
-- Only where it exists with what it reads: the OAuth check and the assistant columns.
do $migration$
begin
  if pg_catalog.to_regprocedure('public.zodiacs_accounts_v1(text, jsonb)') is null
    or pg_catalog.to_regnamespace('zodiacs_accounts_private') is null
    or pg_catalog.to_regprocedure('zodiacs_accounts_private.oauth_active(uuid, uuid, uuid, text, timestamptz)') is null
    or (select count(*) from pg_catalog.pg_attribute
        where attrelid = 'public.saved_pages'::regclass and attnum > 0 and not attisdropped
          and attname in ('source', 'summary', 'detail')) <> 3
  then
    raise notice 'saved_link_row_ids: the accounts layer is not installed; public.zodiacs_accounts_v1 is left to its own migration (re-apply this file after it)';
    return;
  end if;
  execute $ddl$
create or replace function public.zodiacs_accounts_v1(operation text, input jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $fn$
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
  -- The account owner lock (the one account_v2_terminal_gate takes in every
  -- saved_pages insert, and deletion prepare takes before it erases saved_pages)
  -- comes first, before either path below reads, deletes or inserts a row. Taken
  -- later, the site row replacement would hold the row it deleted while waiting
  -- on this lock, and deletion prepare would hold the lock while waiting on that
  -- row: a deadlock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner::text, 7312025));

  -- A saved= link: the row is stored under the random id the link carries, and
  -- nothing in the link is worked out from what was saved.
  if link ~ '^[^#]*#([^&]*&)*saved=' then
    row_id := case when input->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (input->>'id')::uuid else gen_random_uuid() end;
    link := regexp_replace(link, '^([^#]*#(?:[^&]*&)*)saved=[^&]*', '\1saved=' || row_id::text);
    if jsonb_typeof(stored) = 'object' and stored ? 'href' then stored := jsonb_set(stored, '{href}', to_jsonb(link)); end if;
    -- The same item saved again is one row, left exactly as it was: the same kind,
    -- title and worked-out result, and the same link apart from its id. The
    -- account's saved pages lock (the one saved_pages' limit trigger takes) keeps
    -- two simultaneous repeats to one row. It comes after the owner lock taken
    -- above, as in every saved_pages insert (account_v2_terminal_gate, then
    -- saved_pages_limit), so this save and another write for the same account
    -- never wait on each other in opposite orders.
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
$fn$
$ddl$;
  execute 'revoke all on function public.zodiacs_accounts_v1(text, jsonb) from public, anon, authenticated';
  execute 'grant execute on function public.zodiacs_accounts_v1(text, jsonb) to service_role';
end;
$migration$;

-- 2. Stored links: an old digest (exactly 16 lowercase hex digits) becomes the row's
-- own id, in href and, where the column exists, in detail's copy of it. See the
-- header for the gate and limits.
do $$
declare
  digest constant text := '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)';
  gate_on boolean;
  has_detail boolean;
begin
  lock table public.saved_pages in access exclusive mode;
  select exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.saved_pages'::regclass and attname = 'detail' and attnum > 0 and not attisdropped
  ) into has_detail;
  select coalesce(bool_or(tgenabled <> 'D'), false) into gate_on
    from pg_catalog.pg_trigger
    where tgrelid = 'public.saved_pages'::regclass and tgname = 'account_v2_terminal_gate' and not tgisinternal;
  if gate_on then
    alter table public.saved_pages disable trigger account_v2_terminal_gate;
  end if;

  update public.saved_pages p
    set href = r.new_href
    from (
      select id, regexp_replace(href, '^([^#]*#(?:[^&]*&)*)saved=[0-9a-f]{16}(?=&|$)', '\1saved=' || id::text) as new_href
      from public.saved_pages
      where href ~ digest
    ) r
    where p.id = r.id and char_length(r.new_href) <= 2048;

  if has_detail then
    execute $rewrite$
      update public.saved_pages
        set detail = jsonb_set(detail, '{href}', to_jsonb(href))
        where jsonb_typeof(detail) = 'object' and detail ? 'href'
          and detail->>'href' ~ $1
          and href !~ $1
          and octet_length(jsonb_set(detail, '{href}', to_jsonb(href))::text) <= 16384
    $rewrite$ using digest;
  end if;

  if gate_on then
    alter table public.saved_pages enable trigger account_v2_terminal_gate;
  end if;
end;
$$;

-- 3. From now on no stored link carries a 16 hex saved= value: href everywhere, and
-- detail's href where the column exists. Validated at once when no stored row still
-- has one.
do $$
declare
  digest constant text := '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)';
  rule text;
  held_back boolean;
begin
  rule := format('href !~ %L', digest);
  if exists (
    select 1 from pg_catalog.pg_attribute
    where attrelid = 'public.saved_pages'::regclass and attname = 'detail' and attnum > 0 and not attisdropped
  ) then
    rule := rule || format(' and coalesce(detail->>''href'', '''') !~ %L', digest);
  end if;
  alter table public.saved_pages drop constraint if exists saved_pages_saved_link_id; -- an earlier draft's name
  alter table public.saved_pages drop constraint if exists saved_pages_no_digest_link;
  execute format('alter table public.saved_pages add constraint saved_pages_no_digest_link check (%s) not valid', rule);
  execute format('select exists (select 1 from public.saved_pages where not (%s))', rule) into held_back;
  if not held_back then
    alter table public.saved_pages validate constraint saved_pages_no_digest_link;
  end if;
end;
$$;
