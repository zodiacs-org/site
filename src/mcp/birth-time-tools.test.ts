import { describe, expect, it } from 'vitest';
import { receiptDigest } from '../lib/receipt-digest';
import { RESOLVE_BIRTH_OUTPUT, resolveBirthTime } from './birth-time-tools';

const fixtures = [
  [
    "Buffalo",
    "1870-06-15",
    "12:00",
    "America/New_York",
    42.88,
    -78.88,
    "1870-06-15T17:15:31.000Z",
    [
      "lmt"
    ]
  ],
  [
    "Brest",
    "1880-06-15",
    "12:00",
    "Europe/Paris",
    48.39,
    -4.49,
    "1880-06-15T12:17:58.000Z",
    [
      "lmt"
    ]
  ],
  [
    "Omaha",
    "1880-06-15",
    "12:00",
    "America/Chicago",
    41.26,
    -95.94,
    "1880-06-15T18:23:46.000Z",
    [
      "lmt"
    ]
  ],
  [
    "New York",
    "1870-06-15",
    "12:00",
    "America/New_York",
    40.71,
    -74.01,
    "1870-06-15T16:56:02.000Z",
    [
      "lmt"
    ]
  ],
  [
    "Chicago",
    "1880-06-15",
    "12:00",
    "America/Chicago",
    41.88,
    -87.65,
    "1880-06-15T17:50:36.000Z",
    [
      "lmt"
    ]
  ],
  [
    "Paris",
    "1880-06-15",
    "12:00",
    "Europe/Paris",
    48.85,
    2.35,
    "1880-06-15T11:50:36.000Z",
    [
      "lmt"
    ]
  ],
  [
    "Bergen",
    "1894-06-15",
    "12:00",
    "Europe/Oslo",
    60.39,
    5.32,
    "1894-06-15T11:38:43.000Z",
    [
      "lmt"
    ]
  ],
  [
    "Brest legal mean time",
    "1900-06-15",
    "12:00",
    "Europe/Paris",
    48.39,
    -4.49,
    "1900-06-15T11:50:39.000Z",
    []
  ],
  [
    "Galway legal mean time",
    "1885-06-15",
    "12:00",
    "Europe/Dublin",
    53.27,
    -9.05,
    "1885-06-15T12:25:21.000Z",
    []
  ],
  [
    "Porto legal mean time",
    "1890-06-15",
    "12:00",
    "Europe/Lisbon",
    41.16,
    -8.61,
    "1890-06-15T12:36:45.000Z",
    []
  ],
  [
    "Buffalo gap",
    "1883-11-18",
    "11:50",
    "America/New_York",
    42.88,
    -78.88,
    "1883-11-18T17:05:31.000Z",
    [
      "dst-gap"
    ]
  ],
  [
    "Hartford fold",
    "1883-11-18",
    "12:05",
    "America/New_York",
    41.76,
    -72.69,
    "1883-11-18T16:55:46.000Z",
    [
      "dst-fold",
      "lmt"
    ]
  ],
  [
    "Stockholm backzone",
    "1947-07-01",
    "12:00",
    "Europe/Stockholm",
    59.33,
    18.07,
    "1947-07-01T11:00:00.000Z",
    []
  ],
  [
    "Alaska date line",
    "1867-10-19",
    "10:00",
    "America/Anchorage",
    61.22,
    -149.9,
    "1867-10-18T19:59:36.000Z",
    [
      "dst-fold",
      "lmt"
    ]
  ]
] as const;

