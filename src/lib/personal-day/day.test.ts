import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { personalDay } from '../../ai-tools/personal/personal-day';
import { forbiddenClaim, type PersonalToolContext } from '../../ai-tools/personal/shared';
import { computeYourDay } from '../../islands/your-day/compute';
import { PAIR_CONFIDENCES, readingConfidence } from '../../ai-tools/reading-confidence';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { MINOR_LEFT_OUT_HOUSES, UNTIMED_LIMIT, minorLeftOut, shareContact } from './day';
import { NATAL_HOUSE_THEME } from '../natal';
import { softenHealth, softenMinor } from '../../ai-tools/features/reading-guards';
import { transitLine } from '../transits';
import { MAJOR_ASPECT_ORDER, TRANSIT_BODY_ORDER } from '../engine/transit-scan-shared';
import { pointName } from './score';
import { parseYourDayShare, yourDayQuery, yourDayShareUrl, YOUR_DAY_CONFIDENCES, YOUR_DAY_SHARE_KEYS } from './share';

const NOW = new Date('2026-11-09T09:00:00Z');
/** The ticket's appetite check, with the longing, heat and pleasure a review found too. */
const MINOR_CHECK = /loving|appetite|longing|heat|pleasure|romant|attract/iu;
const context: PersonalToolContext = { now: NOW, localTime: createLocalTimeModule(), resolveZone: async (name) => name, origin: 'https://zodiacs.org' };
const ADULT = { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };

