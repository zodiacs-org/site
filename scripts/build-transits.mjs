/*
 * Computes one month of real sky events for the horoscope pipeline:
 * sign ingresses (Sun–Pluto), new + full moons, stations, and exact
 * major aspects between the fast planets and the slow ones. The output
 * is committed JSON that horoscope copy must cite and the horoscope
 * pages render as their event list.
 *
 *   node scripts/build-transits.mjs 2026-07   →  src/data/transits-2026-07.json
 *
 * All positions come through the site's vendored @zodiacs/engine package.
 * Events are refined to the minute by bisection over that engine's values.
 */
import '../src/lib/engine/server-de440.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { degreeInSign, normalizeLongitude, signForLongitude } from '@zodiacs/engine';
import { bodyLongitude } from '@zodiacs/engine/internal';

const month = process.argv[2];
if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) {
  console.error('Usage: node scripts/build-transits.mjs YYYY-MM');
  process.exit(1);
}

const [year, mon] = month.split('-').map(Number);
const FROM = new Date(Date.UTC(year, mon - 1, 1));
const TO = new Date(Date.UTC(year, mon, 1));

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputIndex = process.argv.indexOf('--output');
const requestedOutput = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (outputIndex >= 0 && !requestedOutput) {
  throw new Error('--output requires a file path');
}
const out = requestedOutput
  ? resolve(process.cwd(), requestedOutput)
  : resolve(root, `src/data/transits-${month}.json`);
await mkdir(dirname(out), { recursive: true });

const PLANETS = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const FAST = ['Sun', 'Mercury', 'Venus', 'Mars'];
const SLOW = ['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const ASPECTS = [
  { type: 'conjunction', angle: 0 },
  { type: 'sextile', angle: 60 },
  { type: 'square', angle: 90 },
  { type: 'trine', angle: 120 },
  { type: 'opposition', angle: 180 },
];

/** Wrap to (−180, 180]. */
const wrap180 = (x) => {
  const w = normalizeLongitude(x);
  return w > 180 ? w - 360 : w;
};
const signAt = (lon) => signForLongitude(lon).slug;
const degreeIn = (lon) => degreeInSign(lon);

function lonAt(body, date) {
  return bodyLongitude(body, date);
}

/**
 * Direction and stations use a central difference over ±0.25 day, the step
 * build-sky.mjs uses for the retrograde windows, so these catalogs and sky.json
 * name the same instant for a station. The engine's own speed has used
 * ±0.001 day since 0.1.1-rc.7; measured against Swiss Ephemeris on the 92
 * published stations, the finer step changes each planet's RMS error by less
 * than 0.1 minute, because the positions set the limit
 * (docs/platform/evidence/events-vs-swiss-2026-09-23/README.md).
 */
const STATION_STEP_DAYS = 0.25;

function speedAt(body, date) {
  const step = STATION_STEP_DAYS * 86400_000;
  let difference = lonAt(body, new Date(date.getTime() + step)) - lonAt(body, new Date(date.getTime() - step));
  if (difference > 180) difference -= 360;
  if (difference < -180) difference += 360;
  return difference / (2 * STATION_STEP_DAYS);
}

/** Bisect a boolean predicate flip between lo (false) and hi (true). */
function refine(lo, hi, flipped) {
  for (let i = 0; i < 20; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if (flipped(mid)) hi = mid; else lo = mid;
  }
  return hi;
}

const DAY = 86400_000;
const HOUR = 3_600_000;

/** Find exact lunar elongations without bypassing the site engine. */
function searchLunations(target) {
  const found = [];
  const phaseError = (date) => wrap180(lonAt('Moon', date) - lonAt('Sun', date) - target);
  let previousDate = new Date(FROM.getTime() - DAY);
  let previous = phaseError(previousDate);
  for (let time = FROM.getTime(); time <= TO.getTime(); time += DAY) {
    const date = new Date(time);
    const current = phaseError(date);
    // The <90° guard rejects the artificial sign flip at the ±180° seam.
    if (Math.sign(current) !== Math.sign(previous)
      && Math.abs(current) < 90 && Math.abs(previous) < 90) {
      const rising = current > previous;
      const at = refine(previousDate, date, (candidate) => (phaseError(candidate) > 0) === rising);
      if (at >= FROM && at < TO) found.push(at);
    }
    previousDate = date;
    previous = current;
  }
  return found;
}

