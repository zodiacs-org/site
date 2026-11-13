import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { findLongitudeCrossings, natalChart } from '@zodiacs/engine';
import { parseNatalEnvelope, natalReplayInput } from '@zodiacs/engine/receipt';
import { calculateStudio, compareStudio, EXAMPLE, recordText, selectionContext, sunSignsForDate } from './model';
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

describe('the Sun without a birth time', () => {
  it('names two signs on a date when the Sun changes sign in some time zone, and one otherwise', () => {
    expect(sunSignsForDate('2026-03-20')).toEqual(['pisces', 'aries']);
    expect(sunSignsForDate('2026-03-10')).toEqual(['pisces']);
    // Every day of 2026 against the engine's own crossing search: two signs exactly when the Sun
    // enters a sign between the date's 00:00 at UTC+14 and its 24:00 at UTC−12.
    const ingresses = Array.from({ length: 12 }, (_, sign) => findLongitudeCrossings('Sun', sign * 30, '2025-12-30T00:00:00Z', '2027-01-03T00:00:00Z'))
      .flat().map(crossing => new Date(crossing.at).getTime());
    expect(ingresses).toHaveLength(12);
    for (let day = Date.parse('2026-01-01T00:00:00Z'); day < Date.parse('2027-01-01T00:00:00Z'); day += 86_400_000) {
      const date = new Date(day).toISOString().slice(0, 10);
      const crosses = ingresses.some(at => at > day - 14 * 3_600_000 && at <= day + 36 * 3_600_000);
      expect(sunSignsForDate(date).length, date).toBe(crosses ? 2 : 1);
    }
  });
  it('refuses a date that is not a real one in range', () => {
    for (const date of ['2026-02-30', '1799-12-31', '2200-01-01', '2026-3-1']) expect(() => sunSignsForDate(date), date).toThrow();
  });
  it('no longer tells a reader without a birth time that the Sun sign is certain, or calls 12:00 UTC midday', () => {
    const app = readFileSync(new URL('./app.tsx', import.meta.url), 'utf8');
    expect(app).not.toMatch(/Sun sign is reliable|midday/u);
    expect(app).toContain('12:00 UTC on your birth date');
  });
});
