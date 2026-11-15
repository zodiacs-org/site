import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createAiNodeHandler } from './http';
import { UNDER_13_REFUSAL } from './contracts';
import { birthDatesIn, childBirthDateRefusal, executeAiTool } from './tools';
import { CHILD_HOROSCOPE, UNDER_13_INSTRUCTION } from './server';
import { isUnder13, isUnder18 } from './features/reading-guards';
import { MINOR_COMPATIBILITY_REFUSAL } from './features/compatibility';
import { buildSavedRecord, saveToZodiacs } from './accounts/save';
import { saveInput } from './accounts/contracts';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * Zodiacs is not directed at children under 13. 0.6.5 took a baby's arrival out of get_occasion_sky, but an
 * assistant asked for a card for a baby born a week earlier called it a birthday, and another tool read the baby's
 * chart (Claude, 7 November 2026). So the hosted tools refuse any call that carries a birth date less than 13 years
 * before today, or one still to come, and a birthday card for a day in those 13 years, before anything is worked out.
 * The tool definitions do not change.
 */
const NOW = new Date('2026-11-08T03:00:00Z');
const window = async () => committedWindow as HoroscopeWindow;
const months = async () => committedMonths;
const program = async () => committedProgram as unknown as HoroscopeProgram;

let server: Server;
let endpoint: string;
beforeAll(async () => {
  const allowedHosts: string[] = [];
  // As production runs it (api/_ai/handler.ts), with the clock fixed on 8 November 2026.
  const handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' }, allowedHosts, rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async () => undefined, dependencies: { horoscopeWindow: window, horoscopeMonths: months, horoscopeProgram: program, now: () => NOW } });
  server = createServer((req, res) => { void handle(req, res); });
  server.keepAliveTimeout = 10 * 60_000;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  allowedHosts.push(host);
  endpoint = `http://${host}/mcp`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function rpc(method: string, params: unknown) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const text = await response.text();
  return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
}

const LISBON = { zone: 'Europe/Lisbon', latitude: 38.7223, longitude: -9.1393 };
const refused = (answer: { isError: boolean; structuredContent: unknown }, name: string) => {
  expect(answer.isError, name).toBe(true);
  expect(answer.structuredContent, name).toEqual({ schema: 'zodiacs.ai-tool-result.v1', ok: false, tool: name, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
};

describe('a birth date under 13', () => {
  it('counts from the 13th birthday, and takes in a date still to come', () => {
    expect(isUnder13('2013-11-08', '2026-11-08')).toBe(false);
    expect(isUnder13('2013-11-09', '2026-11-08')).toBe(true);
    expect(isUnder13('2026-11-01', '2026-11-08')).toBe(true);
    expect(isUnder13('2027-03-01', '2026-11-08')).toBe(true);
    expect(isUnder13('1990-05-03', '2026-11-08')).toBe(false);
    // A 29 February birthday turns 13 on 1 March in a year without one.
    expect(isUnder13('2012-02-29', '2025-02-28')).toBe(true);
    expect(isUnder13('2012-02-29', '2025-03-01')).toBe(false);
    // On 29 February, someone born on 1 March 13 years before is still 12, and someone born on 28 February is 13.
    expect(isUnder13('2015-03-01', '2028-02-29')).toBe(true);
    expect(isUnder13('2015-02-28', '2028-02-29')).toBe(false);
    // The under-18 rule is kept exactly as it was, including its 29 February rollover to 1 March.
    expect(isUnder18('2008-11-08', '2026-11-08')).toBe(false);
    expect(isUnder18('2008-11-09', '2026-11-08')).toBe(true);
    expect(isUnder18('2010-03-01', '2028-02-29')).toBe(false);
  });

  it('is read from each birthDate, both people in a comparison, and the days a birthday card can be for', () => {
    expect(birthDatesIn('get_natal_chart', { birthDate: '2026-11-01' }, NOW)).toEqual(['2026-11-01']);
    expect(birthDatesIn('get_compatibility', { a: { birthDate: '1990-05-03' }, b: { famous: 'Frida Kahlo' } }, NOW)).toEqual(['1990-05-03']);
    expect(birthDatesIn('get_compatibility', { a: { birthDate: '1990-05-03' }, b: { birthDate: '2016-04-04' } }, NOW)).toEqual(['1990-05-03', '2016-04-04']);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', date: '2026-11-01' }, NOW)).toEqual(['2026-11-01']);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', date: '2026-11-08' }, NOW)).toEqual(['2026-11-08']);
    // A best-day window that has begun: its latest day that has come.
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-10-20', searchTo: '2026-11-02' }, NOW)).toEqual(['2026-11-02']);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-11-01', searchTo: '2026-11-30', ...LISBON }, NOW)).toEqual(['2026-11-08']);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', date: '2027-05-03', searchFrom: '2026-11-01', searchTo: '2026-11-01' }, NOW)).toEqual(['2026-11-01']);
    // A birthday still to come is a day being planned; any other occasion's day is not a birth date.
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', date: '2026-11-10' }, NOW)).toEqual([]);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-11-10', searchTo: '2026-11-30' }, NOW)).toEqual([]);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'wedding', date: '2026-11-01' }, NOW)).toEqual([]);
    expect(birthDatesIn('get_occasion_sky', { occasion: 'wedding', searchFrom: '2026-11-01', searchTo: '2026-11-30' }, NOW)).toEqual([]);
    // A Chinese zodiac year, a birthday's month and day, and dates that are not birth dates.
    expect(birthDatesIn('get_chinese_zodiac', { year: 2020 }, NOW)).toEqual([]);
    expect(birthDatesIn('get_birthday', { date: '05-03' }, NOW)).toEqual([]);
    expect(birthDatesIn('find_birthplace', { place: 'Lisbon', date: '2026-11-01' }, NOW)).toEqual([]);
    expect(birthDatesIn('get_upcoming_events', { from: '2026-11-01T00:00:00Z', to: '2026-11-08T00:00:00Z' }, NOW)).toEqual([]);
    expect(childBirthDateRefusal('get_sky', {}, NOW)).toBeNull();
  });

  it('reads whether a birthday has come on the card\'s own clock, else the assistant\'s, else the clock furthest ahead', () => {
    // 16:00 UTC on 8 November is already 9 November in Auckland: a baby born there today is not a birthday to come.
    const lateUtc = new Date('2026-11-08T16:00:00Z');
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09', zone: 'Pacific/Auckland', names: 'Mia' }, lateUtc)).not.toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09' }, lateUtc)).not.toBeNull();
    // 04:00 UTC on 8 November is still 7 November in Los Angeles: a party there on the 8th is still to come.
    const earlyUtc = new Date('2026-11-08T04:00:00Z');
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-08', zone: 'America/Los_Angeles' }, earlyUtc)).toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-08' }, earlyUtc, 'America/Los_Angeles')).toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-08' }, earlyUtc)).not.toBeNull();
    // 15:00 UTC on 8 November is 10:00 in New York: tomorrow's party there is still to come once the clock is known.
    const midUtc = new Date('2026-11-08T15:00:00Z');
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09' }, midUtc, 'America/New_York')).toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-11-09', searchTo: '2026-11-30' }, midUtc, 'America/New_York')).toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09' }, midUtc)).not.toBeNull();
    // The card's own zone comes first; an unknown one falls through to the assistant's.
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09', zone: 'Pacific/Auckland' }, midUtc, 'America/New_York')).not.toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09', zone: 'Nowhere/Atlantis' }, midUtc, 'America/New_York')).toBeNull();
    // A place named without a zone may be far from the person: their shared zone is not its clock.
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09', place: 'Auckland', names: 'Mia' }, midUtc, 'America/Los_Angeles')).not.toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09', place: 'Auckland', zone: 'Pacific/Auckland' }, midUtc, 'America/Los_Angeles')).not.toBeNull();
    expect(childBirthDateRefusal('get_occasion_sky', { occasion: 'birthday', date: '2026-11-09', place: 'Los Angeles', zone: 'America/Los_Angeles' }, midUtc)).toBeNull();
  });
});

