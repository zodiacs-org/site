/**
 * Drives two builds of the local MCP adapter with the same calls and compares
 * what they answer: the tool list, both resources and a fixed corpus of tool
 * calls, refusals included. Versions are written out of every answer first
 * (the adapter's and the engine's), and so are the sha256: digests, since a
 * receipt names those versions; everything else must be equal. Every chart is
 * synthetic: round coordinates for well-known places.
 *
 *   node compare-mcp-versions.mjs <old server.mjs> <new server.mjs> <out.json>
 *
 * Run it from the site's root, whose node_modules holds the official SDK
 * client and the two packages the bundles import; each bundle must sit where
 * it can import them too. The record names each bundle by its file name and
 * SHA-256, and gives a differing text as the lines found in only one build.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

const [oldServer, newServer, out] = process.argv.slice(2);
if (!out) throw new Error('usage: node compare-mcp-versions.mjs <old server.mjs> <new server.mjs> <out.json>');

const VERSION = /\b0\.1\.[01]-rc\.\d+(?:\.\d+)?\b/g;
const DIGEST = /sha256:[0-9a-f]{64}/g;
const normalize = (value) => {
  if (typeof value === 'string') return value.replace(VERSION, '<version>').replace(DIGEST, 'sha256:<digest>');
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v)]));
  return value;
};

/** Paths at which two normalized values differ. */
const differences = (a, b, path = '$', found = []) => {
  if (found.length > 20) return found;
  if (a === b) return found;
  if (typeof a === 'string' && typeof b === 'string' && (a.includes('\n') || b.includes('\n'))) {
    const [left, right] = [a.split('\n'), b.split('\n')];
    found.push({ path, onlyOld: left.filter((line) => !right.includes(line)), onlyNew: right.filter((line) => !left.includes(line)) });
    return found;
  }
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
    found.push({ path, old: a, new: b });
    return found;
  }
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) differences(a[key], b[key], `${path}.${key}`, found);
  return found;
};

