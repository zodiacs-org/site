import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { createAiNodeHandler } from './http';
import { EVERY_AI_TOOL_NAME, SOLAR_RETURN_SWITCH_ENV, UNDER_13_REFUSAL } from './contracts';
import { createLocalTimeModule } from '../../api/_compute/local-time.mjs';
import { getSolarReturn } from './features/solar-return';
import { parseSolarReturnShare } from '../lib/solar-return/share';
import { handleSolarReturnImageRequest, handleSolarReturnLinkRequest, isResultShareRoute } from '../server/result-preview';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import type { HoroscopeWindow } from './horoscope/window';
import vercel from '../../vercel.json';

/** ZODIACS_SOLAR_RETURN_ENABLED stays off until the owner switches it on; off, the server answers as main does. */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
const NOW = new Date('2026-11-09T08:00:00Z');
const COVERAGE = { ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' };

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

describe('the solar return switch', () => {
  it('off: tools/list and get_capabilities as main answers them, and the tool is unknown', async () => {
    expect(SOLAR_RETURN_SWITCH_ENV).toBe('ZODIACS_SOLAR_RETURN_ENABLED');
    for (const value of [undefined, '0', 'true']) {
      const counted: string[] = [];
      const host = await serve({ ...COVERAGE, ZODIACS_SOLAR_RETURN_ENABLED: value }, counted);
      expect((await post(host, rpc('tools/list'))).text).toBe(FIXTURE.coverage.toolsList.text);
      expect((await post(host, rpc('tools/call', { name: 'get_solar_return', arguments: { birthDate: '1990-05-03' } }))).text).toBe(FIXTURE.coverage.save.text);
      expect(counted).toEqual([]);
    }
  });
  it('on: lists get_solar_return last, every other tool as main, answers and counts, and refuses a child', async () => {
    const counted: string[] = [];
    const host = await serve({ ...COVERAGE, ZODIACS_SOLAR_RETURN_ENABLED: '1' }, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, 'get_solar_return']);
    expect(JSON.stringify(tools.slice(0, -1))).toBe(JSON.stringify(message(FIXTURE.coverage.toolsList.text).result.tools));
    expect(tools.at(-1)!.description).not.toMatch(/[–—]/u);
    const result = message((await post(host, rpc('tools/call', { name: 'get_solar_return', arguments: { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 } }))).text).result;
    expect(result.isError).toBe(false);
    expect(result.structuredContent.data).toMatchObject({ which: 'next', returnYear: 2027, sun: 'taurus', timeKnown: true, placed: true });
    expect(counted).toEqual(['get_solar_return']);
    const child = message((await post(host, rpc('tools/call', { name: 'get_solar_return', arguments: { birthDate: '2020-01-01' } }))).text).result;
    expect(child.structuredContent.error.message).toBe(UNDER_13_REFUSAL);
  });
});

