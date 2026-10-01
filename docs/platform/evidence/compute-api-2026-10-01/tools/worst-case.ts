/**
 * The costliest request each endpoint allows, over every year the API takes,
 * and what one address can spend under the rate limits.
 *
 *   npx vite-node --script docs/platform/evidence/compute-api-2026-10-01/tools/worst-case.ts > worst-case.json
 *
 * Every request goes through the production adapter and its generated
 * stateless bundles, after module-load warmup, one at a time. Request-private
 * caches are intentionally empty for every call. Each is timed twice: wall time, and
 * the CPU time the process spent on it (process.cpuUsage, user plus system),
 * a local estimate, not Vercel metering. Other work on a shared machine
 * disturbs it less than wall time, but compilation and GC still affect it. The shapes:
 *
 * - events at the window limit, every body and kind, in windows that tile
 *   every year from 1800 to 2199 (four a year);
 * - positions at the instant limit, every body, one request a year;
 * - chart in each of the thirteen house systems, sky facts of each kind on a
 *   date in every zone, and local times, across the years.
 *
 * The bound multiplies the slowest request of each kind by the requests the
 * rules let one address make in a minute: RATE_LIMIT_RULES in
 * src/lib/compute-api/constants.ts.
 */
import { cpus } from 'node:os';
import handler from '../../../../../api/_compute/handler';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { BUDGETS, COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, EPOCH, HOUSE_SYSTEM_NAMES, RATE_LIMIT_RULES } from '../../../../../src/lib/compute-api/constants';
import { run } from '../../../../../scripts/lib/compute-api-harness';
// Real hosted adapter, generated stateless engine and per-request resolver.
// The SDK executes, but its network response is an in-process allow stub.
// No production traffic, logging, billing lookup or environment-value reads.
process.env.NODE_ENV = 'production';
globalThis.fetch = async () => new Response(null, { status: 204 });
const digest = (path: string) => createHash('sha256').update(readFileSync(new URL(path, import.meta.url))).digest('hex');

const DAY = 86_400_000;
const LAST = Date.parse(EPOCH.to);
const iso = (ms: number) => new Date(ms).toISOString();
const YEARS = Array.from({ length: EPOCH.lastYear - EPOCH.firstYear + 1 }, (_, index) => EPOCH.firstYear + index);
const WINDOW = BUDGETS['events.windowDays'];

type Body = Record<string, unknown>;
interface Shape { name: string; endpoint: any; bodies: Body[] }

function windows(days: number, perYear: number): Body[] {
  return YEARS.flatMap((year) => Array.from({ length: perYear }, (_, index) => {
    const from = Date.UTC(year, 0, 1) + Math.round((index * 365.25 * DAY) / perYear / DAY) * DAY;
    return { from, to: Math.min(from + days * DAY, LAST) };
  })).filter(({ from, to }) => to > from).map(({ from, to }) => ({ from: iso(from), to: iso(to) }));
}

const chartBodies = YEARS.filter((year) => year % 2 === 0).map((year, index) => ({
  utc: iso(Date.UTC(year, index % 12, 1 + (index % 28), 13, 37)), latitude: 64.1466, longitude: -21.9426, houseSystem: HOUSE_SYSTEM_NAMES[index % 13],
}));
const shapes: Shape[] = [
  { name: `events, ${WINDOW} days (the limit), all bodies and kinds, four windows a year 1800-2199`, endpoint: 'events', bodies: windows(WINDOW, 4) },
  { name: `positions, ${BUDGETS['positions.instants']} instants (the limit), all bodies, one request a year 1800-2199`, endpoint: 'positions', bodies: YEARS.map((year) => ({
    instants: Array.from({ length: BUDGETS['positions.instants'] }, (_, index) => iso(Date.UTC(year, 0, 1) + Math.floor(index * 3.65 * DAY))),
  })) },
  { name: 'chart, rotating all 13 house systems, even years 1800-2198', endpoint: 'chart', bodies: chartBodies },
  { name: 'houses, rotating all 13 house systems, even years 1800-2198', endpoint: 'houses', bodies: chartBodies },
  { name: 'sky-fact, each kind on a date in every zone, 1800-2199', endpoint: 'sky-fact', bodies: YEARS.map((year, index) => {
    const date = iso(Date.UTC(year, index % 12, 1 + (index % 28))).slice(0, 10);
    return [
      { kind: 'sign', body: 'Moon', sign: 'aries', date },
      { kind: 'retrograde', body: 'Mercury', date },
      { kind: 'ingress', body: 'Moon', sign: 'leo', date },
      { kind: 'phase', phase: 'full', date },
    ][index % 4];
  }) },
  { name: 'time, with a longitude, 1800-2199', endpoint: 'time', bodies: YEARS.map((year) => ({
    local: { date: `${year}-06-15`, time: '12:00', zone: 'America/Mexico_City' }, longitude: -99.13,
  })) },
];

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}
const round = (value: number) => +value.toFixed(1);

