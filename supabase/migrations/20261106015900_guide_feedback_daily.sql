-- Guide answer votes, counted by UTC day: one row per day and vote ('up' or
-- 'down'), holding only a count. No visitor, conversation, question, answer,
-- IP, user agent or time of day. Same lock-down as the Guide quota tables:
-- RLS on, no access for browser roles, and the one counting RPC executable by
-- service_role only. Additive and replay-safe; UTC filename. Not applied to
-- any database until it has been reviewed (AGENTS.md house rules).

create table if not exists public.guide_feedback_daily (
  day date not null,
  vote text not null check (vote in ('up', 'down')),
  votes bigint not null check (votes >= 1),
  primary key (day, vote)
);

alter table public.guide_feedback_daily enable row level security;
revoke all on table public.guide_feedback_daily from public, anon, authenticated, service_role;
-- service_role counts through the RPC (security invoker) and reads the totals
-- for scripts/guide-feedback-report.mjs. It can never delete a count.
grant select, insert, update on table public.guide_feedback_daily to service_role;
drop policy if exists guide_feedback_service_only on public.guide_feedback_daily;
create policy guide_feedback_service_only on public.guide_feedback_daily
  for all to service_role using (true) with check (true);

create or replace function public.guide_feedback_count_v1(feedback_vote text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if feedback_vote is null or feedback_vote not in ('up', 'down') then
    raise exception using errcode = '22023', message = 'guide_feedback_count_v1: vote must be up or down';
  end if;
  -- One atomic statement: ON CONFLICT takes the row lock, so concurrent votes
  -- never lose an increment. The day is the database clock's UTC date, never
  -- a client-supplied time or the session time zone.
  insert into public.guide_feedback_daily as f (day, vote, votes)
    values ((pg_catalog.clock_timestamp() at time zone 'UTC')::date, feedback_vote, 1)
  on conflict (day, vote) do update set votes = f.votes + 1;
end;
$$;

revoke all on function public.guide_feedback_count_v1(text) from public, anon, authenticated;
grant execute on function public.guide_feedback_count_v1(text) to service_role;
