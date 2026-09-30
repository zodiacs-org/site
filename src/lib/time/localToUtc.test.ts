import { describe, expect, it } from 'vitest';
import { offsetAt, resolveLocalToUtc } from './localToUtc';

describe('resolveLocalToUtc', () => {
  it('resolves a plain modern time', () => {
    const r = resolveLocalToUtc('2024-06-15', '14:30', 'America/New_York');
    expect(r.utc.toISOString()).toBe('2024-06-15T18:30:00.000Z');
    expect(r.flags).toEqual([]);
  });

  it('handles pre-standardization LMT with seconds (Mexico City 1907)', () => {
    // America/Mexico_City used LMT −6:36:36 until 1922. Without a birthplace
    // longitude, that reference city's mean time is the clock. Only a reading
    // with a longitude says which clock it was (`lmt`), since the host's
    // history cannot tell a mean time from a legal time at the same offset.
    const r = resolveLocalToUtc('1907-07-06', '08:30', 'America/Mexico_City');
    expect(r.utc.toISOString()).toBe('1907-07-06T15:06:36.000Z');
    expect(r.flags).toEqual([]);
  });

  it('shifts forward through a DST spring gap', () => {
    // 2024-03-10 02:30 never happened in New York.
    const r = resolveLocalToUtc('2024-03-10', '02:30', 'America/New_York');
    expect(r.utc.toISOString()).toBe('2024-03-10T07:30:00.000Z');
    expect(r.flags).toContain('dst-gap');
  });

  it('takes the earlier instant in a DST fall fold', () => {
    // 2024-11-03 01:30 happened twice in New York; earlier = EDT = 05:30Z.
    const r = resolveLocalToUtc('2024-11-03', '01:30', 'America/New_York');
    expect(r.utc.toISOString()).toBe('2024-11-03T05:30:00.000Z');
    expect(r.flags).toContain('dst-fold');
  });

  it('handles zones east of Greenwich and midnight', () => {
    const r = resolveLocalToUtc('2000-01-01', '00:00', 'Asia/Tokyo');
    expect(r.utc.toISOString()).toBe('1999-12-31T15:00:00.000Z');
  });

  it('handles half-hour zones', () => {
    const r = resolveLocalToUtc('1990-04-03', '12:00', 'Asia/Kolkata');
    expect(r.utc.toISOString()).toBe('1990-04-03T06:30:00.000Z');
    expect(r.offsetMinutes).toBe(330);
  });
});

describe('input shape', () => {
  it('rejects non-canonical date and time strings instead of mis-resolving them', () => {
    // Unpadded input would never match Intl's zero-padded wall strings and
    // used to fall silently into the dst-gap branch.
    expect(() => resolveLocalToUtc('1990-6-15', '08:30', 'Europe/Madrid')).toThrow(RangeError);
    expect(() => resolveLocalToUtc('1990-06-15', '8:30', 'Europe/Madrid')).toThrow(RangeError);
    expect(() => resolveLocalToUtc('1990-06-15T00:00', '08:30', 'Europe/Madrid')).toThrow(RangeError);
    const resolved = resolveLocalToUtc('1990-06-15', '08:30', 'Europe/Madrid');
    expect(resolved.flags).not.toContain('dst-gap');
  });

  it.each([
    '1900-02-29', '2001-02-29', '2100-02-29', '2000-02-30', '2001-04-31',
    '2001-00-01', '2001-13-01', '2001-01-00', '2001-01-32',
    '2001-01-01\n', '2001-01-01\r\n',
  ])('rejects impossible or suffixed date %s instead of inventing a DST gap', (date) => {
    expect(() => resolveLocalToUtc(date, '08:30', 'UTC')).toThrow(RangeError);
  });

  it.each(['24:00', '08:60', '99:99', '08:30\n', '08:30\r\n'])('rejects invalid clock %s instead of shifting the instant', (time) => {
    expect(() => resolveLocalToUtc('2001-02-28', time, 'UTC')).toThrow(RangeError);
  });

  it('validates civil fields before timezone conversion without echoing private input', () => {
    let failure: unknown;
    try {
      resolveLocalToUtc('2001-02-29', '08:60', 'Synthetic/Invalid_Zone');
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(RangeError);
    expect((failure as Error).message).toBe('resolveLocalToUtc needs a valid YYYY-MM-DD date and HH:MM time.');
    expect((failure as Error).message).not.toMatch(/2001|08:60|Synthetic/);
  });
});

describe('four-digit Gregorian years', () => {
  it.each([
    '0000-01-01', '0000-02-29', '0001-01-01', '0099-12-31', '0100-01-01',
    '0999-12-31', '1000-01-01', '1799-12-31', '1800-01-01',
    '2000-02-29', '2199-12-31', '2200-01-01', '9999-12-31',
  ])('preserves %s in UTC without year remapping or false gap flags', (date) => {
    const resolved = resolveLocalToUtc(date, '12:00', 'UTC');
    expect(resolved.utc.toISOString()).toBe(`${date}T12:00:00.000Z`);
    expect(resolved.offsetMinutes).toBe(0);
    expect(resolved.flags).toEqual([]);
  });

  it('resolves across the astronomical year-zero boundary with a fixed zone', () => {
    const resolved = resolveLocalToUtc('0000-01-01', '00:30', 'Etc/GMT-1');
    expect(resolved.utc.toISOString()).toBe('-000001-12-31T23:30:00.000Z');
    expect(resolved.offsetMinutes).toBe(60);
    expect(resolved.flags).toEqual([]);
  });
});

describe('offsetAt', () => {
  it('reads sub-minute LMT offsets', () => {
    const off = offsetAt('America/Mexico_City', Date.UTC(1907, 6, 6));
    expect(off).toBeCloseTo(-(6 * 60 + 36 + 36 / 60), 3);
  });
});

describe('explicit timezone boundary', () => {
  it.each([
    undefined, null, '', ' ', 0, false, {}, ['UTC'], new String('UTC'),
    'Synthetic/Private_Zone',
  ])('rejects missing, coerced, or unsupported timezone %j without echoing it', (zone) => {
    const tz = zone as string;
    for (const run of [
      () => resolveLocalToUtc('2001-12-21', '12:00', tz),
      () => offsetAt(tz, Date.UTC(2001, 11, 21, 12)),
    ]) {
      expect(run).toThrow(new RangeError('An explicit supported timezone is required.'));
    }
  });

  it('does not invoke an untrusted timezone coercion hook', () => {
    const tz = { toString() { throw new Error('Private zone coercion must not execute'); } };
    expect(() => resolveLocalToUtc('2001-12-21', '12:00', tz as unknown as string))
      .toThrow(new RangeError('An explicit supported timezone is required.'));
  });

  it.each(['UTC', 'Etc/UTC', 'GMT'])('keeps explicit supported alias %s', (tz) => {
    const resolved = resolveLocalToUtc('2001-12-21', '12:00', tz);
    expect(resolved.utc.toISOString()).toBe('2001-12-21T12:00:00.000Z');
    expect(resolved.flags).toEqual([]);
  });
});
