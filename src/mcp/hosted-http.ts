/**
 * The HTTP side of https://zodiacs.org/api/v1/mcp: a stateless Streamable HTTP
 * endpoint for the tools in hosted-server.ts, called by api/_mcp/handler.ts
 * when vercel.json's /api/v1/mcp rewrite reaches api/compatibility.ts.
 *
 * Adapted from the transport pull request #618 tested against ChatGPT and the
 * official SDK clients (src/ai-tools/http.ts there), without its separate
 * account-bound preview and without a database: the only limits are the
 * compute API's two Firewall rules, counted the way the compute API counts
 * them, so the endpoint adds no new store and no new spending.
 *
 * What it guarantees, in order of the checks:
 *
 * - It answers only on zodiacs.org, www.zodiacs.org, one exact preview
 *   hostname set by an administrator (MCP_STAGING_HOST_ENV) and, on a preview
 *   deployment, that deployment's own hostname (VERCEL_URL). A request with an
 *   Origin header is served only from the assistants' and the site's own
 *   origins; one without (a server-to-server call) is served.
 * - It is off unless MCP_SWITCH_ENV is "1", and then refuses everything with 503.
 * - Every protocol POST counts under the compute API's general rule, and a
 *   find_events call also under its events rule. When a limit cannot be
 *   checked it refuses: fail closed, as the compute API does. The health
 *   check counts under neither, and runs no calculation.
 * - It reads at most MAX_REQUEST_BYTES of strict JSON, one JSON-RPC message.
 * - It writes nothing from a request or its result anywhere: no log line, no
 *   file, no store. Every refusal is a fixed sentence, and the SDK's
 *   validation messages, which can repeat a property name from the request,
 *   are replaced before the reply leaves (sanitizeProtocolMessage).
 */
import { createMcpHandler } from '@modelcontextprotocol/server';
import {
  COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, RETRY_AFTER_SECONDS, type RateLimitVerdict,
} from '../lib/compute-api/constants';
import { computeApiRateLimit } from '../lib/compute-api/handler';
import { MCP_ROUTE_PARAM, MCP_ROUTES, MCP_STAGING_HOST_ENV, MCP_SWITCH_ENV } from './hosted-route';
import {
  HOSTED_SERVER_NAME, HOSTED_SERVER_VERSION, MAX_REQUEST_BYTES, createHostedServer, type HostedDependencies,
} from './hosted-server';

const ORIGIN = 'https://zodiacs.org';
const PRODUCTION_HOSTS = Object.freeze(['zodiacs.org', 'www.zodiacs.org']);

/** The origins a browser-originated request may come from; compared after parsing, so a trailing slash still matches. */
export const ALLOWED_ORIGINS: ReadonlySet<string> = new Set([
  'https://chatgpt.com', 'https://chat.openai.com',
  'https://claude.ai', 'https://claude.com',
  'https://zodiacs.org', 'https://www.zodiacs.org',
]);

/** The JSON-RPC methods served. Anything else that expects an answer gets -32601; a notification is acknowledged. */
export const SERVED_METHODS: ReadonlySet<string> = new Set([
  'initialize', 'notifications/initialized', 'ping', 'server/discover', 'tools/list', 'tools/call',
]);

/** A reply over this many bytes is refused whole rather than truncated. */
export const MAX_REPLY_BYTES = 262_144;

const SECURITY_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
});

/** Headers the SDK reads, copied by name; nothing else from the request reaches it. */
const FORWARDED_HEADERS = Object.freeze(['content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'mcp-method', 'mcp-name']);

export interface HostedHttpOptions {
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** The Firewall check; tests inject one. Production uses the compute API's own. */
  readonly rateLimit?: (req: any, id: string) => Promise<RateLimitVerdict>;
  /** Test-only clock for get_sky. */
  readonly now?: () => Date;
}

/** The one shape every refusal of this transport has: a code from a fixed list and one fixed sentence. */
function refuse(res: any, status: number, code: string, retryAfter?: number): void {
  res.statusCode = status;
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (retryAfter !== undefined) res.setHeader('Retry-After', String(retryAfter));
  res.end(JSON.stringify({ error: { code, message: 'The MCP request cannot be served under its method, schema or availability requirements.' } }));
}

function limitRefusal(res: any, verdict: Exclude<RateLimitVerdict, 'allowed'>): void {
  if (verdict === 'limited') refuse(res, 429, 'rate-limited', RETRY_AFTER_SECONDS.rateLimited);
  else refuse(res, 503, 'rate-limit-unavailable', RETRY_AFTER_SECONDS.rateLimitUnavailable);
}

function plainHostname(host: string | undefined): string | null {
  if (!host || host.length > 253 || !host.includes('.')) return null;
  return host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)) ? host : null;
}

