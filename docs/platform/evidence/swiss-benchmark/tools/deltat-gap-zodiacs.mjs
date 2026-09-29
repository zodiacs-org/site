/**
 * The engine's side of the ΔT comparison with Swiss Ephemeris from 2100 to
 * 2199: every day at 00:00 UTC, one line with the engine's ΔT, its 1-σ band
 * and the Moon's speed, which deltat_gap_swiss.py turns into statistics of
 * how far the two programs' ΔT differ and how far that alone moves the Moon.
 *
 *   node docs/platform/evidence/swiss-benchmark/tools/deltat-gap-zodiacs.mjs > <outside the repository>/deltat-gap-zodiacs.jsonl
 *
 * It reads the installed @zodiacs/engine and makes no network request. The
 * Moon's speed is the engine's apparent longitude of date, differenced over
 * ±60 s on the engine's own clock, in arcseconds per second of time; the
 * difference over ±60 s is exact to far below 0.001″/s here.
 */
import '../../../../../scripts/lib/deltat-install.mjs';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { deltaTAt } from '@zodiacs/engine/deltat';
import { bodyLongitude } from '@zodiacs/engine/internal';

const DAY_MS = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);
const FROM = Date.UTC(2100, 0, 1);
const TO = Date.UTC(2199, 11, 31);
const STEP_MS = 60_000;
const wrap = (x) => ((x + 540) % 360) - 180;

const model = deltaTAt(0);
const lines = [JSON.stringify({
  engine: ENGINE_VERSION,
  node: process.version,
  deltaTModel: model.model,
  deltaTTable: model.table,
  deltaTTableDigest: model.tableDigest,
  from: '2100-01-01',
  to: '2199-12-31',
  cadenceDays: 1,
  atUtc: '00:00',
})];
for (let t = FROM; t <= TO; t += DAY_MS) {
  const deltaT = deltaTAt((t - J2000_MS) / DAY_MS);
  const before = bodyLongitude('Moon', new Date(t - STEP_MS));
  const after = bodyLongitude('Moon', new Date(t + STEP_MS));
  lines.push(JSON.stringify({
    utc: new Date(t).toISOString(),
    ut: (t - J2000_MS) / DAY_MS,
    deltaT: deltaT.seconds,
    sigma: deltaT.sigma,
    moonArcsecPerSecond: Math.abs(wrap(after - before)) * 3600 / (2 * STEP_MS / 1000),
  }));
}
process.stdout.write(`${lines.join('\n')}\n`);
