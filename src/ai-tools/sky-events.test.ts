import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { ALL_AI_TOOL_NAMES, EVERY_AI_TOOL_NAME, EVERY_TOOL_WITH_SKY_EVENTS, READINGS_SKY_EVENTS_URI, READINGS_URI, SKY_EVENTS_SWITCH_ENV, TOOL_DESCRIPTIONS, TOOL_TITLES } from './contracts';
import { READINGS_SKY_EVENTS_HTML } from '../../integrations/generated/readings-sky-events.mjs';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * ZODIACS_SKY_EVENTS_ENABLED stays off in production while the directories review the nineteen tools. Off (unset,
 * empty, '0' or anything but '1'), or on without the coverage switch, the hosted server must answer initialize,
 * tools/list, resources/list, get_capabilities and the account routes with exactly the bytes of
 * src/ai-tools/accounts/flag-off.fixture.json, which main answers with. On, it adds search_sky_events last, widens
 * get_natal_chart, explain_astrology, get_chinese_zodiac and get_horoscope_period (the last two return a share link to
 * their cards, the natal chart one to the big three's), and gives get_natal_chart the readings panel that lists the
 * lunar nodes; the thirteen published definitions keep their bytes either way.
 */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const LIVE = JSON.parse(readFileSync(new URL('../../docs/platform/zodiacs-ai/evidence/0.6.0/tools-list.live-2026-11-01.json', import.meta.url), 'utf8')).result.tools as Record<string, unknown>[];
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

async function serve(env: Record<string, string | undefined>, counted: string[] = []) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  // As api/_ai/handler.ts supplies them, and as the flag-off fixture was captured.
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow,
      horoscopeMonths: async () => committedMonths, horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram } });
  return host;
}

