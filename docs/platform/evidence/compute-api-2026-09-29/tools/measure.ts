/**
 * Single-request cost of every compute endpoint, through the real handler with
 * the bundled local-time resolver the function deploys, warm, on this machine.
 *
 *   npx vite-node --script docs/platform/evidence/compute-api-2026-09-29/tools/measure.ts > measurements.json
 *
 * Each shape runs `runs` times after two warm-up requests; the output gives
 * the median, 95th percentile and maximum in milliseconds, the response size,
 * and, for the searches, the evaluations each request made. The worst shapes
 * are the budgets themselves: 100 instants for positions, and a window at the
 * limit with every body and kind for events, in years across the whole epoch.
 * tools/worst-case.ts runs the budget shapes in every year.
 */
import { cpus } from 'node:os';
import { createComputeApiHandler } from '../../../../../src/lib/compute-api/handler';
import { BUDGETS } from '../../../../../src/lib/compute-api/constants';
import { run } from '../../../../../scripts/lib/compute-api-harness';
import * as localTime from '../../../../../api/_compute/local-time.mjs';

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });

type Shape = { name: string; endpoint: any; body: (index: number) => unknown; runs: number };

const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const spread = (index: number, runs: number) => Date.UTC(1800, 0, 2) + Math.floor(((Date.UTC(2199, 11, 30) - Date.UTC(1800, 0, 2)) * index) / Math.max(1, runs - 1) / DAY) * DAY;
const HOUSES = ['whole', 'placidus', 'porphyry', 'equal', 'equal-mc', 'vehlow', 'koch', 'regiomontanus', 'campanus', 'topocentric', 'alcabitius', 'morinus', 'meridian'];
const YEARS = [1800, 1850, 1900, 1950, 2000, 2026, 2050, 2100, 2150, 2198];

const shapes: Shape[] = [
  { name: 'chart utc, Placidus, 1800-2199', endpoint: 'chart', runs: 60, body: (i) => ({ utc: iso(spread(i, 60) + 13 * 3600_000), latitude: 40.4168, longitude: -3.7038 }) },
  { name: 'chart local before 1970, pinned history', endpoint: 'chart', runs: 40, body: (i) => ({ local: { date: `19${String(10 + (i % 50)).padStart(2, '0')}-03-14`, time: '06:42', zone: 'Europe/Stockholm' }, latitude: 59.3293, longitude: 18.0686 }) },
  { name: 'houses, each of the 13 systems', endpoint: 'houses', runs: 65, body: (i) => ({ utc: iso(spread(i, 65)), latitude: 64.1466, longitude: -21.9426, houseSystem: HOUSES[i % 13] }) },
  { name: 'positions, 1 instant', endpoint: 'positions', runs: 60, body: (i) => ({ instants: [iso(spread(i, 60))] }) },
  { name: 'positions, 100 instants, all bodies (budget)', endpoint: 'positions', runs: 20, body: (i) => ({ instants: Array.from({ length: 100 }, (_, day) => iso(Date.UTC(1800 + i * 20, 0, 1) + day * DAY).replace('.000Z', 'Z')) }) },
  { name: 'events, 31 days, all bodies and kinds', endpoint: 'events', runs: 20, body: (i) => ({ from: iso(Date.UTC(1800 + i * 20, 0, 1)), to: iso(Date.UTC(1800 + i * 20, 1, 1)) }) },
  ...YEARS.map((year): Shape => ({ name: `events, ${BUDGETS['events.windowDays']} days from ${year}-01-01, all bodies and kinds (budget)`, endpoint: 'events', runs: 3, body: () => ({ from: iso(Date.UTC(year, 0, 1)), to: iso(Math.min(Date.UTC(year, 0, 1) + BUDGETS['events.windowDays'] * DAY, Date.parse('2199-12-31T23:59:59.999Z'))) }) })),
  { name: 'time, after 1970', endpoint: 'time', runs: 60, body: (i) => ({ local: { date: `20${String(i % 100).padStart(2, '0')}-07-01`, time: '12:00', zone: 'America/New_York' } }) },
  { name: 'time, before 1970 with longitude', endpoint: 'time', runs: 60, body: (i) => ({ local: { date: `18${String(50 + (i % 50)).padStart(2, '0')}-06-01`, time: '12:00', zone: 'America/Mexico_City' }, longitude: -99.13 }) },
  { name: 'sky-fact sign at an instant', endpoint: 'sky-fact', runs: 60, body: (i) => ({ kind: 'sign', body: 'Moon', sign: 'aries', instant: iso(spread(i, 60)) }) },
  { name: 'sky-fact Moon sign on a date, any zone', endpoint: 'sky-fact', runs: 60, body: (i) => ({ kind: 'sign', body: 'Moon', sign: 'aries', date: iso(spread(i, 60)).slice(0, 10) }) },
  { name: 'sky-fact Mercury retrograde on a date, any zone', endpoint: 'sky-fact', runs: 60, body: (i) => ({ kind: 'retrograde', body: 'Mercury', date: iso(spread(i, 60)).slice(0, 10) }) },
  { name: 'sky-fact Pluto retrograde on a date in a zone', endpoint: 'sky-fact', runs: 60, body: (i) => ({ kind: 'retrograde', body: 'Pluto', date: iso(spread(i, 60)).slice(0, 10), zone: 'Asia/Tokyo' }) },
  { name: 'sky-fact full moon on a date, any zone', endpoint: 'sky-fact', runs: 60, body: (i) => ({ kind: 'phase', phase: 'full', date: iso(spread(i, 60)).slice(0, 10) }) },
  { name: 'sky-fact Moon ingress on a date, any zone', endpoint: 'sky-fact', runs: 60, body: (i) => ({ kind: 'ingress', body: 'Moon', sign: 'leo', date: iso(spread(i, 60)).slice(0, 10) }) },
];

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}

const rows = [];
for (const shape of shapes) {
  for (let warm = 0; warm < 2; warm += 1) await run(handler, { endpoint: shape.endpoint, body: shape.body(warm) });
  const times: number[] = [];
  let bytes = 0;
  let samples = 0;
  for (let index = 0; index < shape.runs; index += 1) {
    const started = performance.now();
    const response = await run(handler, { endpoint: shape.endpoint, body: shape.body(index) });
    times.push(performance.now() - started);
    if (response.status !== 200) throw new Error(`${shape.name}: ${response.status} ${response.text}`);
    bytes = Math.max(bytes, response.text.length);
    samples = Math.max(samples, response.json.receipt?.search?.samples ?? 0);
  }
  times.sort((a, b) => a - b);
  rows.push({
    shape: shape.name,
    endpoint: shape.endpoint,
    runs: shape.runs,
    ms: { p50: +quantile(times, 0.5).toFixed(1), p95: +quantile(times, 0.95).toFixed(1), max: +times.at(-1)!.toFixed(1) },
    maxResponseBytes: bytes,
    ...(samples ? { maxSamples: samples } : {}),
  });
}

console.log(JSON.stringify({
  measured: new Date().toISOString().slice(0, 10),
  what: 'warm single-request time through the handler, local-time bundle, no rate-limit call',
  runtime: { node: process.version, tzdb: process.versions.tz, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
  rows,
}, null, 2));
