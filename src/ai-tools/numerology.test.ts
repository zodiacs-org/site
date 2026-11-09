import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { ALL_AI_TOOL_NAMES, EVERY_AI_TOOL_NAME, EVERY_SWITCHED_TOOL, NUMEROLOGY_SWITCH_ENV, TOOL_DESCRIPTIONS, TOOL_TITLES, UNDER_13_REFUSAL } from './contracts';
import { NUMEROLOGY_POINTER } from './features/explain';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import { PUBLISHED_TOOLS } from './published-tools';

/**
 * ZODIACS_NUMEROLOGY_ENABLED stays off in production. Off (unset, empty, '0' or anything but '1'), or on without the
 * coverage switch, the hosted server must answer initialize, tools/list, resources/list, get_capabilities and the
 * account routes with exactly the bytes of src/ai-tools/accounts/flag-off.fixture.json, as main answers. On, it adds
 * get_numerology last and changes nothing else in tools/list.
 */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const NOW = new Date('2026-11-09T12:00:00Z');
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

async function serve(env: Record<string, string | undefined>, counted: string[] = []) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow,
      horoscopeMonths: async () => committedMonths, horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram } });
  return host;
}
async function serveAt(env: Record<string, string | undefined>, counted: string[] = []) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, dependencies: { now: () => NOW } });
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
const ON = { ...SCENARIOS.coverage, ZODIACS_NUMEROLOGY_ENABLED: '1' };
const call = async (host: string, name: string, args: unknown, meta?: unknown) => message((await post(host, rpc('tools/call', { name, arguments: args, ...(meta ? { _meta: meta } : {}) }))).text).result;

describe('the numerology switch off', () => {
  it('leaves every scenario\'s initialize, tools/list, resources/list, get_capabilities and account routes byte for byte as main answers them', async () => {
    expect(NUMEROLOGY_SWITCH_ENV).toBe('ZODIACS_NUMEROLOGY_ENABLED');
    for (const [name, env] of Object.entries(SCENARIOS)) {
      // On without the coverage switch counts as off, so '1' joins the off values for the first two scenarios.
      const values = name === 'coverage' ? [undefined, '', '0', 'true', ' 1', '1 ', 'yes'] : [undefined, '0', '1'];
      for (const value of values) {
        const host = await serve({ ...env, ZODIACS_NUMEROLOGY_ENABLED: value });
        for (const [request, [body, headers]] of Object.entries(REQUESTS)) {
          const reply = await post(host, body, headers);
          expect(reply.text, `${name} ${request} with ZODIACS_NUMEROLOGY_ENABLED=${JSON.stringify(value)}`).toBe(FIXTURE[name][request].text);
        }
      }
    }
  }, 120_000);

  it('neither lists, runs nor counts get_numerology', async () => {
    const counted: string[] = [];
    const host = await serve({ ...SCENARIOS.coverage, ZODIACS_NUMEROLOGY_ENABLED: '0' }, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string }[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME]);
    // Called anyway, it is an unknown tool, answered exactly as main answers a call to one (the fixture's save call).
    const refused = await post(host, rpc('tools/call', { name: 'get_numerology', arguments: { birthDate: '1990-11-29' } }));
    expect(refused.text).toBe(FIXTURE.coverage.save.text);
    expect(counted).toEqual([]);
  });
});

