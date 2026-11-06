import { createMcpHandler } from '@modelcontextprotocol/server';
import { COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, type RateLimitVerdict } from '../lib/compute-api/constants';
import { computeApiRateLimit } from '../lib/compute-api/handler';
import { AI_TOOL_NAMES, ALL_AI_TOOL_NAMES, COVERAGE_SWITCH_ENV, COVERAGE_TOOL_NAMES, EVERY_AI_TOOL_NAME, OCCASIONS_SWITCH_ENV, HOROSCOPE_URI, PLACE_TOOL_NAMES, SKY_EVENTS_SWITCH_ENV, SKY_EVENTS_TOOL_NAMES, STUDIO_URI, LEGACY_HOROSCOPE_URIS, LEGACY_OCCASIONS_URIS, LEGACY_STUDIO_URIS, OCCASIONS_URI, READINGS_SKY_EVENTS_URI, READINGS_URI, AI_ROUTE_PARAM, AI_SWITCH_ENV, AI_VERSION, MAX_HTTP_BYTES, ORIGIN, inputSchemaFor, type AiToolName, type CoverageToolName, type PlaceToolName, type SkyEventsToolName } from './contracts';
import { createAiServer } from './server';
import { coverageInputRefusal, isSkyEventsTool, normaliseCoverageCall, type AiDependencies } from './tools';
import { sanitizeProtocolMessage } from './sanitize';
import { argumentRefusal } from './argument-hints';
import { reserveAiQuota, type QuotaKind } from './quota';
import { countAiToolCall, usageHostFamily, type UsageHost } from './usage';
import { configuredSkyWatch, type SkyWatch } from './watch/service';
import { SAVE_TOOL_NAME } from './accounts/contracts';
import { accountsEnabled, configuredAccounts, invalidTokenChallenge, type AccountsService } from './accounts/service';
import type { AccountContext } from './server';
import type { CountedToolName } from './usage';

/** The self-contained panels whose resources may exceed the usual reply budget. */
const LARGE_PANEL_URIS: ReadonlySet<string> = new Set([STUDIO_URI, ...LEGACY_STUDIO_URIS, HOROSCOPE_URI, ...LEGACY_HOROSCOPE_URIS, OCCASIONS_URI, ...LEGACY_OCCASIONS_URIS, READINGS_URI, READINGS_SKY_EVENTS_URI]);

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
  'authentication-required': 'Sign in to your Zodiacs account again.',
  'not-found': 'Zodiacs has nothing at this address.',
};
/** The account routes: protected-resource metadata and the sign-in consent page. Only while accounts are on. */
const ACCOUNT_ROUTES = ['resource', 'consent'];

/** The generated consent page (integrations/generated/accounts-consent.mjs), loaded only when it is asked for. */
export interface ConsentPage { CONSENT_HTML: string; CONSENT_SCRIPT_HASH: string; CONSENT_STYLE_HASH: string }

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
  countUsage?: (tool: CountedToolName, host: UsageHost) => Promise<unknown>;
  /** Isolated tests inject an account service; deployment builds it from ZODIACS_ACCOUNTS_ENABLED and its settings. */
  accounts?: AccountsService;
  /** The consent page loader; the deployed handler imports the generated page on demand. */
  consentPage?: () => Promise<ConsentPage>;
  /** The platform hook that lets a count started after the reply finish (Vercel's waitUntil). Without it the count runs detached. */
  waitUntil?: (task: Promise<unknown>) => void;
}

/** One count per handled tool call, started after its reply has ended. Only the
 * tool name and the coarse host family are passed on. It never throws, waits or
 * changes a reply; every failure is dropped.
 */
