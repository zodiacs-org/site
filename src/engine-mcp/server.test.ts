/**
 * /mcp/engine: exactly the seven tools the Astrologer bot calls, each checked
 * through the SDK's own client against its output schema, and the HTTP gates.
 * Every birth here is synthetic (the engine repository's
 * bots/astrologer/testset/charts.inputs.json).
 */
import { createServer, request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { ENGINE_TOOL_NAMES, MAX_ENGINE_HTTP_BYTES } from './contracts';
import { createEngineServer } from './server';
import { createEngineNodeHandler } from './http';
import { localToday } from './tools';
import { createAiServer } from '../ai-tools/server';
import { ALL_AI_TOOL_NAMES } from '../ai-tools/contracts';

const NOW = () => new Date('2026-11-01T12:00:00Z');
let client: Client;

beforeAll(async () => {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createEngineServer({ now: NOW }).connect(serverSide);
  client = new Client({ name: 'engine-mcp-test', version: '0' });
  await client.connect(clientSide);
});
afterAll(async () => { await client.close(); });

const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args }) as Promise<any>;

describe('tools', () => {
  it('lists exactly the bot\'s seven tools', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([...ENGINE_TOOL_NAMES].sort());
  });

  it('leaves the consumer /mcp tool list as it is', async () => {
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    // As production serves it: ZODIACS_OCCASIONS_ENABLED=1, 13 tools.
    await createAiServer({ occasions: true, horoscopeWindow: async () => { throw new Error('not read by tools/list'); } }).connect(serverSide);
    const consumer = new Client({ name: 'consumer-test', version: '0' });
    await consumer.connect(clientSide);
    const names = (await consumer.listTools()).tools.map((tool) => tool.name);
    await consumer.close();
    expect(names).toEqual([...ALL_AI_TOOL_NAMES]);
    expect(names).toHaveLength(13);
    for (const name of ENGINE_TOOL_NAMES.filter((tool) => tool !== 'get_capabilities')) expect(names).not.toContain(name);
  });

  it('finds a birthplace with its zone', async () => {
    const result = await call('search_places', { query: 'Istanbul', limit: 1 });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.places[0]).toMatchObject({ name: 'Istanbul', timeZone: 'Europe/Istanbul' });
    expect(result.structuredContent.links.page).toBe('https://zodiacs.org/birth-chart/');
  });

  it('resolves a skipped and a repeated local time and says which', async () => {
    const gap = await call('resolve_civil_time', { date: '2026-03-08', time: '02:30', timeZone: 'America/New_York' });
    expect(gap.structuredContent.data.status).toBe('gap');
    const fold = await call('resolve_civil_time', { date: '2026-11-01', time: '01:30', timeZone: 'America/New_York' });
    expect(fold.structuredContent.data.status).toBe('fold');
    expect(fold.structuredContent.data.resolution.utc).toBe('2026-11-01T05:30:00.000Z');
    expect(fold.structuredContent.record.engine.name).toBe('@zodiacs/engine');
  });

  it('builds the reading facts sheet with IDs, and both charts for a fold', async () => {
    const result = await call('reading_facts', { date: '1990-06-15', time: '00:00', timeKnown: true, zone: 'Asia/Tokyo', lat: 35.6895, lon: 139.6917, windowStart: '2026-11-01' });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.status).toBe('resolved');
    expect(result.structuredContent.window).toMatchObject({ from: '2026-11-01', days: 90, zone: 'Asia/Tokyo' });
    expect(result.structuredContent.sheet).toMatch(/\[P1\]/);
    expect(result.structuredContent.sheet).toMatch(/\[R1\]/);
    expect(result.structuredContent.facts).toBeUndefined();
    expect(result.structuredContent.record.engine.version).toMatch(/^1\./);
    const fold = await call('reading_facts', { date: '2026-11-01', time: '01:30', timeKnown: true, zone: 'America/New_York', lat: 40.7128, lon: -74.006, format: 'facts', days: 30 });
    expect(fold.structuredContent.status).toBe('fold');
    expect(fold.structuredContent.facts.versions).toHaveLength(2);
    expect(fold.structuredContent.window.from).toBe('2026-11-01');
  }, 60_000);

  it('gives no houses or angles without a birth time', async () => {
    const result = await call('reading_facts', { date: '1995-03-10', timeKnown: false, zone: 'Europe/London', lat: 51.5074, lon: -0.1278, windowStart: '2026-11-01', days: 7, format: 'facts' });
    expect(result.structuredContent.status).toBe('time-unknown');
    const [version] = result.structuredContent.facts.versions;
    expect(version.ascendant).toBeNull();
    expect(version.chartRuler).toBeNull();
    expect(version.moonSigns.length).toBeGreaterThan(0);
  }, 60_000);

  it('calculates a natal chart, transits and a crossing search with receipts', async () => {
    const birth = { utc: '1990-06-14T15:00:00Z', latitude: 35.6895, longitude: 139.6917 };
    const natal = await call('natal_chart', { birth });
    expect(natal.structuredContent.schemaVersion).toBe('zodiacs-astro/1');
    expect(natal.structuredContent.data.chart.houses.system).toBe('whole');
    expect(natal.structuredContent.receipts[0].role).toBe('natal');
    const transits = await call('transits_at', { birth, at: '2026-11-15T00:00:00Z' });
    expect(transits.structuredContent.receipts.map((r: { role: string }) => r.role)).toEqual(['natal', 'transit-sky']);
    const search = await call('event_search', { body: 'Sun', longitude: 263.2938, from: '2026-11-01T00:00:00Z', to: '2027-01-30T00:00:00Z' });
    expect(search.structuredContent.data.search.status).toBe('complete');
    expect(search.structuredContent.data.search.crossings).toHaveLength(1);
  });

  it('reports versions and the settings the bot states', async () => {
    const result = await call('get_capabilities', {});
    expect(result.structuredContent.tools).toEqual([...ENGINE_TOOL_NAMES]);
    expect(result.structuredContent.settings.zodiac).toBe('tropical');
    expect(result.structuredContent.versions.node).toBe(process.versions.node);
  });

  it('refuses invalid input without repeating it', async () => {
    const result = await call('reading_facts', { date: '1990-02-30x', time: '25:00', timeKnown: true, zone: 'Not a zone!', lat: 99, lon: 0 });
    expect(result.isError).toBe(true);
    const text = JSON.stringify(result.content);
    for (const secret of ['1990-02-30x', '25:00', 'Not a zone!']) expect(text).not.toContain(secret);
  });

  it('starts the window today in the birth zone when no start is given', () => {
    expect(localToday('Pacific/Auckland', new Date('2026-11-01T12:00:00Z'))).toBe('2026-11-02');
    expect(localToday('America/Los_Angeles', new Date('2026-11-01T05:00:00Z'))).toBe('2026-10-31');
  });
});