describe('getSolarReturn', () => {
  const clock = createLocalTimeModule();
  afterAll(() => clock.dispose());
  const banned = /\b(?:buy|sell|stocks?|crypto\w*|bitcoin|diagnos\w*|death|die|dies|dying|doom\w*)\b|\byou will (?:win|lose)\b|[–—]/iu;

  it('gives the next birthday’s chart with every theme when the time and place are known, and keeps birth details out of links', async () => {
    const { data, links } = await getSolarReturn({ birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 }, NOW, clock, 'https://zodiacs.org');
    expect(data.instantUtc.slice(0, 10)).toMatch(/^2027-05-0[2-4]$/u);
    expect(data.rising).not.toBeNull();
    expect(data.themes.map((theme) => theme.kind)).toEqual(['rising', 'sun-house', 'moon', 'jupiter', 'saturn', 'aspect']);
    expect(data.placements.find((row) => row.body === 'Sun')).toMatchObject({ sign: 'taurus' });
    expect(data.placements.every((row) => row.house !== null)).toBe(true);
    // The return falls on the birthday, so its date is in the answer; the year, time and place of birth are not, and no link carries the birthday.
    const text = JSON.stringify({ data, links });
    for (const detail of ['1990', '08:30', '40.42']) expect(text).not.toContain(detail);
    for (const url of [data.pageUrl, data.shareUrl!, ...links.map((link) => link.url)]) expect(url).not.toMatch(/05-03|1990|0503|Madrid|40\.4/u);
    expect(parseSolarReturnShare(new URL(data.shareUrl!).searchParams)).toMatchObject({ sun: 'taurus', year: 2027, jupiter: data.placements.find((row) => row.body === 'Jupiter')!.sign });
    expect(data.themes.map((theme) => theme.line).join(' ')).not.toMatch(banned);
    expect(data.confidenceLabel).toBe('Reading confidence 70%');
  });
  it('links to the birthday report only while the site has it switched on', async () => {
    const args = { birthDate: '1990-05-03' };
    const off = await getSolarReturn(args, NOW, clock, 'https://zodiacs.org');
    expect(off.links.map((link) => link.url)).not.toContain('https://zodiacs.org/birthday-report/');
    const on = await getSolarReturn(args, NOW, clock, 'https://zodiacs.org', true);
    expect(on.links.map((link) => link.url)).toContain('https://zodiacs.org/birthday-report/');
  });
  it('leaves out the Moon, rising sign and houses without a birth time, and says so', async () => {
    const { data } = await getSolarReturn({ birthDate: '1990-05-03' }, NOW, clock, 'https://zodiacs.org');
    expect(data.rising).toBeNull();
    expect(data.placements.some((row) => row.body === 'Moon')).toBe(false);
    expect(data.placements.every((row) => row.house === null)).toBe(true);
    expect(data.themes.map((theme) => theme.kind)).toEqual(['jupiter', 'saturn', 'aspect']);
    expect(data.limits.join(' ')).toContain('No birth time was given');
    expect(data.confidenceLabel).toBe('Reading confidence 55%');
  });
  it('casts an untimed birth from 12:00 UTC whatever the zone, as the site does, and says the return can move by about a day', async () => {
    const tokyo = await getSolarReturn({ birthDate: '1990-05-03', zone: 'Asia/Tokyo' }, NOW, clock, 'https://zodiacs.org');
    const plain = await getSolarReturn({ birthDate: '1990-05-03' }, NOW, clock, 'https://zodiacs.org');
    expect(tokyo.data.instantUtc).toBe(plain.data.instantUtc);
    expect(tokyo.data.placements).toEqual(plain.data.placements);
    expect(tokyo.data.themes).toEqual(plain.data.themes);
    expect(tokyo.data.sun).toBe('taurus');
    expect(tokyo.data.shareUrl).toBe(plain.data.shareUrl);
    for (const { data } of [tokyo, plain]) {
      expect(data.limits.join(' ')).toContain('about a day');
      expect(data.limits.join(' ')).not.toContain('half a day');
    }
  });
  it('gives an untimed return as its UTC date, not a clock time, on any clock', async () => {
    const plain = await getSolarReturn({ birthDate: '1990-05-03' }, NOW, clock, 'https://zodiacs.org');
    const elsewhere = await getSolarReturn({ birthDate: '1990-05-03', zone: 'Asia/Tokyo', currentZone: 'America/Los_Angeles' }, NOW, clock, 'https://zodiacs.org');
    for (const { data } of [plain, elsewhere]) {
      expect(data.local).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2} \d{4}$/u);
      expect(data.local).not.toMatch(/\d\d:\d\d/u);
      expect(data.zone).toBe('UTC');
      expect(data.limits).toContain('Without a birth time the return is given as its date in UTC, not a clock time, and it can be a day either side.');
      expect(data.limits.join(' ')).not.toMatch(/The time is/u);
    }
    expect(elsewhere.data.local).toBe(plain.data.local);
    expect(plain.data.local).toBe(new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(plain.data.instantUtc)).replace(',', ''));
    // A timed birth keeps its clock time on the person's clock.
    const timed = await getSolarReturn({ birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }, NOW, clock, 'https://zodiacs.org');
    expect(timed.data.local).toMatch(/, \d\d:\d\d$/u);
    expect(timed.data.zone).toBe('Europe/Madrid');
    expect(timed.data.limits).toContain('The time is on the birthplace clock (Europe/Madrid) because no current time zone was given.');
  });
  it('names no Sun sign and gives no share link when an untimed birth day straddles a sign change', async () => {
    // The Sun entered Aries on 20 March 1990 at 21:19 UTC.
    const { data } = await getSolarReturn({ birthDate: '1990-03-20' }, NOW, clock, 'https://zodiacs.org');
    expect(data.sun).toBeNull();
    expect(data.shareUrl).toBeNull();
    // On the Tokyo clock the day ended at 14:59 UTC, before the change: still Pisces all day.
    const tokyo = await getSolarReturn({ birthDate: '1990-03-20', zone: 'Asia/Tokyo' }, NOW, clock, 'https://zodiacs.org');
    expect(tokyo.data.sun).toBe('pisces');
  });
  it('gives the current return when asked', async () => {
    const { data } = await getSolarReturn({ birthDate: '1990-05-03', which: 'current' }, NOW, clock, 'https://zodiacs.org');
    expect(data.instantUtc.slice(0, 4)).toBe('2026');
  });
});

describe('the solar return share card', () => {
  it('is routed through the share function and draws a card and a page with no birth detail', async () => {
    expect(isResultShareRoute('solar-return-link') && isResultShareRoute('solar-return-image')).toBe(true);
    expect((vercel as { rewrites: unknown[] }).rewrites).toContainEqual({ source: '/share/solar-return/', destination: '/api/compatibility?__zodiacs_share=solar-return-link' });
    const image = await handleSolarReturnImageRequest(new Request('https://zodiacs.org/api/og/solar-return-image?s=taurus&y=2027&r=leo&j=leo'));
    expect(image.headers.get('content-type')).toBe('image/jpeg');
    const html = await (await handleSolarReturnLinkRequest(new Request('https://zodiacs.org/share/solar-return/?s=taurus&y=2027&r=leo&j=leo'))).text();
    expect(html).toContain('My 2027 solar return: Leo rising');
    expect(html).toContain('href="/solar-return/"');
    expect(html).not.toMatch(/[–—]/u);
    for (const query of ['s=taurus&y=2027&j=leo&d=05-03', 's=taurus&y=27&j=leo', 's=taurus&y=2027']) expect(parseSolarReturnShare(new URLSearchParams(query)), query).toBeNull();
  }, 30_000);
});
