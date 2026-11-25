import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { castNatal } from '../../ai-tools/personal/shared';
import { prepareLocalTime, resolveLocalToUtc } from './localToUtc';

describe('the size of a clock change', () => {
  it('comes from the offsets on either side: an hour in New York, half an hour on Lord Howe Island', async () => {
    for (const [date, time, zone, flag, minutes] of [
      ['2021-11-07', '01:30', 'America/New_York', 'dst-fold', 60],
      ['2021-03-14', '02:30', 'America/New_York', 'dst-gap', 60],
      ['1987-03-15', '01:30', 'Australia/Lord_Howe', 'dst-fold', 30],
      ['2010-10-03', '02:15', 'Australia/Lord_Howe', 'dst-gap', 30],
    ] as const) {
      await prepareLocalTime(date, zone);
      const resolved = resolveLocalToUtc(date, time, zone);
      expect(resolved.flags).toContain(flag);
      expect(resolved.jumpMinutes, `${date} ${zone}`).toBe(minutes);
      const natal = await castNatal({ birthDate: date, time, zone }, createLocalTimeModule());
      expect(natal.flags).toContain(flag);
      expect(natal.jumpMinutes).toBe(minutes);
    }
    await prepareLocalTime('2021-07-01', 'America/New_York');
    expect(resolveLocalToUtc('2021-07-01', '12:00', 'America/New_York').jumpMinutes).toBeUndefined();
    expect((await castNatal({ birthDate: '2021-07-01', time: '12:00', zone: 'America/New_York' }, createLocalTimeModule())).jumpMinutes).toBeNull();
  });
});
