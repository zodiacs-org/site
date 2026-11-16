import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import sky from '../../data/sky.json';
import { siteVoidOfCourseWindows } from '../../data/void-of-course';
import { moonPhase } from '@zodiacs/engine';
import { GOAL_RULES, GOOD_DAYS_NOTE, GOOD_DAY_GOALS, isMedicalGoal } from './goals';
import { GOOD_DAYS_FIRST, GOOD_DAYS_LAST, UNDER_13_SENTENCE, UNDER_18_PARTNERSHIP_SENTENCE, findGoodDays, goodDaysWindow, phaseBand, voidPeriods } from './find';
import { scanTransitContacts, type TransitContact } from '../engine/transit-scan';
import { UNTIMED_DROPPED_MESSAGE, pairUntimedContacts, personalFactors, preparePersonal, type BirthDetails, type PersonalDay } from './personal';

const clock = createLocalTimeModule();
afterAll(() => clock.dispose());
const TODAY = '2026-11-09';
/** Each test here runs the real ephemeris over weeks or months of days: seconds locally, more on a loaded CI runner. */
const TIMEOUT = 30_000;
const DAY = 86_400_000;
const daysApart = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

describe('the void-of-course Moon', { timeout: TIMEOUT }, () => {
  it('gives the site calendar\'s periods to the second (src/data/void-of-course.ts)', () => {
    const from = new Date('2027-01-01T00:00:00Z');
    const to = new Date('2027-04-01T00:00:00Z');
    const ours = voidPeriods(from, to);
    const site = siteVoidOfCourseWindows(from, to);
    expect(ours.length).toBe(site.length);
    ours.forEach((period, index) => {
      expect(Math.abs(period.from.getTime() - site[index].from.getTime())).toBeLessThan(1000);
      expect(Math.abs(period.to.getTime() - site[index].to.getTime())).toBeLessThan(1000);
      expect(period.sign).toBe(site[index].sign);
      expect(period.nextSign).toBe(site[index].nextSign);
    });
  });
});

describe('known answers', { timeout: TIMEOUT }, () => {
  it('finds Mercury retrograde in 2027 where the almanacs put it: 9 February to 3 March (UTC)', async () => {
    const result = await findGoodDays({ goal: 'contract', from: '2027-01-15', to: '2027-03-31', zone: 'UTC', today: TODAY }, clock);
    const mercury = result.periods.filter((period) => period.kind === 'mercury-retrograde');
    expect(mercury).toHaveLength(1);
    // The committed sky data, which the retrogrades page prints: 2027-02-09T17:35Z to 2027-03-03T12:35Z.
    const committed = (sky.retrogrades as { planet: string; from: string; to: string }[]).find((row) => row.planet === 'Mercury' && row.from.startsWith('2027-02'))!;
    // A day counts as retrograde from the noon on which Mercury is moving backward.
    expect(mercury[0].from).toBe('2027-02-10');
    expect(mercury[0].to).toBe('2027-03-03');
    expect(committed.from.slice(0, 10)).toBe('2027-02-09');
    expect(committed.to.slice(0, 10)).toBe('2027-03-03');
    // The station days themselves are named as days to avoid, and no best day falls while Mercury is retrograde.
    expect(result.avoid.map((day) => day.date)).toEqual(expect.arrayContaining(['2027-02-09', '2027-03-03']));
    expect(result.avoid.find((day) => day.date === '2027-02-09')!.reason).toBe('Mercury stands still today and turns retrograde: tradition keeps important beginnings away from a station day.');
    for (const day of result.best) expect(day.date < '2027-02-09' || day.date > '2027-03-03').toBe(true);
  });

  it('reads Venus retrograde, 3 October to 13 November 2026, against a wedding', async () => {
    const result = await findGoodDays({ goal: 'wedding', from: '2026-09-01', to: '2026-12-31', zone: 'UTC', today: TODAY }, clock);
    const venus = result.periods.find((period) => period.kind === 'venus-retrograde')!;
    expect(venus.from).toBe('2026-10-03');
    expect(venus.to).toBe('2026-11-13');
    expect(venus.line).toContain('Venus is retrograde from 3 October 2026 to 13 November 2026.');
    for (const day of result.best) expect(day.date < '2026-10-03' || day.date > '2026-11-13').toBe(true);
  });

  it('keeps the total solar eclipse of 2 August 2027 off the best days and names it to avoid', async () => {
    const result = await findGoodDays({ goal: 'launch', from: '2027-07-01', to: '2027-08-31', zone: 'Europe/Madrid', today: TODAY }, clock);
    const eclipseDay = result.avoid.find((day) => day.date === '2027-08-02');
    expect(eclipseDay?.reason).toBe('A total solar eclipse in Leo falls today: tradition keeps important beginnings away from eclipses.');
    for (const day of result.best) expect(daysApart(day.date, '2027-08-02')).toBeGreaterThan(1);
    expect(result.periods.find((period) => period.kind === 'eclipse' && period.line.includes('2 August'))!.line).toBe('Total solar eclipse in Leo on 2 August 2027: tradition keeps the three days either side clear for beginnings.');
  });

  it('names the Moon\'s phase by its angle: dark, waxing, full and waning', () => {
    expect(phaseBand(0)).toBe('dark');
    expect(phaseBand(340)).toBe('dark');
    expect(phaseBand(90)).toBe('waxing');
    expect(phaseBand(180)).toBe('full');
    expect(phaseBand(270)).toBe('waning');
  });

  it('reads the full Moon of January 2027 (committed sky data) as full, and the days either side as waxing and waning', () => {
    const full = (sky.moons as { type: string; at: string }[]).find((moon) => moon.type === 'full' && moon.at.startsWith('2027-01'))!;
    const at = Date.parse(full.at);
    expect(phaseBand(moonPhase(new Date(at)).angle)).toBe('full');
    expect(phaseBand(moonPhase(new Date(at - 3 * DAY)).angle)).toBe('waxing');
    expect(phaseBand(moonPhase(new Date(at + 3 * DAY)).angle)).toBe('waning');
  });
});

