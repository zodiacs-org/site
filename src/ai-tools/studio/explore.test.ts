import { describe, expect, it, vi, afterEach } from 'vitest';
import { birthWindow } from '@zodiacs/engine/window';
import { natalChart } from '@zodiacs/engine';
import { calculateStudio, EXAMPLE } from './model';
import { initialWindow, shiftStudio, timeChanges, windowRequest, windowSummary } from './explore';
import { WindowCalculator, type WindowPort } from './window-client';

describe('Time Explorer', () => {
  it('steps through UTC across leap days and refuses epoch overflow', () => {
    expect(shiftStudio({ ...EXAMPLE, date: '2024-02-28', time: '23:45' }, 15)).toMatchObject({ date: '2024-02-29', time: '00:00' });
    expect(shiftStudio({ ...EXAMPLE, date: '2024-03-01', time: '00:00' }, -1440)).toMatchObject({ date: '2024-02-29', time: '00:00' });
    expect(() => shiftStudio({ ...EXAMPLE, date: '2199-12-31' }, 1440)).toThrow('1800');
    expect(() => shiftStudio({ ...EXAMPLE, date: '1800-01-01' }, -1440)).toThrow('1800');
    expect(() => shiftStudio(EXAMPLE, Infinity)).toThrow();
  });
  it('keeps unknown time as a daily noon reference and requests a location explicitly for a window', () => {
    const input = { ...EXAMPLE, timeKnown: false, time: '' };
    expect(() => shiftStudio(input, 15)).toThrow('unknown');
    const next = calculateStudio(shiftStudio(input, 1440));
    expect(next.envelope.receipt).toMatchObject({ reference: 'utc-noon', coordinates: null, timeKnown: false });
    expect(next.chart.angles).toBeNull(); expect(next.chart.houses).toBeNull();
    expect(initialWindow(input)).toMatchObject({ start: '1990-06-15T00:00', end: '1990-06-16T00:00', latitude: '', longitude: '' });
  });
  it('reports an actual sign change and uses circular rather than linear longitude differences', () => {
    const before = calculateStudio({ ...EXAMPLE, date: '2026-03-20', time: '00:00' });
    const after = calculateStudio({ ...EXAMPLE, date: '2026-03-21', time: '00:00' });
    const sun = timeChanges(before, after).find(row => row.body === 'Sun')!;
    expect(sun).toMatchObject({ fromSign: 'Pisces', toSign: 'Aries', changed: true });
    expect(sun.delta).toBeGreaterThan(0); expect(sun.delta).toBeLessThan(2);
    expect(timeChanges(before, before).every(row => !row.changed && row.delta === 0)).toBe(true);
  });
  it.each([{ end: '1990-06-15T11:00' }, { end: '1990-06-18T12:00' }, { start: '1990-02-30T11:00' }, { latitude: '' }, { longitude: '' }, { latitude: '90' }, { longitude: '181' }, { latitude: 'NaN' }])('refuses invalid windows %j', change => {
    expect(() => windowRequest({ ...initialWindow(EXAMPLE), ...change })).toThrow();
  });
  it('window cells agree with independent charts at their interior instants', () => {
    const request = windowRequest(initialWindow(EXAMPLE)), result = birthWindow(request);
    expect(result.cells.length).toBeGreaterThan(1);
    expect(result.cells[0].start).toEqual(request.start);
    expect(result.cells.at(-1)!.end).toEqual(request.end);
    for (const cell of result.cells) {
      const chart = natalChart({ utc: new Date((cell.start.getTime() + cell.end.getTime()) / 2), latitude: request.latitude, longitude: request.longitude, houseSystem: request.houseSystem });
      for (const body of chart.bodies) expect(cell.features.signs[body.body]).toBe(body.sign);
    }
    expect(windowSummary(result)).toHaveLength(12);
    expect(result.verification).toBe('sampled at one-second resolution');
  });
  it('preserves polar fallback in the window output', () => {
    const result = birthWindow(windowRequest({ ...initialWindow(EXAMPLE), latitude: '78.2232', longitude: '15.6267' }));
    expect(result.flags).toContain('polar-fallback');
    expect(result.cells.every(cell => cell.features.houseSystem === 'whole')).toBe(true);
  });
});

describe('cancellable window worker', () => {
  afterEach(() => vi.useRealTimers());
  const port = (): WindowPort => ({ onmessage: null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() });
  it('terminates superseded work and ignores a late reply', async () => {
    const first = port(), second = port(); let count = 0;
    const calculator = new WindowCalculator(() => count++ ? second : first);
    const old = calculator.calculate(windowRequest(initialWindow(EXAMPLE))).catch(error => error.message);
    const current = calculator.calculate(windowRequest(initialWindow(EXAMPLE))).catch(error => error.message);
    expect(await old).toBe('Calculation cancelled.'); expect(first.terminate).toHaveBeenCalledOnce();
    first.onerror!(new Event('error') as ErrorEvent);
    calculator.cancel(); expect(await current).toBe('Calculation cancelled.');
    expect(second.terminate).toHaveBeenCalledOnce();
  });
  it('terminates a calculation at the real worker deadline', async () => {
    vi.useFakeTimers(); const worker = port(), calculator = new WindowCalculator(() => worker);
    const promise = calculator.calculate(windowRequest(initialWindow(EXAMPLE))).catch(error => error.message);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await promise).toContain('too long'); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it('reports a blocked worker without leaving a pending request', async () => {
    const calculator = new WindowCalculator(() => { throw new Error('blocked'); });
    await expect(calculator.calculate(windowRequest(initialWindow(EXAMPLE)))).rejects.toThrow('blocked');
    calculator.cancel();
  });
});
