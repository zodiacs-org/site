/**
 * Chiron's longitude table (src/data/chiron.json), which get_natal_chart and
 * search_sky_events read with ZODIACS_SKY_EVENTS_ENABLED=1
 * (src/ai-tools/features/chiron.ts).
 *
 * It encodes one kept NASA JPL Horizons response,
 * docs/engine-validation/chiron/horizons/chiron-every-24-days.txt, which
 * docs/engine-validation/chiron/fetch.py fetched and keeps byte for byte with
 * its query, retrieval time and SHA-256 in MANIFEST.json beside it: the
 * geocentric apparent ecliptic longitude of date of 2060 Chiron (observer
 * quantity 31), every 24 days on Terrestrial Time from four steps before
 * 1800-01-01 to four steps after 2200-01-01. The response is checked against
 * its recorded SHA-256 first.
 *
 * Each longitude, printed by Horizons to 1e-7 degree, is read as a whole number
 * of 1e-7 degrees, unwrapped across 360 degrees, rounded to 1e-5 degree
 * (0.036 arcseconds) and written as the first value and then the differences,
 * so the file holds whole numbers only. Nothing is computed beyond that; the
 * interpolation and its measured error are in the runtime module and
 * docs/engine-validation/chiron/README.md.
 *
 * Usage: node scripts/build-chiron.mjs [--check]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const STORE = 'docs/engine-validation/chiron/horizons/';
const RESPONSE = 'chiron-every-24-days';
const OUT = 'src/data/chiron.json';
export const STEP_DAYS = 24;
/** Horizons prints longitudes to 1e-7 degree; the table keeps 1e-5. */
const PRINTED = 1e7;
const KEPT = 1e5;
const FULL_TURN = 360 * PRINTED;

/** The rows of a Horizons observer table: Julian date (TT) and the longitude as written. */
function rows(text) {
  const body = text.slice(text.indexOf('$$SOE') + 5, text.indexOf('$$EOE'));
  return body.trim().split('\n').map((line) => {
    const [jd, lon] = line.trim().split(/\s+/u);
    if (!/^\d+\.\d{7}$/u.test(lon)) throw new Error(`Unexpected longitude ${lon} in ${RESPONSE}`);
    return { jd: Number(jd), lon: Number(lon.replace('.', '')) };
  });
}

/** The table's JSON text, built from the kept response. */
export async function buildChironTable() {
  const manifest = JSON.parse(await readFile(new URL(`${STORE}MANIFEST.json`, ROOT), 'utf8'));
  const entry = manifest.responses[RESPONSE];
  const bytes = await readFile(new URL(`${STORE}${entry.file}`, ROOT));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== entry.sha256 || bytes.length !== entry.bytes) throw new Error(`${STORE}${entry.file} does not match its recorded SHA-256`);
  const table = rows(bytes.toString('utf8'));
  for (let index = 1; index < table.length; index += 1) {
    if (table[index].jd - table[index - 1].jd !== STEP_DAYS) throw new Error(`${RESPONSE} is not every ${STEP_DAYS} days at row ${index}`);
  }
  // Unwrapped in whole 1e-7 degrees, so the sum is exact, then rounded to whole 1e-5 degrees.
  const kept = [];
  let previous = null;
  let turns = 0;
  for (const { lon } of table) {
    if (previous !== null) {
      const step = lon + turns - previous;
      if (step > FULL_TURN / 2) turns -= FULL_TURN;
      else if (step < -FULL_TURN / 2) turns += FULL_TURN;
    }
    previous = lon + turns;
    kept.push(Math.round(previous / (PRINTED / KEPT)));
  }
  const differences = kept.map((value, index) => (index === 0 ? value : value - kept[index - 1]));
  const header = {
    schema: 'zodiacs.chiron-longitudes.v1',
    what: 'The geocentric apparent ecliptic longitude of 2060 Chiron, tropical and of date, every 24 days on Terrestrial Time, from NASA JPL Horizons. longitudes holds the first in units of 0.00001 degree, unwrapped across 360 degrees, and then the change to each next one; their running sum is each longitude. src/ai-tools/features/chiron.ts interpolates them with an eight-point Lagrange polynomial, and docs/engine-validation/chiron/README.md gives the measured error.',
    source: {
      title: 'NASA JPL Horizons API, observer quantity 31 (geocentric apparent ecliptic longitude and latitude of date, airless, TT), target 2060 Chiron (1977 UB), orbit solution JPL#171. Public domain.',
      api: manifest.api,
      response: `${STORE}${entry.file}`,
      retrievedUtc: entry.retrievedUtc,
      sha256,
      target: entry.source.target,
      solution: entry.source.targetSource,
    },
    span: { from: '1800-01-01T00:00:00Z', to: '2200-01-01T00:00:00Z' },
    timeScale: 'TT',
    firstJd: table[0].jd,
    stepDays: STEP_DAYS,
    unitDegrees: 1 / KEPT,
    points: 8,
  };
  // One line: the bundler keeps a one-line array on one line, where a wrapped one costs a line per number.
  return `${JSON.stringify(header, null, 1).slice(0, -2)},\n "longitudes": [${differences.join(',')}]\n}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = await buildChironTable();
  const out = new URL(OUT, ROOT);
  if (process.argv.includes('--check')) {
    const current = await readFile(out, 'utf8').catch(() => null);
    if (current !== text) {
      console.error(`${OUT} is stale; run node scripts/build-chiron.mjs`);
      process.exit(1);
    }
    console.log(`Verified ${OUT}`);
  } else {
    await writeFile(out, text);
    console.log(`Built ${OUT} (${Buffer.byteLength(text)} bytes)`);
  }
}
