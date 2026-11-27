import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { expect, it } from 'vitest';
import transition from '../../docs/platform/evidence/site-engine-1-1-0/connector-transition.json';
import publishedReplies from '../../src/ai-tools/accounts/flag-off.fixture.json';
import { textWithoutContinuousUtc } from '../../src/ai-tools/published-tools';
import { LOCAL_DAY_MESSAGES } from '../../src/lib/compute-api/validate';

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
      // The frozen /mcp server predates the continuous UTC time schema (Dias, 2026-11-23), which /mcp/de440 carries.
      expect(await response.text()).toBe(textWithoutContinuousUtc(publishedReplies.released[fixture].text));
    }
    for (const [path, expected] of Object.entries(transition.routes)) {
      const client = new Client({ name: 'transition-test', version: '1' });
      clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(path, base)));
      // /mcp/de440 names its route and engine in the version's build metadata (src/ai-tools/de440-contract.ts).
      expect(client.getServerVersion()?.version).toBe(path === '/mcp/de440' ? `${expected.serverVersion}+de440.${ENGINE_VERSION}` : expected.serverVersion);
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

      for (const [date, zone] of [
        ['1989-10-29', 'America/St_Johns'],
        ['1989-10-28', 'America/St_Johns'],
        ['1867-10-18', 'America/Juneau'],
      ] as const) {
        const refused = await client.callTool({
          name: 'check_sky_fact',
          arguments: { kind: 'ingress', body: 'Moon', sign: 'scorpio', date, zone },
        });
        expect(refused.isError, `${path} ${date} ${zone}`).toBe(true);
        expect(refused.structuredContent, `${path} ${date} ${zone}`).toMatchObject({
          ok: false,
          error: { code: 'invalid-request', message: `date: ${LOCAL_DAY_MESSAGES.splitDay}` },
        });
      }
      for (const [date, zone] of [
        ['1892-07-04', 'Pacific/Apia'],
        ['2019-02-16', 'America/Sao_Paulo'],
        ['2019-02-17', 'America/Sao_Paulo'],
        ['2019-04-06', 'America/Santiago'],
        ['2019-04-07', 'America/Santiago'],
        ['2022-09-21', 'Asia/Tehran'],
        ['2022-09-22', 'Asia/Tehran'],
        ['2026-11-01', 'America/New_York'],
      ] as const) {
        const accepted = await client.callTool({
          name: 'check_sky_fact',
          arguments: { kind: 'sign', body: 'Sun', sign: 'scorpio', date, zone },
        });
        expect(accepted.isError, `${path} ${date} ${zone}`).toBe(false);
        expect(accepted.structuredContent, `${path} ${date} ${zone}`).toMatchObject({ ok: true });
      }
    }

    const numerologyOptions = {
      ...options,
      env: { ...options.env, ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1', ZODIACS_NUMEROLOGY_ENABLED: '1' },
    };
    [published, corrected] = await Promise.all([routes.publishedConnector(numerologyOptions), routes.de440Connector(numerologyOptions)]);
    for (const client of clients) {
      const list = await client.listTools();
      expect(list.tools.map(tool => tool.name)).toContain('get_numerology');
      const capabilities = await client.callTool({ name: 'get_capabilities', arguments: {} });
      expect(capabilities.structuredContent).toMatchObject({ ok: true, data: {
        limitations: expect.arrayContaining(['For a numerology reading, use get_numerology, not explain_astrology.']),
      } });
      const reading = await client.callTool({ name: 'get_numerology', arguments: { birthDate: '1990-01-01' } });
      expect(reading.structuredContent).toMatchObject({ ok: true, data: { separateFromAstrology: expect.stringContaining('not astrology') } });
      expect(JSON.stringify(reading.structuredContent)).not.toMatch(/reading confidence/iu);
    }
  } finally {
    await Promise.all(clients.map(client => client.close()));
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 20_000);

it('answers with no credentials while accounts are off: no sign-in challenge, and every tool is noauth and read-only', async () => {
  const routes = await import('../../api/_ai/handler');
  let published: Awaited<ReturnType<typeof routes.publishedConnector>> | undefined;
  const server = createServer((req, res) => { void published!(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const allowed = async () => 'allowed' as const;
  try {
    // Production's switches for the tools it lists, with ZODIACS_ACCOUNTS_ENABLED unset.
    published = await routes.publishedConnector({
      env: { ZODIACS_MCP_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1', ZODIACS_COVERAGE_ENABLED: '1' },
      allowedHosts: [new URL(base).host], rateLimit: allowed, atomicQuota: allowed, countUsage: async () => {},
    });
    // Only the protocol's own headers: no Authorization, no cookie, no key.
    const ask = async (method: string, params: unknown) => {
      const response = await fetch(`${base}/mcp`, { method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18',
      }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
      const text = await response.text();
      const data = (response.headers.get('content-type') ?? '').includes('text/event-stream')
        ? text.split('\n').filter(line => line.startsWith('data: ')).pop()?.slice(6) ?? ''
        : text;
      return { response, message: JSON.parse(data) };
    };
    const opened = await ask('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'no-account', version: '1' } });
    expect(opened.response.status).toBe(200);
    expect(opened.response.headers.get('www-authenticate')).toBeNull();
    expect(opened.message.result.serverInfo.name).toBe('zodiacs');
    const listed = await ask('tools/list', {});
    expect(listed.response.status).toBe(200);
    expect(listed.response.headers.get('www-authenticate')).toBeNull();
    const tools = listed.message.result.tools as { name: string; annotations?: { readOnlyHint?: boolean }; _meta?: { securitySchemes?: unknown } }[];
    expect(tools.length).toBeGreaterThanOrEqual(13);
    for (const tool of tools) {
      expect(tool._meta?.securitySchemes, tool.name).toEqual([{ type: 'noauth' }]);
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
    }
    const called = await ask('tools/call', { name: 'get_capabilities', arguments: {} });
    expect(called.response.status).toBe(200);
    expect(called.response.headers.get('www-authenticate')).toBeNull();
    expect(called.message.result.isError ?? false).toBe(false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}, 20_000);

it('ships a plugin package whose MCP entry has a URL and nothing else: no headers, no keys', async () => {
  for (const file of ['plugins/zodiacs-sky/mcp.json', 'plugins/zodiacs-sky/.mcp.json']) {
    const servers = Object.values(JSON.parse(await readFile(new URL(`../../${file}`, import.meta.url), 'utf8')).mcpServers) as Record<string, unknown>[];
    expect(servers, file).toHaveLength(1);
    expect(Object.keys(servers[0]).sort(), file).toEqual(['type', 'url']);
    expect(servers[0].url, file).toBe('https://zodiacs.org/mcp');
  }
});