describe('the /your-day/ page and get_personal_day', () => {
  it('give the same ranked list, Moon and theme for a fixed chart and day', async () => {
    for (const [date, zone] of [['2026-11-09', 'Europe/Madrid'], ['2026-11-12', 'Asia/Bangkok'], ['2027-02-01', 'America/New_York']] as const) {
      const tool = (await personalDay({ ...ADULT, currentZone: zone, date }, context)).data;
      const page = await computeYourDay({ birthDate: ADULT.birthDate, time: ADULT.time, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date, zone, today: '2026-11-09' });
      expect(page.contacts.length).toBeGreaterThan(0);
      expect(page.contacts).toEqual(tool.contacts);
      expect(page.moon).toEqual(tool.moon);
      expect(page.theme).toBe(tool.theme);
      expect(page.points).toEqual(tool.points);
      expect(page.middayUtc).toBe(tool.middayUtc);
      expect(page.limits).toEqual(tool.limits);
    }
  });

  it('agree without a birth time too, and say "today" only for today', async () => {
    const tool = (await personalDay({ birthDate: ADULT.birthDate, zone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, currentZone: 'Europe/London', date: '2026-11-10' }, context)).data;
    const page = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-10', zone: 'Europe/London', today: '2026-11-09' });
    expect(page.contacts).toEqual(tool.contacts);
    expect(page.theme).toBe(tool.theme);
    expect(page.limits).toEqual(tool.limits);
    expect(page.points).not.toContain('Moon');
    expect(page.theme).toMatch(/^The strongest contact on Tue 10 Nov 2026 is /u);
    const today = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-09', zone: 'Europe/London', today: '2026-11-09' });
    expect(today.theme).toMatch(/^Today's strongest contact is /u);
  });

  it('shares the first eligible contact today and nothing about the birth', async () => {
    const tool = (await personalDay({ ...ADULT, currentZone: 'Europe/Madrid', date: '2026-11-09' }, context)).data;
    const top = shareContact(tool.contacts)!;
    expect(top).toBe(tool.contacts.find((contact) => contact.group === 'today' && !(contact.planet === 'Sun' && contact.point === 'Sun')));
    expect(tool.pageUrl).toBe('https://zodiacs.org/your-day/');
    expect(tool.shareUrl).toBe(`https://zodiacs.org/share/your-day/?day=2026-11-09&p=${top.planet.toLowerCase()}&a=${top.aspect}&n=${top.point.toLowerCase()}&c=${top.confidence}`);
    const url = new URL(tool.shareUrl!);
    expect([...url.searchParams.keys()].every((key) => YOUR_DAY_SHARE_KEYS.includes(key))).toBe(true);
    expect(decodeURIComponent(url.href)).not.toMatch(/1990|05-03|08:30|40\.42|3\.7|Madrid/u);
    expect(parseYourDayShare(url.searchParams)).toEqual({ date: '2026-11-09', planet: top.planet, aspect: top.aspect, point: top.point, confidence: top.confidence, ref: null });
  });
});

describe('the reading guards on the /your-day/ page and get_personal_day', () => {
  const minorBirthDate = '2009-05-09';

  async function pageAndTool(birthDate: string, date: string, today: string, now = NOW) {
    const { zone, time, latitude, longitude } = ADULT;
    const birth = { birthDate, time, latitude, longitude };
    const page = await computeYourDay({ ...birth, birthZone: zone, date, zone, today });
    const { data: tool } = await personalDay({ ...birth, zone, currentZone: zone, date }, { ...context, now });
    return { page, tool };
  }

  it('keep the minor guards for someone aged 17 years and 6 months reading seven months ahead', async () => {
    for (const date of ['2027-06-09', '2027-06-01', '2027-06-17']) {
      const { page, tool } = await pageAndTool(minorBirthDate, date, '2026-11-09');
      for (const reading of [page, tool]) {
        expect(reading.under18).toBe(true);
        expect(reading.limits).toContain(MINOR_NOTE);
        expect(reading.contacts.some(({ point }) => point === 'Venus')).toBe(false);
        expect(reading.contacts.some((contact) => minorLeftOut(contact.planet, contact.point))).toBe(false);
        expect(JSON.stringify({ theme: reading.theme, moon: reading.moon, contacts: reading.contacts })).not.toMatch(MINOR_CHECK);
      }
      expect(page.contacts).toEqual(tool.contacts);
      expect(page.limits).toEqual(tool.limits);
    }
  });

  it.each([
    { when: 'just before', now: '2027-05-08T21:59:59Z', today: '2027-05-08', under18: true },
    { when: 'at', now: '2027-05-08T22:00:00Z', today: '2027-05-09', under18: false },
  ])('apply the correct guards $when local midnight on the 18th birthday', async ({ now, today, under18 }) => {
    // The same future chart has a ranked Pluto contact to natal Venus when read as an adult.
    const { page, tool } = await pageAndTool(minorBirthDate, '2027-06-09', today, new Date(now));
    for (const reading of [page, tool]) {
      expect(reading.under18).toBe(under18);
      expect(reading.limits.includes(MINOR_NOTE)).toBe(under18);
      expect(reading.contacts.some(({ planet, point }) => planet === 'Pluto' && point === 'Venus')).toBe(!under18);
    }
    expect(page.contacts).toEqual(tool.contacts);
    expect(page.limits).toEqual(tool.limits);
  });

  it('leave out every contact and house line a minor could see that the check catches', () => {
    let kept = 0;
    for (const mover of TRANSIT_BODY_ORDER) for (const point of [...TRANSIT_BODY_ORDER, 'ASC', 'MC'] as const) for (const aspect of MAJOR_ASPECT_ORDER) {
      if (minorLeftOut(mover, point)) continue;
      kept += 1;
      expect(softenHealth(softenMinor(transitLine(mover, aspect, pointName(point)))), `${mover} ${aspect} ${point}`).not.toMatch(MINOR_CHECK);
    }
    expect(kept).toBeGreaterThan(250);
    for (let house = 1; house <= 12; house += 1) {
      if (MINOR_LEFT_OUT_HOUSES.includes(house)) continue;
      expect(softenHealth(softenMinor(NATAL_HOUSE_THEME[house])), `house ${house}`).not.toMatch(MINOR_CHECK);
    }
  });

  it('leave the Moon\'s fifth-house line out for a minor, on the page and in the tool', async () => {
    const minor = { birthDate: '2010-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    let fifth = 0;
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const adult = await computeYourDay({ birthDate: '1990-05-03', time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      const page = await computeYourDay({ birthDate: minor.birthDate, time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      const tool = (await personalDay({ ...minor, currentZone: 'Europe/Madrid', date }, context)).data;
      expect(page.moon).toEqual(tool.moon);
      expect(page.moon.line).not.toMatch(MINOR_CHECK);
      if (adult.moon.house?.number === 5) { fifth += 1; expect(page.moon.house).toBeNull(); }
    }
    expect(fifth).toBeGreaterThan(0);
  }, 60_000);

  it.each([
    { age: 'an adult', birthDate: ADULT.birthDate },
    { age: 'a minor', birthDate: minorBirthDate },
  ])('give the softened sixth-house line to $age', async ({ birthDate }) => {
    const { page, tool } = await pageAndTool(birthDate, '2026-11-09', '2026-11-09');
    expect(page.moon).toEqual(tool.moon);
    const line = 'The Moon is passing through your sixth house: routines, craft, and the shape of the day.';
    for (const reading of [page, tool]) {
      expect(reading.moon.house).toEqual({ number: 6, line });
      expect(reading.moon.line).toContain(line);
      expect(/health/iu.test(JSON.stringify(reading))).toBe(false);
    }
  });
});

describe('the your-day share link', () => {
  const ok = { day: '2026-11-09', p: 'mars', a: 'square', n: 'asc', c: '75' };
  it('reads only its own keys, each once, from fixed vocabularies', () => {
    expect(parseYourDayShare(new URLSearchParams(ok))).toEqual({ date: '2026-11-09', planet: 'Mars', aspect: 'square', point: 'ASC', confidence: 75, ref: null });
    expect(parseYourDayShare(new URLSearchParams({ ...ok, ref: 'chatgpt' }))?.ref).toBe('chatgpt');
    for (const bad of [
      { ...ok, day: '2026-02-30' }, { ...ok, day: '1990-5-3' }, { ...ok, p: 'chiron' }, { ...ok, p: 'Mars' }, { ...ok, a: 'quincunx' },
      { ...ok, n: 'north-node' }, { ...ok, c: '80' }, { ...ok, c: '075' }, { ...ok, ref: 'x' }, { ...ok, t: '08:30' }, { ...ok, lat: '40' },
      // The Sun on the natal Sun, with the day, states the birthday: no aspect of it is a share.
      ...MAJOR_ASPECT_ORDER.map((a) => ({ ...ok, p: 'sun', a, n: 'sun' })),
    ]) expect(parseYourDayShare(new URLSearchParams(bad)), JSON.stringify(bad)).toBeNull();
    const { c: _c, ...noConfidence } = ok;
    expect(parseYourDayShare(new URLSearchParams(noConfidence))).toBeNull();
    expect(parseYourDayShare(new URLSearchParams('day=2026-11-09&day=2026-11-10&p=mars&a=square&n=asc&c=75'))).toBeNull();
  });

  it('accepts only the confidences the rule gives a dated chart', () => {
    expect([...YOUR_DAY_CONFIDENCES].sort()).toEqual([readingConfidence('date'), readingConfidence('date', true), readingConfidence('timed-place'), readingConfidence('timed-place', true)].sort());
    expect(YOUR_DAY_CONFIDENCES).toEqual(PAIR_CONFIDENCES);
  });

  it('round-trips and refuses a contact outside the vocabularies', () => {
    const share = parseYourDayShare(new URLSearchParams(ok))!;
    expect(parseYourDayShare(new URLSearchParams(yourDayQuery(share)))).toEqual(share);
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-11-09', contact: { planet: 'North Node', aspect: 'square', point: 'Sun', confidence: 70 } })).toBeNull();
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-11-09', contact: null })).toBeNull();
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-05-03', contact: { planet: 'Sun', aspect: 'conjunction', point: 'Sun', confidence: 75 } })).toBeNull();
    expect(yourDayShareUrl('https://zodiacs.org', { date: '2026-05-03', contact: { planet: 'Sun', aspect: 'conjunction', point: 'Moon', confidence: 75 } })).toBe('https://zodiacs.org/share/your-day/?day=2026-05-03&p=sun&a=conjunction&n=moon&c=75');
  });
});

describe('shareContact', () => {
  it('prioritizes eligible contacts today, then in the background, in score order', () => {
    const sunSun = { planet: 'Sun', point: 'Sun', group: 'today' } as const;
    const marsSun = { planet: 'Mars', point: 'Sun', group: 'today' } as const;
    const sunMoon = { planet: 'Sun', point: 'Moon', group: 'today' } as const;
    const pluto = { planet: 'Pluto', point: 'Sun', group: 'background' } as const;
    const saturn = { planet: 'Saturn', point: 'Moon', group: 'background' } as const;
    expect(shareContact([pluto, sunSun, marsSun, sunMoon])).toBe(marsSun);
    expect(shareContact([sunMoon, marsSun])).toBe(sunMoon);
    expect(shareContact([sunSun, pluto, saturn])).toBe(pluto);
    expect(shareContact([sunSun])).toBeNull();
    expect(shareContact([])).toBeNull();
  });
});

describe('the /your-day/ page copy', () => {
  it('passes the copy rule and has no dashes', () => {
    const text = ['src/pages/your-day/index.astro', 'src/islands/YourDay.tsx'].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(text).toContain(UNTIMED_LIMIT);
    expect(forbiddenClaim(text.replace(/<style[\s\S]*?<\/style>/gu, ''))).toBeNull();
    expect(text).not.toMatch(/crypto|token|blockchain|market|invest|stock/iu);
  });
});
