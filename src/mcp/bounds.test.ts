import { describe, expect, it } from 'vitest';
import { HOUSE_SYSTEMS as ENGINE_HOUSE_SYSTEMS } from '@zodiacs/engine';
import {
  EPOCH_MAX_UTC, EPOCH_MIN_UTC, HOUSE_SYSTEMS, LIMITS, REFERENCES,
  parseCoordinates, parseInstant, polarAngleExclusion, recordTooLarge, resultTooLarge,
  utcNoonMisused,
} from './bounds';

describe('the instant a model is allowed to supply', () => {
  it.each([
    '1990-06-15T13:30:00Z',
    '1990-06-15T13:30:00.000Z',
    '1990-06-15T13:30Z',
    '1990-06-15T19:00:00+05:30',
    '1990-06-15T08:00:00-05:00',
    EPOCH_MIN_UTC,
    EPOCH_MAX_UTC,
  ])('accepts %s', (value) => {
    expect(parseInstant(value).ok).toBe(true);
  });

  it('keeps the spelling the caller used rather than normalising it', () => {
    const parsed = parseInstant('1990-06-15T19:00:00+05:30');
    expect(parsed.ok && parsed.supplied).toBe('1990-06-15T19:00:00+05:30');
    // …while resolving to the same instant as the Z spelling.
    expect(parsed.ok && parsed.instant.toISOString()).toBe('1990-06-15T13:30:00.000Z');
  });

  it.each([
    ['a wall time with no zone', '1990-06-15T13:30:00'],
    ['a bare date', '1990-06-15'],
    ['a day that does not exist', '2001-02-29T00:00:00Z'],
    ['a month that does not exist', '1990-13-01T00:00:00Z'],
    ['day zero', '1990-06-00T00:00:00Z'],
    ['an hour past the day', '1990-06-15T24:00:00Z'],
    ['a leap second', '1990-06-15T23:59:60Z'],
    ['a zone offset past the dateline', '1990-06-15T13:30:00+15:00'],
    ['a zone offset with 60 minutes', '1990-06-15T13:30:00+05:60'],
    ['before the supported epoch', '1799-12-31T23:59:59Z'],
    ['after the supported epoch', '2200-01-01T00:00:00Z'],
    ['a unix timestamp', '644067000'],
    ['an expression', 'new Date()'],
    ['a path', '/etc/passwd'],
    ['a module name', 'node:fs'],
    ['a URL', 'https://example.com/chart.json'],
    ['nothing', ''],
  ])('refuses %s', (_label, value) => {
    expect(parseInstant(value).ok).toBe(false);
  });

  it('refuses an oversized string by length before looking at its shape', () => {
    const parsed = parseInstant(`${'1990-06-15T13:30:00Z'.repeat(100)}`);
    expect(parsed.ok).toBe(false);
    expect(parsed.ok === false && parsed.reason).toMatch(/too long/);
  });

  it('29 February exists in a leap year and not in a century that is not one', () => {
    expect(parseInstant('2000-02-29T00:00:00Z').ok).toBe(true);
    expect(parseInstant('1996-02-29T00:00:00Z').ok).toBe(true);
    expect(parseInstant('1900-02-29T00:00:00Z').ok).toBe(false);
    expect(parseInstant('2100-02-29T00:00:00Z').ok).toBe(false);
  });
});

describe('coordinates', () => {
  it('accepts a pair, or neither', () => {
    expect(parseCoordinates(51.5074, -0.1278)).toEqual({ ok: true, coordinates: { latitude: 51.5074, longitude: -0.1278 } });
    expect(parseCoordinates(undefined, undefined)).toEqual({ ok: true, coordinates: null });
  });

  it('refuses one without the other rather than defaulting the missing one', () => {
    expect(parseCoordinates(51.5, undefined).ok).toBe(false);
    expect(parseCoordinates(undefined, -0.12).ok).toBe(false);
  });

  it.each([
    [91, 0], [-91, 0], [0, 181], [0, -181],
    [Number.NaN, 0], [Number.POSITIVE_INFINITY, 0], [0, Number.NaN],
  ])('refuses latitude %s longitude %s', (latitude, longitude) => {
    expect(parseCoordinates(latitude, longitude).ok).toBe(false);
  });

  it('accepts the dateline exactly, and the poles as coordinates', () => {
    for (const pair of [[90, 180], [-90, -180], [0, 0]] as const) {
      expect(parseCoordinates(pair[0], pair[1]).ok).toBe(true);
    }
  });

  it('refuses an exact pole only when a birth time is known', () => {
    // This module accepts ±90 because a chart with no time has no angles to
    // compute and succeeds there. The earlier version of the test above was
    // titled "accepts the poles… exactly" and stopped here, so it passed while
    // every ordinary request at ±90 was refused with an internal error code.
    expect(polarAngleExclusion({ latitude: 90 }, true)).toMatch(/does not compute angles at the exact poles/);
    expect(polarAngleExclusion({ latitude: -90 }, true)).not.toBeNull();
    expect(polarAngleExclusion({ latitude: 90 }, false)).toBeNull();
    expect(polarAngleExclusion({ latitude: 89.999999 }, true)).toBeNull();
    expect(polarAngleExclusion(null, true)).toBeNull();
  });

  it('states the two rules the utc-noon reference actually has', () => {
    const noon = new Date('1990-06-15T12:00:00.000Z');
    expect(utcNoonMisused(noon, false)).toBeNull();
    expect(utcNoonMisused(noon, true)).toMatch(/timeKnown: false/);
    expect(utcNoonMisused(new Date('1990-06-15T13:30:00.000Z'), false)).toMatch(/exactly 12:00:00Z/);
  });

  it('does not offer a reference it cannot produce', () => {
    // `local-noon` needs a captured local date, wall time, zone and offset, and
    // this adapter resolves no timezones, so every call using it was refused.
    expect([...REFERENCES]).toEqual(['supplied-instant', 'utc-noon']);
  });
});

describe('the size gates', () => {
  it('measures a record in bytes, not characters', () => {
    // 40000 three-byte characters: under any character cap at the envelope
    // limit, and well over the byte limit. A length check in characters would
    // hand this to the parser.
    const multibyte = '€'.repeat(40_000);
    expect(multibyte.length).toBeLessThan(LIMITS.recordBytes);
    expect(recordTooLarge(multibyte)).toBe(120_000);
    expect(recordTooLarge('{}')).toBeNull();
  });

  it('reports an oversized result with its size rather than trimming it', () => {
    expect(resultTooLarge({ a: 1 })).toBeNull();
    const huge = { rows: Array.from({ length: 40_000 }, (_, index) => ({ id: `row-${index}` })) };
    expect(resultTooLarge(huge)).toBeGreaterThan(LIMITS.resultBytes);
  });

  it('bounds the request line above the worst case its own comment describes', () => {
    // Two records at the byte limit, each byte escaping to at most six bytes of
    // JSON string. The assertion used to be `> 2 * recordBytes`, which is six
    // times weaker than the comment defending it and would have passed for a
    // limit that could refuse a legitimate request.
    expect(LIMITS.requestBytes).toBeGreaterThan(2 * 6 * LIMITS.recordBytes);
    expect(LIMITS.requestBytes).toBeLessThan(10 * 1024 * 1024);
  });
});

it('offers exactly the house systems the engine computes, the default first', () => {
  expect([...HOUSE_SYSTEMS].sort()).toEqual([...ENGINE_HOUSE_SYSTEMS].sort());
  expect(HOUSE_SYSTEMS[0]).toBe('placidus');
});
