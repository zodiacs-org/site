-- The good day finder's anonymous "How did your day go?" answers.
-- Written only through public.good_days_outcome_record_v1 by the service role,
-- from POST /api/good-days/outcome, which answers only while
-- ZODIACS_GOOD_DAYS_OUTCOMES_ENABLED=1. A row is the goal, the day, the
-- finder's score for it and whether a birth date ranked it (never the birth
-- date), the rating, a scrubbed note of at most 280 characters, the rules
-- version and the database's own UTC date. No name, birth detail, IP, user
-- agent, account, time of day or identifier from the caller is kept.
-- Additive: a new schema, table and function; nothing existing changes.
-- Safe to replay. UTC filename; not applied to any database until the owner approves it.
create schema if not exists good_days_private;
revoke all on schema good_days_private from public, anon, authenticated;

create table if not exists good_days_private.outcomes (
  id bigint generated always as identity primary key,
  scope text not null check (scope in ('preview', 'production')),
  recorded_on date not null default ((pg_catalog.clock_timestamp() at time zone 'UTC')::date),
  goal text not null check (goal in ('launch', 'contract', 'move', 'relationship', 'travel', 'job', 'wedding')),
  day date not null check (day between date '2026-01-01' and date '2030-12-31'),
  finder_score smallint check (finder_score between 0 and 100),
  personal boolean not null default false,
  rating smallint not null check (rating between 1 and 5),
  note text check (note is null or char_length(note) between 1 and 280),
  rules_version text not null check (rules_version ~ '^good-days-[0-9]+$')
);
alter table good_days_private.outcomes enable row level security;
revoke all on good_days_private.outcomes from public, anon, authenticated;

create or replace function public.good_days_outcome_record_v1(
  outcome_scope text, outcome_goal text, outcome_day date, outcome_finder_score integer,
  outcome_personal boolean, outcome_rating integer, outcome_note text, outcome_rules_version text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- A day still to come anywhere on Earth is refused: the answer is about a day that has happened.
  if outcome_day > ((pg_catalog.clock_timestamp() at time zone 'UTC')::date + 1) then
    raise exception using errcode = '22023', message = 'The day has not come yet';
  end if;
  insert into good_days_private.outcomes (scope, goal, day, finder_score, personal, rating, note, rules_version)
    values (outcome_scope, outcome_goal, outcome_day, outcome_finder_score, coalesce(outcome_personal, false), outcome_rating, outcome_note, outcome_rules_version);
end;
$$;
revoke all on function public.good_days_outcome_record_v1(text, text, date, integer, boolean, integer, text, text) from public, anon, authenticated;
grant execute on function public.good_days_outcome_record_v1(text, text, date, integer, boolean, integer, text, text) to service_role;
grant usage on schema good_days_private to service_role;
grant insert on good_days_private.outcomes to service_role;
