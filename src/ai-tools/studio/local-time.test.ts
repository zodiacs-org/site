import { describe, expect, it } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import { natalReplayInput, parseNatalEnvelope } from '@zodiacs/engine/receipt';
import { localStudioInput, findStudioCities } from './local-time';
import { calculateStudio, recordText, selectionContext } from './model';
import { shiftStudio, initialWindow } from './explore';

const place = { latitude: '40.71', longitude: '-74.01', zone: 'America/New_York' };
describe('Chart Studio local-time entry', () => {
  it.each([
    ['2024-07-01', '12:00', '2024-07-01T16:00:00.000Z', null, 0],
    ['2024-11-03', '01:30', '2024-11-03T05:30:00.000Z', 'dst-fold', 0],
    ['2024-03-10', '02:30', '2024-03-10T07:30:00.000Z', 'dst-gap', 60],
  ])('preserves the actual conversion and receipt for %s %s', async (date, time, utc, flag, shift) => {
    const converted = await localStudioInput({ ...place, date, time }, 'placidus');
    expect(converted.utc).toBe(utc);
    const run = calculateStudio(converted.input);
    expect(run.envelope.receipt.localResolution).toMatchObject({ date, time, timeZone: place.zone, gapShiftMinutes: shift });
    if (flag) expect(run.chart.flags).toContain(flag);
    expect(parseNatalEnvelope(recordText(run)).ok).toBe(true);
    expect(natalChart(natalReplayInput(run.envelope)).bodies.map(body => body.lon)).toEqual(run.chart.bodies.map(body => body.lon));
    expect(selectionContext(run, { kind: 'body', body: 'Sun' })).not.toContain(place.zone);
  });
  it('retains historical subminute precision and removes stale wall-time provenance after a UTC step', async () => {
    const converted = await localStudioInput({ date: '1907-07-06', time: '08:30', zone: 'America/Mexico_City', latitude: '19.43', longitude: '-99.15' }, 'placidus');
    expect(converted.utc).toBe('1907-07-06T15:06:36.000Z');
    expect(converted.input.local?.resolution).toMatchObject({ dataForm: 'main+backzone', tzdbVersion: '2025c' });
    const shifted = shiftStudio(converted.input, 15);
    expect(calculateStudio(shifted).inputSnapshot.utc).toBe('1907-07-06T15:21:36.000Z');
    expect(shifted.local).toBeUndefined();
    expect(initialWindow(converted.input).start).toBe('1907-07-06T14:51');
  });
  it.each([{ date: '2024-02-30' }, { time: '24:00' }, { zone: '+02:00' }, { longitude: '' }, { latitude: '90' }, { date: '1800-01-01', zone: 'Pacific/Auckland', time: '00:00' }])('refuses invalid or out-of-range local inputs %j', async change => {
    await expect(localStudioInput({ ...place, date: '2024-01-01', time: '12:00', ...change }, 'whole')).rejects.toThrow();
  });
  it('searches labels and transliterations without a network query', () => {
    const city = { label: 'München, Bavaria, Germany', search: 'munchen munich bavaria germany', latitude: '48.14', longitude: '11.58', zone: 'Europe/Berlin' };
    expect(findStudioCities([city], 'München Germany')).toEqual([city]);
    expect(findStudioCities([city], 'Munich')).toEqual([city]);
    expect(findStudioCities([city], 'm')).toEqual([]);
  });
});
