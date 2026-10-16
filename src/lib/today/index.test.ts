import { describe, expect, it } from 'vitest';
import type { Profile, SavedChart } from '../profile/schema';
import { TRANSIT_ORB, transitLine } from '../transits';
import {
  natalPointsForChart,
  nearestTodayContact,
  newestSavedChart,
  nextTodayStreak,
  rankTodayContacts,
  selectTodayContacts,
} from '.';

const chart = {
  id: 'fixture',
  name: 'Fixture',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  birth: { date: '1990-01-01', time: '12:00', timeKnown: true, place: null },
  summary: {
    engineVersion: 'fixture',
    utcISO: '1990-01-01T12:00:00.000Z',
    houseSystem: 'whole',
    bodies: [{ body: 'Sun', lon: 100, retrograde: false }],
    angles: { asc: 23, mc: 277 },
    flags: [],
  },
} satisfies SavedChart;

describe('today contact selection', () => {
  it('ignores a newer malformed local entry when choosing the saved chart', () => {
    const stored = {
      version: 1,
      settings: { houseSystem: 'whole' },
      charts: [
        chart,
        {
          id: 'newer-malformed',
          name: 'Malformed',
          createdAt: '2026-07-02T00:00:00.000Z',
          updatedAt: '2026-07-02T00:00:00.000Z',
        },
      ],
    } as unknown as Profile;

    expect(newestSavedChart(stored)?.id).toBe(chart.id);
  });

  it('ranks a pinned sky against a known natal point and reuses transit sentences', () => {
    const natal = [{ body: 'Sun', lon: 100 }];
    const sky = [
      { body: 'Jupiter', lon: 221.5 },
      { body: 'Mars', lon: 40.8 },
      { body: 'Saturn', lon: 190 },
      { body: 'Venus', lon: 12 },
    ];
    const contacts = selectTodayContacts(natal, sky, TRANSIT_ORB);

    expect(contacts.map(({ transiting, type, natal: point, orb }) =>
      [transiting, type, point, orb])).toEqual([
      ['Saturn', 'square', 'Sun', 0],
      ['Mars', 'sextile', 'Sun', expect.closeTo(0.8)],
      ['Jupiter', 'trine', 'Sun', 1.5],
    ]);
    expect(transitLine(contacts[0].transiting, contacts[0].type, contacts[0].natal)).toBe(
      'Saturn pushes against your sense of self: a long season of pressure and accounting, friction that will not resolve on its own.',
    );
  });

  it('includes ASC and MC from the positions-only profile summary', () => {
    expect(natalPointsForChart(chart).map(({ body, lon }) => [body, lon])).toEqual([
      ['Sun', 100],
      ['Ascendant', 23],
      ['Midheaven', 277],
    ]);
  });

  it('keeps only contacts within TRANSIT_ORB and returns the nearest miss', () => {
    const natal = [{ body: 'Sun', lon: 100 }];
    const sky = [{ body: 'Saturn', lon: 193.2 }];
    expect(rankTodayContacts(natal, sky, TRANSIT_ORB)).toEqual([]);
    const nearest = nearestTodayContact(natal, sky);
    expect(nearest?.type).toBe('square');
    expect(nearest?.orb).toBeCloseTo(3.2);
  });
});

describe('today UTC streak', () => {
  const at = (iso: string) => new Date(iso);

  it('starts at one and never increments twice on the same UTC day', () => {
    const first = nextTodayStreak(null, at('2026-07-10T23:59:00Z'));
    expect(first).toEqual({ version: 1, count: 1, lastOpenedUtcDay: '2026-07-10' });
    expect(nextTodayStreak(first, at('2026-07-10T23:59:59Z'))).toEqual(first);
  });

  it('increments on the next UTC day', () => {
    expect(nextTodayStreak(
      { version: 1, count: 4, lastOpenedUtcDay: '2026-07-10' },
      at('2026-07-11T00:00:01Z'),
    ).count).toBe(5);
  });

  it('keeps a 365-day streak as a safe integer', () => {
    expect(nextTodayStreak(
      { version: 1, count: 364, lastOpenedUtcDay: '2026-07-10' },
      at('2026-07-11T00:00:01Z'),
    ).count).toBe(365);
  });

  it('resets after a missed day or a backward clock change', () => {
    expect(nextTodayStreak(
      { version: 1, count: 4, lastOpenedUtcDay: '2026-07-10' },
      at('2026-07-12T12:00:00Z'),
    ).count).toBe(1);
    expect(nextTodayStreak(
      { version: 1, count: 4, lastOpenedUtcDay: '2026-07-10' },
      at('2026-07-09T12:00:00Z'),
    ).count).toBe(1);
  });
});
