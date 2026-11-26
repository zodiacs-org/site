import { afterEach, describe, expect, it, vi } from 'vitest';
import { saturnReturns, type ReturnSeason } from './engine/returns';
import { CATALOG_LOCALES, t, tf, type CatalogLocale } from './i18n';
import { icalHash } from './ical';
import { downloadCalendarFile } from './ical-download';
import { formatLongitude } from './signs';
import {
  SATURN_RETURN_ALARM,
  SATURN_RETURN_APPROXIMATE_NOTE,
  buildSaturnReturnCalendar,
  saturnReturnCalendarFilename,
  type SaturnReturnCalendarOptions,
} from './saturn-return-ical';

const GENERATED = '2026-11-25T08:00:00Z';
const ORDINALS = ['first', 'second', 'third', 'fourth'] as const;

/** The words the page passes: its own headings and retrograde mark. */
function words(locale: CatalogLocale): SaturnReturnCalendarOptions['words'] {
  return {
    seasons: ORDINALS.map((key) => tf(locale, 'saturnReturnHeading', { ordinal: t(locale, key) })),
    retrograde: t(locale, 'retrogradePass'),
  };
}
const options = (locale: CatalogLocale = 'en', approximate = false): SaturnReturnCalendarOptions => ({
  approximate, generatedAt: GENERATED, locale, words: words(locale),
});

const crossing = (iso: string, retrograde = false) => ({ at: new Date(iso), retrograde });
function season(index: number, ...crossings: ReturnType<typeof crossing>[]): ReturnSeason {
  return { index, crossings, first: crossings[0].at, last: crossings.at(-1)!.at } as ReturnSeason;
}
/** A first return of three passes and a second of one. */
const RESULT = {
  seasons: [
    season(1, crossing('2019-03-21T23:40:12.345Z'), crossing('2019-08-12T04:05:06Z', true), crossing('2019-12-16T10:00:00Z')),
    season(2, crossing('2048-02-03T15:16:17Z')),
  ],
};
/** Its schedule tag: each pass's return, number, UTC date and direction, which its events show. */
const TAG = icalHash(['1:1:20190321:d', '1:2:20190812:r', '1:3:20191216:d', '2:1:20480203:d']);

