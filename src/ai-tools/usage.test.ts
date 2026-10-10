import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, request, type Server, type ServerResponse } from 'node:http';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createAiNodeHandler, type AiHttpOptions } from './http';
import { AI_TOOL_NAMES } from './contracts';
import { countAiToolCall, usageHostFamily, USAGE_HOSTS, USAGE_TIMEOUT_MS } from './usage';

const root = fileURLToPath(new URL('../../', import.meta.url));
const env = { PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY: `sb_secret_${'x'.repeat(40)}`, VERCEL_ENV: 'preview' };
const RPC_URL = 'https://synthetic.supabase.co/rest/v1/rpc/zodiacs_mcp_usage_count_v1';
const rpc = (method: string, params: unknown = {}, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const capabilities = rpc('tools/call', { name: 'get_capabilities', arguments: {} });

const servers: Server[] = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

let latestReply: ServerResponse | undefined;
/** A loopback MCP endpoint with the existing limits allowed and the given counting options. */
async function serve(options: AiHttpOptions = {}) {
  let handle: (req: unknown, res: unknown) => Promise<void> = async () => {};
  const server = createServer((req, res) => { latestReply = res; void handle(req, res); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  servers.push(server);
  const host = `127.0.0.1:${(server.address() as { port: number }).port}`;
  handle = createAiNodeHandler({ rateLimit: async () => 'allowed', atomicQuota: async () => 'allowed', ...options, env: { ZODIACS_MCP_ENABLED: '1', ...options.env }, allowedHosts: [host] });
  return host;
}

/** node:http rather than fetch, so a test can replace the global fetch the counter uses. */
function call(host: string, body: unknown, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; message: any }>((resolve, reject) => {
    const req = request(`http://${host}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2025-06-18', ...headers } }, res => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => {
        const json = res.headers['content-type']?.includes('text/event-stream') ? text.split('\n').find(line => line.startsWith('data: '))!.slice(6) : text;
        resolve({ status: res.statusCode!, message: JSON.parse(json) });
      });
    });
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

describe('assistant host family', () => {
  it.each([
    ['openai-mcp/1.0.0', 'chatgpt'],
    ['Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot', 'chatgpt'],
    ['Claude-User (claude-code/2.0.0; +https://support.anthropic.com/)', 'claude'],
    ['claude-ai/0.1', 'claude'],
    ['Anthropic-MCP-Client/1.0', 'claude'],
    ['python-httpx/0.28.1', 'other'],
    ['node', 'other'],
    ['', 'other'],
  ])('classifies %j as %s', (agent, family) => {
    expect(usageHostFamily(agent)).toBe(family);
  });
  it('treats a missing, repeated or non-text header as other', () => {
    for (const value of [undefined, null, 42, ['ChatGPT-User/1.0'], { agent: 'claude' }]) expect(usageHostFamily(value)).toBe('other');
  });
  it('checks the ChatGPT family first when a header names both', () => {
    expect(usageHostFamily('openai-gateway relaying claude')).toBe('chatgpt');
  });
});

describe('anonymous daily usage RPC', () => {
  it('sends only the deployment scope, tool name and host family, with secret-key authentication', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response(null, { status: 204 }));
    expect(await countAiToolCall('get_horoscope', 'claude', env, fetcher)).toBe(true);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(RPC_URL);
    expect(JSON.parse(options.body as string)).toEqual({ usage_scope: 'preview', usage_tool: 'get_horoscope', usage_host: 'claude' });
    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('error');
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(Object.keys(options.headers as Record<string, string>).sort()).toEqual(['Cache-Control', 'Content-Type', 'apikey']);
  });
  it('does nothing without a complete preview or production configuration', async () => {
    const fetcher = vi.fn();
    for (const changed of [{ VERCEL_ENV: 'development' }, { VERCEL_ENV: undefined }, { PUBLIC_SUPABASE_URL: 'https://example.com' }, { SUPABASE_SERVICE_ROLE_KEY: '' }]) {
      expect(await countAiToolCall('get_sky', 'other', { ...env, ...changed }, fetcher)).toBe(false);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('refuses a tool name or host family outside the fixed lists before network work', async () => {
    const fetcher = vi.fn();
    expect(await countAiToolCall('search_zodiacs' as never, 'other', env, fetcher)).toBe(false);
    expect(await countAiToolCall('get_sky', 'Mozilla/5.0' as never, env, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('never throws: transport, permission and missing-function failures resolve false', async () => {
    for (const fetcher of [async () => { throw new Error('synthetic outage'); }, async () => new Response('{"code":"42501"}', { status: 403 }), async () => new Response('{"code":"PGRST202"}', { status: 404 })]) {
      expect(await countAiToolCall('get_sky', 'other', env, fetcher as unknown as typeof fetch)).toBe(false);
    }
  });
  it('keeps the migration in step with the tool names and host families', () => {
    const files = readdirSync(`${root}supabase/migrations`).filter(name => name.endsWith('_zodiacs_mcp_usage_counts.sql'));
    expect(files).toHaveLength(1);
    const sql = readFileSync(`${root}supabase/migrations/${files[0]}`, 'utf8');
    const lists = [...sql.matchAll(/in \(((?:'[a-z_]+'(?:, )?)+)\)/g)].map(match => match[1].split(', ').map(value => value.slice(1, -1)));
    const tools = lists.filter(list => list.includes('get_sky'));
    const hosts = lists.filter(list => list.includes('chatgpt'));
    expect(tools).toHaveLength(2);
    expect(hosts).toHaveLength(2);
    for (const list of tools) expect(list).toEqual([...AI_TOOL_NAMES]);
    for (const list of hosts) expect(list).toEqual([...USAGE_HOSTS]);
    expect(USAGE_TIMEOUT_MS).toBeLessThanOrEqual(1500);
  });
});

describe('counting hosted tool calls', () => {
  it('counts each handled tool call once, after its reply has ended, including an error result', async () => {
    const counted: [string, string, boolean | undefined][] = [];
    const countUsage = async (tool: string, host: string) => { counted.push([tool, host, latestReply?.writableEnded]); };
    const host = await serve({ countUsage });
    expect((await call(host, capabilities, { 'User-Agent': 'openai-mcp/1.0.0' })).message.result.isError).toBe(false);
    const errorResult = await call(host, rpc('tools/call', { name: 'get_sky', arguments: { zone: 'Not/A_Zone' } }), { 'User-Agent': 'Claude-User/1.0' });
    expect(errorResult.message.result.isError).toBe(true);
    await call(host, rpc('tools/call', { name: 'search_zodiacs', arguments: {} }));
    await call(host, rpc('tools/call', { name: ['get_sky'], arguments: {} }));
    await call(host, rpc('tools/list'));
    await call(host, rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } }));
    expect(counted).toEqual([['get_capabilities', 'chatgpt', true], ['get_sky', 'claude', true]]);

    counted.length = 0;
    const limited = await serve({ countUsage, atomicQuota: async () => 'limited' });
    expect((await call(limited, capabilities)).status).toBe(429);
    expect(counted).toEqual([]);
  });

  it('never delays, changes or fails a reply when counting fails, hangs or the platform hook throws', async () => {
    const baseline = await call(await serve({ countUsage: async () => true }), capabilities);
    expect(baseline.status).toBe(200);
    expect(baseline.message.result.isError).toBe(false);
    const handed: Promise<unknown>[] = [];
    const waitUntil = (task: Promise<unknown>) => { handed.push(task); };
    const failures: [string, AiHttpOptions][] = [
      ['a counter that throws', { countUsage: () => { throw new Error('synthetic counter failure'); }, waitUntil }],
      ['a counter that rejects', { countUsage: async () => { throw new Error('synthetic database refusal'); }, waitUntil }],
      ['a counter that never settles', { countUsage: () => new Promise(() => {}) }],
      ['a platform hook that throws', { countUsage: async () => true, waitUntil: () => { throw new Error('synthetic platform failure'); } }],
    ];
    for (const [label, options] of failures) {
      const reply = await call(await serve(options), capabilities, { 'User-Agent': 'ChatGPT-User/1.0' });
      expect(reply, label).toEqual(baseline);
    }
    // The platform is only ever handed a task that settles quietly.
    await expect(Promise.all(handed)).resolves.toEqual([undefined]);
  });

  it('replies before a slow database answers, then gives up within the timeout without an error', async () => {
    const hung = vi.fn((_url: RequestInfo | URL, options?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason));
    }));
    vi.stubGlobal('fetch', hung);
    const tasks: Promise<void>[] = [];
    let settled = false;
    const host = await serve({ env, waitUntil: task => { tasks.push(task.then(() => { settled = true; })); } });
    const started = performance.now();
    const reply = await call(host, capabilities, { 'User-Agent': 'openai-mcp/1.0.0' });
    expect(reply.status).toBe(200);
    expect(reply.message.result.isError).toBe(false);
    // The reply arrived while the count was still waiting on the database.
    expect(settled).toBe(false);
    expect(tasks).toHaveLength(1);
    await tasks[0];
    const elapsed = performance.now() - started;
    expect(elapsed).toBeGreaterThanOrEqual(USAGE_TIMEOUT_MS - 50);
    expect(elapsed).toBeLessThan(USAGE_TIMEOUT_MS + 3000);
    expect(hung).toHaveBeenCalledTimes(1);
    expect(hung.mock.calls[0][0]).toBe(RPC_URL);
    expect(JSON.parse(hung.mock.calls[0][1]!.body as string)).toEqual({ usage_scope: 'preview', usage_tool: 'get_capabilities', usage_host: 'chatgpt' });
  });

  it('makes no request at all outside a configured preview or production deployment', async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    const tasks: Promise<unknown>[] = [];
    const host = await serve({ waitUntil: task => { tasks.push(task); } });
    expect((await call(host, capabilities, { 'User-Agent': 'openai-mcp/1.0.0' })).status).toBe(200);
    await Promise.all(tasks);
    expect(tasks).toHaveLength(1);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends no argument, location, credential or User-Agent text to the counter', async () => {
    const CANARY = 'private-canary-1985';
    const sent: [string, RequestInit][] = [];
    const recording = async (url: RequestInfo | URL, options?: RequestInit) => { sent.push([String(url), options!]); return new Response(null, { status: 204 }); };
    const host = await serve({ countUsage: (tool, family) => countAiToolCall(tool, family, env, recording as typeof fetch) });
    const reply = await call(host, rpc('tools/call', {
      name: 'get_sky',
      arguments: { zone: `Asia/${CANARY}`, [CANARY]: CANARY },
      _meta: { 'openai/userLocation': { city: CANARY, country: 'TH', timezone: 'Asia/Bangkok' } },
    }), { 'User-Agent': `Mozilla/5.0 ChatGPT-User/1.0 ${CANARY}`, Authorization: `Bearer ${CANARY}` });
    expect(reply.message.result.isError).toBe(true);
    expect(JSON.stringify(reply.message)).not.toContain(CANARY);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const [url, options] = sent[0];
    expect(url).toBe(RPC_URL);
    expect(JSON.parse(options.body as string)).toEqual({ usage_scope: 'preview', usage_tool: 'get_sky', usage_host: 'chatgpt' });
    expect(JSON.stringify([url, options.headers, options.body])).not.toContain(CANARY);
    expect(Object.keys(options.headers as Record<string, string>).map(key => key.toLowerCase())).not.toContain('user-agent');
  });
});
