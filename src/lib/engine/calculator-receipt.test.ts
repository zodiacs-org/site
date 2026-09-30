import { build } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { natalChart } from '@zodiacs/engine';
import { natalReplayInput, parseNatalEnvelope } from '@zodiacs/engine/receipt';
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { decodeChartLink, encodeChartLink } from '../share';
import { computeChart } from './full';
import { computeCalculatorReceipt, type CalculatorWallTime } from './calculator-receipt';

vi.mock('@zodiacs/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@zodiacs/engine')>();
  return { ...actual, natalChart: vi.fn(actual.natalChart) };
});

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

function calculate(date: string, time: string, timeZone: string, timeKnown = true) {
  const resolved = resolveLocalToUtc(date, time, timeZone);
  const input = {
    utc: resolved.utc, latitude: 78.2232, longitude: 15.6267,
    houseSystem: 'placidus' as const, timeKnown, flags: resolved.flags,
  };
  const captured = computeCalculatorReceipt(input, {
    date, time, timeZone, offsetMinutes: resolved.offsetMinutes,
    reference: timeKnown ? 'supplied-instant' : 'local-noon',
  });
  expect(captured).not.toBeNull();
  if (!captured) throw new Error('Expected supported synthetic zone.');
  const parsed = parseNatalEnvelope(captured.envelopeJson);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error('Expected valid synthetic receipt.');
  return { captured, input, envelope: parsed.envelope };
}

// The fifth column is the flags an older resolution recorded for each wall
// time: no dst-gap, and `lmt` for an offset with seconds, the flag's meaning
// before engine rc.15. Each instant is a legal clock after its zone's local
// mean time era, so none carries `lmt` now.
const historicalGaps = [
  ["America/Caracas", "1890-01-01", "1890-01-01T04:27:44.000Z", -267.6666666666667, ["lmt"], 0.06666666666666667],
  ["America/Dawson_Creek", "1884-01-01", "1884-01-01T08:00:56.000Z", -480, [], 0.9333333333333333],
  ["America/Goose_Bay", "1935-03-30", "1935-03-30T03:30:52.000Z", -210, [], 0.8666666666666667],
  ["America/Manaus", "1914-01-01", "1914-01-01T04:00:04.000Z", -240, [], 0.06666666666666667],
  ["America/Paramaribo", "1935-01-01", "1935-01-01T03:40:52.000Z", -220.6, ["lmt"], 0.26666666666666666],
  ["America/Port-au-Prince", "1890-01-01", "1890-01-01T04:49:20.000Z", -289, [], 0.3333333333333333],
  ["America/Punta_Arenas", "1890-01-01", "1890-01-01T04:43:40.000Z", -282.75, ["lmt"], 0.9166666666666666],
  ["America/St_Johns", "1935-03-30", "1935-03-30T03:30:52.000Z", -210, [], 0.8666666666666667],
  ["America/Whitehorse", "1900-08-20", "1900-08-20T09:00:12.000Z", -540, [], 0.2],
  ["Asia/Colombo", "1880-01-01", "1879-12-31T18:40:36.000Z", 319.53333333333336, ["lmt"], 0.13333333333333333],
  ["Asia/Tbilisi", "1924-05-02", "1924-05-01T21:00:49.000Z", 180, [], 0.8166666666666667],
  ["Brazil/West", "1914-01-01", "1914-01-01T04:00:04.000Z", -240, [], 0.06666666666666667],
  ["Canada/Newfoundland", "1935-03-30", "1935-03-30T03:30:52.000Z", -210, [], 0.8666666666666667],
  ["Canada/Yukon", "1900-08-20", "1900-08-20T09:00:12.000Z", -540, [], 0.2],
  ["Pacific/Norfolk", "1901-01-01", "1900-12-31T12:48:08.000Z", 672, [], 0.13333333333333333],
  ["Pacific/Tongatapu", "1945-09-10", "1945-09-09T11:40:48.000Z", 740, [], 0.8],
] as const;

