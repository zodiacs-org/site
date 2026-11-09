import { afterAll, describe, expect, it, vi } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createAiNodeHandler } from './http';
import { EVERY_AI_TOOL_NAME, EVERY_TOOL_WITH_SKY_EVENTS, GOOD_DAYS_SWITCH_ENV, OUTPUT_SCHEMAS, UNDER_13_REFUSAL } from './contracts';
import { GOOD_DAYS_INSTRUCTION } from './server';
import { GOOD_DAYS_NOTE, NO_MEDICAL_TIMING } from '../lib/good-days/goals';
import { UNDER_18_PARTNERSHIP_SENTENCE } from '../lib/good-days/find';
import committedWindow from '../data/horoscope-window.json';
import committedMonths from '../data/horoscope-months.json';
import committedProgram from '../data/horoscope-program.json';
import type { HoroscopeWindow } from './horoscope/window';
import type { HoroscopeProgram } from '../lib/horoscope-program-types';
import { PUBLISHED_TOOLS } from './published-tools';

/**
 * ZODIACS_GOOD_DAYS_ENABLED stays off in production until the owner switches it on for the next plugin release. Off
 * (unset, empty, '0' or anything but '1'), or on without the occasion and coverage switches, the hosted server must
 * answer initialize, tools/list, resources/list, get_capabilities and the account routes with exactly the bytes main
 * answers with (src/ai-tools/accounts/flag-off.fixture.json). On, it adds find_good_days last in tools/list and
 * nothing else moves; the thirteen published definitions keep their bytes either way.
 */
const FIXTURE = JSON.parse(readFileSync(new URL('./accounts/flag-off.fixture.json', import.meta.url), 'utf8')) as Record<string, Record<string, { text: string }>>;
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve())))); });

async function serve(env: Record<string, string | undefined>, counted: string[] = []) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool, family) => { counted.push(`${tool}|${family}`); }, dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow,
      horoscopeMonths: async () => committedMonths, horoscopeProgram: async () => committedProgram as unknown as HoroscopeProgram,
      now: () => new Date('2026-11-09T09:00:00Z') } });
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
const ON = { ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_GOOD_DAYS_ENABLED: '1' };
const call = async (host: string, name: string, args: unknown, headers: Record<string, string> = {}) => message((await post(host, rpc('tools/call', { name, arguments: args }), headers)).text).result;

describe('the good days switch off', () => {
  it('leaves every scenario byte for byte as main answers it', async () => {
    expect(GOOD_DAYS_SWITCH_ENV).toBe('ZODIACS_GOOD_DAYS_ENABLED');
    for (const [name, env] of Object.entries(SCENARIOS)) {
      // On without the coverage switch counts as off, so '1' joins the off values for the first two scenarios.
      const values = name === 'coverage' ? [undefined, '', '0', 'true', ' 1', 'yes'] : [undefined, '0', '1'];
      for (const value of values) {
        const host = await serve({ ...env, ZODIACS_GOOD_DAYS_ENABLED: value });
        for (const [label, [body, headers]] of Object.entries(REQUESTS)) {
          const reply = await post(host, body, headers);
          expect(reply.text, `${name} ${label} with ZODIACS_GOOD_DAYS_ENABLED=${JSON.stringify(value)}`).toBe(FIXTURE[name][label].text);
        }
      }
    }
  });

  it('refuses a call to find_good_days as a tool it does not offer', async () => {
    const host = await serve(SCENARIOS.coverage);
    const reply = message((await post(host, rpc('tools/call', { name: 'find_good_days', arguments: { goal: 'travel' } }))).text);
    // An unknown tool: a protocol error or an error result, never an answer.
    expect(reply.error ?? (reply.result?.isError ? reply.result : undefined)).toBeDefined();
    expect(JSON.stringify(reply)).not.toContain('"best"');
  });
});

