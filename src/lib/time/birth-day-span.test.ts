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
    // An ordinary day: 00:00 to 23:59 at UTC+2 (Madrid summer time).
    ['1990-05-03', 'Europe/Madrid', ['1990-05-02T22:00:00.000Z', '1990-05-03T21:59:00.000Z']],
    // Gaza went back from 00:00 on 17 October 2003 to 23:00 on the 16th: the 16th's 23:59 showed twice, and the day
    // ends at the later one (21:59 UTC at UTC+2), not the first (20:59 UTC at UTC+3).
    ['2003-10-16', 'Asia/Gaza', ['2003-10-15T21:00:00.000Z', '2003-10-16T21:59:00.000Z']],
    // St. John's went from 23:00 on 2 May 1920 straight to 00:00 on the 3rd: the day's last minute is 22:59, not a
    // 23:59 the resolver would move into the 3rd.
    ['1920-05-02', 'America/St_Johns', ['1920-05-02T03:30:52.000Z', '1920-05-03T02:29:52.000Z']],
    // São Paulo went from 00:00 on 4 November 2018 straight to 01:00: the day starts at 01:00 (UTC-2).
    ['2018-11-04', 'America/Sao_Paulo', ['2018-11-04T03:00:00.000Z', '2018-11-05T01:59:00.000Z']],
    // The day before Kwajalein skipped 21 August 1993 ends at its own 23:59, before the jump.
    ['1993-08-20', 'Pacific/Kwajalein', ['1993-08-20T12:00:00.000Z', '1993-08-21T11:59:00.000Z']],
  ] as const)('%s in %s, on the page and in the tool alike', async (date, zone, span) => {
    expect(await pageSpan(date, zone)).toEqual(span);
    expect(await toolSpan(date, zone)).toEqual(span);
  });

  it('reads the later pass the real size of the change on, and falls back to 00:00 and 23:59 for a date skipped whole', () => {
    const minute = (time: string) => Date.UTC(2000, 0, 1, Number(time.slice(0, 2)), Number(time.slice(3)));
    // The engine's form of a 30-minute fold (the transition's two offsets), as on Lord Howe Island.
    const folded = (_date: string, time: string): WallReading => (time >= '23:30'
      ? { utc: new Date(minute(time)), flags: ['dst-fold'], jump: { kind: 'fold' }, transition: { offsetBeforeMinutes: 660, offsetAfterMinutes: 630 } }
      : { utc: new Date(minute(time)), flags: [], jump: null, transition: null });
    expect(birthDaySpan('2000-01-01', 'Test/Fold', undefined, folded).map((at) => at.toISOString())).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-02T00:29:00.000Z']);
    const skipped = (_date: string, time: string): WallReading => ({ utc: new Date(minute(time)), flags: ['dst-gap'], jumpMinutes: 1440 });
    expect(birthDaySpan('2000-01-01', 'Test/Gap', undefined, skipped).map((at) => at.toISOString())).toEqual(['2000-01-01T00:00:00.000Z', '2000-01-01T23:59:00.000Z']);
    // The longitude reaches the resolver when given, for a local mean time era.
    const seen: unknown[] = [];
    birthDaySpan('2000-01-01', 'Test/Plain', 34.47, (_date, time, _zone, options) => { seen.push(options); return { utc: new Date(minute(time)), flags: [] }; });
    expect(seen.every((options) => JSON.stringify(options) === '{"longitude":34.47}')).toBe(true);
  });
});