describe('calculator capture from actual civil resolution', () => {
  it.each([-90, 90])('preserves known-time exact-pole %s charts without entering portable calculation', (latitude) => {
    const input = { utc: new Date('2001-12-21T08:30:00Z'), latitude, longitude: 0,
      timeKnown: true, houseSystem: 'placidus' as const };
    expect(computeCalculatorReceipt(input, { date: '2001-12-21', time: '08:30',
      timeZone: 'UTC', offsetMinutes: 0, reference: 'supplied-instant' })).toBeNull();
    expect(natalChart).not.toHaveBeenCalled();
    expect(computeChart(input).bodies).toHaveLength(12);
  });

  it.each([-90, 90])('retains an unknown-time receipt at exact pole %s with no invented angles', (latitude) => {
    const captured = computeCalculatorReceipt({ utc: '2001-12-21T12:00:00Z', latitude,
      longitude: 0, timeKnown: false, houseSystem: 'placidus' }, {
      date: '2001-12-21', time: '12:00', timeZone: 'UTC', offsetMinutes: 0, reference: 'local-noon',
    });
    expect(natalChart).toHaveBeenCalledTimes(1);
    expect(captured?.chart.angles).toBeNull();
    const parsed = parseNatalEnvelope(captured!.envelopeJson);
    expect(parsed.ok && parsed.envelope.receipt.houses.actual).toBeNull();
  });

  it.each([-89.99, 89.99])('still captures the supported near-pole %s chart', (latitude) => {
    const captured = computeCalculatorReceipt({ utc: '2001-12-21T08:30:00Z', latitude,
      longitude: 0, timeKnown: true, houseSystem: 'placidus' }, {
      date: '2001-12-21', time: '08:30', timeZone: 'UTC', offsetMinutes: 0, reference: 'supplied-instant',
    });
    expect(natalChart).toHaveBeenCalledTimes(1);
    expect(captured?.chart.houses?.system).toBe('whole');
  });
  it('keeps configuration getter failures private before calculation', () => {
    const local = Object.defineProperty({}, 'timeZone', { get() { throw new Error('Synthetic private detail.'); } });
    expect(() => computeCalculatorReceipt({ utc: '2001-12-21T08:30:00Z' }, local as CalculatorWallTime))
      .toThrow('Unable to prepare a portable chart.');
    expect(natalChart).not.toHaveBeenCalled();
  });
  it.each(historicalGaps)('refuses deliberately inconsistent legacy flags for %s %s before any natal call', (zone, date, instant, offsetMinutes, flags) => {
    const input = { utc: new Date(instant), latitude: 40, longitude: 10,
      houseSystem: 'whole' as const, timeKnown: true, flags: [...flags] };
    const captured = computeCalculatorReceipt(input, { date, time: '00:00', timeZone: zone,
      offsetMinutes, reference: 'supplied-instant' });
    expect(captured).toBeNull();
    expect(natalChart).not.toHaveBeenCalled();
    const result = computeChart(input);
    expect(result.input.utc.toISOString()).toBe(instant);
    expect(result.input.flags).toEqual(flags);
  });

  it.each(historicalGaps)('captures corrected seconds context for %s %s from one natal call', (zone, date, instant, offsetMinutes, _olderFlags, gapShiftMinutes) => {
    const resolved = resolveLocalToUtc(date, '00:00', zone);
    expect(resolved.utc.toISOString()).toBe(instant);
    expect(resolved.flags).toEqual(['dst-gap']);
    const { captured, input, envelope } = calculate(date, '00:00', zone);
    expect(natalChart).toHaveBeenCalledTimes(1);
    expect(captured.chart).toEqual(computeChart(input));
    expect(envelope.receipt).toMatchObject({
      instant, inputFlags: ['dst-gap'],
      reference: 'supplied-instant', sourceInstant: null, provenance: null,
      localResolution: { date, time: '00:00', timeZone: zone, offsetMinutes, gapShiftMinutes,
        policy: { fold: 'earlier', gap: 'shift-forward' } },
      houses: { requested: 'placidus', actual: 'whole' },
    });
    expect(natalReplayInput(envelope).utc).toBe(instant);
  });

  it.each([
    { utc: '2024-01-01T11:59:59Z', flags: [] },
    { utc: '2024-01-01T12:00:00Z', flags: ['dst-gap'] },
  ] as const)('does not calculate or rewrite an inconsistent resolution $utc', (input) => {
    expect(computeCalculatorReceipt({ ...input, flags: [...input.flags] }, {
      date: '2024-01-01', time: '12:00', timeZone: 'UTC', offsetMinutes: 0,
      reference: 'supplied-instant',
    })).toBeNull();
    expect(natalChart).not.toHaveBeenCalled();
  });

  it.each(['+01:00', '+0100', '-02:30', '+23:59', '-00:00'])('preserves imported fixed-offset %s charts before any portable calculation', (timeZone) => {
    const decoded = decodeChartLink(encodeChartLink({ date: '1990-06-15', time: '14:30',
      timeKnown: true, lat: 40.71, lon: -74, tz: timeZone, houseSystem: 'whole' }));
    expect(decoded).not.toBeNull();
    const resolved = resolveLocalToUtc(decoded!.date, decoded!.time!, decoded!.tz);
    const input = { utc: resolved.utc, latitude: decoded!.lat, longitude: decoded!.lon,
      houseSystem: decoded!.houseSystem, timeKnown: decoded!.timeKnown, flags: resolved.flags };
    const portable = computeCalculatorReceipt(input, { date: decoded!.date, time: decoded!.time!,
      timeZone: decoded!.tz, offsetMinutes: resolved.offsetMinutes, reference: 'supplied-instant' });
    expect(portable).toBeNull();
    expect(natalChart).not.toHaveBeenCalled();
    const legacy = computeChart(input);
    expect(legacy.input.utc.toISOString()).toBe(resolved.utc.toISOString());
    expect(legacy.bodies).toHaveLength(12);
  });
  it.each([
    ['2024-01-15', '08:30', 'America/New_York', true, '2024-01-15T13:30:00.000Z', -300, 0, []],
    ['2024-03-10', '02:30', 'America/New_York', true, '2024-03-10T07:30:00.000Z', -240, 60, ['dst-gap']],
    ['2024-11-03', '01:30', 'America/New_York', true, '2024-11-03T05:30:00.000Z', -240, 0, ['dst-fold']],
    ['2024-10-06', '02:15', 'Australia/Lord_Howe', true, '2024-10-05T15:45:00.000Z', 660, 30, ['dst-gap']],
    ['2011-12-30', '12:00', 'Pacific/Apia', false, '2011-12-30T22:00:00.000Z', 840, 1440, ['dst-gap']],
    // Without a longitude the resolver claims no local mean time: see below.
    ['1907-07-06', '08:30', 'America/Mexico_City', true, '1907-07-06T15:06:36.000Z', -396.6, 0, []],
    ['0099-01-15', '08:30', 'UTC', true, '0099-01-15T08:30:00.000Z', 0, 0, []],
  ] as const)('captures %s %s in %s without a second natal call', (date, time, zone, known, instant, offset, shift, flags) => {
    const { captured, input, envelope } = calculate(date, time, zone, known);
    expect(natalChart).toHaveBeenCalledTimes(1);
    expect(captured.chart).toEqual(computeChart(input));
    expect(envelope.receipt).toMatchObject({
      instant, sourceInstant: null, provenance: null, timeKnown: known,
      reference: known ? 'supplied-instant' : 'local-noon',
      inputFlags: flags,
      localResolution: { date, time, timeZone: zone, offsetMinutes: offset, gapShiftMinutes: shift,
        policy: { fold: 'earlier', gap: 'shift-forward' } },
      houses: { requested: 'placidus', actual: known ? 'whole' : null },
    });
    expect(natalReplayInput(envelope).utc).toBe(instant);
  });

  it('records the lmt flag of a wall time read on a local mean time', async () => {
    // A synthetic birthplace on Mexico City's own meridian (6:36:36 west, 99.15° W),
    // resolved with its longitude as the calculator does: the same instant and
    // offset as without one, read on the zone's local mean time, which engine
    // rc.15's `lmt` flag records.
    await prepareLocalTime('1907-07-06', 'America/Mexico_City');
    const resolved = resolveLocalToUtc('1907-07-06', '08:30', 'America/Mexico_City', { longitude: -99.15 });
    expect(resolved.flags).toEqual(['lmt']);
    const captured = computeCalculatorReceipt({
      utc: resolved.utc, latitude: 19.4, longitude: -99.15, houseSystem: 'placidus', timeKnown: true, flags: resolved.flags,
    }, { date: '1907-07-06', time: '08:30', timeZone: 'America/Mexico_City',
      offsetMinutes: resolved.offsetMinutes, reference: 'supplied-instant' });
    expect(natalChart).toHaveBeenCalledTimes(1);
    const parsed = parseNatalEnvelope(captured!.envelopeJson);
    expect(parsed.ok && parsed.envelope.receipt).toMatchObject({
      instant: '1907-07-06T15:06:36.000Z', inputFlags: ['lmt'],
      localResolution: { offsetMinutes: -396.6, gapShiftMinutes: 0 },
    });
  });

  it('keeps serialized data detached from subsequent presentation and Date mutations', () => {
    const { captured, input, envelope } = calculate('2001-12-21', '08:30', 'UTC');
    const bytes = captured.envelopeJson;
    input.utc.setUTCFullYear(1990);
    captured.chart.input.utc.setUTCFullYear(2030);
    captured.chart.bodies[0].lon = 0;
    captured.chart.flags.push('lmt');
    expect(captured.envelopeJson).toBe(bytes);
    expect(parseNatalEnvelope(bytes)).toEqual({ ok: true, envelope });
    expect(natalChart).toHaveBeenCalledTimes(1);
  });

  it('uses the captured resolution without any additional Intl, network or storage access', () => {
    const resolved = resolveLocalToUtc('2024-10-06', '02:15', 'Australia/Lord_Howe');
    const denied = () => { throw new Error('Unexpected side effect.'); };
    vi.stubGlobal('Intl', new Proxy({}, { get: denied }));
    vi.stubGlobal('fetch', denied);
    vi.stubGlobal('localStorage', new Proxy({}, { get: denied }));
    vi.stubGlobal('indexedDB', new Proxy({}, { get: denied }));
    expect(() => computeCalculatorReceipt({
      utc: resolved.utc, latitude: 40, longitude: 10, flags: resolved.flags,
    }, { date: '2024-10-06', time: '02:15', timeZone: 'Australia/Lord_Howe',
      offsetMinutes: resolved.offsetMinutes, reference: 'supplied-instant' })).not.toThrow();
    expect(natalChart).toHaveBeenCalledTimes(1);
  });

  it('rejects inconsistent context with a fixed private error and never retries calculation', () => {
    expect(() => computeCalculatorReceipt({ utc: '2024-01-15T08:30:00Z' }, {
      date: '2024-01-15', time: '08:30', timeZone: 'UTC',
      offsetMinutes: 0, reference: 'local-noon',
    })).toThrow('Unable to prepare a portable chart.');
    expect(natalChart).toHaveBeenCalledTimes(1);
  });

  it('keeps the receipt capture outside full and the download helper graphs', async () => {
    for (const entry of ['src/lib/engine/full.ts', 'src/lib/receipt-download.ts']) {
      const result = await build({ entryPoints: [entry], bundle: true, write: false, metafile: true,
        format: 'esm', platform: 'browser', logLevel: 'silent' });
      expect(Object.keys(result.metafile!.inputs).some((path) => /calculator-receipt|engine\/portable|engine\/dist\/receipt/.test(path))).toBe(false);
    }
  });
});