describe('the good days switch on', () => {
  it('adds find_good_days last, after search_sky_events when that is on too, and keeps the thirteen published bytes', async () => {
    const host = await serve(ON);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as Record<string, unknown>[];
    expect(tools.map((tool) => tool.name)).toEqual([...EVERY_AI_TOOL_NAME, 'find_good_days']);
    expect(JSON.stringify(tools.slice(0, PUBLISHED_TOOLS.length))).toBe(JSON.stringify(PUBLISHED_TOOLS));
    const added = tools.at(-1)!;
    expect(added.title).toBe('Find good days');
    expect(added.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: false });
    expect(String(added.description)).not.toMatch(/[–—]/u);
    expect(String(added.description)).toContain('Make no price call, buy or sell signal, or prediction of who wins a legal matter');

    const both = await serve({ ...ON, ZODIACS_SKY_EVENTS_ENABLED: '1' });
    const names = (message((await post(both, rpc('tools/list'))).text).result.tools as { name: string }[]).map((tool) => tool.name);
    expect(names).toEqual([...EVERY_TOOL_WITH_SKY_EVENTS, 'find_good_days']);
  });

  it('says in the server instructions what the finder is for, only while it is offered', async () => {
    const on = message((await post(await serve(ON), REQUESTS.initialize[0])).text).result.instructions as string;
    const off = message((await post(await serve(SCENARIOS.coverage), REQUESTS.initialize[0])).text).result.instructions as string;
    expect(on).toBe(`${off}${GOOD_DAYS_INSTRUCTION}`);
    expect(on).not.toMatch(/[–—]/u);
  });

  it('answers with ranked days, days to avoid, a confidence label and the care line, inside its advertised schema', async () => {
    const counted: string[] = [];
    const host = await serve(ON, counted);
    const result = await call(host, 'find_good_days', { goal: 'contract', from: '2027-01-15', to: '2027-03-31', zone: 'Europe/London', count: 4 }, { 'User-Agent': 'Claude-User/1.0' });
    expect(result.isError).toBe(false);
    const content = result.structuredContent;
    expect(content.ok).toBe(true);
    expect(OUTPUT_SCHEMAS.find_good_days.safeParse(content).success).toBe(true);
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; outputSchema: object }[];
    const validate = ajv.compile(tools.find((tool) => tool.name === 'find_good_days')!.outputSchema);
    expect(validate(content), ajv.errorsText(validate.errors)).toBe(true);
    const data = content.data;
    expect(data.best).toHaveLength(4);
    expect(data.best[0].confidenceLabel).toBe('Reading confidence 55%');
    expect(data.avoid.map((day: { date: string }) => day.date)).toContain('2027-02-09');
    expect(data.periods.some((period: { kind: string }) => period.kind === 'mercury-retrograde')).toBe(true);
    expect(data.care).toContain('good windows to sign contracts');
    expect(data.note).toBe(GOOD_DAYS_NOTE);
    expect(data.pageUrl).toBe('https://zodiacs.org/good-days/?ref=assistant');
    expect(JSON.stringify(content)).not.toMatch(/[–—]/u);
    // The anonymous counter gets the tool name and the assistant family, nothing from the call.
    expect(counted).toEqual(['find_good_days|claude']);
  });

  it('gives no medical timing: a medical goal gets its own sentence, not the list of goals', async () => {
    const host = await serve(ON);
    for (const goal of ['procedure', 'surgery', 'Medical procedure', 'C-section']) {
      const result = await call(host, 'find_good_days', { goal, from: '2027-05-01', to: '2027-06-30' });
      expect(result.isError, goal).toBe(true);
      expect(result.structuredContent.error.message, goal).toBe(NO_MEDICAL_TIMING);
    }
    const tools = message((await post(host, rpc('tools/list'))).text).result.tools as { name: string; description: string; inputSchema: { properties: { goal: { enum: string[] } } } }[];
    const tool = tools.find((entry) => entry.name === 'find_good_days')!;
    expect(tool.inputSchema.properties.goal.enum).toEqual(['launch', 'contract', 'move', 'relationship', 'travel', 'job', 'wedding']);
    expect(tool.description).toContain('It gives no timing for surgery, medical procedures or treatment');
  });
});