// ── Ingresses: sign-index changes, either direction ──────────────────
const ingresses = [];
for (const planet of PLANETS) {
  let prev = signAt(lonAt(planet, FROM));
  // A planet can cross a cusp, station just beyond it, and cross back before
  // the next midnight. Hourly brackets preserve both sub-day ingresses.
  for (let t = FROM.getTime() + HOUR; t <= TO.getTime(); t += HOUR) {
    const date = new Date(t);
    const sign = signAt(lonAt(planet, date));
    if (sign !== prev) {
      const at = refine(new Date(t - HOUR), date, (d) => signAt(lonAt(planet, d)) !== prev);
      if (at >= FROM && at < TO) {
        ingresses.push({
          planet,
          at: at.toISOString(),
          sign: signAt(lonAt(planet, at)),
          retrograde: speedAt(planet, at) < 0,
        });
      }
      prev = sign;
    }
  }
}

// ── Lunations: new + full moons with sign + degree ────────────────────
const lunations = [];
for (const [targetLon, type] of [[0, 'new'], [180, 'full']]) {
  for (const at of searchLunations(targetLon)) {
    const lon = lonAt('Moon', at);
    lunations.push({
      type,
      at: at.toISOString(),
      sign: signAt(lon),
      // Keep the physical coordinate. Presentation rounds later, avoiding
      // impossible pairs such as 30.0 degrees in the preceding sign.
      degree: degreeIn(lon),
    });
  }
}

// ── Stations: longitude-speed sign changes ────────────────────────────
const stations = [];
for (const planet of PLANETS) {
  if (planet === 'Sun') continue; // never stations
  let prevRetro = speedAt(planet, FROM) < 0;
  for (let t = FROM.getTime() + DAY; t <= TO.getTime(); t += DAY) {
    const date = new Date(t);
    const retro = speedAt(planet, date) < 0;
    if (retro !== prevRetro) {
      const at = refine(new Date(t - DAY), date, (d) => (speedAt(planet, d) < 0) === retro);
      if (at >= FROM && at < TO) {
        const lon = lonAt(planet, at);
        stations.push({
          planet,
          at: at.toISOString(),
          type: retro ? 'retrograde' : 'direct',
          sign: signAt(lon),
          degree: degreeIn(lon),
        });
      }
      prevRetro = retro;
    }
  }
}

// ── Exact aspects: fast × slow and slow × slow, majors only ───────────
// For each pair, g(t) = wrap180(lonA − lonB). An aspect of angle A is
// exact when g crosses +A or −A. Daily samples catch every crossing
// (the fastest pair drifts ~1.3°/day); each is bisected to the minute.
const pairs = [
  ...FAST.flatMap((a) => SLOW.map((b) => [a, b])),
  ...SLOW.flatMap((a, i) => SLOW.slice(i + 1).map((b) => [a, b])),
];
const aspects = [];
for (const [a, b] of pairs) {
  const targets = new Set();
  for (const { angle } of ASPECTS) {
    targets.add(angle);
    if (angle !== 0 && angle !== 180) targets.add(-angle);
  }
  for (const target of targets) {
    const h = (d) => wrap180(lonAt(a, d) - lonAt(b, d) - target);
    let prev = h(FROM);
    for (let t = FROM.getTime() + DAY; t <= TO.getTime(); t += DAY) {
      const date = new Date(t);
      const cur = h(date);
      // A true zero crossing, not the ±180 wrap seam.
      if (Math.sign(cur) !== Math.sign(prev) && Math.abs(cur) < 90 && Math.abs(prev) < 90) {
        const rising = cur > prev;
        const at = refine(new Date(t - DAY), date, (d) => (h(d) > 0) === rising);
        if (at >= FROM && at < TO) {
          const lonA = lonAt(a, at);
          const lonB = lonAt(b, at);
          aspects.push({
            a,
            b,
            type: ASPECTS.find((x) => x.angle === Math.abs(target)).type,
            // These records are refined exact hits, not sampled near-aspects.
            // Expose that contract explicitly rather than implying an orb.
            orb: 0,
            at: at.toISOString(),
            aSign: signAt(lonA),
            aDegree: degreeIn(lonA),
            bSign: signAt(lonB),
            bDegree: degreeIn(lonB),
          });
        }
      }
      prev = cur;
    }
  }
  console.log(`${a}–${b}: scanned`);
}

const byTime = (x, y) => x.at.localeCompare(y.at);
const payload = {
  month,
  ingresses: ingresses.sort(byTime),
  lunations: lunations.sort(byTime),
  stations: stations.sort(byTime),
  aspects: aspects.sort(byTime),
};
await writeFile(out, JSON.stringify(payload, null, 2) + '\n');
console.log(
  `Done — ${ingresses.length} ingresses, ${lunations.length} lunations, ` +
  `${stations.length} stations, ${aspects.length} exact aspects → ${out}`,
);
