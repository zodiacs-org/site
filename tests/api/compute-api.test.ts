import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@vercel/firewall';
import {
  ENGINE_VERSION,
  HOUSE_SYSTEMS,
  moonPhase,
  natalChart,
  outsideReferenceSpan,
  positions,
  searchLongitudeCrossings,
  searchLongitudeCrossingsWith,
  type BodyName,
} from '@zodiacs/engine';
import { createNatalEnvelope } from '@zodiacs/engine/receipt';
import {
  BUDGETS,
  COMPUTE_ENDPOINTS,
  COMPUTE_EVENTS_RATE_LIMIT_ID,
  COMPUTE_FUNCTION_PATH,
  COMPUTE_RATE_LIMIT_ID,
  COMPUTE_ROUTE_PARAM,
  EVENT_BODIES,
  HOUSE_SYSTEM_NAMES,
  EVENT_KINDS,
  MAX_BODY_BYTES,
  PHASE_NAMES,
  PINNED_TZDB_RELEASE,
  POSITION_BODIES,
  SIGN_SLUGS,
  SKY_FACT_KINDS,
  type ComputeEndpoint,
} from '../../src/lib/compute-api/constants';
import { computeApiRateLimit, createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { VALIDATION_MESSAGES } from '../../src/lib/compute-api/validate';
import { prepareLocalTime, resolveLocalToUtc } from '../../src/lib/time/localToUtc';
import { run, type HarnessRequest } from '../../scripts/lib/compute-api-harness';
import compatibilityHandler from '../../api/compatibility.js';

vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }));

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
const call = (endpoint: ComputeEndpoint | null, body?: unknown, extra: Partial<HarnessRequest> = {}) =>
  run(handler, { endpoint, body, ...extra });
const DAY = 86_400_000;

