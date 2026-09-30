/**
 * The hosted compute API's fixed vocabulary: its six endpoints, the limits
 * every request crosses, and the names its errors and receipts use. Nothing
 * here imports the engine or a Node module, so the developer page and the
 * OpenAPI builder can read it without pulling calculation code into a build.
 *
 * Decision record: docs/platform/programme/DECISIONS-2026-09-28.md §5 and the
 * record of 2026-09-29 §5. Budgets and the measurements behind them:
 * docs/platform/evidence/compute-api-2026-09-29/README.md.
 */

export const COMPUTE_ENDPOINTS = Object.freeze([
  'chart', 'positions', 'houses', 'events', 'time', 'sky-fact',
] as const);
export type ComputeEndpoint = (typeof COMPUTE_ENDPOINTS)[number];

/**
 * vercel.json rewrites each public path to the site's existing compatibility
 * function with this parameter set, and that function hands the request to
 * api/_compute/handler.ts before any route of its own, as the Games and the
 * chart previews are served, so the API adds no deployed function. The
 * parameter is the only part of any query string the compute API reads.
 */
export const COMPUTE_ROUTE_PARAM = '__zodiacs_compute';
export const COMPUTE_FUNCTION_PATH = '/api/compatibility';

export const COMPUTE_ORIGIN = 'https://zodiacs.org';
export const COMPUTE_PATH_PREFIX = '/api/v1/';
export const COMPUTE_DOCS_URL = `${COMPUTE_ORIGIN}/developers/compute/`;

export function computePath(endpoint: ComputeEndpoint): string {
  return `${COMPUTE_PATH_PREFIX}${endpoint}`;
}

/** The documentation anchor a response's `cite.url` points at. */
export function computeDocsUrl(endpoint: ComputeEndpoint): string {
  return `${COMPUTE_DOCS_URL}#${endpoint}`;
}

/** Uses Vercel's per-address Firewall counters; the matching rule must use this exact ID. */
export const COMPUTE_RATE_LIMIT_ID = 'zodiacs-compute-api';
/** A second counter for the events endpoint alone, the costliest request; also a rule the owner publishes. */
export const COMPUTE_EVENTS_RATE_LIMIT_ID = 'zodiacs-compute-events';

/**
 * The Firewall rules the owner publishes (docs/OWNER-SETUP-RUNBOOK.md §3):
 * requests per address in each 60-second window. Every compute request is
 * counted under the first; an events request under both. The endpoints answer
 * only while both rules are in place: see computeApiRateLimit in handler.ts.
 * The worst case these allow is worked out in
 * docs/platform/evidence/compute-api-2026-09-29/README.md.
 */
export const RATE_LIMIT_RULES = Object.freeze({
  [COMPUTE_RATE_LIMIT_ID]: Object.freeze({ requests: 40, windowSeconds: 60 }),
  [COMPUTE_EVENTS_RATE_LIMIT_ID]: Object.freeze({ requests: 10, windowSeconds: 60 }),
});

/**
 * What a rate-limit check found: the Firewall counted the request and let it
 * through, counted it and refused it, or could not count it.
 */
export type RateLimitVerdict = 'allowed' | 'limited' | 'unavailable';

/** The rules a request to each endpoint is counted under, in the order they are checked. */
export function rateLimitIds(endpoint: ComputeEndpoint): readonly string[] {
  return endpoint === 'events' ? [COMPUTE_RATE_LIMIT_ID, COMPUTE_EVENTS_RATE_LIMIT_ID] : [COMPUTE_RATE_LIMIT_ID];
}

/** `COMPUTE_API_ENABLED=0` turns the endpoints off; unset or any other value leaves them on. */
export const COMPUTE_SWITCH_ENV = 'COMPUTE_API_ENABLED';

export const RETRY_AFTER_SECONDS = Object.freeze({
  rateLimited: 60,
  rateLimitUnavailable: 300,
  disabled: 3600,
});

/**
 * Sent with every response, success or refusal; a refusal adds Allow (405)
 * or Retry-After (429, 503), and nothing else.
 */
export const RESPONSE_HEADERS = Object.freeze({
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Retry-After',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
});

/** The answer to a CORS preflight, before anything else is checked. */
export const PREFLIGHT_HEADERS = Object.freeze({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex',
});

/** Requests over this many bytes are refused with 413 before they are parsed. */
export const MAX_BODY_BYTES = 16_384;

/**
 * The instants every endpoint accepts: the years the site's own forms accept
 * (1800 to 2199), which is also where the engine's positions have been
 * compared with an independent ephemeris (its REFERENCE_SPAN).
 */
export const EPOCH = Object.freeze({
  from: '1800-01-01T00:00:00.000Z',
  to: '2199-12-31T23:59:59.999Z',
  firstYear: 1800,
  lastYear: 2199,
});