describe('the numerology switch on', () => {
  it('keeps the thirteen published definitions and every other entry byte for byte, and lists get_numerology last', async () => {
    const host = await serve(ON);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    const before = message(FIXTURE.coverage.toolsList.text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, 'get_numerology']);
    expect(EVERY_SWITCHED_TOOL.at(-1)).toBe('get_numerology');
    expect(PUBLISHED_TOOLS.map((tool) => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(JSON.stringify(tools.slice(0, 13))).toBe(JSON.stringify(PUBLISHED_TOOLS));
    expect(JSON.stringify(tools.slice(0, -1))).toBe(JSON.stringify(before));
    const tool = tools.at(-1)!;
    expect(tool).toMatchObject({ name: 'get_numerology', title: TOOL_TITLES.get_numerology, description: TOOL_DESCRIPTIONS.get_numerology,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true, title: 'Numerology numbers' } });
    expect(tool._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
    expect(Object.keys(tool.inputSchema.properties)).toEqual(['birthDate', 'name', 'year', 'zone']);
    expect(tool.inputSchema.required).toEqual(['birthDate']);
    // Labelled as separate from astrology; work, money and wellbeing allowed as the tradition reads them, with the lines it may not cross.
    expect(tool.description).toContain('Numerology is a separate tradition from astrology');
    expect(tool.description).toContain('including work, money and wellbeing where the tradition speaks to them');
    expect(tool.description).toContain('Give no specific price or investment calls, buy or sell signals, diagnoses or medical timing, predictions of death, or word that someone will win or lose a legal matter.');
    expect(tool.description).not.toMatch(/reflection/u);
    expect(tool.description).toContain('not returned, stored or put in a link');
    expect(`${tool.title} ${tool.description} ${JSON.stringify(tool.inputSchema)}`).not.toMatch(/[–—]|crypto|token|blockchain|market/iu);
    // initialize and resources/list are as main answers them.
    expect((await post(host, REQUESTS.initialize[0])).text).toBe(FIXTURE.coverage.initialize.text);
    expect((await post(host, REQUESTS.resourcesList[0])).text).toBe(FIXTURE.coverage.resourcesList.text);
    // get_capabilities says what it is and that it is not astrology.
    const capabilities = (await call(host, 'get_capabilities', {})).structuredContent.data;
    expect(capabilities.coverage.tools.split(', ').at(-1)).toBe('get_numerology');
    expect(capabilities.limitations.join(' ')).toContain('Numerology is a separate tradition from astrology');
    expect(capabilities.privacy).toContain('The numerology tool takes a birth date and, if given, a name, for that call only');
  });

  it('answers with structured content that validates against its advertised schema, and counts only the tool name', async () => {
    const counted: string[] = [];
    const host = await serveAt(ON, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; outputSchema: object }[];
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(tools.find((tool) => tool.name === 'get_numerology')!.outputSchema);
    const result = await call(host, 'get_numerology', { birthDate: '1990-11-29', name: 'John Smith', zone: 'Pacific/Kiritimati' });
    expect(result.isError).toBe(false);
    expect(validate(result.structuredContent), ajv.errorsText(validate.errors)).toBe(true);
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    expect(result.structuredContent.data).toMatchObject({ lifePath: { number: 5 }, expression: { number: 8 }, soulUrge: { number: 6 }, personality: { number: 11, master: true },
      personalYear: { year: 2026, number: 5, yearFrom: 'zone' } });
    expect(counted).toEqual(['get_numerology']);
    // A refused argument is named, with nothing from the request.
    const refusal = await call(host, 'get_numerology', { birthDate: '1990-11-29', name: 'John Smith', email: 'someone@example.com' });
    expect(refusal.isError).toBe(true);
    expect(JSON.stringify(refusal)).not.toContain('someone@example.com');
    expect(JSON.stringify(refusal)).not.toContain('John');
  });

  it('points explain_astrology\'s numerology answer to get_numerology, and says it is not astrology', async () => {
    const host = await serve(ON);
    const on = (await call(host, 'explain_astrology', { topic: 'numerology' })).structuredContent.data;
    expect(on).toMatchObject({ found: false, message: NUMEROLOGY_POINTER });
    const off = (await call(await serve(SCENARIOS.coverage), 'explain_astrology', { topic: 'numerology' })).structuredContent.data;
    expect(off.message).toContain('it does not cover numerology');
  });
});

describe('get_numerology and privacy', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  beforeEach(() => { for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) spies.push(vi.spyOn(console, method).mockImplementation(() => {})); });
  afterEach(() => { for (const spy of spies.splice(0)) spy.mockRestore(); });

  it('never returns, links or logs the name or the birth date', async () => {
    const counted: string[] = [];
    const host = await serveAt(ON, counted);
    const name = 'Philippa Quennell-Oduya';
    const birthDate = '1979-08-17';
    const raw = (await post(host, rpc('tools/call', { name: 'get_numerology', arguments: { birthDate, name } }))).text;
    expect(message(raw).result.isError).toBe(false);
    for (const fragment of ['Philippa', 'PHILIPPA', 'Quennell', 'QUENNELL', 'Oduya', 'ODUYA', birthDate, '1979', '08-17']) expect(raw).not.toContain(fragment);
    const links = message(raw).result.structuredContent.links as { url: string }[];
    for (const link of links) expect(link.url).toMatch(/^https:\/\/zodiacs\.org\/numerology\/(?:life-path\/\d+\/)?\?ref=assistant$/u);
    expect(counted).toEqual(['get_numerology']);
    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    for (const fragment of ['Philippa', 'Quennell', 'Oduya', birthDate]) expect(logged).not.toContain(fragment);
  });

  it('refuses a birth date less than 13 years ago, with the fixed refusal and nothing worked out', async () => {
    const host = await serveAt(ON);
    for (const birthDate of ['2026-11-02', '2014-01-01', '2013-11-10', '2027-03-01']) {
      const result = await call(host, 'get_numerology', { birthDate, name: 'Small Child' });
      expect(result.isError, birthDate).toBe(true);
      expect(result.structuredContent, birthDate).toMatchObject({ ok: false, tool: 'get_numerology', error: { code: 'invalid-request', message: UNDER_13_REFUSAL } });
      expect(JSON.stringify(result)).not.toContain('Small');
      expect(JSON.stringify(result)).not.toContain(birthDate);
    }
    // Thirteen today is answered.
    expect((await call(host, 'get_numerology', { birthDate: '2013-11-09' })).isError).toBe(false);
  });
});