/** RFC 8785 written independently of the handler: sorted keys, ECMAScript numbers and strings. */
function jcs(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${jcs((value as any)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function expectCommonHeaders(headers: Map<string, string>): void {
  expect(headers.get('cache-control')).toBe('no-store');
  expect(headers.get('access-control-allow-origin')).toBe('*');
  expect(headers.get('x-content-type-options')).toBe('nosniff');
  expect(headers.get('x-robots-tag')).toBe('noindex');
}

const CHART = { utc: '2000-01-01T12:00:00Z', latitude: 51.4779, longitude: -0.0015 };
const VALID: Record<ComputeEndpoint, Record<string, unknown>> = {
  chart: CHART,
  positions: { instants: ['2026-09-29T12:00:00Z'] },
  houses: CHART,
  events: { from: '2026-10-01T00:00:00Z', to: '2026-10-08T00:00:00Z', bodies: ['Sun'] },
  time: { local: { date: '2026-09-29', time: '12:00', zone: 'Europe/Paris' } },
  'sky-fact': { kind: 'sign', body: 'Sun', sign: 'libra', instant: '2026-09-29T12:00:00Z' },
};

beforeEach(() => {
  vi.mocked(checkRateLimit).mockReset();
  vi.unstubAllEnvs();
});

describe('compute API routing, methods and CORS', () => {
  it('serves only the six endpoints the rewrites name', async () => {
    for (const endpoint of COMPUTE_ENDPOINTS) expect((await call(endpoint, VALID[endpoint])).status).toBe(200);
    const missing = await call(null, CHART);
    expect(missing.status).toBe(404);
    expect(missing.json).toEqual({ error: { code: 'not-found', message: 'No compute endpoint is served at this address.' } });
    expect((await call('natal' as ComputeEndpoint, CHART)).status).toBe(404);
  });

  it('refuses every method but POST with 405 and Allow, and answers a preflight', async () => {
    for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE', 'TRACE']) {
      const response = await call('chart', undefined, { method, contentType: null });
      expect(response.status, method).toBe(405);
      expect(response.headers.get('allow')).toBe('POST, OPTIONS');
      expect(response.json.error.code).toBe('method-not-allowed');
      expectCommonHeaders(response.headers);
    }
    const preflight = await call('sky-fact', undefined, { method: 'OPTIONS', contentType: null, headers: {
      origin: 'https://example.test', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type',
    } });
    expect(preflight.status).toBe(204);
    expect(preflight.text).toBe('');
    expect(preflight.headers.get('access-control-allow-origin')).toBe('*');
    expect(preflight.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(preflight.headers.get('access-control-allow-headers')).toBe('Content-Type');
    expect(preflight.headers.get('access-control-max-age')).toBe('86400');
    expect(preflight.headers.get('cache-control')).toBe('no-store');
  });

  it('sends the same no-store and CORS headers with every answer', async () => {
    for (const endpoint of COMPUTE_ENDPOINTS) {
      const ok = await call(endpoint, VALID[endpoint]);
      expectCommonHeaders(ok.headers);
      expect(ok.headers.get('content-type')).toBe('application/json; charset=utf-8');
      expect(ok.headers.get('access-control-expose-headers')).toBe('Retry-After');
      const refused = await call(endpoint, { unknown: true });
      expectCommonHeaders(refused.headers);
    }
  });

  it('ignores the query string: extra parameters change nothing', async () => {
    const plain = await call('chart', CHART);
    const noisy = await call('chart', CHART, { query: { utc: '1999-01-01T00:00:00Z', latitude: '10', houseSystem: 'koch', debug: '1' } });
    expect(noisy.status).toBe(200);
    expect(noisy.text).toBe(plain.text);
    // A second copy of the route parameter is ambiguous and is refused as not found.
    const req: any = { method: 'POST', headers: {}, url: `${COMPUTE_FUNCTION_PATH}?${COMPUTE_ROUTE_PARAM}=chart&${COMPUTE_ROUTE_PARAM}=houses` };
    const res: any = { headers: new Map(), setHeader(k: string, v: string) { this.headers.set(k.toLowerCase(), v); }, end(t: string) { this.text = t; } };
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('compute API switch and rate limit', () => {
  it('turns off with COMPUTE_API_ENABLED=0 only, with 503 and Retry-After, and still answers preflights', async () => {
    const off = createComputeApiHandler({ localTime, env: { COMPUTE_API_ENABLED: '0' }, rateLimit: async () => 'allowed' });
    const refused = await run(off, { endpoint: 'positions', body: VALID.positions });
    expect(refused.status).toBe(503);
    expect(refused.headers.get('retry-after')).toBe('3600');
    expect(refused.json).toEqual({ error: {
      code: 'disabled', message: 'The compute API is switched off. Try again later.', retryAfterSeconds: 3600,
    } });
    expect((await run(off, { endpoint: 'positions', method: 'OPTIONS', contentType: null })).status).toBe(204);
    for (const value of [undefined, '', '1', 'false', 'no', '00', ' 0']) {
      const on = createComputeApiHandler({ localTime, env: value === undefined ? {} : { COMPUTE_API_ENABLED: value }, rateLimit: async () => 'allowed' });
      expect((await run(on, { endpoint: 'positions', body: VALID.positions })).status, String(value)).toBe(200);
    }
  });

  it('answers 429 with Retry-After when the Firewall rule limits the address', async () => {
    const limited = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'limited' });
    const response = await run(limited, { endpoint: 'chart', body: CHART });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.json.error).toEqual({
      code: 'rate-limited',
      message: 'Too many requests from this address. Try again after the interval in Retry-After.',
      retryAfterSeconds: 60,
    });
  });

  it('checks a rule with the headers only, and fails closed when it is missing, errors or is not consulted', async () => {
    const req = { headers: { host: 'zodiacs.org', 'x-real-ip': '203.0.113.9' } };
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: true });
    expect(await computeApiRateLimit(req)).toBe('limited');
    expect(checkRateLimit).toHaveBeenLastCalledWith(COMPUTE_RATE_LIMIT_ID, { headers: req.headers });
    expect(COMPUTE_RATE_LIMIT_ID).toBe('zodiacs-compute-api');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: true, error: 'blocked' } as never);
    expect(await computeApiRateLimit(req)).toBe('limited');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: false });
    expect(await computeApiRateLimit(req)).toBe('allowed');
    // The rule is not published: the SDK says so and lets the request through; the API does not.
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: false, error: 'not-found' } as never);
    expect(await computeApiRateLimit(req)).toBe('unavailable');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: true, error: 'not-found' } as never);
    expect(await computeApiRateLimit(req)).toBe('unavailable');
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new Error('network'));
    expect(await computeApiRateLimit(req)).toBe('unavailable');
    vi.mocked(checkRateLimit).mockResolvedValueOnce(undefined as never);
    expect(await computeApiRateLimit(req)).toBe('unavailable');
    // Outside production the SDK would let everything through without asking the Firewall.
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(checkRateLimit).mockClear();
    expect(await computeApiRateLimit(req)).toBe('unavailable');
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('answers 503 with Retry-After while the rate limit is not in place, and reads and computes nothing', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const calls: string[] = [];
    const watched = {
      ...localTime,
      prepareLocalTime: async (date: string, zone: string) => { calls.push('prepare'); return localTime.prepareLocalTime(date, zone); },
      canonicalZoneName: async (name: string) => { calls.push('zone'); return localTime.canonicalZoneName(name); },
    };
    const defaults = createComputeApiHandler({ localTime: watched, env: {} });
    for (const failure of [
      () => vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false, error: 'not-found' } as never),
      () => vi.mocked(checkRateLimit).mockRejectedValue(new Error('network')),
    ]) {
      failure();
      for (const endpoint of COMPUTE_ENDPOINTS) {
        const req = { endpoint, body: endpoint === 'time' ? VALID.time : VALID[endpoint] };
        const response = await run(defaults, req);
        expect(response.status, endpoint).toBe(503);
        expect(response.headers.get('retry-after')).toBe('300');
        expect(response.json).toEqual({ error: {
          code: 'rate-limit-unavailable',
          message: 'The compute API answers only while its rate limit is in place, and the limit could not be checked. Try again after the interval in Retry-After.',
          retryAfterSeconds: 300,
        } });
      }
    }
    expect(calls).toEqual([]);
    // The body is not read: a request stream that fails when read still gets the 503.
    const unread: any = { method: 'POST', headers: { 'content-type': 'application/json' }, query: { [COMPUTE_ROUTE_PARAM]: 'chart' },
      on: () => { throw new Error('the body was read'); } };
    const res: any = { headers: new Map(), setHeader(k: string, v: string) { this.headers.set(k.toLowerCase(), v); }, end(t: string) { this.text = t; } };
    await defaults(unread, res);
    expect(res.statusCode).toBe(503);
    // Outside production nothing is asked of the Firewall and nothing is answered.
    vi.stubEnv('NODE_ENV', 'test');
    vi.mocked(checkRateLimit).mockReset();
    expect((await run(defaults, { endpoint: 'chart', body: CHART })).status).toBe(503);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it('counts an events request under both rules and every other request under the first, before reading its body', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const defaults = createComputeApiHandler({ localTime, env: {} });
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false });
    for (const endpoint of COMPUTE_ENDPOINTS) {
      vi.mocked(checkRateLimit).mockClear();
      expect((await run(defaults, { endpoint, body: VALID[endpoint] })).status, endpoint).toBe(200);
      expect(vi.mocked(checkRateLimit).mock.calls.map(([id]) => id), endpoint)
        .toEqual(endpoint === 'events' ? [COMPUTE_RATE_LIMIT_ID, COMPUTE_EVENTS_RATE_LIMIT_ID] : [COMPUTE_RATE_LIMIT_ID]);
    }
    expect(COMPUTE_EVENTS_RATE_LIMIT_ID).toBe('zodiacs-compute-events');
    // The events rule refuses on its own; the first rule refuses before the second is counted.
    vi.mocked(checkRateLimit).mockImplementation(async (id) => ({ rateLimited: id === COMPUTE_EVENTS_RATE_LIMIT_ID }));
    expect((await run(defaults, { endpoint: 'events', body: VALID.events })).status).toBe(429);
    expect((await run(defaults, { endpoint: 'chart', body: CHART })).status).toBe(200);
    vi.mocked(checkRateLimit).mockReset();
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: true });
    expect((await run(defaults, { endpoint: 'events', body: VALID.events })).status).toBe(429);
    expect(vi.mocked(checkRateLimit).mock.calls.map(([id]) => id)).toEqual([COMPUTE_RATE_LIMIT_ID]);
    vi.mocked(checkRateLimit).mockReset();
    vi.mocked(checkRateLimit).mockImplementation(async (id) => (id === COMPUTE_EVENTS_RATE_LIMIT_ID
      ? { rateLimited: false, error: 'not-found' } as never : { rateLimited: false }));
    expect((await run(defaults, { endpoint: 'events', body: VALID.events })).status).toBe(503);
    // The limiter gets the headers, never the body.
    vi.mocked(checkRateLimit).mockReset();
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: true });
    expect((await run(defaults, { endpoint: 'time', body: VALID.time })).status).toBe(429);
    const [, options] = vi.mocked(checkRateLimit).mock.calls[0];
    expect(Object.keys(options ?? {})).toEqual(['headers']);
    expect(JSON.stringify(options)).not.toContain('Europe/Paris');
  });
});

