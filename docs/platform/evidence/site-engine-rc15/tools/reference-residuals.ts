/*
 * How far the site's engine is from the independent references, pack by pack:
 * the largest residual of each kind the engine tests gate, and the smallest
 * margin left inside each event band. It computes what the tests compute
 * (src/lib/engine/{engine,transit-scan,solar-return,returns,lunar-return}.test.ts)
 * and asserts nothing; the tests hold the gates. Transit windows are left to
 * transit-window-independent.test.ts, whose checks are band memberships.
 *
 *   npx vite-node --script docs/platform/evidence/site-engine-rc15/tools/reference-residuals.ts [fixture-dir]
 *
 * The fixture directory defaults to src/lib/engine/fixtures; pass another to
 * measure the installed engine against an earlier build of the references.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bodyLongitude, computeBodies, computeChart } from '../../../../../src/lib/engine/full';
import { scanTransitContacts } from '../../../../../src/lib/engine/transit-scan';
import { solarReturnChart } from '../../../../../src/lib/engine/solar-return';
import { findLongitudeCrossings, saturnReturns } from '../../../../../src/lib/engine/returns';
import { lunarReturnChart, lunarReturnInstant } from '../../../../../src/lib/engine/lunar-return';
import type { BodyName, Chart } from '../../../../../src/lib/engine/types';

const root = resolve(import.meta.dirname, '../../../../..');
const dir = resolve(root, process.argv[2] ?? 'src/lib/engine/fixtures');
const read = (name: string) => JSON.parse(readFileSync(resolve(dir, name), 'utf8'));
const policyOf = (name: string) => JSON.parse(readFileSync(resolve(root, 'src/lib/engine/fixtures', name), 'utf8'));
const nodePolar = read('independent-node-polar.json');
const eight = read('independent-eight-cases.json');
const lunar = read('independent-lunar-returns.json');
const lunarPolicy = read('independent-lunar-return-policy.json');
const eightPolicy = policyOf('swiss-eight-cases-policy.json');

const DAY = 86_400_000;
const arcsec = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180) * 3600;
const round = (value: number, digits = 4) => Number(value.toFixed(digits));

/** Largest values by key, with where each was taken. */
class Maxima {
  rows: Record<string, { value: number; at: string }> = {};
  add(key: string, value: number, at: string) {
    if (!(this.rows[key]?.value >= value)) this.rows[key] = { value, at };
  }
  /** A margin: the smallest wins. */
  least(key: string, value: number, at: string) {
    if (!(this.rows[key]?.value <= value)) this.rows[key] = { value, at };
  }
  toJSON() {
    return Object.fromEntries(Object.entries(this.rows).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, { value, at }]) => [key, { value: round(value), at }]));
  }
}

type Positions = Record<string, { longitudeDegrees: number; speedDegreesPerDay?: number }>;
function positions(m: Maxima, prefix: string, bodies: { body: string; lon: number; speed: number }[], expected: Positions, at: string) {
  for (const [name, reference] of Object.entries(expected)) {
    const body = bodies.find((row) => row.body === name)!;
    const kind = name === 'Moon' ? 'moon' : name === 'North Node' ? 'node' : 'planet';
    m.add(`${prefix}.${kind}LongitudeArcsec`, arcsec(body.lon, reference.longitudeDegrees), `${at} ${name}`);
    if (name === 'North Node') m.add(`${prefix}.nodeSpeedDegreesPerDay`, Math.abs(body.speed - reference.speedDegreesPerDay!), at);
  }
}
function chart(m: Maxima, prefix: string, actual: Chart, expected: { positions: Positions; ascmc: number[]; cuspsDegrees: number[] }, at: string) {
  positions(m, prefix, actual.bodies, expected.positions, at);
  m.add(`${prefix}.ascendantArcsec`, arcsec(actual.angles!.asc, expected.ascmc[0]), at);
  m.add(`${prefix}.midheavenArcsec`, arcsec(actual.angles!.mc, expected.ascmc[1]), at);
  actual.houses!.cusps.forEach((cusp, i) => m.add(`${prefix}.cuspArcsec`, arcsec(cusp, expected.cuspsDegrees[i]), `${at} cusp ${i + 1}`));
}
function time(m: Maxima, prefix: string, actualMs: number, expected: { expectedMilliseconds: number }, band: number[], at: string) {
  m.add(`${prefix}.residualMs`, Math.abs(actualMs - expected.expectedMilliseconds), at);
  m.least(`${prefix}.bandMarginMs`, Math.min(actualMs - band[0], band[1] - actualMs), at);
}