const rows = [];
const started = Date.now();
for (const shape of shapes) {
  for (const body of shape.bodies.slice(0, 2)) await run(handler, { endpoint: shape.endpoint, body });
  const wall: number[] = [];
  const cpu: number[] = [];
  let slowest = { ms: 0, body: {} as Body };
  let samples = 0;
  let bytes = 0;
  for (const body of shape.bodies) {
    const cpuBefore = process.cpuUsage();
    const before = performance.now();
    const response = await run(handler, { endpoint: shape.endpoint, body });
    const ms = performance.now() - before;
    const used = process.cpuUsage(cpuBefore);
    if (response.status !== 200) throw new Error(`${shape.name}: ${response.status} ${response.text}`);
    wall.push(ms);
    cpu.push((used.user + used.system) / 1000);
    if (ms > slowest.ms) slowest = { ms, body };
    samples = Math.max(samples, response.json.receipt?.search?.samples ?? 0);
    bytes = Math.max(bytes, response.text.length);
  }
  wall.sort((a, b) => a - b);
  cpu.sort((a, b) => a - b);
  process.stderr.write(`${shape.name}: ${shape.bodies.length} requests, cpu max ${cpu.at(-1)!.toFixed(1)} ms\n`);
  rows.push({
    shape: shape.name,
    endpoint: shape.endpoint,
    requests: shape.bodies.length,
    wallMs: { p50: round(quantile(wall, 0.5)), p95: round(quantile(wall, 0.95)), max: round(wall.at(-1)!) },
    cpuMs: { p50: round(quantile(cpu, 0.5)), p95: round(quantile(cpu, 0.95)), max: round(cpu.at(-1)!) },
    slowestRequest: slowest.body,
    maxResponseBytes: bytes,
    ...(samples ? { maxSamples: samples } : {}),
  });
}

// What one address can spend in a minute: every events request the second
// rule allows, and the rest of the first rule's requests at the costliest
// other request.
const events = rows[0];
const others = rows.slice(1);
const heaviestOther = others.reduce((a, b) => (b.cpuMs.max > a.cpuMs.max ? b : a));
const general = RATE_LIMIT_RULES[COMPUTE_RATE_LIMIT_ID].requests;
const eventsPerMinute = RATE_LIMIT_RULES[COMPUTE_EVENTS_RATE_LIMIT_ID].requests;
const bound = (pick: (row: typeof events) => number) => round((eventsPerMinute * pick(events) + (general - eventsPerMinute) * pick(heaviestOther)) / 1000);

console.log(JSON.stringify({
  measured: new Date().toISOString().slice(0, 10),
  what: 'local process: real production adapter and stateless generated bundles; real Firewall SDK with network allow stub; wall and process CPU time per request; not deployed latency or billed resource usage',
  bundleSha256: { compute: digest('../../../../../api/_compute/compute.mjs'), localTime: digest('../../../../../api/_compute/local-time.mjs') },
  runtime: { node: process.version, tzdb: process.versions.tz, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
  minutes: round((Date.now() - started) / 60_000),
  rules: RATE_LIMIT_RULES,
  rows,
  perAddressPerMinute: {
    how: `${eventsPerMinute} events requests at the slowest events request, and ${general - eventsPerMinute} more requests at the slowest other request (${heaviestOther.endpoint}), in seconds`,
    cpuSecondsAtMax: bound((row) => row.cpuMs.max),
    cpuSecondsAtP95: bound((row) => row.cpuMs.p95),
    wallSecondsAtMax: bound((row) => row.wallMs.max),
  },
}, null, 2));
