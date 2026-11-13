-- Read-only checks for supabase/migrations/20261113091500_saved_link_row_ids.sql.
-- Run once before applying the migration and once after. Every query returns
-- counts only: never an href, title, summary, detail, user id or row id.
--
-- Expected after the migration:
--   old_digest_links = 0
--   old_digest_detail_links = 0 (no stored record's copy of its link keeps a digest)
--   saved_links = row_id_links (every saved= link carries its own row id)
--   saved_links and total_rows unchanged from the run before (the migration
--   rewrites links, it never adds or removes a row)
--   check_present = 1

select
  count(*) as total_rows,
  count(*) filter (where href like '%saved=%') as saved_links,
  count(*) filter (where href ~ '[#&]saved=[0-9a-f]{16}(&|$)') as old_digest_links,
  count(*) filter (where jsonb_typeof(detail) = 'object' and detail ? 'href'
    and detail->>'href' ~ '[#&]saved=[0-9a-f]{16}(&|$)') as old_digest_detail_links,
  count(*) filter (where href ~ '[#&]saved=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(&|$)') as uuid_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text) as row_id_links
from public.saved_pages;

-- The same counts by kind (chart, compatibility, occasion, week).
select
  kind,
  count(*) as total_rows,
  count(*) filter (where href like '%saved=%') as saved_links,
  count(*) filter (where href ~ '[#&]saved=[0-9a-f]{16}(&|$)') as old_digest_links,
  count(*) filter (where jsonb_typeof(detail) = 'object' and detail ? 'href'
    and detail->>'href' ~ '[#&]saved=[0-9a-f]{16}(&|$)') as old_digest_detail_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text) as row_id_links
from public.saved_pages
group by kind
order by kind;

-- The check the migration adds (0 before, 1 after).
select count(*) as check_present
from pg_catalog.pg_constraint
where conrelid = 'public.saved_pages'::regclass and conname = 'saved_pages_saved_link_id';