// Node and polar pack (engine.test.ts).
const np = new Maxima();
for (const reference of nodePolar.trueNode) {
  const node = computeBodies(new Date(reference.input.utc)).find((row) => row.body === 'North Node')!;
  np.add('trueNode.longitudeArcsec', arcsec(node.lon, reference.longitudeDegrees), reference.id);
  np.add('trueNode.speedDegreesPerDay', Math.abs(node.speed - reference.longitudeSpeedDegreesPerDay), reference.id);
}
for (const reference of nodePolar.polar) {
  const c = computeChart({ utc: new Date(reference.input.utc), latitude: reference.latitudeDegrees, longitude: reference.longitudeDegreesEastPositive, houseSystem: 'placidus', timeKnown: true });
  np.add('polar.ascendantArcsec', arcsec(c.angles!.asc, reference.whole.ascendantDegrees), reference.id);
  np.add('polar.midheavenArcsec', arcsec(c.angles!.mc, reference.whole.midheavenDegrees), reference.id);
  c.houses!.cusps.forEach((cusp, i) => np.add('polar.wholeCuspArcsec', arcsec(cusp, reference.whole.cuspsDegrees[i]), reference.id));
}
for (const reference of nodePolar.houses) {
  const c = computeChart({ utc: new Date(reference.utc), latitude: reference.latitude, longitude: reference.longitude, houseSystem: 'placidus', timeKnown: true });
  np.add('placidus.ascendantArcsec', arcsec(c.angles!.asc, reference.asc), reference.utc);
  np.add('placidus.midheavenArcsec', arcsec(c.angles!.mc, reference.mc), reference.utc);
  c.houses!.cusps.forEach((cusp, i) => np.add('placidus.cuspArcsec', arcsec(cusp, reference.cusps[i]), `${reference.utc} cusp ${i + 1}`));
}

// Eight-case pack (engine.test.ts epochs, transit-scan, solar-return and returns tests).
const ec = new Maxima();
for (const reference of eight.epochs) {
  const input = eightPolicy.fixedEpochs.find((row: { id: string }) => row.id === reference.id);
  positions(ec, 'epochs', computeBodies(new Date(input.productDateTransport)), reference.positions, reference.id);
}
for (const reference of eight.stations) {
  const input = eightPolicy.stations.find((row: { id: string }) => row.id === reference.id);
  const contacts = scanTransitContacts(
    { bodies: [{ body: 'Sun', lon: reference.targetLongitudeDegrees, speed: 0, retrograde: false }] },
    new Date(input.fromUTC), new Date(input.toUTC),
    { transitBodies: [input.body], natalPoints: ['Sun'], aspects: ['conjunction'] },
  );
  contacts.forEach((contact, i) => time(ec, 'stations.crossing', Date.parse(contact.exactUtc), reference.crossings[i], reference.crossings[i].allowedMilliseconds, `${reference.id} pass ${i + 1}`));
  ec.add('stations.analyticStationLongitudeArcsec', arcsec(bodyLongitude(input.body as BodyName, new Date(reference.analyticStationMilliseconds)), reference.analyticStationLongitudeDegrees), reference.id);
}
{
  const input = eightPolicy.solar;
  const reference = eight.solar;
  const place = { latitude: input.latitudeDegrees, longitude: input.longitudeDegreesEastPositive };
  const natalSun = bodyLongitude('Sun', new Date(input.birthUTC));
  ec.add('solar.natalSunArcsec', arcsec(natalSun, reference.natalLongitudeDegrees), input.birthUTC);
  const nearest = solarReturnChart(natalSun, new Date(input.nearUTC), place, 'placidus');
  const recent = solarReturnChart(natalSun, new Date(input.currentSelectionAtUTC), place, 'placidus', 'most-recent');
  time(ec, 'solar.nearest', nearest.input.utc.getTime(), reference.nearest, reference.nearest.allowedMilliseconds, 'nearest');
  time(ec, 'solar.mostRecent', recent.input.utc.getTime(), reference.mostRecent, reference.mostRecent.allowedMilliseconds, 'most recent');
  ec.add('solar.returnedChartInstantDriftMs', Math.abs(nearest.input.utc.getTime() - Date.parse(reference.returnedChartUTC)), reference.returnedChartUTC);
  const at = (utc: string) => computeChart({ utc: new Date(utc), ...place, houseSystem: 'placidus', timeKnown: true });
  chart(ec, 'solar.returnedChart', at(reference.returnedChartUTC), reference.returnedChart, reference.returnedChartUTC);
  chart(ec, 'solar.independentChart', at(reference.independentChartUTC), reference.independentChart, reference.independentChartUTC);
}
{
  const reference = eight.saturn;
  const actual = saturnReturns(new Date(eightPolicy.saturn.productDateTransport));
  ec.add('saturn.natalArcsec', arcsec(actual.natalLon, reference.natalLongitudeDegrees), eightPolicy.saturn.productDateTransport);
  actual.seasons.forEach((season, s) => season.crossings.forEach((crossing, p) => {
    const expected = reference.seasons[s].crossings[p];
    time(ec, 'saturn.crossing', crossing.at.getTime(), expected, expected.allowedMilliseconds, `season ${s + 1} pass ${p + 1}`);
  }));
}

