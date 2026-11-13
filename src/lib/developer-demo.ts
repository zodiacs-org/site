/**
 * The developer demo (/developers/demo/): three sample questions, the requests
 * that ask them of the compute API and of an MCP server, and the plain answer
 * read from what the real code returned. Nothing here calculates.
 *
 * scripts/build-developer-demo.ts runs each preset through the compute API's
 * own dispatch (src/lib/compute-api/playground.ts, which
 * tests/api/compute-api-playground.test.ts holds to the hosted handler) and
 * through the hosted MCP server's get_compatibility tool, and writes
 * src/data/developer-demo.json, which the page shows first. A request the
 * visitor edits runs in the browser with the playground's bundle of the same
 * code (public/developers/playground/engine.mjs). The demo sends nothing to
 * the API itself: it shows the cURL command and MCP call instead.
 */
import { COMPUTE_ORIGIN, BUDGETS, type ComputeEndpoint } from './compute-api/constants';
import { codeSamples } from './developer-playground';
import { formatLongitude } from './signs';

export const DEMO_PATH = '/developers/demo/';
export const DEMO_DATA_SCHEMA = 'zodiacs.developer-demo.v1';
export const MCP_URL = `${COMPUTE_ORIGIN}/mcp`;
/** The protocol version the hosted server's own tests send. */
export const MCP_PROTOCOL_VERSION = '2025-06-18';

export const QUESTION_IDS = ['chart', 'mercury', 'compatibility'] as const;
export type QuestionId = (typeof QUESTION_IDS)[number];

export const QUESTION_LABELS: Readonly<Record<QuestionId, string>> = {
  chart: 'A birth chart for a date, time and place',
  mercury: 'When Mercury next turns retrograde',
  compatibility: 'How two sample charts compare',
};

// ── Birth chart ─────────────────────────────────────────────────────

export interface ChartInput {
  date: string;
  time: string;
  zone: string;
  latitude: number;
  longitude: number;
  /** Display only: the request carries the coordinates and the zone. */
  place: string;
}

/** The compute API's documented local-time example (src/lib/compute-api/examples.ts, chart.local). */
export const CHART_PRESET: Readonly<ChartInput> = Object.freeze({
  date: '1990-06-15',
  time: '14:30',
  zone: 'Europe/Paris',
  latitude: 48.8566,
  longitude: 2.3522,
  place: 'Paris, France',
});

export const CHART_HOUSE_SYSTEM = 'whole';

export function chartBody(input: ChartInput) {
  return {
    local: { date: input.date, time: input.time, zone: input.zone },
    latitude: input.latitude,
    longitude: input.longitude,
    houseSystem: CHART_HOUSE_SYSTEM,
  };
}

// ── Mercury retrograde ──────────────────────────────────────────────

export interface MercuryInput {
  /** YYYY-MM-DD: the search starts at 00:00 UTC on this date. */
  after: string;
}

export const MERCURY_PRESET: Readonly<MercuryInput> = Object.freeze({ after: '2026-11-01' });

/** An events window is at most this many days long, so the demo asks window by window. */
export const MERCURY_WINDOW_DAYS = BUDGETS['events.windowDays'];
/**
 * Mercury turns retrograde about every 116 days and stays so for about three
 * weeks, so three windows of 92 days always hold the next retrograde station
 * and the direct station after it.
 */
export const MERCURY_MAX_WINDOWS = 3;

const DAY_MS = 86_400_000;

/** The events request for the `index`th window after `after`. */
export function mercuryBody(input: MercuryInput, index: number) {
  const start = Date.parse(`${input.after}T00:00:00Z`) + index * MERCURY_WINDOW_DAYS * DAY_MS;
  return {
    from: new Date(start).toISOString().replace('.000Z', 'Z'),
    to: new Date(start + MERCURY_WINDOW_DAYS * DAY_MS).toISOString().replace('.000Z', 'Z'),
    bodies: ['Mercury'],
    kinds: ['station'],
  };
}

export interface Station {
  kind: 'station';
  body: string;
  at: string;
  type: 'retrograde' | 'direct';
  lon: number;
  sign: string;
  degree: number;
}

/** The first retrograde station in the answers, in time order, and the direct station after it. */
export function mercuryStations(answers: readonly unknown[]): { retrograde: Station | null; direct: Station | null } {
  const stations = answers
    .flatMap((answer) => ((answer as { result?: { events?: Station[] } })?.result?.events ?? []))
    .filter((event) => event.kind === 'station' && event.body === 'Mercury')
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const retrograde = stations.find((event) => event.type === 'retrograde') ?? null;
  const direct = retrograde
    ? stations.find((event) => event.type === 'direct' && Date.parse(event.at) > Date.parse(retrograde.at)) ?? null
    : null;
  return { retrograde, direct };
}

/** Whether the windows asked so far answer the question, so no further window is needed. */
export function mercuryAnswered(answers: readonly unknown[]): boolean {
  return mercuryStations(answers).direct !== null;
}

// ── Compatibility ───────────────────────────────────────────────────

export interface CompatibilityPersonInput {
  birthDate: string;
  time: string;
  zone: string;
  latitude: number;
  longitude: number;
  place: string;
}

/** Two synthetic births: nobody's real chart. */
export const COMPATIBILITY_PRESET: Readonly<{ a: CompatibilityPersonInput; b: CompatibilityPersonInput }> = Object.freeze({
  a: { birthDate: '1992-03-08', time: '09:15', zone: 'Europe/Lisbon', latitude: 38.7223, longitude: -9.1393, place: 'Lisbon, Portugal' },
  b: { birthDate: '1989-11-21', time: '18:40', zone: 'America/Toronto', latitude: 43.6532, longitude: -79.3832, place: 'Toronto, Canada' },
});

// ── The calls ───────────────────────────────────────────────────────

export function computeCurl(endpoint: ComputeEndpoint, body: unknown): string {
  return codeSamples(endpoint, JSON.stringify(body)).curl;
}

/** A JSON-RPC tools/call message, as an MCP client sends it. */
export function mcpCall(name: string, args: unknown, id = 1) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } };
}

/** The hosted server answers a single stateless POST; no session is needed first. */
export function mcpCurl(name: string, args: unknown): string {
  const body = JSON.stringify(mcpCall(name, args));
  return [
    `curl --silent --show-error ${MCP_URL} \\`,
    "  --header 'Content-Type: application/json' \\",
    "  --header 'Accept: application/json, text/event-stream' \\",
    `  --header 'MCP-Protocol-Version: ${MCP_PROTOCOL_VERSION}' \\`,
    `  --data-raw '${body.replaceAll("'", "'\\''")}'`,
  ].join('\n');
}

export function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// ── Plain words ─────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 2026-11-01 → 1 November 2026. */
export function longDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** An instant as its UTC date and minute: 9 February 2027, 14:05 UTC. */
export function utcMinute(instant: string): string {
  const iso = new Date(instant).toISOString();
  return `${longDate(iso.slice(0, 10))}, ${iso.slice(11, 16)} UTC`;
}

/** A UTC offset in minutes as UTC+2 or UTC-3:30. */
export function offsetLabel(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `UTC${sign}${hours}${rest ? `:${String(rest).padStart(2, '0')}` : ''}`;
}

export function position(lon: number): string {
  return formatLongitude(lon);
}

export function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