describe('the hosted server refuses a child\'s birth date', () => {
  it('answers every tool that takes one with the fixed refusal, echoing none of the request', async () => {
    const calls: [string, Record<string, unknown>][] = [
      ['get_occasion_sky', { occasion: 'birthday', date: '2026-11-01', time: '06:10', ...LISBON, place: 'Lisbon', names: 'Mia' }],
      ['get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-11-01', searchTo: '2026-11-01', time: '06:10', ...LISBON, place: 'Lisbon', names: 'Mia' }],
      ['get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-10-20', searchTo: '2026-11-02', ...LISBON, names: 'Mia' }],
      ['get_natal_chart', { birthDate: '2026-11-01', time: '06:10', ...LISBON }],
      ['get_personal_transits', { birthDate: '2026-11-01' }],
      ['get_life_milestones', { birthDate: '2015-06-01' }],
      ['find_chart_twins', { birthDate: '2020-02-02' }],
      ['get_birthday', { birthDate: '2019-05-03' }],
      ['get_chinese_zodiac', { birthDate: '2020-01-25' }],
      ['get_horoscope', { sign: 'scorpio', birthDate: '2026-11-01' }],
      ['get_compatibility', { a: { birthDate: '1990-05-03' }, b: { name: 'Mia', birthDate: '2016-04-04' } }],
      ['get_natal_chart', { birthDate: '2027-03-01' }],
    ];
    for (const [name, args] of calls) {
      const answer = (await rpc('tools/call', { name, arguments: args })).result;
      refused(answer, name);
      expect(JSON.stringify(answer), name).not.toMatch(/2026-1[01]-\d\d|2027-03-01|2015-06|2016-04|2019-05|2020-0|Lisbon|Mia|38\.7|06:10/u);
    }
  });

  it('still answers adults, a birthday still to come, any other occasion, a month and day, and a year', async () => {
    const ok = async (name: string, args: Record<string, unknown>) => {
      const answer = (await rpc('tools/call', { name, arguments: args })).result;
      expect(answer.isError, `${name} ${JSON.stringify(answer.structuredContent?.error)}`).toBe(false);
    };
    await ok('get_natal_chart', { birthDate: '1990-05-03' });
    await ok('get_natal_chart', { birthDate: '2013-11-08' });
    await ok('get_occasion_sky', { occasion: 'birthday', date: '1990-05-03' });
    await ok('get_occasion_sky', { occasion: 'birthday', date: '2027-05-03' });
    await ok('get_occasion_sky', { occasion: 'birthday', searchFrom: '2026-11-10', searchTo: '2026-11-30' });
    await ok('get_occasion_sky', { occasion: 'birthday', searchFrom: '1990-05-01', searchTo: '1990-05-31' });
    await ok('get_occasion_sky', { occasion: 'wedding', date: '2026-11-01' });
    await ok('get_occasion_sky', { occasion: 'gathering', searchFrom: '2026-11-01', searchTo: '2026-11-30' });
    await ok('get_birthday', { date: '05-03' });
    await ok('get_chinese_zodiac', { year: 2020 });
    await ok('get_horoscope', { sign: 'scorpio' });
    // At 03:00 UTC it is still 7 November in New York: with the zone ChatGPT shares, a birthday on the 8th is to come.
    const newYork = { 'openai/userLocation': { timezone: 'America/New_York' } };
    const shared = (await rpc('tools/call', { name: 'get_occasion_sky', arguments: { occasion: 'birthday', date: '2026-11-08' }, _meta: newYork })).result;
    expect(shared.isError, JSON.stringify(shared.structuredContent?.error)).toBe(false);
    refused((await rpc('tools/call', { name: 'get_occasion_sky', arguments: { occasion: 'birthday', date: '2026-11-08' } })).result, 'get_occasion_sky');
    // From 13 to 17, compatibility keeps its own refusal and its pointer to a friendship reading.
    const teen = (await rpc('tools/call', { name: 'get_compatibility', arguments: { a: { birthDate: '1990-05-03' }, b: { birthDate: '2012-02-02' } } })).result;
    expect(teen.structuredContent.error).toEqual({ code: 'invalid-request', message: MINOR_COMPATIBILITY_REFUSAL });
  });

  it('says so in the instructions every assistant reads first, and in get_capabilities', async () => {
    const init = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'under-13', version: '1' } })).result;
    expect(init.instructions).toContain(UNDER_13_INSTRUCTION);
    expect(init.instructions.indexOf(UNDER_13_INSTRUCTION)).toBeLessThan(init.instructions.indexOf('If a person or a birth date is under 18'));
    const capabilities = await executeAiTool('get_capabilities', {}, { occasions: true, coverage: true });
    if (!capabilities.ok || capabilities.tool !== 'get_capabilities') throw new Error(JSON.stringify(capabilities));
    expect(capabilities.data.privacy).toContain('Zodiacs is not directed at children under 13: its tools make no card, chart or reading from a birth date less than 13 years ago, or a birthday card for a day in those years.');
    expect(capabilities.data.limitations.join(' ')).toContain('when either birth date is under 18 it gives no reading, and from 13 to 17 it points to a friendship reading');
  });
});

