/*
 * Precomputes the sky data the homepage needs without shipping the
 * ephemeris there: retrograde windows for Mercury–Pluto and the list of
 * new/full moons over the complete 2026–2030 event horizon. Closed
 * retrograde windows also carry their pre- and post-shadow boundaries.
 *
 *   npm run data:sky   →  src/data/sky.json
 *
 * The homepage's SkyTicker island reads this at build time; its own
 * lite Sun/Moon math covers the live positions. Re-run yearly (or wire
 * a cron) so the window stays ahead of the calendar.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { bodyLongitude } from '@zodiacs/engine/internal';
import { searchLunations } from './lunation-search.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputIndex = process.argv.indexOf('--output');
const requestedOutput = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
if (outputIndex >= 0 && !requestedOutput) throw new Error('--output requires a file path');
const generatedAtIndex = process.argv.indexOf('--generated-at');
const requestedGeneratedAt = generatedAtIndex >= 0 ? process.argv[generatedAtIndex + 1] : null;
if (generatedAtIndex >= 0 && !requestedGeneratedAt) throw new Error('--generated-at requires an ISO instant');
const generatedAt = requestedGeneratedAt ?? new Date().toISOString();
if (new Date(generatedAt).toISOString() !== generatedAt) {
  throw new Error('--generated-at must be a canonical ISO instant');
}
const out = requestedOutput ? resolve(process.cwd(), requestedOutput) : resolve(root, 'src/data/sky.json');
await mkdir(dirname(out), { recursive: true });

const FROM = new Date('2026-01-01T00:00:00Z');
const TO = new Date('2031-01-01T00:00:00Z');
// A 2030 retrograde can station direct after the display horizon. Scan far
// enough to close every window that begins before TO, while keeping new 2031
// windows and lunations outside the committed five-year catalog.
const STATION_SCAN_TO = new Date('2031-04-01T00:00:00Z');
const PLANETS = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const DAY = 86_400_000;
const SHADOW_SCAN_DAYS = 730;

// Product catalogue and monthly transit facts share the same apparent
// geocentric ecliptic-of-date longitude and UTC/IERS time basis. Keep the
// catalogue's ±0.25-day station derivative below; it is intentionally not
// the engine's ±0.001-day body speed. See the dated rc.16 station decision.
function lonAt(body, date) {
  return bodyLongitude(body, date);
}

// Signed longitude speed (deg/day) via central difference.
function speedAt(body, date) {
  const h = 0.25; // days
  const before = lonAt(body, new Date(date.getTime() - h * 86400_000));
  const after = lonAt(body, new Date(date.getTime() + h * 86400_000));
  let d = after - before;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d / (2 * h);
}

/** Wrap an angular difference to (−180, 180]. */
function wrap180(value) {
  const wrapped = ((value % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

// ── Retrograde windows (daily scan, refined to the hour) ─────────────
function refine(body, lo, hi, wantRetro) {
  // Binary search for the sign change of the speed between lo and hi.
  for (let i = 0; i < 16; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if ((speedAt(body, mid) < 0) === wantRetro) hi = mid; else lo = mid;
  }
  return hi;
}

/** Refine a forward-motion crossing of one target longitude. */
function refineDirectCrossing(body, target, lo, hi) {
  for (let i = 0; i < 20; i += 1) {
    const mid = new Date((lo.getTime() + hi.getTime()) / 2);
    if (wrap180(lonAt(body, mid) - target) >= 0) hi = mid; else lo = mid;
  }
  return hi;
}

/** Find direct-motion crossings of a longitude in a bounded interval.
 * Daily brackets are safe here: Mercury, the fastest listed body, moves only
 * a few degrees per day, and the ±180° seam is explicitly rejected. */
function directCrossings(body, target, from, to) {
  const crossings = [];
  let previousDate = from;
  let previous = wrap180(lonAt(body, previousDate) - target);
  for (let time = from.getTime() + DAY; time <= to.getTime(); time += DAY) {
    const date = new Date(time);
    const current = wrap180(lonAt(body, date) - target);
    if (previous < 0 && current >= 0 && Math.abs(previous) < 90 && Math.abs(current) < 90) {
      const at = refineDirectCrossing(body, target, previousDate, date);
      if (speedAt(body, at) > 0) crossings.push(at);
    }
    previousDate = date;
    previous = current;
  }
  return crossings;
}

const retrogrades = [];
for (const body of PLANETS) {
  let prevRetro = speedAt(body, FROM) < 0;
  let openStart = prevRetro ? FROM : null;
  for (let t = FROM.getTime() + 86400_000; t <= STATION_SCAN_TO.getTime(); t += 86400_000) {
    const date = new Date(t);
    const retro = speedAt(body, date) < 0;
    if (retro !== prevRetro) {
      const boundary = refine(body, new Date(t - 86400_000), date, retro);
      if (retro) openStart = boundary;
      else {
        if ((openStart?.getTime() ?? FROM.getTime()) < TO.getTime()) {
          retrogrades.push({ planet: body, from: openStart?.toISOString() ?? FROM.toISOString(), to: boundary.toISOString() });
        }
        openStart = null;
      }
      prevRetro = retro;
    }
  }
  if (openStart && openStart < TO) retrogrades.push({ planet: body, from: openStart.toISOString(), to: null });
  console.log(`${body}: scanned`);
}
retrogrades.sort((a, b) => a.from.localeCompare(b.from));

// ── Retrograde shadows ────────────────────────────────────────────────
// A pre-shadow begins when the direct planet first crosses the longitude of
// its eventual direct station. A post-shadow ends when it again crosses the
// longitude of the retrograde station. Clamped/open windows cannot support
// both facts, so they expose explicit nulls rather than invented boundaries.
for (const window of retrogrades) {
  const clamped = window.from === FROM.toISOString();
  if (clamped || !window.to) {
    window.preShadowStart = null;
    window.postShadowEnd = null;
    continue;
  }
  const stationRetrograde = new Date(window.from);
  const stationDirect = new Date(window.to);
  const directStationLongitude = lonAt(window.planet, stationDirect);
  const retrogradeStationLongitude = lonAt(window.planet, stationRetrograde);
  const preCandidates = directCrossings(
    window.planet,
    directStationLongitude,
    new Date(stationRetrograde.getTime() - SHADOW_SCAN_DAYS * DAY),
    stationRetrograde,
  );
  const postCandidates = directCrossings(
    window.planet,
    retrogradeStationLongitude,
    stationDirect,
    new Date(stationDirect.getTime() + SHADOW_SCAN_DAYS * DAY),
  );
  window.preShadowStart = preCandidates.at(-1)?.toISOString() ?? null;
  window.postShadowEnd = postCandidates[0]?.toISOString() ?? null;
}

const shadowProblems = [];
for (const window of retrogrades) {
  const clamped = window.from === FROM.toISOString();
  if (clamped || !window.to) {
    if (window.preShadowStart !== null || window.postShadowEnd !== null) {
      shadowProblems.push(`${window.planet} ${window.from}: incomplete window carries a shadow boundary`);
    }
    continue;
  }
  if (!window.preShadowStart || !window.postShadowEnd) {
    shadowProblems.push(`${window.planet} ${window.from}: missing a shadow boundary`);
    continue;
  }
  if (!(window.preShadowStart < window.from && window.from < window.to && window.to < window.postShadowEnd)) {
    shadowProblems.push(`${window.planet} ${window.from}: shadow chronology is invalid`);
  }
  const preDelta = Math.abs(wrap180(
    lonAt(window.planet, new Date(window.preShadowStart))
      - lonAt(window.planet, new Date(window.to)),
  ));
  const postDelta = Math.abs(wrap180(
    lonAt(window.planet, new Date(window.postShadowEnd))
      - lonAt(window.planet, new Date(window.from)),
  ));
  if (preDelta > 0.001 || postDelta > 0.001) {
    shadowProblems.push(`${window.planet} ${window.from}: shadow longitude does not match its station`);
  }
}
if (shadowProblems.length) {
  console.error('build-sky: shadow validation failed —\n  ' + shadowProblems.join('\n  '));
  process.exit(1);
}

// ── New + full moons ──────────────────────────────────────────────────
// Apparent Moon − Sun longitude through the site engine, bisected exactly as
// build-transits.mjs does (shared helper), so sky.json and the monthly
// catalogs carry identical instants for every lunation.
const moons = [];
for (const [targetLon, type] of [[0, 'new'], [180, 'full']]) {
  for (const at of searchLunations(FROM, TO, targetLon)) moons.push({ type, at: at.toISOString() });
}
moons.sort((a, b) => a.at.localeCompare(b.at));

const payload = {
  generatedAt,
  from: FROM.toISOString(),
  to: TO.toISOString(),
  stationBoundaryScanTo: STATION_SCAN_TO.toISOString(),
  shadowBoundaryScanDays: SHADOW_SCAN_DAYS,
  retrogrades,
  moons,
};
await writeFile(out, JSON.stringify(payload, null, 2) + '\n');
console.log(`Done — ${retrogrades.length} retrograde windows, ${moons.length} lunations → ${out}`);
