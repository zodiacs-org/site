import { createMcpHandler } from '@modelcontextprotocol/server';
import { COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, type RateLimitVerdict } from '../lib/compute-api/constants';
import { computeApiRateLimit } from '../lib/compute-api/handler';
import * as localTime from '../../api/_compute/local-time.mjs';
import { AI_ROUTE_PARAM, AI_SWITCH_ENV, AI_VERSION, MAX_HTTP_BYTES, ORIGIN } from './contracts';
import { createAiServer } from './server';
import type { AiDependencies } from './tools';
import { sanitizeProtocolMessage } from './sanitize';
import { reserveAiQuota, type QuotaKind } from './quota';

const ALLOWED_ORIGINS = new Set(['https://chatgpt.com', 'https://chat.openai.com', ORIGIN]);
const SECURITY_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
let handledPreviewRequests = 0;

export interface AiHttpOptions {
  env?: Readonly<Record<string, string | undefined>>;
  /** Local tests/dev explicitly inject limits; production uses the existing Firewall. */
  rateLimit?: (req: any, id: string) => Promise<RateLimitVerdict>;
  /** Explicit injection for loopback tests only; deployment always uses atomic RPC. */
  atomicQuota?: (kind: QuotaKind) => Promise<RateLimitVerdict>;
  dependencies?: AiDependencies;
  /** Explicit loopback/preview hostnames for local tests. Production defaults to zodiacs.org. */
  allowedHosts?: readonly string[];
}

function send(res: any, status: number, code: string, retry?: number) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (retry) res.setHeader('Retry-After', String(retry));
  res.end(JSON.stringify({ error: { code, message: 'The MCP request cannot be served under its method, schema or availability requirements.' } }));
}

async function readBody(req: any): Promise<string> {
  if (req.body !== undefined) {
    const bytes = typeof req.body === 'string' ? Buffer.from(req.body) : Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
    if (bytes.length > MAX_HTTP_BYTES) throw new Error('payload-too-large');
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  }
  const chunks: Buffer[] = [];
  let total = 0;
  let tooLarge = false;
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += part.length;
    if (total > MAX_HTTP_BYTES) { tooLarge = true; chunks.length = 0; continue; }
    chunks.push(part);
  }
  if (tooLarge) throw new Error('payload-too-large');
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, total));
}

