import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import skyManifest from '../../plugins/zodiacs-sky/plugin.json';
import directoryManifest from '../../plugins/zodiacs-sky/.claude-plugin/plugin.json';
import { createAiNodeHandler } from './http';

let server: Server;
let endpoint: string;

beforeAll(async () => {
  const allowedHosts: string[] = [];
  const handle = createAiNodeHandler({
    env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1' },
    allowedHosts,
    rateLimit: async () => 'allowed',
    atomicQuota: async () => 'allowed',
  });
  server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  allowedHosts.push(host);
  endpoint = `http://${host}/mcp`;
});

afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });

async function rpc(method: string, params: unknown) {
  const response = await fetch(endpoint, {
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

describe('published release version', () => {
  it('keeps the portable and directory manifests on release 0.5.1', () => {
    expect(skyManifest.version).toBe('0.5.1');
    expect(directoryManifest.version).toBe(skyManifest.version);
  });

  it('reports the listing release in the public status response', async () => {
    const response = await fetch(`${endpoint}?__zodiacs_ai=health`);
    expect(response.status).toBe(200);
    expect((await response.json()).version).toBe(skyManifest.version);
  });

  it('reports the listing release during the MCP handshake', async () => {
    const result = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'release-version-test', version: '1' } });
    expect(result.serverInfo.version).toBe(skyManifest.version);
  });

  it('reports the listing release in get_capabilities', async () => {
    const result = await rpc('tools/call', { name: 'get_capabilities', arguments: {} });
    expect(result.isError).toBe(false);
    expect(result.structuredContent.data.version).toBe(skyManifest.version);
  });
});
