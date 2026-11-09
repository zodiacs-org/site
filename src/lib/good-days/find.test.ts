import { afterAll, describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import sky from '../../data/sky.json';
import { siteVoidOfCourseWindows } from '../../data/void-of-course';
import { moonPhase } from '@zodiacs/engine';
import { GOAL_RULES, GOOD_DAYS_NOTE, GOOD_DAY_GOALS, isMedicalGoal } from './goals';
import { GOOD_DAYS_FIRST, GOOD_DAYS_LAST, UNDER_13_SENTENCE, UNDER_18_PARTNERSHIP_SENTENCE, findGoodDays, goodDaysWindow, phaseBand, voidPeriods } from './find';

const clock = createLocalTimeModule();
afterAll(() => clock.dispose());
const TODAY = '2026-11-09';
const DAY = 86_400_000;
const daysApart = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY;

describe('the void-of-course Moon', () => {
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

describe('known answers', () => {
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

describe('the answer', () => {
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

describe('birth details', () => {
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
