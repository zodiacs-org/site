import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Readable } from 'node:stream';
import { GOOD_DAY_GOALS } from './goals';
import { GOOD_DAYS_FIRST, GOOD_DAYS_LAST } from './find';
import { FOLLOW_UP_DAYS, OUTCOME_FIRST_DAY, OUTCOME_LAST_DAY, OUTCOME_RULES_VERSION, followUpDue, followUpLink, outcomeRecord, readFollowUpLink, scrubNote } from './outcomes';
import { MEMORY_KEY, duePicks, finishPick, rememberPick } from './outcome-memory';
import { pickCalendar } from './calendar';
import { OUTCOMES_RPC, handleOutcomeRequest, rpcArguments } from './outcome-api';

const PICK = { goal: 'contract' as const, day: '2027-04-19', score: 89, personal: true };
const TODAY = '2027-04-30';

describe('the days it takes', () => {
  it('are the days the finder covers', () => {
    expect([OUTCOME_FIRST_DAY, OUTCOME_LAST_DAY]).toEqual([GOOD_DAYS_FIRST, GOOD_DAYS_LAST]);
  });
});

describe('the follow-up link', () => {
  it('carries the goal, the day, the score and the personal flag after the #, and nothing else', () => {
    const link = followUpLink('https://zodiacs.org', PICK);
    expect(link).toBe('https://zodiacs.org/good-days/how-did-it-go/#g=contract&d=2027-04-19&s=89&p=1');
    expect(readFollowUpLink(new URL(link).hash)).toEqual(PICK);
    expect(readFollowUpLink('#g=contract&d=2027-04-19&s=89&p=1&b=1990-05-03&n=Ana')).toEqual(PICK);
    expect(readFollowUpLink('#g=surgery&d=2027-04-19')).toBeNull();
    expect(readFollowUpLink('#g=move&d=2027-02-30')).toBeNull();
    expect(readFollowUpLink('#g=move&d=2031-01-01')).toBeNull();
    expect(readFollowUpLink('#g=move&d=2027-01-01&s=900')).toEqual({ goal: 'move', day: '2027-01-01', score: null, personal: false });
  });

  it('asks a week after the day', () => {
    expect(FOLLOW_UP_DAYS).toBe(7);
    expect(followUpDue('2027-04-19')).toBe('2027-04-26');
    expect(followUpDue('2027-12-29')).toBe('2028-01-05');
  });
});

describe('the note', () => {
  it('takes out email and web addresses, phone numbers and anything shaped like a date', () => {
    expect(scrubNote('Signed it! Mail me at ana@example.com or see https://example.com/x').note).toBe('Signed it! Mail me at [removed] or see [removed]');
    expect(scrubNote('Call +44 20 7946 0958 later').note).toBe('Call [removed] later');
    expect(scrubNote('Born 1990-05-03, it went fine on 19/04/2027').note).toBe('Born [removed], it went fine on [removed]');
  });

  it('drops a note about a child whole, and keeps nothing empty', () => {
    expect(scrubNote('My daughter loved the new house')).toEqual({ note: null, dropped: 'children' });
    expect(scrubNote('Moved the kids in')).toEqual({ note: null, dropped: 'children' });
    expect(scrubNote('A smooth season at work').note).toBe('A smooth season at work');
    expect(scrubNote('   ')).toEqual({ note: null, dropped: null });
    expect(scrubNote(42)).toEqual({ note: null, dropped: null });
  });

  it('keeps at most 280 characters, on one line', () => {
    const { note } = scrubNote(`line one\nline two ${'x'.repeat(400)}`);
    expect(note!.length).toBeLessThanOrEqual(280);
    expect(note).not.toContain('\n');
  });
});

