import { afterEach, describe, expect, it, vi } from 'vitest';
import moonDistances from '../data/moon-distances.json';
import { eventsCatalog } from './events/catalog';
import { eventsPublication } from './events/site-publication';
import { formatIcalUtc } from './ical';
import {
  HEADS_UP_FAMILIES,
  HEADS_UP_LOOKBACK_MS,
  headsUpCalendar,
  headsUpFeed,
  headsUpJson,
  type HeadsUpFeed,
} from './sky-heads-up';
import { moonDistanceLunation, supermoon } from './supermoon';
import { GET as icsRoute, prerender as icsPrerender } from '../pages/sky-calendar-heads-up.ics';
import { GET as jsonRoute, prerender as jsonPrerender } from '../pages/sky-calendar-heads-up.json';

const HOUR = 3_600_000;
/** The day the feed is first published: every later build covers fewer events. */
const FIRST_BUILD = new Date('2026-11-12T00:00:00Z');
/** A build early enough that every timeline row is in the window. */
const ALL = new Date(Date.parse(eventsPublication.window.from) + HEADS_UP_LOOKBACK_MS);

interface Entry { uid: string; start: string; summary: string; lines: string[] }

const unfold = (ics: string) => ics.replace(/\r\n /g, '');

function entries(ics: string): Entry[] {
  return unfold(ics).split('BEGIN:VEVENT\r\n').slice(1).map((block) => {
    const lines = block.split('END:VEVENT')[0]!.split('\r\n').filter(Boolean);
    const field = (name: string) => lines.find((line) => line.startsWith(`${name}:`))!.slice(name.length + 1);
    return { uid: field('UID'), start: field('DTSTART'), summary: field('SUMMARY'), lines };
  });
}

const parseIcalUtc = (value: string) => Date.parse(
  `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`,
);

afterEach(() => {
  vi.useRealTimers();
});

