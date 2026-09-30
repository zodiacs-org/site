import { describe, expect, it } from 'vitest';
import {
  bodyLongitude as browserBodyLongitude,
  longitudeSpeed as browserLongitudeSpeed,
} from './full';
import {
  bodyLongitude as serverBodyLongitude,
  longitudeSpeed as serverLongitudeSpeed,
} from './server-ephemeris';
import { scanTransitContacts as browserScan } from './transit-scan';
import { scanTransitContacts as serverScan } from './transit-scan-server';
import type { BodyName } from './types';

const BODIES: BodyName[] = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'North Node', 'South Node',
];

describe('serverless ephemeris boundary', () => {
  // Both instances of astronomy-engine run on the engine's clock; were the
  // server's left on the library's own polynomial, the Moon would differ by
  // several arcseconds today and by minutes of arc at the span's ends. Since
  // engine rc.15 that clock reads 1972 to 2027-10-02 as UTC through the leap
  // seconds and IERS UT1 − UTC; on the ΔT model alone the server would differ
  // there by up to UT1 − UTC, about half an arcsecond in the Moon.
  it('matches the browser SDK for every supported body across pinned instants', () => {
    for (const date of [
      new Date('1800-06-01T00:00:00Z'),
      new Date('1900-01-01T00:00:00Z'),
      new Date('1990-02-01T12:00:00Z'),
      new Date('2026-07-15T11:15:00Z'),
      new Date('2040-12-31T23:59:59Z'),
      new Date('2100-06-01T00:00:00Z'),
      new Date('2199-12-31T12:00:00Z'),
    ]) {
      for (const body of BODIES) {
        expect(serverBodyLongitude(body, date)).toBeCloseTo(browserBodyLongitude(body, date), 12);
        expect(serverLongitudeSpeed(body, date)).toBeCloseTo(browserLongitudeSpeed(body, date), 12);
      }
    }
  });

  it('matches it where the time basis changes: leap seconds, 1972, the UT1 table and the ΔT model', () => {
    const edges = [
      '1941-01-01T00:00:00Z', // the ΔT model's spline hands over to its knots near 1941.0
      '1972-01-01T00:00:00Z', // the leap seconds start
      '1973-01-02T00:00:00Z', // UT1 − UTC from finals2000A instead of C04
      '1990-01-01T00:00:00Z', // a leap second
      '2017-01-01T00:00:00Z', // the last leap second
      '2027-10-02T00:00:00Z', // the IERS table ends
    ];
    for (const edge of edges) {
      const at = Date.parse(edge);
      // Either side of the edge, and near enough for a speed sample to straddle it.
      for (const offset of [-43_200_000, -86_400, -1, 0, 1, 86_400, 43_200_000]) {
        const date = new Date(at + offset);
        for (const body of BODIES) {
          expect(serverBodyLongitude(body, date), `${body} ${date.toISOString()}`)
            .toBeCloseTo(browserBodyLongitude(body, date), 12);
          expect(serverLongitudeSpeed(body, date), `${body} speed ${date.toISOString()}`)
            .toBeCloseTo(browserLongitudeSpeed(body, date), 12);
        }
      }
    }
  });

  it('produces the same transit contacts through the server-only graph', () => {
    const natal = {
      bodies: [
        { body: 'Sun' as const, lon: 116.5 },
        { body: 'Moon' as const, lon: 221.25 },
        { body: 'Saturn' as const, lon: 285.75 },
      ],
      angles: { asc: 12.5, mc: 102.5 },
    };
    const from = new Date('2026-07-01T00:00:00Z');
    const to = new Date('2026-07-18T00:00:00Z');
    const options = { transitBodies: ['Mercury', 'Mars'] as const };

    expect(serverScan(natal, from, to, options)).toEqual(browserScan(natal, from, to, options));
  });
});