describe('the record', () => {
  it('keeps exactly the fields of the answer, with the rules version', () => {
    expect(outcomeRecord({ goal: 'contract', day: '2027-04-19', score: 89, personal: true, rating: 4, note: 'Went smoothly.' }, TODAY))
      .toEqual({ record: { goal: 'contract', day: '2027-04-19', finderScore: 89, personal: true, rating: 4, note: 'Went smoothly.', rulesVersion: OUTCOME_RULES_VERSION } });
  });

  it('refuses extra fields, a day to come, an old day, a goal or rating it does not know', () => {
    const base = { goal: 'move', day: '2027-04-19', rating: 3 };
    expect(outcomeRecord({ ...base, birthDate: '1990-05-03' }, TODAY)).toEqual({ refusal: 'Leave out fields this form does not take.' });
    expect(outcomeRecord({ ...base, name: 'Ana' }, TODAY)).toEqual({ refusal: 'Leave out fields this form does not take.' });
    expect(outcomeRecord({ ...base, day: '2027-05-01' }, TODAY)).toEqual({ refusal: 'Tell us how the day went once it has come.' });
    expect('refusal' in outcomeRecord({ ...base, day: '2026-11-01' }, TODAY)).toBe(true);
    expect('refusal' in outcomeRecord({ ...base, goal: 'surgery' }, TODAY)).toBe(true);
    for (const rating of [0, 6, 2.5, '4', null]) expect('refusal' in outcomeRecord({ ...base, rating }, TODAY), String(rating)).toBe(true);
    expect('refusal' in outcomeRecord({ ...base, score: 101 }, TODAY)).toBe(true);
    expect('refusal' in outcomeRecord([], TODAY)).toBe(true);
  });
});

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('the reminder kept on the device', () => {
  it('keeps only the goal, the day, the score and the personal flag, and asks from a week after', () => {
    const storage = new MemoryStorage() as unknown as Storage;
    expect(rememberPick(storage, { ...PICK, birthDate: '1990-05-03', name: 'Ana' } as never)).toBe(true);
    const raw = (storage as unknown as MemoryStorage).data.get(MEMORY_KEY)!;
    expect(JSON.parse(raw)).toEqual([PICK]);
    expect(raw).not.toMatch(/1990|Ana/u);
    expect(duePicks(storage, '2027-04-25')).toEqual([]);
    expect(duePicks(storage, '2027-04-26')).toEqual([PICK]);
    finishPick(storage, PICK);
    expect(duePicks(storage, '2027-05-30')).toEqual([]);
  });

  it('keeps no reminder, and throws nothing, where storage is refused', () => {
    const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } } as unknown as Storage;
    expect(rememberPick(refusing, PICK)).toBe(false);
    expect(duePicks(refusing, TODAY)).toEqual([]);
    expect(rememberPick(undefined, PICK)).toBe(false);
  });
});

describe('the calendar file', () => {
  it('holds the day and a reminder a week later with the follow-up link, and no birth detail', () => {
    const ics = pickCalendar('https://zodiacs.org', PICK, '20261109T120000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270419');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270426');
    expect(ics).toContain('SUMMARY:How did your day go?');
    expect(ics.replace(/\r\n /gu, '')).toContain('URL:https://zodiacs.org/good-days/how-did-it-go/#g=contract&d=2027-04-19&s=89&p=1');
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    expect(ics).not.toMatch(/1990|birth/iu);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
});

function request(body: unknown, headers: Record<string, string> = {}, method = 'POST') {
  const stream = Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]) as Readable & Record<string, unknown>;
  stream.method = method;
  stream.headers = { origin: 'https://zodiacs.org', host: 'zodiacs.org', 'content-type': 'application/json', ...headers };
  return stream;
}
function response() {
  const out = { statusCode: 0, headers: {} as Record<string, string>, body: '', setHeader(key: string, value: string) { out.headers[key.toLowerCase()] = value; }, end(text?: string) { out.body = text ?? ''; } };
  return out;
}
const ENV = { ZODIACS_GOOD_DAYS_OUTCOMES_ENABLED: '1', NODE_ENV: 'production', PUBLIC_SUPABASE_URL: 'https://abcdefgh.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_0123456789abcdefghijklmnop', VERCEL_ENV: 'preview' };
const NOW = () => new Date('2027-04-30T12:00:00Z');
const ANSWER = { goal: 'contract', day: '2027-04-19', score: 89, personal: true, rating: 4, note: 'Signed it. Write to ana@example.com.' };