// Lunar-return pack (lunar-return.test.ts).
const lr = new Maxima();
const natalInput = (utc: string) => ({ utc: new Date(utc), latitude: 0, longitude: 0, houseSystem: 'placidus' as const, timeKnown: true });
const place = (loc: { latitudeDegrees: number; longitudeDegreesEastPositive: number }) => ({ latitude: loc.latitudeDegrees, longitude: loc.longitudeDegreesEastPositive });
for (const reference of lunar.cases) {
  const input = lunarPolicy.cases.find((row: { id: string }) => row.id === reference.id);
  const natal = natalInput(input.birthTransport);
  const after = new Date(input.afterTransport);
  const target = bodyLongitude('Moon', natal.utc);
  lr.add('natalMoonArcsec', arcsec(target, reference.natalLongitudeDegrees), reference.id);
  const all = findLongitudeCrossings('Moon', target, after, new Date(after.getTime() + 40 * DAY), 0.25);
  all.forEach((event, i) => time(lr, 'natalDerived', event.at.getTime(), reference.crossings[i], reference.crossings[i].natalDerivedAllowedMilliseconds, `${reference.id} crossing ${i + 1}`));
  if (reference.crossings[0].fixedExternalTargetAllowedMilliseconds) {
    const fixed = lunarReturnInstant(reference.natalLongitudeDegrees, after);
    time(lr, 'fixedTarget', fixed.getTime(), reference.crossings[0], reference.crossings[0].fixedExternalTargetAllowedMilliseconds, reference.id);
  }
  const at = (utc: string, loc: { latitudeDegrees: number; longitudeDegreesEastPositive: number }) => computeChart({ utc: new Date(utc), ...place(loc), houseSystem: 'placidus', timeKnown: true });
  chart(lr, 'independentChart', at(reference.independentChartUTC, input.returnLocation), reference.chartAtIndependentInstant, reference.id);
  if (reference.relocatedChartAtIndependentInstant) chart(lr, 'independentChart', at(reference.independentChartUTC, input.relocationAtSameInstant), reference.relocatedChartAtIndependentInstant, `${reference.id} relocated`);
}
for (const reference of lunar.returnedCharts) {
  const input = lunarPolicy.cases.find((row: { id: string }) => row.id === reference.caseId);
  const loc = reference.id.endsWith(':relocation') ? input.relocationAtSameInstant : input.returnLocation;
  const returned = lunarReturnChart(natalInput(input.birthTransport), new Date(input.afterTransport), place(loc));
  lr.add('returnedChartInstantDriftMs', Math.abs(returned.input.utc.getTime() - Date.parse(reference.utc)), reference.id);
  chart(lr, 'returnedChart', computeChart({ utc: new Date(reference.utc), ...place(loc), houseSystem: 'placidus', timeKnown: true }), reference.reference, reference.id);
}

process.stdout.write(`${JSON.stringify({
  fixtures: dir.slice(root.length + 1),
  engineClock: nodePolar.engineClock,
  units: 'arcseconds, milliseconds and degrees per day, rounded to 1e-4; "at" is the case',
  nodePolar: np, eightCases: ec, lunarReturns: lr,
}, null, 1)}\n`);