describe('compute API body limits', () => {
  it('refuses a body that is not declared as JSON in UTF-8 with 415', async () => {
    for (const contentType of [null, 'text/plain', 'application/x-www-form-urlencoded', 'application/json; charset=latin1', 'application/jsonx']) {
      const response = await call('time', VALID.time, { contentType });
      expect(response.status, String(contentType)).toBe(415);
      expect(response.json.error.code).toBe('unsupported-media-type');
    }
    expect((await call('time', VALID.time, { contentType: 'application/json; charset=utf-8' })).status).toBe(200);
    expect((await call('time', VALID.time, { contentType: 'Application/JSON; Charset="UTF-8"' })).status).toBe(200);
    expect((await call('time', VALID.time, { headers: { 'content-encoding': 'gzip' } })).status).toBe(415);
  });

  it(`refuses more than ${MAX_BODY_BYTES} bytes with 413, declared or not, and accepts exactly that many`, async () => {
    const declared = await call('positions', '{}', { contentLength: MAX_BODY_BYTES + 1 });
    expect(declared.status).toBe(413);
    expect(declared.json.error).toEqual({ code: 'payload-too-large', message: `The body is larger than ${MAX_BODY_BYTES} bytes.`, limit: 'body.bytes', max: MAX_BODY_BYTES });
    const text = JSON.stringify(VALID.positions);
    const exact = text + ' '.repeat(MAX_BODY_BYTES - text.length);
    expect((await call('positions', exact)).status).toBe(200);
    const undeclared = await call('positions', `${exact} `, { contentLength: null });
    expect(undeclared.status).toBe(413);
  });

  it('refuses a body that is not valid UTF-8 JSON, or not an object, with 400', async () => {
    for (const body of ['{"utc":', '', 'nul', Buffer.from([0x7b, 0xff, 0x7d])]) {
      const response = await call('chart', body);
      expect(response.status).toBe(400);
      expect(response.json.error.code).toBe('invalid-json');
    }
    const mismatch = await call('chart', CHART, { contentLength: 5 });
    expect(mismatch.json.error.code).toBe('invalid-json');
    for (const body of [[], 'null', '"text"', '42']) {
      const response = await call('chart', typeof body === 'string' ? body : JSON.stringify(body));
      expect(response.status).toBe(400);
      expect(response.json.error).toEqual({ code: 'invalid-request', message: 'The body must be a JSON object.', pointer: '' });
    }
  });
});

const VOCABULARY = new Set<string>([
  ...COMPUTE_ENDPOINTS, ...POSITION_BODIES, ...HOUSE_SYSTEM_NAMES, ...SIGN_SLUGS, ...SKY_FACT_KINDS, ...PHASE_NAMES, ...EVENT_KINDS,
]);

/** An invalid-request answer names the field and says why, without repeating what was sent. */
async function refusal(endpoint: ComputeEndpoint, body: unknown) {
  const response = await call(endpoint, body);
  expect(response.status, JSON.stringify(body)).toBe(400);
  expect(response.json.error.code).toBe('invalid-request');
  const sent = JSON.stringify(body);
  for (const value of Object.values(flatten(body))) {
    // The API's own vocabulary (a kind, a sign, a body) may be listed in a message as an allowed value.
    if (typeof value === 'string' && value.length > 3 && !VOCABULARY.has(value)) {
      expect(response.text, `echoes ${value}`).not.toContain(value);
    }
  }
  expect(sent.length).toBeGreaterThan(0);
  return response.json.error as { pointer: string; message: string };
}

/** The values a body carries (not its field names, which errors may use as pointers). */
function flatten(value: unknown, into: Record<string, unknown> = {}, path = ''): Record<string, unknown> {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) flatten(child, into, `${path}/${key}`);
  } else into[path] = value;
  return into;
}