describe('the endpoint', () => {
  it('answers 404 and reads nothing while its switch is off', async () => {
    for (const value of [undefined, '', '0', 'true']) {
      const fetcher = vi.fn();
      const res = response();
      await handleOutcomeRequest(request(ANSWER), res, { env: { ...ENV, ZODIACS_GOOD_DAYS_OUTCOMES_ENABLED: value }, fetcher, rateLimit: async () => 'allowed', now: NOW });
      expect(res.statusCode).toBe(404);
      expect(fetcher).not.toHaveBeenCalled();
    }
  });

  it('stores exactly the record, through the one function, and logs nothing', async () => {
    const calls: { url: string; body: string }[] = [];
    const fetcher = vi.fn(async (url: string, init: RequestInit) => { calls.push({ url, body: String(init.body) }); return new Response(null, { status: 204 }); });
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    const res = response();
    await handleOutcomeRequest(request(ANSWER), res, { env: ENV, fetcher: fetcher as never, rateLimit: async () => 'allowed', now: NOW });
    const logged = spies.reduce((count, spy) => count + spy.mock.calls.length, 0);
    spies.forEach((spy) => spy.mockRestore());
    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body)).toEqual({ ok: true, noteKept: true });
    expect(res.headers['cache-control']).toBe('no-store');
    expect(logged).toBe(0);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://abcdefgh.supabase.co/rest/v1/rpc/${OUTCOMES_RPC}`);
    expect(JSON.parse(calls[0].body)).toEqual({
      outcome_scope: 'preview', outcome_goal: 'contract', outcome_day: '2027-04-19', outcome_finder_score: 89, outcome_personal: true,
      outcome_rating: 4, outcome_note: 'Signed it. Write to [removed].', outcome_rules_version: OUTCOME_RULES_VERSION,
    });
  });

  it('refuses another origin, another method or type, a busy or unpublished rate limit, and a bad answer, without repeating it', async () => {
    const cases: [ReturnType<typeof request>, number, 'allowed' | 'limited' | 'unavailable'][] = [
      [request(ANSWER, { origin: 'https://evil.example', host: 'zodiacs.org' }), 403, 'allowed'],
      [request(ANSWER, {}, 'GET'), 405, 'allowed'],
      [request(ANSWER, { 'content-type': 'text/plain' }), 415, 'allowed'],
      [request(ANSWER), 429, 'limited'],
      [request(ANSWER), 503, 'unavailable'],
      [request({ ...ANSWER, birthDate: '1990-05-03' }), 400, 'allowed'],
      [request('{not json'), 400, 'allowed'],
      [request({ ...ANSWER, note: 'x'.repeat(3000) }), 413, 'allowed'],
    ];
    for (const [req, status, verdict] of cases) {
      const fetcher = vi.fn();
      const res = response();
      await handleOutcomeRequest(req, res, { env: ENV, fetcher, rateLimit: async () => verdict, now: NOW });
      expect(res.statusCode).toBe(status);
      expect(fetcher).not.toHaveBeenCalled();
      expect(res.body).not.toMatch(/1990|evil/u);
    }
  });
});

describe('the migration', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261112100000_good_days_outcomes.sql', import.meta.url), 'utf8');

  it('takes the arguments the endpoint sends, and the goals the finder reads', () => {
    const args = Object.keys(rpcArguments({ goal: 'move', day: '2027-01-01', finderScore: null, personal: false, rating: 3, note: null, rulesVersion: OUTCOME_RULES_VERSION }, 'preview'));
    const declared = [...sql.match(/good_days_outcome_record_v1\(\s*([^)]*)\)\s*returns/u)![1].matchAll(/(outcome_\w+)/gu)].map((match) => match[1]);
    expect(declared).toEqual(args);
    const goals = sql.match(/goal in \(([^)]*)\)/u)![1].split(', ').map((value) => value.slice(1, -1));
    expect(goals).toEqual([...GOOD_DAY_GOALS]);
  });

  it('keeps no IP, user agent, time of day or caller identifier, and grants only the service role', () => {
    const code = sql.replace(/--.*$/gmu, '');
    expect(code).not.toMatch(/\b(?:ip|inet|user_agent|timestamptz|email|birth_date|name)\b/iu);
    expect(sql).toContain('to service_role;');
    expect(sql).toContain('from public, anon, authenticated;');
    expect(sql).toContain('enable row level security');
  });
});
