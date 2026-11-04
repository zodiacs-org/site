import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { ALL_AI_TOOL_NAMES, EVERY_AI_TOOL_NAME, EVERY_TOOL_WITH_SKY_EVENTS, SKY_EVENTS_SWITCH_ENV, TOOL_DESCRIPTIONS, TOOL_TITLES } from './contracts';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * ZODIACS_SKY_EVENTS_ENABLED stays off in production while the directories review the nineteen tools. Off (unset,
 * empty, '0' or anything but '1'), or on without the coverage switch, the hosted server must answer initialize,
 * tools/list, resources/list, get_capabilities and the account routes with exactly the bytes of
 * src/ai-tools/accounts/flag-off.fixture.json, which main answers with. On, it adds search_sky_events last and widens
 * get_natal_chart and explain_astrology; the thirteen published definitions keep their bytes either way.
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

  it('keeps the thirteen published definitions byte for byte and the other coverage tools as they are, and lists search_sky_events last', async () => {
    const host = await serve(env);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    const before = message(FIXTURE.coverage.toolsList.text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_TOOL_WITH_SKY_EVENTS]);
    expect(tools).toHaveLength(20);
    // The thirteen, byte for byte as the live server published them on 1 November 2026.
    expect(LIVE.map((tool) => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(JSON.stringify(tools.slice(0, 13))).toBe(JSON.stringify(LIVE));
    // Every other entry of the nineteen is as main lists it, but the two the switch widens.
    for (const [index, tool] of before.entries()) {
      if (tool.name === 'get_natal_chart' || tool.name === 'explain_astrology') continue;
      expect(JSON.stringify(tools[index]), tool.name).toBe(JSON.stringify(tool));
    }
    const natal = tools.find((tool) => tool.name === 'get_natal_chart')!;
    const natalBefore = before.find((tool) => tool.name === 'get_natal_chart')!;
    expect(natal.description.startsWith(natalBefore.description)).toBe(true);
    expect(natal.description).toContain('houseSystem is placidus');
    expect(natal.inputSchema.properties.houseSystem).toMatchObject({ type: 'string', enum: ['whole-sign', 'placidus'] });
    expect(Object.keys(natal.inputSchema.properties)).toEqual([...Object.keys(natalBefore.inputSchema.properties), 'houseSystem']);
    expect(JSON.stringify(natal.outputSchema)).toContain('"nodes"');
    expect(natal._meta).toEqual(natalBefore._meta);
    const explain = tools.find((tool) => tool.name === 'explain_astrology')!;
    expect(explain.description).toContain('use search_sky_events');
    expect(explain.inputSchema.properties.topic.description).toContain('the lunar nodes');
    expect(JSON.stringify(explain.outputSchema)).toBe(JSON.stringify(before.find((tool) => tool.name === 'explain_astrology')!.outputSchema));
    const sky = tools.at(-1)!;
    expect(sky).toMatchObject({ name: 'search_sky_events', title: TOOL_TITLES.search_sky_events, description: TOOL_DESCRIPTIONS.search_sky_events,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false, title: 'Search sky events' } });
    expect(sky._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
    expect(sky).not.toHaveProperty('icons');
    expect(Object.keys(sky.inputSchema.properties)).toEqual(['kinds', 'planets', 'from', 'to', 'zone', 'limit']);
    expect(sky.description).toContain('use get_upcoming_events');
    expect(sky.description).toContain('use get_sky_calendar');
    expect(`${sky.title} ${sky.description} ${JSON.stringify(sky.inputSchema)}`).not.toMatch(/[–—]|crypto|token|blockchain|market/iu);
    // No panel and no new resource; initialize is unchanged and the server stays 0.6.1.
    expect((await post(host, REQUESTS.resourcesList[0])).text).toBe(FIXTURE.coverage.resourcesList.text);
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
    expect(natal.structuredContent.data).toMatchObject({ houseSystem: 'placidus', nodes: { node: 'true' } });
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
    ];
    for (const [name, args] of calls) {
      const result = await call(host, name, args);
      expect(result.isError, `${name} ${JSON.stringify(args)}`).toBe(false);
      const validate = ajv.compile(tools.find((tool) => tool.name === name)!.outputSchema);
      expect(validate(result.structuredContent), `${name} ${JSON.stringify(args)}: ${ajv.errorsText(validate.errors)}`).toBe(true);
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