/**
 * Compute budgets. A request over one is refused whole with a
 * `budget-exhausted` error naming the limit, before any calculation runs,
 * except `events.samples` and `sky-fact.samples`, which bound the crossing
 * searches as they run and refuse the whole request when spent.
 */
export const BUDGETS = Object.freeze({
  'positions.instants': 100,
  'events.windowDays': 92,
  'events.samples': 12_000,
  'sky-fact.samples': 1_000,
});
export type BudgetName = keyof typeof BUDGETS;

/** The sentence a `budget-exhausted` error gives for each limit. */
export const BUDGET_MESSAGES: Readonly<Record<BudgetName, string>> = Object.freeze({
  'positions.instants': `A positions request takes at most ${BUDGETS['positions.instants']} instants.`,
  'events.windowDays': `An events window is at most ${BUDGETS['events.windowDays']} days long.`,
  'events.samples': `The event searches would need more than ${BUDGETS['events.samples']} evaluations.`,
  'sky-fact.samples': `The fact's searches would need more than ${BUDGETS['sky-fact.samples']} evaluations.`,
});

/**
 * Crossing-search steps, in days. The engine's default is 5; the Moon moves
 * about 13° a day, so its sign changes are sampled daily, and so is the
 * Moon–Sun elongation behind every lunation.
 */
export const SEARCH_STEP_DAYS = Object.freeze({
  default: 5,
  moon: 1,
  elongation: 1,
});

/** Error codes, stable within v1. */
export const ERROR_CODES = Object.freeze([
  'not-found',
  'method-not-allowed',
  'disabled',
  'rate-limited',
  'rate-limit-unavailable',
  'unsupported-media-type',
  'payload-too-large',
  'invalid-json',
  'invalid-request',
  'budget-exhausted',
  'calculation-failed',
] as const);
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_STATUS: Readonly<Record<ErrorCode, number>> = Object.freeze({
  'not-found': 404,
  'method-not-allowed': 405,
  disabled: 503,
  'rate-limited': 429,
  'rate-limit-unavailable': 503,
  'unsupported-media-type': 415,
  'payload-too-large': 413,
  'invalid-json': 400,
  'invalid-request': 400,
  'budget-exhausted': 422,
  'calculation-failed': 500,
});

/**
 * The engine's thirteen house systems, in its HOUSE_SYSTEMS order. Written out
 * so the documentation needs no engine code; a test holds the two together.
 */
export const HOUSE_SYSTEM_NAMES = Object.freeze([
  'whole', 'placidus', 'porphyry', 'equal', 'equal-mc', 'vehlow', 'koch',
  'regiomontanus', 'campanus', 'topocentric', 'alcabitius', 'morinus', 'meridian',
] as const);

/** The ten bodies events and facts accept, in the engine's order. */
export const EVENT_BODIES = Object.freeze([
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
] as const);
export type EventBody = (typeof EVENT_BODIES)[number];

/** The twelve rows the engine's positions() returns, in its order. */
export const POSITION_BODIES = Object.freeze([
  ...EVENT_BODIES, 'North Node', 'South Node',
] as const);
export type PositionBody = (typeof POSITION_BODIES)[number];

/** Bodies that can station: the Sun and Moon never move backward. */
export const STATION_BODIES = Object.freeze([
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
] as const);

export const EVENT_KINDS = Object.freeze(['ingress', 'station', 'lunation'] as const);
export type EventKind = (typeof EVENT_KINDS)[number];

export const SIGN_SLUGS = Object.freeze([
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const);
export type SignSlug = (typeof SIGN_SLUGS)[number];

/** Moon–Sun elongation of each principal phase, in degrees. */
export const PHASES = Object.freeze({
  new: 0,
  'first-quarter': 90,
  full: 180,
  'last-quarter': 270,
} as const);
export type PhaseName = keyof typeof PHASES;
export const PHASE_NAMES = Object.freeze(Object.keys(PHASES) as PhaseName[]);

export const SKY_FACT_KINDS = Object.freeze(['sign', 'retrograde', 'ingress', 'phase'] as const);
export type SkyFactKind = (typeof SKY_FACT_KINDS)[number];

/**
 * With no zone, a date is read in every UTC offset in use today, from −12:00
 * to +14:00: from 14 hours before its UTC midnight to 36 hours after it.
 */
export const ANY_ZONE_DAY = Object.freeze({
  startHoursBeforeUtcMidnight: 14,
  endHoursAfterUtcMidnight: 36,
});

/** The pinned tzdb release under src/data/tz-history/ that the site's resolver reads before 1970. */
export const PINNED_TZDB_RELEASE = '2025c';

/** Schema names of every success body. */
export function responseSchemaName(endpoint: ComputeEndpoint): string {
  return `zodiacs.compute-api.${endpoint}.v1`;
}

export const COMPUTE_RECEIPT_SCHEMA = 'zodiacs.compute-receipt.v1';