describe('heads-up times', () => {
  const feed = headsUpFeed(ALL);
  const ics = headsUpCalendar(feed);
  const json = JSON.parse(headsUpJson(feed)) as HeadsUpFeed;

  it('carries every timeline row, of the major families only', () => {
    expect(feed.events.map((event) => event.id).sort()).toEqual(eventsPublication.timeline.map((row) => row.id).sort());
    expect(new Set(feed.events.map((event) => event.family))).toEqual(new Set(HEADS_UP_FAMILIES));
  });

  it('gives each event the time its page prints, in the calendar and the JSON alike', () => {
    const catalog = eventsCatalog();
    const starts = new Map(entries(ics).map((entry) => [entry.uid, entry.start]));
    const jsonById = new Map(json.events.map((event) => [event.id, event]));
    for (const event of feed.events) {
      const facts = catalog.byId.get(event.id)?.facts as { at?: string; start?: string } | undefined;
      expect(facts, event.id).toBeDefined();
      const page = new Date((facts!.at ?? facts!.start)!).toISOString();
      expect(event.at, event.id).toBe(page);
      expect(jsonById.get(event.id)?.at, event.id).toBe(page);
      expect(starts.get(`sky-heads-up-${event.id}-event@zodiacs.org`), event.id).toBe(formatIcalUtc(page));
    }
  });

  it('uses NASA JPL Horizons instants where the pages do', () => {
    // Uranus trine Pluto: NASA has 11:22:49 UTC; the publication keeps the engine's instant.
    const event = feed.events.find((e) => e.id.startsWith('uranus-trine-pluto-2026-11-'));
    expect(event?.at.slice(0, 19)).toBe('2026-11-29T11:22:49');
    const row = eventsPublication.timeline.find((r) => r.id === event!.id)!;
    expect(row.anchor).not.toBe(event!.at);
  });

  it('gives each event exactly three entries: the event, 72 hours before and 24 hours before', () => {
    const all = entries(ics);
    expect(all).toHaveLength(feed.events.length * 3);
    const byUid = new Map(all.map((entry) => [entry.uid, entry]));
    for (const event of feed.events) {
      const at = parseIcalUtc(byUid.get(`sky-heads-up-${event.id}-event@zodiacs.org`)!.start);
      const minus72 = byUid.get(`sky-heads-up-${event.id}-minus-72h@zodiacs.org`)!;
      const minus24 = byUid.get(`sky-heads-up-${event.id}-minus-24h@zodiacs.org`)!;
      expect(at - parseIcalUtc(minus72.start)).toBe(72 * HOUR);
      expect(at - parseIcalUtc(minus24.start)).toBe(24 * HOUR);
      expect(minus72.summary).toBe(`In 3 days: ${event.title}`.replace(/[,;\\]/g, (c) => `\\${c}`));
      expect(minus24.summary).toBe(`Tomorrow: ${event.title}`.replace(/[,;\\]/g, (c) => `\\${c}`));
      expect(event.headsUp).toEqual([
        new Date(Date.parse(event.at) - 72 * HOUR).toISOString(),
        new Date(Date.parse(event.at) - 24 * HOUR).toISOString(),
      ]);
    }
  });

  it('carries no alarms', () => {
    expect(ics).not.toContain('VALARM');
    expect(ics).not.toContain('TRIGGER');
  });

  it('gives the Moon distance on lunations only, from moon-distances.json', () => {
    const km = new Map(moonDistances.lunations.map((l) => [l.at, l.distanceKm]));
    for (const event of json.events) {
      if (event.family === 'lunation') expect(event.moonDistanceKm, event.id).toBe(km.get(event.at));
      else expect(event).not.toHaveProperty('moonDistanceKm');
    }
    expect(json.events.find((e) => e.id === 'full-moon-2026-11-24')?.moonDistanceKm).toBe(360764);
  });

  it('marks supermoons under src/lib/supermoon.ts: full Moons only, in the title, the description and the JSON', () => {
    const byUid = new Map(entries(ics).map((entry) => [entry.uid, entry]));
    let marked = 0;
    for (const event of json.events) {
      const row = moonDistanceLunation(event.subtype, eventsPublication.timeline.find((r) => r.id === event.id)!.anchor);
      const expected = event.family === 'lunation' ? supermoon(row!) : null;
      const description = unfold(byUid.get(`sky-heads-up-${event.id}-event@zodiacs.org`)!.lines.find((l) => l.startsWith('DESCRIPTION:'))!);
      if (expected) {
        marked += 1;
        expect(event.subtype, event.id).toBe('full');
        expect(event.supermoon, event.id).toEqual(expected);
        expect(event.title, event.id).toMatch(/^Full moon in \w+, .+ \(supermoon\)$/u);
        expect(description, event.id).toContain('It counts as a supermoon because it is full within 10%');
        expect(byUid.get(`sky-heads-up-${event.id}-minus-24h@zodiacs.org`)!.summary, event.id).toContain('(supermoon)');
      } else {
        expect(event, event.id).not.toHaveProperty('supermoon');
        expect(event.title, event.id).not.toMatch(/supermoon/iu);
        expect(description, event.id).not.toMatch(/supermoon/iu);
      }
      if (event.family === 'lunation') expect(description, event.id).toContain(`The Moon is ${event.moonDistanceKm!.toLocaleString('en-US').replace(/,/g, '\\,')} km from Earth\\, center to center.`);
    }
    expect(marked).toBeGreaterThan(5);
    expect(json.events.filter((e) => e.subtype === 'new' && e.supermoon)).toEqual([]);
  });

  it('marks the 24 November and 24 December 2026 full Moons, with their distances in km', () => {
    const nov = json.events.find((e) => e.id === 'full-moon-2026-11-24')!;
    expect(nov.title).toBe('Full moon in Gemini, November 24, 2026 (supermoon)');
    expect(nov.supermoon).toMatchObject({ distanceKm: 360764, rule: 'within 10% of the perigee to apogee range', perigee: { distanceKm: 359345 }, apogee: { distanceKm: 405618 } });
    const dec = json.events.find((e) => e.id === 'full-moon-2026-12-24')!;
    expect(dec.title).toMatch(/\(supermoon\)$/u);
    expect(dec.supermoon?.distanceKm).toBe(356739);
    const description = unfold(ics).split('BEGIN:VEVENT\r\n').find((block) => block.includes('UID:sky-heads-up-full-moon-2026-11-24-event@'))!;
    expect(description).toContain('SUMMARY:Full moon in Gemini\\, November 24\\, 2026 (supermoon)');
    expect(description).toContain('The Moon is 360\\,764 km from Earth\\, center to center. It counts as a supermoon because it is full within 10% of the way from this orbit’s closest point (perigee) to its farthest (apogee).');
    expect(unfold(ics)).toContain('SUMMARY:Tomorrow: Full moon in Gemini\\, November 24\\, 2026 (supermoon)');
    for (const text of [nov.title, dec.title, description]) expect(text).not.toMatch(/[\u2012-\u2015]/u);
    // A far full Moon carries its distance and no mark.
    const far = json.events.find((e) => e.id === 'full-moon-2026-10-26')!;
    expect(far.moonDistanceKm).toBe(368870);
    expect(far.title).not.toMatch(/supermoon/iu);
    expect(far).not.toHaveProperty('supermoon');
  });
});

