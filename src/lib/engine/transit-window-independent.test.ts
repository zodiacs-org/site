import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fixtures from './fixtures/transit-window-horizons.json';
import { bodyLongitude, computeBodies, computeChart } from './full';
import { createTransitWindowScanner, cropTransitWindows, type TransitWindow, type WindowNatalChart, type WindowNatalPoint, type SlowTransitBody, type WindowAspect } from './transit-window-core';

type Minimum = { orbDegrees: number; timeEnvelopeMs: number[]; sourceBestUtc: string };
type SourceCrop = { fromUtc: string; toUtc: string; boundaries: { membershipAmbiguousWithinBudget: boolean; exactCountAmbiguousWithinBudget: boolean }[]; portions: { startClipped: boolean; endClipped: boolean; sourceExactCount: number }[] };
type Component = {
  startUtc: string; endUtc: string; startClipped: boolean; endClipped: boolean;
  entryBandMs: number[] | null; exitBandMs: number[] | null; exactBandsMs: number[][];
  exactTopology: string; globalMinimumKind: string; globalMinimum: Minimum | null; localMinima: Minimum[];
  possibleExactRegionMs?: number[] | null; possibleMinimumRegionMs?: number[] | null;
  turningPointMarginDegrees?: number;
};
function inBand(value: string, band: number[], label: string) {
  const time = Date.parse(value);
  expect(time, label).toBeGreaterThanOrEqual(band[0]);
  expect(time, label).toBeLessThanOrEqual(band[1]);
}
const circular = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);
function verifyWindow(window: TransitWindow, expected: Component, budget: number, label: string) {
  expect(window.startClipped, label).toBe(expected.startClipped);
  expect(window.endClipped, label).toBe(expected.endClipped);
  if (expected.entryBandMs) inBand(window.startUtc, expected.entryBandMs, `${label} entry`);
  else expect(window.startUtc, label).toBe(expected.startUtc);
  if (expected.exitBandMs) inBand(window.endUtc, expected.exitBandMs, `${label} exit`);
  else expect(window.endUtc, label).toBe(expected.endUtc);
  expect(window.membershipStatus, label).toBe('resolved');
  expect(window.boundaryTouch, label).not.toBe(true);
  if (expected.exactTopology === 'uncertain') {
    expect(window.exactTopologyStatus, label).toBe('uncertain');
    expect(window.peak.kind, label).toBe('uncertain');
    expect(window.peak.atUtc, label).toBeUndefined();
    for (const pass of window.exactPassesUtc) inBand(pass, expected.possibleExactRegionMs!, `${label} possible exact`);
    if (window.peak.fromUtc && window.peak.toUtc) {
      expect(Date.parse(window.peak.fromUtc), label).toBeLessThanOrEqual(expected.possibleMinimumRegionMs![1]);
      expect(Date.parse(window.peak.toUtc), label).toBeGreaterThanOrEqual(expected.possibleMinimumRegionMs![0]);
    }
  } else {
    expect(window.exactTopologyStatus, label).toBe('resolved');
    expect(window.exactPassesUtc.length, label).toBe(expected.exactBandsMs.length);
    expected.exactBandsMs.forEach((band, i) => inBand(window.exactPassesUtc[i], band, `${label} exact ${i}`));
    if (expected.globalMinimumKind === 'exact') expect(window.peak.kind, label).toBe('exact');
    else if (expected.globalMinimum) {
      expect(window.peak.kind, label).toBe('closest-approach');
      inBand(window.peak.atUtc!, expected.globalMinimum.timeEnvelopeMs, `${label} closest approach`);
      expect(Math.abs(window.peak.orbDegrees! - expected.globalMinimum.orbDegrees), label).toBeLessThanOrEqual(budget);
    } else expect(window.peak.kind, label).toBe('none');
  }
  // D's uncertain exact topology can also create/remove a positive local minimum.
  // Its cross-model local-minimum count is deliberately not certified.
  if (expected.exactTopology === 'uncertain') return;
  expect(window.localMinima?.length ?? 0, label).toBe(expected.localMinima.length);
  for (const sourceMinimum of expected.localMinima) {
    const matched = window.localMinima?.find((x) => sourceMinimum.timeEnvelopeMs[0] <= Date.parse(x.atUtc) && Date.parse(x.atUtc) <= sourceMinimum.timeEnvelopeMs[1]);
    expect(matched, `${label} retained local minimum`).toBeTruthy();
    expect(Math.abs(matched!.orbDegrees - sourceMinimum.orbDegrees), label).toBeLessThanOrEqual(budget);
  }
}

