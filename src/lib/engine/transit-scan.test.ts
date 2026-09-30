import { describe, expect, it } from 'vitest';
import { bodyLongitude, longitudeSpeed } from './full';
import independentCases from './fixtures/independent-eight-cases.json';
import independentPolicy from './fixtures/swiss-eight-cases-policy.json';
import { angularDifference, expectIndependentTime } from './fixtures/independent-validation.test-helpers';
import {
  DEFAULT_TRANSIT_BODIES,
  SLOW_TRANSIT_BODIES,
  aspectTargetLongitudes,
  computeNatalTransitChart,
  natalTransitPoints,
  scanTransitContacts,
} from './transit-scan';
import type { NatalTransitChart, TransitBody } from './transit-scan';
import type { BodyName } from './types';

const normalize = (lon: number) => ((lon % 360) + 360) % 360;
const at = (body: BodyName, lon: number) => ({ body, lon });
const utcMinute = (iso: string) => new Date(
  Math.round(new Date(iso).getTime() / 60_000) * 60_000,
).toISOString().slice(0, 16);

// Each station, its target 0.1° inside the extremum and both crossings with
// their ±0.05° bands come from NASA JPL Horizons (DE441) at the engine's own
// TT (docs/engine-validation/independent-references/), on the windows of
// swiss-eight-cases-policy.json.
describe('independent conditioned station contacts', () => {
  it.each(independentCases.stations)('$id', (reference) => {
    const input = independentPolicy.stations.find((row) => row.id === reference.id)!;
    const body = input.body as TransitBody;
    const contacts = scanTransitContacts(
      { bodies: [at('Sun', reference.targetLongitudeDegrees)] },
      new Date(input.fromUTC), new Date(input.toUTC),
      { transitBodies: [body], natalPoints: ['Sun'], aspects: ['conjunction'] },
    );
    expect(contacts).toHaveLength(reference.crossings.length);
    contacts.forEach((contact, index) => {
      const expected = reference.crossings[index];
      expectIndependentTime(new Date(contact.exactUtc), expected);
      expect(contact.transitBody).toBe(body);
      expect(contact.natalPoint).toBe('Sun');
      expect(contact.aspect).toBe('conjunction');
      expect(contact.pass).toBe(index + 1);
      expect(contact.passCount).toBe(reference.crossings.length);
      const speed = longitudeSpeed(body, new Date(contact.exactUtc));
      expect(Number.isFinite(speed)).toBe(true);
      // Both Saturn contacts fall inside this approved deadband. Their
      // directions are intentionally not asserted across independent models.
      if (Math.abs(speed) > independentPolicy.gates.directionDeadbandDegreesPerDay
        && Math.abs(expected.speedDegreesPerDay) > independentPolicy.gates.directionDeadbandDegreesPerDay) {
        expect(speed < 0).toBe(expected.retrograde);
      }
      if (index > 0) expect(Date.parse(contact.exactUtc)).toBeGreaterThan(Date.parse(contacts[index - 1].exactUtc));
    });
    expect(angularDifference(
      bodyLongitude(body, new Date(reference.analyticStationMilliseconds)), reference.analyticStationLongitudeDegrees,
    )).toBeLessThanOrEqual(independentPolicy.gates.planetLongitudeCircularDegreesMaximum);
    // Finite speed is a diagnostic contract; the independently acquired
    // longitude-derived contact bands are not tight station-time guarantees.
    expect(Number.isFinite(longitudeSpeed(body, new Date(reference.finiteDifferenceStationMilliseconds)))).toBe(true);
  });
});

