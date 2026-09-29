import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit } from '@vercel/firewall';
import {
  ENGINE_VERSION,
  HOUSE_SYSTEMS,
  deltaTAt,
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
import { computeApiRateLimited, createComputeApiHandler } from '../../src/lib/compute-api/handler';
import * as localTime from '../../src/lib/compute-api/local-time-source';
import { prepareLocalTime, resolveLocalToUtc } from '../../src/lib/time/localToUtc';
import { run, type HarnessRequest } from '../../scripts/lib/compute-api-harness';
import compatibilityHandler from '../../api/compatibility.js';

vi.mock('@vercel/firewall', () => ({ checkRateLimit: vi.fn() }));

const handler = createComputeApiHandler({ localTime, env: {}, isRateLimited: async () => false });
const call = (endpoint: ComputeEndpoint | null, body?: unknown, extra: Partial<HarnessRequest> = {}) =>
  run(handler, { endpoint, body, ...extra });
const DAY = 86_400_000;
const J2000_UT_MS = Date.UTC(2000, 0, 1, 12);

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
    const off = createComputeApiHandler({ localTime, env: { COMPUTE_API_ENABLED: '0' }, isRateLimited: async () => false });
    const refused = await run(off, { endpoint: 'positions', body: VALID.positions });
    expect(refused.status).toBe(503);
    expect(refused.headers.get('retry-after')).toBe('3600');
    expect(refused.json).toEqual({ error: {
      code: 'disabled', message: 'The compute API is switched off. Try again later.', retryAfterSeconds: 3600,
    } });
    expect((await run(off, { endpoint: 'positions', method: 'OPTIONS', contentType: null })).status).toBe(204);
    for (const value of [undefined, '', '1', 'false', 'no', '00', ' 0']) {
      const on = createComputeApiHandler({ localTime, env: value === undefined ? {} : { COMPUTE_API_ENABLED: value }, isRateLimited: async () => false });
      expect((await run(on, { endpoint: 'positions', body: VALID.positions })).status, String(value)).toBe(200);
    }
  });

  it('answers 429 with Retry-After when the Firewall rule limits the address', async () => {
    const limited = createComputeApiHandler({ localTime, env: {}, isRateLimited: async () => true });
    const response = await run(limited, { endpoint: 'chart', body: CHART });
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.json.error).toEqual({
      code: 'rate-limited',
      message: 'Too many requests from this address. Try again after the interval in Retry-After.',
      retryAfterSeconds: 60,
    });
  });

  it('checks the zodiacs-compute-api rule with the headers only, and fails open when it is missing or errors', async () => {
    const req = { headers: { host: 'zodiacs.org', 'x-real-ip': '203.0.113.9' } };
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: true });
    expect(await computeApiRateLimited(req)).toBe(true);
    expect(checkRateLimit).toHaveBeenLastCalledWith(COMPUTE_RATE_LIMIT_ID, { headers: req.headers });
    expect(COMPUTE_RATE_LIMIT_ID).toBe('zodiacs-compute-api');
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: false });
    expect(await computeApiRateLimited(req)).toBe(false);
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ rateLimited: true, error: 'not-found' } as never);
    expect(await computeApiRateLimited(req)).toBe(false);
    vi.mocked(checkRateLimit).mockRejectedValueOnce(new Error('network'));
    expect(await computeApiRateLimited(req)).toBe(false);
  });

  it('counts a request against the limit before reading its body, and passes the limiter no body', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ rateLimited: true });
    const defaults = createComputeApiHandler({ localTime, env: {} });
    const response = await run(defaults, { endpoint: 'time', body: VALID.time });
    expect(response.status).toBe(429);
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
    expect((await call('chart', local({ zone: 'europe/paris' }))).status).toBe(200);
  });

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

  it("names the ΔT model and table, the engine's conventions and coverage, and each search's limits", async () => {
    const chart = await call('chart', CHART);
    const { json } = await call('events', VALID.events);
    expect(json.receipt.conventions).toEqual(chart.json.receipt.conventions);
    expect(json.receipt.coverage).toEqual(chart.json.receipt.coverage);
    expect(json.receipt.deltaT).toEqual({ model: 'zodiacs-deltat/1', table: chart.json.result.deltaT.table, tableDigest: chart.json.result.deltaT.tableDigest });
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
      });
      expect(answer.receipt).toEqual(JSON.parse(JSON.stringify(receipt)));
      const houses = (await call('houses', request)).json;
      expect(houses.result).toEqual({
        instant: '1987-03-14T04:42:00.000Z', local: null, angles: expected.angles, houses: expected.houses, flags: expected.flags, deltaT: expected.deltaT,
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

  it('positions returns positions() rows, the ΔT a chart at that instant is computed with, and the reference-span flag', async () => {
    const instants = ['1800-01-01T00:00:00Z', '1969-07-20T20:17:40Z', '2026-09-29T12:00:00Z', '2199-12-31T23:59:59Z'];
    const { json } = await call('positions', { instants, bodies: ['Moon', 'Sun', 'South Node'] });
    json.result.instants.forEach((row: any, index: number) => {
      const at = new Date(instants[index]);
      expect(row.instant).toBe(at.toISOString());
      expect(row.bodies).toEqual(JSON.parse(JSON.stringify(positions(at).filter((body) => ['Sun', 'Moon', 'South Node'].includes(body.body)))));
      expect(row.deltaT).toEqual(natalChart({ utc: at, timeKnown: false }).deltaT);
      expect(row.deltaT).toEqual(deltaTAt((at.getTime() - J2000_UT_MS) / DAY));
      expect(row.flags).toEqual(outsideReferenceSpan(at) ? ['outside-reference-span'] : []);
    });
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
    const { json } = await call('events', { from: '2026-01-01T00:00:00Z', to: '2027-01-01T00:00:00Z', bodies: EVENT_BODIES.filter((body) => body !== 'Moon') });
    const found = json.result.events.map((event: any) => ({
      key: event.kind === 'station' ? `station ${event.body} ${event.type}` : event.kind === 'lunation' ? `lunation ${event.type}` : `ingress ${event.body} ${event.sign}`,
      at: Date.parse(event.at),
    }));
    expect(found).toHaveLength(published.length);
    for (const row of published) {
      const match = found.find((event: any) => event.key === row.key && Math.abs(event.at - row.at) < 5 * 60_000);
      expect(match, `${row.key} ${new Date(row.at).toISOString()}`).toBeDefined();
    }
  }, 60_000);

  it("time is the site resolver's answer, TT is UTC plus ΔT, and the zone history is named", async () => {
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
      const deltaT = natalChart({ utc: resolved.utc, timeKnown: false }).deltaT;
      expect(answer.utc).toBe(resolved.utc.toISOString());
      expect(answer.offsetMinutes).toBe(resolved.offsetMinutes);
      expect(answer.flags).toEqual(resolved.flags);
      expect(answer.localMeanTime).toEqual(resolved.localMeanTime ?? null);
      expect(answer.zoneHistory, `${local.date} ${local.zone}`).toBe(history);
      expect(answer.zoneUncertain).toBe(uncertain);
      expect(answer.deltaT).toEqual(deltaT);
      expect(answer.tt).toBe(new Date(resolved.utc.getTime() + Math.round(deltaT.seconds * 1000)).toISOString().slice(0, -1));
    }
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
    expect(vi.mocked(checkRateLimit).mock.calls.every(([id]) => id === COMPUTE_RATE_LIMIT_ID)).toBe(true);
  });

  it("leaves the function's own routes alone when the compute parameter is absent", async () => {
    const response = await run(compatibilityHandler, { endpoint: null, method: 'GET', contentType: null, query: { action: 'no-such-action' } });
    expect(response.status).toBe(404);
    expect(response.json).toEqual({ error: 'not_found' });
  });
});
