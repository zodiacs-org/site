/**
 * The Zodiacs side of the multi-year distribution: every ten days from
 * 1800-01-01 to 2199-12-31 at 12:00 UTC, the span the site computes, one line
 * per instant with the engine's longitude and latitude for its twelve bodies
 * and the engine's own UT and TT (days from J2000), which multiyear_swiss.py
 * uses to compare at the same UT and at the same TT. Noon, because Swiss's
 * planetary file starts at 1800-01-01 00:00 TT and the Sun's light-time
 * reaches back before it at midnight.
 *
 *   node docs/platform/evidence/swiss-benchmark/tools/multiyear-zodiacs.mjs > multiyear-zodiacs.jsonl
 *
 * It reads the installed @zodiacs/engine, the vendored version the site runs,
 * writes nothing into the repository and makes no network request.
 *
 * Since engine 0.1.1-rc.8 the engine's clock is its own observed ΔT
 * (@zodiacs/engine/deltat), which it installs in astronomy-engine before each
 * of its calls. Since 0.1.1-rc.15 it reads an instant from 1972 to 2027-10-02
 * as UTC, with TT from the IERS leap seconds and UT1 from IERS UT1 − UTC, and
 * any other instant as UT1 with that ΔT. The UT and TT written are the ones
 * the engine computes the bodies at, from its own time basis
 * (src/lib/engine/time-basis.mjs), made into astronomy-engine's time as the
 * engine makes it; before rc.15 they were MakeTime's for the instant.
 */
import { ENGINE_VERSION } from '@zodiacs/engine';
import { deltaT } from '@zodiacs/engine/deltat';
import { computeBodies } from '@zodiacs/engine/internal';
import { MakeTime, SetDeltaTFunction } from 'astronomy-engine';
import { timeBasis } from '../../../../../src/lib/engine/time-basis.mjs';

SetDeltaTFunction(deltaT);

/** The UT1 and TT (days from J2000) the engine evaluates an instant at. */
function engineClock(date) {
  const basis = timeBasis(date.getTime(), 'utc');
  SetDeltaTFunction(() => basis.deltaT.seconds);
  try {
    return MakeTime(basis.ut1Days);
  } finally {
    SetDeltaTFunction(deltaT);
  }
}

const DAY = 86_400_000;
const start = Date.UTC(1800, 0, 1, 12);
const end = Date.UTC(2200, 0, 1);
const lines = [JSON.stringify({ engine: ENGINE_VERSION, node: process.version, cadenceDays: 10, from: '1800-01-01', to: '2199-12-31' })];
for (let t = start; t < end; t += 10 * DAY) {
  const date = new Date(t);
  const time = engineClock(date);
  const bodies = Object.fromEntries(computeBodies(date).map((b) => [b.body, [b.lon, b.lat]]));
  lines.push(JSON.stringify({ utc: date.toISOString(), ut: time.ut, tt: time.tt, bodies }));
}
process.stdout.write(`${lines.join('\n')}\n`);
