import { describe, expect, it } from 'vitest';
import type { LunarReturnExportModel } from '../islands/lunar-return/export-model';
import { buildLunarReturnCalendar, lunarReturnCalendarFilename } from './lunar-return-ical';

const model = (overrides: Partial<LunarReturnExportModel> = {}): LunarReturnExportModel => ({
  title: 'Lunar return', instantUtc: '2026-09-24T13:14:15.678Z', referenceUtc: '2026-09-05T10:00:00.000Z',
  engineVersion: 'fixture-engine', wheel: { bodies: [], angles: null, houses: null, aspects: [] },
  reading: [], readingBasis: [], notes: [], ...overrides,
});
const GENERATED = '2026-09-05T10:01:02.000Z';
const unfold = (calendar: string) => calendar.replace(/\r\n[ \t]/g, '');
const property = (calendar: string, name: string) => unfold(calendar).split('\r\n').find((line) => line.startsWith(`${name}:`));

describe('lunar calendar identity and privacy', () => {
  it('marks one UTC instant with an explicit transparent display minute and recorded reference', () => {
    const calendar = buildLunarReturnCalendar(model(), GENERATED);
    // The marker is the return to the whole minute, as its image prints it.
    expect(property(calendar, 'DTSTART')).toBe('DTSTART:20260924T131400Z');
    expect(property(calendar, 'DTSTAMP')).toBe('DTSTAMP:20260905T100102Z');
    expect(property(calendar, 'SUMMARY')).toBe('SUMMARY:Lunar return');
    expect(property(calendar, 'DESCRIPTION')).toContain('one-minute duration is for display only\\, not a duration of the lunar return.');
    expect(property(calendar, 'DESCRIPTION')).toContain('recorded reference: 2026-09-05T10:00:00.000Z.');
    expect(property(calendar, 'DESCRIPTION')).toContain('Calculated return instant\\, to the whole minute: 2026-09-24T13:14:00.000Z.');
    expect(calendar).toContain('TRANSP:TRANSPARENT\r\n'); expect(calendar).toContain('DURATION:PT1M\r\n');
    expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(calendar).not.toMatch(/(?:VALARM|DTEND|RRULE|TRIGGER|RDATE|EXDATE):/);
    expect(lunarReturnCalendarFilename(model())).toBe('zodiacs-lunar-return-20260924T1314Z.ics');
  });
  it('keeps identity across relocation/re-export, one identity per whole minute, and omits reference from UID', () => {
    const initial = buildLunarReturnCalendar(model(), GENERATED);
    const relocated = buildLunarReturnCalendar(model({ wheel: { bodies: [], aspects: [], angles: { asc: 20, mc: 100, ic: 280, dsc: 200 }, houses: null } }), '2026-09-06T00:00:00Z');
    const revisedReference = buildLunarReturnCalendar(model({ referenceUtc: '2026-09-06T00:00:00Z' }), GENERATED);
    expect(property(initial, 'UID')).toBe('UID:lunar-return-20260924T1314Z@zodiacs.org');
    expect(property(relocated, 'UID')).toBe(property(initial, 'UID'));
    expect(property(revisedReference, 'UID')).toBe(property(initial, 'UID'));
    expect(property(relocated, 'DTSTAMP')).not.toBe(property(initial, 'DTSTAMP'));
    // The seconds are never exported: the same minute is the same marker.
    expect(buildLunarReturnCalendar(model({ instantUtc: '2026-09-24T13:14:29.999Z' }), GENERATED)).toBe(initial);
    expect(property(buildLunarReturnCalendar(model({ instantUtc: '2026-09-24T13:14:30.000Z' }), GENERATED), 'UID')).toBe('UID:lunar-return-20260924T1315Z@zodiacs.org');
    // Rounding never puts the return at or before its recorded reference.
    const close = buildLunarReturnCalendar(model({ referenceUtc: '2026-09-24T13:14:10.000Z', instantUtc: '2026-09-24T13:14:20.000Z' }), GENERATED);
    expect(property(close, 'DTSTART')).toBe('DTSTART:20260924T131500Z');
  });
  it('serializes only chosen timestamps and constant copy even when extra fields are supplied', () => {
    const privateText = 'PRIVATE_PERSON London 1989-12-20 11:30 51.5 -0.12';
    const supplied = {
      ...model(), title: 'Lunar return' as const, name: privateText, id: privateText, location: privateText,
      birth: { time: privateText }, notes: [privateText, 'BEGIN:VALARM\r\nTRIGGER:-PT1H'],
      reading: [{ kind: 'moon-house' as const, text: privateText }], readingBasis: [privateText], engineVersion: privateText,
    };
    expect(buildLunarReturnCalendar(supplied, GENERATED)).toBe(buildLunarReturnCalendar(model(), GENERATED));
  });
  it('uses CRLF and UTF-8 folding without changing escaped text', () => {
    const calendar = buildLunarReturnCalendar(model(), GENERATED);
    expect(calendar.endsWith('\r\n')).toBe(true); expect(calendar).toContain('\r\n ');
    expect(calendar.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    for (const line of calendar.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(property(calendar, 'DESCRIPTION')).toContain('\\nNext return after');
  });
  it.each(['invalid', '2026-02-30T00:00:00Z', '2026-09-24T13:14:15', '2026-09-24T13:14:15+00:00', '2026-09-24T13:14:15.67Z'])(
    'rejects invalid UTC timestamps in either role: %s', (value) => {
      expect(() => buildLunarReturnCalendar(model({ instantUtc: value }), GENERATED)).toThrow('Invalid UTC');
      expect(() => buildLunarReturnCalendar(model({ referenceUtc: value }), GENERATED)).toThrow('Invalid UTC');
      expect(() => lunarReturnCalendarFilename(model({ instantUtc: value }))).toThrow('Invalid UTC');
    },
  );
  it('requires the event to follow its reference and rejects invalid generated times', () => {
    for (const referenceUtc of ['2026-09-24T13:14:15.678Z', '2026-09-25T00:00:00Z']) {
      expect(() => buildLunarReturnCalendar(model({ referenceUtc }), GENERATED)).toThrow('must follow');
    }
    expect(() => buildLunarReturnCalendar(model(), 'invalid')).toThrow('Invalid UTC');
    expect(() => buildLunarReturnCalendar(model(), new Date(NaN))).toThrow('Invalid UTC');
  });
});
