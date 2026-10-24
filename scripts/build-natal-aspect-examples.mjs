import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The public command is plain Node; the existing source runner resolves the
// site's TypeScript chart adapter, so the evidence comes from the same
// calculation the birth chart calculator runs.
if (process.env.NATAL_ASPECT_EXAMPLES_RUNNER !== '1') {
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/vite-node/vite-node.mjs', import.meta.url)),
    '--script', fileURLToPath(import.meta.url), ...process.argv.slice(2),
  ], { env: { ...process.env, NATAL_ASPECT_EXAMPLES_RUNNER: '1' }, stdio: 'inherit' });
  process.exit(0);
}

const { computeChart } = await import('../src/lib/engine/full.ts');
const { ASPECTS, matchAspect, separation } = await import('../src/lib/engine/aspects.ts');
const { ENGINE_VERSION } = await import('../src/lib/engine/types.ts');
const { NATAL_ASPECT_PAIRS } = await import('./natal-aspects-policy.mjs');

const output = new URL('../src/data/natal-aspect-examples.json', import.meta.url);
const GEOMETRIES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];
// Two worked examples per pair. Every pair also records a feasible instant
// for all five geometries, so no page describes an impossible configuration.
const WORKED = { 'sun-moon': ['square', 'trine'], 'moon-venus': ['conjunction', 'opposition'], 'venus-mars': ['sextile', 'square'] };
const START = Date.UTC(2001, 0, 1, 12);
const DAY = 86_400_000;

const chart = (ms) => computeChart({ utc: new Date(ms), houseSystem: 'whole', timeKnown: true });
const bodiesOf = (pair) => pair.split('-').map((body) => body[0].toUpperCase() + body.slice(1));
const longitude = (result, body) => result.bodies.find((item) => item.body === body).lon;
const listed = (result, a, b) => result.aspects.find((aspect) => (aspect.a === a && aspect.b === b) || (aspect.a === b && aspect.b === a)) ?? null;

function instant(ms, a, b) {
  const result = chart(ms);
  const aspect = listed(result, a, b);
  const lonA = longitude(result, a);
  const lonB = longitude(result, b);
  return {
    utc: new Date(ms).toISOString(), longitudeA: lonA, longitudeB: lonB, separation: separation(lonA, lonB),
    geometry: aspect?.type ?? null, orb: aspect?.orb ?? null, applying: aspect ? aspect.applying : null,
  };
}

function firstInstant(a, b, geometry) {
  for (let day = 0; day < 2000; day += 1) {
    const found = instant(START + day * DAY, a, b);
    if (found.geometry === geometry && found.orb <= 1) return found;
  }
  throw new Error(`No feasible ${a}-${b} ${geometry} instant`);
}

// Hourly samples across the UTC date of a worked example show how far the
// pair moves when the hour is unknown. The calculator's unknown-time
// reference is local noon; a UTC date stands in for that day here.
function daySpan(utc, a, b, geometry) {
  const midnight = Date.parse(`${utc.slice(0, 10)}T00:00:00.000Z`);
  const samples = Array.from({ length: 25 }, (_, hour) => instant(midnight + hour * 3_600_000, a, b));
  const hours = samples.flatMap((sample, hour) => (sample.geometry === geometry ? [hour] : []));
  return {
    from: { utc: samples[0].utc, separation: samples[0].separation, geometry: samples[0].geometry, orb: samples[0].orb },
    to: { utc: samples[24].utc, separation: samples[24].separation, geometry: samples[24].geometry, orb: samples[24].orb },
    separationChange: Math.abs(samples[24].separation - samples[0].separation),
    hourlySamples: 25,
    samplesListingGeometry: hours.length,
  };
}

