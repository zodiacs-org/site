/*
 * The Moon's distance at every new and full Moon in src/data/sky.json, with
 * the perigee and apogee on each side of it:
 *
 *   node scripts/build-moon-distances.mjs           →  src/data/moon-distances.json
 *   node scripts/build-moon-distances.mjs --check   (fails when the file is stale)
 *
 * For each lunation the file keeps the catalog instant exactly as sky.json
 * has it, the geocentric distance from the centre of the Earth to the centre
 * of the Moon at that instant (astronomy-engine GeoMoon, geometric, no light
 * time), and the nearest perigee and apogee before and after it
 * (SearchLunarApsis and NextLunarApsis), each with its instant to the minute
 * and its distance. Distances are whole kilometres. Nothing here names or
 * applies a rule about which Moons count as close; the file holds the
 * numbers any such rule needs, so a rule can be chosen later without a
 * rebuild.
 *
 * One measured correction. astronomy-engine's Moon is a truncated series
 * whose sine parallax starts from a constant term of 3422.7", and its
 * distances run short of JPL's by a near constant ratio: against DE421 at all
 * 124 lunations of 2026 to 2030 the shortfall is 7.1 to 12.5 km, a mean ratio
 * of 2.66e-5, and the 137 apsides from December 2025 to January 2031 show the
 * same. DISTANCE_SCALE removes that ratio (it is the same as taking the
 * constant term as 3422.609"). What remains is the series' truncation, within
 * 4 km of DE421 at every lunation and apsis, which
 * scripts/build-moon-distances.test.mjs holds against the committed DE421
 * table (scripts/fixtures/moon-distances/, made by
 * scripts/moon-distances-de421.py) and within 2 km of the two committed JPL
 * Horizons (DE441) responses beside it. Apsis instants agree with DE421's to
 * about three minutes, so they are kept to the minute.
 *
 * sky.json is read, never written: it is bundled byte for byte into the AI
 * runtime. This file carries no generation timestamp, so a rebuild is
 * byte-identical and `--check` holds.
 */
import './lib/deltat-install.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { GeoMoon, MakeTime, NextLunarApsis, SearchLunarApsis, KM_PER_AU } from 'astronomy-engine';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skyPath = resolve(root, 'src/data/sky.json');
export const MOON_DISTANCES_PATH = resolve(root, 'src/data/moon-distances.json');

/** astronomy-engine's Moon distance times this is DE421's, to the series' truncation (see above). */
export const DISTANCE_SCALE = 3422.7 / 3422.609;

const DAY = 86400_000;
const MINUTE = 60_000;
const APSIS = { 0: 'perigee', 1: 'apogee' };

const km = (raw) => Math.round(raw * DISTANCE_SCALE);
const toMinute = (date) => new Date(Math.round(date.getTime() / MINUTE) * MINUTE).toISOString().replace(':00.000Z', 'Z');

/** Geocentric centre to centre distance in km, before rounding. */
export function moonDistanceKm(date) {
  const v = GeoMoon(MakeTime(date));
  return Math.hypot(v.x, v.y, v.z) * KM_PER_AU * DISTANCE_SCALE;
}

/** Every apsis from a month before `from` to a month after `to`, in order. */
function apsides(from, to) {
  const list = [];
  let apsis = SearchLunarApsis(MakeTime(new Date(from - 40 * DAY)));
  while (apsis.time.date.getTime() <= to + 40 * DAY) {
    list.push({
      kind: APSIS[apsis.kind],
      ms: apsis.time.date.getTime(),
      at: toMinute(apsis.time.date),
      distanceKm: km(apsis.dist_km),
    });
    apsis = NextLunarApsis(apsis);
  }
  return list;
}

const pick = ({ at, distanceKm }) => ({ at, distanceKm });

export async function renderMoonDistances() {
  const sky = JSON.parse(await readFile(skyPath, 'utf8'));
  const moons = sky.moons;
  const first = Date.parse(moons[0].at);
  const last = Date.parse(moons.at(-1).at);
  const all = apsides(first, last);

  const problems = [];
  for (let i = 1; i < all.length; i += 1) {
    if (all[i].kind === all[i - 1].kind) problems.push(`two ${all[i].kind}s in a row at ${all[i].at}`);
    const days = (all[i].ms - all[i - 1].ms) / DAY;
    if (days < 9 || days > 20) problems.push(`${days.toFixed(1)} days between apsides at ${all[i].at}`);
  }

  const lunations = moons.map((moon) => {
    if (moon.type !== 'new' && moon.type !== 'full') problems.push(`unknown lunation type ${moon.type}`);
    const ms = Date.parse(moon.at);
    const side = (kind, before) => {
      const list = all.filter((a) => a.kind === kind && (before ? a.ms <= ms : a.ms > ms));
      const hit = before ? list.at(-1) : list[0];
      if (!hit) problems.push(`no ${kind} ${before ? 'before' : 'after'} ${moon.at}`);
      return hit ? pick(hit) : null;
    };
    const entry = {
      type: moon.type,
      at: moon.at,
      distanceKm: Math.round(moonDistanceKm(new Date(ms))),
      perigee: { before: side('perigee', true), after: side('perigee', false) },
      apogee: { before: side('apogee', true), after: side('apogee', false) },
    };
    // Between two apsides the distance runs one way, so the lunation's lies
    // between the apsis just before it and the one just after it.
    const prev = all.filter((a) => a.ms <= ms).at(-1);
    const next = all.find((a) => a.ms > ms);
    const { distanceKm } = entry;
    if (prev && next) {
      const lo = Math.min(prev.distanceKm, next.distanceKm);
      const hi = Math.max(prev.distanceKm, next.distanceKm);
      if (distanceKm < lo || distanceKm > hi) problems.push(`${moon.at}: ${distanceKm} km lies outside ${lo} to ${hi} km`);
    }
    if (distanceKm < 355_000 || distanceKm > 407_000) problems.push(`${moon.at}: ${distanceKm} km`);
    return entry;
  });

  if (problems.length) {
    throw new Error(`build-moon-distances: validation failed:\n  ${problems.join('\n  ')}`);
  }

  const payload = {
    source: 'scripts/build-moon-distances.mjs',
    catalog: 'src/data/sky.json',
    distance: 'geocentric, centre of the Earth to centre of the Moon, geometric, whole km',
    lunations,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

async function main() {
  const check = process.argv.includes('--check');
  const text = await renderMoonDistances();
  const count = JSON.parse(text).lunations.length;
  if (check) {
    const committed = await readFile(MOON_DISTANCES_PATH, 'utf8').catch(() => '');
    if (committed !== text) {
      console.error('build-moon-distances: src/data/moon-distances.json is stale; run node scripts/build-moon-distances.mjs');
      process.exit(1);
    }
    console.log(`build-moon-distances: ${count} lunations up to date`);
  } else {
    await writeFile(MOON_DISTANCES_PATH, text);
    console.log(`build-moon-distances: ${count} lunations → src/data/moon-distances.json`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