const lines = (calendar: string) => calendar.split('\r\n').slice(0, -1);
/** Logical lines: physical lines with RFC 5545 folding undone. */
const unfolded = (calendar: string) => calendar.replace(/\r\n /g, '').split('\r\n').slice(0, -1);
const events = (calendar: string) => calendar.split('BEGIN:VEVENT\r\n').slice(1).map((event) => event.split('END:VEVENT')[0]);
const field = (event: string, name: string) => event.replace(/\r\n /g, '').split('\r\n')
  .find((line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Saturn return calendar', () => {
  it('writes one transparent all-day event per crossing, on the UTC date the page prints, with a display alarm', () => {
    const calendar = buildSaturnReturnCalendar(RESULT, options());
    expect(calendar.endsWith('\r\n')).toBe(true);
    expect(calendar.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of lines(calendar)) expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    expect(unfolded(calendar).slice(0, 5)).toEqual([
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zodiacs.org//Saturn Return 1.0//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Saturn return',
    ]);
    expect(calendar).not.toContain('METHOD:');
    expect(unfolded(calendar).at(-1)).toBe('END:VCALENDAR');

    const found = events(calendar);
    expect(found).toHaveLength(4);
    expect(found.map((event) => [field(event, 'DTSTART'), field(event, 'DTEND')])).toEqual([
      ['DTSTART;VALUE=DATE:20190321', 'DTEND;VALUE=DATE:20190322'],
      ['DTSTART;VALUE=DATE:20190812', 'DTEND;VALUE=DATE:20190813'],
      ['DTSTART;VALUE=DATE:20191216', 'DTEND;VALUE=DATE:20191217'],
      ['DTSTART;VALUE=DATE:20480203', 'DTEND;VALUE=DATE:20480204'],
    ]);
    expect(TAG).toMatch(/^[0-9a-f]{16}$/);
    expect(found.map((event) => field(event, 'UID'))).toEqual([
      `UID:saturn-return-${TAG}-1-pass-1-20190321@zodiacs.org`, `UID:saturn-return-${TAG}-1-pass-2-20190812@zodiacs.org`,
      `UID:saturn-return-${TAG}-1-pass-3-20191216@zodiacs.org`, `UID:saturn-return-${TAG}-2-pass-1-20480203@zodiacs.org`,
    ]);
    for (const event of found) {
      expect(field(event, 'DTSTAMP')).toBe('DTSTAMP:20261125T080000Z');
      expect(field(event, 'TRANSP')).toBe('TRANSP:TRANSPARENT');
      expect(event).toContain(`BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:${SATURN_RETURN_ALARM}\r\nDESCRIPTION:`);
      expect(event).toContain('END:VALARM\r\n');
    }
    expect(SATURN_RETURN_ALARM).toBe('-P2DT15H');
  });

  it('names each pass in the page’s words: the return, its pass of three and a retrograde pass', () => {
    const found = events(buildSaturnReturnCalendar(RESULT, options()));
    expect(found.map((event) => field(event, 'SUMMARY'))).toEqual([
      'SUMMARY:Saturn return · First return · 1/3',
      'SUMMARY:Saturn return · First return · 2/3 · retrograde pass',
      'SUMMARY:Saturn return · First return · 3/3',
      'SUMMARY:Saturn return · Second return',
    ]);
    // The alarm says what the event is.
    expect(found[1].replace(/\r\n /g, '')).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:-P2DT15H\r\nDESCRIPTION:Saturn return · First return · 2/3 · retrograde pass\r\nEND:VALARM');
    expect(field(found[1], 'DESCRIPTION')).toBe('DESCRIPTION:Saturn is back where it was at your birth\\, at about 29\\, 58 and 88. The oldest milestone in astrology: a time to take stock and build what lasts.\\n\\nPass 2 of 3.');
    expect(field(found[3], 'DESCRIPTION')).toBe('DESCRIPTION:Saturn is back where it was at your birth\\, at about 29\\, 58 and 88. The oldest milestone in astrology: a time to take stock and build what lasts.');
  });

  it('says the dates and pass counts can change only when they come from a noon reading', () => {
    const approximate = field(events(buildSaturnReturnCalendar(RESULT, options('en', true)))[3], 'DESCRIPTION');
    expect(approximate).toContain('\\n\\nDates computed from a noon reading. With an exact birth time and place\\, these dates can shift and retrograde passes can be added or removed.');
    expect(buildSaturnReturnCalendar(RESULT, options())).not.toContain('noon reading');
  });

  it('links only the general page in the reader’s language, with no query or fragment', () => {
    for (const [locale, expected] of [
      ['en', 'URL:https://zodiacs.org/saturn-return/'],
      ['es', 'URL:https://zodiacs.org/es/saturn-return/'],
      ['pt', 'URL:https://zodiacs.org/pt/saturn-return/'],
      ['fr', 'URL:https://zodiacs.org/fr/saturn-return/'],
      ['it', 'URL:https://zodiacs.org/it/saturn-return/'],
      ['ru', 'URL:https://zodiacs.org/ru/saturn-return/'],
    ] as const) {
      const calendar = buildSaturnReturnCalendar(RESULT, options(locale, true));
      const links = unfolded(calendar).filter((line) => /https?:/.test(line));
      expect(links, locale).toEqual(Array(4).fill(expected));
      expect(calendar, locale).not.toMatch(/[?#]/);
    }
  });

  it('carries no birth details, natal degree or clock time from a real result', () => {
    const birth = new Date('1990-01-04T05:00:00Z');
    const result = saturnReturns(birth);
    expect(result.seasons.length).toBeGreaterThan(1);
    const calendar = buildSaturnReturnCalendar(result, options('en', true));
    const text = unfolded(calendar).join('\n');
    expect(text).not.toMatch(/1990|19900104|0104T|05:00/);
    for (const value of [formatLongitude(result.natalLon), result.natalLon.toFixed(1), Math.floor(result.natalLon % 30) + '°']) {
      expect(text).not.toContain(value);
    }
    expect(text).not.toMatch(/Capricorn|°|′|\bRx\b/);
    // The only clock time is the file's own receipt time.
    expect(unfolded(calendar).filter((line) => /\d{8}T\d{6}Z/.test(line)).every((line) => line.startsWith('DTSTAMP:'))).toBe(true);
    for (const event of events(calendar)) expect(field(event, 'UID')).toMatch(/^UID:saturn-return-[0-9a-f]{16}-[1-9]-pass-[1-9]-\d{8}@zodiacs\.org$/);
    expect(saturnReturnCalendarFilename(result)).toBe('zodiacs-saturn-return.ics');
  });

  it.each(CATALOG_LOCALES)('writes %s in its own words, with no em or en dash', (locale) => {
    const calendar = buildSaturnReturnCalendar(RESULT, options(locale, true));
    expect(calendar).not.toMatch(/[\u2013\u2014]/);
    const summary = field(events(calendar)[1], 'SUMMARY')!;
    expect(summary).toContain(t(locale, 'retrogradePass'));
    expect(summary).toContain(tf(locale, 'saturnReturnHeading', { ordinal: t(locale, 'first') }));
    expect(unfolded(calendar).join('\n').replace(/\\([,;\\])/g, '$1')).toContain(SATURN_RETURN_APPROXIMATE_NOTE[locale]);
  });

  it('is the same file for the same result and receipt time', () => {
    expect(buildSaturnReturnCalendar(RESULT, options())).toBe(buildSaturnReturnCalendar(RESULT, options()));
  });

  it('keeps both passes when a direct and a retrograde crossing share a UTC date, each with its own UID and alarm', () => {
    // A synthetic birth whose first return crosses forward at 12:57 UTC on
    // 2027-08-09 and back at 23:14 UTC the same day; the page lists both.
    const result = saturnReturns(new Date('1998-11-24T01:47:00Z'));
    const first = result.seasons[0];
    expect(first.crossings.map((pass) => [pass.at.toISOString().slice(0, 10), pass.retrograde])).toEqual([
      ['2027-08-09', false], ['2027-08-09', true], ['2028-03-27', false],
    ]);
    const calendar = buildSaturnReturnCalendar(result, options('en', true));
    const found = events(calendar);
    const passes = result.seasons.reduce((total, { crossings }) => total + crossings.length, 0);
    expect(found).toHaveLength(passes);
    expect(calendar.match(/BEGIN:VALARM\r\n/g)).toHaveLength(passes);
    const uids = found.map((event) => field(event, 'UID'));
    expect(new Set(uids).size).toBe(passes);

    const sameDay = found.filter((event) => field(event, 'DTSTART') === 'DTSTART;VALUE=DATE:20270809');
    const tag = /^UID:saturn-return-([0-9a-f]{16})-/.exec(field(found[0], 'UID')!)![1];
    expect(sameDay.map((event) => [field(event, 'UID'), field(event, 'DTEND'), field(event, 'SUMMARY')])).toEqual([
      [`UID:saturn-return-${tag}-1-pass-1-20270809@zodiacs.org`, 'DTEND;VALUE=DATE:20270810', 'SUMMARY:Saturn return · First return · 1/3'],
      [`UID:saturn-return-${tag}-1-pass-2-20270809@zodiacs.org`, 'DTEND;VALUE=DATE:20270810', 'SUMMARY:Saturn return · First return · 2/3 · retrograde pass'],
    ]);
    for (const event of sameDay) {
      expect(field(event, 'TRANSP')).toBe('TRANSP:TRANSPARENT');
      expect(event.replace(/\r\n /g, '')).toContain(`BEGIN:VALARM\r\nACTION:DISPLAY\r\nTRIGGER:${SATURN_RETURN_ALARM}\r\nDESCRIPTION:${field(event, 'SUMMARY')!.slice('SUMMARY:'.length)}\r\nEND:VALARM`);
    }

    // No clock time of either crossing, and nothing of the birth: the only clock time is the receipt's.
    const text = unfolded(calendar).join('\n');
    expect(text).not.toMatch(/12:57|23:14|1257|2314|1998|19981124|01:47/);
    expect(unfolded(calendar).filter((line) => /\d{8}T\d{6}/.test(line)).every((line) => line.startsWith('DTSTAMP:'))).toBe(true);
    expect(text).not.toContain(formatLongitude(result.natalLon));
    expect(saturnReturnCalendarFilename(result)).toBe('zodiacs-saturn-return.ics');
  });

  it('keeps two people’s passes apart when they share a return, a pass number and a UTC date', () => {
    // Two synthetic births a day apart: their schedules differ, but each crosses
    // forward for the third time on 2086-06-23, the first pass of the third return.
    const [first, second] = ['1998-11-18T12:00:00Z', '1998-11-19T12:00:00Z'].map((iso) => saturnReturns(new Date(iso)));
    const passes = (result: ReturnType<typeof saturnReturns>) => result.seasons
      .map(({ index, crossings }) => [index, crossings.map((pass) => [pass.at.toISOString().slice(0, 10), pass.retrograde])]);
    expect(passes(first)).toEqual([
      [1, [['2028-03-30', false]]], [2, [['2057-05-05', false]]],
      [3, [['2086-06-23', false], ['2086-09-29', true], ['2087-03-13', false]]],
    ]);
    expect(passes(second)).toEqual([
      [1, [['2028-03-29', false]]], [2, [['2057-05-04', false]]],
      [3, [['2086-06-23', false], ['2086-09-30', true], ['2087-03-12', false]]],
    ]);
    const shared = (result: ReturnType<typeof saturnReturns>) => {
      const calendar = buildSaturnReturnCalendar(result, options('en', true));
      const event = events(calendar).find((entry) => field(entry, 'DTSTART') === 'DTSTART;VALUE=DATE:20860623')!;
      return { calendar, uid: field(event, 'UID')!, summary: field(event, 'SUMMARY') };
    };
    const [a, b] = [shared(first), shared(second)];
    // The same event as each file shows it, under different UIDs, so a calendar that holds both keeps both.
    expect(a.summary).toBe('SUMMARY:Saturn return · Third return · 1/3');
    expect(b.summary).toBe(a.summary);
    expect(a.uid).toMatch(/^UID:saturn-return-[0-9a-f]{16}-3-pass-1-20860623@zodiacs\.org$/);
    expect(b.uid).toMatch(/^UID:saturn-return-[0-9a-f]{16}-3-pass-1-20860623@zodiacs\.org$/);
    expect(a.uid).not.toBe(b.uid);
    // No UID repeats across the two files.
    const uids = [a.calendar, b.calendar].flatMap((calendar) => events(calendar).map((event) => field(event, 'UID')));
    expect(new Set(uids).size).toBe(uids.length);
    // The same schedule gives the same UIDs every time, whatever the file's receipt time or language.
    expect(shared(first).uid).toBe(a.uid);
    const later = buildSaturnReturnCalendar(first, { ...options('fr', false), generatedAt: '2027-01-02T03:04:05Z' });
    expect(events(later).map((event) => field(event, 'UID'))).toEqual(events(a.calendar).map((event) => field(event, 'UID')));
    // The tag comes from the schedule the file shows, never from the birth.
    expect(a.uid).toContain(icalHash(['1:1:20280330:d', '2:1:20570505:d', '3:1:20860623:d', '3:2:20860929:r', '3:3:20870313:d']));
    for (const { calendar } of [a, b]) {
      const text = unfolded(calendar).join('\n');
      expect(text).not.toMatch(/1998|19981118|19981119|1118|1119|12:00/);
      expect(unfolded(calendar).filter((line) => /\d{8}T\d{6}/.test(line)).every((line) => line.startsWith('DTSTAMP:'))).toBe(true);
    }
    expect(unfolded(a.calendar).join('\n')).not.toContain(formatLongitude(first.natalLon));
    expect(unfolded(b.calendar).join('\n')).not.toContain(formatLongitude(second.natalLon));
  }, 30_000);

  it('refuses an empty or invalid result and an invalid receipt time', () => {
    const invalid = [
      { seasons: [] },
      { seasons: [season(1, crossing('not a date'))] },
      { seasons: [{ ...season(1, crossing('2019-03-21T00:00:00Z')), index: 0 }] },
      { seasons: [{ ...season(1, crossing('2019-03-21T00:00:00Z')), crossings: [] }] },
      { seasons: [season(1, { at: new Date('2019-03-21T00:00:00Z'), retrograde: 'yes' as unknown as boolean })] },
      { seasons: [season(1, crossing('+010000-01-01T00:00:00Z'))] },
      // Two returns numbered alike would give their passes the same UIDs.
      { seasons: [season(1, crossing('2019-03-21T00:00:00Z')), season(1, crossing('2048-02-03T00:00:00Z'))] },
    ];
    for (const result of invalid) {
      expect(() => buildSaturnReturnCalendar(result as typeof RESULT, options())).toThrow(RangeError);
      expect(() => saturnReturnCalendarFilename(result as typeof RESULT)).toThrow(RangeError);
    }
    expect(() => buildSaturnReturnCalendar(RESULT, { ...options(), generatedAt: 'not a date' })).toThrow(RangeError);
    expect(() => buildSaturnReturnCalendar(RESULT, { ...options(), words: { ...words('en'), seasons: ['First return'] } })).toThrow(RangeError);
  });

  it('downloads on this device without a network request', async () => {
    const fetch = vi.fn(), sendBeacon = vi.fn(), XMLHttpRequest = vi.fn();
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('XMLHttpRequest', XMLHttpRequest);
    vi.stubGlobal('navigator', { sendBeacon });
    const link = { href: '', download: '', click: vi.fn() };
    vi.stubGlobal('document', { createElement: vi.fn(() => link) });
    const blobs: Blob[] = [];
    const created = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { blobs.push(blob as Blob); return 'blob:local'; });
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      const calendar = buildSaturnReturnCalendar(RESULT, options());
      downloadCalendarFile(calendar, saturnReturnCalendarFilename(RESULT));
      vi.runAllTimers();
      expect(link).toMatchObject({ href: 'blob:local', download: 'zodiacs-saturn-return.ics' });
      expect(link.click).toHaveBeenCalledOnce();
      expect(created).toHaveBeenCalledOnce();
      expect(revoked).toHaveBeenCalledWith('blob:local');
      expect(blobs[0].type).toBe('text/calendar;charset=utf-8');
      expect(await blobs[0].text()).toBe(calendar);
      for (const request of [fetch, sendBeacon, XMLHttpRequest]) expect(request).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
