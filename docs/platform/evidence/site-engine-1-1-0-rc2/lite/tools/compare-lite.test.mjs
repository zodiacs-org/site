/**
 * The controls of compare-lite.mjs, section 4.5 of ../PREREGISTRATION.md.
 *
 * Control 2 (each cause, just outside its predicate) and the referee's own
 * control run here in every `npm test`, light: they call the tool's
 * functions on constructed differences and on one package call. Controls 1
 * and 3 to 8 run the whole tool, once each, as a child process with a plan
 * (one change to the site, to an adapter or to a scratch copy of the
 * package), and only when COMPARE_LITE_BASE names the base commit:
 *
 *   COMPARE_LITE_BASE=<40-hex base commit> npx vitest run docs/platform/evidence/site-engine-1-1-0-rc2/lite/tools/compare-lite.test.mjs
 *
 * Each of those must fail the sections it names. None of them is the parity
 * record, and a record made with a plan never passes.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { assignCause, CAUSE_ORDER, CONTROL_ONE_CASE, refereeAgrees, refereeAspects } from './compare-lite.mjs';

const T = 1e-12;
const OBLIQUITY = 23.4392911;
const ok = (value) => ({ ok: true, value });
const refused = (name = 'RangeError', message = 'refused') => ({ ok: false, error: { name, message } });
const pair = (a, b, type, orb, decA, decB, separation = 50) => ({ a, b, type, orb, decA, decB, separation });

describe('compare-lite: each cause, just inside and just outside its predicate (control 2)', () => {
  const row = (body, dec, outOfBounds) => ({ body, dec, outOfBounds });
  const cases = [
    {
      cause: 'ecliptic-clamp',
      inside: { kind: 'row-flag', body: 'North Node', lat: 0, obliquity: OBLIQUITY, s: row('North Node', OBLIQUITY + 5e-13, true), x: row('North Node', OBLIQUITY, false) },
      outside: { kind: 'row-flag', body: 'North Node', lat: 0, obliquity: OBLIQUITY, s: row('North Node', OBLIQUITY + 2e-12, true), x: row('North Node', OBLIQUITY, false) },
    },
    {
      cause: 'sun-bound-exemption',
      inside: { kind: 'row-flag', body: 'Sun', lat: 0.0005, obliquity: OBLIQUITY, s: row('Sun', OBLIQUITY + 0.0005, true), x: row('Sun', OBLIQUITY + 0.0005, false) },
      outside: { kind: 'row-flag', body: 'Sun', lat: 0.002, obliquity: OBLIQUITY, s: row('Sun', OBLIQUITY + 0.002, true), x: row('Sun', OBLIQUITY + 0.002, false) },
    },
    {
      cause: 'bound-boundary',
      inside: { kind: 'row-flag', body: 'Mars', lat: 0.5, obliquity: OBLIQUITY, s: row('Mars', OBLIQUITY + 5e-13, true), x: row('Mars', OBLIQUITY - 5e-13, false) },
      outside: { kind: 'row-flag', body: 'Mars', lat: 0.5, obliquity: OBLIQUITY, s: row('Mars', OBLIQUITY + 2e-12, true), x: row('Mars', OBLIQUITY - 2e-12, false) },
    },
    {
      cause: 'orb-boundary',
      inside: { kind: 'pair-presence', present: 's', a: 'Mars', b: 'Venus', pair: pair('Mars', 'Venus', 'parallel', 1 - 5e-13, 10, 9), maxOrb: 1 },
      outside: { kind: 'pair-presence', present: 's', a: 'Mars', b: 'Venus', pair: pair('Mars', 'Venus', 'parallel', 1 - 2e-12, 10, 9), maxOrb: 1 },
    },
    {
      cause: 'type-tie',
      inside: { kind: 'pair-type', a: 'Mars', b: 'Venus', s: pair('Mars', 'Venus', 'parallel', 0.5, 5e-13, 0.5), x: pair('Mars', 'Venus', 'contraparallel', 0.5, 5e-13, 0.5) },
      outside: { kind: 'pair-type', a: 'Mars', b: 'Venus', s: pair('Mars', 'Venus', 'parallel', 0.5, 2e-12, 0.5), x: pair('Mars', 'Venus', 'contraparallel', 0.5, 2e-12, 0.5) },
    },
    {
      cause: 'order-tie',
      inside: { kind: 'pair-order', inversions: [{ pairs: ['Mars\u0000Venus', 'Mars\u0000Jupiter'], s: 5e-13, x: 5e-13 }] },
      outside: { kind: 'pair-order', inversions: [{ pairs: ['Mars\u0000Venus', 'Mars\u0000Jupiter'], s: 2e-12, x: 2e-12 }] },
    },
    {
      cause: 'declination-formula',
      inside: { kind: 'row-dec', body: 'Mars', lat: 1, obliquity: OBLIQUITY, s: row('Mars', 10, false), x: row('Mars', 10 + 5e-13, false) },
      outside: { kind: 'row-dec', body: 'Mars', lat: 1, obliquity: OBLIQUITY, s: row('Mars', 10, false), x: row('Mars', 10 + 2e-12, false) },
    },
    {
      cause: 'declination-formula',
      inside: { kind: 'pair-number', field: 'orb', a: 'Mars', b: 'Venus', caseShapeEqual: true, s: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5), x: pair('Mars', 'Venus', 'parallel', 0.5 + 5e-13, 10, 9.5) },
      outside: { kind: 'pair-number', field: 'orb', a: 'Mars', b: 'Venus', caseShapeEqual: true, s: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5), x: pair('Mars', 'Venus', 'parallel', 0.5 + 2e-12, 10, 9.5) },
    },
    {
      cause: 'declination-formula',
      inside: { kind: 'row-dec', body: 'Pluto', lat: 30, obliquity: OBLIQUITY, s: row('Pluto', 59, true), x: row('Pluto', 59 + 1e-14, true) },
      outside: { kind: 'row-dec', body: 'Pluto', lat: 40, obliquity: OBLIQUITY, s: row('Pluto', 61, true), x: row('Pluto', 61 + 1e-14, true) },
    },
    {
      cause: 'declination-formula',
      inside: { kind: 'pair-number', field: 'decA', a: 'Mars', b: 'Venus', caseShapeEqual: true, s: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5), x: pair('Mars', 'Venus', 'parallel', 0.5, 10 + 5e-15, 9.5) },
      outside: { kind: 'pair-number', field: 'decA', a: 'Mars', b: 'Venus', caseShapeEqual: false, s: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5), x: pair('Mars', 'Venus', 'parallel', 0.5, 10 + 5e-15, 9.5) },
    },
    {
      cause: 'separation-exact',
      inside: { kind: 'pair-separation', a: 'Mars', b: 'Venus', s: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5, 100), x: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5, 100 + 5e-13) },
      outside: { kind: 'pair-separation', a: 'Mars', b: 'Venus', s: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5, 100), x: pair('Mars', 'Venus', 'parallel', 0.5, 10, 9.5, 100 + 2e-12) },
    },
    {
      cause: 'declination-validation',
      inside: { kind: 'refusal', domain: 'declination', input: { bodies: [{ body: 'Mars', lon: Number.NaN, lat: 1 }], obliquity: OBLIQUITY }, s: ok([]), x: refused() },
      outside: { kind: 'refusal', domain: 'declination', input: { bodies: [{ body: 'Mars', lon: 10, lat: 1 }], obliquity: OBLIQUITY }, s: ok([]), x: refused() },
    },
    {
      cause: 'declination-validation',
      inside: { kind: 'refusal', domain: 'declination', input: { bodies: [{ body: 'Mars', lon: 10, lat: 1 }], obliquity: 91 }, s: ok([]), x: refused() },
      outside: { kind: 'refusal', domain: 'declination', input: { bodies: [{ body: 'Mars', lon: 10, lat: 1 }], obliquity: 91 }, s: refused('TypeError'), x: refused() },
    },
    {
      cause: 'sect-validation',
      inside: { kind: 'refusal', domain: 'sect', input: { siteInput: null, packageInput: { convention: 'altitude', sunAltitude: 91, sunLon: 100 } }, s: ok({}), x: refused() },
      outside: { kind: 'refusal', domain: 'sect', input: { siteInput: null, packageInput: { convention: 'altitude', sunAltitude: 90, sunLon: 100 } }, s: ok({}), x: refused() },
    },
    {
      cause: 'sect-convention',
      inside: { kind: 'sect-convention', recorded: true, s: 'day', x: 'night' },
      outside: { kind: 'sect-convention', recorded: false, s: 'day', x: 'night' },
    },
    {
      cause: 'composite-validation',
      inside: { kind: 'refusal', domain: 'composite', input: { a: [{ body: 'Chiron', lon: 10 }], b: [{ body: 'Sun', lon: 20 }] }, s: ok({}), x: refused() },
      outside: { kind: 'refusal', domain: 'composite', input: { a: [{ body: 'Mars', lon: 10 }], b: [{ body: 'Sun', lon: 20 }] }, s: ok({}), x: refused() },
    },
    {
      cause: 'site-prototype-lookup',
      inside: { kind: 'dignity', planet: 'toString', sign: 'leo', s: [refused('TypeError'), ok([]), ok(true)], x: [ok(null), ok([]), ok(false)] },
      outside: { kind: 'dignity', planet: 'Chiron', sign: 'leo', s: [refused('TypeError'), ok([]), ok(true)], x: [ok(null), ok([]), ok(false)] },
    },
    {
      cause: 'dignity-validation',
      inside: { kind: 'dignity', planet: 'Chiron', sign: 'leo', s: [ok(null), ok([]), ok(false)], x: [refused(), refused(), refused()] },
      outside: { kind: 'dignity', planet: 'Sun', sign: 'leo', s: [ok(null), ok([]), ok(false)], x: [refused(), refused(), refused()] },
    },
  ];

  it('covers every cause', () => {
    expect(new Set(cases.map((row) => row.cause))).toEqual(new Set(CAUSE_ORDER));
  });
  for (const [index, { cause, inside, outside }] of cases.entries()) {
    it(`${cause} (${index}): inside gives the cause, just outside stays unexplained`, () => {
      expect(assignCause(inside)).toBe(cause);
      expect(assignCause(outside)).toBe('unexplained');
    });
  }
  it('a difference no cause covers stays unexplained', () => {
    expect(assignCause({ kind: 'value', path: '.sect', s: 'day', x: 'night' })).toBe('unexplained');
    expect(T).toBe(1e-12);
  });
});

describe('compare-lite: the referee and its control', () => {
  it('gives the package\'s pair at declinations exactly 1 degree apart, and its strict form does not', async () => {
    const lite = await import('@zodiacs/engine/lite');
    const bodies = [{ body: 'Mars', lon: 10, lat: 13.3 }, { body: 'Venus', lon: 200, lat: 12.3 }];
    const rows = lite.declinationsForBodies(bodies, 0).rows.map(({ body, dec }) => ({ body, dec }));
    const aspects = lite.findDeclinationAspects(bodies, 0);
    expect(rows.map((row) => row.dec)).toEqual([13.3, 12.3]);
    expect(aspects.map(({ a, b, type, orb }) => [a, b, type, orb])).toEqual([['Mars', 'Venus', 'parallel', 1]]);
    expect(refereeAgrees(rows, aspects)).toBe(true);
    expect(refereeAgrees(rows, aspects, { strict: true })).toBe(false);
    expect(refereeAspects(rows, { strict: true })).toEqual([]);
  });
  it('orders by the exact orb and keeps pair order on a tie', () => {
    const rows = [{ body: 'Mars', dec: 10 }, { body: 'Venus', dec: 10.5 }, { body: 'Jupiter', dec: 9.5 }, { body: 'Saturn', dec: -10 }];
    expect(refereeAspects(rows)).toEqual([
      { a: 'Mars', b: 'Saturn', type: 'contraparallel' },
      { a: 'Mars', b: 'Venus', type: 'parallel' },
      { a: 'Mars', b: 'Jupiter', type: 'parallel' },
      { a: 'Venus', b: 'Saturn', type: 'contraparallel' },
      { a: 'Jupiter', b: 'Saturn', type: 'contraparallel' },
      { a: 'Venus', b: 'Jupiter', type: 'parallel' },
    ]);
  });
});

// ---------------------------------------------------------------- controls 1 and 3 to 8

const BASE = process.env.COMPARE_LITE_BASE;
const TOOL = fileURLToPath(new URL('./compare-lite.mjs', import.meta.url));
const TIMEOUT = 900_000;

/** Runs the tool with a plan and returns its record. */
function runWithPlan(plan) {
  const work = mkdtempSync(join(tmpdir(), 'compare-lite-control-'));
  try {
    const planPath = join(work, 'plan.json');
    writeFileSync(planPath, JSON.stringify(plan));
    const result = spawnSync(process.execPath, [TOOL, BASE, '--plan', planPath], { encoding: 'utf8', maxBuffer: 1 << 30 });
    if (!result.stdout) throw new Error(`compare-lite.mjs wrote no record (status ${result.status}): ${result.stderr}`);
    return JSON.parse(result.stdout);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
const unexplainedIn = (record, section) => record.unexplained.filter((entry) => entry.section === section).length;
const failsIn = (record, section) => Object.values(record.sections[section].comparisons).some((row) => row.pass === false);

const WRAPPERS = {
  sectAboveZero: `import { sectOf as adapterSectOf } from './sect.real';
export * from './sect.real';
export function sectOf(input: any) {
  if (input.sunAltitude > 0 || !(input.sunAltitude >= 0)) return adapterSectOf(input);
  return { ...adapterSectOf({ ...input, sunAltitude: -1 }), sunAltitude: input.sunAltitude };
}
`,
  dignitiesUncaught: `import { dignityFor as packageDignityFor, dignitiesFor as packageDignitiesFor, hasClassicalDignities as packageHas } from '@zodiacs/engine/lite';
export * from './dignities.real';
export function dignityFor(planet: string, sign: string) { return packageDignityFor(planet as never, sign as never); }
export function dignitiesFor(planet: string, sign: string) { return [...packageDignitiesFor(planet as never, sign as never)]; }
export function hasClassicalDignities(planet: string) { return packageHas(planet as never); }
`,
  moonLightByDay: `import { sectOf as adapterSectOf } from './sect.real';
export * from './sect.real';
export function sectOf(input: any) {
  const reading = adapterSectOf(input);
  return reading.sect === 'day' ? { ...reading, light: 'Moon' } : reading;
}
`,
  longerArc: `import { compositeMidpoints as adapterMidpoints } from './composite.real';
export * from './composite.real';
export function compositeMidpoints(a: any, b: any) {
  return adapterMidpoints(a, b).map(({ body, lon }: any) => ({ body, lon: ((lon + 180) % 360 + 360) % 360 }));
}
`,
};

describe.skipIf(!BASE)('compare-lite: controls 1 and 3 to 8 (COMPARE_LITE_BASE)', () => {
  // Control 1's input holds, besides the 3,000 charts, one constructed luminary pair 1.49995 degrees
  // apart (CONTROL_ONE_CASE, added 2026-11-04 before any run), so that the changed rule must drop a pair.
  it('control 1: the base\'s luminary orb 1.5 written 1.4999 gives unexplained differences in D2-A', () => {
    const record = runWithPlan({ control: 1, sections: ['D2-A'], siteMutations: [{ file: 'src/lib/declination.ts', from: 'export const DECLINATION_ORB_LUMINARY = 1.5;', to: 'export const DECLINATION_ORB_LUMINARY = 1.4999;' }], constructedD2A: [CONTROL_ONE_CASE] });
    expect(unexplainedIn(record, 'D2-A')).toBeGreaterThan(0);
  }, TIMEOUT);
  it('control 3: an adapter whose altitude test is written > 0 fails S2-B', () => {
    const record = runWithPlan({ control: 3, sections: ['S2-B'], headWrappers: { 'src/lib/sect.ts': WRAPPERS.sectAboveZero } });
    expect(failsIn(record, 'S2-B')).toBe(true);
  }, TIMEOUT);
  it('control 4: an adapter that lets RangeError escape fails DG-N', () => {
    const record = runWithPlan({ control: 4, sections: ['DG-N'], headWrappers: { 'src/lib/dignities.ts': WRAPPERS.dignitiesUncaught } });
    expect(failsIn(record, 'DG-N')).toBe(true);
  }, TIMEOUT);
  it('control 5: a base declinationOf without the ecliptic latitude gives unexplained differences in D2-R, D2-P and D2-T', () => {
    const record = runWithPlan({ control: 5, sections: ['D2-R', 'D2-P', 'D2-T'], siteMutations: [{ file: 'src/lib/wheel/ecliptic3d.ts', from: 'const b = latDeg * RAD;', to: 'const b = 0 * RAD;' }] });
    for (const section of ['D2-R', 'D2-P', 'D2-T']) expect(unexplainedIn(record, section)).toBeGreaterThan(0);
  }, TIMEOUT);
  it('control 6: an adapter with the Moon as the sect light by day fails S2-A', () => {
    const record = runWithPlan({ control: '6a', sections: ['S2-A'], headWrappers: { 'src/lib/sect.ts': WRAPPERS.moonLightByDay } });
    expect(failsIn(record, 'S2-A')).toBe(true);
  }, TIMEOUT);
  it('control 6: a lite build that counts the Sun exactly on the ascendant as day under the ecliptic convention fails S2-E', () => {
    const record = runWithPlan({ control: '6b', sections: ['S2-E'], packageMutations: [{ file: 'dist/lite-sect.js', from: 'return normalizeLongitude(sun - ascendant) >= 180 ? "day" : "night";', to: 'return normalizeLongitude(sun - ascendant) >= 180 || normalizeLongitude(sun - ascendant) === 0 ? "day" : "night";' }] });
    expect(failsIn(record, 'S2-E')).toBe(true);
  }, TIMEOUT);
  it('control 7: an adapter whose composite midpoint takes the longer arc fails C2-M, C2-R and C2-P', () => {
    const record = runWithPlan({ control: 7, sections: ['C2-M', 'C2-R', 'C2-P'], headWrappers: { 'src/lib/composite.ts': WRAPPERS.longerArc } });
    for (const section of ['C2-M', 'C2-R', 'C2-P']) expect(failsIn(record, section)).toBe(true);
  }, TIMEOUT);
  it('control 8: a package with Mercury exalted in Gemini fails DG-X', () => {
    const record = runWithPlan({ control: 8, sections: ['DG-X'], packageMutations: [{ file: 'dist/lite-dignities.js', from: 'Mercury: "virgo",', to: 'Mercury: "gemini",' }] });
    expect(failsIn(record, 'DG-X')).toBe(true);
  }, TIMEOUT);
});
