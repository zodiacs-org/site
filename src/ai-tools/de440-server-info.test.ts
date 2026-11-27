/**
 * /mcp/de440 names itself apart from /mcp in initialize, and offers the same thirteen published tools.
 *
 * /mcp runs the directory's frozen server (api/_ai/published/runtime.mjs), whose serverInfo stays
 * { name: 'zodiacs', version: '0.6.9' }. /mcp/de440 runs the current runtime (api/_ai/runtime.mjs) on JPL DE440,
 * which keeps the name, so a client that keys on it sees one connector, and says which route it is in its title
 * and in the version's build metadata, which semver leaves out when it orders versions. Both reach the same
 * thirteen tools with the same names, titles, input schemas and annotations; only the DE440 route's calculation
 * schema and its sign change sentence differ, as they did before (src/ai-tools/de440-contract.ts).
 */
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ALL_AI_TOOL_NAMES, AI_VERSION } from './contracts';
import { de440OutputSchema } from './de440-contract';
import { PUBLISHED_TOOLS } from './published-tools';

let server: Server;
let base: string;

beforeAll(async () => {
  const routes = await import('../../api/_ai/handler');
  const allowedHosts: string[] = [];
  const allowed = async () => 'allowed' as const;
  // As production runs both routes: all three switches on.
  const options = { env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' }, allowedHosts, rateLimit: allowed, atomicQuota: allowed, countUsage: async () => {} };
  const [published, de440] = await Promise.all([routes.publishedConnector(options), routes.de440Connector(options)]);
  server = createServer((req, res) => { void (req.url?.startsWith('/mcp/de440') ? de440 : published)(req, res); });
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

  it('answers the status request on each route with its own service name', async () => {
    const health = async (path: string) => (await fetch(`${base}${path}?__zodiacs_ai=health`)).json();
    expect(await health('/mcp')).toStrictEqual({ service: 'zodiacs-mcp', version: '0.6.9', transport: 'stateless-streamable-http', ready: true });
    expect(await health('/mcp/de440')).toStrictEqual({ service: 'zodiacs-mcp-de440', version: '0.6.9', engine: '3.0.0', transport: 'stateless-streamable-http', ready: true });
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
