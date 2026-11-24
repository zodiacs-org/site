import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { birthDayEnds } from '../../ai-tools/personal/shared';
import { birthDaySpan, type WallReading } from './birth-day-span';
import { prepareLocalTime, resolveLocalToUtc } from './localToUtc';

const clock = createLocalTimeModule();

/** The page's reader: the site's resolver, as src/islands/retrograde-for-you/compute.ts reads it. */
async function pageSpan(date: string, zone: string): Promise<string[]> {
  await prepareLocalTime(date, zone);
  return birthDaySpan(date, zone, undefined, resolveLocalToUtc).map((at) => at.toISOString());
}

/** The tool's reader: the compute API's resolver, through birthDayEnds (src/ai-tools/personal/shared.ts). */
const toolSpan = async (date: string, zone: string) => (await birthDayEnds({ birthDate: date, zone }, clock)).map((at) => at.toISOString());

describe('the whole span of an untimed birth date on the birthplace clock', () => {
  it.each([
    // An ordinary day: 00:00 up to the next midnight at UTC+2 (Madrid summer time), every second of 23:59 included.
    ['1990-05-03', 'Europe/Madrid', ['1990-05-02T22:00:00.000Z', '1990-05-03T21:59:59.999Z']],
    // Gaza went back from 00:00 on 17 October 2003 to 23:00 on the 16th: the 16th's 23:59 showed twice, and the day
    // ends at the later one (21:59 UTC at UTC+2), not the first (20:59 UTC at UTC+3).
    ['2003-10-16', 'Asia/Gaza', ['2003-10-15T21:00:00.000Z', '2003-10-16T21:59:59.999Z']],
    // St. John's went from 23:00 on 2 May 1920 straight to 00:00 on the 3rd: the day's last minute is 22:59, not a
    // 23:59 the resolver would move into the 3rd, and the span ends the instant before that jump.
    ['1920-05-02', 'America/St_Johns', ['1920-05-02T03:30:52.000Z', '1920-05-03T02:30:51.999Z']],
    // São Paulo went from 00:00 on 4 November 2018 straight to 01:00: the day starts at 01:00 (UTC-2).
    ['2018-11-04', 'America/Sao_Paulo', ['2018-11-04T03:00:00.000Z', '2018-11-05T01:59:59.999Z']],
    // The day before Kwajalein skipped 21 August 1993 ends at its own 23:59, before the jump.
    ['1993-08-20', 'Pacific/Kwajalein', ['1993-08-20T12:00:00.000Z', '1993-08-21T11:59:59.999Z']],
  ] as const)('%s in %s, on the page and in the tool alike', async (date, zone, span) => {
    expect(await pageSpan(date, zone)).toEqual(span);
    expect(await toolSpan(date, zone)).toEqual(span);
  });

  it('runs up to the instant before the next local midnight, so a Sun ingress at 23:59:28 falls inside the day', async () => {
    // The Sun entered Gemini at 22:59:28 UTC on 20 May 1972, 23:59:28 on the Lagos clock (UTC+1).
    const span = ['1972-05-19T23:00:00.000Z', '1972-05-20T22:59:59.999Z'];
    expect(await pageSpan('1972-05-20', 'Africa/Lagos')).toEqual(span);
    expect(await toolSpan('1972-05-20', 'Africa/Lagos')).toEqual(span);
    expect(Date.parse(span[1])).toBeGreaterThan(Date.parse('1972-05-20T22:59:28Z'));
    // Without a zone the date runs to the instant before midnight at UTC-12.
    expect((await birthDayEnds({ birthDate: '1972-05-20' }, clock)).map((at) => at.toISOString())).toEqual(['1972-05-19T10:00:00.000Z', '1972-05-21T11:59:59.999Z']);
  });

  it('starts and ends at a clock change that falls between whole minutes, so adjacent days meet', async () => {
    // Amsterdam's clocks went from 00:00:00 to 00:00:28 on 1 July 1937 (UTC+1:19:32 to UTC+1:20), at 22:40:28 UTC
    // on the 30th: the 1st starts at that instant, not at its 00:01 (22:41:00 UTC), and the 30th ends just before it.
    const first = ['1937-06-30T22:40:28.000Z', '1937-07-01T22:39:59.999Z'];
    expect(await pageSpan('1937-07-01', 'Europe/Amsterdam')).toEqual(first);
    expect(await toolSpan('1937-07-01', 'Europe/Amsterdam')).toEqual(first);
    const before = ['1937-06-29T22:40:28.000Z', '1937-06-30T22:40:27.999Z'];
    expect(await pageSpan('1937-06-30', 'Europe/Amsterdam')).toEqual(before);
    expect(await toolSpan('1937-06-30', 'Europe/Amsterdam')).toEqual(before);
  });

  it('ends at the change when the clocks skip from the end of the date between whole minutes', () => {
    // A synthetic 10-minute gap from 23:50:20 at UTC+0: 23:51 onward is skipped, 23:50 is shown, and the change is at
    // 23:50:20 UTC, so the day ends at 23:50:19.999 rather than at 23:50:59.999.
    const minute = (time: string) => Date.UTC(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3)));
    const change = new Date(Date.UTC(2000, 0, 1, 23, 50, 20));
    const reader = (_date: string, time: string): WallReading => (time > '23:50'
      ? { utc: new Date(minute(time) - 50 * 60_000), flags: ['dst-gap'], jumpMinutes: 10, transitionAt: change }
      : { utc: new Date(minute(time)), flags: [] });
    expect(birthDaySpan('2000-01-01', 'Test/EndGap', undefined, reader).map((at) => at.toISOString())).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-01T23:50:19.999Z']);
    // A change the resolver reports outside the minute next to the gap is not this gap's: the whole minute stands.
    const stray = (_date: string, time: string): WallReading => ({ ...reader(_date, time), ...(time > '23:50' ? { transitionAt: new Date(0) } : {}) });
    expect(birthDaySpan('2000-01-01', 'Test/EndGap', undefined, stray)[1].toISOString()).toBe('2000-01-01T23:50:59.999Z');
  });

  it('reads the later pass the real size of the change on, and falls back to 00:00 and 23:59 for a date skipped whole', () => {
    const minute = (time: string) => Date.UTC(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3)));
    // The engine's form of a 30-minute fold (the transition's two offsets), as on Lord Howe Island.
    const folded = (_date: string, time: string): WallReading => (time >= '23:30'
      ? { utc: new Date(minute(time)), flags: ['dst-fold'], jump: { kind: 'fold' }, transition: { offsetBeforeMinutes: 660, offsetAfterMinutes: 630 } }
      : { utc: new Date(minute(time)), flags: [], jump: null, transition: null });
    expect(birthDaySpan('2000-01-01', 'Test/Fold', undefined, folded).map((at) => at.toISOString())).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-02T00:29:59.999Z']);
    const skipped = (_date: string, time: string): WallReading => ({ utc: new Date(minute(time)), flags: ['dst-gap'], jumpMinutes: 1440 });
    expect(birthDaySpan('2000-01-01', 'Test/Gap', undefined, skipped).map((at) => at.toISOString())).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-01T23:59:59.999Z']);
    // The longitude reaches the resolver when given, for a local mean time era.
    const seen: unknown[] = [];
    birthDaySpan('2000-01-01', 'Test/Plain', 34.47, (_date, time, _zone, options) => { seen.push(options); return { utc: new Date(minute(time)), flags: [] }; });
    expect(seen.every((options) => JSON.stringify(options) === '{"longitude":34.47}')).toBe(true);
  });
});