function post(host: string, body: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', ...headers } }, (res) => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, text }));
    });
    req.on('error', reject); req.end(JSON.stringify(body));
  });
}
const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const message = (text: string) => JSON.parse(text.includes('\ndata: ') || text.startsWith('event:') || text.startsWith('data: ') ? text.split('\n').find((line) => line.startsWith('data: '))!.slice(6) : text);
/** The requests the flag-off fixture records, by its names. */
const REQUESTS: Record<string, [unknown, Record<string, string>?]> = {
  initialize: [rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flag-off', version: '1' } })],
  toolsList: [rpc('tools/list')],
  resourcesList: [rpc('resources/list')],
  capabilities: [rpc('tools/call', { name: 'get_capabilities', arguments: {} })],
  save: [rpc('tools/call', { name: 'save_to_zodiacs', arguments: { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12' } } })],
  bearer: [rpc('tools/list'), { Authorization: 'Bearer not-a-token' }],
};
const SCENARIOS = { released: {}, occasions: { ZODIACS_OCCASIONS_ENABLED: '1' }, coverage: { ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' } } as const;
const call = async (host: string, name: string, args: unknown) => message((await post(host, rpc('tools/call', { name, arguments: args }))).text).result;

describe('the sky events switch off', () => {
  it('leaves every scenario\'s initialize, tools/list, resources/list, get_capabilities and account routes byte for byte as main answers them', async () => {
    expect(SKY_EVENTS_SWITCH_ENV).toBe('ZODIACS_SKY_EVENTS_ENABLED');
    for (const [name, env] of Object.entries(SCENARIOS)) {
      // On without the coverage switch counts as off, so '1' joins the off values for the first two scenarios.
      const values = name === 'coverage' ? [undefined, '', '0', 'true', ' 1', '1 ', 'yes'] : [undefined, '0', '1'];
      for (const value of values) {
        const host = await serve({ ...env, ZODIACS_SKY_EVENTS_ENABLED: value });
        for (const [request, [body, headers]] of Object.entries(REQUESTS)) {
          const reply = await post(host, body, headers);
          expect(reply.text, `${name} ${request} with ZODIACS_SKY_EVENTS_ENABLED=${JSON.stringify(value)}`).toBe(FIXTURE[name][request].text);
        }
      }
    }
  }, 120_000);

  it('lists the nineteen tools, every field as main lists it, and neither runs nor counts search_sky_events', async () => {
    const counted: string[] = [];
    const host = await serve({ ...SCENARIOS.coverage, ZODIACS_SKY_EVENTS_ENABLED: '0' }, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string }[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME]);
    expect(JSON.stringify(tools)).toBe(JSON.stringify(message(FIXTURE.coverage.toolsList.text).result.tools));
    // Called anyway, it is an unknown tool, answered exactly as main answers a call to one (the fixture's save call).
    const refused = await post(host, rpc('tools/call', { name: 'search_sky_events', arguments: { kinds: ['full-moon'] } }));
    expect(refused.text).toBe(FIXTURE.coverage.save.text);
    expect(counted).toEqual([]);
  });
});

describe('the sky events switch on', () => {
  const env = { ...SCENARIOS.coverage, ZODIACS_SKY_EVENTS_ENABLED: '1' };

  it('keeps the thirteen published definitions byte for byte and the coverage tools it does not widen as they are, and lists search_sky_events last', async () => {
    const host = await serve(env);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    const before = message(FIXTURE.coverage.toolsList.text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_TOOL_WITH_SKY_EVENTS]);
    expect(tools).toHaveLength(20);
    // The thirteen, byte for byte as the live server published them on 1 November 2026.
    expect(LIVE.map((tool) => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(JSON.stringify(tools.slice(0, 13))).toBe(JSON.stringify(LIVE));
    // Every other entry of the nineteen is as main lists it, but the four the switch widens.
    const widened = ['get_natal_chart', 'explain_astrology', 'get_chinese_zodiac', 'get_horoscope_period'];
    for (const [index, tool] of before.entries()) {
      if (widened.includes(tool.name)) continue;
      expect(JSON.stringify(tools[index]), tool.name).toBe(JSON.stringify(tool));
    }
    // The Chinese zodiac and a period's horoscope take what they took, keep their panel, and add a share link to their cards.
    for (const name of ['get_chinese_zodiac', 'get_horoscope_period']) {
      const tool = tools.find((entry) => entry.name === name)!;
      const was = before.find((entry) => entry.name === name)!;
      expect(tool.description.startsWith(was.description), name).toBe(true);
      expect(tool.description, name).toContain('give them the returned shareUrl exactly');
      expect(JSON.stringify(tool.inputSchema), name).toBe(JSON.stringify(was.inputSchema));
      expect(tool._meta, name).toEqual(was._meta);
      expect(tool.outputSchema.anyOf[0].properties.data.properties.shareUrl, name).toEqual({ anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] });
      expect(JSON.stringify(tool.outputSchema).replace(',"shareUrl":{"anyOf":[{"type":"string","format":"uri"},{"type":"null"}]}', '').replace(',"shareUrl"]', ']'), name).toBe(JSON.stringify(was.outputSchema));
    }
    const natal = tools.find((tool) => tool.name === 'get_natal_chart')!;
    const natalBefore = before.find((tool) => tool.name === 'get_natal_chart')!;
    expect(natal.description.startsWith(natalBefore.description)).toBe(true);
    expect(natal.description).toContain('houseSystem is placidus');
    expect(natal.inputSchema.properties.houseSystem).toMatchObject({ type: 'string', enum: ['whole-sign', 'placidus'] });
    expect(Object.keys(natal.inputSchema.properties)).toEqual([...Object.keys(natalBefore.inputSchema.properties), 'houseSystem']);
    expect(JSON.stringify(natal.outputSchema)).toContain('"nodes"');
    // Chiron, from NASA JPL Horizons positions, in the natal chart and the explainer.
    expect(natal.description).toContain('and Chiron, from NASA JPL Horizons positions for 1800 to 2199');
    expect(JSON.stringify(natal.outputSchema)).toContain('"chiron"');
    expect(natal.outputSchema.anyOf[0].properties.data.properties.shareUrl).toEqual({ anyOf: [{ type: 'string', format: 'uri' }, { type: 'null' }] });
    expect(natal.description).toContain('If they want to share their big three, give them the returned shareUrl exactly');
    // Its panel is the one that lists the lunar nodes; every other part of its _meta is as main has it.
    expect(natalBefore._meta.ui.resourceUri).toBe(READINGS_URI);
    expect(natal._meta).toEqual({ ...natalBefore._meta, ui: { ...natalBefore._meta.ui, resourceUri: READINGS_SKY_EVENTS_URI }, 'openai/outputTemplate': READINGS_SKY_EVENTS_URI });
    const explain = tools.find((tool) => tool.name === 'explain_astrology')!;
    expect(explain.description).toContain('use search_sky_events');
    expect(explain.inputSchema.properties.topic.description).toContain('the lunar nodes');
    expect(explain.inputSchema.properties.topic.description).toContain('Chiron or Chiron in a sign or house');
    expect(JSON.stringify(explain.outputSchema)).toBe(JSON.stringify(before.find((tool) => tool.name === 'explain_astrology')!.outputSchema));
    const sky = tools.at(-1)!;
    expect(sky).toMatchObject({ name: 'search_sky_events', title: TOOL_TITLES.search_sky_events, description: TOOL_DESCRIPTIONS.search_sky_events,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false, title: 'Search sky events' } });
    expect(sky._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
    expect(sky).not.toHaveProperty('icons');
    expect(Object.keys(sky.inputSchema.properties)).toEqual(['kinds', 'planets', 'from', 'to', 'zone', 'limit']);
    expect(sky.description).toContain('use get_upcoming_events');
    expect(sky.description).toContain('planets and Chiron turning retrograde or direct');
    expect(sky.description).toContain('use get_sky_calendar');
    expect(`${sky.title} ${sky.description} ${JSON.stringify(sky.inputSchema)}`).not.toMatch(/[–—]|crypto|token|blockchain|market/iu);
    // One new resource, the natal chart's panel, listed after the readings panel the others keep; initialize is unchanged.
    const resources = message((await post(host, REQUESTS.resourcesList[0])).text).result.resources as { uri: string; name: string }[];
    const resourcesBefore = message(FIXTURE.coverage.resourcesList.text).result.resources as { uri: string; name: string }[];
    const at = resourcesBefore.findIndex((resource) => resource.uri === READINGS_URI);
    expect(resources.map((resource) => resource.uri)).toEqual([...resourcesBefore.slice(0, at + 1).map((resource) => resource.uri), READINGS_SKY_EVENTS_URI, ...resourcesBefore.slice(at + 1).map((resource) => resource.uri)]);
    expect(resources.filter((resource) => resource.uri !== READINGS_SKY_EVENTS_URI)).toEqual(resourcesBefore);
    expect(resources.find((resource) => resource.uri === READINGS_SKY_EVENTS_URI)).toMatchObject({ name: 'readings-sky-events', mimeType: 'text/html;profile=mcp-app' });
    const read = message((await post(host, rpc('resources/read', { uri: READINGS_SKY_EVENTS_URI }))).text).result.contents[0];
    expect(read.text).toBe(READINGS_SKY_EVENTS_HTML);
    expect((await post(host, REQUESTS.initialize[0])).text).toBe(FIXTURE.coverage.initialize.text);
  });

  it('answers search_sky_events with structured content and the same JSON as text, and counts it', async () => {
    const counted: string[] = [];
    const host = await serve(env, counted);
    const result = await call(host, 'search_sky_events', { kinds: ['solar-eclipse', 'lunar-eclipse'], from: '2027-01-01', to: '2027-12-31', zone: 'Europe/London' });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({ ok: true, tool: 'search_sky_events', data: { zone: 'Europe/London', total: 5 } });
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    expect(counted).toContain('search_sky_events');
    const natal = await call(host, 'get_natal_chart', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, houseSystem: 'placidus' });
    expect(natal.structuredContent.data).toMatchObject({ houseSystem: 'placidus', nodes: { node: 'true' }, chiron: { sign: 'cancer', retrograde: false } });
  });

  it('answers with results that validate against the output schemas tools/list advertises, as a client checks them', async () => {
    const host = await serve(env);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; outputSchema: object }[];
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const calls: [string, Record<string, unknown>][] = [
      ['search_sky_events', {}],
      ['search_sky_events', { kinds: ['solar-eclipse', 'lunar-eclipse', 'station', 'ingress', 'new-moon', 'full-moon'], from: '2026-11-04', to: '2028-11-04', limit: 100, zone: 'Asia/Bangkok' }],
      ['search_sky_events', { kinds: ['void-of-course'], from: '2026-11-04', to: '2026-12-04', limit: 100 }],
      ['search_sky_events', { kinds: ['solar-eclipse'], from: '2031-01-01', to: '2031-12-31' }],
      ['get_natal_chart', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Oslo', latitude: 69.65, longitude: 18.96, houseSystem: 'placidus' }],
      ['get_natal_chart', { birthDate: '1990-05-03' }],
      ['explain_astrology', { topic: 'placidus vs whole sign' }],
      ['get_upcoming_events', {}],
      ['get_sky_calendar', {}],
      ['get_capabilities', {}],
      ['get_chinese_zodiac', { birthDate: '1990-01-20' }],
      ['get_chinese_zodiac', { year: 2026 }],
      ['get_chinese_zodiac', {}],
      ['get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-05' }],
      ['get_horoscope_period', { sign: 'leo', period: 'year', date: '2027-03-01' }],
      ['get_horoscope_period', { sign: 'leo', period: 'week', focus: 'love' }],
    ];
    for (const [name, args] of calls) {
      const result = await call(host, name, args);
      expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(false);
      const validate = ajv.compile(tools.find((tool) => tool.name === name)!.outputSchema);
      expect(validate(result.structuredContent), `${name} ${JSON.stringify(args)}: ${ajv.errorsText(validate.errors)}`).toBe(true);
    }
  }, 60_000);

  it('gives the big three, the Chinese zodiac and a published month or year a share link to their cards, with no birth detail', async () => {
    const host = await serve(env);
    const off = await serve(SCENARIOS.coverage);
    const share = async (target: string, name: string, args: Record<string, unknown>) => (await call(target, name, args)).structuredContent.data.shareUrl as string | null | undefined;
    // A timed, placed chart: the Sun, the Moon and the rising sign; untimed on a day the Moon changed sign, the Sun alone.
    expect(await share(host, 'get_natal_chart', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 })).toMatch(/^https:\/\/zodiacs\.org\/share\/big-three\/\?s=taurus&m=[a-z]+&r=[a-z]+&ref=assistant$/u);
    const untimed = await call(host, 'get_natal_chart', { birthDate: '1990-05-04' });
    const moon = untimed.structuredContent.data.moon;
    expect(untimed.structuredContent.data.shareUrl).toBe(moon.sign ? `https://zodiacs.org/share/big-three/?s=taurus&m=${moon.sign}&ref=assistant` : 'https://zodiacs.org/share/big-three/?s=taurus&ref=assistant');
    // A birth date's animal alone; a year's or today's with the year.
    expect(await share(host, 'get_chinese_zodiac', { birthDate: '1990-01-20' })).toBe('https://zodiacs.org/share/chinese-zodiac/?a=snake&ref=assistant');
    expect(await share(host, 'get_chinese_zodiac', { year: 2026 })).toBe('https://zodiacs.org/share/chinese-zodiac/?a=horse&y=2026&ref=assistant');
    expect(await share(host, 'get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-05' })).toBe('https://zodiacs.org/share/horoscope/?s=leo&m=2026-11&ref=assistant');
    expect(await share(host, 'get_horoscope_period', { sign: 'leo', period: 'year', date: '2027-03-01' })).toBe('https://zodiacs.org/share/horoscope/?s=leo&y=2027&ref=assistant');
    expect(await share(host, 'get_horoscope_period', { sign: 'leo', period: 'week', focus: 'career' })).toBeNull();
    // Switched off, none of them returns one, as main answers them.
    for (const [name, args] of [['get_natal_chart', { birthDate: '1990-05-03' }], ['get_chinese_zodiac', { year: 2026 }], ['get_horoscope_period', { sign: 'leo', period: 'month', date: '2026-11-05' }]] as const) {
      expect(await share(off, name, args), name).toBeUndefined();
    }
  }, 60_000);

  it('names the field the SDK refuses, never repeating what was sent', async () => {
    const host = await serve(env);
    const kind = await call(host, 'search_sky_events', { kinds: ['eclipse'] });
    expect(kind.isError).toBe(true);
    expect(kind.structuredContent).toEqual({ schema: 'zodiacs.ai-tool-result.v1', ok: false, tool: 'search_sky_events', error: { code: 'invalid-request', message: 'kinds[0] must be one of: solar-eclipse, lunar-eclipse, station, ingress, new-moon, full-moon, void-of-course.' } });
    const unknown = await call(host, 'search_sky_events', { secretField: 'private-canary' });
    expect(unknown.structuredContent.error.message).toBe('Leave out fields this tool does not take.');
    expect(JSON.stringify(unknown)).not.toMatch(/secretField|private-canary/u);
    const house = await call(host, 'get_natal_chart', { birthDate: '1990-05-03', houseSystem: 'koch' });
    expect(house.structuredContent.error.message).toBe('houseSystem must be one of: whole-sign, placidus.');
  });
});
