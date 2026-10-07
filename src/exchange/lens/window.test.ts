import { describe, expect, it } from 'vitest';
import type { SkyEvent } from './types';
import { calendarTicks, coversWindow, formatMinute, linkedWindowRatio, plannedEntry, relativeLabel, tickLabel, tradeWindow, wallTimeInput, windowICS } from './window';

const H = 3_600_000;
const START = Date.parse('2026-10-13T02:30:00.000Z');
const END = START + 72 * H;
const provenance = { catalog: 'Test catalog', sha256: 'a'.repeat(64), engineVersion: 'test', convention: 'Test convention' };

const sky = (id: string, at: string, extra: Partial<SkyEvent> = {}): SkyEvent => ({ id, family: 'aspect', subtype: 'aspect', title: id, at, bodies: ['Sun'], interpretation: 'Traditional note.', provenance, ...extra });
const economic = (id: string, at: string): SkyEvent => ({ ...sky(id, at), family: 'economic', subtype: 'cpi', title: 'US Consumer Price Index', economic: { id, kind: 'cpi', title: 'US Consumer Price Index', date: at.slice(0, 10), time: '08:30', at, timeZone: 'America/New_York', sourceUrl: 'https://www.bls.gov/schedule/news_release/cpi.htm', sourceSha256: 'b'.repeat(64), verifiedAt: '2026-10-01T00:00:00.000Z', status: 'scheduled', revisions: [] } });
function personal(windowId: string, startUtc: string, endUtc: string, passes: string[], resolved = true): SkyEvent[] {
  const window = { id: windowId, transitBody: 'Mars', natalPoint: 'Sun', aspect: 'trine', startUtc, endUtc, startClipped: false, endClipped: false, exactPassesUtc: passes, peak: { atUtc: passes[0] ?? startUtc }, membershipStatus: 'resolved', exactTopologyStatus: resolved ? 'resolved' : 'uncertain' };
  return (passes.length ? passes : [startUtc]).map((at, i) => ({ ...sky(`personal:${windowId}:${i}`, at), subtype: 'personal-transit', title: 'Mars trine natal Sun', end: endUtc, personal: { sourceId: 'chart-1', window, transitLongitude: 0, natalLongitude: 0, separation: 0, phase: 'applying', natalHouse: null, transitHouse: null, orb: 1 } } as unknown as SkyEvent));
}

describe('trade window contents', () => {
  const events = [
    sky('before', '2026-10-12T00:00:00.000Z'),
    sky('inside', '2026-10-14T00:59:00.000Z'),
    sky('after', '2026-10-17T00:00:00.000Z'),
    sky('retrograde', '2026-10-03T00:00:00.000Z', { family: 'retrograde', end: '2026-11-14T00:00:00.000Z' }),
    economic('economic:cpi', '2026-10-14T12:30:00.000Z'),
    ...personal('mars', '2026-10-13T20:00:00.000Z', '2026-10-20T00:00:00.000Z', ['2026-10-14T13:10:00.000Z', '2026-10-18T00:00:00.000Z']),
    ...personal('uncertain', '2026-10-14T00:00:00.000Z', '2026-10-15T00:00:00.000Z', ['2026-10-14T12:00:00.000Z'], false),
    ...personal('elsewhere', '2026-11-01T00:00:00.000Z', '2026-11-03T00:00:00.000Z', ['2026-11-02T00:00:00.000Z']),
  ];
  const items = tradeWindow(events, START, END);

  it('keeps instants inside the window and spans that overlap it', () => {
    expect(items.map(item => item.event.id)).toEqual(['retrograde', 'personal:mars:0', 'personal:uncertain:0', 'inside', 'economic:cpi']);
    expect(items.find(item => item.event.id === 'retrograde')).toMatchObject({ at: null, kind: 'sky' });
    expect(items.find(item => item.event.id === 'economic:cpi')).toMatchObject({ at: Date.parse('2026-10-14T12:30:00.000Z'), kind: 'economic' });
  });

  it('groups personal contacts by transit window and keeps only exact contacts inside the trade', () => {
    const mars = items.find(item => item.event.id === 'personal:mars:0')!;
    expect(mars).toMatchObject({ kind: 'personal', at: null, from: Date.parse('2026-10-13T20:00:00.000Z') });
    expect(mars.contacts.map(contact => contact.event.id)).toEqual(['personal:mars:0']);
    expect(items.find(item => item.event.id === 'personal:uncertain:0')!.contacts).toEqual([]);
  });

  it('separates whole-window context from timing inside the window', () => {
    expect(items.filter(item => coversWindow(item, START, END)).map(item => item.event.id)).toEqual(['retrograde']);
    expect(tradeWindow(events, END, START)).toEqual([]);
  });

  it('measures how much longer a linked context window is than the trade', () => {
    expect(linkedWindowRatio({ kind: 'personal', id: 'p', sourceId: 'c', from: '2026-08-02T00:00:00.000Z', to: '2026-10-18T00:00:00.000Z' }, START, END)).toBeCloseTo(25.67, 1);
    expect(linkedWindowRatio(undefined, START, END)).toBeNull();
  });

  it('exports one calendar with the trade window and each exact event once, without plan text', () => {
    const ics = windowICS(items, START, END, 'BTC-USD, 72 h', 'setup-1', new Date('2026-10-07T00:00:00Z'));
    expect(ics).toContain('PRODID:-//Zodiacs//Zodiacs Desk//EN\r\n');
    expect(ics).toContain('UID:trade-window%3Asetup-1@zodiacs.org\r\n');
    expect(ics).toContain('DTSTART:20261013T023000Z\r\nDTEND:20261016T023000Z\r\n');
    expect(ics).toContain('SUMMARY:Trade window: BTC-USD\\, 72 h\r\n');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain('UID:personal%3Amars%3A0@zodiacs.org');
    expect(ics).not.toContain('UID:retrograde@');
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  });
});

