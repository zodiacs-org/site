import { afterAll, describe, expect, it, vi } from 'vitest';
import { createServer, request, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createAiNodeHandler, type AiHttpOptions } from '../http';
import { ALL_AI_TOOL_NAMES } from '../contracts';
import committedWindow from '../../data/horoscope-window.json';
import type { HoroscopeWindow } from '../horoscope/window';
import { SAVE_TOOL_NAME } from './contracts';
import type { AccountsService } from './service';
import type { AccountPrincipal } from './save';
import * as consent from '../../../integrations/generated/accounts-consent.mjs';

const servers: Server[] = [];
afterAll(async () => { await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve())))); });
const principal: AccountPrincipal = { user: randomUUID(), session: randomUUID(), client: '6f9619ff-8b86-4011-b42d-00c04fc964ff' };
const challenge = 'Bearer resource_metadata="https://zodiacs.org/.well-known/oauth-protected-resource/mcp", scope="openid"';
const metadata = { resource: 'https://zodiacs.org/mcp', authorization_servers: ['https://accountstest.supabase.co/auth/v1'], scopes_supported: ['openid'], bearer_methods_supported: ['header'], resource_name: 'Zodiacs', resource_documentation: 'https://zodiacs.org/privacy/' };

function fakeService(save = vi.fn(async () => ({ id: randomUUID(), saved_at: '2026-10-14T12:00:00.000+00:00', created: true }))) {
  const authenticate = vi.fn(async (token: string) => (token === 'good.token.value' ? principal : null));
  const service: AccountsService = { oauth: { resource: metadata.resource, issuer: metadata.authorization_servers[0], challenge, metadata, authenticate },
    save, clients: [principal.client], supabaseUrl: 'https://accountstest.supabase.co', publishableKey: 'sb_publishable_test' };
  return { service, save, authenticate };
}

async function serve(env: Record<string, string | undefined>, options: AiHttpOptions = {}) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { void handle(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  const counted: string[] = [];
  handle = createAiNodeHandler({ env: { ZODIACS_MCP_ENABLED: '1', ...env }, allowedHosts: [host], rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed',
    countUsage: async (tool) => { counted.push(tool); }, consentPage: async () => consent,
    dependencies: { horoscopeWindow: async () => committedWindow as HoroscopeWindow, now: () => new Date('2026-10-14T12:00:00Z') }, ...options });
  return { host, counted };
}

function call(host: string, path: string, method: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; headers: Record<string, any>; text: string; message: any }>((resolve, reject) => {
    const req = request(`http://${host}${path}`, { method, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', ...headers } }, res => {
      let text = ''; res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        let message: unknown;
        try { message = JSON.parse(res.headers['content-type']?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text); } catch { message = undefined; }
        resolve({ status: res.statusCode!, headers: res.headers, text, message });
      });
    });
    req.on('error', reject); req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}
const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const save = rpc('tools/call', { name: SAVE_TOOL_NAME, arguments: { kind: 'occasion', occasion: { occasion: 'wedding', date: '2027-06-12' } } });
const on = { ZODIACS_ACCOUNTS_ENABLED: '1', ZODIACS_OCCASIONS_ENABLED: '1' };