describe('the answer', { timeout: TIMEOUT }, () => {
  it('ranks the best days highest first, spread at least two days apart, each with one line', async () => {
    const result = await findGoodDays({ goal: 'move', from: '2027-03-01', to: '2027-05-31', zone: 'Europe/London', count: 6, today: TODAY }, clock);
    expect(result.best).toHaveLength(6);
    for (let index = 1; index < result.best.length; index += 1) expect(result.best[index - 1].score).toBeGreaterThanOrEqual(result.best[index].score);
    for (const a of result.best) for (const b of result.best) if (a !== b) expect(daysApart(a.date, b.date)).toBeGreaterThanOrEqual(2);
    for (const day of result.best) {
      expect(day.reason).not.toContain('\n');
      expect(day.reason.endsWith('.')).toBe(true);
      expect(day.factors.length).toBeGreaterThan(0);
    }
    expect(result.avoid.length).toBeGreaterThan(0);
    for (const day of result.avoid) expect(result.best.map((best) => best.date)).not.toContain(day.date);
    expect(result.note).toBe(GOOD_DAYS_NOTE);
    expect(result.care).toBe(GOAL_RULES.move.care);
  });

  it('gives the same answer twice', async () => {
    const input = { goal: 'travel' as const, from: '2027-06-01', to: '2027-06-30', zone: 'Asia/Bangkok', today: TODAY };
    expect(JSON.stringify(await findGoodDays(input, clock))).toBe(JSON.stringify(await findGoodDays(input, clock)));
  });

  it('reads every goal without dashes, price or market calls, medical timing, death or legal outcomes', async () => {
    for (const goal of GOOD_DAY_GOALS) {
      const result = await findGoodDays({ goal, from: '2027-09-01', to: '2027-10-15', zone: 'America/New_York', today: TODAY }, clock);
      const text = JSON.stringify(result);
      expect(text, goal).not.toMatch(/[\u2013\u2014]/u);
      // Money, career and legal themes are allowed as tradition reads them; these calls are not.
      expect(text, goal).not.toMatch(/\b(?:buy|sell|stock|stocks|shares|crypto|token|price target|surgery|diagnos\w*|death|die|dies|you will (?:win|lose))\b/iu);
      expect(text, goal).not.toContain('for reflection');
    }
    expect(GOOD_DAY_GOALS).not.toContain('procedure');
    for (const word of ['procedure', 'Surgery', 'medical procedure', 'C-section', 'dentist']) expect(isMedicalGoal(word), word).toBe(true);
    for (const word of ['wedding', 'launch', 'travel']) expect(isMedicalGoal(word), word).toBe(false);
    expect(GOAL_RULES.contract.care).toContain('good windows to sign contracts');
    expect(GOAL_RULES.job.care).toContain('pay and terms');
  });

  it('takes a window of up to a year inside the eclipse table, and says why it refuses another', () => {
    expect(goodDaysWindow(undefined, undefined, '2027-01-01')).toEqual({ from: '2027-01-01', to: '2027-03-31', days: 90 });
    expect(goodDaysWindow('2027-01-01', '2027-12-31', TODAY).days).toBe(365);
    expect(goodDaysWindow('2028-01-01', '2028-12-31', TODAY).days).toBe(366);
    expect(() => goodDaysWindow('2027-01-01', '2028-01-02', TODAY)).toThrow('at most 366 days');
    expect(() => goodDaysWindow('2027-02-01', '2027-01-01', TODAY)).toThrow('same day as from or later');
    expect(() => goodDaysWindow('2027-02-30', undefined, TODAY)).toThrow('real date');
    expect(() => goodDaysWindow('2030-12-01', '2031-01-15', TODAY)).toThrow('covers 1 January 2026 to 31 December 2030');
    expect(GOOD_DAYS_FIRST).toBe('2026-01-01');
    expect(GOOD_DAYS_LAST).toBe('2030-12-31');
  });
});