// The nine A–I cases against NASA JPL Horizons (DE441) and ERFA, made by
// docs/engine-validation/independent-references/tools/build.py. They replace
// the Swiss Ephemeris projection removed on 2026-09-28
// (docs/platform/programme/DECISIONS-2026-09-28.md §3) with the same cases,
// budgets, aspect branches and crops; only the arbiter changed.
describe('independent A–I transit-window references', () => {
  it('retains the reference bytes, and D’s second period keeps an unresolved exact topology', () => {
    const bytes = readFileSync(new URL('./fixtures/transit-window-horizons.json', import.meta.url));
    // 1.0.0-rc.2 rebuild: engine version metadata only; policies and retained
    // Horizons responses are unchanged.
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('f44d08cadcea959e5570ae7a06ad8c1ea2c6ab1f21ade55c98b3b78f01062670');
    expect(fixtures.cases).toHaveLength(9);
    expect(fixtures.cases.reduce((sum, item) => sum + item.geometries.length, 0)).toBe(30);
    // Uranus turns 0.0442° from the D target, inside the 0.05° budget: no
    // arbiter can certify how many exact passes that period has.
    const d = fixtures.cases.find((item) => item.id === 'D-Uranus2020')!;
    const [first, second] = d.geometries[0].components as Component[];
    expect(first.exactTopology).toBe('resolved');
    expect(second.exactTopology).toBe('uncertain');
    expect(second.turningPointMarginDegrees).toBeLessThan(d.angularBudgetDegrees);
  });
  it('keeps the original pack failed-incomplete, as the removed Swiss fixture recorded it', () => {
    // The Swiss fixture left the tree on 2026-09-28. The removal manifest keeps
    // its fields that hold no Swiss value, read from its bytes by strip.py, whose
    // --check derives them again from commit 2ca93d41; the digest is the one
    // this test pinned while the fixture was here.
    const manifest = JSON.parse(readFileSync(new URL('../../../docs/engine-validation/swiss-output-removal/manifest.json', import.meta.url), 'utf8'));
    const removed = manifest.removedFiles.find((entry: { path: string }) => entry.path === 'src/lib/engine/fixtures/transit-window-independent.json');
    expect(removed.sha256).toBe('db4ddce1d2761ad0ada1ab7aaf456d74d2f79b6b6a3434b1b8f6b9895ad66c3a');
    expect(removed.nonSwissFields.originalPackStatus).toBe('failed-incomplete');
    expect(removed.nonSwissFields.qualifiedDSourceAcceptedByRoot).toBe(true);
  });
  for (const source of fixtures.cases) it(source.id, () => {
    const point = source.natalPoint as WindowNatalPoint;
    let target = source.targetLongitudeDegrees;
    if (source.id.startsWith('B-')) {
      const birth = new Date((source.input as { birthProductNumericTransport: string }).birthProductNumericTransport);
      target = computeBodies(birth).find((x) => x.body === point)!.lon;
    } else if (/^[GHI]-/.test(source.id)) {
      const natal = fixtures.coherentNatalInput;
      const computed = computeChart({ utc: new Date(natal.birthUTC), latitude: natal.latitudeDegrees, longitude: natal.longitudeDegreesEastPositive, houseSystem: 'placidus', timeKnown: true });
      target = point === 'ASC' ? computed.angles!.asc : point === 'MC' ? computed.angles!.mc : computed.bodies.find((x) => x.body === point)!.lon;
    }
    if (source.natalComponentBudgetDegrees !== null) expect(circular(target, source.targetLongitudeDegrees), `${source.id} separate natal gate`).toBeLessThanOrEqual(source.natalComponentBudgetDegrees);
    const natal: WindowNatalChart = point === 'ASC' || point === 'MC' ? { bodies: [], angles: { asc: point === 'ASC' ? target : 0, mc: point === 'MC' ? target : 0 } } : { bodies: [{ body: point, lon: target }] };
    const aspects = [...new Set(source.geometries.map((x) => x.aspect))] as WindowAspect[];
    const windows = createTransitWindowScanner({ bodyLongitude }).scanTransitWindows(natal, new Date(source.fromUtc), new Date(source.toUtc), { timeKnown: true, transitBodies: [source.movingBody as SlowTransitBody], natalPoints: [point], aspects, angularBudgetDegrees: source.angularBudgetDegrees });
    for (const aspect of aspects) {
      const expected = source.geometries.filter((x) => x.aspect === aspect).flatMap<Component>((x) => x.components).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
      const actual = windows.filter((x) => x.aspect === aspect);
      expect(actual.length, `${source.id} ${aspect}, including conditioned empty branches`).toBe(expected.length);
      expected.forEach((component, i) => verifyWindow(actual[i], component, source.angularBudgetDegrees, `${source.id} ${aspect} component ${i}`));
    }
    const groups = new Map<string, SourceCrop[]>();
    for (const crop of source.crops) {
      const key = `${crop.fromUtc}|${crop.toUtc}`;
      groups.set(key, [...groups.get(key) ?? [], crop]);
    }
    for (const [label, sourceCrops] of groups) {
      const first = sourceCrops[0];
      const cropped = cropTransitWindows(windows, new Date(first.fromUtc), new Date(first.toUtc));
      if (sourceCrops.every((x) => x.boundaries.every((b) => !b.membershipAmbiguousWithinBudget))) {
        expect(cropped.length, `${source.id} ${label} crop components`).toBe(sourceCrops.reduce((sum, x) => sum + x.portions.length, 0));
        const expectedFlags = sourceCrops.flatMap((x) => x.portions.map((p) => `${p.startClipped}:${p.endClipped}`)).sort();
        expect(cropped.map((x) => `${x.startClipped}:${x.endClipped}`).sort(), `${source.id} ${label} clipping`).toEqual(expectedFlags);
      }
      if (!source.id.startsWith('D-') && sourceCrops.every((x) => x.boundaries.every((b) => !b.exactCountAmbiguousWithinBudget))) {
        expect(cropped.reduce((sum, x) => sum + x.exactPassesUtc.length, 0), `${source.id} ${label} unambiguous crop exact count`).toBe(sourceCrops.reduce((sum, x) => sum + x.portions.reduce((total, p) => total + p.sourceExactCount, 0), 0));
      }
      for (const window of cropped) {
        if (window.peak.atUtc) expect(Date.parse(window.peak.atUtc) >= Date.parse(first.fromUtc) && Date.parse(window.peak.atUtc) <= Date.parse(first.toUtc)).toBe(true);
        expect(window.fullQueryPeak, 'Crops retain full-query minimum provenance').toBeDefined();
      }
    }
  });
});
