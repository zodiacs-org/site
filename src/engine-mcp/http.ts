/**
 * The stateless streamable HTTP transport of /mcp/engine. It follows the
 * consumer endpoint's handler (src/ai-tools/http.ts) in its checks: exact
 * hosts, known browser origins, POST with JSON only, a body limit, and the
 * Firewall's per-address rate limits. It is off unless
 * ZODIACS_ENGINE_MCP_ENABLED=1.
 *
 * It keeps no state and writes no log. A refusal repeats nothing from the
 * request.
 */
import { createMcpHandler } from '@modelcontextprotocol/server';
import { checkRateLimit } from '@vercel/firewall';
import {
  ENGINE_MCP_NAME, ENGINE_MCP_PATH, ENGINE_MCP_ROUTE_PARAM, ENGINE_MCP_SWITCH_ENV, ENGINE_MCP_VERSION, MAX_ENGINE_HTTP_BYTES, MAX_ENGINE_REPLY_BYTES,
} from './contracts.js';
import { createEngineServer, type EngineServerOptions } from './server.js';

const ORIGIN = 'https://zodiacs.org';
/**
 * The compute API's Firewall rules (src/lib/compute-api/constants.ts), named
 * here rather than imported: only the compute API's own modules import it.
 * The first counts every request, the second the ephemeris searches.
 */
export const RATE_LIMIT_ID = 'zodiacs-compute-api';
export const EVENTS_RATE_LIMIT_ID = 'zodiacs-compute-events';
type RateLimitVerdict = 'allowed' | 'limited' | 'unavailable';
// Browser-side MCP clients of the assistants the bot may run in, and the site itself.
const ALLOWED_ORIGINS = new Set(['https://grok.com', 'https://chatgpt.com', 'https://chat.openai.com', 'https://claude.ai', 'https://claude.com', ORIGIN]);
const SECURITY_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
/** Tools that search the ephemeris over days or months; they also count against the Firewall's event rule. */
const HEAVY_TOOLS: ReadonlySet<string> = new Set(['reading_facts', 'event_search']);
const METHODS = ['initialize', 'notifications/initialized', 'ping', 'tools/list', 'tools/call'];
const REFUSALS: Record<string, string> = {
  'rate-limited': 'The zodiacs.org engine is busy. Try again in a minute.',
  'rate-limit-unavailable': 'The zodiacs.org engine is busy. Try again in a few minutes.',
  disabled: 'The zodiacs.org engine tools are not available right now. Try again later.',
  'payload-too-large': 'That request is too large.',
  'not-found': 'There is nothing at this address.',
};

export interface EngineHttpOptions extends EngineServerOptions {
  env?: Readonly<Record<string, string | undefined>>;
  /** Local tests inject limits; production uses the Firewall rules of the compute API. */
  rateLimit?: (req: any, id: string) => Promise<RateLimitVerdict>;
  /** Loopback hostnames for local tests. Production allows zodiacs.org only. */
  allowedHosts?: readonly string[];
}

/**
 * The Firewall rule's verdict, read as computeApiRateLimit in
 * src/lib/compute-api/handler.ts reads it; that module is not imported here
 * because its graph would come into this function with it.
 */
export async function firewallRateLimit(req: any, id: string): Promise<RateLimitVerdict> {
  if (process.env.NODE_ENV !== 'production') return 'unavailable';
  try {
    const result = await checkRateLimit(id, { headers: req.headers });
    if (result?.error === 'not-found') return 'unavailable';
    if (result?.rateLimited === true) return 'limited';
    if (result?.rateLimited === false && result.error === undefined) return 'allowed';
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

function send(res: any, status: number, code: string, retry?: number) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (retry) res.setHeader('Retry-After', String(retry));
  res.end(JSON.stringify({ error: { code, message: REFUSALS[code] ?? 'The request could not be accepted.' } }));
}

async function readBody(req: any): Promise<string> {
  if (req.body !== undefined) {
    const bytes = typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    if (bytes.length > MAX_ENGINE_HTTP_BYTES) throw new Error('payload-too-large');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_ENGINE_HTTP_BYTES) { tooLarge = true; chunks.length = 0; continue; }
    chunks.push(part);
  }
  if (tooLarge) throw new Error('payload-too-large');
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total));
}

async function limited(rateLimit: NonNullable<EngineHttpOptions['rateLimit']>, req: any, id: string): Promise<RateLimitVerdict> {
  try { return await rateLimit(req, id); } catch { return 'unavailable'; }
}

