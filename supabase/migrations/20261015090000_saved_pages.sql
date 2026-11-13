-- Saved pages: links a signed-in person keeps on their profile ("Save to your
-- profile" under a compatibility reading or an occasion card). Each row is a
-- title and a same-site path whose fragment carries the page's inputs, so the
-- reading or card reopens on any device the person signs in on.
--
-- Owner-only by row-level security. Rows are inserted and deleted, never
-- updated. At most 100 per account. Deleting the auth user deletes the rows.
--
-- The site reads this table only when PUBLIC_ACCOUNT_SAVES_ENABLED=1; apply
-- this migration in production (owner approval) before setting that flag.
-- Replay-safe: every statement can run again without change.

create table if not exists public.saved_pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  href text not null,
  saved_at timestamptz not null default now(),
  constraint saved_pages_kind check (kind in ('compatibility', 'occasion')),
  constraint saved_pages_title check (
    char_length(title) between 1 and 160
    and title !~ '[[:cntrl:]]'
  ),
  constraint saved_pages_href check (
    char_length(href) between 2 and 2048
    and href ~ '^/[^/\\]'
    and href !~ '[[:space:][:cntrl:]\\]'
  ),
  constraint saved_pages_kind_path check (
    (kind = 'compatibility' and href ~ '^/([a-z]{2}/)?compatibility/')
    or (kind = 'occasion' and href ~ '^/occasions/')
  ),
  constraint saved_pages_user_href unique (user_id, href)
);

create index if not exists saved_pages_user_saved_idx
  on public.saved_pages (user_id, saved_at desc);

alter table public.saved_pages enable row level security;

revoke all on public.saved_pages from public, anon, authenticated;
grant select, delete on public.saved_pages to authenticated;
grant insert (user_id, kind, title, href) on public.saved_pages to authenticated;

drop policy if exists "saved_pages_select_own" on public.saved_pages;
drop policy if exists "saved_pages_insert_own" on public.saved_pages;
drop policy if exists "saved_pages_delete_own" on public.saved_pages;

create policy "saved_pages_select_own"
on public.saved_pages
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "saved_pages_insert_own"
on public.saved_pages
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "saved_pages_delete_own"
on public.saved_pages
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- The per-account limit. Serialised per account so two simultaneous saves
-- cannot both pass the count.
create or replace function public.saved_pages_enforce_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  kept integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('saved_pages:' || new.user_id::text, 0)
  );
  select count(*) into kept from public.saved_pages where user_id = new.user_id;
  if kept >= 100 then
    raise exception 'saved_pages_full' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.saved_pages_enforce_limit() from public, anon, authenticated;

drop trigger if exists saved_pages_limit on public.saved_pages;
create trigger saved_pages_limit
before insert on public.saved_pages
for each row execute function public.saved_pages_enforce_limit();
