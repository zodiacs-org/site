/*
 * The year ahead's solar returns before and after F-67: the site's own Sun
 * crossing scan that src/lib/engine/year-scan.ts ran until 2026-10-04, against
 * the package search it calls now. Synthetic charts from a fixed seed; only
 * aggregates are written.
 *
 *   npx vite-node --script docs/platform/evidence/programme-audit-2026-10-04/tools/year-scan-parity.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyLongitude } from '../../../../../src/lib/engine/full.ts';
import { clipToReferenceSpan } from '../../../../../src/lib/engine/reference-span.ts';
import { findLongitudeCrossings } from '../../../../../src/lib/engine/returns.ts';
import { yearScan } from '../../../../../src/lib/engine/year-scan.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../..');
const SEED = 20261004;
const CASES = 1000;
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 366; // ProfileDashboard's YEAR_MS

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const random = mulberry32(SEED);
const birthRange = [Date.parse('1900-01-01T00:00:00Z'), Date.parse('2026-01-01T00:00:00Z')];
const fromRange = [Date.parse('1950-01-01T00:00:00Z'), Date.parse('2199-06-01T00:00:00Z')];
const histogram = {};
let returns = 0;
let sameCount = 0;
let windowsWithTwo = 0;
let windowsWithNone = 0;
let worst = 0;
for (let index = 0; index < CASES; index += 1) {
  const birth = new Date(birthRange[0] + random() * (birthRange[1] - birthRange[0]));
  const sunLon = bodyLongitude('Sun', birth);
  const from = new Date(fromRange[0] + random() * (fromRange[1] - fromRange[0]));
  const to = new Date(from.getTime() + WINDOW_DAYS * DAY_MS);
  const window = clipToReferenceSpan(from, to);
  const before = (window ? findLongitudeCrossings('Sun', sunLon, window.from, window.to, 1) : [])
    .map((crossing) => crossing.at.getTime());
  const after = yearScan({ sunLon, moonLon: null, ascLon: null, birthUtc: birth }, from, to).solarReturns
    .map((instant) => Date.parse(instant));
  if (before.length !== after.length) continue;
  sameCount += 1;
  if (after.length === 2) windowsWithTwo += 1;
  if (after.length === 0) windowsWithNone += 1;
  after.forEach((instant, at) => {
    const delta = Math.abs(instant - before[at]);
    worst = Math.max(worst, delta);
    histogram[delta] = (histogram[delta] ?? 0) + 1;
    returns += 1;
  });
}

const techniques = resolve(root, 'node_modules/@zodiacs/engine/dist/techniques.js');
const record = {
  schema: 'zodiacs.year-scan-parity.v1',
  finding: 'F-67',
  question: 'Do the year ahead\'s solar returns from the package search equal those of the site scan they replace?',
  before: 'findLongitudeCrossings(\'Sun\', natal Sun longitude, window, 1-day step) over the window clipped to 1800–2200, as src/lib/engine/year-scan.ts did at 9d7dd31d',
  after: 'yearScan(...).solarReturns, which walks mostRecentSolarReturnInstant from @zodiacs/engine/techniques back from the window end',
  inputs: {
    seed: SEED,
    generator: 'mulberry32',
    cases: CASES,
    births: 'uniform 1900-01-01 to 2026-01-01 UTC; synthetic, no person',
    windows: `start uniform 1950-01-01 to 2199-06-01 UTC; ${WINDOW_DAYS} days long`,
  },
  engine: {
    version: JSON.parse(readFileSync(resolve(root, 'node_modules/@zodiacs/engine/package.json'), 'utf8')).version,
    techniquesJsSha256: createHash('sha256').update(readFileSync(techniques)).digest('hex'),
  },
  results: {
    windowsWithTheSameCount: sameCount,
    windowsWithTwoReturns: windowsWithTwo,
    windowsWithNoReturn: windowsWithNone,
    returnsCompared: returns,
    maxAbsoluteDifferenceMs: worst,
    absoluteDifferenceMsHistogram: histogram,
  },
  note: 'The shared crossing solver bisects a one-day step 24 times, so the two searches, whose sample grids start at different instants, can settle up to about 5 ms apart on the same crossing. The year ahead shows the solar return to the minute.',
};
writeFileSync(resolve(here, '../year-scan-parity.json'), `${JSON.stringify(record, null, 2)}\n`);
console.log(JSON.stringify(record.results));
