import { describe, expect, it } from 'vitest';
import type { SolarReturnExportModel } from '../islands/solar-return/export-model';
import { buildSolarReturnCalendar, solarReturnCalendarFilename } from './solar-return-ical';

const GENERATED_AT = '2026-09-05T08:00:00Z';
const CRLF = '\r\n';

function model(overrides: Partial<SolarReturnExportModel> = {}): SolarReturnExportModel {
  return {
    returnYear: 2026,
    instantUtc: '2026-07-06T12:34:56.789Z',
    title: 'Solar return',
    noTime: false,
    noPlace: false,
    engineVersion: 'test-engine',
    wheel: { bodies: [], angles: null, houses: null, aspects: [] },
    reading: [], readingBasis: [], notes: [],
    ...overrides,
  };
}

const unfold = (calendar: string) => calendar.replace(/\r\n[ \t]/g, '');
const property = (calendar: string, name: string) => unfold(calendar).split(CRLF)
  .find((line) => line.startsWith(`${name}:`));

describe('Solar Return calendar handoff', () => {
  it('exports one transparent UTC marker with a one-minute display duration', () => {
    const calendar = buildSolarReturnCalendar(model(), new Date(GENERATED_AT));
    const lines = unfold(calendar).split(CRLF);
    expect(lines.slice(0, 4)).toEqual([
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'PRODID:-//Zodiacs.org//Solar Return 1.0//EN', 'CALSCALE:GREGORIAN',
    ]);
    expect(lines.filter((line) => line === 'BEGIN:VEVENT')).toHaveLength(1);
    expect(lines.filter((line) => line === 'END:VEVENT')).toHaveLength(1);
    expect(lines).toContain('DTSTAMP:20260905T080000Z');
    // The marker is the return to the whole minute, as its image prints it.
    expect(lines).toContain('DTSTART:20260706T123500Z');
    expect(lines).toContain('DURATION:PT1M');
    expect(lines).toContain('TRANSP:TRANSPARENT');
    expect(lines).toContain('SUMMARY:Solar return · 2026');
    expect(lines).toContain('URL:https://zodiacs.org/solar-return/');
    expect(property(calendar, 'DESCRIPTION')).toContain('Calendar marker');
    expect(property(calendar, 'DESCRIPTION')).toContain('one-minute duration is for display only');
    expect(lines.some((line) => /^(?:DTEND|RRULE|RDATE|EXDATE|TRIGGER|REPEAT):/.test(line))).toBe(false);
    expect(calendar).not.toContain('BEGIN:VALARM');
    expect(solarReturnCalendarFilename(model())).toBe('zodiacs-solar-return-2026.ics');
  });

  it('labels unknown birth time in the summary and keeps the selected year across a UTC-year boundary', () => {
    const approximate = model({
      returnYear: 2027,
      instantUtc: '2026-12-31T23:59:45Z',
      noTime: true,
      // Uncertainty is authoritative even if a caller retains an old title.
      title: 'Solar return',
    });
    const calendar = buildSolarReturnCalendar(approximate, GENERATED_AT);
    expect(property(calendar, 'SUMMARY')).toBe('SUMMARY:Approximate solar return · 2027');
    expect(property(calendar, 'DTSTART')).toBe('DTSTART:20270101T000000Z');
    expect(property(calendar, 'UID')).toContain('solar-return-2027-20270101T000000000Z@zodiacs.org');
    expect(property(calendar, 'DESCRIPTION')).toContain('The return instant can shift by hours with your exact birth time.');
    expect(solarReturnCalendarFilename(approximate)).toBe('zodiacs-approximate-solar-return-2027.ics');
  });

  it('does not mark a known-time unlocated return as approximate', () => {
    const located = buildSolarReturnCalendar(model(), GENERATED_AT);
    const unlocated = buildSolarReturnCalendar(model({ noPlace: true }), GENERATED_AT);
    expect(unlocated).toBe(located);
    expect(unlocated).not.toContain('Approximate');
    expect(unlocated).not.toContain('shift by hours');
  });

  it('keeps a UID across repeated exports while updating the receipt timestamp', () => {
    const first = buildSolarReturnCalendar(model(), GENERATED_AT);
    const later = buildSolarReturnCalendar(model(), '2026-09-06T08:00:00Z');
    expect(property(first, 'UID')).toBe(property(later, 'UID'));
    expect(property(first, 'DTSTAMP')).not.toBe(property(later, 'DTSTAMP'));
    // One identity per whole minute: the seconds are never exported.
    const sameMinute = buildSolarReturnCalendar(model({ instantUtc: '2026-07-06T12:35:29.999Z' }), GENERATED_AT);
    expect(sameMinute).toBe(first);
    const distinct = buildSolarReturnCalendar(model({ instantUtc: '2026-07-06T12:35:30.000Z' }), GENERATED_AT);
    expect(property(distinct, 'UID')).not.toBe(property(first, 'UID'));
    expect(property(distinct, 'DTSTART')).toBe('DTSTART:20260706T123600Z');
  });

  it('escapes description text and folds UTF-8 content into CRLF lines of at most 75 octets', () => {
    const calendar = buildSolarReturnCalendar(model({ noTime: true }), GENERATED_AT);
    expect(calendar.endsWith(CRLF)).toBe(true);
    expect(calendar.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    expect(calendar).toContain(`${CRLF} `);
    for (const line of calendar.slice(0, -CRLF.length).split(CRLF)) {
      expect(new TextEncoder().encode(line).byteLength).toBeLessThanOrEqual(75);
    }
    expect(property(calendar, 'DESCRIPTION')).toBe(
      'DESCRIPTION:Calendar marker — the one-minute duration is for display only\\, not a duration of the solar return.'
      + '\\nThe return instant can shift by hours with your exact birth time.',
    );
  });

  it('never copies free-form model text or extra birth/profile data into the event', () => {
    const sensitive = 'Private Person, London; 1907-07-06 08:30 51.5074 -0.1278';
    const supplied = {
      ...model(),
      name: sensitive,
      birth: { date: '1907-07-06', time: '08:30', latitude: 51.5074, longitude: -0.1278 },
      location: sensitive,
      notes: [sensitive, 'BEGIN:VALARM\r\nTRIGGER:-PT1H'],
      reading: [{ kind: 'planets-only' as const, text: sensitive }],
      readingBasis: [sensitive],
      engineVersion: sensitive,
    };
    const calendar = buildSolarReturnCalendar(supplied, GENERATED_AT);
    expect(calendar).toBe(buildSolarReturnCalendar(model(), GENERATED_AT));
    for (const forbidden of ['Private Person', 'London', '1907-07-06', '08:30', '51.5074', '-0.1278', 'LOCATION:', 'GEO:', 'ATTENDEE:', 'ORGANIZER:', 'BEGIN:VALARM']) {
      expect(calendar).not.toContain(forbidden);
    }
  });

  it.each(['invalid', '2026-07-06T12:34:56', '2026-07-06T14:34:56+02:00', '2026-02-30T12:00:00Z'])(
    'rejects a malformed, timezone-free, or normalized-invalid return instant: %s',
    (instantUtc) => expect(() => buildSolarReturnCalendar(model({ instantUtc }), GENERATED_AT)).toThrow('Invalid UTC'),
  );

  it('rejects invalid receipt times and return years instead of exporting malformed calendar data', () => {
    expect(() => buildSolarReturnCalendar(model(), 'invalid')).toThrow('Invalid UTC');
    expect(() => buildSolarReturnCalendar(model(), new Date(NaN))).toThrow('Invalid UTC');
    expect(() => buildSolarReturnCalendar(model({ returnYear: NaN }), GENERATED_AT)).toThrow('Invalid solar return year');
    expect(() => solarReturnCalendarFilename(model({ returnYear: 2026.5 }))).toThrow('Invalid solar return year');
  });
});