describe('transit-contact geometry', () => {
  it('uses the canonical planet sets and keeps the Moon opt-in', () => {
    expect(DEFAULT_TRANSIT_BODIES).toEqual([
      'Sun', 'Mercury', 'Venus', 'Mars',
      'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    ]);
    expect(SLOW_TRANSIT_BODIES).toEqual(['Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
    expect(DEFAULT_TRANSIT_BODIES).not.toContain('Moon');
  });

  it('builds all five target pairs correctly across 0°', () => {
    expect(aspectTargetLongitudes(350, 'conjunction')).toEqual([350]);
    expect(aspectTargetLongitudes(350, 'sextile')).toEqual([50, 290]);
    expect(aspectTargetLongitudes(350, 'square')).toEqual([80, 260]);
    expect(aspectTargetLongitudes(350, 'trine')).toEqual([110, 230]);
    expect(aspectTargetLongitudes(350, 'opposition')).toEqual([170]);
  });

  it('keeps natal Moon and ASC/MC, filters nodes, and normalizes longitudes', () => {
    const points = natalTransitPoints({
      bodies: [
        at('Sun', 360),
        at('Moon', -1),
        at('North Node', 90),
        at('South Node', 270),
      ],
      angles: { asc: 721, mc: -90 },
    });
    expect(points).toEqual([
      { name: 'Sun', lon: 0 },
      { name: 'Moon', lon: 359 },
      { name: 'ASC', lon: 1 },
      { name: 'MC', lon: 270 },
    ]);
  });

  it('can construct the engine-bound natal input without retaining nodes', () => {
    const natal = computeNatalTransitChart(
      new Date('1990-02-01T12:00:00Z'),
      { asc: 200, mc: 110 },
    );
    expect(natal.bodies.map((body) => body.body)).toEqual([
      'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
      'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
    ]);
    expect(natal.angles).toEqual({ asc: 200, mc: 110 });
  });
});

describe('scanTransitContacts', () => {
  it('finds all major aspects and ASC/MC contacts, then sorts deterministic ties', () => {
    const exact = new Date('2026-07-15T12:00:00Z');
    const marsLon = bodyLongitude('Mars', exact);
    const natal: NatalTransitChart = {
      bodies: [
        at('Sun', marsLon),
        at('Moon', normalize(marsLon - 60)),
        at('Mercury', normalize(marsLon - 90)),
        at('Venus', normalize(marsLon - 120)),
        at('Mars', normalize(marsLon - 180)),
      ],
      angles: { asc: marsLon, mc: normalize(marsLon - 180) },
    };

    const contacts = scanTransitContacts(
      natal,
      new Date('2026-07-15T06:00:00Z'),
      new Date('2026-07-15T18:00:00Z'),
      { transitBodies: ['Mars'] },
    );

    expect(contacts.map(({ transitBody, natalPoint, aspect, pass, passCount }) => ({
      transitBody, natalPoint, aspect, pass, passCount,
    }))).toEqual([
      { transitBody: 'Mars', natalPoint: 'Sun', aspect: 'conjunction', pass: 1, passCount: 1 },
      { transitBody: 'Mars', natalPoint: 'Moon', aspect: 'sextile', pass: 1, passCount: 1 },
      { transitBody: 'Mars', natalPoint: 'Mercury', aspect: 'square', pass: 1, passCount: 1 },
      { transitBody: 'Mars', natalPoint: 'Venus', aspect: 'trine', pass: 1, passCount: 1 },
      { transitBody: 'Mars', natalPoint: 'Mars', aspect: 'opposition', pass: 1, passCount: 1 },
      { transitBody: 'Mars', natalPoint: 'ASC', aspect: 'conjunction', pass: 1, passCount: 1 },
      { transitBody: 'Mars', natalPoint: 'MC', aspect: 'opposition', pass: 1, passCount: 1 },
    ]);
    expect(new Set(contacts.map((contact) => contact.exactUtc.slice(0, 16)))).toEqual(
      new Set([exact.toISOString().slice(0, 16)]),
    );
  });

  it('omits the transiting Moon by default and includes an exact end-boundary hit behind the flag', () => {
    const to = new Date('2026-07-15T12:00:00Z');
    const natal: NatalTransitChart = {
      bodies: [at('Sun', bodyLongitude('Moon', to))],
      angles: null,
    };
    const from = new Date('2026-07-15T06:13:00Z');

    expect(scanTransitContacts(natal, from, to, { transitBodies: ['Moon'] })).toEqual([]);
    expect(scanTransitContacts(natal, from, to, {
      transitBodies: ['Moon'],
      includeMoon: true,
    })).toEqual([
      {
        transitBody: 'Moon',
        natalPoint: 'Sun',
        aspect: 'conjunction',
        exactUtc: to.toISOString(),
        pass: 1,
        passCount: 1,
      },
    ]);
  });

  it('filters natal points and aspects before scanning', () => {
    const exact = new Date('2026-07-15T12:00:00Z');
    const marsLon = bodyLongitude('Mars', exact);
    const natal: NatalTransitChart = {
      bodies: [
        at('Sun', marsLon),
        at('Moon', normalize(marsLon - 90)),
      ],
      angles: { asc: normalize(marsLon - 180), mc: normalize(marsLon - 120) },
    };

    const contacts = scanTransitContacts(
      natal,
      new Date('2026-07-15T06:00:00Z'),
      new Date('2026-07-15T18:00:00Z'),
      {
        transitBodies: ['Mars'],
        natalPoints: ['Moon', 'ASC'],
        aspects: ['opposition'],
      },
    );

    expect(contacts.map(({ natalPoint, aspect }) => ({ natalPoint, aspect }))).toEqual([
      { natalPoint: 'ASC', aspect: 'opposition' },
    ]);
    expect(scanTransitContacts(natal, exact, exact, {
      transitBodies: ['Mars'],
      natalPoints: [],
      aspects: ['conjunction'],
    })).toEqual([]);
    expect(scanTransitContacts(natal, exact, exact, {
      transitBodies: ['Mars'],
      natalPoints: ['Sun'],
      aspects: [],
    })).toEqual([]);
  });

  it('keeps the exposed exact instant inside a sub-minute window', () => {
    const exact = new Date('2026-07-15T12:00:25Z');
    const from = new Date('2026-07-15T12:00:15Z');
    const to = new Date('2026-07-15T12:00:35Z');
    const contacts = scanTransitContacts(
      { bodies: [at('Sun', bodyLongitude('Mars', exact))], angles: null },
      from,
      to,
      { transitBodies: ['Mars'] },
    );

    expect(contacts).toHaveLength(1);
    expect(new Date(contacts[0].exactUtc).getTime()).toBeGreaterThanOrEqual(from.getTime());
    expect(new Date(contacts[0].exactUtc).getTime()).toBeLessThanOrEqual(to.getTime());
    expect(contacts[0].exactUtc.slice(0, 19)).toBe('2026-07-15T12:00:25');
  });

  it('retains the three exact Saturn-return passes for the known 1990 chart', () => {
    const birth = new Date('1990-02-01T12:00:00Z');
    const natal: NatalTransitChart = {
      bodies: [at('Saturn', bodyLongitude('Saturn', birth))],
      angles: null,
    };
    const contacts = scanTransitContacts(
      natal,
      new Date('2019-01-01T00:00:00Z'),
      new Date('2020-01-01T00:00:00Z'),
      { transitBodies: ['Saturn'] },
    );

    expect(contacts.map((contact) => utcMinute(contact.exactUtc))).toEqual([
      '2019-03-21T16:04',
      '2019-06-09T10:19',
      '2019-12-13T08:51',
    ]);
    expect(contacts.map(({ pass, passCount }) => ({ pass, passCount }))).toEqual([
      { pass: 1, passCount: 3 },
      { pass: 2, passCount: 3 },
      { pass: 3, passCount: 3 },
    ]);
    for (const contact of contacts) {
      const error = Math.abs(normalize(
        bodyLongitude('Saturn', new Date(contact.exactUtc)) - natal.bodies[0].lon + 180,
      ) - 180);
      expect(error).toBeLessThan(0.001);
    }
  });

  it('keeps both close passes around a station instead of cancelling their signs', () => {
    const contacts = scanTransitContacts(
      { bodies: [at('Sun', 352.56407473871195)], angles: null },
      new Date('2026-01-01T00:00:00Z'),
      new Date('2027-01-01T00:00:00Z'),
      { transitBodies: ['Mercury'] },
    ).filter((contact) => contact.aspect === 'conjunction');

    expect(contacts.map((contact) => utcMinute(contact.exactUtc))).toEqual([
      '2026-02-26T04:08',
      '2026-02-26T09:26',
      '2026-04-09T11:40',
    ]);
    expect(contacts.map(({ pass, passCount }) => ({ pass, passCount }))).toEqual([
      { pass: 1, passCount: 3 },
      { pass: 2, passCount: 3 },
      { pass: 3, passCount: 3 },
    ]);
  });

  it('resolves two contacts only seconds apart at the true station extremum', () => {
    // Ten seconds past Mercury's station; both instants here moved 6.017 s
    // later with engine 0.1.1-rc.8's observed ΔT, the same TT as before.
    const nearStation = new Date('2026-02-26T06:47:17.925Z');
    const targetLon = bodyLongitude('Mercury', nearStation);
    const contacts = scanTransitContacts(
      { bodies: [at('Sun', targetLon)], angles: null },
      new Date('2026-02-25T00:00:00Z'),
      new Date('2026-02-27T00:00:00Z'),
      { transitBodies: ['Mercury'] },
    ).filter((contact) => contact.aspect === 'conjunction');

    expect(contacts).toHaveLength(2);
    expect(contacts.map((contact) => utcMinute(contact.exactUtc))).toEqual([
      '2026-02-26T06:47',
      '2026-02-26T06:47',
    ]);
    expect(new Date(contacts[1].exactUtc).getTime() - new Date(contacts[0].exactUtc).getTime())
      .toBeGreaterThan(10_000);
    expect(contacts.map(({ pass, passCount }) => ({ pass, passCount }))).toEqual([
      { pass: 1, passCount: 2 },
      { pass: 2, passCount: 2 },
    ]);
  });

  it('does not insert a synthetic station contact between two real roots', () => {
    const station = new Date('2026-02-26T06:47:07.464Z');
    const stationLon = bodyLongitude('Mercury', station);
    const errorAt = (date: Date) => Math.abs(normalize(
      bodyLongitude('Mercury', date) - stationLon + 180,
    ) - 180);
    const halfSecondEnvelope = Math.max(
      errorAt(new Date(station.getTime() - 500)),
      errorAt(new Date(station.getTime() + 500)),
    );
    const targetLon = normalize(stationLon - 0.8 * halfSecondEnvelope);
    const contacts = scanTransitContacts(
      { bodies: [at('Sun', targetLon)], angles: null },
      new Date('2026-02-25T00:00:00Z'),
      new Date('2026-02-27T00:00:00Z'),
      { transitBodies: ['Mercury'] },
    ).filter((contact) => contact.aspect === 'conjunction');

    expect(contacts).toHaveLength(2);
    expect(new Date(contacts[1].exactUtc).getTime() - new Date(contacts[0].exactUtc).getTime())
      .toBeGreaterThan(100);
  });

  it('rejects invalid windows and non-finite chart data', () => {
    const natal: NatalTransitChart = { bodies: [at('Sun', 10)], angles: null };
    expect(() => scanTransitContacts(
      natal,
      new Date('invalid'),
      new Date('2026-01-01T00:00:00Z'),
    )).toThrow('valid');
    expect(() => scanTransitContacts(
      natal,
      new Date('2026-02-01T00:00:00Z'),
      new Date('2026-01-01T00:00:00Z'),
    )).toThrow('from <= to');
    expect(() => natalTransitPoints({ bodies: [at('Sun', Number.NaN)], angles: null })).toThrow('finite');
  });
});
