/*
 * Prints the engine's own clock for grids A and L of angle-grid-inputs.json,
 * for angle-arbiter.py: each instant as UT1 and TT days from J2000, the two
 * numbers the engine's angles are computed at. Since @zodiacs/engine
 * 0.1.1-rc.15 the engine reads an instant from 1972 to 2027-10-02 as UTC, with
 * TT from the IERS leap seconds and UT1 from IERS UT1 − UTC, and any other
 * instant as UT1 with its ΔT model; it then makes astronomy-engine's time at
 * that UT1 with the basis's ΔT held for the call. This does the same, with the
 * engine's own time basis (src/lib/engine/time-basis.mjs). The arbiter uses
 * the same two numbers, so its comparison with the engine measures the angle
 * model and not the clock. Run from the repository root:
 *
 *   npx vite-node --script docs/platform/evidence/engine-beyond-swiss/corpora/tools/angle-clock.ts > angle-clock.json
 */
import { readFileSync } from 'node:fs';
import { MakeTime, SetDeltaTFunction } from 'astronomy-engine';
import { deltaT } from '@zodiacs/engine/deltat';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { timeBasis } from '../../../../../../src/lib/engine/time-basis.mjs';

const corpus = JSON.parse(readFileSync(new URL('../angle-grid-inputs.json', import.meta.url), 'utf8'));
const clock = (rows: [string, number, number, string][]) => rows.map(([utc]) => {
  const basis = timeBasis(Date.parse(utc), 'utc');
  SetDeltaTFunction(() => basis.deltaT.seconds);
  try {
    const time = MakeTime(basis.ut1Days);
    return [time.ut, time.tt];
  } finally {
    SetDeltaTFunction(deltaT);
  }
});
process.stdout.write(`${JSON.stringify({ engineVersion: ENGINE_VERSION, A: clock(corpus.A), L: clock(corpus.L) })}\n`);
