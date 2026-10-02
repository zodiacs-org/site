/**
 * How long other requests wait behind events requests in the same function
 * instance.
 *
 *   npx vite-node --script docs/platform/evidence/compute-api-2026-09-29/tools/contention.ts > contention.json
 *
 * The compute endpoints run inside the site's compatibility function, which
 * also serves the Games, the chart previews, the Registry news and the invite
 * routes. Under Vercel's Fluid compute one instance takes several requests at
 * once, in one Node process: a calculation holds the process's only thread
 * until it finishes, so a request that arrives meanwhile waits for it.
 *
 * Each trial starts n events requests at the window limit (every body and
 * kind, in the slowest years of the worst-case sweep) and, at the same
 * moment, one small request (a local time), all in this process, and times
 * the small request from its start to its answer. n = 0 is the small request
 * alone. Seven trials each; milliseconds.
 */
import { cpus } from 'node:os';
import { createComputeApiHandler } from '../../../../../src/lib/compute-api/handler';
import { BUDGETS } from '../../../../../src/lib/compute-api/constants';
import { run } from '../../../../../scripts/lib/compute-api-harness';
import { createLocalTimeModule } from '../../../../../api/_compute/local-time.mjs';
const localTime = createLocalTimeModule();

const handler = createComputeApiHandler({ localTime, env: {}, rateLimit: async () => 'allowed' });
const DAY = 86_400_000;
const WINDOW = BUDGETS['events.windowDays'];
// Start years of slow windows in the worst-case sweep; any year gives much the same figure.
const YEARS = [1894, 1851, 1862, 1835, 1839, 1971, 2003, 2050, 2111, 2150];
const heavy = (index: number) => {
  const from = Date.UTC(YEARS[index % YEARS.length], 0, 1);
  return { from: new Date(from).toISOString(), to: new Date(from + WINDOW * DAY).toISOString() };
};
const small = { local: { date: '2026-09-29', time: '12:00', zone: 'Europe/Paris' } };

async function smallAlongside(n: number): Promise<{ small: number; heavy: number }> {
  const started = performance.now();
  const heavies = Array.from({ length: n }, (_, index) => run(handler, { endpoint: 'events', body: heavy(index) }));
  const answer = run(handler, { endpoint: 'time', body: small }).then(() => performance.now() - started);
  const [smallMs] = await Promise.all([answer, ...heavies]);
  return { small: smallMs, heavy: performance.now() - started };
}

for (let warm = 0; warm < 2; warm += 1) {
  await run(handler, { endpoint: 'events', body: heavy(warm) });
  await run(handler, { endpoint: 'time', body: small });
}

const rows = [];
for (const n of [0, 1, 4, 10]) {
  const trials: Array<{ small: number; heavy: number }> = [];
  for (let trial = 0; trial < 7; trial += 1) trials.push(await smallAlongside(n));
  const sorted = (key: 'small' | 'heavy') => trials.map((row) => row[key]).sort((a, b) => a - b);
  rows.push({
    eventsRequestsAlongside: n,
    smallRequestMs: { median: +sorted('small')[3].toFixed(1), max: +sorted('small').at(-1)!.toFixed(1) },
    allAnsweredMs: { median: +sorted('heavy')[3].toFixed(1) },
  });
}

console.log(JSON.stringify({
  measured: new Date().toISOString().slice(0, 10),
  what: `one local-time request started together with n events requests of ${WINDOW} days, every body and kind, in one Node process; median and max of 7 trials`,
  runtime: { node: process.version, tzdb: process.versions.tz, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
  rows,
}, null, 2));