/**
 * The extra hostnames the endpoint answers on, neither ever read from a
 * header: the administrator's preview hostname (MCP_STAGING_HOST_ENV), and,
 * on a preview deployment only, the deployment's own hostname as the platform
 * names it (VERCEL_URL), so a preview can be tried without a project setting.
 */
function extraHosts(env: Readonly<Record<string, string | undefined>>): string[] {
  const hosts = [plainHostname(env[MCP_STAGING_HOST_ENV])];
  if (env.VERCEL_ENV === 'preview') hosts.push(plainHostname(env.VERCEL_URL));
  return hosts.filter((host): host is string => host !== null);
}

export function originAllowed(value: unknown): boolean {
  if (value === undefined) return true;
  if (typeof value !== 'string') return false;
  try {
    return ALLOWED_ORIGINS.has(new URL(value).origin);
  } catch {
    return false;
  }
}

async function readBody(req: any): Promise<string> {
  if (req.body !== undefined) {
    const bytes = typeof req.body === 'string' ? Buffer.from(req.body)
      : Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    if (bytes.length > MAX_REQUEST_BYTES) throw new Error('payload-too-large');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_REQUEST_BYTES) { tooLarge = true; chunks.length = 0; continue; }
    chunks.push(part);
  }
  if (tooLarge) throw new Error('payload-too-large');
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total));
}

/** Remove SDK validation diagnostics, which can repeat a property name or value from the request. */
export function sanitizeProtocolMessage(message: any): any {
  if (!message || typeof message !== 'object') return message;
  if (message.error) {
    message.error = { code: message.error.code, message: 'The MCP request does not match a supported operation or schema.' };
  } else if (message.result?.isError && message.result?.structuredContent === undefined
    && Array.isArray(message.result.content)
    && message.result.content.some((item: any) => item?.type === 'text' && typeof item.text === 'string' && item.text.startsWith('Input validation error'))) {
    message.result.content = [{ type: 'text', text: 'The tool arguments do not match the supported schema.' }];
  }
  return message;
}

function sanitizeReply(reply: string, eventStream: boolean): string {
  const clean = (text: string) => JSON.stringify(sanitizeProtocolMessage(JSON.parse(text)));
  if (eventStream) return reply.split('\n').map((line) => (line.startsWith('data: ') ? `data: ${clean(line.slice(6))}` : line)).join('\n');
  return reply.trim() ? clean(reply) : reply;
}

function routeOf(req: any): string | null | 'invalid' {
  let params: URLSearchParams;
  try {
    params = new URL(req.url ?? '/api/v1/mcp', ORIGIN).searchParams;
  } catch {
    return 'invalid';
  }
  if ([...params.keys()].some((key) => key !== MCP_ROUTE_PARAM) || params.getAll(MCP_ROUTE_PARAM).length > 1) return 'invalid';
  const value = params.get(MCP_ROUTE_PARAM);
  if (value !== null && value !== MCP_ROUTES.protocol && value !== MCP_ROUTES.health) return 'invalid';
  return value;
}

