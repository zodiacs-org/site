import { describe, expect, it } from 'vitest';
import { timeIn, utcOffsetLabel, worldTimes, worldTimesSentence } from './world-times';

describe('world times', () => {
  it('reads one instant on five clocks, with the date where it moves', () => {
    // Mercury's first 2027 retrograde station, by NASA JPL Horizons.
    const at = new Date('2027-02-09T17:36:05Z');
    expect(worldTimes(at).map((t) => [t.city, t.day, t.time, t.offset, t.dayShift])).toEqual([
      ['UTC', 'Tue Feb 9', '17:36', 'UTC', 0],
      ['New York', 'Tue Feb 9', '12:36', 'UTC-5', 0],
      ['London', 'Tue Feb 9', '17:36', 'UTC+0', 0],
      ['Kolkata', 'Tue Feb 9', '23:06', 'UTC+5:30', 0],
      ['Sydney', 'Wed Feb 10', '04:36', 'UTC+11', 1],
    ]);
    expect(worldTimesSentence(at)).toBe(
      '17:36 UTC on February 9, which is 12:36 in New York, 17:36 in London, 23:06 in Kolkata and 04:36 on February 10 in Sydney',
    );
  });

  it('follows daylight saving from the zone database', () => {
    const july = new Date('2027-07-18T15:44:58Z');
    expect(timeIn(july, 'America/New_York')).toMatchObject({ time: '11:44', offset: 'UTC-4' });
    expect(timeIn(july, 'Europe/London')).toMatchObject({ time: '16:44', offset: 'UTC+1' });
    expect(timeIn(july, 'Australia/Sydney')).toMatchObject({ time: '01:44', offset: 'UTC+10', monthDay: 'July 19', dayShift: 1 });
  });

  it('moves a late UTC evening back a day in New York', () => {
    expect(timeIn(new Date('2027-01-01T02:00:00Z'), 'America/New_York')).toMatchObject({ ymd: '2026-12-31', dayShift: -1 });
  });

  it('drops the seconds rather than rounding them', () => {
    expect(timeIn(new Date('2027-01-22T12:17:59.9Z'), 'UTC').time).toBe('12:17');
  });

  it('names offsets plainly', () => {
    expect(utcOffsetLabel('GMT')).toBe('UTC+0');
    expect(utcOffsetLabel('GMT-05:00')).toBe('UTC-5');
    expect(utcOffsetLabel('GMT+05:30')).toBe('UTC+5:30');
    expect(() => utcOffsetLabel('EST')).toThrow();
  });
});
