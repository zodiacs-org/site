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
 * api/_compute/handler.ts before any route of its own: the plan's function
 * count is at its cap, as the Games and the chart previews found. The
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

/** `COMPUTE_API_ENABLED=0` turns the endpoints off; unset or any other value leaves them on. */
export const COMPUTE_SWITCH_ENV = 'COMPUTE_API_ENABLED';

export const RETRY_AFTER_SECONDS = Object.freeze({
  rateLimited: 60,
  disabled: 3600,
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
  'events.windowDays': 366,
  'events.samples': 40_000,
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
