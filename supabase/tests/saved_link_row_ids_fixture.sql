-- Disposable PostgreSQL only. The saved_pages rows production held before
-- 20261113090000_saved_link_row_ids.sql: assistant links whose saved= value is a
-- 16 hex digest, one of each kind, beside rows without one. Committed, so the
-- migration's replay rewrites them; saved_link_row_ids.sql checks the result and
-- removes them. Every value is synthetic.
\set ON_ERROR_STOP on

-- The old shape predates the check, so it is lifted while the rows are written.
alter table public.saved_pages drop constraint if exists saved_pages_saved_link_id;

insert into auth.users(id) values ('00000000-0000-4000-8000-00000000f001') on conflict do nothing;

insert into public.saved_pages(id, user_id, kind, title, href, source, summary, detail, saved_at) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-00000000f001', 'chart', 'Birth chart',
    '/birth-chart/#saved=0123456789abcdef', 'assistant', 'Sun in Aries.',
    '{"schema":"zodiacs.assistant-save.v1","kind":"chart","title":"Birth chart","summary":"Sun in Aries.","data":{"sun":"aries"},"links":[],"href":"/birth-chart/#saved=0123456789abcdef"}',
    '2026-10-20T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-00000000f001', 'compatibility', 'Aries and Leo: 70 out of 100',
    '/compatibility/aries-leo/#saved=1111111111111111', 'assistant', 'Good. Test pair.',
    '{"schema":"zodiacs.assistant-save.v1","kind":"comparison","title":"Aries and Leo: 70 out of 100","summary":"Good. Test pair.","data":{"score":70},"links":[],"href":"/compatibility/aries-leo/#saved=1111111111111111"}',
    '2026-10-21T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-00000000f001', 'occasion', 'Birthday: 70 out of 100',
    '/occasions/#saved=2222222222222222', 'assistant', 'Good.',
    '{"schema":"zodiacs.assistant-save.v1","kind":"occasion","title":"Birthday: 70 out of 100","summary":"Good.","data":{"occasion":"birthday"},"links":[],"href":"/occasions/#saved=2222222222222222"}',
    '2026-10-22T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000000a4', '00000000-0000-4000-8000-00000000f001', 'week', 'Your week from 2026-10-19',
    '/horoscopes/#week=2026-10-19&saved=3333333333333333', 'assistant', 'No close contacts to your chart this week.',
    '{"schema":"zodiacs.assistant-save.v1","kind":"week","title":"Your week from 2026-10-19","summary":"No close contacts to your chart this week.","data":{"from":"2026-10-19","items":[]},"links":[],"href":"/horoscopes/#week=2026-10-19&saved=3333333333333333"}',
    '2026-10-23T00:00:00Z'),
  -- A saved= value that is a UUID but not the row's own id (a save written by the new server before this migration).
  ('00000000-0000-4000-8000-0000000000a5', '00000000-0000-4000-8000-00000000f001', 'chart', 'Second chart',
    '/birth-chart/#saved=00000000-0000-4000-8000-0000000000ff', 'assistant', 'Sun in Leo.',
    '{"schema":"zodiacs.assistant-save.v1","kind":"chart","title":"Second chart","summary":"Sun in Leo.","data":{"sun":"leo"},"links":[],"href":"/birth-chart/#saved=00000000-0000-4000-8000-0000000000ff"}',
    '2026-10-24T00:00:00Z'),
  -- Rows without a saved= value, which the migration leaves alone.
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000f001', 'chart', 'A published chart',
    '/people/test-person/', 'assistant', 'Sun in Virgo.',
    '{"schema":"zodiacs.assistant-save.v1","kind":"chart","title":"A published chart","summary":"Sun in Virgo.","data":{"sun":"virgo"},"links":[],"href":"/people/test-person/"}',
    '2026-10-25T00:00:00Z'),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-00000000f001', 'occasion', 'Wedding, 2027-06-12',
    '/occasions/#o=wedding&d=2027-06-12', 'site', null, null,
    '2026-10-26T00:00:00Z');
