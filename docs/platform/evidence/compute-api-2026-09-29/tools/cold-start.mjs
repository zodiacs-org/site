/**
 * Cold start of the compute API as `vercel build` packages it: for each
 * endpoint, a fresh Node process imports the packaged api/compatibility.js,
 * the function the compute routes are rewritten to, then answers the
 * endpoint's documented example twice through it. The platform's own start
 * (provisioning a container, starting Node) is not included; this measures
 * what the function adds on top of it.
 *
 *   vercel build   # functions only: see the evidence README
 *   node docs/platform/evidence/compute-api-2026-09-29/tools/cold-start.mjs \
 *     <path>/.vercel/output/functions/api/compatibility.func > cold-start.json
 *
 * The request is replayed the way Vercel's Node helpers deliver one: the body
 * is read first and replayed through data and end listeners.
 *
 * The API fails closed without its Firewall rules (since 2026-09-30), so the
 * request carries a client address and the Firewall's answer is stubbed
 * (204, allowed) in the child process: the figures include the SDK's work
 * but no network. cold-start.json was measured on 2026-09-29, when the
 * handler still let a request through before any Firewall call.
 */
import { spawnSync } from 'node:child_process';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RUNS = 10;
const EXAMPLES = {
  chart: { local: { date: '1990-06-15', time: '14:30', zone: 'Europe/Paris' }, latitude: 48.8566, longitude: 2.3522, houseSystem: 'whole' },
  positions: { instants: ['2026-09-29T12:00:00Z', '2026-12-31T00:00:00-05:00'], bodies: ['Sun', 'Moon', 'Mercury'] },
  houses: { utc: '2026-06-21T12:00:00Z', latitude: -33.8688, longitude: 151.2093, houseSystem: 'koch' },
  events: { from: '2026-10-01T00:00:00Z', to: '2026-11-01T00:00:00Z', bodies: ['Sun', 'Mercury', 'Venus'], kinds: ['ingress', 'station', 'lunation'] },
  time: { local: { date: '1947-07-01', time: '12:00', zone: 'Europe/Stockholm' }, longitude: 18.07 },
  'sky-fact': { kind: 'retrograde', body: 'Mercury', date: '2026-10-24', zone: 'America/New_York' },
};

async function child(functionDir, endpoint) {
  const { PassThrough, Readable } = await import('node:stream');
  globalThis.fetch = async () => new Response(null, { status: 204 });
  const started = performance.now();
  const handler = (await import(pathToFileURL(resolve(functionDir, 'api/compatibility.js')).href)).default;
  const importMs = performance.now() - started;
  const call = async () => {
    const text = JSON.stringify(EXAMPLES[endpoint]);
    const req = Readable.from([Buffer.from(text)]);
    req.method = 'POST';
    req.url = `/api/compatibility?__zodiacs_compute=${endpoint}`;
    req.headers = { host: 'example.test', 'x-real-ip': '203.0.113.7', 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(text)) };
    Object.defineProperty(req, 'query', { value: { __zodiacs_compute: endpoint }, configurable: true });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const replay = new PassThrough();
    const on = replay.on.bind(replay);
    const originalOn = req.on.bind(req);
    req.on = req.addListener = (name, listener) => (name === 'data' || name === 'end' ? on(name, listener) : originalOn(name, listener));
    replay.end(Buffer.concat(chunks));
    let status = 0;
    const res = { set statusCode(value) { status = value; }, get statusCode() { return status; }, setHeader() {}, end() {} };
    const at = performance.now();
    await handler(req, res);
    if (status !== 200) throw new Error(`${endpoint}: status ${status}`);
    return performance.now() - at;
  };
  const firstMs = await call();
  const secondMs = await call();
  process.stdout.write(JSON.stringify({ importMs, firstMs, secondMs }));
}

function quantiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.ceil(q * sorted.length) - 1)];
  return { p50: +at(0.5).toFixed(1), max: +sorted.at(-1).toFixed(1) };
}

const [functionDir, endpoint] = process.argv.slice(2);
if (!functionDir) throw new Error('usage: cold-start.mjs <compatibility.func directory>');
if (endpoint) {
  await child(functionDir, endpoint);
} else {
  const rows = [];
  for (const name of Object.keys(EXAMPLES)) {
    const samples = [];
    for (let run = 0; run < RUNS; run += 1) {
      const started = performance.now();
      const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), functionDir, name], {
        encoding: 'utf8',
        env: { ...process.env, NODE_ENV: 'production' },
      });
      const processMs = performance.now() - started;
      if (result.status !== 0) throw new Error(`${name}: ${result.stderr}`);
      samples.push({ ...JSON.parse(result.stdout), processMs });
    }
    rows.push({
      endpoint: name,
      runs: RUNS,
      importMs: quantiles(samples.map((sample) => sample.importMs)),
      firstRequestMs: quantiles(samples.map((sample) => sample.firstMs)),
      secondRequestMs: quantiles(samples.map((sample) => sample.secondMs)),
      wholeProcessMs: quantiles(samples.map((sample) => sample.processMs)),
    });
  }
  console.log(JSON.stringify({
    measured: new Date().toISOString().slice(0, 10),
    what: 'fresh Node process per run: import of the packaged function, then the documented example twice; the platform start is not included',
    runtime: { node: process.version, tzdb: process.versions.tz, cpu: cpus()[0]?.model ?? 'unknown', cores: cpus().length },
    rows,
  }, null, 2));
}