function countAfterReply(options: AiHttpOptions, env: Readonly<Record<string, string | undefined>>, tool: CountedToolName, userAgent: unknown) {
  try {
    const count = options.countUsage ?? ((name: CountedToolName, host: UsageHost) => countAiToolCall(name, host, env));
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
    const accountsOn = accountsEnabled(env);
    const routeValue = typeof req.query?.[AI_ROUTE_PARAM] === 'string' ? req.query[AI_ROUTE_PARAM] : rawQuery.get(AI_ROUTE_PARAM);
    // The account routes do not exist while accounts are off.
    if (typeof routeValue === 'string' && ACCOUNT_ROUTES.includes(routeValue) && !accountsOn) return send(res, 404, 'not-found');
    // The consent page alone also receives the provider's authorization request ID.
    const extraKeys = accountsOn && routeValue === 'consent' ? ['authorization_id'] : [];
    const allowedKey = (key: string) => key === AI_ROUTE_PARAM || extraKeys.includes(key);
    if ([...rawQuery.keys()].some(key => !allowedKey(key)) || rawQuery.getAll(AI_ROUTE_PARAM).length > 1 || extraKeys.some(key => rawQuery.getAll(key).length > 1)) return send(res, 400, 'invalid-query');
    const query = req.query ?? Object.fromEntries(rawQuery);
    if (Object.keys(query).some(key => !allowedKey(key)) || (query[AI_ROUTE_PARAM] !== undefined && !['1', 'health', ...(accountsOn ? ACCOUNT_ROUTES : [])].includes(query[AI_ROUTE_PARAM]))) return send(res, 400, 'invalid-query');
    if (query.authorization_id !== undefined && (typeof query.authorization_id !== 'string' || !/^[A-Za-z0-9_-]{8,256}$/.test(query.authorization_id))) return send(res, 400, 'invalid-query');
    const accountRoute = accountsOn && ACCOUNT_ROUTES.includes(query[AI_ROUTE_PARAM]);
    if (accountRoute && method !== 'GET') { res.setHeader('Allow', 'GET'); return send(res, 405, 'method-not-allowed'); }
    if (method !== 'POST' && !(method === 'GET' && (query[AI_ROUTE_PARAM] === 'health' || accountRoute))) {
      res.setHeader('Allow', 'POST, OPTIONS'); return send(res, 405, 'method-not-allowed');
    }
    if (env[AI_SWITCH_ENV] !== '1') return send(res, 503, 'disabled', 3600);
    const atomicQuota = options.atomicQuota ?? (kind => reserveAiQuota(kind, env));
    const rateLimit = options.rateLimit ?? computeApiRateLimit;
    // Every request is counted against the per-address rule, before any authentication, as it always was: it bounds
    // what one address can pull, panels included. The service-wide request budget counts only tool calls and the
    // health check. Connecting, listing tools and reading panel resources are left out of it: assistants sharing
    // provider addresses send many of those when chats open, and counting them used up the minute's budget before
    // anyone had asked a question (5 November 2026).
    let verdict: RateLimitVerdict;
    const refuse = (kind: RateLimitVerdict) => send(res, kind === 'limited' ? 429 : 503, kind === 'limited' ? 'rate-limited' : 'rate-limit-unavailable', kind === 'limited' ? 60 : 300);
    const countRequest = async (): Promise<RateLimitVerdict> => { try { return await atomicQuota('request'); } catch { return 'unavailable'; } };
    try { verdict = await rateLimit(req, COMPUTE_RATE_LIMIT_ID); } catch { verdict = 'unavailable'; }
    if (verdict !== 'allowed') return refuse(verdict);
    if (accountRoute) return serveAccountRoute(res, query[AI_ROUTE_PARAM], options, env);
    let watch: { service: SkyWatch; owner: import('./watch/contracts').Principal } | undefined;
    try {
      const service = options.skyWatch ?? configuredSkyWatch(env);
      if (service) {
        const owner = await service.authenticate(req.headers?.authorization);
        if (!owner) { res.setHeader('WWW-Authenticate', service.oauth?.challenge ?? 'Bearer realm="Zodiacs Sky Watch preview"'); return send(res, 401, 'authentication-required'); }
        watch = { service, owner };
      }
    } catch { return send(res, 503, 'watch-unavailable'); }
    // Mixed authentication: a request without a token stays anonymous; a token that is present must be valid.
    let account: AccountContext | undefined;
    if (accountsOn) {
      let service: AccountsService | undefined;
      try { service = options.accounts ?? configuredAccounts(env); } catch { return send(res, 503, 'accounts-unavailable'); }
      if (service) {
        const header = req.headers?.authorization;
        let principal: AccountContext['principal'] = null;
        if (header !== undefined) {
          try { principal = typeof header === 'string' && header.startsWith('Bearer ') ? await service.oauth.authenticate(header.slice(7)) : null; }
          catch { return send(res, 503, 'accounts-unavailable'); }
          if (!principal) {
            res.setHeader('WWW-Authenticate', invalidTokenChallenge(service.oauth));
            res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
            return send(res, 401, 'authentication-required');
          }
        }
        account = { service, principal };
      }
    }
    if (method === 'GET') {
      verdict = await countRequest(); if (verdict !== 'allowed') return refuse(verdict);
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
    catch (error) {
      if (error instanceof Error && error.message === 'payload-too-large') return send(res, 413, 'payload-too-large');
      // Unparseable JSON gets the JSON-RPC parse error a client library expects.
      res.statusCode = 400; for (const [key, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(key, value);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error: the body is not valid JSON.', data: { code: 'invalid-json' } } })); return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return send(res, 400, 'invalid-json-rpc');
    const message = body as Record<string, unknown>;
    // Compared as the method allowlist below compares it, so no spelling of a tool call escapes the budget.
    if (String(message.method) === 'tools/call') { verdict = await countRequest(); if (verdict !== 'allowed') return refuse(verdict); }
    // The sky events switch is read as the coverage and occasion switches are, and counts only with both of them on.
    const skyEvents = env[OCCASIONS_SWITCH_ENV] === '1' && env[COVERAGE_SWITCH_ENV] === '1' && env[SKY_EVENTS_SWITCH_ENV] === '1';
    let calledTool: CountedToolName | undefined;
    if (message.method === 'tools/call' && message.params && typeof message.params === 'object') {
      const name = (message.params as Record<string, unknown>).name;
      // Only offered tools are counted: the occasion tools count only while their switch is on, the save tool only with accounts.
      const offered: readonly string[] = env[OCCASIONS_SWITCH_ENV] === '1' ? [...(env[COVERAGE_SWITCH_ENV] === '1' ? EVERY_AI_TOOL_NAME : ALL_AI_TOOL_NAMES), ...(skyEvents ? SKY_EVENTS_TOOL_NAMES : []), ...(account ? [SAVE_TOOL_NAME] : [])] : AI_TOOL_NAMES;
      if (offered.includes(String(name))) operation = String(name);
      if (typeof name === 'string' && name === operation) calledTool = name as CountedToolName;
    }
    // get_upcoming_events also takes plain YYYY-MM-DD bounds: from becomes that day's
    // start and to that day's end in UTC, before the unchanged input schema sees them.
    if (calledTool === 'get_upcoming_events') {
      const args = (message.params as Record<string, unknown>).arguments as Record<string, unknown> | undefined;
      let changed = false;
      for (const [key, clock] of [['from', 'T00:00:00Z'], ['to', 'T23:59:59Z']] as const) {
        if (args && typeof args[key] === 'string' && /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/.test(args[key] as string)) { args[key] = `${args[key]}${clock}`; changed = true; }
      }
      if (changed) text = JSON.stringify(body);
    }
    // A 0.6.0 tool's sign arrives as written ("Leo"); it is lower-cased before the SDK checks the published enum.
    if (calledTool && normaliseCoverageCall(body)) text = JSON.stringify(body);
    const refusal = calledTool ? argumentRefusal(calledTool, (message.params as Record<string, unknown>).arguments, calledTool === SAVE_TOOL_NAME ? undefined : inputSchemaFor(calledTool, skyEvents)) : undefined;
    const watchMethod = ['events/list', 'events/subscribe', 'events/unsubscribe'].includes(String(message.method));
    if (watch && watchMethod && req.headers?.['mcp-protocol-version'] !== '2026-07-28') return send(res, 400, 'event-protocol-required');
    if (!['initialize', 'notifications/initialized', 'ping', 'server/discover', 'tools/list', 'tools/call', 'resources/list', 'resources/read', 'resources/templates/list', ...(watch ? ['events/list', 'events/subscribe', 'events/unsubscribe'] : [])].includes(String(message.method))) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
      res.end(JSON.stringify({ jsonrpc: '2.0', id: typeof message.id === 'string' || typeof message.id === 'number' ? message.id : null, error: { code: -32601, message: 'This MCP operation is not supported.' } })); return;
    }
    const dependencies: AiDependencies = { ...(options.dependencies ?? {}), ...(env[OCCASIONS_SWITCH_ENV] === '1' ? { occasions: true, ...(env[COVERAGE_SWITCH_ENV] === '1' ? { coverage: true } : {}) } : {}), ...(skyEvents ? { skyEvents: true } : {}), ...(account ? { accounts: true } : {}), allowEvents: async () => {
      try {
        const addressVerdict = await rateLimit(req, COMPUTE_EVENTS_RATE_LIMIT_ID);
        return addressVerdict === 'allowed' ? await atomicQuota('event') : addressVerdict;
      } catch { return 'unavailable'; }
    } };
    const sdk = createMcpHandler(() => createAiServer(dependencies, watch, account), { legacy: 'stateless', responseMode: 'auto', onerror: () => {} });
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
        const panelResource = message.method === 'resources/read' && typeof resourceUri === 'string' && LARGE_PANEL_URIS.has(resourceUri);
        if (Buffer.byteLength(reply) > (panelResource ? 2_100_000 : 262144)) throw new Error('output-budget');
        function sanitize(text: string) {
          const parsed = JSON.parse(text);
          // A 0.6.0 tool's or search_sky_events' arguments refused by the SDK's schema check get the tool's own field-named refusal.
          const named = calledTool && ((COVERAGE_TOOL_NAMES as readonly string[]).includes(calledTool) || (PLACE_TOOL_NAMES as readonly string[]).includes(calledTool) || isSkyEventsTool(calledTool)) && parsed.result?.isError && !parsed.result?.structuredContent
            ? coverageInputRefusal(calledTool as CoverageToolName | PlaceToolName | SkyEventsToolName, (message.params as { arguments?: unknown }).arguments, inputSchemaFor(calledTool as AiToolName, skyEvents)) : null;
          if (named) return JSON.stringify({ ...parsed, result: { isError: true, content: [{ type: 'text', text: JSON.stringify(named) }], structuredContent: named } });
          return JSON.stringify(sanitizeProtocolMessage(parsed, refusal));
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

/**
 * Protected-resource metadata (RFC 9728) and the consent page Supabase's OAuth
 * server sends the person to. Neither reads a token or stores anything.
 */
async function serveAccountRoute(res: any, route: string, options: AiHttpOptions, env: Readonly<Record<string, string | undefined>>) {
  let service: AccountsService | undefined;
  try { service = options.accounts ?? configuredAccounts(env); } catch { /* refused below */ }
  if (!service) return send(res, 503, 'accounts-unavailable');
  if (route === 'resource') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.statusCode = 200;
    res.end(JSON.stringify(service.oauth.metadata)); return;
  }
  let page: ConsentPage;
  try {
    if (!options.consentPage) throw new Error('unavailable');
    page = await options.consentPage();
  } catch { return send(res, 503, 'accounts-unavailable'); }
  // The page reads its settings from an inert JSON block; < is escaped so it can never close the element.
  const config = JSON.stringify({ url: service.supabaseUrl, key: service.publishableKey, clients: service.clients,
    ...(service.previewWatchClients?.length ? { previewWatchClients: service.previewWatchClients } : {}) }).replace(/</g, '\\u003c');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', `default-src 'none'; script-src '${page.CONSENT_SCRIPT_HASH}'; style-src '${page.CONSENT_STYLE_HASH}'; connect-src ${service.supabaseUrl}; img-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`);
  res.end(page.CONSENT_HTML.replace('<script type="application/json" id="zodiacs-consent-config"></script>', `<script type="application/json" id="zodiacs-consent-config">${config}</script>`));
}
