import priorIdentities from '../../docs/platform/evidence/site-engine-1-1-0/watch-prior-identities.json';
import type { WatchIdentity } from './watch/contracts';
import { describe, expect, it } from 'vitest';
import { executeAiTool } from './tools';
import { eventTimes, localIso, localMinuteIso, minuteUtc, moonCycle, moonDirection, moonPhaseLabel, roundToMinute, shownTime, shownUtc } from './clear-time';
import { calculateWindow } from './watch/worker';
import { computeEvents } from '../lib/compute-api/endpoints';
import { parseEventsRequest } from '../lib/compute-api/validate';
import { EPOCH } from '../lib/compute-api/constants';
import { moonPhase } from '@zodiacs/engine';

/**
 * ZOD-64: what get_sky and get_upcoming_events hand an assistant. Times to the minute, local times as ISO 8601 with
 * the offset beside the zone's name, and a Moon phase that says which way the Moon is going. These tests pin the
 * connector's formatting and its agreement with the search it already publishes; they are not accuracy evidence.
 */
const dependencies = { now: () => new Date('2026-11-10T08:35:46.560Z') };
const ISO_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/u;
const ISO_MINUTE_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00Z$/u;
const DAY_FIRST = /\d{2}\/\d{2}\/\d{4}/u;

describe('times an assistant can read one way only', () => {
  it('rounds an instant to the nearest minute and writes it with no fraction of a second', () => {
    expect(minuteUtc('2026-11-10T08:35:46.560Z')).toBe('2026-11-10T08:36:00Z');
    expect(minuteUtc('2026-11-10T08:35:29.999Z')).toBe('2026-11-10T08:35:00Z');
    expect(minuteUtc('2026-11-10T08:35:30.000Z')).toBe('2026-11-10T08:36:00Z');
    // Rounding carries across the hour, the day and the year.
    expect(minuteUtc('2026-12-31T23:59:45.000Z')).toBe('2027-01-01T00:00:00Z');
    expect(roundToMinute('2026-11-10T08:35:46.560Z').toISOString()).toBe('2026-11-10T08:36:00.000Z');
  });

  it('writes a local time as ISO 8601 with its offset, year first', () => {
    expect(localIso('2026-11-10T08:35:46.000Z', 'Asia/Bangkok')).toBe('2026-11-10T15:35:46+07:00');
    expect(localIso('2026-11-10T08:35:46.560Z', 'Asia/Bangkok')).toBe('2026-11-10T15:35:46+07:00');
    expect(localIso('2026-11-10T08:35:46Z', 'UTC')).toBe('2026-11-10T08:35:46+00:00');
    expect(localIso('2026-11-10T08:35:46Z', 'America/New_York')).toBe('2026-11-10T03:35:46-05:00');
    // Daylight saving, a half-hour and a quarter-hour zone, and a local date a day off UTC's.
    expect(localIso('2026-07-10T08:35:46Z', 'America/New_York')).toBe('2026-07-10T04:35:46-04:00');
    expect(localIso('2026-11-10T20:00:00Z', 'Asia/Kolkata')).toBe('2026-11-11T01:30:00+05:30');
    expect(localIso('2026-11-10T20:00:00Z', 'Asia/Kathmandu')).toBe('2026-11-11T01:45:00+05:45');
    expect(localIso('2026-11-10T02:00:00Z', 'America/St_Johns')).toBe('2026-11-09T22:30:00-03:30');
    expect(localMinuteIso('2026-11-10T08:35:46.560Z', 'Asia/Bangkok')).toBe('2026-11-10T15:36:00+07:00');
  });

  it('names the same instant: the local time parses back to the UTC time', () => {
    for (const zone of ['UTC', 'Asia/Bangkok', 'America/New_York', 'Europe/Madrid', 'Australia/Lord_Howe', 'Pacific/Chatham', 'Pacific/Kiritimati']) {
      for (const utc of ['2026-01-15T00:00:00Z', '2026-03-29T01:30:00Z', '2026-07-01T12:34:56Z', '2026-11-01T06:00:00Z', '2030-12-31T23:59:59Z']) {
        const local = localIso(utc, zone);
        expect(local, `${zone} ${utc}`).toMatch(ISO_LOCAL);
        expect(Date.parse(local), `${zone} ${utc}`).toBe(Date.parse(utc));
      }
    }
  });

  it('get_sky gives the requested moment as ISO local time with the zone name beside it', async () => {
    const result = await executeAiTool('get_sky', { instant: '2026-11-10T08:35:46Z', zone: 'Asia/Bangkok', bodies: ['Moon'] }, dependencies);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_sky') return;
    expect(result.data.time).toEqual({ utc: '2026-11-10T08:35:46.000Z', zone: 'Asia/Bangkok', display: '2026-11-10T15:35:46+07:00' });
    expect(JSON.stringify(result.data.time)).not.toMatch(DAY_FIRST);
  });

  it('get_upcoming_events gives each time to the minute, in UTC and on the zone\'s clock, and keeps the solved instants under the receipt', async () => {
    const args = { from: '2026-11-10T00:00:00Z', to: '2026-11-20T00:00:00Z', zone: 'Asia/Bangkok' };
    const result = await executeAiTool('get_upcoming_events', args, dependencies);
    const exact = computeEvents(parseEventsRequest({ from: args.from, to: args.to }));
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_upcoming_events') return;
    expect(result.data.zone).toBe('Asia/Bangkok');
    expect(result.data.events.length).toBeGreaterThan(3);
    expect(result.data.events).toHaveLength(exact.result.events.length);
    for (const [index, event] of result.data.events.entries()) {
      const solved = exact.result.events[index].at;
      expect(event.at).toMatch(ISO_MINUTE_UTC);
      expect(event.at).toBe(minuteUtc(solved));
      expect(Math.abs(Date.parse(event.at) - Date.parse(solved))).toBeLessThanOrEqual(30_000);
      expect(event.localAt).toMatch(ISO_LOCAL);
      expect(event.localAt.endsWith(':00+07:00')).toBe(true);
      expect(Date.parse(event.localAt)).toBe(Date.parse(event.at));
      expect(event.localAt).not.toMatch(DAY_FIRST);
    }
    // The calculation, which the receipt covers, is untouched: the instants as the engine solved them.
    expect(result.data.calculation).toEqual(exact);
    expect(exact.result.events.some((event) => !event.at.endsWith(':00.000Z'))).toBe(true);
  });

  it('without a zone the local time is the UTC time, written +00:00', async () => {
    const result = await executeAiTool('get_upcoming_events', { from: '2026-11-10T00:00:00Z', to: '2026-11-13T00:00:00Z' }, dependencies);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_upcoming_events') return;
    for (const event of result.data.events) expect(event.localAt).toBe(`${event.at.slice(0, 19)}+00:00`);
  });

  it('never shows a time outside the window searched: at an edge it rounds toward the inside', () => {
    const window = { from: '2026-11-10T14:00:00Z', to: '2026-11-10T14:31:45Z' };
    // 14:31:41 rounds to 14:32, past the end: it shows 14:31.
    expect(eventTimes('2026-11-10T14:31:41Z', 'UTC', window)).toEqual({ at: '2026-11-10T14:31:00Z', localAt: '2026-11-10T14:31:00+00:00' });
    expect(eventTimes('2026-11-10T14:31:41Z', 'Asia/Bangkok', window).localAt).toBe('2026-11-10T21:31:00+07:00');
    // Inside the window the nearest minute is kept, up or down.
    expect(eventTimes('2026-11-10T14:20:41Z', 'UTC', window).at).toBe('2026-11-10T14:21:00Z');
    expect(eventTimes('2026-11-10T14:20:21Z', 'UTC', window).at).toBe('2026-11-10T14:20:00Z');
    // 14:00:10 in a window that starts at 14:00:05 rounds to 14:00, before the start: it shows 14:01.
    expect(eventTimes('2026-11-10T14:00:10Z', 'UTC', { from: '2026-11-10T14:00:05Z', to: '2026-11-10T15:00:00Z' }).at).toBe('2026-11-10T14:01:00Z');
    // A window holding no whole minute near the event shows the nearest second inside it, then the instant itself.
    expect(eventTimes('2026-11-10T14:31:41.400Z', 'UTC', { from: '2026-11-10T14:31:20Z', to: '2026-11-10T14:31:45Z' })).toEqual({ at: '2026-11-10T14:31:41Z', localAt: '2026-11-10T14:31:41+00:00' });
    expect(eventTimes('2026-11-10T14:31:41.400Z', 'Asia/Bangkok', { from: '2026-11-10T14:31:41.300Z', to: '2026-11-10T14:31:41.500Z' })).toEqual({ at: '2026-11-10T14:31:41.400Z', localAt: '2026-11-10T21:31:41.400+07:00' });
  });

  it('never shows a time outside the supported range', () => {
    expect(EPOCH.to).toBe('2199-12-31T23:59:59.999Z');
    // 23:59:30 on the last day rounds to 2200-01-01, past the range: it shows 23:59.
    expect(shownUtc(shownTime('2199-12-31T23:59:30Z'))).toBe('2199-12-31T23:59:00Z');
    expect(eventTimes('2199-12-31T23:59:30Z', 'UTC', { from: '2199-12-31T00:00:00Z', to: EPOCH.to }).at).toBe('2199-12-31T23:59:00Z');
    expect(shownUtc(shownTime(EPOCH.from))).toBe('1800-01-01T00:00:00Z');
    expect(shownUtc(shownTime('1800-01-01T00:00:20Z'))).toBe('1800-01-01T00:00:00Z');
  });

  it('get_upcoming_events keeps a time inside a window that ends just after the event', async () => {
    // The Moon enters Sagittarius at 20:56:58 UTC on 3 January 2027.
    const args = { from: '2027-01-03T12:00:00Z', to: '2027-01-03T20:56:59Z', zone: 'Asia/Bangkok', kinds: ['ingress'] };
    const result = await executeAiTool('get_upcoming_events', args, dependencies);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_upcoming_events') return;
    const last = result.data.events[result.data.events.length - 1];
    const solved = (result.data.calculation.result.events as { at: string }[])[result.data.events.length - 1].at;
    // Solved within milliseconds of 20:56:58.993, so to the nearest minute it is 20:57, after the window ends.
    expect(solved.slice(0, 19)).toBe('2027-01-03T20:56:58');
    expect(minuteUtc(solved)).toBe('2027-01-03T20:57:00Z');
    expect(last.at).toBe('2027-01-03T20:56:00Z');
    expect(last.localAt).toBe('2027-01-04T03:56:00+07:00');
    for (const event of result.data.events) {
      expect(Date.parse(event.at)).toBeGreaterThanOrEqual(Date.parse(args.from));
      expect(Date.parse(event.at)).toBeLessThanOrEqual(Date.parse(args.to));
    }
  });

  it('keeps the published Sky Watch IDs while reconciling to exact DE440 times', async () => {
    for (const { from, to, events } of priorIdentities.windows) {
      const watched = await calculateWindow(from, to, events as WatchIdentity[]);
      const exact = computeEvents(parseEventsRequest({ from, to, kinds: ['ingress', 'station', 'lunation'] }));
      expect(watched.map(event => event.eventId)).toEqual(events.map(event => event.eventId));
      expect(watched.map(event => event.timestamp)).toEqual(exact.result.events.map(event => event.at));
      expect(watched.map(event => Object.keys(event.data.event))).toEqual(events.map(event => Object.keys(event.data.event)));
      expect(watched.some((event, index) => event.timestamp !== events[index].timestamp)).toBe(true);
    }
  });

  it('Sky Watch still takes the solved instants', async () => {
    const from = '2026-11-10T00:00:00.000Z', to = '2026-11-11T00:00:00.000Z';
    const exact = computeEvents(parseEventsRequest({ from, to, kinds: ['ingress', 'station', 'lunation'] }));
    const watched = await calculateWindow(from, to);
    expect(watched.length).toBeGreaterThan(0);
    expect(watched.map((event: { timestamp: string }) => event.timestamp)).toEqual(exact.result.events.map((event) => event.at));
    expect(watched.map((event: { data: { event: unknown } }) => event.data.event)).toEqual(exact.result.events);
  });
});

