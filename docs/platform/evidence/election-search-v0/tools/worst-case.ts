/**
 * The costliest request each endpoint allows, elections among them, over
 * every year the API takes, and what one address can spend in a minute under
 * the rate limits:
 *
 *   npx vite-node --script tools/worst-case.ts > worst-case.json
 *
 * The shapes and the arithmetic are those of
 * ../../compute-api-2026-09-29/tools/worst-case.ts, with four elections
 * shapes beside them: the costliest this file's sweep found
 * (tools/cost-sweep.ts). An elections request is counted under both rules,
 * as an events request is, so the bound takes the costlier of the two at
 * each measure. Every request goes through the real handler, warm, one at a
 * time, and is timed in wall and CPU time. Unlike the earlier tool, the
 * requests of every shape are run in one seeded random order, so that the
 * machine's drift over the run falls on every shape alike. An elections
 * request refused for its allowance is timed too: it ran until refused.
 */
import { cpus } from 'node:os';
import { createComputeApiHandler } from '../../../../../src/lib/compute-api/handler';
import { BUDGETS, COMPUTE_EVENTS_RATE_LIMIT_ID, COMPUTE_RATE_LIMIT_ID, EPOCH, HOUSE_SYSTEM_NAMES, RATE_LIMIT_RULES, rateLimitIds } from '../../../../../src/lib/compute-api/constants';
import { run } from '../../../../../scripts/lib/compute-api-harness';
import { createLocalTimeModule } from '../../../../../api/_compute/local-time.mjs';
import { mulberry32 } from './draw';

const handler = createComputeApiHandler({ localTime: createLocalTimeModule(), env: {}, rateLimit: async () => 'allowed' });
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

/** One elections request a year, its window starting in a month that moves on each year. */
const yearly = (body: (year: number, index: number) => Body) => YEARS.map((year, index) => body(year, index));
const month = (year: number, index: number, shift: number, day = 1) => Date.UTC(year, (index + shift) % 12, day);

const shapes: Shape[] = [
  { name: `events, ${WINDOW} days (the limit), all bodies and kinds, four windows a year 1800-2199`, endpoint: 'events', bodies: windows(WINDOW, 4) },
  { name: `positions, ${BUDGETS['positions.instants']} instants (the limit), all bodies, one request a year 1800-2199`, endpoint: 'positions', bodies: YEARS.map((year) => ({
    instants: Array.from({ length: BUDGETS['positions.instants'] }, (_, index) => iso(Date.UTC(year, 0, 1) + Math.floor(index * 3.65 * DAY))),
  })) },
  { name: 'chart, each of the 13 house systems, 1800-2199', endpoint: 'chart', bodies: YEARS.filter((year) => year % 2 === 0).map((year, index) => ({
    utc: iso(Date.UTC(year, index % 12, 1 + (index % 28), 13, 37)), latitude: 64.1466, longitude: -21.9426, houseSystem: HOUSE_SYSTEM_NAMES[index % 13],
  })) },
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
  { name: 'elections, the Moon void of course, 31 days, 1800-2199', endpoint: 'elections', bodies: yearly((year, index) => {
    const from = month(year, index, 0);
    return { from: iso(from), to: iso(from + 31 * DAY), conditions: [{ kind: 'void-of-course' }] };
  }) },
  { name: 'elections, five conditions without houses, 31 days, 1800-2199', endpoint: 'elections', bodies: yearly((year, index) => {
    const from = month(year, index, 5);
    return {
      from: iso(from),
      to: iso(from + 31 * DAY),
      conditions: [
        { kind: 'phase', phase: 'waxing' },
        { kind: 'void-of-course', not: true },
        { kind: 'retrograde', body: 'Mercury', not: true },
        { kind: 'sign', body: 'Moon', sign: ['aries', 'leo', 'libra', 'capricorn'][index % 4], not: true },
        { kind: 'retrograde', body: 'Venus' },
      ],
    };
  }) },
  { name: 'elections, the Moon angular, 4 days, 1800-2199', endpoint: 'elections', bodies: yearly((year, index) => {
    const from = month(year, index, 7, 3);
    return { from: iso(from), to: iso(from + 4 * DAY), conditions: [{ kind: 'angular', body: 'Moon' }], place: { latitude: 59.9 - (index % 3) * 40, longitude: 10.7, houseSystem: HOUSE_SYSTEM_NAMES[index % 13] } };
  }) },
  { name: 'elections, the Moon in a sign, waxing, and Mars angular, 31 days, 1800-2199', endpoint: 'elections', bodies: yearly((year, index) => {
    const from = month(year, index, 1);
    return {
      from: iso(from),
      to: iso(from + 31 * DAY),
      conditions: [{ kind: 'sign', body: 'Moon', sign: ['taurus', 'cancer', 'virgo', 'pisces'][index % 4] }, { kind: 'phase', phase: 'waxing' }, { kind: 'angular', body: 'Mars' }],
      place: { latitude: -33.9, longitude: 151.2, houseSystem: HOUSE_SYSTEM_NAMES[(index + 7) % 13] },
    };
  }) },
];

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
}
const round = (value: number) => +value.toFixed(1);