describe('privacy', () => {
  const birth = { birthDate: '1988-07-21', birthTime: '06:45', birthZone: 'America/Los_Angeles' };

  it('uses birth details for that one answer: never returned, never in a link, never logged or counted', async () => {
    const counted: string[] = [];
    const host = await serve(ON, counted);
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) => vi.spyOn(console, level).mockImplementation(() => {}));
    const reply = await post(host, rpc('tools/call', { name: 'find_good_days', arguments: { goal: 'move', from: '2027-04-01', to: '2027-06-30', zone: 'Europe/Paris', ...birth } }));
    const logged = spies.flatMap((spy) => spy.mock.calls.map((args) => JSON.stringify(args)));
    spies.forEach((spy) => spy.mockRestore());
    const result = message(reply.text).result;
    expect(result.isError).toBe(false);
    expect(result.structuredContent.data.personal).toEqual({ sun: 'cancer', timeKnown: true });
    for (const value of ['1988', '07-21', '06:45', 'Los_Angeles']) {
      expect(reply.text, value).not.toContain(value);
      for (const line of logged) expect(line, value).not.toContain(value);
    }
    for (const link of result.structuredContent.links as { url: string }[]) expect(link.url).toMatch(/^https:\/\/zodiacs\.org\/[a-z-]+\/\?ref=assistant$/u);
    expect(counted).toEqual(['find_good_days|other']);
  });

  it('refuses a birth date under 13 with the fixed sentence, before anything is worked out', async () => {
    const host = await serve(ON);
    for (const birthDate of ['2016-03-01', '2013-11-10', '2027-01-01']) {
      const result = await call(host, 'find_good_days', { goal: 'travel', from: '2027-01-01', to: '2027-01-31', birthDate });
      expect(result.isError).toBe(true);
      expect(result.structuredContent.error.message).toBe(UNDER_13_REFUSAL);
    }
    // Thirteen today: the finder reads it.
    expect((await call(host, 'find_good_days', { goal: 'travel', from: '2027-01-01', to: '2027-01-31', birthDate: '2013-11-09' })).isError).toBe(false);
  });

  it('gives no relationship or wedding timing from a birth date under 18', async () => {
    const host = await serve(ON);
    for (const goal of ['relationship', 'wedding']) {
      const result = await call(host, 'find_good_days', { goal, from: '2027-01-01', to: '2027-01-31', birthDate: '2010-05-05' });
      expect(result.isError).toBe(true);
      expect(result.structuredContent.error.message).toBe(UNDER_18_PARTNERSHIP_SENTENCE);
    }
  });

  it('takes no names or places, and names the field it refuses without repeating a value', async () => {
    const host = await serve(ON);
    const named = await call(host, 'find_good_days', { goal: 'wedding', names: 'Ana and Ben' });
    expect(named.isError).toBe(true);
    expect(JSON.stringify(named)).not.toContain('Ana and Ben');
    const time = await call(host, 'find_good_days', { goal: 'job', birthDate: '1990-01-01', birthTime: '07:00' });
    expect(time.isError).toBe(true);
    expect(time.structuredContent.error.message).toBe('A birth time needs its birthplace time zone (birthZone).');
    const goal = await call(host, 'find_good_days', { goal: 'lottery' });
    expect(goal.structuredContent.error.message).toBe('goal must be one of: launch, contract, move, relationship, travel, job, wedding.');
    const long = await call(host, 'find_good_days', { goal: 'travel', from: '2027-01-01', to: '2028-06-01' });
    expect(long.structuredContent.error.message).toBe('The window is at most 366 days, about twelve months. Search a longer span in parts.');
  });
});
