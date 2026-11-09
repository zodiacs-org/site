import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { createAiNodeHandler } from './http';
import { EVERY_AI_TOOL_NAME, UNDER_13_REFUSAL, YEAR_SCORE_SWITCH_ENV } from './contracts';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { getYearScore } from './features/year-score';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * ZODIACS_YEAR_SCORE_ENABLED stays off until the owner switches it on. Off (unset, '0' or anything but '1'), or on
 * without the coverage switch, the hosted server answers exactly as main does (src/ai-tools/accounts/flag-off.fixture.json).
 * On, it adds get_year_score last in tools/list and changes no other entry.
 */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
const NOW = new Date('2026-11-09T08:00:00Z');

async function serve(env: Record<string, string | undefined>, counted: string[] = []) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, dependencies: { now: () => NOW, horoscopeWindow: async () => committedWindow as HoroscopeWindow,
      horoscopeMonths: async () => committedMonths, horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram } });
  return host;
}
function post(host: string, body: unknown) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' } }, (res) => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, text }));
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
}
const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const message = (text: string) => JSON.parse(text.includes('\ndata: ') || text.startsWith('event:') || text.startsWith('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text);
const COVERAGE = { ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' };

describe('the Year Ahead Score switch off', () => {
  it('leaves tools/list and get_capabilities byte for byte as main answers them, and refuses the tool as unknown', async () => {
    expect(YEAR_SCORE_SWITCH_ENV).toBe('ZODIACS_YEAR_SCORE_ENABLED');
    for (const [name, env] of [['coverage', COVERAGE], ['occasions', { ZODIACS_OCCASIONS_ENABLED: '1' }]] as const) {
      for (const value of name === 'coverage' ? [undefined, '0', 'true', ' 1'] : ['1']) {
        const counted: string[] = [];
        const host = await serve({ ...env, ZODIACS_YEAR_SCORE_ENABLED: value }, counted);
        expect((await post(host, rpc('tools/list'))).text, `${name} ${String(value)}`).toBe(FIXTURE[name].toolsList.text);
        expect((await post(host, rpc('tools/call', { name: 'get_capabilities', arguments: {} }))).text).toBe(FIXTURE[name].capabilities.text);
        const refused = await post(host, rpc('tools/call', { name: 'get_year_score', arguments: { person: 'Jensen Huang' } }));
        expect(refused.text).toBe(FIXTURE[name].save.text);
        expect(counted).not.toContain('get_year_score');
      }
    }
  }, 60_000);
});

describe('the Year Ahead Score switch on', () => {
  const env = { ...COVERAGE, ZODIACS_YEAR_SCORE_ENABLED: '1' };
  it('lists get_year_score last and every other tool exactly as main does', async () => {
    const host = await serve(env);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    const before = message(FIXTURE.coverage.toolsList.text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, 'get_year_score']);
    expect(JSON.stringify(tools.slice(0, before.length))).toBe(JSON.stringify(before));
    const tool = tools.at(-1)!;
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false });
    expect(Object.keys(tool.inputSchema.properties)).toEqual(['person', 'birthDate', 'time', 'zone', 'latitude', 'longitude', 'from']);
    expect(tool.description).not.toMatch(/[–—]/u);
  });

  it('scores a directory figure by name and counts the call', async () => {
    const counted: string[] = [];
    const host = await serve(env, counted);
    const result = message((await post(host, rpc('tools/call', { name: 'get_year_score', arguments: { person: 'Jensen Huang', from: '2026-07-17' } }))).text).result;
    expect(result.isError).toBe(false);
    const data = result.structuredContent.data;
    expect(data).toMatchObject({ status: 'found', from: '2026-07-17', to: '2027-07-16', subject: { kind: 'person', name: 'Jensen Huang', sun: 'aquarius', timeKnown: false } });
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(10);
    expect(data.confidenceLabel).toBe('Reading confidence 55%');
    expect(data.drivers.length).toBeGreaterThan(0);
    expect(data.sources[0].url).toMatch(/^https:\/\//u);
    expect(counted).toEqual(['get_year_score']);
  });

  it('refuses a child’s birth date before working anything out', async () => {
    const host = await serve(env);
    const result = message((await post(host, rpc('tools/call', { name: 'get_year_score', arguments: { birthDate: '2016-03-01' } }))).text).result;
    expect(result.isError).toBe(true);
    expect(result.structuredContent.error.message).toBe(UNDER_13_REFUSAL);
  });

  it('names its own fields when the arguments are wrong', async () => {
    const host = await serve(env);
    const both = message((await post(host, rpc('tools/call', { name: 'get_year_score', arguments: { person: 'Elon Musk', birthDate: '1990-01-01' } }))).text).result;
    expect(both.structuredContent.error.message).toBe('Give either person or birthDate, not both.');
    const none = message((await post(host, rpc('tools/call', { name: 'get_year_score', arguments: {} }))).text).result;
    expect(none.structuredContent.error.message).toBe('Give either person or birthDate, not both.');
  });
});

describe('getYearScore', () => {
  const clock = createLocalTimeModule();
  afterAll(() => clock.dispose());
  // Dias, 9 November 2026: money, career, wellbeing and legal themes are allowed as the tradition reads them;
  // price or trading calls, buy or sell signals, diagnoses, death predictions, legal outcomes and doom are not.
  const banned = /\b(?:buy|sell|selling|price targets?|stocks?|crypto\w*|bitcoin|tokens?|diagnos\w*|prognos\w*|death|die|dies|dying|doom\w*|disaster|ruin\w*|catastroph\w*)\b|\byou will (?:win|lose)\b|[–—]/iu;

  it('keeps a person’s own birth details out of every link and line, and makes no trading call or diagnosis', async () => {
    const { data, links } = await getYearScore({ birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', from: '2026-11-09' }, NOW, clock, 'https://zodiacs.org');
    expect(data.subject).toMatchObject({ kind: 'self', name: null, sun: 'taurus', timeKnown: true });
    const text = JSON.stringify({ data, links });
    for (const detail of ['1990', '05-03', '08:30', 'Madrid']) expect(text).not.toContain(detail);
    expect(data.pageUrl).toBe('https://zodiacs.org/year-score/');
    const words = [data.label, data.summary, data.best?.line, data.hardest?.line, ...data.drivers.map((driver) => driver.line), ...data.limits].join(' ');
    expect(words).not.toMatch(banned);
    // No mandatory reflection note on every result (Dias, 9 November 2026).
    expect(data).not.toHaveProperty('note');
    expect(data.drivers.every((driver) => driver.exact.every((day) => day >= '2026-11-09' && day <= '2027-11-08'))).toBe(true);
  });

  it('answers a name the directory does not have plainly, with no score', async () => {
    const { data } = await getYearScore({ person: 'Somebody Unlisted' }, NOW, clock, 'https://zodiacs.org');
    expect(data).toMatchObject({ status: 'not-in-directory', score: null, subject: null, drivers: [] });
  });

  it('holds back a figure whose published birth dates disagree, answering with no score', async () => {
    // Changpeng Zhao's sources give 5 February and 10 September 1977; he stays out until a primary source settles it.
    const { data } = await getYearScore({ person: 'Changpeng Zhao' }, NOW, clock, 'https://zodiacs.org');
    expect(data).toMatchObject({ status: 'not-in-directory', score: null });
  });

  it('refuses a start before the birth date', async () => {
    await expect(getYearScore({ birthDate: '2005-05-03', from: '2004-01-01' }, NOW, clock, 'https://zodiacs.org')).rejects.toThrow(RangeError);
  });
});