describe('time display and input', () => {
  it('formats planning times to the minute in the display zone', () => {
    expect(formatMinute(Date.parse('2026-10-14T12:30:00.000Z'), 'Asia/Bangkok')).toBe('Wed, Oct 14, 19:30 GMT+7');
    expect(tickLabel(Date.parse('2026-10-14T00:00:00.000Z'), 'UTC', 'day')).toBe('Wed 14');
    expect(tickLabel(Date.parse('2026-11-01T00:00:00.000Z'), 'UTC', 'month')).toBe('Nov');
    expect(relativeLabel(START, START)).toBe('+0 h');
    expect(relativeLabel(START + 47 * H, START)).toBe('+47 h');
    expect(relativeLabel(START + 48 * H, START)).toBe('+2 d');
    expect(relativeLabel(START + 54 * H, START)).toBe('+2 d 6 h');
  });

  it('finds local midnights with fractional offsets and across a DST change', () => {
    const kathmandu = calendarTicks(Date.parse('2026-10-13T00:00:00.000Z'), Date.parse('2026-10-16T00:00:00.000Z'), 'Asia/Kathmandu');
    expect(kathmandu.unit).toBe('day');
    expect(kathmandu.ticks.map(tick => new Date(tick).toISOString())).toEqual(['2026-10-13T18:15:00.000Z', '2026-10-14T18:15:00.000Z', '2026-10-15T18:15:00.000Z']);
    const newYork = calendarTicks(Date.parse('2026-10-31T12:00:00.000Z'), Date.parse('2026-11-02T12:00:00.000Z'), 'America/New_York');
    expect(newYork.ticks.map(tick => new Date(tick).toISOString())).toEqual(['2026-11-01T04:00:00.000Z', '2026-11-02T05:00:00.000Z']);
    const long = calendarTicks(Date.parse('2026-10-20T00:00:00.000Z'), Date.parse('2026-11-29T00:00:00.000Z'), 'UTC');
    expect(long).toEqual({ unit: 'month', ticks: [Date.parse('2026-11-01T00:00:00.000Z')] });
  });

  it('resolves a planned entry typed in the display zone through the shared resolver', () => {
    expect(plannedEntry('', 'Asia/Bangkok')).toEqual({});
    expect(plannedEntry('2026-10-13T09:30', 'Asia/Bangkok')).toEqual({ at: '2026-10-13T02:30:00.000Z' });
    expect(wallTimeInput(Date.parse('2026-10-13T02:30:00.000Z'), 'Asia/Bangkok')).toBe('2026-10-13T09:30');
    expect(plannedEntry('2026-03-08T02:30', 'America/New_York').note).toContain('skipped by a clock change');
    expect(plannedEntry('2026-11-01T01:30', 'America/New_York')).toMatchObject({ at: '2026-11-01T05:30:00.000Z' });
    expect(plannedEntry('2026-11-01T01:30', 'America/New_York').note).toContain('happens twice');
    expect(plannedEntry('2026-13-40T25:00', 'UTC').error).toContain('date and time');
  });
});