describe('heads-up identity and bounds', () => {
  it('keeps UIDs unique and unchanged across builds on different dates', () => {
    const early = entries(headsUpCalendar(headsUpFeed(new Date('2026-11-12T03:00:00Z'))));
    const late = entries(headsUpCalendar(headsUpFeed(new Date('2027-06-30T21:00:00Z'))));
    for (const list of [early, late]) expect(new Set(list.map((e) => e.uid)).size).toBe(list.length);
    const earlyUids = new Set(early.map((e) => e.uid));
    const shared = late.filter((e) => earlyUids.has(e.uid));
    expect(shared.length).toBe(late.length);
    for (const entry of early) {
      expect(entry.uid).toMatch(/^sky-heads-up-[a-z0-9-]+-(?:event|minus-72h|minus-24h)@zodiacs\.org$/u);
    }
  });

  it('runs from a week before the build to the end of the publication', () => {
    const now = new Date('2027-03-10T12:00:00Z');
    const feed = headsUpFeed(now);
    expect(feed.coverageEnd).toBe('2031-01-01T00:00:00.000Z');
    const from = now.getTime() - 7 * 24 * HOUR;
    const everyAt = new Map(headsUpFeed(ALL).events.map((e) => [e.id, e.at]));
    const expected = eventsPublication.timeline.filter((row) => {
      const at = Date.parse(everyAt.get(row.id)!);
      return at >= from && at < Date.parse(feed.coverageEnd);
    });
    expect(feed.events.map((e) => e.id).sort()).toEqual(expected.map((r) => r.id).sort());
    expect(feed.events.every((e) => Date.parse(e.at) >= from)).toBe(true);
  });

  it('writes RFC 5545 lines: CRLF endings and folding at 75 octets', () => {
    const ics = headsUpCalendar(headsUpFeed(FIRST_BUILD));
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/u);
    const encoder = new TextEncoder();
    const physical = ics.split('\r\n').slice(0, -1);
    for (const line of physical) expect(encoder.encode(line).byteLength).toBeLessThanOrEqual(75);
    expect(physical.some((line) => line.startsWith(' '))).toBe(true);
    expect(physical[0]).toBe('BEGIN:VCALENDAR');
    expect(physical).toContain('REFRESH-INTERVAL;VALUE=DURATION:P1D');
    expect(physical.at(-1)).toBe('END:VCALENDAR');
  });

  it('stays under 300 KB from its first build on', () => {
    for (const now of [FIRST_BUILD, new Date()]) {
      const bytes = new TextEncoder().encode(headsUpCalendar(headsUpFeed(now))).byteLength;
      expect(bytes).toBeLessThan(300 * 1024);
    }
  });

  it('writes the JSON shape the routine reads', () => {
    const json = JSON.parse(headsUpJson(headsUpFeed(FIRST_BUILD)));
    expect(Object.keys(json)).toEqual(['generatedAt', 'coverageEnd', 'events']);
    expect(json.generatedAt).toBe('2026-11-12T00:00:00.000Z');
    for (const event of json.events) {
      const keys = ['id', 'family', 'subtype', 'title', 'summary', 'at', 'path', 'url', 'headsUp'];
      const lunation = event.supermoon ? [...keys, 'moonDistanceKm', 'supermoon'] : [...keys, 'moonDistanceKm'];
      expect(Object.keys(event)).toEqual(event.family === 'lunation' ? lunation : keys);
      if (event.supermoon) expect(Object.keys(event.supermoon)).toEqual(['distanceKm', 'rule', 'perigee', 'apogee']);
      expect(event.url).toBe(`https://zodiacs.org${event.path}`);
      expect(event.path.startsWith('/')).toBe(true);
    }
  });
});

describe('heads-up routes', () => {
  it('are prerendered and read nothing from the request', async () => {
    expect(icsPrerender).toBe(true);
    expect(jsonPrerender).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-12T08:00:00Z'));
    const bare = {} as Parameters<typeof icsRoute>[0];
    const loaded = {
      params: { birthDate: '1990-01-01', name: 'Someone' },
      url: new URL('https://zodiacs.org/sky-calendar-heads-up.ics?birth=1990-01-01&place=Paris&name=Someone'),
      request: new Request('https://zodiacs.org/sky-calendar-heads-up.ics?birth=1990-01-01', { headers: { cookie: 'name=Someone' } }),
    } as unknown as Parameters<typeof icsRoute>[0];
    for (const route of [icsRoute, jsonRoute]) {
      const a = await (await route(bare)).text();
      const b = await (await route(loaded)).text();
      expect(b).toBe(a);
      expect(a).not.toMatch(/1990|Paris|Someone/u);
    }
    const ics = await icsRoute(bare);
    expect(ics.headers.get('Content-Type')).toBe('text/calendar; charset=utf-8');
    expect((await jsonRoute(bare)).headers.get('Content-Type')).toBe('application/json; charset=utf-8');
  });
});
