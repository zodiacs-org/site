import { createServer } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { expect, it } from 'vitest';
import transition from '../../docs/platform/evidence/site-engine-1-1-0/connector-transition.json';
import publishedReplies from '../../src/ai-tools/accounts/flag-off.fixture.json';

it('keeps the published connector reply while a separate route advertises and returns DE440', async () => {
  const routes = await import('../../api/_ai/handler');
  expect(routes.publishedConnector).toBeTypeOf('function');
  expect(routes.de440Connector).toBeTypeOf('function');
  const server = createServer((req, res) => {
    void (req.url === '/mcp/de440' ? corrected : published)(req, res);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const allowed = async () => 'allowed' as const;
  const options = { env: { ZODIACS_MCP_ENABLED: '1' }, allowedHosts: [new URL(base).host], rateLimit: allowed, atomicQuota: allowed, countUsage: async () => {} };
  let published: Awaited<ReturnType<typeof routes.publishedConnector>>;
  let corrected: Awaited<ReturnType<typeof routes.de440Connector>>;
  const clients: Client[] = [];
  try {
    [published, corrected] = await Promise.all([routes.publishedConnector(options), routes.de440Connector(options)]);
    const originalRequests = [
      ['initialize', 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flag-off', version: '1' } }],
      ['toolsList', 'tools/list', {}], ['resourcesList', 'resources/list', {}],
      ['capabilities', 'tools/call', { name: 'get_capabilities', arguments: {} }],
    ] as const;
    for (const [fixture, method, params] of originalRequests) {
      const response = await fetch(`${base}/mcp`, { method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18',
      }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      expect(response.status).toBe(publishedReplies.released[fixture].status);
      expect(await response.text()).toBe(publishedReplies.released[fixture].text);
    }
    for (const [path, expected] of Object.entries(transition.routes)) {
      const client = new Client({ name: 'transition-test', version: '1' });
      clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(path, base)));
      expect(client.getServerVersion()?.version).toBe(expected.serverVersion);
      const list = await client.listTools();
      expect(list.tools.find(tool => tool.name === 'get_upcoming_events')?.description).toContain(expected.description);
      const call = { name: 'get_upcoming_events', arguments: { from: '2026-01-26', to: '2026-01-27', bodies: ['Neptune'], kinds: ['ingress'] } };
      const answer = await client.callTool(call);
      expect(answer.isError).toBe(false);
      expect(answer.structuredContent).toMatchObject({ ok: true, data: {
        events: [{ at: expected.neptuneUtc, body: 'Neptune', sign: 'aries' }],
        calculation: { backend: { ephemeris: { name: expected.ephemeris } } },
      } });
      expect(answer.content[0]).toMatchObject({ type: 'text', text: JSON.stringify(answer.structuredContent) });
    }
  } finally {
    await Promise.all(clients.map(client => client.close()));
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 20_000);