describe('http', () => {
  let base = '';
  let enabled: string | undefined = '1';
  let verdict: 'allowed' | 'limited' | 'unavailable' = 'allowed';
  const counted: string[] = [];
  let host = '';
  const server = createServer((req, res) => {
    void createEngineNodeHandler({
      env: { get ZODIACS_ENGINE_MCP_ENABLED() { return enabled; } },
      rateLimit: async (_req, id) => { counted.push(id); return verdict; },
      allowedHosts: [host],
      now: NOW,
    })(req, res);
  });
  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    host = `127.0.0.1:${(server.address() as AddressInfo).port}`;
    base = `http://${host}/mcp/engine`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  const rpc = (method: string, params: Record<string, unknown> = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
  const post = (body: unknown, extra: Record<string, string> = {}) => fetch(base, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
  async function message(response: Response) {
    const text = await response.text();
    const data = text.split('\n').find((line) => line.startsWith('data: '));
    return JSON.parse(data ? data.slice(6) : text);
  }

  it('serves the seven tools over stateless HTTP', async () => {
    const reply = await message(await post(rpc('tools/list'), { 'MCP-Protocol-Version': '2025-06-18' }));
    expect(reply.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([...ENGINE_TOOL_NAMES].sort());
  });

  it('counts the ephemeris searches against the event rule too', async () => {
    counted.length = 0;
    await message(await post(rpc('tools/call', { name: 'get_capabilities', arguments: {} }), { 'MCP-Protocol-Version': '2025-06-18' }));
    expect(counted).toEqual(['zodiacs-compute-api']);
    counted.length = 0;
    await message(await post(rpc('tools/call', { name: 'event_search', arguments: { body: 'Sun', longitude: 10, from: '2026-11-01T00:00:00Z', to: '2026-11-02T00:00:00Z' } }), { 'MCP-Protocol-Version': '2025-06-18' }));
    expect(counted).toEqual(['zodiacs-compute-api', 'zodiacs-compute-events']);
  });

  it('defaults off and fails closed when the limiter cannot count', async () => {
    try {
      enabled = undefined; expect((await post(rpc('tools/list'))).status).toBe(503);
      enabled = '1'; verdict = 'unavailable'; expect((await post(rpc('tools/list'))).status).toBe(503);
      verdict = 'limited'; const response = await post(rpc('tools/list')); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60');
    } finally { enabled = '1'; verdict = 'allowed'; }
  });

  it('refuses other hosts, origins, media types, queries and oversized bodies', async () => {
    expect((await post(rpc('tools/list'), { Origin: 'https://attacker.example' })).status).toBe(403);
    expect((await post(rpc('tools/list'), { Origin: 'https://grok.com' })).status).toBe(200);
    expect((await post(rpc('tools/list'), { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await fetch(`${base}?birth=private-canary`, { method: 'POST', headers, body: '{}' })).status).toBe(400);
    expect((await post({ text: 'a'.repeat(MAX_ENGINE_HTTP_BYTES) })).status).toBe(413);
    const hostStatus = await new Promise<number>((resolve) => {
      const req = request(base, { method: 'POST', headers: { ...headers, Host: 'attacker.example' } }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
      req.end(JSON.stringify(rpc('tools/list')));
    });
    expect(hostStatus).toBe(403);
  });

  it('answers health on GET and refuses other methods', async () => {
    const health = await fetch(`${base}?__zodiacs_engine=health`);
    expect(health.status).toBe(200);
    expect((await health.json()).service).toBe('zodiacs-engine');
    expect((await fetch(base)).status).toBe(405);
    expect((await message(await post(rpc('resources/list')))).error.code).toBe(-32601);
  });
});