describe('local birth time through the package geo entry', () => {
  it.each(fixtures)('%s retains the existing package acceptance instant and flags', async (_label, date, time, timeZone, latitude, longitude, utc, flags) => {
    const result = await resolveBirthTime({ date, time, timeZone, latitude, longitude });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Acceptance case refused');
    const value = RESOLVE_BIRTH_OUTPUT.parse(result.value);
    expect(value.birth.utc).toBe(utc);
    expect(value.resolution.utc).toBe(utc);
    expect(value.birth.flags).toEqual(flags);
    expect(value.resolution.flags).toEqual(flags);
    expect(value.reference).toBe('supplied-instant');
    expect(value.receipt.localResolution.policy).toEqual({ fold: 'earlier', gap: 'shift-forward' });
    expect(value.cite.receipt).toBe(receiptDigest(value.receipt));
  });

  it('labels an omitted time as an unknown local-noon reference', async () => {
    const result = await resolveBirthTime({ date: '1947-07-01', timeZone: 'Europe/Stockholm', latitude: 59.33, longitude: 18.07 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Local-noon case refused');
    const value = RESOLVE_BIRTH_OUTPUT.parse(result.value);
    expect(value.birth.utc).toBe('1947-07-01T11:00:00.000Z');
    expect(value.birth.timeKnown).toBe(false);
    expect(value.reference).toBe('local-noon');
    expect(value.receipt.localResolution.time).toBe('12:00');
    expect(value.limitations.join(' ')).toContain('not coverage of the whole local date');
  });

  it('reads the zone name in any supported letter case', async () => {
    for (const timeZone of ['europe/stockholm', 'EUROPE/STOCKHOLM']) {
      const result = await resolveBirthTime({ date: '1947-07-01', time: '12:00', timeZone, latitude: 59.33, longitude: 18.07 });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.birth).toMatchObject({ utc: '1947-07-01T11:00:00.000Z' });
    }
  });

  it('names actual pinned backzone history and keeps Intl as a cross-check', async () => {
    const result = await resolveBirthTime({ date: '1947-07-01', time: '12:00', timeZone: 'Europe/Stockholm', latitude: 59.33, longitude: 18.07 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Pinned case refused');
    const value = RESOLVE_BIRTH_OUTPUT.parse(result.value);
    expect(value.resolution.offsetMinutes).toBe(60);
    expect(value.resolution.zone).toMatchObject({ source: 'tzdb', tzdbVersion: '2025c', dataForm: 'main+backzone' });
    expect(value.resolution.intlOffsetMinutes).toBe(120);
  });

  it.each([
    { date: '1901-02-29', time: '12:00', timeZone: 'UTC' },
    { date: '1947-07-01', time: '24:00', timeZone: 'UTC' },
    { date: '1947-07-01', time: '12:00' },
    { date: '1947-07-01', time: '12:00', timeZone: 'Europe/Atlantis' },
    { date: '1947-07-01', timeZone: 'UTC', timeKnown: true },
    { date: '1947-07-01', time: '12:00', timeZone: 'UTC', longitude: 18.07 },
    { date: '1947-07-01', time: '12:00', timeZone: 'UTC', latitude: 59.33, longitude: 181 },
    { date: '1947-07-01', time: '12:00', timeZone: 'UTC', calendar: 'guessed' },
    { date: '1947-07-01', time: '12:00', timeZone: 'UTC', path: '/private/canary' },
  ])('refuses malformed or unsupported input without a partial result', async (input) => {
    const result = await resolveBirthTime(input);
    expect(result.ok).toBe(false);
    expect(result).not.toHaveProperty('value');
    if (!result.ok) {
      expect(result.refusal).not.toContain('Europe/Atlantis');
      expect(result.refusal).not.toContain('/private/canary');
      expect(result.refusal).not.toContain('1947-07-01');
    }
  });

  it('refuses a legal local date whose resolved instant crosses the existing UTC span', async () => {
    const result = await resolveBirthTime({ date: '2199-12-31', time: '23:59', timeZone: 'America/Mexico_City', latitude: 19.35, longitude: -99.16 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.refusal).toContain('1800–2199');
  });
  it('keeps a supplied unknown-time reference instead of inventing local noon', async () => {
    const result = await resolveBirthTime({ date: '1947-07-01', time: '09:15', timeZone: 'Europe/Stockholm', timeKnown: false });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Supplied reference refused');
    const value = RESOLVE_BIRTH_OUTPUT.parse(result.value);
    expect(value.birth.utc).toBe('1947-07-01T08:15:00.000Z');
    expect(value.birth.timeKnown).toBe(false);
    expect(value.reference).toBe('supplied-instant');
    expect(value.receipt.localResolution.time).toBe('09:15');
  });

  it('changes the receipt digest when its actual timezone policy is altered', async () => {
    const result = await resolveBirthTime({ date: '1947-07-01', time: '12:00', timeZone: 'Europe/Stockholm' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Receipt case refused');
    const value = RESOLVE_BIRTH_OUTPUT.parse(result.value);
    expect(receiptDigest({ ...value.receipt, localResolution: { ...value.receipt.localResolution, offsetMinutes: 120 } }))
      .not.toBe(value.cite.receipt);
    expect(RESOLVE_BIRTH_OUTPUT.safeParse({ ...value, extra: 'unadvertised' }).success).toBe(false);
  });

});