export function createHostedMcpHandler(options: HostedHttpOptions = {}) {
  return async function hostedMcp(req: any, res: any): Promise<void> {
    const env = options.env ?? process.env;
    const host = req.headers?.host;
    const hosts = [...PRODUCTION_HOSTS, ...extraHosts(env)];
    if (typeof host !== 'string' || !hosts.includes(host.toLowerCase())) return refuse(res, 403, 'host-not-allowed');
    const origin = req.headers?.origin;
    if (!originAllowed(origin)) return refuse(res, 403, 'origin-not-allowed');
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
    if (typeof origin === 'string') {
      res.setHeader('Access-Control-Allow-Origin', new URL(origin).origin);
      res.setHeader('Vary', 'Origin');
    }
    const method = req.method ?? 'GET';
    if (method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, MCP-Method, MCP-Name');
      res.statusCode = 204;
      res.end();
      return;
    }
    const route = routeOf(req);
    if (route === 'invalid') return refuse(res, 400, 'invalid-query');
    const health = route === MCP_ROUTES.health;
    if (!(method === 'POST' && !health) && !(method === 'GET' && health)) {
      res.setHeader('Allow', health ? 'GET' : 'POST, OPTIONS');
      return refuse(res, 405, 'method-not-allowed');
    }
    if (env[MCP_SWITCH_ENV] !== '1') return refuse(res, 503, 'disabled', RETRY_AFTER_SECONDS.disabled);
    if (health) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ service: HOSTED_SERVER_NAME, version: HOSTED_SERVER_VERSION, transport: 'streamable-http', ready: true }));
      return;
    }

    const rateLimit = options.rateLimit ?? computeApiRateLimit;
    const verdictOf = async (id: string): Promise<RateLimitVerdict> => {
      try { return await rateLimit(req, id); } catch { return 'unavailable'; }
    };
    const general = await verdictOf(COMPUTE_RATE_LIMIT_ID);
    if (general !== 'allowed') return limitRefusal(res, general);

    const contentType = req.headers?.['content-type'];
    if (typeof contentType !== 'string'
      || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/iu.test(contentType)
      || (req.headers?.['content-encoding'] && req.headers['content-encoding'] !== 'identity')) {
      return refuse(res, 415, 'unsupported-media-type');
    }
    const length = req.headers?.['content-length'];
    if (length !== undefined && (typeof length !== 'string' || !/^\d+$/u.test(length))) return refuse(res, 400, 'invalid-length');
    if (length !== undefined && Number(length) > MAX_REQUEST_BYTES) return refuse(res, 413, 'payload-too-large');
    let text: string;
    let body: unknown;
    try {
      text = await readBody(req);
      body = JSON.parse(text);
    } catch (error) {
      const tooLarge = error instanceof Error && error.message === 'payload-too-large';
      return refuse(res, tooLarge ? 413 : 400, tooLarge ? 'payload-too-large' : 'invalid-json');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse(res, 400, 'invalid-json-rpc');
    const message = body as Record<string, unknown>;
    const id = message.id;
    if (!SERVED_METHODS.has(String(message.method))) {
      if (id === undefined) {
        // A notification the server has no use for is acknowledged and dropped.
        res.statusCode = 202;
        res.end();
        return;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: typeof id === 'string' || typeof id === 'number' ? id : null,
        error: { code: -32601, message: 'This MCP operation is not supported.' },
      }));
      return;
    }

    const dependencies: HostedDependencies = {
      ...(options.now ? { now: options.now } : {}),
      allowEvents: () => verdictOf(COMPUTE_EVENTS_RATE_LIMIT_ID),
    };
    const sdk = createMcpHandler(() => createHostedServer(dependencies), { legacy: 'stateless', responseMode: 'auto', onerror: () => {} });
    try {
      const headers = new Headers();
      for (const name of FORWARDED_HEADERS) {
        const value = req.headers?.[name];
        if (typeof value === 'string') headers.set(name, value);
      }
      const response = await sdk.fetch(new Request(`${ORIGIN}/api/v1/mcp`, { method: 'POST', headers, body: text }), { parsedBody: body });
      const reply = response.body ? await response.text() : '';
      if (Buffer.byteLength(reply) > MAX_REPLY_BYTES) return refuse(res, 500, 'reply-too-large');
      const safe = sanitizeReply(reply, response.headers.get('content-type')?.includes('text/event-stream') ?? false);
      res.statusCode = response.status;
      response.headers.forEach((value: string, key: string) => {
        if (!['cache-control', 'content-length', 'access-control-allow-origin'].includes(key)) res.setHeader(key, value);
      });
      res.end(safe);
    } catch {
      if (!res.headersSent) refuse(res, 500, 'protocol-failed');
      else res.end();
    } finally {
      await sdk.close().catch(() => {});
    }
  };
}
