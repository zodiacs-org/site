import { describe, it, expect } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import { parseNatalEnvelope, natalReplayInput } from '@zodiacs/engine/receipt';
import { calculateStudio, compareStudio, EXAMPLE, recordText, selectionContext } from './model';
import { buildSceneModel } from '../../lib/scene/build';
import { entityId, type EntityRef } from '../../lib/scene/types';

describe('Chart Studio calculation and disclosure boundary', () => {
  it.each(['placidus', 'whole'] as const)('matches the engine and replays the exported %s record', houseSystem => {
    const run = calculateStudio({ ...EXAMPLE, houseSystem });
    const native = natalChart(natalReplayInput(run.envelope));
    expect(run.chart.bodies.map(b => b.lon)).toEqual(native.bodies.map(b => b.lon));
    expect(run.chart.houses).toEqual(native.houses);
    expect(parseNatalEnvelope(recordText(run))).toEqual({ ok: true, envelope: run.envelope });
    expect(Object.isFrozen(run.envelope)).toBe(true);
  });
  it('compares the same positions while preserving different house assignments', () => {
    const placidus = calculateStudio(EXAMPLE), whole = calculateStudio({ ...EXAMPLE, houseSystem: 'whole' });
    expect(placidus.chart.bodies).toEqual(whole.chart.bodies);
    const rows = compareStudio(placidus, whole);
    expect(rows).toHaveLength(12);
    expect(rows.filter(r => r.currentHouse !== r.comparedHouse).length).toBeGreaterThan(0);
    expect(compareStudio(placidus, placidus).every(r => r.currentHouse === r.comparedHouse)).toBe(true);
  });
  it('uses an explicit noon reference and ignores disabled inputs for unknown time', () => {
    const run = calculateStudio({ ...EXAMPLE, timeKnown: false, time: '', latitude: 'invalid', longitude: '' });
    expect(run.chart.houses).toBeNull(); expect(run.chart.angles).toBeNull();
    expect(run.envelope.receipt).toMatchObject({ instant: '1990-06-15T12:00:00.000Z', reference: 'utc-noon', coordinates: null, timeKnown: false, houses: { actual: null, absenceReason: 'unknown-time' } });
    expect(JSON.parse(selectionContext(run, { kind: 'body', body: 'Moon' }))).toMatchObject({ timeKnown: false, reference: 'utc-noon', facts: { house: null } });
  });
  it('preserves polar fallback and missing-location receipts', () => {
    const polar = calculateStudio({ ...EXAMPLE, latitude: '78.2232', longitude: '15.6267' });
    expect(polar.chart.flags).toContain('polar-fallback');
    expect(polar.envelope.receipt.houses).toMatchObject({ requested: 'placidus', actual: 'whole' });
    const noLocation = calculateStudio({ ...EXAMPLE, latitude: '', longitude: '' });
    expect(noLocation.chart.angles).toBeNull();
    expect(noLocation.envelope.receipt.houses.absenceReason).toBe('missing-location');
  });
  it.each([{ date: '2026-02-30' }, { date: '1799-12-31' }, { date: '2200-01-01' }, { time: '24:00' }, { latitude: '90' }, { longitude: '181' }, { longitude: '' }, { latitude: 'NaN' }, { latitude: 'Infinity' }])('refuses invalid inputs %j', change => {
    expect(() => calculateStudio({ ...EXAMPLE, ...change })).toThrow();
  });
  it('shares a fixed selection projection without raw birth inputs or full records', () => {
    const run = calculateStudio(EXAMPLE), scene = buildSceneModel(run.chart, { wheelConventions: false });
    const selections: EntityRef[] = [{ kind: 'body', body: 'Moon' }, { kind: 'sign', sign: 'pisces' }, { kind: 'house', house: 6 }, { kind: 'angle', angle: 'asc' }, { kind: 'aspect', ...scene.aspects[0] }];
    for (const selection of selections) {
      const text = selectionContext(run, selection), context = JSON.parse(text);
      expect(context.selection).toBe(entityId(selection));
      expect(Object.keys(context)).toEqual(['schema','engine','zodiac','timeKnown','reference','houses','flags','selection','facts']);
      for (const privateValue of ['1990-06-15','51.5074','-0.1278','sourceInstant','coordinates','inputSnapshot']) expect(text).not.toContain(privateValue);
    }
    expect(JSON.parse(selectionContext(run, selections[0])).facts.body).toBe('Moon');
    expect(() => selectionContext(calculateStudio({ ...EXAMPLE, timeKnown: false }), { kind: 'house', house: 1 })).toThrow();
  });
});
