-- Topics for Web Push: one browser subscription, two opt-in streams.
--
-- Until now every stored push subscription received Sky Alerts. The Moon
-- journal adds a second, separately chosen stream: a reminder on the day of
-- each new and full Moon. Both reuse the same row (one browser has one push
-- endpoint), so the row records which streams the browser asked for.
--
-- Additive only: two boolean columns, a check, and a partial index. No row is
-- deleted and no personal data is touched. Every existing row keeps receiving
-- Sky Alerts (sky_alerts is backfilled true) and receives no lunation
-- reminders until its browser opts in. New rows default to neither stream, so
-- the subscribe API must name the stream it is enrolling; a row that has
-- neither is not allowed to exist.

alter table public.push_subscriptions
  add column if not exists sky_alerts boolean not null default true;

-- The backfill above used the column default; from now on a new row starts
-- with no stream until the API sets the one it was asked for.
alter table public.push_subscriptions
  alter column sky_alerts set default false;

alter table public.push_subscriptions
  add column if not exists lunation_reminders boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.push_subscriptions'::regclass
      and conname = 'push_subscriptions_has_topic'
  ) then
    alter table public.push_subscriptions
      add constraint push_subscriptions_has_topic
      check (sky_alerts or lunation_reminders);
  end if;
end;
$$;

-- The lunation sender reads only opted-in rows, about twice a month.
create index if not exists push_subscriptions_lunation_reminders_idx
  on public.push_subscriptions (created_at)
  where lunation_reminders;

comment on column public.push_subscriptions.sky_alerts is
  'The browser opted in to Sky Alerts (the editorial event stream).';
comment on column public.push_subscriptions.lunation_reminders is
  'The browser opted in to Moon journal reminders on new and full Moon days. No journal text, sign or birth data is stored.';