/** Stateless HTTP transport, no user store, outbound proxy or argument logging. */
export function createAiNodeHandler(options: AiHttpOptions = {}) {
  return async (req: any, res: any): Promise<void> => {
    const env = options.env ?? process.env;
    // Opt-in preview diagnostics contain only enum names and measurements.
    // Process CPU is attributable only during an isolated sequential drive.
    const measure = env.VERCEL_ENV === 'preview' && env.ZODIACS_MCP_MEASURE === '1';
    const started = measure ? performance.now() : 0;
    const cpu = measure ? process.cpuUsage() : undefined;
    const firstHandledRequest = measure ? handledPreviewRequests++ === 0 : false;
    let operation = 'protocol';
    try {
    const method = req.method ?? 'GET';
    const host = req.headers?.host;
    // Staging is an exact administrator-configured hostname, never a header-derived wildcard.
    const stagingHost = env.ZODIACS_MCP_STAGING_HOST;
    const validStagingHost = stagingHost && stagingHost.length <= 253 && stagingHost.includes('.') && stagingHost.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
    const allowedHosts = options.allowedHosts ?? ['zodiacs.org', 'www.zodiacs.org', ...(validStagingHost ? [stagingHost] : [])];
    if (typeof host !== 'string' || !allowedHosts.includes(host.toLowerCase())) return send(res, 403, 'host-not-allowed');
    const origin = req.headers?.origin;
    if (origin !== undefined && (typeof origin !== 'string' || !ALLOWED_ORIGINS.has(origin))) return send(res, 403, 'origin-not-allowed');
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, MCP-Method, MCP-Name');
      res.statusCode = 204; res.end(); return;
    }
    let rawQuery: URLSearchParams;
    try { rawQuery = new URL(req.url ?? '/mcp', ORIGIN).searchParams; }
    catch { return send(res, 400, 'invalid-query'); }
    if ([...rawQuery.keys()].some(key => key !== AI_ROUTE_PARAM) || rawQuery.getAll(AI_ROUTE_PARAM).length > 1) return send(res, 400, 'invalid-query');
    const query = req.query ?? Object.fromEntries(rawQuery);
    if (Object.keys(query).some(key => key !== AI_ROUTE_PARAM) || (query[AI_ROUTE_PARAM] !== undefined && !['1', 'health'].includes(query[AI_ROUTE_PARAM]))) return send(res, 400, 'invalid-query');
    if (method !== 'POST' && !(method === 'GET' && query[AI_ROUTE_PARAM] === 'health')) {
      res.setHeader('Allow', 'POST, OPTIONS'); return send(res, 405, 'method-not-allowed');
    }
    if (env[AI_SWITCH_ENV] !== '1') return send(res, 503, 'disabled', 3600);
    const atomicQuota = options.atomicQuota ?? (kind => reserveAiQuota(kind, env));
    const rateLimit = options.rateLimit ?? computeApiRateLimit;
    let verdict: RateLimitVerdict;
    try { verdict = await rateLimit(req, COMPUTE_RATE_LIMIT_ID); } catch { verdict = 'unavailable'; }
    if (verdict !== 'allowed') return send(res, verdict === 'limited' ? 429 : 503, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', verdict === 'limited' ? 60 : 300);
    try { verdict = await atomicQuota('request'); } catch { verdict = 'unavailable'; }
    if (verdict !== 'allowed') return send(res, verdict === 'limited' ? 429 : 503, verdict === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', verdict === 'limited' ? 60 : 300);
    if (method === 'GET') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
      res.end(JSON.stringify({ service: 'zodiacs-mcp', version: AI_VERSION, transport: 'stateless-streamable-http', ready: true })); return;
    }
    const contentType = req.headers?.['content-type'];
    if (typeof contentType !== 'string' || !/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?\s*$/i.test(contentType) || (req.headers?.['content-encoding'] && req.headers['content-encoding'] !== 'identity')) return send(res, 415, 'unsupported-media-type');
    const length = req.headers?.['content-length'];
    if (length !== undefined && (typeof length !== 'string' || !/^\d+$/.test(length))) return send(res, 400, 'invalid-length');
    if (length !== undefined && Number(length) > MAX_HTTP_BYTES) return send(res, 413, 'payload-too-large');
    let text: string;
    let body: unknown;
    try { text = await readBody(req); body = JSON.parse(text); }
    catch (error) { return send(res, error instanceof Error && error.message === 'payload-too-large' ? 413 : 400, error instanceof Error && error.message === 'payload-too-large' ? 'payload-too-large' : 'invalid-json'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, 'invalid-json-rpc');
    const message = body as Record<string, unknown>;
    if (message.method === 'tools/call' && message.params && typeof message.params === 'object') {
      const name = (message.params as Record<string, unknown>).name;
      if (['get_capabilities', 'get_sky', 'get_upcoming_events', 'check_sky_fact', 'search_zodiacs'].includes(String(name))) operation = String(name);
    }
    if (!['initialize', 'notifications/initialized', 'ping', 'server/discover', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'resources/templates/list'].includes(String(message.method))) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
      res.end(JSON.stringify({ jsonrpc: '2.0', id: typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null, error: { code: -32601, message: 'This MCP operation is not supported.' } })); return;
    }
    const dependencies: AiDependencies = { ...(options.dependencies ?? { localTime }), allowEvents: async () => {
      try {
        const addressVerdict = await rateLimit(req, COMPUTE_EVENTS_RATE_LIMIT_ID);
        return addressVerdict === 'allowed' ? await atomicQuota('event') : addressVerdict;
      } catch { return 'unavailable'; }
    } };
    const sdk = createMcpHandler(() => createAiServer(dependencies), { legacy: 'stateless', responseMode: 'auto', onerror: () => {} });
    try {
      const headers = new Headers();
      for (const key of ['content-type', 'accept', 'mcp-protocol-version', 'mcp-session-id', 'mcp-method', 'mcp-name']) {
        if (typeof req.headers?.[key] === 'string') headers.set(key, req.headers[key]);
      }
      const request = new Request(`${ORIGIN}/mcp`, { method: 'POST', headers, body: text });
      const response = await sdk.fetch(request, { parsedBody: body });
      res.statusCode = response.status;
      response.headers.forEach((value, key) => { if (!['cache-control', 'content-length', 'access-control-allow-origin'].includes(key)) res.setHeader(key, value); });
      if (response.body) {
        // Single-result JSON/SSE responses let us suppress SDK validation diagnostics
        // which may repeat unknown property names. Neither logs nor refusals quote inputs.
        const reply = await response.text();
        if (Buffer.byteLength(reply) > 262144) throw new Error('output-budget');
        function sanitize(text: string) {
          return JSON.stringify(sanitizeProtocolMessage(JSON.parse(text)));
        }
        let safeReply = reply;
        if (response.headers.get('content-type')?.includes('text/event-stream')) {
          safeReply = reply.split('\n').map(line => line.startsWith('data: ') ? `data: ${sanitize(line.slice(6))}` : line).join('\n');
        } else if (reply.trim()) safeReply = sanitize(reply);
        res.write(safeReply);
      }
      res.end();
    } catch { if (!res.headersSent) send(res, 500, 'protocol-failed'); else res.end(); }
    finally { await sdk.close().catch(() => {}); }
    } finally {
      if (measure && cpu) {
        const used = process.cpuUsage(cpu);
        console.info(JSON.stringify({ measurement: 'zodiacs.mcp.resources.v1', operation, elapsedMs: Math.round((performance.now() - started) * 100) / 100, processCpuMs: Math.round((used.user + used.system) / 10) / 100, firstHandledRequest, status: res.statusCode }));
      }
    }
  };
}
