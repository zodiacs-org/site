-- Pause authenticated insert and update on the v1 chart sync table so an old
-- browser tab cannot write a new or changed birth-detail payload.
--
-- Existing rows are not read, rewritten, or deleted. The select and delete
-- policies are unchanged, and account_v2_legacy_sync_allowed() is left as it
-- is, so people can still read and remove their own stored charts.
-- chart_deletions, profiles, saved_pages, compatibility invites, and every
-- other table are untouched.
--
-- Restrictive policies combine with the existing owner policies; nothing
-- existing is dropped or edited. The service role is not subject to them, and
-- no server code writes to public.charts.
--
-- Rollback: drop the two policies. No data is touched.
-- Replay-safe: the drops run before the creates.

drop policy if exists "charts_writes_paused_insert" on public.charts;
drop policy if exists "charts_writes_paused_update" on public.charts;

create policy "charts_writes_paused_insert"
on public.charts
as restrictive
for insert
to authenticated
with check (false);

create policy "charts_writes_paused_update"
on public.charts
as restrictive
for update
to authenticated
using (false)
with check (false);
