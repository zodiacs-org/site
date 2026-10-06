/**
 * The hosted endpoint's HTTP side: who it answers, when it is off, how it
 * counts against the compute API's limits, what it reads, and that a real
 * MCP client can use it. No request reaches the network: the Firewall check
 * is injected, and the client test runs on a loopback port.
 */
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, type RateLimitVerdict } from '../lib/compute-api/constants';
import { createHostedMcpHandler, originAllowed, sanitizeProtocolMessage } from './hosted-http';
import { HOSTED_TOOL_NAMES } from './hosted-server';

const ON = Object.freeze({ ZODIACS_MCP_ENABLED: '1' });
const PROTOCOL = '/api/compatibility?__zodiacs_mcp=1';
const HEALTH = '/api/compatibility?__zodiacs_mcp=health';

interface Reply { status: number; headers: Record<string, string>; text: string }

function fakeResponse(): { res: any; done: Promise<Reply> } {
  const headers: Record<string, string> = {};
  let resolve!: (reply: Reply) => void;
  const done = new Promise<Reply>((r) => { resolve = r; });
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(name: string, value: string) { headers[name.toLowerCase()] = String(value); },
    end(chunk?: string) { this.headersSent = true; resolve({ status: this.statusCode, headers, text: chunk ?? '' }); },
  };
  return { res, done };
}

async function call(options: {
  method?: string; url?: string; headers?: Record<string, string | undefined>; body?: unknown;
  env?: Record<string, string>; rateLimit?: (req: any, id: string) => Promise<RateLimitVerdict>;
}): Promise<Reply> {
  const handler = createHostedMcpHandler({
    env: options.env ?? ON,
    rateLimit: options.rateLimit ?? (async () => 'allowed'),
    now: () => new Date('2026-10-06T12:00:00Z'),
  });
  const headers: Record<string, string | undefined> = {
    host: 'zodiacs.org', 'content-type': 'application/json', accept: 'application/json, text/event-stream',
    ...options.headers,
  };
  for (const key of Object.keys(headers)) if (headers[key] === undefined) delete headers[key];
  const req = {
    method: options.method ?? 'POST', url: options.url ?? PROTOCOL, headers,
    body: options.body === undefined ? undefined : typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
  };
  const { res, done } = fakeResponse();
  await handler(req, res);
  return done;
}

/** The JSON-RPC message in a reply, whether it came as JSON or as one server-sent event. */
function message(reply: Reply): any {
  const data = reply.text.split('\n').find((line) => line.startsWith('data: '));
  return JSON.parse(data ? data.slice(6) : reply.text);
}

/** id null makes a notification, which carries no id. */
const rpc = (method: string, params: unknown = {}, id: number | null = 1) => ({ jsonrpc: '2.0', ...(id === null ? {} : { id }), method, params });
const INIT = rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } });

let output: Array<ReturnType<typeof vi.spyOn>> = [];
beforeEach(() => {
  output = (['log', 'info', 'warn', 'error', 'debug'] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
});
afterEach(() => {
  // Nothing from a request or its result is written anywhere, a log line included.
  for (const spy of output) expect(spy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
});

describe('who the endpoint answers', () => {
  it('answers only zodiacs.org, www.zodiacs.org and one exact preview hostname', async () => {
    expect((await call({ body: INIT, headers: { host: 'evil.example' } })).status).toBe(403);
    expect((await call({ body: INIT, headers: { host: undefined } })).status).toBe(403);
    expect((await call({ body: INIT, headers: { host: 'WWW.Zodiacs.org' } })).status).toBe(200);
    const preview = 'zodiacs-org-git-x-zodiacsofficial.vercel.app';
    expect((await call({ body: INIT, headers: { host: preview } })).status).toBe(403);
    expect((await call({ body: INIT, headers: { host: preview }, env: { ...ON, ZODIACS_MCP_STAGING_HOST: preview } })).status).toBe(200);
    // A preview deployment also answers on its own hostname, as the platform names it; production never does.
    const deployment = 'zodiacs-org-abc123-zodiacsofficial.vercel.app';
    expect((await call({ body: INIT, headers: { host: deployment }, env: { ...ON, VERCEL_ENV: 'preview', VERCEL_URL: deployment } })).status).toBe(200);
    expect((await call({ body: INIT, headers: { host: deployment }, env: { ...ON, VERCEL_ENV: 'production', VERCEL_URL: deployment } })).status).toBe(403);
    expect((await call({ body: INIT, headers: { host: 'other.vercel.app' }, env: { ...ON, VERCEL_ENV: 'preview', VERCEL_URL: deployment } })).status).toBe(403);
    for (const invalid of ['*.vercel.app', 'UPPER.example', 'nodot', 'a..b']) {
      expect((await call({ body: INIT, headers: { host: invalid }, env: { ...ON, ZODIACS_MCP_STAGING_HOST: invalid } })).status, invalid).toBe(403);
    }
  });

  it('serves the assistants\' and the site\'s origins, and a call with no Origin, and no other origin', async () => {
    for (const origin of ['https://claude.ai', 'https://claude.ai/', 'https://chatgpt.com', 'https://chat.openai.com', 'https://zodiacs.org']) {
      const reply = await call({ body: INIT, headers: { origin } });
      expect(reply.status, origin).toBe(200);
      expect(reply.headers['access-control-allow-origin'], origin).toBe(new URL(origin).origin);
    }
    for (const origin of ['https://evil.example', 'null', 'http://claude.ai', 'https://claude.ai.evil.example']) {
      expect((await call({ body: INIT, headers: { origin } })).status, origin).toBe(403);
    }
    expect(originAllowed(undefined)).toBe(true);
  });

  it('answers a preflight', async () => {
    const reply = await call({ method: 'OPTIONS', headers: { origin: 'https://claude.ai' } });
    expect(reply.status).toBe(204);
    expect(reply.headers['access-control-allow-methods']).toBe('POST, OPTIONS');
  });

  it('takes POST on the protocol route and GET on the health route, and nothing else', async () => {
    expect((await call({ method: 'GET' })).status).toBe(405);
    expect((await call({ method: 'DELETE' })).status).toBe(405);
    expect((await call({ method: 'POST', url: HEALTH, body: INIT })).status).toBe(405);
    expect((await call({ url: `${PROTOCOL}&extra=1`, body: INIT })).status).toBe(400);
    expect((await call({ url: '/api/compatibility?__zodiacs_mcp=2', body: INIT })).status).toBe(400);
  });
});

describe('the switch and the limits', () => {
  it('is off unless ZODIACS_MCP_ENABLED is 1, and then counts nothing', async () => {
    let counted = 0;
    const rateLimit = async () => { counted += 1; return 'allowed' as const; };
    const switchedOff: Array<Record<string, string>> = [{}, { ZODIACS_MCP_ENABLED: '0' }, { ZODIACS_MCP_ENABLED: 'true' }];
    for (const env of switchedOff) {
      for (const [url, method] of [[PROTOCOL, 'POST'], [HEALTH, 'GET']] as const) {
        const reply = await call({ env, url, method, body: method === 'POST' ? INIT : undefined, rateLimit });
        expect(reply.status).toBe(503);
        expect(reply.headers['retry-after']).toBe('3600');
      }
    }
    expect(counted).toBe(0);
  });

  it('answers the health check without counting it or calculating', async () => {
    let counted = 0;
    const reply = await call({ method: 'GET', url: HEALTH, rateLimit: async () => { counted += 1; return 'allowed'; } });
    expect(reply.status).toBe(200);
    expect(JSON.parse(reply.text)).toEqual({ service: 'zodiacs-mcp', version: '0.1.0', transport: 'streamable-http', ready: true });
    expect(counted).toBe(0);
  });

  it('counts every protocol POST under the general rule, and refuses when it says no or cannot say', async () => {
    const ids: string[] = [];
    await call({ body: INIT, rateLimit: async (_req, id) => { ids.push(id); return 'allowed'; } });
    expect(ids).toEqual([COMPUTE_RATE_LIMIT_ID]);
    const limited = await call({ body: INIT, rateLimit: async () => 'limited' });
    expect([limited.status, limited.headers['retry-after']]).toEqual([429, '60']);
    const unavailable = await call({ body: INIT, rateLimit: async () => 'unavailable' });
    expect([unavailable.status, unavailable.headers['retry-after']]).toEqual([503, '300']);
    const thrown = await call({ body: INIT, rateLimit: async () => { throw new Error('firewall down'); } });
    expect(thrown.status).toBe(503);
  });

  it('counts find_events under the events rule too, as POST /api/v1/events counts', async () => {
    const ids: string[] = [];
    const rateLimit = async (_req: any, id: string): Promise<RateLimitVerdict> => { ids.push(id); return id === COMPUTE_EVENTS_RATE_LIMIT_ID ? 'limited' : 'allowed'; };
    const reply = await call({ body: rpc('tools/call', { name: 'find_events', arguments: { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' } }), rateLimit });
    expect(ids).toEqual([COMPUTE_RATE_LIMIT_ID, COMPUTE_EVENTS_RATE_LIMIT_ID]);
    const result = message(reply).result;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/over their limit/u);
    ids.length = 0;
    await call({ body: rpc('tools/call', { name: 'get_positions', arguments: { instants: ['2000-01-01T12:00:00Z'] } }), rateLimit });
    expect(ids).toEqual([COMPUTE_RATE_LIMIT_ID]);
  });
});

describe('what it reads', () => {
  it('reads one JSON-RPC message of strict JSON, up to 16 KiB', async () => {
    expect((await call({ body: INIT, headers: { 'content-type': 'text/plain' } })).status).toBe(415);
    expect((await call({ body: INIT, headers: { 'content-encoding': 'gzip' } })).status).toBe(415);
    expect((await call({ body: '{not json' })).status).toBe(400);
    expect((await call({ body: [INIT] })).status).toBe(400);
    expect((await call({ body: INIT, headers: { 'content-length': '20000' } })).status).toBe(413);
    expect((await call({ body: JSON.stringify({ ...INIT, padding: 'x'.repeat(17_000) }) })).status).toBe(413);
  });

  it('answers a method it does not serve with -32601, and acknowledges a notification it has no use for', async () => {
    const unknown = await call({ body: rpc('resources/list') });
    expect(message(unknown)).toEqual({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'This MCP operation is not supported.' } });
    const note = await call({ body: rpc('notifications/cancelled', { requestId: 1 }, null) });
    expect(note.status).toBe(202);
  });

  it('never repeats a value or a property name from a request it refuses', async () => {
    const reply = await call({ body: rpc('tools/call', { name: 'get_positions', arguments: { instants: ['2000-01-01T12:00:00Z'], secret1990: 'abc-1990-06-15' } }) });
    expect(reply.text).not.toContain('secret1990');
    expect(reply.text).not.toContain('1990-06-15');
    expect(sanitizeProtocolMessage({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'bad secret1990', data: { secret1990: 1 } } }))
      .toEqual({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'The MCP request does not match a supported operation or schema.' } });
  });

  it('marks every reply no-store and noindex', async () => {
    const reply = await call({ body: INIT });
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(reply.headers['x-robots-tag']).toBe('noindex');
  });
});

describe('what it writes', () => {
  it('writes no log line for any request it serves or refuses', async () => {
    await call({ body: INIT });
    await call({ body: rpc('tools/call', { name: 'get_positions', arguments: { instants: ['1990-06-15T14:30:00+02:00'] } }) });
    await call({ body: rpc('tools/call', { name: 'get_positions', arguments: { instants: ['1990-06-15T14:30:00'] } }) });
    await call({ body: '{not json' });
    await call({ body: INIT, headers: { host: 'evil.example' } });
    await call({ body: INIT, rateLimit: async () => { throw new Error('1990-06-15'); } });
    for (const spy of output) expect(spy).not.toHaveBeenCalled();
  });
});

describe('a real MCP client over HTTP', () => {
  it('connects, lists the five tools and calls each one', async () => {
    const handler = createHostedMcpHandler({ env: ON, rateLimit: async () => 'allowed' });
    const server = createHttpServer((req: IncomingMessage, res: ServerResponse) => {
      // The loopback address stands in for zodiacs.org, which is all the host check reads.
      req.headers.host = 'zodiacs.org';
      void handler(req, res);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const client = new Client({ name: 'zodiacs-hosted-http-test', version: '1.0.0' });
    try {
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}${PROTOCOL}`)));
      const { tools } = await client.listTools();
      expect(tools.map((tool) => tool.name).sort()).toEqual([...HOSTED_TOOL_NAMES].sort());
      for (const [name, args] of [
        ['get_capabilities', {}],
        ['get_sky', {}],
        ['get_positions', { instants: ['2000-01-01T12:00:00Z'] }],
        ['find_events', { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z' }],
        ['check_sky_fact', { kind: 'phase', phase: 'full', date: '2026-10-26' }],
      ] as const) {
        const result = await client.callTool({ name, arguments: args });
        expect(result.isError, name).toBeFalsy();
        expect(result.structuredContent, name).toBeTruthy();
      }
    } finally {
      await client.close().catch(() => {});
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