describe('a Moon phase that says which way the Moon is going', () => {
  it('names waxing or waning beside New Moon and Full Moon', () => {
    expect(moonDirection(0)).toBe('waxing');
    expect(moonDirection(179.99)).toBe('waxing');
    expect(moonDirection(180)).toBe('waning');
    expect(moonDirection(359.99)).toBe('waning');
    // The case in the report: 17 degrees past new is still inside the "New Moon" band.
    expect(moonPhaseLabel(17)).toBe('New Moon, waxing');
    expect(moonPhaseLabel(12.04)).toBe('New Moon, waxing');
    expect(moonPhaseLabel(348)).toBe('New Moon, waning');
    expect(moonPhaseLabel(170)).toBe('Full Moon, waxing');
    expect(moonPhaseLabel(190)).toBe('Full Moon, waning');
    // The quarters already say which way: the first is always waxing, the last always waning.
    expect(moonPhaseLabel(90)).toBe('First Quarter');
    expect(moonPhaseLabel(95)).toBe('First Quarter');
    expect(moonPhaseLabel(270)).toBe('Last Quarter');
    expect(moonPhaseLabel(265)).toBe('Last Quarter');
    // At the exact new or full Moon the Moon is turning: no direction.
    expect(moonPhaseLabel(0)).toBe('New Moon');
    expect(moonPhaseLabel(360)).toBe('New Moon');
    expect(moonPhaseLabel(180)).toBe('Full Moon');
    expect(moonPhaseLabel(0.01)).toBe('New Moon, waxing');
    expect(moonPhaseLabel(180.01)).toBe('Full Moon, waning');
    // The other four names already say it.
    expect(moonPhaseLabel(45)).toBe('Waxing Crescent');
    expect(moonPhaseLabel(135)).toBe('Waxing Gibbous');
    expect(moonPhaseLabel(225)).toBe('Waning Gibbous');
    expect(moonPhaseLabel(315)).toBe('Waning Crescent');
  });

  it('get_sky says so for the moment in the report', async () => {
    const result = await executeAiTool('get_sky', { instant: '2026-11-10T08:35:46Z', zone: 'Asia/Bangkok', bodies: ['Moon'] }, dependencies);
    expect(result.ok).toBe(true);
    if (!result.ok || result.tool !== 'get_sky') return;
    expect(result.data.moonPhase.angle).toBeGreaterThan(10);
    expect(result.data.moonPhase.angle).toBeLessThan(20);
    expect(result.data.moonPhase.name).toBe('New Moon, waxing');
  });

  it('finds the new and full Moons either side of a moment, to the minute, as get_upcoming_events lists them', () => {
    const at = new Date('2026-11-10T08:35:46Z');
    const cycle = moonCycle(at, moonPhase(at).angle);
    expect(cycle.direction).toBe('waxing');
    for (const time of [cycle.lastNew, cycle.nextNew, cycle.lastFull, cycle.nextFull]) expect(time).toMatch(ISO_MINUTE_UTC);
    // Just past new: the last new Moon is the nearest of the four, then the next full, then the next new.
    expect(Date.parse(cycle.lastFull)).toBeLessThan(Date.parse(cycle.lastNew));
    expect(Date.parse(cycle.lastNew)).toBeLessThanOrEqual(at.getTime() + 30_000);
    expect(Date.parse(cycle.nextFull)).toBeGreaterThan(at.getTime());
    expect(Date.parse(cycle.nextNew)).toBeGreaterThan(Date.parse(cycle.nextFull));
    // The same lunations as the events search over the same two months, each rounded to the minute.
    const listed = computeEvents(parseEventsRequest({ from: '2026-10-10T08:35:46Z', to: '2026-12-11T08:35:46Z', kinds: ['lunation'] })).result.events
      .map((event) => ({ type: (event as { type: string }).type, at: event.at }));
    const pick = (type: string, after: boolean) => {
      const times = listed.filter((event) => event.type === type && (Date.parse(event.at) > at.getTime()) === after).map((event) => event.at).sort();
      return minuteUtc(after ? times[0] : times[times.length - 1]);
    };
    expect(cycle).toEqual({ direction: 'waxing', lastNew: pick('new', false), nextNew: pick('new', true), lastFull: pick('full', false), nextFull: pick('full', true) });
  });

  it('keeps a lunar month between each pair, on any day', () => {
    const DAY = 86_400_000;
    for (let day = 0; day < 60; day += 7) {
      const at = new Date(Date.parse('2027-01-03T05:00:00Z') + day * DAY);
      const angle = moonPhase(at).angle;
      const cycle = moonCycle(at, angle);
      for (const [last, next] of [[cycle.lastNew, cycle.nextNew], [cycle.lastFull, cycle.nextFull]]) {
        const days = (Date.parse(next) - Date.parse(last)) / DAY;
        // A lunar month runs from about 29.27 to 29.83 days.
        expect(days).toBeGreaterThan(29.2);
        expect(days).toBeLessThan(29.9);
        expect(Date.parse(last)).toBeLessThanOrEqual(at.getTime() + 30_000);
        expect(Date.parse(next)).toBeGreaterThan(at.getTime() - 30_000);
      }
      // Waxing exactly when the last new Moon is more recent than the last full Moon.
      expect(cycle.direction).toBe(Date.parse(cycle.lastNew) > Date.parse(cycle.lastFull) ? 'waxing' : 'waning');
    }
  });
});
