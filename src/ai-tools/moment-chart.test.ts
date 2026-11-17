import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { ALL_AI_TOOL_NAMES, EVERY_AI_TOOL_NAME, MOMENT_CHART_SWITCH_ENV, TOOL_DESCRIPTIONS, TOOL_TITLES, UNDER_13_REFUSAL } from './contracts';
import { executeAiTool } from './tools';
import { MOMENT_NOTE } from './features/moment-chart';
import { PUBLISHED_TOOLS } from './published-tools';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';

/**
 * ZOD-62: get_natal_chart refuses a birth date less than 13 years ago, so it cannot cast a chart for today. The moment
 * chart casts one for an instant and a place, with houses and the rising sign, and takes no name or birth date.
 * ZODIACS_MOMENT_CHART_ENABLED stays off: off (unset, empty, '0' or anything but '1'), or on without the coverage
 * switch, the hosted server answers initialize, tools/list, resources/list, get_capabilities and the account routes
 * with exactly the bytes of src/ai-tools/accounts/flag-off.fixture.json, as main answers. On, it adds
 * get_moment_chart last and changes nothing else in tools/list.
 */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const NOW = new Date('2026-11-17T09:30:00Z');
const YEAR_AGO = '2025-11-17';
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

async function serve(env: Record<string, string | undefined>, counted: string[] = [], now?: Date) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow,
      horoscopeMonths: async () => committedMonths, horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram, ...(now ? { now: () => now } : {}) } });
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
const REQUESTS: Record<string, [unknown, Record<string, string>?]> = {
  initialize: [rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flag-off', version: '1' } })],
  toolsList: [rpc('tools/list')],
  resourcesList: [rpc('resources/list')],
  capabilities: [rpc('tools/call', { name: 'get_capabilities', arguments: {} })],
  save: [rpc('tools/call', { name: 'save_to_zodiacs', arguments: { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12' } } })],
  bearer: [rpc('tools/list'), { Authorization: 'Bearer not-a-token' }],
};
const SCENARIOS = { released: {}, occasions: { ZODIACS_OCCASIONS_ENABLED: '1' }, coverage: { ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' } } as const;
const ON = { ...SCENARIOS.coverage, ZODIACS_MOMENT_CHART_ENABLED: '1' };
const call = async (host: string, name: string, args: unknown) => message((await post(host, rpc('tools/call', { name, arguments: args }))).text).result;
const BANGKOK = { latitude: 13.7563, longitude: 100.5018 };
const SIGN = /^(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)$/u;

function expectChart(data: Record<string, any>) {
  expect(data.kind).toBe('moment');
  expect(data.note).toBe(MOMENT_NOTE);
  expect(data.rising.sign).toMatch(SIGN);
  expect(data.midheaven.sign).toMatch(SIGN);
  expect(data.planets).toHaveLength(10);
  for (const planet of data.planets) {
    expect(planet.sign, planet.body).toMatch(SIGN);
    expect(planet.house, planet.body).toBeGreaterThanOrEqual(1);
    expect(planet.house, planet.body).toBeLessThanOrEqual(12);
  }
  expect(data.houses.map((house: { house: number }) => house.house)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(data.houses[0].sign).toBe(data.rising.sign);
  expect(data.aspects.length).toBeGreaterThan(0);
  // No person: no birth date, name, under-18 flag or reading lines.
  for (const key of ['birthDate', 'name', 'under18', 'meaning', 'signLine', 'houseLine']) expect(JSON.stringify(data)).not.toContain(`"${key}"`);
}

describe('the moment chart switch off', () => {
  it('leaves every scenario\'s initialize, tools/list, resources/list, get_capabilities and account routes byte for byte as main answers them', async () => {
    expect(MOMENT_CHART_SWITCH_ENV).toBe('ZODIACS_MOMENT_CHART_ENABLED');
    for (const [name, env] of Object.entries(SCENARIOS)) {
      const values = name === 'coverage' ? [undefined, '', '0', 'true', ' 1', 'yes'] : [undefined, '1'];
      for (const value of values) {
        const host = await serve({ ...env, ZODIACS_MOMENT_CHART_ENABLED: value });
        for (const [request, [body, headers]] of Object.entries(REQUESTS)) {
          const reply = await post(host, body, headers);
          expect(reply.text, `${name} ${request} with ZODIACS_MOMENT_CHART_ENABLED=${JSON.stringify(value)}`).toBe(FIXTURE[name][request].text);
        }
      }
    }
  }, 120_000);

  it('neither lists, runs nor counts get_moment_chart', async () => {
    const counted: string[] = [];
    const host = await serve(SCENARIOS.coverage, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string }[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME]);
    // Called anyway, it is an unknown tool, answered exactly as main answers a call to one (the fixture's save call).
    const refused = await post(host, rpc('tools/call', { name: 'get_moment_chart', arguments: BANGKOK }));
    expect(refused.text).toBe(FIXTURE.coverage.save.text);
    expect(counted).toEqual([]);
    // Run directly without the switch, it is not offered.
    const direct = await executeAiTool('get_moment_chart', BANGKOK, { occasions: true, coverage: true, now: () => NOW });
    expect(direct).toMatchObject({ ok: false, error: { code: 'unavailable' } });
  });
});

describe('the moment chart switch on', () => {
  it('keeps the thirteen published definitions and every other entry byte for byte, and lists get_moment_chart last', async () => {
    const host = await serve(ON);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    const before = message(FIXTURE.coverage.toolsList.text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, 'get_moment_chart']);
    expect(PUBLISHED_TOOLS.map((tool) => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(JSON.stringify(tools.slice(0, 13))).toBe(JSON.stringify(PUBLISHED_TOOLS));
    expect(JSON.stringify(tools.slice(0, -1))).toBe(JSON.stringify(before));
    const tool = tools.at(-1)!;
    expect(tool).toMatchObject({ name: 'get_moment_chart', title: TOOL_TITLES.get_moment_chart, description: TOOL_DESCRIPTIONS.get_moment_chart,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false, title: 'Chart for a moment' } });
    expect(tool._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
    // No name and no birth date: an instant or a local time, and a place.
    expect(Object.keys(tool.inputSchema.properties)).toEqual(['instant', 'date', 'time', 'zone', 'latitude', 'longitude', 'houseSystem']);
    expect(tool.inputSchema.required).toEqual(['latitude', 'longitude']);
    expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(tool.description).toContain('a chart for a moment rather than for a person');
    expect(tool.description).toContain("It is not a birth chart and not for anyone's birth: it takes no name and no birth date, and gives no reading about a person");
    expect(tool.description).toContain('not stored, logged or put in a link');
    expect(`${tool.title} ${tool.description} ${JSON.stringify(tool.inputSchema)}`).not.toMatch(/[–—]|crypto|token|blockchain|market/iu);
    expect(tool.description).not.toMatch(/\buse it\b|tell the person|never guess|\bask (?:the|them)\b/iu);
    expect((await post(host, REQUESTS.initialize[0])).text).toBe(FIXTURE.coverage.initialize.text);
    expect((await post(host, REQUESTS.resourcesList[0])).text).toBe(FIXTURE.coverage.resourcesList.text);
    const capabilities = (await call(host, 'get_capabilities', {})).structuredContent.data;
    expect(capabilities.coverage.tools.split(', ').at(-1)).toBe('get_moment_chart');
    expect(capabilities.limitations.join(' ')).toContain('It is not a birth chart: it takes no name or birth date and gives no reading about a person.');
    expect(capabilities.privacy).toContain('The moment chart tool takes a moment and a place\'s coordinates, and no name or birth date, for that call only');
  });

  it('casts a chart with houses for right now, validated against its advertised schema, with no moment or place in a link', async () => {
    const counted: string[] = [];
    const host = await serve(ON, counted, NOW);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; outputSchema: object }[];
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(tools.find((tool) => tool.name === 'get_moment_chart')!.outputSchema);
    const raw = (await post(host, rpc('tools/call', { name: 'get_moment_chart', arguments: { ...BANGKOK, zone: 'Asia/Bangkok' } }))).text;
    const result = message(raw).result;
    expect(result.isError).toBe(false);
    expect(validate(result.structuredContent), ajv.errorsText(validate.errors)).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    const data = result.structuredContent.data;
    expectChart(data);
    expect(data.castFor).toEqual({ utc: NOW.toISOString(), local: '2026-11-17T16:30:00+07:00', zone: 'Asia/Bangkok', basis: 'now' });
    expect(data.houseSystem).toBe('whole-sign');
    // The Sun is in Scorpio on 17 November 2026.
    expect(data.planets[0]).toMatchObject({ body: 'Sun', sign: 'scorpio' });
    for (const link of result.structuredContent.links as { url: string }[]) {
      expect(link.url).toMatch(/^https:\/\/zodiacs\.org\/(?:today|learn\/houses|learn\/aspects)\/\?ref=assistant$/u);
    }
    for (const fragment of ['2026-11-17', '13.76', '100.5', 'Bangkok']) {
      expect(JSON.stringify(result.structuredContent.links)).not.toContain(fragment);
    }
    expect(counted).toEqual(['get_moment_chart']);
  });

  it('casts a chart with houses for a moment a year ago, by local time and by instant, where get_natal_chart refuses that date as a birth', async () => {
    const host = await serve(ON, [], NOW);
    const local = await call(host, 'get_moment_chart', { date: YEAR_AGO, time: '20:00', zone: 'Asia/Bangkok', ...BANGKOK });
    expect(local.isError).toBe(false);
    expectChart(local.structuredContent.data);
    expect(local.structuredContent.data.castFor).toEqual({ utc: '2025-11-17T13:00:00.000Z', local: '2025-11-17T20:00:00+07:00', zone: 'Asia/Bangkok', basis: 'local-time' });
    const instant = await call(host, 'get_moment_chart', { instant: '2025-11-17T13:00:00Z', ...BANGKOK, houseSystem: 'placidus' });
    expect(instant.isError).toBe(false);
    expectChart(instant.structuredContent.data);
    expect(instant.structuredContent.data.castFor).toEqual({ utc: '2025-11-17T13:00:00.000Z', local: null, zone: null, basis: 'instant' });
    expect(instant.structuredContent.data.houseSystem).toBe('placidus');
    // The same moment gives the same planets and rising sign, whichever way it is given.
    expect(instant.structuredContent.data.planets.map((planet: { position: string }) => planet.position)).toEqual(local.structuredContent.data.planets.map((planet: { position: string }) => planet.position));
    expect(instant.structuredContent.data.rising).toEqual(local.structuredContent.data.rising);
    // The under-13 rule stays in place for births: the same date as a birth date is refused.
    const natal = await call(host, 'get_natal_chart', { birthDate: YEAR_AGO, time: '20:00', zone: 'Asia/Bangkok', ...BANGKOK });
    expect(natal.isError).toBe(true);
    expect(natal.structuredContent).toMatchObject({ ok: false, tool: 'get_natal_chart', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
  });

  it('is cast by the same engine path as the birth chart', async () => {
    const host = await serve(ON, [], NOW);
    const at = { time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    const natal = (await call(host, 'get_natal_chart', { birthDate: '1990-05-03', ...at })).structuredContent.data;
    const moment = (await call(host, 'get_moment_chart', { date: '1990-05-03', ...at })).structuredContent.data;
    expect(moment.castFor.utc).toBe(natal.castFor.utc);
    expect(moment.rising.sign).toBe(natal.rising.sign);
    expect(moment.midheaven.position).toBe(natal.angles.midheaven);
    expect(moment.planets.map((planet: Record<string, unknown>) => [planet.body, planet.sign, planet.position, planet.retrograde, planet.house]))
      .toEqual(natal.planets.map((planet: Record<string, unknown>) => [planet.body, planet.sign, planet.position, planet.retrograde, planet.house]));
  });

  it('takes no name or birth date, and get_natal_chart keeps the under-13 refusal', async () => {
    const host = await serve(ON, [], NOW);
    const named = await call(host, 'get_moment_chart', { ...BANGKOK, name: 'Small Child' });
    expect(named.isError).toBe(true);
    expect(JSON.stringify(named)).not.toContain('Small');
    const born = await call(host, 'get_moment_chart', { ...BANGKOK, birthDate: '2020-01-01' });
    expect(born.isError).toBe(true);
    expect(born.structuredContent).toMatchObject({ ok: false, tool: 'get_moment_chart', error: { code: 'invalid-request', message: 'Leave out fields this tool does not take.' } });
    expect(JSON.stringify(born)).not.toContain('2020-01-01');
    // get_natal_chart still refuses today and any date less than 13 years ago.
    for (const birthDate of ['2026-11-17', YEAR_AGO, '2013-11-18']) {
      const natal = await call(host, 'get_natal_chart', { birthDate });
      expect(natal.structuredContent, birthDate).toMatchObject({ ok: false, error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
    }
    expect((await call(host, 'get_natal_chart', { birthDate: '2013-11-17' })).isError).toBe(false);
  });

  it('refuses a moment it cannot place, naming the field', async () => {
    const host = await serve(ON, [], NOW);
    const noPlace = await call(host, 'get_moment_chart', {});
    expect(noPlace.structuredContent.error.message).toContain('latitude is required.');
    const noZone = await call(host, 'get_moment_chart', { date: YEAR_AGO, time: '20:00', ...BANGKOK });
    expect(noZone.structuredContent.error.message).toContain('A local date and time need their time zone.');
    const both = await call(host, 'get_moment_chart', { instant: '2025-11-17T13:00:00Z', date: YEAR_AGO, time: '20:00', zone: 'Asia/Bangkok', ...BANGKOK });
    expect(both.structuredContent.error.message).toContain('Give either instant, or date and time with zone, not both.');
    const outside = await call(host, 'get_moment_chart', { instant: '1700-01-01T00:00:00Z', ...BANGKOK });
    expect(outside.isError).toBe(true);
  });
});
