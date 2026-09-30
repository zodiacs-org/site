/*
 * The engine's clock, for build.py: the only thing the independent references
 * take from the engine besides the instants the product returns.
 *
 * Since @zodiacs/engine 0.1.1-rc.15 the engine reads an instant, the product's
 * millisecond transport, from 1972-01-01 to 2027-10-02 as UTC: TT = UTC +
 * (TAI − UTC) + 32.184 s from the IERS leap seconds, and UT1 = UTC +
 * (UT1 − UTC) from the IERS tables. Any other instant it reads as UT1, with
 * TT = UT1 + ΔT of its model (zodiacs-deltat/1). It then makes
 * astronomy-engine's time at that UT1 with the basis's ΔT held for the call.
 * This does the same with the engine's own time basis
 * (src/lib/engine/time-basis.mjs), so each reference is evaluated at the TT
 * and UT1 the engine uses, and a comparison measures positions and angles
 * rather than the clock; the clock is checked against the IERS separately
 * (docs/platform/evidence/deltat-2026-09-25/).
 *
 * For every instant in the request: UT1 and TT, days from J2000, and ΔT. For
 * every range: at uniform nodes of the instant, and on both sides of every
 * change of piece of the time basis inside the range (a leap second,
 * 1972-01-01, the end of the IERS table), UT1 − instant and TT − UT1 in
 * seconds. build.py interpolates both linearly, to carry a TT root back to
 * the product's millisecond transport; TT − instant is constant within a
 * piece of the IERS basis, so there it is exact.
 *
 * `returns` asks for the instants the product returns for a solar or lunar
 * return: the "returned chart" references are evaluated at those instants,
 * and nothing else about them comes from the product.
 *
 *   npx vite-node --script docs/engine-validation/independent-references/tools/engine-clock.ts request.json > clock.json
 */
import { readFileSync } from 'node:fs';
import '../../../../scripts/lib/deltat-install.mjs';
import { MakeTime, SetDeltaTFunction } from 'astronomy-engine';
import { deltaT, deltaTAt } from '@zodiacs/engine/deltat';
import { ENGINE_VERSION } from '@zodiacs/engine';
import { timeBasis } from '../../../../src/lib/engine/time-basis.mjs';
import { bodyLongitude } from '../../../../src/lib/engine/full';
import { solarReturnChart } from '../../../../src/lib/engine/solar-return';
import { lunarReturnChart } from '../../../../src/lib/engine/lunar-return';

type Request = {
  instants: Record<string, string>;
  ranges: Record<string, { fromUtc: string; toUtc: string; stepDays: number }>;
  returns: Record<string, {
    kind: 'solar-nearest' | 'solar-most-recent' | 'lunar';
    birthUtc: string; afterUtc: string; latitude: number; longitude: number;
  }>;
};

const request: Request = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const DAY = 86_400_000;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

/** astronomy-engine's time for an instant, as the engine's timeOf makes it. */
function engineTime(ms: number) {
  const basis = timeBasis(ms, 'utc');
  SetDeltaTFunction(() => basis.deltaT.seconds);
  try {
    const time = MakeTime(basis.ut1Days);
    return { basis, ut: time.ut, tt: time.tt };
  } finally {
    SetDeltaTFunction(deltaT);
  }
}

/** The piece of the time basis an instant falls in: the basis, and TAI − UTC within the IERS one. */
function piece(ms: number): string {
  const { timeScale } = timeBasis(ms, 'utc');
  return `${timeScale.basis} ${timeScale.leapSeconds?.taiMinusUtc ?? ''}`;
}

/** The first millisecond of every change of piece in (a, b], for b − a of at most a month. */
function changes(a: number, b: number): number[] {
  if (b - a > 31 * DAY) throw new RangeError('changes() is for spans of at most a month');
  if (piece(a) === piece(b)) return [];
  if (b - a <= 1) return [b];
  const mid = Math.floor((a + b) / 2);
  return [...changes(a, mid), ...changes(mid, b)];
}

/** [instant days from J2000, UT1 − instant (s), TT − UT1 (s)], as the engine takes the instant. */
function node(ms: number): [number, number, number] {
  const days = (ms - J2000_MS) / DAY;
  const { ut, tt } = engineTime(ms);
  return [days, (ut - days) * 86400, (tt - ut) * 86400];
}

const instants = Object.fromEntries(Object.entries(request.instants).map(([key, utc]) => {
  const { basis, ut, tt } = engineTime(Date.parse(utc));
  return [key, { utc, ut, tt, deltaTSeconds: (tt - ut) * 86400, basis: basis.timeScale.basis }];
}));

const ranges = Object.fromEntries(Object.entries(request.ranges).map(([key, range]) => {
  const from = Date.parse(range.fromUtc);
  const to = Date.parse(range.toUtc);
  const step = range.stepDays * DAY;
  const uniform: number[] = [];
  for (let t = from; t <= to + step; t += step) uniform.push(t);
  const edges = uniform.slice(1).flatMap((t, i) => changes(uniform[i], t));
  const nodes = [...uniform, ...edges.flatMap((edge) => [edge - 1, edge])]
    .sort((a, b) => a - b)
    .filter((t, i, all) => i === 0 || t !== all[i - 1])
    .map(node);
  return [key, { ...range, edges: edges.map((edge) => new Date(edge).toISOString()), nodes }];
}));

const returns = Object.fromEntries(Object.entries(request.returns).map(([key, spec]) => {
  const place = { latitude: spec.latitude, longitude: spec.longitude };
  let utc: Date;
  if (spec.kind === 'lunar') {
    const natal = { utc: new Date(spec.birthUtc), latitude: 0, longitude: 0, houseSystem: 'placidus' as const, timeKnown: true };
    utc = lunarReturnChart(natal, new Date(spec.afterUtc), place).input.utc;
  } else {
    const natalSun = bodyLongitude('Sun', new Date(spec.birthUtc));
    const mode = spec.kind === 'solar-most-recent' ? 'most-recent' : undefined;
    utc = solarReturnChart(natalSun, new Date(spec.afterUtc), place, 'placidus', mode).input.utc;
  }
  return [key, utc.toISOString()];
}));

// The ΔT model, which reads every instant outside 1972 to 2027-10-02, and the
// IERS basis, which reads every instant inside, as the engine's charts report them.
const model = deltaTAt(0);
const iers = timeBasis(J2000_MS, 'utc').deltaT;
process.stdout.write(`${JSON.stringify({
  engineVersion: ENGINE_VERSION,
  deltaTModel: model.model,
  deltaTTable: model.table,
  deltaTTableDigest: model.tableDigest,
  iersModel: iers.model,
  iersTable: iers.table,
  iersTableDigest: iers.tableDigest,
  instants,
  ranges,
  returns,
})}\n`);
