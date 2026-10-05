/**
 * The documented example requests, one or more per endpoint, and a request
 * for each refusal. Every date, time and place here is synthetic: none is a
 * person's birth.
 *
 * scripts/build-compute-examples.mjs runs each through the real handler and
 * writes the responses to examples.json; tests/api/compute-api-openapi.test.ts
 * runs them again, compares, and validates both against the schemas.
 */
import type { ComputeEndpoint, ErrorCode, RateLimitVerdict } from './constants.js';

export interface SuccessExample {
  summary: string;
  body: Record<string, unknown>;
}

export const SUCCESS_EXAMPLES: Readonly<Record<ComputeEndpoint, Readonly<Record<string, SuccessExample>>>> = {
  chart: {
    utc: {
      summary: 'A UTC instant at Greenwich, Placidus houses',
      body: { utc: '2000-01-01T12:00:00Z', latitude: 51.4779, longitude: -0.0015, houseSystem: 'placidus' },
    },
    local: {
      summary: 'Local civil time in an IANA zone, whole-sign houses',
      body: { local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris' }, latitude: 48.8566, longitude: 2.3522, houseSystem: 'whole' },
    },
  },
  positions: {
    two: {
      summary: 'Three bodies at two instants',
      body: { instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'], bodies: ['Sun', 'Moon', 'Mercury'] },
    },
  },
  houses: {
    koch: {
      summary: 'Koch cusps at Sydney',
      body: { utc: '2026-06-21T12:00:00Z', latitude: -33.8688, longitude: 151.2093, houseSystem: 'koch' },
    },
  },
  events: {
    october: {
      summary: 'A month of ingresses, stations and lunations for three bodies',
      body: { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', bodies: ['Sun', 'Mercury', 'Venus'], kinds: ['ingress', 'station', 'lunation'] },
    },
  },
  time: {
    pinned: {
      summary: 'A wall time before 1970 with the birthplace longitude, read on the pinned zone history',
      body: { local: { date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, longitude: 18.07 },
    },
    gap: {
      summary: 'A wall time the spring clock change skipped',
      body: { local: { date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' } },
    },
  },
  elections: {
    london: {
      summary: 'Three days in London with the Moon waxing and not void of course, Mercury direct and Jupiter in an angular house',
      body: {
        from: '2026-12-09T00:00:00Z',
        to: '2026-12-12T00:00:00Z',
        conditions: [
          { kind: 'phase', phase: 'waxing' },
          { kind: 'void-of-course', not: true },
          { kind: 'retrograde', body: 'Mercury', not: true },
          { kind: 'angular', body: 'Jupiter' },
        ],
        place: { latitude: 51.5072, longitude: -0.1276, houseSystem: 'placidus' },
      },
    },
  },
  'sky-fact': {
    retrograde: {
      summary: 'Is Mercury retrograde on a date in a zone? It stations that day.',
      body: { kind: 'retrograde', body: 'Mercury', date: '2026-10-24', zone: 'America/New_York' },
    },
    phase: {
      summary: 'Is there a full moon on a date, in every zone?',
      body: { kind: 'phase', phase: 'full', date: '2026-10-26' },
    },
    sign: {
      summary: 'Is the Moon in Aries at an instant?',
      body: { kind: 'sign', body: 'Moon', sign: 'aries', instant: '2026-09-29T12:00:00Z' },
    },
  },
};

export interface RefusalExample {
  summary: string;
  code: ErrorCode;
  /** null: the request reaches the function without one of the seven endpoint names. */
  endpoint: ComputeEndpoint | null;
  method: string;
  contentType: string | null;
  /** A JSON body, or raw text sent as it is. */
  body: Record<string, unknown> | string | null;
  /** Declared Content-Length, when the example is about it. */
  contentLength?: number;
  env?: Record<string, string>;
  /** What the Firewall answers; allowed when omitted. */
  rateLimit?: RateLimitVerdict;
}

const json = 'application/json';

/** One refusal per status code the operations document, each reproducible against the handler. */
export const REFUSAL_EXAMPLES: Readonly<Record<string, RefusalExample>> = {
  'not-found': {
    summary: 'The function reached without an endpoint name',
    code: 'not-found',
    endpoint: null,
    method: 'POST',
    contentType: json,
    body: { utc: '2000-01-01T12:00:00Z', latitude: 51.4779, longitude: -0.0015 },
  },
  'invalid-request': {
    summary: 'A latitude at a pole',
    code: 'invalid-request',
    endpoint: 'chart',
    method: 'POST',
    contentType: json,
    body: { utc: '2000-01-01T12:00:00Z', latitude: 90, longitude: 0 },
  },
  'invalid-json': {
    summary: 'A body that is not JSON',
    code: 'invalid-json',
    endpoint: 'chart',
    method: 'POST',
    contentType: json,
    body: '{"utc": ',
  },
  'method-not-allowed': {
    summary: 'A GET',
    code: 'method-not-allowed',
    endpoint: 'positions',
    method: 'GET',
    contentType: null,
    body: null,
  },
  'payload-too-large': {
    summary: 'A body declared larger than 16384 bytes',
    code: 'payload-too-large',
    endpoint: 'positions',
    method: 'POST',
    contentType: json,
    body: null,
    contentLength: 20_000,
  },
  'unsupported-media-type': {
    summary: 'A body sent as text/plain',
    code: 'unsupported-media-type',
    endpoint: 'time',
    method: 'POST',
    contentType: 'text/plain',
    body: '{}',
  },
  'budget-exhausted': {
    summary: 'An events window longer than 92 days',
    code: 'budget-exhausted',
    endpoint: 'events',
    method: 'POST',
    contentType: json,
    body: { from: '2026-01-01T00:00:00Z', to: '2026-07-01T00:00:00Z' },
  },
  'rate-limited': {
    summary: 'Over the per-address rate limit',
    code: 'rate-limited',
    endpoint: 'houses',
    method: 'POST',
    contentType: json,
    body: { utc: '2026-06-21T12:00:00Z', latitude: -33.8688, longitude: 151.2093 },
    rateLimit: 'limited',
  },
  'rate-limit-unavailable': {
    summary: 'The rate limit is not in place, or could not be checked',
    code: 'rate-limit-unavailable',
    endpoint: 'chart',
    method: 'POST',
    contentType: json,
    body: { utc: '2026-06-21T12:00:00Z', latitude: -33.8688, longitude: 151.2093 },
    rateLimit: 'unavailable',
  },
  disabled: {
    summary: 'The switch is off',
    code: 'disabled',
    endpoint: 'sky-fact',
    method: 'POST',
    contentType: json,
    body: { kind: 'phase', phase: 'new', date: '2026-10-10' },
    env: { COMPUTE_API_ENABLED: '0' },
  },
  'calculation-failed': {
    summary: 'The engine could not complete the calculation',
    code: 'calculation-failed',
    endpoint: 'time',
    method: 'POST',
    contentType: json,
    body: { local: { date: '2026-03-29', time: '02:30', zone: 'Europe/Paris' } },
  },
};