/**
 * The owner's answer of 13 November 2026 (ZOD-207): no horoscope for a named child under 13, and a bare Sun sign,
 * with no name and no birth date, still gets that sign's general horoscope. The horoscope tools take a sign and, for
 * get_horoscope, an optional birth date; they take no name and no age, so a named child reaches them only through
 * what the assistant reads: the instructions and the two descriptions. Every date here is made up.
 */
describe('horoscopes and children under 13', () => {
  const call = async (name: string, args: Record<string, unknown>) => (await rpc('tools/call', { name, arguments: args })).result;

  it('gives a bare Sun sign its general horoscope: a day, a week, a month and a year', async () => {
    // The committed window moves each day, so the day is the one it was built for, not this file's fixed clock.
    const date = (committedWindow as HoroscopeWindow).generatedFor;
    const day = await call('get_horoscope', { sign: 'leo', date });
    expect(day.isError, JSON.stringify(day.structuredContent?.error)).toBe(false);
    expect(day.structuredContent.data).toMatchObject({ status: 'available', sign: 'leo', period: 'day', focus: 'general' });
    expect(day.structuredContent.data.personalWeek ?? null).toBeNull();
    const week = await call('get_horoscope', { sign: 'leo', period: 'week', date });
    expect(week.structuredContent.data).toMatchObject({ status: 'available', sign: 'leo', period: 'week' });
    for (const period of ['month', 'year']) {
      const answer = await call('get_horoscope_period', { sign: 'leo', period });
      expect(answer.isError, `${period} ${JSON.stringify(answer.structuredContent?.error)}`).toBe(false);
    }
    // No sign at all: the person chooses one, and nothing is refused.
    const none = await call('get_horoscope', {});
    expect(none.isError).toBe(false);
    expect(none.structuredContent.data.status).toBe('choose-sign');
  });

  it('still refuses a horoscope with a birth date less than 13 years ago, on the day before the 13th birthday too', async () => {
    for (const birthDate of ['2017-08-17', '2013-11-09', '2026-11-01']) {
      const answer = await call('get_horoscope', { sign: 'leo', birthDate });
      refused(answer, 'get_horoscope');
      expect(JSON.stringify(answer), birthDate).not.toContain(birthDate);
    }
    expect((await call('get_horoscope', { sign: 'scorpio', birthDate: '2013-11-08' })).isError).toBe(false);
  });

  it('has no field a child\'s name or age could travel in', async () => {
    const tools = (await rpc('tools/list', {})).result.tools as { name: string; inputSchema: { properties: Record<string, unknown> } }[];
    for (const name of ['get_horoscope', 'get_horoscope_period']) {
      const fields = Object.keys(tools.find(tool => tool.name === name)!.inputSchema.properties);
      expect(fields.filter(field => /name|age|child/iu.test(field)), name).toEqual([]);
      expect((await call(name, { sign: 'leo', name: 'Example Child' })).isError, name).toBe(true);
    }
  });

  it('says in the instructions and in both horoscope descriptions that a named child under 13 gets none', async () => {
    const init = (await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'under-13', version: '1' } })).result;
    expect(init.instructions).toContain(`${UNDER_13_INSTRUCTION} ${CHILD_HOROSCOPE}`);
    const tools = (await rpc('tools/list', {})).result.tools as { name: string; description: string }[];
    for (const name of ['get_horoscope', 'get_horoscope_period']) {
      const description = tools.find(tool => tool.name === name)!.description;
      expect(description, name).toContain('There is no horoscope for a named child under 13');
      expect(description, name).toMatch(/A Sun sign on its own, with no name and no birth date, gets the general (?:horoscope|reading) for that sign\./u);
    }
  });
});