describe('compute API validation', () => {
  it('refuses unknown fields at any depth, pointing at the object and never naming the field', async () => {
    const named = async (endpoint: ComputeEndpoint, body: unknown, field: string, pointer: string) => {
      const error = await refusal(endpoint, body);
      expect(error.pointer).toBe(pointer);
      expect(JSON.stringify(error)).not.toContain(field);
    };
    await named('chart', { ...CHART, planetarium: 'x' }, 'planetarium', '');
    await named('time', { local: { ...VALID.time.local as object, seconds: '00' } }, 'seconds', '/local');
    await named('sky-fact', { ...VALID['sky-fact'], zoneless: true }, 'zoneless', '');
    await named('events', { ...VALID.events, window: 3 }, 'window', '');
    const proto = await call('positions', '{"instants":["2026-09-29T12:00:00Z"],"__proto__":{"x":1}}');
    expect(proto.json.error).toMatchObject({ code: 'invalid-request', pointer: '' });
  });

  it('refuses instants without an explicit zone, impossible calendar dates and times, and dates outside 1800-2199', async () => {
    for (const utc of ['2000-01-01T12:00:00', '2000-01-01 12:00:00Z', '2000-01-01', '2000-02-30T12:00:00Z', '2001-02-29T00:00:00Z',
      '2000-01-01T24:00:00Z', '2016-12-31T23:59:60Z', '2000-01-01T12:00:00+14:30', '2000-01-01T12:00:00.1234Z',
      '1799-12-31T23:59:59Z', '2200-01-01T00:00:00Z', '1800-01-01T00:30:00+01:00', '2000-01-01T12:00:00z']) {
      const error = await refusal('chart', { ...CHART, utc });
      expect(error.pointer, utc).toBe('/utc');
    }
    for (const utc of ['1800-01-01T00:00:00Z', '2199-12-31T23:59:59.999Z', '2000-02-29T12:00:00-14:00', '2000-01-01T12:00+05:30']) {
      expect((await call('chart', { ...CHART, utc })).status, utc).toBe(200);
    }
  });

  it('takes exactly one of utc and local, and checks each local field', async () => {
    expect(await refusal('chart', { latitude: 1, longitude: 1 })).toMatchObject({ pointer: '' });
    expect(await refusal('chart', { ...CHART, local: { date: '2000-01-01', time: '12:00', zone: 'UTC' } })).toMatchObject({ pointer: '' });
    const local = (patch: Record<string, unknown>) => ({ local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris', ...patch }, latitude: 48.8566, longitude: 2.3522 });
    expect(await refusal('chart', local({ date: '1990-6-15' }))).toMatchObject({ pointer: '/local/date' });
    expect(await refusal('chart', local({ date: '1799-12-31' }))).toMatchObject({ pointer: '/local/date' });
    expect(await refusal('chart', local({ date: '1990-02-30' }))).toMatchObject({ pointer: '/local/date' });
    expect(await refusal('chart', local({ time: '14:30:00' }))).toMatchObject({ pointer: '/local/time' });
    expect(await refusal('chart', local({ time: '24:00' }))).toMatchObject({ pointer: '/local/time' });
    expect(await refusal('chart', local({ zone: 'Europe/Atlantis' }))).toMatchObject({ pointer: '/local/zone', message: "Must be a time zone name the server's time zone data includes." });
    expect(await refusal('chart', local({ zone: '+05:30' }))).toMatchObject({ pointer: '/local/zone' });
    expect(await refusal('chart', local({ zone: 'Europe/Paris/../../etc' }))).toMatchObject({ pointer: '/local/zone' });
    // A zone in another letter case is accepted as the zone itself, and named as tzdb spells it.
    const lower = await call('chart', local({ zone: 'europe/paris' }));
    expect(lower.status).toBe(200);
    expect(lower.json.receipt.localResolution.timeZone).toBe('Europe/Paris');
    expect(lower.text).toBe((await call('chart', local({ zone: 'Europe/Paris' }))).text);
    // A name Intl would read but tzdb no longer has is refused like any unknown zone.
    expect(await refusal('chart', local({ zone: 'US/Pacific-New' }))).toMatchObject({ pointer: '/local/zone', message: VALIDATION_MESSAGES.zoneUnknown });
  });

  it('reads a zone in any letter case as the zone itself: Buffalo in 1870 and west of Paris in 1880', async () => {
    const cases = [
      ['1870-06-15', 'America/New_York', 42.8864, -78.8784, '1870-06-15T17:15:31.000Z', ['america/new_york', 'AMERICA/NEW_YORK', 'America/NEW_york']],
      ['1880-06-15', 'Europe/Paris', 48.3904, -4.4861, '1880-06-15T12:17:57.000Z', ['europe/paris', 'EUROPE/PARIS', 'eUROPE/pARIS']],
    ] as const;
    for (const [date, zone, latitude, longitude, utc, spellings] of cases) {
      const exact = await call('time', { local: { date, time: '12:00', zone }, longitude });
      expect(exact.json.result.utc).toBe(utc);
      expect(exact.json.result.flags).toEqual(['lmt']);
      const chart = await call('chart', { local: { date, time: '12:00', zone }, latitude, longitude });
      expect(chart.json.result.instant).toBe(utc);
      for (const spelling of spellings) {
        expect((await call('time', { local: { date, time: '12:00', zone: spelling }, longitude })).text, spelling).toBe(exact.text);
        const other = await call('chart', { local: { date, time: '12:00', zone: spelling }, latitude, longitude });
        expect(other.json.receipt.localResolution.timeZone, spelling).toBe(zone);
        expect(other.text, spelling).toBe(chart.text);
      }
    }
    const fact = await call('sky-fact', { kind: 'phase', phase: 'full', date: '2026-10-26', zone: 'asia/tokyo' });
    expect(fact.json.result.fact.zone).toBe('Asia/Tokyo');
  });

  it('passes the resolver one spelling of a zone: 5,000 case variants add no formatter', async () => {
    const base = 'America/Argentina/ComodRivadavia';
    const letters = [...base].flatMap((letter, index) => (/[a-z]/iu.test(letter) ? [index] : []));
    const variant = (n: number) => {
      const out = [...base];
      letters.forEach((index, bit) => {
        if ((n >> bit) & 1) out[index] = out[index] === out[index].toLowerCase() ? out[index].toUpperCase() : out[index].toLowerCase();
      });
      return out.join('');
    };
    const request = (zone: string) => ({ local: { date: '1990-06-15', time: '12:00', zone } });
    const answer = (await call('time', request(base))).text;
    // Every formatter the resolver builds is stored with Map.prototype.set.
    const set = Map.prototype.set;
    let stored = 0;
    const spy = vi.spyOn(Map.prototype, 'set').mockImplementation(function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
      if (value instanceof Intl.DateTimeFormat) stored += 1;
      return set.call(this, key, value);
    });
    const spellings = new Set<string>();
    try {
      // The count sees a zone the resolver has not read before.
      expect((await call('time', request('Antarctica/Troll'))).status).toBe(200);
      expect(stored).toBeGreaterThan(0);
      stored = 0;
      for (let n = 1; n <= 5000; n += 1) {
        const zone = variant(n);
        spellings.add(zone);
        const response = await call('time', request(zone));
        if (response.text !== answer) throw new Error(`${zone} was answered differently`);
      }
    } finally {
      spy.mockRestore();
    }
    expect(spellings.size).toBe(5000);
    expect(stored).toBe(0);
  }, 120_000);

  it('refuses the poles, out-of-range coordinates, non-numbers and unknown house systems', async () => {
    for (const latitude of [90, -90, 90.5, '45', null]) {
      expect(await refusal('chart', { ...CHART, latitude })).toMatchObject({ pointer: '/latitude' });
    }
    for (const longitude of [180.0001, -181, '0']) {
      expect(await refusal('houses', { ...CHART, longitude })).toMatchObject({ pointer: '/longitude' });
    }
    expect(await refusal('houses', { ...CHART, houseSystem: 'Placidus' })).toMatchObject({ pointer: '/houseSystem' });
    expect(await refusal('time', { ...VALID.time, longitude: 200 })).toMatchObject({ pointer: '/longitude' });
    expect((await call('chart', { ...CHART, latitude: 89.999999 })).status).toBe(200);
  });

  it('checks positions, events and fact fields', async () => {
    expect(await refusal('positions', { instants: [] })).toMatchObject({ pointer: '/instants' });
    expect(await refusal('positions', { instants: ['2026-09-29T12:00:00Z', 'yesterday'] })).toMatchObject({ pointer: '/instants/1' });
    expect(await refusal('positions', { ...VALID.positions, bodies: ['Sun', 'Sun'] })).toMatchObject({ pointer: '/bodies/1' });
    expect(await refusal('positions', { ...VALID.positions, bodies: ['Chiron'] })).toMatchObject({ pointer: '/bodies/0' });
    expect(await refusal('events', { from: '2026-10-08T00:00:00Z', to: '2026-10-08T00:00:00Z' })).toMatchObject({ pointer: '/to' });
    expect(await refusal('events', { ...VALID.events, bodies: ['North Node'] })).toMatchObject({ pointer: '/bodies/0' });
    expect(await refusal('events', { ...VALID.events, kinds: ['eclipse'] })).toMatchObject({ pointer: '/kinds/0' });
    expect(await refusal('sky-fact', { kind: 'aspect', body: 'Sun' })).toMatchObject({ pointer: '/kind' });
    expect(await refusal('sky-fact', { kind: 'sign', body: 'Sun', sign: 'Libra', instant: '2026-09-29T12:00:00Z' })).toMatchObject({ pointer: '/sign' });
    expect(await refusal('sky-fact', { kind: 'sign', body: 'Sun', sign: 'libra', instant: '2026-09-29T12:00:00Z', date: '2026-09-29' })).toMatchObject({ pointer: '' });
    expect(await refusal('sky-fact', { kind: 'retrograde', body: 'Mars', instant: '2026-09-29T12:00:00Z', zone: 'Europe/Paris' })).toMatchObject({ pointer: '/zone' });
    expect(await refusal('sky-fact', { kind: 'ingress', body: 'Sun', sign: 'libra' })).toMatchObject({ pointer: '/date' });
    expect(await refusal('sky-fact', { kind: 'phase', phase: 'gibbous', date: '2026-09-29' })).toMatchObject({ pointer: '/phase' });
    expect(await refusal('sky-fact', { kind: 'phase', phase: 'full', date: '2026-09-29', instant: '2026-09-29T00:00:00Z' })).toMatchObject({ pointer: '' });
  });

  it('refuses a fact about a date its zone skipped, rather than answering for a day that did not happen', async () => {
    // Samoa and Kiritimati crossed the date line by skipping a whole day.
    for (const [date, zone] of [['2011-12-30', 'Pacific/Apia'], ['1994-12-31', 'Pacific/Kiritimati']] as const) {
      for (const body of [
        { kind: 'sign', body: 'Moon', sign: 'aries', date, zone },
        { kind: 'retrograde', body: 'Sun', date, zone },
        { kind: 'ingress', body: 'Moon', sign: 'aries', date, zone },
        { kind: 'phase', phase: 'full', date, zone },
      ]) {
        expect(await refusal('sky-fact', body)).toEqual({ code: 'invalid-request', pointer: '/date', message: VALIDATION_MESSAGES.skippedDay });
      }
      // The days on either side are ordinary.
      expect((await call('sky-fact', { kind: 'retrograde', body: 'Sun', date: date.replace(/-(\d\d)$/u, (_, day) => `-${String(Number(day) - 1).padStart(2, '0')}`), zone })).status).toBe(200);
    }
  });

  it('flags a local time or a day at the ends of the accepted dates that reaches past the instant span', async () => {
    const tokyo = await call('time', { local: { date: '1800-01-01', time: '00:00', zone: 'Asia/Tokyo' } });
    expect(tokyo.json.result.utc).toBe('1799-12-31T14:41:01.000Z');
    expect(tokyo.json.result.flags).toEqual(['outside-reference-span']);
    const honolulu = await call('time', { local: { date: '2199-12-31', time: '23:59', zone: 'Pacific/Honolulu' } });
    expect(honolulu.json.result.utc).toBe('2200-01-01T09:59:00.000Z');
    expect(honolulu.json.result.flags).toEqual(['outside-reference-span']);
    expect((await call('time', { local: { date: '1800-01-01', time: '12:00', zone: 'Asia/Tokyo' } })).json.result.flags).toEqual([]);
    // With a longitude the birthplace's mean time reads the time, and lmt says so.
    const place = await call('time', { local: { date: '1800-01-01', time: '00:00', zone: 'Asia/Tokyo' }, longitude: 139.69 });
    expect(place.json.result.flags).toEqual(['lmt', 'outside-reference-span']);
    const chart = await call('chart', { local: { date: '1800-01-01', time: '00:00', zone: 'Asia/Tokyo' }, latitude: 35.68, longitude: 139.69 });
    expect(chart.json.result.flags).toContain('outside-reference-span');
    for (const [body, flagged] of [
      [{ kind: 'sign', body: 'Sun', sign: 'capricorn', date: '1800-01-01' }, true],
      [{ kind: 'sign', body: 'Sun', sign: 'capricorn', date: '2199-12-31' }, true],
      [{ kind: 'phase', phase: 'full', date: '1800-01-01', zone: 'Asia/Tokyo' }, true],
      [{ kind: 'phase', phase: 'full', date: '2199-12-31', zone: 'Pacific/Honolulu' }, true],
      [{ kind: 'phase', phase: 'full', date: '1800-01-02', zone: 'UTC' }, false],
      [{ kind: 'retrograde', body: 'Mars', date: '2026-09-29' }, false],
    ] as const) {
      const response = await call('sky-fact', body);
      expect(response.status, JSON.stringify(body)).toBe(200);
      expect(response.json.result.facts.flags, JSON.stringify(body)).toEqual(flagged ? ['outside-reference-span'] : []);
    }
  });
});

describe('compute API budgets', () => {
  it(`refuses more than ${BUDGETS['positions.instants']} instants with budget-exhausted, naming the limit`, async () => {
    const instants = Array.from({ length: BUDGETS['positions.instants'] + 1 }, (_, day) => new Date(Date.UTC(2026, 0, 1) + day * DAY).toISOString());
    const over = await call('positions', { instants, bodies: ['Moon'] });
    expect(over.status).toBe(422);
    expect(over.json.error).toEqual({
      code: 'budget-exhausted',
      message: `A positions request takes at most ${BUDGETS['positions.instants']} instants.`,
      limit: 'positions.instants',
      max: BUDGETS['positions.instants'],
    });
    const at = await call('positions', { instants: instants.slice(0, -1), bodies: ['Moon'] });
    expect(at.status).toBe(200);
    expect(at.json.result.instants).toHaveLength(BUDGETS['positions.instants']);
  });

  it(`refuses an events window over ${BUDGETS['events.windowDays']} days before searching, and completes one of exactly that length`, async () => {
    const from = Date.UTC(2026, 0, 1);
    const over = await call('events', { from: new Date(from).toISOString(), to: new Date(from + BUDGETS['events.windowDays'] * DAY + 1).toISOString() });
    expect(over.status).toBe(422);
    expect(over.json.error).toMatchObject({ code: 'budget-exhausted', limit: 'events.windowDays', max: BUDGETS['events.windowDays'] });
    const at = await call('events', { from: new Date(from).toISOString(), to: new Date(from + BUDGETS['events.windowDays'] * DAY).toISOString() });
    expect(at.status).toBe(200);
    expect(at.json.receipt.search.samples).toBeLessThan(BUDGETS['events.samples'] / 1.5);
  }, 60_000);
});

describe('compute API receipts, backend and citation', () => {
  it("gives every success the engine receipt or a compute receipt, the backend, and a four-field cite whose digest is the receipt's", async () => {
    for (const endpoint of COMPUTE_ENDPOINTS) {
      const { json } = await call(endpoint, VALID[endpoint]);
      expect(json.schema).toBe(`zodiacs.compute-api.${endpoint}.v1`);
      expect(json.backend).toEqual({ name: '@zodiacs/engine', version: ENGINE_VERSION, ephemeris: { name: 'astronomy-engine', version: '2.1.19' } });
      expect(json.receipt.engine).toEqual(json.backend);
      expect(json.receipt.schema).toBe(endpoint === 'chart' || endpoint === 'houses'
        ? 'zodiacs.calculation-receipt.draft-v1' : 'zodiacs.compute-receipt.v1');
      expect(Object.keys(json.cite).sort()).toEqual(['engine', 'receipt', 'url', 'version']);
      expect(json.cite.url).toBe(`https://zodiacs.org/developers/compute/#${endpoint}`);
      expect(json.cite.engine).toBe('@zodiacs/engine');
      expect(json.cite.version).toBe(ENGINE_VERSION);
      expect(json.cite.receipt).toBe(`sha256:${createHash('sha256').update(jcs(json.receipt)).digest('hex')}`);
    }
  });

  it("names both ΔT sources and their tables, the engine's conventions and coverage, and each search's limits", async () => {
    const chart = await call('chart', CHART);
    const { json } = await call('events', VALID.events);
    expect(json.receipt.conventions).toEqual(chart.json.receipt.conventions);
    expect(json.receipt.coverage).toEqual(chart.json.receipt.coverage);
    // The engine reads 2000 on IERS UT1 − UTC and 1900 on its ΔT model; the receipt names both sources.
    const modern = chart.json.result.deltaT;
    const early = (await call('chart', { ...CHART, utc: '1900-01-01T12:00:00Z' })).json.result.deltaT;
    expect([modern.model, early.model]).toEqual(['iers-utc/1', 'zodiacs-deltat/1']);
    expect(json.receipt.deltaT).toEqual([
      { model: 'iers-utc/1', table: modern.table, tableDigest: modern.tableDigest },
      { model: 'zodiacs-deltat/1', table: early.table, tableDigest: early.tableDigest },
    ]);
    expect(json.receipt.search).toMatchObject({
      solver: 'engine-longitude-crossings', bisections: 24, maxSamples: BUDGETS['events.samples'],
      window: 'start-exclusive-end-inclusive', completeness: 'tested-not-proven',
    });
    const time = await call('time', VALID.time);
    expect(time.json.receipt.timeResolution).toEqual({
      resolver: 'src/lib/time/localToUtc.ts',
      policy: { fold: 'earlier', gap: 'shift-forward' },
      pinnedTzdb: { release: PINNED_TZDB_RELEASE, dataForm: 'main+backzone', appliesBefore: '1970-01-02', requires: 'longitude' },
      runtimeTzdb: process.versions.tz,
    });
  });

  it("identifies a chart's birth details through cite.receipt: its date and place give back its time", async () => {
    // The documented example, a synthetic birth. A digest hides nothing: whoever
    // knows the date and the place tries every minute of the day.
    const example = { local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris' }, latitude: 48.8566, longitude: 2.3522, houseSystem: 'whole' };
    const target = (await call('chart', example)).json.cite.receipt;
    const found: string[] = [];
    for (let minute = 0; minute < 24 * 60; minute += 1) {
      const time = `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
      const { json } = await call('chart', { ...example, local: { ...example.local, time } });
      if (json.cite.receipt === target) found.push(time);
    }
    expect(found).toEqual(['14:30']);
  }, 60_000);

  it('writes the same answer for the same request', async () => {
    for (const endpoint of COMPUTE_ENDPOINTS) {
      expect((await call(endpoint, VALID[endpoint])).text).toBe((await call(endpoint, VALID[endpoint])).text);
    }
  });

  it("lists the engine's own house systems, bodies and pinned tzdb release", () => {
    expect([...HOUSE_SYSTEM_NAMES]).toEqual([...HOUSE_SYSTEMS]);
    expect(positions('2026-09-29T12:00:00Z').map((row) => row.body)).toEqual([...POSITION_BODIES]);
    const bucket = JSON.parse(readFileSync(new URL('../../src/data/tz-history/2025c/00.json', import.meta.url), 'utf8'));
    expect(bucket.tzdb).toBe(PINNED_TZDB_RELEASE);
  });
});

describe('compute API parity with the engine and the site resolver', () => {
  it("chart and houses return natalChart's values and createNatalEnvelope's receipt", async () => {
    for (const houseSystem of HOUSE_SYSTEMS) {
      const request = { utc: '1987-03-14T05:42:00+01:00', latitude: 45.764, longitude: 4.8357, houseSystem };
      const chart = natalChart({ utc: new Date('1987-03-14T04:42:00Z'), latitude: 45.764, longitude: 4.8357, houseSystem, timeKnown: true, flags: [] });
      const { receipt } = createNatalEnvelope(chart, { reference: 'supplied-instant', sourceInstant: request.utc });
      const expected = JSON.parse(JSON.stringify(chart));
      const answer = (await call('chart', request)).json;
      expect(answer.result).toEqual({
        instant: '1987-03-14T04:42:00.000Z', local: null, bodies: expected.bodies, angles: expected.angles,
        houses: expected.houses, aspects: expected.aspects, flags: expected.flags, deltaT: expected.deltaT,
        timeScale: expected.timeScale,
      });
      expect(answer.receipt).toEqual(JSON.parse(JSON.stringify(receipt)));
      const houses = (await call('houses', request)).json;
      expect(houses.result).toEqual({
        instant: '1987-03-14T04:42:00.000Z', local: null, angles: expected.angles, houses: expected.houses, flags: expected.flags, deltaT: expected.deltaT,
        timeScale: expected.timeScale,
      });
      expect(houses.receipt).toEqual(answer.receipt);
    }
  });

  it('chart from local time resolves as the calculator does, with the birthplace longitude, and records the resolution', async () => {
    const cases = [
      ['1947-07-01', '12:00', 'Europe/Stockholm', 59.3293, 18.0686],
      ['1850-06-01', '12:00', 'America/Mexico_City', 19.4326, -99.1332],
      ['2026-03-29', '02:30', 'Europe/Paris', 48.8566, 2.3522],
      ['2026-10-25', '02:30', 'Europe/Paris', 48.8566, 2.3522],
      ['1990-06-15', '14:30', 'Asia/Kolkata', 22.5726, 88.3639],
    ] as const;
    for (const [date, time, zone, latitude, longitude] of cases) {
      await prepareLocalTime(date, zone);
      const resolved = resolveLocalToUtc(date, time, zone, { longitude });
      const chart = natalChart({ utc: resolved.utc, latitude, longitude, houseSystem: 'placidus', timeKnown: true, flags: resolved.flags });
      const answer = (await call('chart', { local: { date, time, zone }, latitude, longitude })).json;
      expect(answer.result.instant, `${date} ${zone}`).toBe(resolved.utc.toISOString());
      expect(answer.result.bodies).toEqual(JSON.parse(JSON.stringify(chart.bodies)));
      expect(answer.result.local.offsetMinutes).toBe(resolved.offsetMinutes);
      expect(answer.result.local.flags).toEqual(resolved.flags);
      expect(answer.result.local.localMeanTime).toEqual(resolved.localMeanTime ?? null);
      expect(answer.receipt.inputFlags).toEqual(chart.flags.filter((flag) => ['dst-gap', 'dst-fold', 'lmt'].includes(flag)));
      expect(answer.receipt.localResolution).toMatchObject({ date, time, timeZone: zone, offsetMinutes: resolved.offsetMinutes });
      expect(answer.receipt.provenance).toEqual({ runtime: { name: 'node', tzdbVersion: process.versions.tz }, status: 'claimed' });
    }
  });

  it('positions returns positions() rows, the ΔT and time basis a chart at that instant is computed with, and the reference-span flag', async () => {
    const instants = ['1800-01-01T00:00:00Z', '1969-07-20T20:17:40Z', '2026-09-29T12:00:00Z', '2199-12-31T23:59:59Z'];
    const { json } = await call('positions', { instants, bodies: ['Moon', 'Sun', 'South Node'] });
    json.result.instants.forEach((row: any, index: number) => {
      const at = new Date(instants[index]);
      expect(row.instant).toBe(at.toISOString());
      expect(row.bodies).toEqual(JSON.parse(JSON.stringify(positions(at).filter((body) => ['Sun', 'Moon', 'South Node'].includes(body.body)))));
      const chart = natalChart({ utc: at, timeKnown: false });
      expect(row.deltaT).toEqual(chart.deltaT);
      expect(row.timeScale).toEqual(chart.timeScale);
      expect(row.flags).toEqual(outsideReferenceSpan(at) ? ['outside-reference-span'] : []);
    });
    // Before 1972 and after the UT1 table the instant is read as UT1; between, on IERS UT1 − UTC.
    expect(json.result.instants.map((row: any) => row.timeScale.basis)).toEqual(['delta-t', 'delta-t', 'iers', 'delta-t']);
    const all = (await call('positions', { instants: ['2026-09-29T12:00:00Z'] })).json;
    expect(all.result.instants[0].bodies.map((row: any) => row.body)).toEqual([...POSITION_BODIES]);
  });

  it("events are the engine's crossing searches: its longitudes for ingresses, its speed for stations, its elongation for lunations", async () => {
    const from = new Date('2026-06-01T00:00:00Z');
    const to = new Date('2026-09-01T00:00:00Z');
    const { json } = await call('events', { from: from.toISOString(), to: to.toISOString(), bodies: ['Mercury', 'Moon'] });
    const events = json.result.events;
    const ingresses: string[] = [];
    for (const body of ['Mercury', 'Moon'] as const) {
      for (let index = 0; index < 12; index += 1) {
        const result = searchLongitudeCrossings(body, index * 30, from, to, { stepDays: body === 'Moon' ? 1 : 5 });
        if (result.status !== 'complete') throw new Error('refused');
        for (const crossing of result.crossings) ingresses.push(`${body} ${crossing.at.toISOString()} ${crossing.retrograde}`);
      }
    }
    expect(events.filter((event: any) => event.kind === 'ingress').map((event: any) => `${event.body} ${event.at} ${event.retrograde}`).sort())
      .toEqual(ingresses.sort());
    const speed = (body: BodyName, date: Date) => positions(date).find((row) => row.body === body)!.speed;
    const stations = searchLongitudeCrossingsWith(speed, 'Mercury', 0, from, to, { stepDays: 5 });
    if (stations.status !== 'complete') throw new Error('refused');
    expect(events.filter((event: any) => event.kind === 'station').map((event: any) => `${event.at} ${event.type}`))
      .toEqual(stations.crossings.map((crossing) => `${crossing.at.toISOString()} ${crossing.retrograde ? 'retrograde' : 'direct'}`));
    const lunations = (['new', 'full'] as const).flatMap((type) => {
      const result = searchLongitudeCrossingsWith((_body, date) => moonPhase(date).angle, 'Moon', type === 'new' ? 0 : 180, from, to, { stepDays: 1 });
      if (result.status !== 'complete') throw new Error('refused');
      return result.crossings.map((crossing) => `${crossing.at.toISOString()} ${type}`);
    }).sort();
    expect(events.filter((event: any) => event.kind === 'lunation').map((event: any) => `${event.at} ${event.type}`).sort()).toEqual(lunations);
    const times = events.map((event: any) => event.at);
    expect(times).toEqual([...times].sort());
  });

  it('events find the stations, lunations and ingresses the site published for 2026, to within minutes', async () => {
    const months = Array.from({ length: 12 }, (_, month) => JSON.parse(readFileSync(
      new URL(`../../src/data/transits-2026-${String(month + 1).padStart(2, '0')}.json`, import.meta.url), 'utf8')));
    const published = months.flatMap((month) => [
      ...month.stations.map((row: any) => ({ key: `station ${row.planet} ${row.type}`, at: Date.parse(row.at) })),
      ...month.lunations.map((row: any) => ({ key: `lunation ${row.type}`, at: Date.parse(row.at) })),
      ...month.ingresses.map((row: any) => ({ key: `ingress ${row.planet} ${row.sign}`, at: Date.parse(row.at) })),
    ]);
    // The year in quarters, each within the window limit: a window excludes its start and includes its end.
    const quarters = ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01'];
    const events: any[] = [];
    for (let index = 0; index < 4; index += 1) {
      const { json } = await call('events', { from: `${quarters[index]}T00:00:00Z`, to: `${quarters[index + 1]}T00:00:00Z`, bodies: EVENT_BODIES.filter((body) => body !== 'Moon') });
      events.push(...json.result.events);
    }
    const found = events.map((event: any) => ({
      key: event.kind === 'station' ? `station ${event.body} ${event.type}` : event.kind === 'lunation' ? `lunation ${event.type}` : `ingress ${event.body} ${event.sign}`,
      at: Date.parse(event.at),
    }));
    expect(found).toHaveLength(published.length);
    for (const row of published) {
      const match = found.find((event: any) => event.key === row.key && Math.abs(event.at - row.at) < 5 * 60_000);
      expect(match, `${row.key} ${new Date(row.at).toISOString()}`).toBeDefined();
    }
  }, 60_000);

  it("time is the site resolver's answer, TT and ΔT are a chart's at that instant, and the zone history is named", async () => {
    const cases = [
      [{ date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, 18.07, 'pinned', false],
      [{ date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, null, 'runtime', true],
      [{ date: '1850-06-01', time: '12:00', zone: 'America/Mexico_City' }, -99.13, 'pinned', false],
      // Harbin is left out of the pinned release (its history differs after 1970), so the runtime's applies.
      [{ date: '1960-05-01', time: '12:00', zone: 'Asia/Harbin' }, 126.65, 'runtime', true],
      [{ date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' }, null, 'runtime', false],
      [{ date: '2026-10-25', time: '02:30', zone: 'Europe/Paris' }, 2.35, 'runtime', false],
    ] as const;
    for (const [local, longitude, history, uncertain] of cases) {
      await prepareLocalTime(local.date, local.zone);
      const resolved = resolveLocalToUtc(local.date, local.time, local.zone, longitude === null ? {} : { longitude });
      const answer = (await call('time', longitude === null ? { local } : { local, longitude })).json.result;
      const chart = natalChart({ utc: resolved.utc, timeKnown: false });
      expect(answer.utc).toBe(resolved.utc.toISOString());
      expect(answer.offsetMinutes).toBe(resolved.offsetMinutes);
      expect(answer.flags).toEqual(resolved.flags);
      expect(answer.localMeanTime).toEqual(resolved.localMeanTime ?? null);
      expect(answer.zoneHistory, `${local.date} ${local.zone}`).toBe(history);
      expect(answer.zoneUncertain).toBe(uncertain);
      expect(answer.deltaT).toEqual(chart.deltaT);
      expect(answer.timeScale).toEqual(chart.timeScale);
      // TT = UT1 + ΔT: UT1 is UTC plus IERS UT1 − UTC from 1972, the instant itself before.
      const ut1 = resolved.utc.getTime() + (chart.timeScale.ut1MinusUtc?.seconds ?? 0) * 1000;
      expect(answer.tt).toBe(new Date(Math.round(ut1 + chart.deltaT.seconds * 1000)).toISOString().slice(0, -1));
      if (chart.timeScale.basis === 'iers') {
        // From 1972, TT is UTC plus the leap seconds and 32.184 s, to the millisecond.
        expect(Date.parse(`${answer.tt}Z`) - resolved.utc.getTime()).toBe(chart.timeScale.leapSeconds!.taiMinusUtc * 1000 + 32_184);
      }
    }
    expect(cases.some(([local]) => local.date >= '1972')).toBe(true);
  });

  it('sky-fact answers from the computed values it returns, and depends only on the time of day or the zone', async () => {
    const at = (body: object) => call('sky-fact', body).then((response) => response.json.result);
    const moon = positions('2026-09-29T12:00:00Z').find((row) => row.body === 'Moon')!;
    const instant = await at({ kind: 'sign', body: 'Moon', sign: moon.sign, instant: '2026-09-29T12:00:00Z' });
    expect(instant).toMatchObject({ answer: 'true', basis: 'instant', window: null });
    expect(instant.facts.lon).toBe(moon.lon);
    expect((await at({ kind: 'sign', body: 'Moon', sign: 'aries', instant: '2026-09-29T12:00:00Z' })).answer).toBe(moon.sign === 'aries' ? 'true' : 'false');

    // Mercury stations retrograde at 07:15 UTC on 24 October 2026: 03:15 in New York.
    const newYork = await at({ kind: 'retrograde', body: 'Mercury', date: '2026-10-24', zone: 'America/New_York' });
    expect(newYork).toMatchObject({ answer: 'depends', basis: 'local-day', window: { from: '2026-10-24T04:00:00.000Z', to: '2026-10-25T04:00:00.000Z' } });
    expect((await at({ kind: 'retrograde', body: 'Mercury', date: '2026-10-26' })).answer).toBe('true');
    expect((await at({ kind: 'retrograde', body: 'Mercury', date: '2026-10-20' })).answer).toBe('false');
    expect((await at({ kind: 'retrograde', body: 'Sun', date: '2026-10-24' })).answer).toBe('false');

    // The Sun enters Libra at 00:05 UTC on 23 September 2026: 22 September west of UTC.
    expect((await at({ kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23', zone: 'Europe/Paris' })).answer).toBe('true');
    expect((await at({ kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-22', zone: 'America/Los_Angeles' })).answer).toBe('true');
    expect((await at({ kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23', zone: 'America/Los_Angeles' })).answer).toBe('false');
    expect((await at({ kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-23' })).answer).toBe('depends');
    expect((await at({ kind: 'ingress', body: 'Sun', sign: 'libra', date: '2026-09-26' })).answer).toBe('false');

    const full = await at({ kind: 'phase', phase: 'full', date: '2026-10-26', zone: 'Asia/Tokyo' });
    expect(full.answer).toBe('true');
    expect(full.facts.lunations).toHaveLength(1);
    expect((await at({ kind: 'phase', phase: 'new', date: '2026-10-26', zone: 'Asia/Tokyo' })).answer).toBe('false');
    expect((await at({ kind: 'phase', phase: 'full', date: '2026-10-26' })).answer).toBe('depends');

    const anyZone = await at({ kind: 'sign', body: 'Sun', sign: 'libra', date: '2026-10-01' });
    expect(anyZone).toMatchObject({ answer: 'true', basis: 'any-zone-day', window: { from: '2026-09-30T10:00:00.000Z', to: '2026-10-02T12:00:00.000Z' } });

    for (const date of ['2026-01-05', '2026-04-18', '2026-07-30', '2026-12-02']) {
      await prepareLocalTime(date, 'Asia/Tokyo');
      const day = await at({ kind: 'phase', phase: 'full', date, zone: 'Asia/Tokyo' });
      expect(day.window.from).toBe(resolveLocalToUtc(date, '00:00', 'Asia/Tokyo').utc.toISOString());
      for (const lunation of day.facts.lunations) {
        expect(Date.parse(lunation.at)).toBeGreaterThanOrEqual(Date.parse(day.window.from));
        expect(Date.parse(lunation.at)).toBeLessThan(Date.parse(day.window.to));
      }
    }
  });
});

describe('compute API through the compatibility function', () => {
  it('answers every compute route from api/compatibility.ts before any route of its own', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: false });
    for (const endpoint of COMPUTE_ENDPOINTS) {
      const deployed = await run(compatibilityHandler, { endpoint, body: VALID[endpoint] });
      const direct = await call(endpoint, VALID[endpoint]);
      expect(deployed.status, endpoint).toBe(200);
      expect(deployed.text, endpoint).toBe(direct.text);
      expectCommonHeaders(deployed.headers);
    }
    const get = await run(compatibilityHandler, { endpoint: 'chart', method: 'GET', contentType: null });
    expect(get.status).toBe(405);
    expect(get.json.error.code).toBe('method-not-allowed');
    // An unknown compute route is the compute API's 404, not an invite's.
    const unknown = await run(compatibilityHandler, { endpoint: 'natal' as ComputeEndpoint, body: CHART });
    expect(unknown.status).toBe(404);
    expect(unknown.json.error.code).toBe('not-found');
    expect(vi.mocked(checkRateLimit).mock.calls.every(([id]) => id === COMPUTE_RATE_LIMIT_ID || id === COMPUTE_EVENTS_RATE_LIMIT_ID)).toBe(true);
  });

  it("leaves the function's own routes alone when the compute parameter is absent", async () => {
    const response = await run(compatibilityHandler, { endpoint: null, method: 'GET', contentType: null, query: { action: 'no-such-action' } });
    expect(response.status).toBe(404);
    expect(response.json).toEqual({ error: 'not_found' });
  });
});