describe('accounts on: mixed authentication on the hosted MCP', () => {
  it('lists the save tool with OAuth and keeps every other tool anonymous', async () => {
    const { service } = fakeService();
    const { host } = await serve(on, { accounts: service });
    const { message } = await call(host, '/mcp', 'POST', rpc('tools/list'));
    const tools = message.result.tools as { name: string; _meta?: Record<string, any>; annotations?: Record<string, unknown> }[];
    expect(tools.map(tool => tool.name)).toEqual([...ALL_AI_TOOL_NAMES, SAVE_TOOL_NAME]);
    for (const tool of tools.slice(0, -1)) expect(tool._meta?.securitySchemes).toEqual([{ type: 'noauth' }]);
    const saveTool = tools.at(-1)!;
    expect(saveTool._meta?.securitySchemes).toEqual([{ type: 'oauth2', scopes: ['openid'] }]);
    expect(saveTool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true });
  });

  it('answers an anonymous save with the sign-in challenge ChatGPT shows its prompt for, and saves nothing', async () => {
    const { service, save: store } = fakeService();
    const { host, counted } = await serve(on, { accounts: service });
    const reply = await call(host, '/mcp', 'POST', save);
    expect(reply.status).toBe(200);
    expect(reply.message.result.isError).toBe(true);
    expect(reply.message.result.structuredContent).toMatchObject({ ok: false, tool: SAVE_TOOL_NAME, error: { code: 'authentication-required' } });
    expect(reply.message.result._meta['mcp/www_authenticate']).toEqual([`${challenge}, error="insufficient_scope", error_description="Sign in to your Zodiacs account to save this."`]);
    expect(store).not.toHaveBeenCalled();
    expect(counted).toEqual([SAVE_TOOL_NAME]);
  });

  it('refuses a present but unusable token with 401 and the resource metadata, for any request', async () => {
    const { service } = fakeService();
    const { host } = await serve(on, { accounts: service });
    for (const authorization of ['Bearer expired.token.value', 'Basic dXNlcjpwYXNz', 'Bearer ']) {
      const reply = await call(host, '/mcp', 'POST', rpc('tools/list'), { Authorization: authorization });
      expect(reply.status).toBe(401);
      expect(reply.headers['www-authenticate']).toBe(`${challenge}, error="invalid_token"`);
      expect(reply.headers['cache-control']).toBe('no-store');
    }
  });

  it('saves for a signed-in person, and still answers the anonymous tools', async () => {
    const { service, save: store, authenticate } = fakeService();
    const { host, counted } = await serve(on, { accounts: service });
    const reply = await call(host, '/mcp', 'POST', save, { Authorization: 'Bearer good.token.value', 'User-Agent': 'openai-mcp/1.0.0' });
    expect(reply.message.result.isError).toBe(false);
    expect(reply.message.result.structuredContent).toMatchObject({ ok: true, data: { saved: true, kind: 'occasion', alreadySaved: false } });
    expect(authenticate).toHaveBeenCalledWith('good.token.value');
    expect(store).toHaveBeenCalledTimes(1);
    expect((store.mock.calls[0] as unknown[])[0]).toEqual(principal);
    const sky = await call(host, '/mcp', 'POST', rpc('tools/call', { name: 'get_sky', arguments: {} }));
    expect(sky.message.result.isError).toBe(false);
    const capabilities = await call(host, '/mcp', 'POST', rpc('tools/call', { name: 'get_capabilities', arguments: {} }));
    expect(capabilities.message.result.structuredContent.data.privacy).toContain('Only the save tool needs an account');
    expect(capabilities.message.result.structuredContent.data.limitations.join(' ')).not.toContain('account access');
    expect(counted).toEqual([SAVE_TOOL_NAME, 'get_sky', 'get_capabilities']);
  });

  it('publishes protected-resource metadata and the consent page, GET only', async () => {
    const { service } = fakeService();
    const { host } = await serve(on, { accounts: service });
    const meta = await call(host, '/mcp?__zodiacs_ai=resource', 'GET');
    expect(meta.status).toBe(200);
    expect(meta.message).toEqual(metadata);
    expect((await call(host, '/mcp?__zodiacs_ai=resource', 'POST', {})).status).toBe(405);
    const page = await call(host, '/mcp?__zodiacs_ai=consent&authorization_id=abcDEF123_-xyz', 'GET');
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(page.headers['content-security-policy']).toContain(`script-src '${consent.CONSENT_SCRIPT_HASH}'`);
    expect(page.headers['content-security-policy']).toContain('connect-src https://accountstest.supabase.co;');
    expect(page.headers['x-robots-tag']).toBe('noindex');
    expect(page.text).toContain(`<script type="application/json" id="zodiacs-consent-config">{"url":"https://accountstest.supabase.co","key":"sb_publishable_test","clients":["${principal.client}"]}</script>`);
    for (const path of ['/mcp?__zodiacs_ai=consent&authorization_id=bad%20id', '/mcp?__zodiacs_ai=consent&next=https://evil.example', '/mcp?__zodiacs_ai=resource&authorization_id=abcDEF123',
      '/mcp?__zodiacs_ai=consent&authorization_id=abcDEF123&authorization_id=abcDEF124']) {
      expect((await call(host, path, 'GET')).status, path).toBe(400);
    }
  });

  it('offers no save tool without the 0.5.0 tools, and refuses a half-configured switch-on', async () => {
    const { service } = fakeService();
    const { host } = await serve({ ZODIACS_ACCOUNTS_ENABLED: '1' }, { accounts: service });
    const { message } = await call(host, '/mcp', 'POST', rpc('tools/list'));
    expect(message.result.tools.map((tool: { name: string }) => tool.name)).not.toContain(SAVE_TOOL_NAME);
    const broken = await serve(on);
    const refused = await call(broken.host, '/mcp', 'POST', rpc('tools/list'));
    expect(refused.status).toBe(503);
    expect(refused.message.error.code).toBe('accounts-unavailable');
  });
});

describe('accounts off', () => {
  it('has no metadata or consent page, and no save tool', async () => {
    for (const env of [{}, { ZODIACS_OCCASIONS_ENABLED: '1' }, { ZODIACS_ACCOUNTS_ENABLED: '0', ZODIACS_OCCASIONS_ENABLED: '1' }]) {
      const { host } = await serve(env);
      for (const path of ['/mcp?__zodiacs_ai=resource', '/mcp?__zodiacs_ai=consent', '/mcp?__zodiacs_ai=consent&authorization_id=abcDEF123']) {
        const reply = await call(host, path, 'GET');
        expect(reply.status, path).toBe(404);
        expect(reply.headers['www-authenticate']).toBeUndefined();
      }
      const tools = await call(host, '/mcp', 'POST', rpc('tools/list'), { Authorization: 'Bearer anything' });
      expect(tools.status).toBe(200);
      expect(tools.text).not.toContain(SAVE_TOOL_NAME);
      expect(tools.text).not.toContain('oauth2');
    }
  });
});