const pairs = NATAL_ASPECT_PAIRS.map((pair) => {
  const [a, b] = bodiesOf(pair);
  const feasibility = GEOMETRIES.map((geometry) => {
    const found = firstInstant(a, b, geometry);
    return { geometry, utc: found.utc, separation: found.separation, orb: found.orb };
  });
  const examples = WORKED[pair].map((geometry, index) => {
    const found = firstInstant(a, b, geometry);
    const angle = ASPECTS.find((aspect) => aspect.type === geometry).angle;
    return {
      id: `${pair}-${index + 1}`, pair, context: 'natal', type: 'computed', synthetic: true,
      utc: found.utc, bodies: [{ body: a, longitude: found.longitudeA }, { body: b, longitude: found.longitudeB }],
      separation: found.separation, angle, residualOrb: found.orb, geometry, applying: found.applying,
      engineVersion: ENGINE_VERSION,
      daySpan: daySpan(found.utc, a, b, geometry),
      convention: 'Tropical geocentric ecliptic longitudes; one UTC instant; the birth chart calculator\'s major-aspect orbs; applying from current speeds.',
      provenance: { generator: 'scripts/build-natal-aspect-examples.mjs', source: 'src/lib/engine/full.ts', verifiedAt: '2026-10-24', review: 'Calculation replay only; named editorial review pending.' },
    };
  });
  // The first noon instant whose listed aspect does not hold for the whole
  // UTC date: the case an unknown birth time can actually change.
  let timeSensitive = null;
  for (let day = 0; day < 2000 && !timeSensitive; day += 1) {
    const noon = instant(START + day * DAY, a, b);
    if (!noon.geometry) continue;
    const span = daySpan(noon.utc, a, b, noon.geometry);
    if (span.samplesListingGeometry < span.hourlySamples) {
      timeSensitive = { utc: noon.utc, geometry: noon.geometry, orb: noon.orb, separation: noon.separation, daySpan: span };
    }
  }
  if (!timeSensitive) throw new Error(`No time-sensitive ${pair} instant`);
  return { pair, bodies: [a, b], luminary: [a, b].some((body) => body === 'Sun' || body === 'Moon'), feasibility, examples, timeSensitive };
});

// The same 9.5 degree separation is a conjunction when the Moon is involved
// and nothing at all for Venus and Mars: the luminary allowance in one line.
const schematic = [
  { id: 'wraparound', a: 'Moon', lonA: 358, b: 'Venus', lonB: 3 },
  { id: 'luminary-allowance', a: 'Moon', lonA: 350, b: 'Venus', lonB: 359.5 },
  { id: 'standard-allowance', a: 'Venus', lonA: 350, b: 'Mars', lonB: 359.5 },
].map(({ id, a, lonA, b, lonB }) => {
  const match = matchAspect(a, lonA, b, lonB);
  return { id, type: 'schematic', context: 'natal', bodies: [{ body: a, longitude: lonA }, { body: b, longitude: lonB }], separation: separation(lonA, lonB), geometry: match?.def.type ?? null, residualOrb: match?.orb ?? null };
});

// Venus never strays far from the Sun, so Moon-Venus angles loosely follow
// the lunar phase. Daily noon samples over one eight-year Venus cycle.
// The same samples measure how many consecutive days a Venus-Mars aspect
// stays listed, which is why that pair barely depends on the birth hour.
let venusElongation = 0;
const runs = [];
let run = null;
for (let day = 0; day < 2922; day += 1) {
  const result = chart(START + day * DAY);
  venusElongation = Math.max(venusElongation, separation(longitude(result, 'Sun'), longitude(result, 'Venus')));
  const geometry = listed(result, 'Venus', 'Mars')?.type ?? null;
  if (run && run.geometry === geometry) run.days += 1;
  else {
    if (run?.geometry && run.start > 0) runs.push(run);
    run = { geometry, days: 1, start: day };
  }
}
const windows = GEOMETRIES.map((geometry) => {
  const days = runs.filter((item) => item.geometry === geometry).map((item) => item.days).sort((a, b) => a - b);
  return { geometry, windows: days.length, minDays: days[0], medianDays: days[Math.floor(days.length / 2)], maxDays: days.at(-1) };
});
const venus = { from: new Date(START).toISOString(), days: 2922, maxSunVenusSeparation: venusElongation, venusMarsWindows: windows };

const bytes = JSON.stringify({ engineVersion: ENGINE_VERSION, conventions: ASPECTS, pairs, schematic, venus }, null, 2) + '\n';
const count = pairs.reduce((sum, pair) => sum + pair.examples.length, 0);
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8').catch(() => '') !== bytes) {
    console.error('Natal aspect examples have drifted. Run node scripts/build-natal-aspect-examples.mjs.');
    process.exit(1);
  }
  console.log(`Natal aspect examples: deterministic replay passed (${count} computed, 15 feasible geometries, ${schematic.length} schematic).`);
} else {
  await writeFile(output, bytes);
  console.log(`Natal aspect examples: generated ${count} computed, 15 feasible geometries and ${schematic.length} schematic.`);
}
