import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { ALL_AI_TOOL_NAMES, EVERY_AI_TOOL_NAME, EVERY_SWITCHED_TOOL, TAROT_SWITCH_ENV, TOOL_DESCRIPTIONS, TOOL_TITLES } from './contracts';
import { TAROT_POINTER } from './features/explain';
import { TAROT_NOTE } from './features/tarot';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import { PUBLISHED_TOOLS } from './published-tools';

/**
 * ZODIACS_TAROT_ENABLED stays off in production. Off (unset, empty, '0' or anything but '1'), or on without the
 * coverage switch, the hosted server must answer initialize, tools/list, resources/list, get_capabilities and the
 * account routes with exactly the bytes of src/ai-tools/accounts/flag-off.fixture.json, as main answers. On, it adds
 * draw_tarot last and changes nothing else in tools/list.
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
const ON = { ...SCENARIOS.coverage, ZODIACS_TAROT_ENABLED: '1' };
const call = async (host: string, name: string, args: unknown, meta?: unknown) => message((await post(host, rpc('tools/call', { name, arguments: args, ...(meta ? { _meta: meta } : {}) }))).text).result;


describe('the tarot switch off', () => {
  it('leaves every scenario\'s initialize, tools/list, resources/list, get_capabilities and account routes byte for byte as main answers them', async () => {
    expect(TAROT_SWITCH_ENV).toBe('ZODIACS_TAROT_ENABLED');
    for (const [name, env] of Object.entries(SCENARIOS)) {
      // On without the coverage switch counts as off, so '1' joins the off values for the first two scenarios.
      const values = name === 'coverage' ? [undefined, '', '0', 'true', ' 1', '1 ', 'yes'] : [undefined, '0', '1'];
      for (const value of values) {
        const host = await serve({ ...env, ZODIACS_TAROT_ENABLED: value });
        for (const [request, [body, headers]] of Object.entries(REQUESTS)) {
          const reply = await post(host, body, headers);
          expect(reply.text, `${name} ${request} with ZODIACS_TAROT_ENABLED=${JSON.stringify(value)}`).toBe(FIXTURE[name][request].text);
        }
      }
    }
  }, 120_000);

  it('neither lists, runs nor counts draw_tarot', async () => {
    const counted: string[] = [];
    const host = await serve({ ...SCENARIOS.coverage, ZODIACS_TAROT_ENABLED: '0' }, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string }[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME]);
    const refused = await post(host, rpc('tools/call', { name: 'draw_tarot', arguments: {} }));
    expect(refused.text).toBe(FIXTURE.coverage.save.text);
    expect(counted).toEqual([]);
  });
});

describe('the tarot switch on', () => {
  it('keeps the thirteen published definitions and every other entry byte for byte, and lists draw_tarot last', async () => {
    const host = await serve(ON);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, any>[];
    const before = message(FIXTURE.coverage.toolsList.text).result.tools as Record<string, any>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, 'draw_tarot']);
    expect(EVERY_SWITCHED_TOOL.at(-1)).toBe('draw_tarot');
    expect(PUBLISHED_TOOLS.map((tool) => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(JSON.stringify(tools.slice(0, 13))).toBe(JSON.stringify(PUBLISHED_TOOLS));
    expect(JSON.stringify(tools.slice(0, -1))).toBe(JSON.stringify(before));
    const tool = tools.at(-1)!;
    // A new draw each call, so not idempotent; read-only and anonymous like the others.
    expect(tool).toMatchObject({ name: 'draw_tarot', title: TOOL_TITLES.draw_tarot, description: TOOL_DESCRIPTIONS.draw_tarot,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false, title: 'Tarot draw' } });
    expect(tool._meta).toEqual({ securitySchemes: [{ type: 'noauth' }] });
    // Only the spread and the reversals switch: no question, name, birth detail or seed can be sent.
    expect(Object.keys(tool.inputSchema.properties)).toEqual(['spread', 'reversals']);
    expect(tool.inputSchema.additionalProperties).toBe(false);
    expect(tool.inputSchema.properties.spread.enum).toEqual(['one-card', 'three-card', 'celtic-cross']);
    expect(tool.description).toContain('Tarot is a separate practice from astrology');
    // Work, money, wellbeing and agreements as tarot reads them; the lines it may not cross; no mandatory reflection line.
    expect(tool.description).toContain('including work, money, wellbeing and agreements where the card speaks to them');
    expect(tool.description).toContain('Give no specific price or investment calls, buy or sell signals, diagnoses or medical timing, predictions of death, or word that someone will win or lose a legal matter.');
    expect(tool.description).not.toMatch(/reflection/u);
    expect(tool.description).toContain("never send the person's question, name or birth details");
    expect(`${tool.title} ${tool.description} ${JSON.stringify(tool.inputSchema)}`).not.toMatch(/[–—]|crypto|token|blockchain|market/iu);
    expect((await post(host, REQUESTS.initialize[0])).text).toBe(FIXTURE.coverage.initialize.text);
    expect((await post(host, REQUESTS.resourcesList[0])).text).toBe(FIXTURE.coverage.resourcesList.text);
    const capabilities = (await call(host, 'get_capabilities', {})).structuredContent.data;
    expect(capabilities.coverage.tools.split(', ').at(-1)).toBe('draw_tarot');
    expect(capabilities.limitations.join(' ')).toContain('Tarot is a separate practice from astrology');
    expect(capabilities.privacy).toContain('The tarot draw takes no personal details and no question.');
  });

  it('draws each spread at full size, validated against its advertised schema, and counts only the tool name', async () => {
    const counted: string[] = [];
    const host = await serveAt(ON, counted);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; outputSchema: object }[];
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(tools.find((tool) => tool.name === 'draw_tarot')!.outputSchema);
    for (const [args, size] of [[{}, 1], [{ spread: 'one-card' }, 1], [{ spread: 'three-card' }, 3], [{ spread: 'celtic-cross', reversals: false }, 10]] as const) {
      const result = await call(host, 'draw_tarot', args);
      expect(result.isError, JSON.stringify(args)).toBe(false);
      expect(validate(result.structuredContent), ajv.errorsText(validate.errors)).toBe(true);
      expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
      const data = result.structuredContent.data;
      expect(data.cards).toHaveLength(size);
      expect(new Set(data.cards.map((card: { card: { id: string } }) => card.card.id)).size).toBe(size);
      expect(data.separateFromAstrology).toContain('separate practice from astrology');
      expect(data.note).toBe(TAROT_NOTE);
      if ('reversals' in args) for (const card of data.cards) expect(card.orientation).toBe('upright');
    }
    expect(data3(await call(host, 'draw_tarot', { spread: 'three-card' })).map((card) => card.position.name)).toEqual(['Past', 'Present', 'Future']);
    expect(counted).toEqual(['draw_tarot', 'draw_tarot', 'draw_tarot', 'draw_tarot', 'draw_tarot']);
  });

  it('refuses a question, a seed or personal details, naming no value it was sent', async () => {
    const host = await serveAt(ON);
    for (const extra of [{ question: 'Will I get the flat on Elm Street?' }, { seed: 42 }, { name: 'Philippa Quennell' }, { birthDate: '1990-05-03' }]) {
      const result = await call(host, 'draw_tarot', { spread: 'one-card', ...extra });
      expect(result.isError, JSON.stringify(extra)).toBe(true);
      const text = JSON.stringify(result);
      for (const value of Object.values(extra)) expect(text).not.toContain(String(value));
    }
  });

  it('draws afresh from the secure random number generator on every call', async () => {
    const host = await serveAt(ON);
    const secure = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const weak = vi.spyOn(Math, 'random');
    const draws = new Set<string>();
    for (let i = 0; i < 5; i++) draws.add(JSON.stringify(data3(await call(host, 'draw_tarot', { spread: 'celtic-cross' })).map((card) => [card.card.id, card.orientation])));
    expect(secure).toHaveBeenCalled();
    expect(weak).not.toHaveBeenCalled();
    // Five ten-card draws all different: a repeat has odds of about 1 in 10^19 each.
    expect(draws.size).toBe(5);
    secure.mockRestore(); weak.mockRestore();
  });

  it('points explain_astrology\'s tarot answer to draw_tarot, and says it is not astrology', async () => {
    const host = await serve(ON);
    const on = (await call(host, 'explain_astrology', { topic: 'tarot' })).structuredContent.data;
    expect(on).toMatchObject({ found: false, message: TAROT_POINTER });
    const off = (await call(await serve(SCENARIOS.coverage), 'explain_astrology', { topic: 'tarot' })).structuredContent.data;
    expect(off.message).toContain('it does not cover tarot');
  });
});

describe('draw_tarot and privacy', () => {
  const spies: ReturnType<typeof vi.spyOn>[] = [];
  afterEach(() => { for (const spy of spies.splice(0)) spy.mockRestore(); });

  it('logs nothing and links only to the tarot page', async () => {
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) spies.push(vi.spyOn(console, method).mockImplementation(() => {}));
    const host = await serveAt(ON);
    const result = await call(host, 'draw_tarot', { spread: 'three-card' });
    expect(result.structuredContent.links.map((link: { url: string }) => link.url)).toEqual(['https://zodiacs.org/tarot/?ref=assistant']);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

const data3 = (result: { structuredContent: { data: { cards: { card: { id: string }; orientation: string; position: { name: string } }[] } } }) => result.structuredContent.data.cards;
