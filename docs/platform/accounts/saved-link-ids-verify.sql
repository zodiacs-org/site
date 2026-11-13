-- Read-only checks for supabase/migrations/20261113091500_saved_link_row_ids.sql.
-- Run once before applying the migration and once after. Every query returns
-- counts only: never an href, title, summary, detail, user id or row id. The
-- second query also returns each row's kind (chart, compatibility, occasion or
-- week), the grouping label, beside its counts.
--
-- An "old digest" is a saved= value of exactly 16 lowercase hex digits after
-- the #, the only form the migration rewrites.
--
-- Every query runs on both database shapes: with the accounts layer's detail
-- column, and without it (production before the accounts layer). detail is read
-- through the row's JSON form, so where the column is missing the detail counts
-- are 0 instead of an error.
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
--   check_covers_detail = detail_column
--   accounts_function_row_ids = accounts_function

select
  count(*) as total_rows,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=') as saved_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_links,
  count(*) filter (where coalesce(to_jsonb(p)->'detail'->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_detail_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text) as row_id_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and href !~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') is distinct from id::text) as other_saved_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and char_length(href) + 20 > 2048) as digest_href_too_long,
  count(*) filter (where coalesce(to_jsonb(p)->'detail'->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and octet_length((to_jsonb(p)->'detail')::text) - octet_length((to_jsonb(p)->'detail'->'href')::text)
      + octet_length(to_jsonb(regexp_replace(href, '^([^#]*#(?:[^&]*&)*)saved=[0-9a-f]{16}(?=&|$)', '\1saved=' || id::text))::text) > 16384)
    as digest_detail_too_long
from public.saved_pages p;

-- The same counts by kind.
select
  kind,
  count(*) as total_rows,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=') as saved_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_links,
  count(*) filter (where coalesce(to_jsonb(p)->'detail'->>'href', '') ~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)') as old_digest_detail_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') = id::text) as row_id_links,
  count(*) filter (where href ~ '^[^#]*#([^&]*&)*saved='
    and href !~ '^[^#]*#([^&]*&)*saved=[0-9a-f]{16}(&|$)'
    and substring(href from '^[^#]*#(?:[^&]*&)*saved=([^&]*)') is distinct from id::text) as other_saved_links
from public.saved_pages p
group by kind
order by kind;

-- The check the migration adds (0 and 0 before; 1 and 1 after). check_covers_detail
-- is 1 when the check also holds detail's href: 1 after the migration where the
-- detail column exists, 0 where it does not (production before the accounts layer).
select
  count(*) as check_present,
  count(*) filter (where convalidated) as check_validated,
  count(*) filter (where pg_catalog.pg_get_constraintdef(oid) like '%detail%') as check_covers_detail
from pg_catalog.pg_constraint
where conrelid = 'public.saved_pages'::regclass and conname = 'saved_pages_no_digest_link';

-- The database's shape. detail_column is 1 where the accounts layer added
-- saved_pages.detail (0 in production before it). accounts_function is 1 where
-- public.zodiacs_accounts_v1 exists (0 in production before the accounts layer, and
-- the migration then leaves it alone); accounts_function_row_ids is 1 where it is the
-- version that stores a saved= link under its row id. Where accounts_function is 1
-- and accounts_function_row_ids is 0, or detail_column is 1 and check_covers_detail
-- is 0, a later migration put the older version back: apply the migration again.
select
  (select count(*) from pg_catalog.pg_attribute
    where attrelid = 'public.saved_pages'::regclass and attname = 'detail'
      and attnum > 0 and not attisdropped) as detail_column,
  (select count(*) from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.zodiacs_accounts_v1(text, jsonb)')) as accounts_function,
  (select count(*) from pg_catalog.pg_proc
    where oid = pg_catalog.to_regprocedure('public.zodiacs_accounts_v1(text, jsonb)')
      and prosrc like '%row_id := case when input->>''id''%') as accounts_function_row_ids;
