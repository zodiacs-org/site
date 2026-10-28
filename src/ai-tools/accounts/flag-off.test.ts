import { afterAll, describe, expect, it } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { createAiNodeHandler } from '../http';
import committedWindow from '../../data/horoscope-window.json';
import type { HoroscopeWindow } from '../horoscope/window';

/**
 * The account switch defaults off. Off (unset, empty, '0' or anything but '1'),
 * the hosted server must answer initialize, tools/list, resources/list and a
 * call to the account tool with exactly the bytes the 0.5.0 submission answers
 * with. The fixture was captured from the base branch before the account code
 * existed; regenerate it only from a released commit (CAPTURE_FLAG_OFF_FIXTURE=1).
 * 0.5.1 changed only the reported version in it.
 */
const FIXTURE = new URL('./flag-off.fixture.json', import.meta.url);
const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); });

async function serve(env: Record<string, string | undefined>) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async () => undefined, dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow } });
  return host;
}

function post(host: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: Record<string, unknown>; text: string }>((resolve, reject) => {
    const req = request(`http://${host}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', ...headers } }, res => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, text }));
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const SCENARIOS = { released: {}, occasions: { ZODIACS_OCCASIONS_ENABLED: '1' } } as const;
const REQUESTS: Record<string, [string, unknown, Record<string, string>?]> = {
  initialize: ['/mcp', rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'flag-off', version: '1' } })],
  toolsList: ['/mcp', rpc('tools/list')],
  resourcesList: ['/mcp', rpc('resources/list')],
  capabilities: ['/mcp', rpc('tools/call', { name: 'get_capabilities', arguments: {} })],
  save: ['/mcp', rpc('tools/call', { name: 'save_to_zodiacs', arguments: { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12' } } })],
  // A bearer token is ignored while the switch is off, as before.
  bearer: ['/mcp', rpc('tools/list'), { Authorization: 'Bearer not-a-token' }],
};

async function capture(env: Record<string, string | undefined>) {
  const host = await serve(env);
  const out: Record<string, { status: number; contentType: unknown; wwwAuthenticate: unknown; text: string }> = {};
  for (const [name, [path, body, headers]] of Object.entries(REQUESTS)) {
    const reply = await post(host, path, body, headers);
    out[name] = { status: reply.status, contentType: reply.headers['content-type'] ?? null, wwwAuthenticate: reply.headers['www-authenticate'] ?? null, text: reply.text };
  }
  return out;
}

describe('the account switch off', () => {
  it('leaves initialize, tools/list, resources/list and every account route byte-for-byte as the 0.5.0 server answers them', async () => {
    if (process.env.CAPTURE_FLAG_OFF_FIXTURE === '1') {
      const fixture: Record<string, unknown> = {};
      for (const [name, env] of Object.entries(SCENARIOS)) fixture[name] = await capture(env);
      writeFileSync(FIXTURE, JSON.stringify(fixture, null, 2) + '\n');
    }
    const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    for (const [name, env] of Object.entries(SCENARIOS)) {
      for (const accounts of [undefined, '', '0', 'true', ' 1']) {
        // Account settings without the switch change nothing either.
        const current = await capture({ ...env, ZODIACS_ACCOUNTS_ENABLED: accounts, ZODIACS_ACCOUNTS_OAUTH_CLIENTS: '00000000-0000-4000-8000-000000000000',
          PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic' });
        expect(current, `${name} with ZODIACS_ACCOUNTS_ENABLED=${JSON.stringify(accounts)}`).toEqual(fixture[name]);
      }
    }
  }, 60_000);
});