async function connect(server) {
  const transport = new StdioClientTransport({ command: process.execPath, args: [server], stderr: 'pipe' });
  const client = new Client({ name: 'compare-mcp-versions', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

const PLACES = [
  { latitude: 51.5074, longitude: -0.1278 },
  { latitude: 40.7128, longitude: -74.006 },
  { latitude: -33.8688, longitude: 151.2093 },
  { latitude: -0.1807, longitude: -78.4678 },
  { latitude: 69.6492, longitude: 18.9553 },
  { latitude: 78.2232, longitude: 15.6267 },
];
const SYSTEMS = ['placidus', 'whole', 'porphyry', 'equal', 'vehlow', 'koch', 'regiomontanus', 'campanus',
  'topocentric', 'alcabitius', 'morinus', 'meridian', 'equal-mc'];
const YEARS = [1800, 1850, 1900, 1950, 1990, 2000, 2026, 2050, 2100, 2150, 2199];
const pad = (n) => String(n).padStart(2, '0');
const INSTANTS = YEARS.map((year, i) => `${year}-${pad(1 + (i * 5) % 12)}-${pad(10 + i)}T${pad((i * 7) % 24)}:${pad((i * 13) % 60)}:00Z`);
const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn',
  'aquarius', 'pisces'];

/** The corpus, the same for both builds. Calls that name a record take it from the build being driven. */
function corpus() {
  const calls = [['get_capabilities', {}]];
  INSTANTS.forEach((utc, i) => {
    PLACES.forEach((place, j) => {
      calls.push(['calculate_natal_chart', { utc, ...place, houseSystem: SYSTEMS[(i + j) % SYSTEMS.length] }]);
      calls.push(['calculate_natal_chart', { utc, ...place, houseSystem: SYSTEMS[(i + 2 * j + 5) % SYSTEMS.length], output: 'record' }]);
    });
    calls.push(['calculate_natal_chart', { utc }]);
    calls.push(['calculate_natal_chart', { utc, ...PLACES[i % PLACES.length], timeKnown: false }]);
  });
  calls.push(['calculate_natal_chart', { utc: '1990-06-15T19:00:00+05:30', ...PLACES[0] }]);
  calls.push(['calculate_natal_chart', { utc: '1990-06-15T13:30:00Z', latitude: 90, longitude: 0, timeKnown: false }]);
  // Each pair compares two records the build itself wrote: one place and instant, two house systems, then two instants.
  INSTANTS.forEach((utc, i) => {
    const place = PLACES[i % 4];
    calls.push(['compare', { a: { utc, ...place, houseSystem: 'placidus' }, b: { utc, ...place, houseSystem: SYSTEMS[1 + i % 12] }, output: 'summary' }]);
    calls.push(['compare', { a: { utc, ...place, houseSystem: 'whole' }, b: { utc: INSTANTS[(i + 1) % INSTANTS.length], ...place, houseSystem: 'whole' }, output: i % 2 ? 'full' : 'summary' }]);
  });
  INSTANTS.forEach((utc, i) => {
    calls.push(['get_positions', { instants: [utc, INSTANTS[(i + 3) % INSTANTS.length]] }]);
    calls.push(['get_positions', { instants: [utc], bodies: BODIES.slice(i % 5, i % 5 + 4) }]);
  });
  [['2026-01-01T00:00:00Z', '2026-04-01T00:00:00Z'], ['1990-06-01T00:00:00Z', '1990-08-31T00:00:00Z'],
    ['1800-01-01T00:00:00Z', '1800-03-01T00:00:00Z'], ['2199-10-01T00:00:00Z', '2199-12-31T23:59:59Z'],
    ['2000-01-01T12:00:00+05:30', '2000-02-15T12:00:00Z'], ['2150-05-01T00:00:00Z', '2150-07-30T00:00:00Z']]
    .forEach(([from, to], i) => {
      calls.push(['find_events', { from, to }]);
      calls.push(['find_events', { from, to, bodies: BODIES.slice(i, i + 3), kinds: [['ingress'], ['station'], ['lunation'], ['ingress', 'station']][i % 4] }]);
    });
  INSTANTS.forEach((instant, i) => {
    const body = BODIES[i % BODIES.length];
    const date = instant.slice(0, 10);
    calls.push(['check_sky_fact', { kind: 'sign', body, sign: SIGNS[i % 12], instant }]);
    calls.push(['check_sky_fact', { kind: 'sign', body, sign: SIGNS[(i * 5) % 12], date }]);
    calls.push(['check_sky_fact', { kind: 'retrograde', body: BODIES[2 + i % 8], instant }]);
    calls.push(['check_sky_fact', { kind: 'ingress', body, sign: SIGNS[(i + 1) % 12], date }]);
    calls.push(['check_sky_fact', { kind: 'phase', phase: ['new', 'first-quarter', 'full', 'last-quarter'][i % 4], date }]);
  });
  // Refusals, which must refuse in the same words.
  calls.push(['calculate_natal_chart', { utc: '1799-12-31T23:59:59Z', ...PLACES[0] }]);
  calls.push(['calculate_natal_chart', { utc: '1990-06-15T13:30:00', ...PLACES[0] }]);
  calls.push(['calculate_natal_chart', { utc: '1990-06-15T13:30:00Z', latitude: 51.5 }]);
  calls.push(['calculate_natal_chart', { utc: '1990-06-15T13:30:00Z', latitude: 90, longitude: 0 }]);
  calls.push(['compare_calculation_records', { left: '{', right: '{}' }]);
  calls.push(['get_positions', { instants: ['2200-01-01T00:00:00Z'] }]);
  calls.push(['find_events', { from: '2026-01-01T00:00:00Z', to: '2026-06-01T00:00:00Z' }]);
  calls.push(['find_events', { from: '2026-02-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }]);
  calls.push(['check_sky_fact', { kind: 'phase', phase: 'full', instant: '2026-01-03T10:00:00Z' }]);
  calls.push(['check_sky_fact', { kind: 'ingress', body: 'Sun', sign: 'aries', date: '2026-13-01' }]);
  return calls;
}

async function drive(server) {
  const client = await connect(server);
  const answers = [];
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    return { isError: Boolean(result.isError), structured: result.structuredContent ?? null, content: result.content };
  };
  try {
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    const read = [];
    for (const resource of resources) read.push(await client.readResource({ uri: resource.uri }));
    for (const [name, args] of corpus()) {
      if (name === 'compare') {
        const record = async (input) => (await call('calculate_natal_chart', { ...input, output: 'record' })).structured.record;
        const left = await record(args.a);
        const right = await record(args.b);
        answers.push({ name: 'compare_calculation_records', args, result: await call('compare_calculation_records', { left, right, output: args.output }) });
      } else {
        answers.push({ name, args, result: await call(name, args) });
      }
    }
    return { tools, resources, read, answers };
  } finally {
    await client.close();
  }
}

const sha256 = async (path) => createHash('sha256').update(await readFile(path)).digest('hex');
const [a, b] = [await drive(oldServer), await drive(newServer)];
const report = {
  schemaVersion: 1,
  what: 'Two builds of the local MCP adapter driven with the same tool list, resource reads and tool calls, compared after versions and sha256: digests are written out',
  node: process.version,
  old: { file: basename(oldServer), sha256: await sha256(oldServer) },
  new: { file: basename(newServer), sha256: await sha256(newServer) },
  tools: differences(normalize(a.tools), normalize(b.tools)),
  resources: differences(normalize([a.resources, a.read]), normalize([b.resources, b.read])),
  calls: a.answers.length,
  refusals: a.answers.filter((x) => x.result.isError).length,
  byTool: {},
  differing: [],
};
for (let i = 0; i < a.answers.length; i += 1) {
  const [x, y] = [a.answers[i], b.answers[i]];
  if (JSON.stringify(x.args) !== JSON.stringify(y.args)) throw new Error(`corpus skew at ${i}`);
  report.byTool[x.name] = (report.byTool[x.name] ?? 0) + 1;
  const found = differences(normalize(x.result), normalize(y.result));
  if (found.length) report.differing.push({ index: i, name: x.name, args: x.args, differences: found });
}
await writeFile(out, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify({ calls: report.calls, refusals: report.refusals, byTool: report.byTool,
  toolDifferences: report.tools.length, resourceDifferences: report.resources.length, differingCalls: report.differing.length }));
