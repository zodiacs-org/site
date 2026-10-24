import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// The public command is plain Node; the existing source runner resolves the
// site's TypeScript adapters without maintaining another calculation path.
if (process.env.ASPECT_REFERENCE_RUNNER !== '1') {
  execFileSync(process.execPath, [
    fileURLToPath(new URL('../node_modules/vite-node/vite-node.mjs', import.meta.url)),
    '--script', fileURLToPath(import.meta.url), ...process.argv.slice(2),
  ], { env: { ...process.env, ASPECT_REFERENCE_RUNNER: '1' }, stdio: 'inherit' });
  process.exit(0);
}

const { computeChart } = await import('../src/lib/engine/full.ts');
const { ASPECTS, matchAspect, separation } = await import('../src/lib/engine/aspects.ts');
const { findInterAspects } = await import('../src/lib/engine/synastry.ts');
const { ENGINE_VERSION } = await import('../src/lib/engine/types.ts');
const output = new URL('../src/data/aspect-reference-examples.json', import.meta.url);
const chart = (utc) => computeChart({ utc: new Date(utc), houseSystem: 'whole', timeKnown: true });
const get = (result, body) => result.bodies.find((item) => item.body === body).lon;
const pairs = [['sun-moon', 'Sun', 'Moon'], ['moon-venus', 'Moon', 'Venus'], ['moon-mars', 'Moon', 'Mars']];
const examples = [];
for (const [pair, a, b] of pairs) {
  const utcA = '2000-01-01T12:00:00.000Z';
  const chartA = chart(utcA);
  for (const [index, geometry] of ['conjunction', 'trine'].entries()) {
    let found = false;
    for (let day = 0; day < 800 && !found; day += 1) {
      const utcB = new Date(Date.UTC(2001, 0, 1 + day, 12)).toISOString();
      const chartB = chart(utcB);
      const aLongitude = get(chartA, a);
      const bLongitude = get(chartB, b);
      const contact = findInterAspects([{ body: a, lon: aLongitude }], [{ body: b, lon: bLongitude }])[0];
      if (contact?.type !== geometry || contact.orb > 1) continue;
      const angle = ASPECTS.find((aspect) => aspect.type === geometry).angle;
      const reverseA = get(chartA, b);
      const reverseB = get(chartB, a);
      const reverseContact = findInterAspects([{ body: b, lon: reverseA }], [{ body: a, lon: reverseB }])[0];
      examples.push({
        id: `${pair}-${index + 1}`, pair, context: 'synastry', type: 'computed', synthetic: true,
        chartA: { role: 'A', body: a, utc: utcA, longitude: aLongitude },
        chartB: { role: 'B', body: b, utc: utcB, longitude: bLongitude },
        separation: separation(aLongitude, bLongitude), angle,
        residualOrb: Math.abs(separation(aLongitude, bLongitude) - angle), geometry,
        engineVersion: ENGINE_VERSION,
        reversedAssignment: {
          chartA: { role: 'A', body: b, utc: utcA, longitude: reverseA },
          chartB: { role: 'B', body: a, utc: utcB, longitude: reverseB },
          separation: separation(reverseA, reverseB),
          geometry: reverseContact?.type ?? null,
          residualOrb: reverseContact?.orb ?? null,
        },
        convention: 'Tropical geocentric ecliptic longitudes; UTC instants; site major-aspect luminary orbs; no applying/separating.',
        provenance: { generator: 'scripts/build-aspect-reference-examples.mjs', source: 'src/lib/engine/synastry.ts', verifiedAt: '2026-10-20', review: 'Calculation replay only; named editorial review pending.' },
      });
      found = true;
    }
    if (!found) throw new Error(`No feasible ${pair} ${geometry} fixture`);
  }
}
const schematic = [
  { id: 'wraparound', a: 359, b: 1 },
  { id: 'outside-orb', a: 350, b: 4 },
].map(({ id, a, b }) => {
  const match = matchAspect('Sun', a, 'Moon', b);
  return { id, type: 'schematic', context: 'synastry', chartA: { body: 'Sun', longitude: a }, chartB: { body: 'Moon', longitude: b }, separation: separation(a, b), geometry: match?.def.type ?? null, residualOrb: match?.orb ?? null };
});
const bytes = JSON.stringify({ engineVersion: ENGINE_VERSION, conventions: ASPECTS, examples, schematic }, null, 2) + '\n';
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== bytes) throw new Error('Aspect-reference fixtures have drifted. Run the generator.');
  console.log('Aspect-reference fixtures: deterministic replay passed (6 computed, 2 schematic).');
} else {
  await writeFile(output, bytes);
  console.log('Aspect-reference fixtures: generated 6 computed and 2 schematic examples.');
}
