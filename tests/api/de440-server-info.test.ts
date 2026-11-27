/**
 * /mcp/de440 names itself apart from /mcp in initialize, and offers the same thirteen published tools.
 *
 * /mcp runs the directory's frozen server (api/_ai/published/runtime.mjs), whose serverInfo stays
 * { name: 'zodiacs', version: '0.6.9' }. /mcp/de440 runs the current runtime (api/_ai/runtime.mjs) on JPL DE440,
 * which keeps the name, so a client that keys on it sees one connector, and says which route it is in its title
 * and in the version's build metadata, which semver leaves out when it orders versions. Both reach the same
 * thirteen tools with the same names, titles, input schemas and annotations; only the DE440 route's calculation
 * schema and its sign change sentence differ, as they did before (src/ai-tools/de440-contract.ts).
 *
 * Every request arrives as production delivers it: with the __zodiacs_ai value its rewrite in vercel.json gives,
 * at api/_ai/handler.ts's router, the one api/compatibility.ts runs, which picks the connector.
 */
import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_AI_TOOL_NAMES, AI_VERSION } from '../../src/ai-tools/contracts';
import { de440OutputSchema } from '../../src/ai-tools/de440-contract';
import { PUBLISHED_TOOLS } from '../../src/ai-tools/published-tools';

const AI_DESTINATION = /^\/api\/compatibility\?__zodiacs_ai=([a-z0-9-]+)$/;
/** Each MCP address in vercel.json, with the __zodiacs_ai value its rewrite gives. */
const rewrites = new Map<string, string>();
let server: Server;
let base: string;
let de440Routes: readonly string[];

beforeAll(async () => {
  const vercel = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8')) as { rewrites: { source: string; destination: string }[] };
  for (const rewrite of vercel.rewrites) {
    const value = AI_DESTINATION.exec(rewrite.destination)?.[1];
    if (value && rewrite.source.startsWith('/mcp')) rewrites.set(rewrite.source, value);
  }
  const handler = await import('../../api/_ai/handler');
  de440Routes = handler.DE440_ROUTES;
  const allowedHosts: string[] = [];
  const allowed = async () => 'allowed' as const;
  // As production runs both routes: all three switches on.
  const options = { env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' }, allowedHosts, rateLimit: allowed, atomicQuota: allowed, countUsage: async () => {} };
  const [published, de440] = await Promise.all([handler.publishedConnector(options), handler.de440Connector(options)]);
  const route = handler.aiRouter({ published, de440 });
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const value = rewrites.get(url.pathname);
    if (value === undefined) { res.statusCode = 404; res.end(); return; }
    // As after Vercel's rewrite: the destination's query first, then the request's own.
    const query = new URLSearchParams(`__zodiacs_ai=${value}`);
    for (const [key, entry] of url.searchParams) query.append(key, entry);
    const rewritten = req as IncomingMessage & { query?: Record<string, string> };
    rewritten.url = `/api/compatibility?${query}`;
    rewritten.query = Object.fromEntries(query);
    route(rewritten, res).catch(() => { if (!res.headersSent) res.statusCode = 500; res.end(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  allowedHosts.push(host);
  base = `http://${host}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function rpc(path: string, method: string, params: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  expect(response.status).toBe(200);
  const text = await response.text();
  const message = JSON.parse(response.headers.get('content-type')?.includes('text/event-stream')
    ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text);
  expect(message.error).toBeUndefined();
  return message.result;
}

const initialize = (path: string) => rpc(path, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'de440-server-info', version: '1' } });

const PUBLISHED_HEALTH = { service: 'zodiacs-mcp', version: '0.6.9', transport: 'stateless-streamable-http', ready: true };
const DE440_HEALTH = { service: 'zodiacs-mcp-de440', version: '0.6.9', engine: '3.0.0', transport: 'stateless-streamable-http', ready: true };

describe('the MCP addresses in vercel.json', () => {
  it('give each its route value, and only the DE440 ones reach the DE440 connector', () => {
    expect(Object.fromEntries(rewrites)).toStrictEqual({
      '/mcp': '1', '/mcp/': '1',
      '/mcp/de440': 'de440', '/mcp/de440/': 'de440',
      '/mcp/de440/health': 'de440-health', '/mcp/de440/health/': 'de440-health',
      '/mcp/health': 'health', '/mcp/health/': 'health',
    });
    expect(de440Routes).toStrictEqual(['de440', 'de440-health']);
  });
});

describe('serverInfo on the two routes', () => {
  it('keeps /mcp as published', async () => {
    expect(AI_VERSION).toBe('0.6.9');
    expect((await initialize('/mcp')).serverInfo).toStrictEqual({ name: 'zodiacs', version: '0.6.9' });
  });

  it('names DE440 and engine 3.0.0 on /mcp/de440', async () => {
    expect((await initialize('/mcp/de440')).serverInfo).toStrictEqual({
      name: 'zodiacs',
      title: 'Zodiacs (JPL DE440, engine 3.0.0)',
      version: '0.6.9+de440.3.0.0',
    });
  });
});

describe('the status check on each route', () => {
  it('answers GET /mcp/health from the published connector, as before', async () => {
    for (const path of ['/mcp/health', '/mcp/health/']) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, path).toBe(200);
      expect(await response.json(), path).toStrictEqual(PUBLISHED_HEALTH);
    }
  });

  it('answers GET /mcp/de440/health from the DE440 connector, with its own service name and engine', async () => {
    for (const path of ['/mcp/de440/health', '/mcp/de440/health/']) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, path).toBe(200);
      expect(await response.json(), path).toStrictEqual(DE440_HEALTH);
    }
  });

  it('keeps GET off both protocol addresses', async () => {
    for (const path of ['/mcp', '/mcp/de440']) {
      const response = await fetch(`${base}${path}`);
      expect(response.status, path).toBe(405);
      expect(response.headers.get('allow'), path).toBe('POST, OPTIONS');
    }
  });

  it('rejects POST on /mcp/de440/health so it cannot act as an MCP endpoint', async () => {
    for (const path of ['/mcp/de440/health', '/mcp/de440/health/']) {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } }),
      });
      expect(response.status, path).toBe(405);
      expect(response.headers.get('allow'), path).toBe('GET, OPTIONS');
    }
  });
});

describe('the thirteen published tools on both routes', () => {
  it('lists the same thirteen first, with the published names, titles, input schemas and annotations', async () => {
    const published = PUBLISHED_TOOLS as Record<string, unknown>[];
    expect(published.map(tool => tool.name)).toEqual([...ALL_AI_TOOL_NAMES]);
    for (const path of ['/mcp', '/mcp/de440']) {
      const tools = ((await rpc(path, 'tools/list', {})).tools as Record<string, unknown>[]).slice(0, published.length);
      expect(tools.map(tool => tool.name), path).toEqual([...ALL_AI_TOOL_NAMES]);
      for (const [index, tool] of tools.entries()) {
        for (const field of ['name', 'title', 'inputSchema', 'annotations', 'icons']) {
          expect(JSON.stringify(tool[field]), `${path} ${tool.name} ${field}`).toBe(JSON.stringify(published[index][field]));
        }
        // The DE440 route advertises the compute API's backend in each calculation, as before.
        if (path === '/mcp/de440') expect(tool.outputSchema, tool.name as string).toEqual(de440OutputSchema(published[index].outputSchema));
      }
    }
  });
});