describe('saving to an account refuses a child\'s birth date', () => {
  const cases = [
    { kind: 'chart', chart: { birthDate: '2026-11-01' } },
    { kind: 'comparison', comparison: { a: { birthDate: '1990-05-03' }, b: { birthDate: '2020-01-01' } } },
    { kind: 'occasion', occasion: { occasion: 'birthday', date: '2026-11-01' } },
    { kind: 'occasion', occasion: { occasion: 'birthday', searchFrom: '2026-11-01', searchTo: '2026-11-01', time: '06:10', ...LISBON, place: 'Lisbon', names: 'Mia' } },
    { kind: 'week', week: { birthDate: '2026-11-01' } },
  ];

  it('for each kind, as the tool that made it refuses it', async () => {
    for (const args of cases) {
      expect(await buildSavedRecord(saveInput.parse(args), { now: () => NOW }), args.kind).toEqual({ failure: UNDER_13_REFUSAL });
    }
  });

  it('reads the zone the assistant shares when saving, as the tool does', async () => {
    const principal = { user: '00000000-0000-4000-8000-000000000001', session: 'session', client: 'client' };
    const midUtc = new Date('2026-11-08T15:00:00Z');
    const stored: unknown[] = [];
    const store = async (_principal: unknown, record: unknown) => { stored.push(record); return { id: '00000000-0000-4000-8000-000000000002', saved_at: '2026-11-08T15:00:00Z', created: true }; };
    // Tomorrow's party in New York is still to come there: it saves.
    const party = await saveToZodiacs({ kind: 'occasion', occasion: { occasion: 'birthday', date: '2026-11-09' } }, principal, store, { now: () => midUtc, hostZone: 'America/New_York' });
    expect(party, JSON.stringify(party)).toMatchObject({ ok: true });
    expect(stored).toHaveLength(1);
    // A day that has come, in a one-day window, is refused and nothing more is stored.
    const child = await saveToZodiacs({ kind: 'occasion', occasion: { occasion: 'birthday', searchFrom: '2026-11-08', searchTo: '2026-11-08', names: 'Mia' } }, principal, store, { now: () => midUtc, hostZone: 'America/New_York' });
    expect(child).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    expect(stored).toHaveLength(1);
  });

  it('through the save tool, which stores nothing', async () => {
    const principal = { user: '00000000-0000-4000-8000-000000000001', session: 'session', client: 'client' };
    const store = async () => { throw new Error('nothing may be stored'); };
    for (const args of cases) {
      const answer = await saveToZodiacs(args, principal, store, { now: () => NOW });
      expect(answer, args.kind).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(answer), args.kind).not.toMatch(/2026-11-01|2020-01|Lisbon|Mia|06:10/u);
    }
  });
});
