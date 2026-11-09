import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { EVERY_AI_TOOL_NAME, EVERY_TOOL_WITH_SKY_EVENTS, PERSONAL_SWITCH_ENV, PERSONAL_TOOL_NAMES, UNDER_13_REFUSAL } from './contracts';
import { COUNTED_TOOL_NAMES } from './usage';
import { PERSONAL_TOOLS } from './personal/registry';
import { forbiddenClaim, type PersonalToolDefinition } from './personal/shared';
import { executeAiTool, offeredTools } from './tools';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import { loadPlaceTable } from './features/place-table';

/**
 * ZODIACS_PERSONAL_TOOLS_ENABLED stays off in production. Off (unset, empty, '0' or anything but '1'), or on without
 * the coverage and occasion switches, the hosted server answers initialize, tools/list, resources/list,
 * get_capabilities and the account routes with exactly the bytes main answers with (accounts/flag-off.fixture.json).
 * On, it lists the personal tools last, refuses a child's birth date before anything is worked out, never counts a
 * personal tool, and no answer puts a birth detail or place in a link.
 */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const TOOLS: readonly PersonalToolDefinition[] = PERSONAL_TOOLS;
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });
const NOW = new Date('2026-11-09T09:00:00Z');

async function serve(env: Record<string, string | undefined>, counted: string[] = []) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, dependencies: { now: () => NOW, placeTable: async () => loadPlaceTable(), horoscopeWindow: async () => committedWindow as HoroscopeWindow,
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
const REQUESTS: Record<string, [unknown, Record<string, string>?]> = {
  initialize: [rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flag-off', version: '1' } })],
  toolsList: [rpc('tools/list')],
  resourcesList: [rpc('resources/list')],
  capabilities: [rpc('tools/call', { name: 'get_capabilities', arguments: {} })],
  save: [rpc('tools/call', { name: 'save_to_zodiacs', arguments: { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12' } } })],
  bearer: [rpc('tools/list'), { Authorization: 'Bearer not-a-token' }],
};
const SCENARIOS = { released: {}, occasions: { ZODIACS_OCCASIONS_ENABLED: '1' }, coverage: { ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' } } as const;
const ON = { ...SCENARIOS.coverage, ZODIACS_PERSONAL_TOOLS_ENABLED: '1' };
const call = async (host: string, name: string, args: unknown) => message((await post(host, rpc('tools/call', { name, arguments: args }))).text).result;

/** Every URL in a value, wherever it sits. */
function urlsIn(value: unknown): string[] {
  if (typeof value === 'string') return value.match(/https?:\/\/[^\s"')]+/gu) ?? [];
  if (Array.isArray(value)) return value.flatMap(urlsIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(urlsIn);
  return [];
}

describe('the copy rule', () => {
  it('lets traditional money, wellbeing and legal readings through and catches the forbidden kinds of claim', () => {
    for (const allowed of ['Jupiter in your 2nd house is traditionally a strong year for earnings.', 'Saturn here asks you to take rest seriously.', 'A good window to sign contracts.', 'Career and public standing get room to grow.'])
      expect(forbiddenClaim(allowed), allowed).toBeNull();
    for (const forbidden of ['Buy shares on Tuesday.', 'Bitcoin prices will rise this week.', 'The stock will climb.', 'This transit diagnoses a heart condition.', 'Plan surgery before 12 March.', 'You will die young.', 'You will win the court case.', 'A long dash \u2014 here.', 'Good for your crypto.'])
      expect(forbiddenClaim(forbidden), forbidden).not.toBeNull();
  });
});

describe('the personal tools switch off', () => {
  it('leaves every scenario byte for byte as main answers it', async () => {
    expect(PERSONAL_SWITCH_ENV).toBe('ZODIACS_PERSONAL_TOOLS_ENABLED');
    for (const [name, env] of Object.entries(SCENARIOS)) {
      // On without the coverage and occasion switches counts as off.
      const values = name === 'coverage' ? [undefined, '', '0', 'true', ' 1', 'yes'] : [undefined, '0', '1'];
      for (const value of values) {
        const host = await serve({ ...env, ZODIACS_PERSONAL_TOOLS_ENABLED: value });
        for (const [request, [body, headers]] of Object.entries(REQUESTS)) {
          const reply = await post(host, body, headers);
          expect(reply.text, `${name} ${request} with ZODIACS_PERSONAL_TOOLS_ENABLED=${JSON.stringify(value)}`).toBe(FIXTURE[name][request].text);
        }
      }
    }
  }, 180_000);

  it('neither lists, runs nor counts a personal tool', async () => {
    const counted: string[] = [];
    const host = await serve({ ...SCENARIOS.coverage, ZODIACS_PERSONAL_TOOLS_ENABLED: '0' }, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string }[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME]);
    for (const tool of TOOLS) {
      expect((await post(host, rpc('tools/call', { name: tool.name, arguments: tool.example }))).text).toBe(FIXTURE.coverage.save.text);
      expect((await executeAiTool(tool.name as never, tool.example, { occasions: true, coverage: true, now: () => NOW })).ok).toBe(false);
    }
    expect(counted).toEqual([]);
  });
});

describe('the personal tools switch on', () => {
  it('lists every other tool as before, then the personal tools last, read-only and anonymous', async () => {
    const host = await serve(ON);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, ...PERSONAL_TOOL_NAMES]);
    expect(JSON.stringify(tools.slice(0, EVERY_AI_TOOL_NAME.length))).toBe(JSON.stringify(message(FIXTURE.coverage.toolsList.text).result.tools));
    expect(offeredTools({ occasions: true, coverage: true, skyEvents: true, personal: true })).toEqual([...offeredTools({ occasions: true, coverage: true, skyEvents: true }), ...PERSONAL_TOOL_NAMES]);
    expect(offeredTools({ occasions: true, coverage: true, skyEvents: true })).toEqual(EVERY_TOOL_WITH_SKY_EVENTS.filter((name) => !name.startsWith("get_horoscope")));
    for (const tool of TOOLS) {
      const listed = tools.find((entry) => entry.name === tool.name)!;
      expect(listed).toMatchObject({ title: tool.title, description: tool.description, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: !tool.clockDependent } });
      expect(listed._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
      expect(`${tool.title} ${tool.description} ${tool.summary} ${JSON.stringify(listed.inputSchema)}`).not.toMatch(/[–—]|crypto|token|blockchain|market|invest|stock/iu);
    }
  });

  it('counts no personal tool: usage counting names none of them', async () => {
    for (const name of PERSONAL_TOOL_NAMES) expect(COUNTED_TOOL_NAMES as readonly string[]).not.toContain(name);
    const counted: string[] = [];
    const host = await serve(ON, counted);
    for (const tool of TOOLS) await call(host, tool.name, tool.example);
    expect(counted).toEqual([]);
  }, 120_000);

  it('answers each example with a result that validates against its advertised schema, with no dashes and no birth detail in a link', async () => {
    const host = await serve(ON);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; outputSchema: object }[];
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    for (const tool of TOOLS) {
      const result = await call(host, tool.name, tool.example);
      expect(result.isError, `${tool.name}: ${result.content[0].text}`).toBe(false);
      const validate = ajv.compile(tools.find((entry) => entry.name === tool.name)!.outputSchema);
      expect(validate(result.structuredContent), JSON.stringify(validate.errors)).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
      expect(result.content[0].text).not.toMatch(/[–—]/u);
      // Money, career, wellbeing and legal themes are read as tradition reads them; price calls, buy or sell signals,
      // diagnoses or medical timing, death predictions and won or lost cases never appear.
      expect(forbiddenClaim(result.content[0].text), tool.name).toBeNull();
      const birthDetails = Object.entries(tool.example).filter(([key]) => ['birthDate', 'time', 'latitude', 'longitude', 'zone', 'cities'].includes(key)).flatMap(([, value]) => (Array.isArray(value) ? value : [value])).map(String);
      for (const url of urlsIn(result.structuredContent)) {
        for (const detail of birthDetails) expect(decodeURIComponent(url), `${tool.name} link ${url}`).not.toContain(detail);
        expect(url).not.toMatch(/[?&#](?:d|date|birth|t|time|lat|lon|tz|place|city)=/u);
      }
    }
  }, 120_000);

  it('refuses a birth date under 13, or still to come, with the fixed sentence and nothing worked out', async () => {
    const host = await serve(ON);
    for (const tool of TOOLS) {
      for (const birthDate of ['2016-01-01', '2026-11-09', '2027-03-01']) {
        const result = await call(host, tool.name, { ...tool.example, birthDate });
        expect(result.isError, tool.name).toBe(true);
        expect(result.structuredContent.error.message).toBe(UNDER_13_REFUSAL);
        expect(result.structuredContent).not.toHaveProperty('data');
        // Called directly, without the server's own check first, the tool refuses it too.
        const direct = await executeAiTool(tool.name as never, { ...tool.example, birthDate }, { occasions: true, coverage: true, personal: true, now: () => NOW, placeTable: async () => loadPlaceTable() });
        expect(direct).toMatchObject({ ok: false, error: { message: UNDER_13_REFUSAL } });
      }
      // Thirteen today is old enough.
      expect((await call(host, tool.name, { ...tool.example, birthDate: '2013-11-09' })).isError, tool.name).toBe(false);
    }
  }, 120_000);

  it('never repeats a refused value back', async () => {
    const host = await serve(ON);
    for (const tool of TOOLS) {
      const result = await call(host, tool.name, { ...tool.example, birthDate: '1990-02-31', zone: 'Mars/Olympus_Mons', secretField: 'Ada Lovelace' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).not.toMatch(/Olympus|Ada Lovelace|1990-02-31/u);
    }
  });
});
