import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { Client, LATEST_PROTOCOL_VERSION, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createAiNodeHandler } from './http';
import { AI_TOOL_NAMES, HOROSCOPE_URI, MAX_HTTP_BYTES, OUTPUT_SCHEMAS, TOOL_TITLES, WIDGET_URI, STUDIO_URI, LEGACY_STUDIO_URI } from './contracts';
import committedWindow from '../data/horoscope-window.json';
import type { HoroscopeWindow } from './horoscope/window';
import { COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID } from '../lib/compute-api/constants';

let server: Server, base: string;
let enabled: string | undefined = '1'; let verdict: 'allowed' | 'limited' | 'unavailable' = 'allowed';
let allowedHost: string; const counted: string[] = [];
let atomicRequest: 'allowed' | 'limited' | 'unavailable' = 'allowed';
let atomicEvent: 'allowed' | 'limited' | 'unavailable' = 'allowed';
const atomicCounted: string[] = [];
const env = { get ZODIACS_MCP_ENABLED() { return enabled; } };
beforeAll(async () => {
  server = createServer((req, res) => { void createAiNodeHandler({ env, allowedHosts: [allowedHost], atomicQuota: async kind => { atomicCounted.push(kind); return kind === 'request' ? atomicRequest : atomicEvent; }, rateLimit: async (_req, id) => { counted.push(id); return verdict; }, dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow } })(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}/mcp`;
  allowedHost = new URL(base).host;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
const rpc = (method: string, params: unknown = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const post = (body: unknown, extra: Record<string, string> = {}) => fetch(base, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) });
async function readMessage(response: Response) {
  const text = await response.text();
  return JSON.parse(response.headers.get('content-type')?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
}

describe('stateless MCP HTTP boundary', () => {
  it('refuses exhausted or unavailable global budgets even when the Firewall allows', async () => {
    try {
      for (const [budget, status, retry] of [['limited', 429, '60'], ['unavailable', 503, '300']] as const) {
        atomicRequest = budget; atomicCounted.length = 0;
        const response = await post(rpc('tools/list'));
        expect(response.status).toBe(status);
        expect(response.headers.get('retry-after')).toBe(retry);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(atomicCounted).toEqual(['request']);
      }
    } finally { atomicRequest = 'allowed'; }
  });
  it('reserves a global event slot for a date fact and refuses before returning computation', async () => {
    try {
      atomicEvent = 'limited'; atomicCounted.length = 0;
      const message = await readMessage(await post(rpc('tools/call', { name: 'check_sky_fact', arguments: { kind: 'phase', phase: 'new', date: '2026-10-10', zone: 'UTC' } }), { 'MCP-Protocol-Version': '2025-06-18' }));
      expect(message.result.isError).toBe(true);
      expect(message.result.structuredContent.ok).toBe(false);
      expect(message.result.structuredContent.error.retryAfterSeconds).toBe(60);
      expect(message.result.structuredContent).not.toHaveProperty('data');
      expect(atomicCounted).toEqual(['request', 'event']);
    } finally { atomicEvent = 'allowed'; }
  });
  it('works with the official SDK client: list, call, widget read and close', async () => {
    const client = new Client({ name: 'zodiacs-ai-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(base)));
    try {
      const tools = await client.listTools(); expect(tools.tools.map(tool => tool.name)).toEqual(AI_TOOL_NAMES);
      for (const tool of tools.tools) {
        expect(tool.title).toBe(TOOL_TITLES[tool.name as keyof typeof TOOL_TITLES]);
        expect(tool.annotations?.title).toBe(tool.title);
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.annotations?.destructiveHint).toBe(false);
        expect(tool.annotations?.openWorldHint).toBe(false);
        expect(tool.outputSchema).toBeDefined();
      }
      expect(tools.tools.find(tool => tool.name === 'check_sky_fact')?.description).toContain('https://zodiacs.org/developers/compute/');
      const calendar = tools.tools.find(tool => tool.name === 'get_upcoming_events')!;
      expect(calendar._meta?.['openai/ui']).toEqual({ entrypoints: [{ type: 'global' }, { type: 'thread' }] });
      expect(calendar.annotations?.idempotentHint).toBe(false);
      const opened = await client.callTool({ name: 'get_upcoming_events', arguments: {} });
      expect(opened.isError).toBe(false);
      expect(OUTPUT_SCHEMAS.get_upcoming_events.parse(opened.structuredContent).ok).toBe(true);
      const studio = tools.tools.find(tool => tool.name === 'open_chart_studio')!;
      expect(studio._meta?.['openai/ui']).toEqual({ entrypoints: [{ type: 'global' }, { type: 'thread' }] });
      const launch = await client.callTool({ name: 'open_chart_studio', arguments: {} });
      expect(launch.isError).toBe(false); expect(OUTPUT_SCHEMAS.open_chart_studio.parse(launch.structuredContent).ok).toBe(true);
      const horoscopes = tools.tools.find(tool => tool.name === 'get_horoscope')!;
      expect(horoscopes.title).toBe('Horoscopes');
      expect(horoscopes._meta?.['openai/widgetAccessible']).toBe(true);
      expect(horoscopes._meta?.['openai/outputTemplate']).toBe(HOROSCOPE_URI);
      const reading = await client.callTool({ name: 'get_horoscope', arguments: { sign: 'leo', zone: 'Asia/Bangkok' } });
      expect(reading.isError).toBe(false);
      const parsed = OUTPUT_SCHEMAS.get_horoscope.parse(reading.structuredContent);
      expect(parsed.ok && parsed.data.status).toBe('available');
      expect((reading._meta?.['zodiacs/horoscope'] as { sign?: string } | undefined)?.sign).toBe('leo');
      const horoscopePanel = await client.readResource({ uri: HOROSCOPE_URI });
      expect((horoscopePanel.contents[0] as { text: string }).text.startsWith('<!doctype html>')).toBe(true);
      const refused = await client.callTool({ name: 'open_chart_studio', arguments: { birth: 'private-canary' } });
      expect(refused.isError).toBe(true); expect(JSON.stringify(refused)).not.toContain('private-canary');
      const panel = await client.readResource({ uri: STUDIO_URI });
      expect(panel.contents[0]._meta?.ui).toMatchObject({ csp: { connectDomains: [], resourceDomains: [] } });
      expect(panel.contents[0]._meta?.['openai/ui']).toMatchObject({ preferredDisplayMode: 'fullscreen' });
      expect(panel.contents[0]).toHaveProperty('text', expect.stringContaining('Chart Studio'));
      expect(studio._meta?.['openai/outputTemplate']).toBe(STUDIO_URI);
      const previousPanel = await client.readResource({ uri: LEGACY_STUDIO_URI });
      expect(previousPanel.contents[0].uri).toBe(LEGACY_STUDIO_URI);
      expect(previousPanel.contents[0]).toEqual({ ...panel.contents[0], uri: LEGACY_STUDIO_URI });
      const result = await client.callTool({ name: 'get_sky', arguments: { instant: '2026-10-01T06:00:00Z', zone: 'Asia/Bangkok' } });
      expect(result.isError).toBe(false); expect(OUTPUT_SCHEMAS.get_sky.parse(result.structuredContent).ok).toBe(true);
      const widget = await client.readResource({ uri: WIDGET_URI });
      expect(widget.contents[0].mimeType).toBe('text/html;profile=mcp-app');
      expect(widget.contents[0]._meta?.['openai/ui']).toEqual({ availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'inline' });
    } finally { await client.close(); }
  });
  it.each(['2025-03-26', '2025-06-18', LATEST_PROTOCOL_VERSION])('accepts a supported %s raw protocol handshake', async protocolVersion => {
    const response = await post(rpc('initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '1' } }));
    expect(response.status).toBe(200);
    const result = await readMessage(response); expect(result.error).toBeUndefined(); expect(result.result.serverInfo.name).toBe('zodiacs');
  });
  it('keeps application outputs and errors uncacheable and suppresses input diagnostics', async () => {
    const response = await post(rpc('tools/call', { name: 'get_sky', arguments: { 'private-canary-1985': 'secret' } }), { 'MCP-Protocol-Version': '2025-06-18' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('private-canary');
    const next = await post(rpc('tools/call', { name: 'get_capabilities', arguments: {} }), { 'MCP-Protocol-Version': '2025-06-18' });
    expect((await readMessage(next)).result.isError).toBe(false);
  });
  it('rejects malformed JSON, batches, oversized bodies, arbitrary query data and origins', async () => {
    expect((await fetch(base, { method: 'POST', headers, body: '{' })).status).toBe(400);
    expect((await post([rpc('tools/list')])).status).toBe(400);
    expect((await post({ text: 'a'.repeat(MAX_HTTP_BYTES) })).status).toBe(413);
    expect((await fetch(`${base}?birth=private-canary`, { method: 'POST', headers, body: '{}' })).status).toBe(400);
    expect((await post(rpc('tools/list'), { Origin: 'https://attacker.example' })).status).toBe(403);
    const hostStatus = await new Promise<number>(resolve => {
      const req = request(base, { method: 'POST', headers: { ...headers, Host: 'attacker.example' } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
      req.end(JSON.stringify(rpc('tools/list')));
    });
    expect(hostStatus).toBe(403);
    expect((await post(rpc('tools/list'), { 'Content-Type': 'text/plain' })).status).toBe(415);
  });
  it('defaults off and fails closed if the production limiter cannot count', async () => {
    try {
      enabled = undefined; expect((await post(rpc('tools/list'))).status).toBe(503);
      enabled = '1'; verdict = 'unavailable'; expect((await post(rpc('tools/list'))).status).toBe(503);
      verdict = 'limited'; const response = await post(rpc('tools/list')); expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('60');
    } finally { enabled = '1'; verdict = 'allowed'; }
  });
  it('allows only the exact configured staging hostname and rejects invalid host configuration', async () => {
    async function status(host: string, stagingHost: string) {
      let code = 0;
      const res = { setHeader() {}, end() {}, set statusCode(value: number) { code = value; } };
      await createAiNodeHandler({ env: { ZODIACS_MCP_STAGING_HOST: stagingHost } })({ headers: { host }, method: 'GET', url: '/mcp?__zodiacs_ai=health' }, res);
      return code;
    }
    expect(await status('review.example', 'review.example')).toBe(503);
    expect(await status('other.review.example', 'review.example')).toBe(403);
    for (const setting of ['*.example', 'https://review.example', 'review.example/path', 'review.example:443']) expect(await status('review.example', setting)).toBe(403);
  });
  it('refuses oversized chunked input without losing the response connection', async () => {
    const status = await new Promise<number>(resolve => {
      const req = request(base, { method: 'POST', headers }, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
      req.write('{"value":"'); req.write('a'.repeat(MAX_HTTP_BYTES)); req.end('"}');
    });
    expect(status).toBe(413);
  });
  it('counts event searches and date facts against both existing incoming quotas', async () => {
    for (const [name, args] of [
      ['get_upcoming_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', kinds: ['lunation'] }],
      ['check_sky_fact', { kind: 'phase', phase: 'new', date: '2026-10-10', zone: 'UTC' }],
    ] as const) {
      counted.length = 0;
      await readMessage(await post(rpc('tools/call', { name, arguments: args }), { 'MCP-Protocol-Version': '2025-06-18' }));
      expect(counted).toEqual([COMPUTE_RATE_LIMIT_ID, COMPUTE_EVENTS_RATE_LIMIT_ID]);
    }
  });
  it('serves guarded health and refuses unsupported streaming subscriptions', async () => {
    expect((await fetch(`${base}?__zodiacs_ai=health`)).status).toBe(200);
    expect((await fetch(base)).status).toBe(405);
    const response = await post(rpc('subscriptions/listen'));
    expect((await response.json()).error.code).toBe(-32601);
  });
  it('accepts Claude origins and uses the time zone an assistant shares with the call', async () => {
    for (const origin of ['https://claude.ai', 'https://claude.com']) expect((await post(rpc('tools/list'), { Origin: origin })).status).toBe(200);
    const response = await post(rpc('tools/call', { name: 'get_horoscope', arguments: { sign: 'leo' }, _meta: { 'openai/userLocation': { city: 'Bangkok', country: 'TH', timezone: 'Asia/Bangkok' } } }));
    const result = (await readMessage(response)).result;
    expect(result.structuredContent.data.zoneSource).toBe('assistant');
    expect(result.structuredContent.data.zone).toBe('Asia/Bangkok');
    expect(JSON.stringify(result.structuredContent)).not.toContain('TH');
  });
  it('serves the newer per-request protocol envelope without a session', async () => {
    const response = await post(rpc('tools/list', { _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'synthetic-modern-client', version: '1' },
      'io.modelcontextprotocol/clientCapabilities': {},
    } }), { 'MCP-Protocol-Version': '2026-07-28', 'MCP-Method': 'tools/list' });
    expect(response.status).toBe(200);
    expect((await readMessage(response)).result.tools.map((tool: { name: string }) => tool.name)).toEqual(AI_TOOL_NAMES);
  });
});
