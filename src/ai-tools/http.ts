import { createMcpHandler } from '@modelcontextprotocol/server';
import { COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, type RateLimitVerdict } from '../lib/compute-api/constants';
import { computeApiRateLimit } from '../lib/compute-api/handler';
import { AI_TOOL_NAMES, HOROSCOPE_URI, STUDIO_URI, LEGACY_STUDIO_URI, AI_ROUTE_PARAM, AI_SWITCH_ENV, AI_VERSION, MAX_HTTP_BYTES, ORIGIN, type AiToolName } from './contracts';
import { createAiServer } from './server';
import type { AiDependencies } from './tools';
import { sanitizeProtocolMessage } from './sanitize';
import { reserveAiQuota, type QuotaKind } from './quota';
import { countAiToolCall, usageHostFamily, type UsageHost } from './usage';
import { configuredSkyWatch, type SkyWatch } from './watch/service';

// Browser-side MCP clients of the assistants Zodiacs is listed in, and the site itself.
const ALLOWED_ORIGINS = new Set(['https://chatgpt.com', 'https://chat.openai.com', 'https://claude.ai', 'https://claude.com', ORIGIN]);
const SECURITY_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' };
let handledPreviewRequests = 0;
/** Plain refusals; none repeats anything from the request. */
const REFUSALS: Record<string, string> = {
  'rate-limited': 'Zodiacs is busy. Try again in a minute.',
  'rate-limit-unavailable': 'Zodiacs is busy. Try again in a few minutes.',
  disabled: 'Zodiacs is not available right now. Try again later.',
  'payload-too-large': 'That request is too large for Zodiacs.',
};

export interface AiHttpOptions {
  env?: Readonly<Record<string, string | undefined>>;
  /** Local tests/dev explicitly inject limits; production uses the existing Firewall. */
  rateLimit?: (req: any, id: string) => Promise<RateLimitVerdict>;
  /** Explicit injection for loopback tests only; deployment always uses atomic RPC. */
  atomicQuota?: (kind: QuotaKind) => Promise<RateLimitVerdict>;
  dependencies?: AiDependencies;
  /** Explicit loopback/preview hostnames for local tests. Production defaults to zodiacs.org. */
  allowedHosts?: readonly string[];
  /** Isolated protocol tests inject a store-backed preview service. */
  skyWatch?: SkyWatch;
  /** Explicit injection for loopback tests only; deployment adds one to the anonymous daily usage counter. */
  countUsage?: (tool: AiToolName, host: UsageHost) => Promise<unknown>;
  /** The platform hook that lets a count started after the reply finish (Vercel's waitUntil). Without it the count runs detached. */
  waitUntil?: (task: Promise<unknown>) => void;
}

/** One count per handled tool call, started after its reply has ended. Only the
 * tool name and the coarse host family are passed on. It never throws, waits or
 * changes a reply; every failure is dropped.
 */
function countAfterReply(options: AiHttpOptions, env: Readonly<Record<string, string | undefined>>, tool: AiToolName, userAgent: unknown) {
  try {
    const count = options.countUsage ?? ((name: AiToolName, host: UsageHost) => countAiToolCall(name, host, env));
    const settled = Promise.resolve(count(tool, usageHostFamily(userAgent))).then(() => undefined, () => undefined);
    options.waitUntil?.(settled);
  } catch { /* Counting never affects a reply. */ }
}

function send(res: any, status: number, code: string, retry?: number) {
  res.statusCode = status;
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (retry) res.setHeader('Retry-After', String(retry));
  res.end(JSON.stringify({ error: { code, message: REFUSALS[code] ?? 'Zodiacs could not accept this request.' } }));
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

/** Stateless transport; optional authenticated Sky Watch uses its own durable store. */
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
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, MCP-Method, MCP-Name');
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
    let watch: { service: SkyWatch; owner: import('./watch/contracts').Principal } | undefined;
    try {
      const service = options.skyWatch ?? configuredSkyWatch(env);
      if (service) {
        const owner = await service.authenticate(req.headers?.authorization);
        if (!owner) { res.setHeader('WWW-Authenticate', service.oauth?.challenge ?? 'Bearer realm="Zodiacs Sky Watch preview"'); return send(res, 401, 'authentication-required'); }
        watch = { service, owner };
      }
    } catch { return send(res, 503, 'watch-unavailable'); }
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
    let calledTool: AiToolName | undefined;
    if (message.method === 'tools/call' && message.params && typeof message.params === 'object') {
      const name = (message.params as Record<string, unknown>).name;
      if ((AI_TOOL_NAMES as readonly string[]).includes(String(name))) operation = String(name);
      if (typeof name === 'string' && name === operation) calledTool = name as AiToolName;
    }
    const watchMethod = ['events/list', 'events/subscribe', 'events/unsubscribe'].includes(String(message.method));
    if (watch && watchMethod && req.headers?.['mcp-protocol-version'] !== '2026-07-28') return send(res, 400, 'event-protocol-required');
    if (!['initialize', 'notifications/initialized', 'ping', 'server/discover', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'resources/templates/list', ...(watch ? ['events/list', 'events/subscribe', 'events/unsubscribe'] : [])].includes(String(message.method))) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
      res.end(JSON.stringify({ jsonrpc: '2.0', id: typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null, error: { code: -32601, message: 'This MCP operation is not supported.' } })); return;
    }
    const dependencies: AiDependencies = { ...(options.dependencies ?? {}), allowEvents: async () => {
      try {
        const addressVerdict = await rateLimit(req, COMPUTE_EVENTS_RATE_LIMIT_ID);
        return addressVerdict === 'allowed' ? await atomicQuota('event') : addressVerdict;
      } catch { return 'unavailable'; }
    } };
    const sdk = createMcpHandler(() => createAiServer(dependencies, watch), { legacy: 'stateless', responseMode: 'auto', onerror: () => {} });
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
        // Only the fixed, self-contained panel resources have a larger response budget.
        const resourceUri = (message.params as { uri?: unknown })?.uri;
        const panelResource = message.method === 'resources/read' && (resourceUri === STUDIO_URI || resourceUri === LEGACY_STUDIO_URI || resourceUri === HOROSCOPE_URI);
        if (Buffer.byteLength(reply) > (panelResource ? 2_100_000 : 262144)) throw new Error('output-budget');
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
    finally {
      // The reply has ended: count the call once, including an error result.
      if (calledTool) countAfterReply(options, env, calledTool, req.headers?.['user-agent']);
      await sdk.close().catch(() => {});
    }
    } finally {
      if (measure && cpu) {
        const used = process.cpuUsage(cpu);
        console.info(JSON.stringify({ measurement: 'zodiacs.mcp.resources.v1', operation, elapsedMs: Math.round((performance.now() - started) * 100) / 100, processCpuMs: Math.round((used.user + used.system) / 10) / 100, firstHandledRequest, status: res.statusCode }));
      }
    }
  };
}
