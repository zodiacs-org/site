/**
 * The costliest elections requests the limits allow, beside the costliest
 * events request, in every fourth year the API takes, on one machine:
 *
 *   npx vite-node --script tools/cost-sweep.ts > cost-sweep.txt
 *
 * Each shape is asked once per year from 1800 to 2196 (YEAR_STEP=4), through
 * the real handler with its real allowance, and timed in the process's CPU
 * time. An elections request is counted under the events request's lower
 * rate limit too, so the documented worst case per address holds while the
 * costliest elections request costs no more than the costliest events one.
 * A request refused for its allowance is timed too: it ran until refused.
 */
import { createComputeApiHandler } from '../../../../../src/lib/compute-api/handler';
import { BUDGETS, EPOCH, HOUSE_SYSTEM_NAMES } from '../../../../../src/lib/compute-api/constants';
import { run } from '../../../../../scripts/lib/compute-api-harness';
import { createLocalTimeModule } from '../../../../../api/_compute/local-time.mjs';

const handler = createComputeApiHandler({ localTime: createLocalTimeModule(), env: {}, rateLimit: async () => 'allowed' });
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString();
const STEP = Number(process.env.YEAR_STEP ?? 4);
const YEARS: number[] = [];
for (let year = EPOCH.firstYear; year <= EPOCH.lastYear; year += STEP) YEARS.push(year);

type Body = Record<string, unknown>;
const shapes: Array<{ name: string; endpoint: 'elections' | 'events'; body: (year: number, i: number) => Body }> = [
  {
    name: 'events 92 days, all bodies and kinds',
    endpoint: 'events',
    body: (y, i) => { const from = Date.UTC(y, (i * 3) % 12, 1); return { from: iso(from), to: iso(Math.min(from + 92 * DAY, Date.parse(EPOCH.to))) }; },
  },
  {
    name: 'elections void 31 days',
    endpoint: 'elections',
    body: (y, i) => { const from = Date.UTC(y, i % 12, 1); return { from: iso(from), to: iso(from + 31 * DAY), conditions: [{ kind: 'void-of-course' }] }; },
  },
  {
    name: 'elections five cheap 31 days',
    endpoint: 'elections',
    body: (y, i) => {
      const from = Date.UTC(y, (i + 5) % 12, 1);
      return {
        from: iso(from),
        to: iso(from + 31 * DAY),
        conditions: [
          { kind: 'phase', phase: 'waxing' },
          { kind: 'void-of-course', not: true },
          { kind: 'retrograde', body: 'Mercury', not: true },
          { kind: 'sign', body: 'Moon', sign: ['aries', 'leo', 'libra', 'capricorn'][i % 4], not: true },
          { kind: 'retrograde', body: 'Venus' },
        ],
      };
    },
  },
  {
    name: 'elections five retrograde 31 days',
    endpoint: 'elections',
    body: (y, i) => {
      const from = Date.UTC(y, (i + 2) % 12, 1);
      return { from: iso(from), to: iso(from + 31 * DAY), conditions: ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].map((body) => ({ kind: 'retrograde', body, not: i % 2 === 0 })) };
    },
  },
  {
    name: 'elections angular Moon 4 days',
    endpoint: 'elections',
    body: (y, i) => {
      const from = Date.UTC(y, (i + 7) % 12, 3);
      return { from: iso(from), to: iso(from + 4 * DAY), conditions: [{ kind: 'angular', body: 'Moon' }], place: { latitude: 59.9 - (i % 3) * 40, longitude: 10.7, houseSystem: HOUSE_SYSTEM_NAMES[i % 13] } };
    },
  },
  {
    name: 'elections not void + angular Sun 31 days',
    endpoint: 'elections',
    body: (y, i) => {
      const from = Date.UTC(y, (i + 9) % 12, 1);
      return { from: iso(from), to: iso(from + 31 * DAY), conditions: [{ kind: 'void-of-course', not: true }, { kind: 'angular', body: 'Sun' }], place: { latitude: 51.5, longitude: -0.1, houseSystem: HOUSE_SYSTEM_NAMES[(i + 4) % 13] } };
    },
  },
  {
    name: 'elections Moon in a sign + angular Mars 31 days',
    endpoint: 'elections',
    body: (y, i) => {
      const from = Date.UTC(y, (i + 1) % 12, 1);
      return {
        from: iso(from),
        to: iso(from + 31 * DAY),
        conditions: [{ kind: 'sign', body: 'Moon', sign: ['taurus', 'cancer', 'virgo', 'pisces'][i % 4] }, { kind: 'phase', phase: 'waxing' }, { kind: 'angular', body: 'Mars' }],
        place: { latitude: -33.9, longitude: 151.2, houseSystem: HOUSE_SYSTEM_NAMES[(i + 7) % 13] },
      };
    },
  },
];

// One request of each shape first, so that no shape pays for loading the engine.
for (const shape of shapes) await run(handler, { endpoint: shape.endpoint, body: shape.body(2000, 0) });
console.log(`years ${YEARS[0]} to ${YEARS[YEARS.length - 1]}, every ${STEP}; elections.samples ${BUDGETS['elections.samples']}; CPU milliseconds per request`);
for (const shape of shapes) {
  const cpus: number[] = [];
  let max = 0;
  let maxAt = '';
  let refused = 0;
  let maxSamples = 0;
  for (const [i, year] of YEARS.entries()) {
    const started = process.cpuUsage();
    const response = await run(handler, { endpoint: shape.endpoint, body: shape.body(year, i) });
    const used = process.cpuUsage(started);
    const ms = (used.user + used.system) / 1000;
    cpus.push(ms);
    if (response.status !== 200) refused += 1;
    const samples = response.json?.receipt?.electionSearch?.samples ?? response.json?.receipt?.search?.samples ?? 0;
    maxSamples = Math.max(maxSamples, samples);
    if (ms > max) {
      max = ms;
      maxAt = `${year}, ${response.status}`;
    }
  }
  cpus.sort((a, b) => a - b);
  const p95 = cpus[Math.floor(cpus.length * 0.95)];
  console.log(`${shape.name.padEnd(48)} n ${cpus.length}  max ${max.toFixed(1)} (${maxAt})  p95 ${p95.toFixed(1)}  refused ${refused}  most evaluations ${maxSamples}`);
}
