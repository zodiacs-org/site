/**
 * The compute API's HTTP boundary, which vercel.json reaches from seven paths
 * under /api/v1/ through the existing compatibility function
 * (api/compatibility.ts hands the request to api/_compute/handler.ts).
 *
 * In order, every request is: routed by the rewrite's own parameter (the only
 * part of a query string read); answered at once if it is a CORS preflight;
 * refused unless it is a POST; refused while COMPUTE_API_ENABLED is "0";
 * counted against the per-address rate limits, and refused unless the
 * Firewall counted and allowed it; read as at most 16 KB of JSON; validated
 * strictly; and calculated within its budget.
 *
 * Nothing here writes to a log, a file or a store, and no error repeats a
 * value from the request: every refusal is a fixed sentence from errors.ts.
 * Responses are never cacheable.
 */
import { checkRateLimit } from '@vercel/firewall';
import {
  COMPUTE_ENDPOINTS,
  COMPUTE_RATE_LIMIT_ID,
  COMPUTE_ROUTE_PARAM,
  COMPUTE_SWITCH_ENV,
  MAX_BODY_BYTES,
  PREFLIGHT_HEADERS,
  RESPONSE_HEADERS,
  rateLimitIds,
  type ComputeEndpoint,
  type RateLimitVerdict,
} from './constants.js';
import {
  computeChart,
  computeEvents,
  computeHouses,
  computePositions,
  computeSkyFact,
  computeTime,
  type ComputeDependencies,
} from './endpoints.js';
import { computeElections } from './elections.js';
import {
  ComputeApiError,
  calculationFailed,
  disabled,
  invalidJson,
  methodNotAllowed,
  notFound,
  payloadTooLarge,
  rateLimitUnavailable,
  rateLimited,
  unsupportedMediaType,
} from './errors.js';
import type { LocalTimeModule } from './local-time.js';
import {
  parseElectionsRequest,
  parseEventsRequest,
  parsePlaceInstantRequest,
  parsePositionsRequest,
  parseSkyFactRequest,
  parseTimeRequest,
  type ZoneNames,
} from './validate.js';

export { PREFLIGHT_HEADERS, RESPONSE_HEADERS };

export type { RateLimitVerdict };

export interface ComputeHandlerOptions {
  localTime: LocalTimeModule;
  /** Defaults to process.env, read on each request. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Defaults to the Vercel Firewall checks below, under every rule the endpoint is counted by. */
  rateLimit?: (req: any, endpoint: ComputeEndpoint) => Promise<RateLimitVerdict>;
}

/**
 * One Firewall SDK check. Unlike the site's other endpoints, which let a
 * request through when their rule is missing, the compute endpoints fail
 * closed: a request is allowed only when the Firewall counted it under the
 * rule and let it through. A rule not yet published (`not-found`), an error
 * or an unexpected answer is `unavailable`, and so is any runtime where the
 * SDK does not ask the Firewall at all: outside NODE_ENV=production it lets
 * every request through without a count. The check sends the request's
 * headers, never its body.
 */
