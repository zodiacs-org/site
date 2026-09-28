/*
 * The engine's clock, for build.py: the only thing the independent references
 * take from the engine besides the instants the product returns.
 *
 * For every instant in the request, UT and TT as astronomy-engine's MakeTime
 * reads it with the engine's ΔT installed (UT taken as the instant, TT = UT +
 * ΔT from model zodiacs-deltat/1), so each reference is evaluated at the same
 * TT as the engine and a comparison measures positions and angles rather than
 * the clock; the clock is checked against the IERS separately
 * (docs/platform/evidence/deltat-2026-09-25/). For every range, ΔT at uniform
 * UT nodes, which build.py interpolates to carry a TT root back to the
 * product's millisecond transport.
 *
 * `returns` asks for the instants the product returns for a solar or lunar
 * return: the "returned chart" references are evaluated at those instants,
 * and nothing else about them comes from the product.
 *
 *   npx vite-node --script docs/engine-validation/independent-references/tools/engine-clock.ts request.json > clock.json
 */
import { readFileSync } from 'node:fs';
import '../../../../scripts/lib/deltat-install.mjs';
import { MakeTime } from 'astronomy-engine';
import { deltaTAt } from '@zodiacs/engine/deltat';
import { ENGINE_VERSION } from '@zodiacs/engine';
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

const instants = Object.fromEntries(Object.entries(request.instants).map(([key, utc]) => {
  const time = MakeTime(new Date(utc));
  return [key, { utc, ut: time.ut, tt: time.tt, deltaTSeconds: (time.tt - time.ut) * 86400 }];
}));

const ranges = Object.fromEntries(Object.entries(request.ranges).map(([key, range]) => {
  const from = Date.parse(range.fromUtc);
  const to = Date.parse(range.toUtc);
  const nodes: [number, number][] = [];
  for (let t = from; t <= to + range.stepDays * DAY; t += range.stepDays * DAY) {
    const time = MakeTime(new Date(t));
    nodes.push([time.ut, (time.tt - time.ut) * 86400]);
  }
  return [key, { ...range, nodes }];
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

const model = deltaTAt(0);
process.stdout.write(`${JSON.stringify({
  engineVersion: ENGINE_VERSION,
  deltaTModel: model.model,
  deltaTTable: model.table,
  deltaTTableDigest: model.tableDigest,
  instants,
  ranges,
  returns,
})}\n`);
