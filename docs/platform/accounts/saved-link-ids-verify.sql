-- Read-only checks for supabase/migrations/20261113091500_saved_link_row_ids.sql.
-- Run once before applying the migration and once after. Every query returns
-- counts only: never an href, title, summary, detail, user id or row id. The
-- second query also returns each row's kind (chart, compatibility, occasion or
-- week), the grouping label, beside its counts.
--
-- An "old digest" is a saved= value of exactly 16 lowercase hex digits after
-- the #, the only form the migration rewrites.
--
-- Before the migration, as a preflight:
--   digest_href_too_long and digest_detail_too_long should be 0. A row counted
--   there would pass a size limit once its digest became a 36 character id
--   (href 2,048 characters, detail 16,384 bytes). Nothing is cut, and each
--   field is held to its own limit: a row counted in digest_href_too_long keeps
--   both its href and detail's href as they were; a row counted only in
--   digest_detail_too_long gets the new href while detail's href keeps the old
--   value. Either way the check stays NOT VALID.
--   other_saved_links counts saved= links that are neither an old digest nor
--   their row's own id (for example a UUID written before the migration by the
--   new server through the old save function). The migration leaves them as
--   they are, and they still open the saved item on the profile. Note the number
--   and check it is the same after.
--
-- Expected after the migration:
--   old_digest_links = digest_href_too_long from the run before (normally 0)
--   old_digest_detail_links = 0 unless a size limit held a row back (normally 0)
--   total_rows, saved_links and other_saved_links unchanged from the run before
--     (the migration rewrites links, it never adds or removes a row)
--   row_id_links = the run before's row_id_links + (the run before's
--     old_digest_links - digest_href_too_long)
--   check_present = 1, check_validated = 1 (0 only if a size limit held a row back)

select
  count(*) as total_rows,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=') as saved_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_links,
  count(*) filter (where coalesce(detail->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_detail_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text) as row_id_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and href !~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') is distinct from id::text) as other_saved_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and char_length(href) + 20 > 2048) as digest_href_too_long,
  count(*) filter (where coalesce(detail->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and octet_length(detail::text) - octet_length(to_jsonb(detail->>'href')::text)
      + octet_length(to_jsonb(regexp_replace(href, '^([^#]*#(?:[^&]*&)*)saved=[0-9a-f]{16}(?=&|$)', '\1saved=' || id::text))::text) > 16384)
    as digest_detail_too_long
from public.saved_pages;

-- The same counts by kind.
select
  kind,
  count(*) as total_rows,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=') as saved_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_links,
  count(*) filter (where coalesce(detail->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_detail_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text) as row_id_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and href !~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') is distinct from id::text) as other_saved_links
from public.saved_pages
group by kind
order by kind;

-- The check the migration adds (0 and 0 before; 1 and 1 after).
select
  count(*) as check_present,
  count(*) filter (where convalidated) as check_validated
from pg_catalog.pg_constraint
where conrelid = 'public.saved_pages'::regclass and conname = 'saved_pages_no_digest_link';
