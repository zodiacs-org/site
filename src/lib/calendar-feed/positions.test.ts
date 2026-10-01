import { describe, expect, it } from 'vitest';
import { buildTransitCalendar } from '../../../api/calendar/transits';
import { calendarToken } from '../../islands/CalendarSubscribe';
import { encodePositionsLink, POSITION_BODY_ORDER } from '../share-positions';
import { buildFeedCalendar } from './build';
import {
  FEED_PLANETS,
  feedPositionsFromCode,
  feedPositionsFromRecord,
  natalChartFromFeed,
} from './positions';

// Synthetic positions: no real birth.
const LONGITUDES = POSITION_BODY_ORDER.map((_, index) => Number(((index * 29.137) % 360).toFixed(3)));
const WINDOW = {
  from: new Date('2026-03-19T00:00:00Z'),
  to: new Date('2026-03-26T00:00:00Z'),
  generatedAt: '2026-03-19T12:00:00Z',
} as const;

function sharedCode(angles: { asc: number; mc: number } | null): string {
  return calendarToken({
    bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: LONGITUDES[index] })),
    angles,
    houseSystem: 'placidus',
    engineVersion: '1.0.0',
  })!;
}

describe('what a calendar feed stores', () => {
  it('keeps the ten planets to 0.001° and the angles to the whole degree, and drops the rest', () => {
    const stored = feedPositionsFromCode(sharedCode({ asc: 245.678, mc: 159.999 }));
    expect(stored).toEqual({
      planets: LONGITUDES.slice(0, 10),
      ascendant: 245,
      midheaven: 159,
    });
    expect(Object.keys(stored!).sort()).toEqual(['ascendant', 'midheaven', 'planets']);
    expect(FEED_PLANETS).toEqual(POSITION_BODY_ORDER.slice(0, 10));
  });

  it('stores no angles for a chart without a birth time', () => {
    expect(feedPositionsFromCode(sharedCode(null))).toEqual({
      planets: LONGITUDES.slice(0, 10),
      ascendant: null,
      midheaven: null,
    });
  });

  it('accepts only a code made to leave the device', () => {
    const exactAngles = encodePositionsLink({
      bodies: POSITION_BODY_ORDER.map((body, index) => ({ body, lon: LONGITUDES[index] })),
      angles: { asc: 245.678, mc: 159.999 },
      houseSystem: 'whole',
      engineVersion: '1.0.0',
    })!;
    expect(feedPositionsFromCode(exactAngles)).toBeNull();

    // The decoder takes any number in range; the feed takes 0.001° at most.
    const planetDecimals = `2.${Buffer.from(JSON.stringify({
      b: [1.00049, ...LONGITUDES.slice(1)], h: 'w', v: '1.0.0',
    })).toString('base64url')}`;
    expect(feedPositionsFromCode(planetDecimals)).toBeNull();

    for (const junk of [undefined, null, 42, '', '2.', '2.invalid', 'not a code', { positions: 'x' }]) {
      expect(feedPositionsFromCode(junk)).toBeNull();
    }
  });

  it('checks what the database returns', () => {
    const record = { planets: LONGITUDES.slice(0, 10), ascendant: 12, midheaven: 281 };
    expect(feedPositionsFromRecord({ outcome: 'ready', ...record })).toEqual(record);
    expect(feedPositionsFromRecord({ planets: LONGITUDES.slice(0, 10), ascendant: null, midheaven: null }))
      .toEqual({ planets: LONGITUDES.slice(0, 10), ascendant: null, midheaven: null });
    for (const bad of [
      { ...record, planets: LONGITUDES.slice(0, 9) },
      { ...record, planets: [...LONGITUDES.slice(0, 9), 360] },
      { ...record, planets: [...LONGITUDES.slice(0, 9), '1'] },
      { ...record, ascendant: 12.5 },
      { ...record, ascendant: 360 },
      { ...record, midheaven: null },
      null,
      [],
    ]) {
      expect(feedPositionsFromRecord(bad)).toBeNull();
    }
  });

  it('gives the scanner each angle at the middle of its whole degree', () => {
    const natal = natalChartFromFeed({ planets: LONGITUDES.slice(0, 10), ascendant: 0, midheaven: 359 });
    expect(natal.angles).toEqual({ asc: 0.5, mc: 359.5 });
    expect(natal.bodies.map(({ body }) => body)).toEqual([...FEED_PLANETS]);
    expect(natalChartFromFeed({ planets: LONGITUDES.slice(0, 10), ascendant: null, midheaven: null }).angles)
      .toBeNull();
  });

  it('builds the same calendar from the stored feed as from the code it was made from', () => {
    for (const angles of [{ asc: 245.678, mc: 159.999 }, null]) {
      const code = sharedCode(angles);
      const fromCode = buildTransitCalendar(code, WINDOW);
      const fromFeed = buildFeedCalendar(natalChartFromFeed(feedPositionsFromCode(code)!), WINDOW);
      expect(fromFeed).toBe(fromCode);
      expect(fromFeed.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThan(0);
    }
  });
});