export function createEngineNodeHandler(options: EngineHttpOptions = {}) {
  return async (req: any, res: any): Promise<void> => {
    const env = options.env ?? process.env;
    const method = req.method ?? 'GET';
    const host = req.headers?.host;
    const allowedHosts = options.allowedHosts ?? ['zodiacs.org', 'www.zodiacs.org'];
    if (typeof host !== 'string' || !allowedHosts.includes(host.toLowerCase())) return send(res, 403, 'host-not-allowed');
    const origin = req.headers?.origin;
    if (origin !== undefined && (typeof origin !== 'string' || !ALLOWED_ORIGINS.has(origin))) return send(res, 403, 'origin-not-allowed');
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id');
      res.statusCode = 204; res.end(); return;
    }
    let query: URLSearchParams;
    try { query = new URL(req.url ?? ENGINE_MCP_PATH, ORIGIN).searchParams; } catch { return send(res, 400, 'invalid-query'); }
    const route = query.get(ENGINE_MCP_ROUTE_PARAM) ?? (typeof req.query?.[ENGINE_MCP_ROUTE_PARAM] === 'string' ? req.query[ENGINE_MCP_ROUTE_PARAM] : '1');
    if ([...query.keys()].some((key) => key !== ENGINE_MCP_ROUTE_PARAM) || query.getAll(ENGINE_MCP_ROUTE_PARAM).length > 1 || !['1', 'health'].includes(route)) return send(res, 400, 'invalid-query');
    if (method !== 'POST' && !(method === 'GET' && route === 'health')) { res.setHeader('Allow', 'POST, OPTIONS'); return send(res, 405, 'method-not-allowed'); }
    if (env[ENGINE_MCP_SWITCH_ENV] !== '1') return send(res, 503, 'disabled', 3600);
    const rateLimit = options.rateLimit ?? firewallRateLimit;
    let verdict = await limited(rateLimit, req, RATE_LIMIT_ID);
    if (verdict !== 'allowed') return send(res, verdict === 'limited' ? 429 : 503, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', verdict === 'limited' ? 60 : 300);
    if (method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
      res.end(JSON.stringify({ service: ENGINE_MCP_NAME, version: ENGINE_MCP_VERSION, transport: 'stateless-streamable-http', ready: true })); return;
    }
    const contentType = req.headers?.['content-type'];
    if (typeof contentType !== 'string' || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType) || (req.headers?.['content-encoding'] && req.headers['content-encoding'] !== 'identity')) return send(res, 415, 'unsupported-media-type');
    const length = req.headers?.['content-length'];
    if (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length))) return send(res, 400, 'invalid-length');
    if (length !== undefined && Number(length) > MAX_ENGINE_HTTP_BYTES) return send(res, 413, 'payload-too-large');
    let text: string;
    let body: unknown;
    try { text = await readBody(req); body = JSON.parse(text); }
    catch (error) {
      const tooLarge = error instanceof Error && error.message === 'payload-too-large';
      return send(res, tooLarge ? 413 : 400, tooLarge ? 'payload-too-large' : 'invalid-json');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, 'invalid-json-rpc');
    const message = body as Record<string, unknown>;
    if (!METHODS.includes(String(message.method))) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
      res.end(JSON.stringify({ jsonrpc: '2.0', id: typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null, error: { code: -32601, message: 'This MCP operation is not supported.' } })); return;
    }
    const tool = message.method === 'tools/call' && message.params && typeof message.params === 'object' ? (message.params as Record<string, unknown>).name : undefined;
    if (typeof tool === 'string' && HEAVY_TOOLS.has(tool)) {
      verdict = await limited(rateLimit, req, EVENTS_RATE_LIMIT_ID);
      if (verdict !== 'allowed') return send(res, verdict === 'limited' ? 429 : 503, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', verdict === 'limited' ? 60 : 300);
    }
    const sdk = createMcpHandler(() => createEngineServer(options), { legacy: 'stateless', responseMode: 'auto', onerror: () => {} });
    try {
      const headers = new Headers();
      for (const key of ['content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'mcp-method', 'mcp-name']) {
        if (typeof req.headers?.[key] === 'string') headers.set(key, req.headers[key]);
      }
      const request = new Request(`${ORIGIN}${ENGINE_MCP_PATH}`, { method: 'POST', headers, body: text });
      const response = await sdk.fetch(request, { parsedBody: body });
      const reply = response.body ? await response.text() : '';
      if (Buffer.byteLength(reply) > MAX_ENGINE_REPLY_BYTES) throw new Error('output-budget');
      res.statusCode = response.status;
      response.headers.forEach((value, key) => { if (!['cache-control', 'content-length', 'access-control-allow-origin'].includes(key)) res.setHeader(key, value); });
      if (reply) res.write(reply);
      res.end();
    } catch { if (!res.headersSent) send(res, 500, 'protocol-failed'); else res.end(); }
    finally { await sdk.close().catch(() => {}); }
  };
}
