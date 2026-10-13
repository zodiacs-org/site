/**
 * How far past a target a planet's station can turn and still have both
 * crossings missed by a plain scan at a fixed 5-day step, on the engine's
 * own longitudes (@zodiacs/engine 1.0.0, as the site installs it).
 *
 *   node docs/platform/evidence/claims-engine-references-20261012/tools/blind-band.mjs
 *
 * For each Saturn and Jupiter station from 2019 to 2024 it records the second
 * derivative of longitude, f″, by a central difference over ±1 day, and the
 * band f″·h²/8 within which two crossings can both fall inside one 5-day
 * cell. It then scans with every phase of the 5-day grid, in steps of
 * 0.05 day, for targets placed a given depth short of the station's
 * longitude, and counts the phases at which a plain sign-change scan finds
 * neither crossing. The result is written to blind-band.json beside this
 * directory.
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, positions, searchLongitudeCrossingsWith } from '@zodiacs/engine';

const DAY = 86_400_000;
const STEP_DAYS = 5;
const here = dirname(fileURLToPath(import.meta.url));
const lonAt = (body, ms) => positions(new Date(ms)).find((row) => row.body === body).lon;
const speedAt = (body, date) => positions(date).find((row) => row.body === body).speed;
const offset = (lon, target) => ((lon - target + 540) % 360) - 180;

/** Phases of the 5-day grid, out of 100, at which a plain scan finds neither crossing around the station. */
function missedPhases(body, stationMs, depth) {
  const top = lonAt(body, stationMs);
  const retrograde = speedAt(body, new Date(stationMs - DAY)) > 0; // direct before: the station is a maximum
  const target = retrograde ? top - depth : top + depth;
  let missed = 0;
  for (let phase = 0; phase < 100; phase += 1) {
    const start = stationMs - 20 * DAY + (phase / 100) * STEP_DAYS * DAY;
    let found = 0;
    let previous = offset(lonAt(body, start), target);
    for (let k = 1; k <= Math.ceil(40 / STEP_DAYS); k += 1) {
      const current = offset(lonAt(body, start + k * STEP_DAYS * DAY), target);
      if (Math.sign(current) !== Math.sign(previous)) found += 1;
      previous = current;
    }
    if (found === 0) missed += 1;
  }
  return missed;
}

const rows = [];
for (const body of ['Saturn', 'Jupiter']) {
  const stations = searchLongitudeCrossingsWith(speedAt, body, 0, new Date('2019-01-01T00:00:00Z'), new Date('2024-12-31T00:00:00Z'), { stepDays: 5 }).crossings;
  for (const station of stations) {
    const t = station.at.getTime();
    const second = lonAt(body, t + DAY) - 2 * lonAt(body, t) + lonAt(body, t - DAY);
    const band = (Math.abs(second) * STEP_DAYS ** 2) / 8;
    const depths = body === 'Saturn' ? [0.003, 0.005, 0.0103] : [0.008, 0.0103, 0.0205];
    rows.push({
      body,
      station: station.at.toISOString(),
      secondDerivativeDegPerDay2: Number(second.toExponential(4)),
      bandDeg: Number(band.toFixed(5)),
      missedPhasesOf100: Object.fromEntries(depths.map((depth) => [String(depth), missedPhases(body, t, depth)])),
    });
  }
}
const result = {
  engine: ENGINE_VERSION,
  stepDays: STEP_DAYS,
  rule: 'a plain scan misses both crossings only when they fall inside one cell: depth < f″·h²/8',
  stations: rows,
};
writeFileSync(resolve(here, '..', 'blind-band.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