describe('birth details', { timeout: TIMEOUT }, () => {
  const birth = { date: '1990-05-03', time: '08:30', zone: 'America/New_York' };

  it('adds the person\'s own chart and returns only the natal Sun sign', async () => {
    // The person lives in London now; the birthplace zone is New York.
    const result = await findGoodDays({ goal: 'job', from: '2027-04-01', to: '2027-06-30', zone: 'Europe/London', birth, today: TODAY }, clock);
    expect(result.personal).toEqual({ sun: 'taurus', timeKnown: true });
    const text = JSON.stringify(result);
    // The birth date, time and place are used for the request and never come back.
    for (const value of ['1990', '05-03', '08:30', 'New_York']) expect(text, value).not.toContain(value);
    expect(result.best.some((day) => day.factors.some((line) => line.includes('your')))).toBe(true);
  });

  it('changes the ranking only through the personal factors', async () => {
    const general = await findGoodDays({ goal: 'launch', from: '2027-04-01', to: '2027-06-30', zone: 'UTC', today: TODAY }, clock);
    const personal = await findGoodDays({ goal: 'launch', from: '2027-04-01', to: '2027-06-30', zone: 'UTC', birth: { date: '1985-11-20' }, today: TODAY }, clock);
    expect(personal.personal).toEqual({ sun: 'scorpio', timeKnown: false });
    expect(personal.messages).toContain('No birth time was given, so the natal Moon is left out of the personal reading.');
    expect(general.periods).toEqual(personal.periods);
  });

  it('gives an untimed birth no clock time, and dates a contact only when both ends of the birth day agree on the day', async () => {
    const untimed = { date: '1985-11-20' };
    const result = await findGoodDays({ goal: 'launch', from: '2027-04-01', to: '2027-06-30', zone: 'UTC', birth: untimed, today: TODAY }, clock);
    expect(JSON.stringify(result)).not.toMatch(/exact at/);
    expect(result.messages).toContain(UNTIMED_DROPPED_MESSAGE);
    // Every day of the window, not only the days that make the list: with and without a birthplace zone.
    const days: PersonalDay[] = Array.from({ length: 365 }, (_, index) => {
      const start = new Date(Date.UTC(2027, 0, 1 + index));
      return { date: start.toISOString().slice(0, 10), start, end: new Date(start.getTime() + DAY), moonSign: 'aries' };
    });
    const bodies = ['Venus', 'Jupiter', 'Mars', 'Saturn'] as const;
    for (const birth of [untimed, { ...untimed, zone: 'Asia/Bangkok' }] as BirthDetails[]) {
      const chart = await preparePersonal(birth, clock);
      const { days: factors, dropped } = personalFactors(chart, days, 'UTC');
      expect(dropped).toBe(true);
      const lines = factors.flatMap((list, index) => list.filter((factor) => factor.text.includes('your natal')).map((factor) => ({ index, text: factor.text })));
      // With a birthplace zone the birth day is 24 hours long and some Venus contacts still fall on one day.
      if (birth.zone) expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) expect(line.text).not.toMatch(/exact at/);
      // A scan of the chart at each end of the birth day, built here by hand: a kept contact is on that day in both.
      const scan = (set: typeof chart.bodies) => scanTransitContacts({ bodies: set as never, angles: null }, days[0].start, days.at(-1)!.end, { transitBodies: [...bodies], natalPoints: ['Sun', 'Venus'] });
      const early = scan(chart.early!);
      const late = scan(chart.late!);
      const onDay = (list: TransitContact[], text: string, index: number) => list.some((contact) => text.startsWith(`${contact.transitBody} `) && text.includes(`your natal ${contact.natalPoint} `) && Date.parse(contact.exactUtc) >= days[index].start.getTime() && Date.parse(contact.exactUtc) < days[index].end.getTime());
      for (const line of lines) {
        expect(onDay(early, line.text, line.index), line.text).toBe(true);
        expect(onDay(late, line.text, line.index), line.text).toBe(true);
      }
      // Jupiter and Saturn move too slowly to be dated to one day from a birth date alone.
      expect(lines.filter((line) => /^(Jupiter|Saturn) /u.test(line.text))).toEqual([]);
    }
  });

  it('pairs the two untimed scans by nearest exact moment and drops a contact they put on different days', () => {
    const days: PersonalDay[] = Array.from({ length: 30 }, (_, index) => {
      const start = new Date(Date.UTC(2027, 3, 1 + index));
      return { date: start.toISOString().slice(0, 10), start, end: new Date(start.getTime() + DAY), moonSign: 'aries' };
    });
    const contact = (transitBody: string, exactUtc: string, aspect = 'conjunction', natalPoint = 'Sun') => ({ transitBody, natalPoint, aspect, exactUtc, pass: 1, passCount: 1 }) as TransitContact;
    // A retrograde triple pass: each pass pairs with its nearest partner; the third falls on another day.
    const early = [contact('Saturn', '2027-04-02T03:00:00Z'), contact('Saturn', '2027-04-10T12:00:00Z'), contact('Saturn', '2027-04-20T23:00:00Z'), contact('Venus', '2027-04-05T10:00:00Z', 'trine')];
    const late = [contact('Saturn', '2027-04-21T02:00:00Z'), contact('Saturn', '2027-04-02T20:00:00Z'), contact('Saturn', '2027-04-10T08:00:00Z'), contact('Venus', '2027-04-05T09:00:00Z', 'sextile'), contact('Mars', '2027-04-29T22:00:00Z', 'square')];
    const { kept, dropped } = pairUntimedContacts(early, late, days);
    expect(kept.map((row) => [row.contact.transitBody, days[row.index].date])).toEqual([['Saturn', '2027-04-02'], ['Saturn', '2027-04-10']]);
    // The third Saturn pass, and the Venus trine and sextile and the Mars square with no partner in the other scan.
    expect(dropped).toBe(4);
    // A contact the other scan puts past the window's end has no day there, so it goes too.
    expect(pairUntimedContacts([contact('Mars', '2027-04-30T20:00:00Z')], [contact('Mars', '2027-05-01T02:00:00Z')], days)).toEqual({ kept: [], dropped: 1 });
  });

  it('refuses a birth date under 13 before working anything out', async () => {
    await expect(findGoodDays({ goal: 'travel', from: '2027-01-01', to: '2027-01-31', zone: 'UTC', birth: { date: '2015-06-01' }, today: TODAY }, clock)).rejects.toThrow(UNDER_13_SENTENCE);
    await expect(findGoodDays({ goal: 'travel', from: '2027-01-01', to: '2027-01-31', zone: 'UTC', birth: { date: '2013-11-10' }, today: TODAY }, clock)).rejects.toThrow(UNDER_13_SENTENCE);
    await expect(findGoodDays({ goal: 'travel', from: '2027-01-01', to: '2027-01-31', zone: 'UTC', birth: { date: '2027-01-01' }, today: TODAY }, clock)).rejects.toThrow(UNDER_13_SENTENCE);
  });

  it('gives no relationship or wedding timing from a birth date under 18', async () => {
    for (const goal of ['relationship', 'wedding'] as const) {
      await expect(findGoodDays({ goal, from: '2027-01-01', to: '2027-01-31', zone: 'UTC', birth: { date: '2010-01-01' }, today: TODAY }, clock)).rejects.toThrow(UNDER_18_PARTNERSHIP_SENTENCE);
    }
    // Other goals still read for a 13 to 17 year old.
    const job = await findGoodDays({ goal: 'job', from: '2027-01-01', to: '2027-01-31', zone: 'UTC', birth: { date: '2010-01-01' }, today: TODAY }, clock);
    expect(job.personal?.sun).toBe('capricorn');
  });
});