for (const shape of shapes) for (const body of shape.bodies.slice(0, 2)) await run(handler, { endpoint: shape.endpoint, body });

// Every request of every shape, in one seeded random order (Fisher-Yates with mulberry32).
const tasks = shapes.flatMap((shape, s) => shape.bodies.map((body) => ({ s, body })));
const random = mulberry32(20261005);
for (let i = tasks.length - 1; i > 0; i -= 1) {
  const j = Math.floor(random() * (i + 1));
  [tasks[i], tasks[j]] = [tasks[j], tasks[i]];
}
const measured = shapes.map(() => ({ wall: [] as number[], cpu: [] as number[], slowest: { ms: 0, body: {} as Body }, samples: 0, bytes: 0, refused: 0 }));
const started = Date.now();
for (const { s, body } of tasks) {
  const shape = shapes[s];
  const cpuBefore = process.cpuUsage();
  const before = performance.now();
  const response = await run(handler, { endpoint: shape.endpoint, body });
  const ms = performance.now() - before;
  const used = process.cpuUsage(cpuBefore);
  const refusedForAllowance = shape.endpoint === 'elections' && response.status === 422 && response.json?.error?.code === 'budget-exhausted';
  if (response.status !== 200 && !refusedForAllowance) throw new Error(`${shape.name}: ${response.status} ${response.text}`);
  const m = measured[s];
  m.wall.push(ms);
  m.cpu.push((used.user + used.system) / 1000);
  if (ms > m.slowest.ms) m.slowest = { ms, body };
  if (refusedForAllowance) m.refused += 1;
  m.samples = Math.max(m.samples, response.json?.receipt?.search?.samples ?? response.json?.receipt?.electionSearch?.samples ?? 0);
  m.bytes = Math.max(m.bytes, response.text.length);
}

const rows = shapes.map((shape, s) => {
  const m = measured[s];
  m.wall.sort((a, b) => a - b);
  m.cpu.sort((a, b) => a - b);
  process.stderr.write(`${shape.name}: ${shape.bodies.length} requests, cpu max ${m.cpu.at(-1)!.toFixed(1)} ms\n`);
  return {
    shape: shape.name,
    endpoint: shape.endpoint,
    rules: rateLimitIds(shape.endpoint),
    requests: shape.bodies.length,
    wallMs: { p50: round(quantile(m.wall, 0.5)), p95: round(quantile(m.wall, 0.95)), max: round(m.wall.at(-1)!) },
    cpuMs: { p50: round(quantile(m.cpu, 0.5)), p95: round(quantile(m.cpu, 0.95)), max: round(m.cpu.at(-1)!) },
    slowestRequest: m.slowest.body,
    maxResponseBytes: m.bytes,
    ...(m.samples ? { maxSamples: m.samples } : {}),
    ...(shape.endpoint === 'elections' ? { refusedForAllowance: m.refused } : {}),
  };
});

// What one address can spend in a minute: every request the second rule allows at the costliest request counted under it,
// events or elections, and the rest of the first rule's requests at the costliest other request.
const second = rows.filter((row) => row.rules.includes(COMPUTE_EVENTS_RATE_LIMIT_ID));
const others = rows.filter((row) => !row.rules.includes(COMPUTE_EVENTS_RATE_LIMIT_ID));
const heaviest = (list: typeof rows, pick: (row: (typeof rows)[number]) => number) => list.reduce((a, b) => (pick(b) > pick(a) ? b : a));
const general = RATE_LIMIT_RULES[COMPUTE_RATE_LIMIT_ID].requests;
const secondPerMinute = RATE_LIMIT_RULES[COMPUTE_EVENTS_RATE_LIMIT_ID].requests;
const bound = (pick: (row: (typeof rows)[number]) => number) => ({
  seconds: round((secondPerMinute * pick(heaviest(second, pick)) + (general - secondPerMinute) * pick(heaviest(others, pick))) / 1000),
  secondRule: heaviest(second, pick).endpoint,
  firstRule: heaviest(others, pick).endpoint,
});

console.log(JSON.stringify({
  measured: new Date().toISOString().slice(0, 10),
  what: 'warm single requests through the handler, local-time bundle, no rate-limit call, every shape in one seeded random order; wall and CPU time per request',
  runtime: { node: process.version, tzdb: process.versions.tz, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
  minutes: round((Date.now() - started) / 60_000),
  rules: RATE_LIMIT_RULES,
  rows,
  perAddressPerMinute: {
    how: `${secondPerMinute} requests under the second rule at the costliest of them, events or elections, and ${general - secondPerMinute} more at the costliest other request, in seconds`,
    cpuAtMax: bound((row) => row.cpuMs.max),
    cpuAtP95: bound((row) => row.cpuMs.p95),
    wallAtMax: bound((row) => row.wallMs.max),
  },
}, null, 2));