export async function computeApiRateLimit(req: any, id: string = COMPUTE_RATE_LIMIT_ID): Promise<RateLimitVerdict> {
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

/** Every rule an endpoint is counted under, in order; the first that does not allow the request decides. */
async function firewallVerdict(req: any, endpoint: ComputeEndpoint): Promise<RateLimitVerdict> {
  for (const id of rateLimitIds(endpoint)) {
    const verdict = await computeApiRateLimit(req, id);
    if (verdict !== 'allowed') return verdict;
  }
  return 'allowed';
}

function header(req: any, name: string): string | null | 'ambiguous' {
  let value: unknown;
  try {
    value = req?.headers?.[name];
  } catch {
    return 'ambiguous';
  }
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return 'ambiguous';
  return value;
}

function routeOf(req: any): ComputeEndpoint {
  let value: unknown;
  try {
    value = req?.query?.[COMPUTE_ROUTE_PARAM];
    if (value === undefined && typeof req?.url === 'string') {
      const values = new URL(req.url, 'http://localhost').searchParams.getAll(COMPUTE_ROUTE_PARAM);
      value = values.length === 1 ? values[0] : undefined;
    }
  } catch {
    value = undefined;
  }
  if (typeof value !== 'string' || !(COMPUTE_ENDPOINTS as readonly string[]).includes(value)) throw notFound();
  return value as ComputeEndpoint;
}

function isJsonContentType(value: string | null | 'ambiguous'): boolean {
  if (value === null || value === 'ambiguous') return false;
  const [type, ...parameters] = value.split(';');
  if (type.trim().toLowerCase() !== 'application/json') return false;
  if (parameters.length === 0) return true;
  return parameters.length === 1 && /^charset\s*=\s*(?:utf-8|"utf-8")$/iu.test(parameters[0].trim());
}

function isIdentityEncoding(value: string | null | 'ambiguous'): boolean {
  if (value === null) return true;
  if (value === 'ambiguous') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'identity';
}

function declaredLength(value: string | null | 'ambiguous'): number | null {
  if (value === null) return null;
  if (value === 'ambiguous' || !/^\d+$/u.test(value.trim())) throw invalidJson();
  const digits = value.trim().replace(/^0+(?=\d)/u, '');
  if (digits.length > String(MAX_BODY_BYTES).length || Number(digits) > MAX_BODY_BYTES) throw payloadTooLarge();
  return Number(digits);
}

/**
 * The raw body, at most MAX_BODY_BYTES. Vercel's runtime reads the body before
 * the handler runs and replays it through data/end listeners, as the Guide
 * endpoint relies on (src/lib/guide-server/handler.ts); every terminal
 * listener is attached before `data`, and a stream that was already consumed
 * without a replay fails closed on the next turn instead of hanging.
 */
function readRaw(req: any): Promise<Buffer> {
  if (typeof req?.on !== 'function') {
    const preset: unknown = req?.body;
    if (typeof preset === 'string') return Promise.resolve(Buffer.from(preset, 'utf8'));
    if (preset instanceof Uint8Array) return Promise.resolve(Buffer.from(preset));
    return Promise.reject(invalidJson());
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let tooLarge = false;
    let settled = false;
    let guard: ReturnType<typeof setImmediate> | null = null;
    const listeners: Array<[string, (...args: any[]) => void]> = [];
    const cleanup = () => {
      if (guard !== null) clearImmediate(guard);
      const remove = typeof req.off === 'function' ? req.off : typeof req.removeListener === 'function' ? req.removeListener : null;
      if (!remove) return;
      for (const [event, listener] of listeners) {
        try {
          remove.call(req, event, listener);
        } catch {
          // Replayed listeners may not be removable; nothing depends on it.
        }
      }
    };
    const settle = (outcome: Buffer | ComputeApiError) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (outcome instanceof ComputeApiError) reject(outcome);
      else resolve(outcome);
    };
    const onData = (chunk: unknown) => {
      if (settled || tooLarge) return;
      const part = typeof chunk === 'string' ? Buffer.from(chunk, 'utf8') : chunk instanceof Uint8Array ? Buffer.from(chunk) : null;
      if (!part) {
        settle(invalidJson());
        return;
      }
      total += part.byteLength;
      if (total > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(part);
    };
    const onEnd = () => settle(tooLarge ? payloadTooLarge() : Buffer.concat(chunks, total));
    const onFailure = () => settle(invalidJson());
    listeners.push(['end', onEnd], ['error', onFailure], ['aborted', onFailure], ['data', onData]);
    try {
      req.on('end', onEnd);
      req.on('error', onFailure);
      req.on('aborted', onFailure);
      req.on('data', onData);
      if (!settled && (req.readableEnded === true || req.complete === true || req.destroyed === true)) {
        guard = setImmediate(onFailure);
      }
    } catch {
      onFailure();
    }
  });
}

async function readJsonBody(req: any): Promise<unknown> {
  if (!isJsonContentType(header(req, 'content-type'))) throw unsupportedMediaType();
  if (!isIdentityEncoding(header(req, 'content-encoding'))) throw unsupportedMediaType();
  const declared = declaredLength(header(req, 'content-length'));
  const bytes = await readRaw(req);
  if (bytes.byteLength > MAX_BODY_BYTES) throw payloadTooLarge();
  if (declared !== null && declared !== bytes.byteLength) throw invalidJson();
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw invalidJson();
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw invalidJson();
  }
}

async function dispatch(endpoint: ComputeEndpoint, body: unknown, dependencies: ComputeDependencies, zones: ZoneNames): Promise<unknown> {
  switch (endpoint) {
    case 'chart': return computeChart(await parsePlaceInstantRequest(body, zones), dependencies);
    case 'houses': return computeHouses(await parsePlaceInstantRequest(body, zones), dependencies);
    case 'positions': return computePositions(parsePositionsRequest(body));
    case 'events': return computeEvents(parseEventsRequest(body));
    case 'time': return computeTime(await parseTimeRequest(body, zones), dependencies);
    case 'sky-fact': return computeSkyFact(await parseSkyFactRequest(body, zones), dependencies);
    case 'elections': return computeElections(parseElectionsRequest(body));
  }
}

function send(res: any, status: number, headers: Readonly<Record<string, string>>, body: string): void {
  res.statusCode = status;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(body);
}

export function createComputeApiHandler(options: ComputeHandlerOptions) {
  const dependencies: ComputeDependencies = { localTime: options.localTime };
  const zones: ZoneNames = (name) => options.localTime.canonicalZoneName(name);
  const rateLimit = options.rateLimit ?? firewallVerdict;

  return async function computeApiHandler(req: any, res: any): Promise<void> {
    let status = 200;
    let headers: Readonly<Record<string, string>> = RESPONSE_HEADERS;
    let text: string;
    try {
      const endpoint = routeOf(req);
      if (req?.method === 'OPTIONS') {
        send(res, 204, PREFLIGHT_HEADERS, '');
        return;
      }
      if (req?.method !== 'POST') throw methodNotAllowed();
      if ((options.env ?? process.env)[COMPUTE_SWITCH_ENV] === '0') throw disabled();
      // Fail closed: without a count from the Firewall nothing is read or computed.
      const verdict = await rateLimit(req, endpoint);
      if (verdict === 'limited') throw rateLimited();
      if (verdict !== 'allowed') throw rateLimitUnavailable();
      const body = await readJsonBody(req);
      text = JSON.stringify(await dispatch(endpoint, body, dependencies, zones));
    } catch (error) {
      const refusal = error instanceof ComputeApiError ? error : calculationFailed();
      status = refusal.status;
      headers = { ...RESPONSE_HEADERS, ...refusal.headers };
      text = JSON.stringify({ error: refusal.detail });
    }
    send(res, status, headers, text);
  };
}
