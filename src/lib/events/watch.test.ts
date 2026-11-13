import { describe, expect, it } from 'vitest';
import { eventsCatalog } from './catalog';
import { eventsPublication } from './publication';
import { countdownParts, lastMoment, localMomentLabel, nextMoment, pad2, sinceLabel } from './countdown';
import {
  EVENT_READING_CONFIDENCE, SOLAR_ECLIPSE_VISIBILITY, antisolarLongitude, lunarEclipseRegions,
  watchPlan, watchPlanCopy,
} from './watch';

const DASHES = /[\u2012\u2013\u2014\u2015]/;
const catalog = eventsCatalog();
const watched = catalog.pages.filter((event) => ['lunation', 'eclipse', 'retrograde'].includes(event.facts.family));

describe('watch plans', () => {
  it('exist for every lunation, eclipse and retrograde page, and only for those', () => {
    expect(watched.length).toBeGreaterThan(50);
    for (const event of catalog.pages) {
      const plan = watchPlan(event.facts);
      if (['lunation', 'eclipse', 'retrograde'].includes(event.facts.family)) expect(plan, event.facts.id).not.toBeNull();
      else expect(plan, event.facts.id).toBeNull();
    }
  });

  it('use no em or en dashes and give two or three Guide questions', () => {
    for (const event of watched) {
      const plan = watchPlan(event.facts)!;
      for (const line of watchPlanCopy(plan)) expect(line, `${event.facts.id}: ${line}`).not.toMatch(DASHES);
      expect(plan.questions.length).toBeGreaterThanOrEqual(2);
      expect(plan.questions.length).toBeLessThanOrEqual(3);
      for (const question of plan.questions) expect(question.endsWith('?')).toBe(true);
    }
  });

  it('carry no birth details or personal data in the Guide questions', () => {
    for (const event of watched) {
      for (const question of watchPlan(event.facts)!.questions) {
        expect(question).not.toMatch(/\d{4}/); // never a year
        expect(question).not.toMatch(/\d{1,2}:\d{2}/); // never a clock time
      }
    }
  });

  it('count down to the committed instants', () => {
    for (const event of watched) {
      const plan = watchPlan(event.facts)!;
      const { facts } = event;
      if (facts.family === 'retrograde') {
        const expected = [
          ...(facts.start && !facts.clamped ? [facts.start] : []),
          ...(facts.end ? [facts.end] : []),
        ];
        expect(plan.moments.map((moment) => moment.at)).toEqual(expected);
        expect(plan.moments[0]?.label ?? '').toMatch(/turns (retrograde|direct)$/);
      } else {
        expect(plan.moments).toEqual([{ label: expect.any(String), at: facts.at }]);
      }
      for (const moment of plan.moments) expect(Number.isFinite(Date.parse(moment.at))).toBe(true);
    }
  });

  it('say where each published solar eclipse can be seen', () => {
    const solar = eventsPublication.pages.filter((page) => page.family === 'eclipse' && page.subtype === 'solar');
    expect(solar.length).toBeGreaterThan(0);
    for (const page of solar) {
      expect(SOLAR_ECLIPSE_VISIBILITY[page.anchor.slice(0, 10)], page.id).toBeTruthy();
      const event = catalog.byId.get(page.id)!;
      expect(watchPlan(event.facts)!.visibility).toBe(SOLAR_ECLIPSE_VISIBILITY[page.anchor.slice(0, 10)]);
    }
  });

  it('give the February 2027 eclipses their own sky notes', () => {
    const annular = catalog.byId.get('eclipse-2027-02-06')!;
    const penumbral = catalog.byId.get('eclipse-2027-02-20')!;
    const annularPlan = watchPlan(annular.facts)!;
    expect(annularPlan.moments[0].at).toBe('2027-02-06T15:59:39.357Z');
    expect(annularPlan.visibility).toMatch(/Chile, Argentina/);
    expect(annularPlan.lookFor.join(' ')).toMatch(/ISO 12312-2/);
    const penumbralPlan = watchPlan(penumbral.facts)!;
    expect(penumbralPlan.lookFor[0]).toMatch(/Most people will not notice/);
    expect(penumbralPlan.visibility).toMatch(/Europe/);
    expect(penumbralPlan.questions).toContain('What is a penumbral eclipse?');
  });

  it('place a lunar eclipse on the night side of Earth', () => {
    // 3 March 2026, 11:34 UTC: night over the Pacific.
    expect(Math.abs(antisolarLongitude('2026-03-03T11:33:46.313Z') + 170)).toBeLessThan(5);
    const march = lunarEclipseRegions('2026-03-03T11:33:46.313Z');
    expect(march).toEqual(expect.arrayContaining(['Hawaii and the central Pacific', 'Australia', 'East Asia', 'western North America']));
    expect(march).not.toContain('Europe');
    // 28 August 2026, 04:13 UTC: night over the Atlantic side.
    const august = lunarEclipseRegions('2026-08-28T04:12:55.340Z');
    expect(august).toEqual(expect.arrayContaining(['South America', 'eastern North America', 'Europe', 'Africa']));
    expect(august).not.toContain('Australia');
    // Midnight UTC at an equinox: the antisolar point is near Greenwich.
    expect(Math.abs(antisolarLongitude('2027-03-20T00:00:00.000Z'))).toBeLessThan(3);
  });

  it('labels the reading with the sign-level confidence', () => {
    expect(EVENT_READING_CONFIDENCE).toBe('Reading confidence 40%');
  });
});

describe('countdown arithmetic', () => {
  const at = Date.parse('2026-11-24T14:53:00.000Z');

  it('splits the time left into days, hours, minutes and seconds', () => {
    const parts = countdownParts(at, at - (3 * 86_400_000 + 4 * 3_600_000 + 5 * 60_000 + 6_000));
    expect(parts).toMatchObject({ past: false, days: 3, hours: 4, minutes: 5, seconds: 6 });
  });

  it('rounds a part second up while counting down, so it reads zero only at the moment', () => {
    expect(countdownParts(at, at - 400)).toMatchObject({ past: false, days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(countdownParts(at, at)).toMatchObject({ past: true, seconds: 0 });
  });

  it('measures time since a passed moment', () => {
    expect(countdownParts(at, at + 90_000)).toMatchObject({ past: true, minutes: 1, seconds: 30 });
    expect(sinceLabel(at, at + 3_600_000)).toBe('less than a day ago');
    expect(sinceLabel(at, at + 86_400_000)).toBe('1 day ago');
    expect(sinceLabel(at, at + 12.5 * 86_400_000)).toBe('12 days ago');
  });

  it('picks the next and the last moment of a retrograde cycle', () => {
    const moments = [
      { label: 'Mercury turns retrograde', at: '2027-02-09T00:00:00.000Z' },
      { label: 'Mercury turns direct', at: '2027-03-03T00:00:00.000Z' },
    ];
    expect(nextMoment(moments, Date.parse('2027-01-01'))?.label).toBe('Mercury turns retrograde');
    expect(nextMoment(moments, Date.parse('2027-02-20'))?.label).toBe('Mercury turns direct');
    expect(nextMoment(moments, Date.parse('2027-04-01'))).toBeNull();
    expect(lastMoment(moments, Date.parse('2027-04-01'))?.label).toBe('Mercury turns direct');
    expect(lastMoment(moments, Date.parse('2027-01-01'))).toBeNull();
  });

  it('pads the clock cells and prints the moment in a given zone', () => {
    expect(pad2(7)).toBe('07');
    expect(pad2(42)).toBe('42');
    // ICU versions join the date and the clock with a comma or with 'at'.
    expect(localMomentLabel('2026-11-24T14:53:00.000Z', 'Asia/Bangkok')).toMatch(/^Tue, November 24, 2026(,| at) 9:53\sPM \(Asia\/Bangkok\)$/);
    expect(localMomentLabel('2026-11-24T14:53:00.000Z', 'America/New_York')).toMatch(/^Tue, November 24, 2026(,| at) 9:53\sAM \(America\/New York\)$/);
  });
});
