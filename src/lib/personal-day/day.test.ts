import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { personalDay } from '../../ai-tools/personal/personal-day';
import { forbiddenClaim, type PersonalToolContext } from '../../ai-tools/personal/shared';
import { computeYourDay } from '../../islands/your-day/compute';
import { PAIR_CONFIDENCES, readingConfidence } from '../../ai-tools/reading-confidence';
import { MINOR_NOTE } from '../../ai-tools/features/reading-guards';
import { MINOR_LEFT_OUT_HOUSES, minorLeftOut, shareContact } from './day';
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
    expect(page.points).not.toContain('Moon');
    expect(page.theme).toMatch(/^The strongest contact on Tue 10 Nov 2026 is /u);
    const today = await computeYourDay({ birthDate: ADULT.birthDate, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date: '2026-11-09', zone: 'Europe/London', today: '2026-11-09' });
    expect(today.theme).toMatch(/^Today's strongest contact is /u);
  });

  it('shares the highest ranked contact that is not the Sun on the natal Sun, and nothing about the birth', async () => {
    const tool = (await personalDay({ ...ADULT, currentZone: 'Europe/Madrid', date: '2026-11-09' }, context)).data;
    const top = shareContact(tool.contacts)!;
    expect(top).toBe(tool.contacts.find((contact) => !(contact.planet === 'Sun' && contact.point === 'Sun')));
    expect(tool.pageUrl).toBe('https://zodiacs.org/your-day/');
    expect(tool.shareUrl).toBe(`https://zodiacs.org/share/your-day/?day=2026-11-09&p=${top.planet.toLowerCase()}&a=${top.aspect}&n=${top.point.toLowerCase()}&c=${top.confidence}`);
    const url = new URL(tool.shareUrl!);
    expect([...url.searchParams.keys()].every((key) => YOUR_DAY_SHARE_KEYS.includes(key))).toBe(true);
    expect(decodeURIComponent(url.href)).not.toMatch(/1990|05-03|08:30|40\.42|3\.7|Madrid/u);
    expect(parseYourDayShare(url.searchParams)).toEqual({ date: '2026-11-09', planet: top.planet, aspect: top.aspect, point: top.point, confidence: top.confidence, ref: null });
  });
});

describe('the reading guards on the /your-day/ page and get_personal_day', () => {
  it('take the age on today, not on the day read, and leave the natal Venus out for someone under 18', async () => {
    // Born 17 years and 6 months before today (2026-11-09), reading a day 7 months ahead, when they are 18.
    const minor = { birthDate: '2009-05-09', time: '08:30', zone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7 };
    for (const date of ['2027-06-09', '2027-06-01', '2027-06-17']) {
      const tool = (await personalDay({ ...minor, currentZone: 'Europe/Madrid', date }, context)).data;
      const page = await computeYourDay({ birthDate: minor.birthDate, time: minor.time, birthZone: minor.zone, latitude: minor.latitude, longitude: minor.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      for (const reading of [tool, page]) {
        expect(reading.under18).toBe(true);
        expect(reading.limits).toContain(MINOR_NOTE);
        expect(reading.contacts.some((contact) => minorLeftOut(contact.planet, contact.point))).toBe(false);
        expect(JSON.stringify({ ...reading, limits: [] })).not.toMatch(MINOR_CHECK);
      }
      expect(page.contacts).toEqual(tool.contacts);
      expect(page.limits).toEqual(tool.limits);
    }
    // The same day read for an adult still lists the natal Venus when it is touched.
    const adult = await computeYourDay({ birthDate: '1990-05-03', time: '08:30', birthZone: 'Europe/Madrid', latitude: 40.42, longitude: -3.7, date: '2027-06-09', zone: 'Europe/Madrid', today: '2026-11-09' });
    expect(adult.under18).toBe(false);
  }, 60_000);

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

  it('never read the sixth house as health', async () => {
    let sixth = 0;
    for (let day = 1; day <= 30; day += 1) {
      const date = `2026-11-${String(day).padStart(2, '0')}`;
      const page = await computeYourDay({ birthDate: ADULT.birthDate, time: ADULT.time, birthZone: ADULT.zone, latitude: ADULT.latitude, longitude: ADULT.longitude, date, zone: 'Europe/Madrid', today: '2026-11-09' });
      if (page.moon.house?.number !== 6) continue;
      sixth += 1;
      const tool = (await personalDay({ ...ADULT, currentZone: 'Europe/Madrid', date }, context)).data;
      expect(page.moon).toEqual(tool.moon);
      expect(page.moon.house.line).toBe('The Moon is passing through your sixth house: routines, craft, and the shape of the day.');
      expect(JSON.stringify(page)).not.toMatch(/health/iu);
      expect(JSON.stringify(tool)).not.toMatch(/health/iu);
    }
    expect(sixth).toBeGreaterThan(0);
  }, 60_000);
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
      { day: '2026-05-03', p: 'sun', a: 'conjunction', n: 'sun', c: '75' }, { ...ok, p: 'sun', n: 'sun' }, { ...ok, p: 'sun', a: 'opposition', n: 'sun' },
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
  const contact = (planet: string, point: string) => ({ planet, point });
  it('skips the Sun on the natal Sun and keeps the ranking otherwise', () => {
    const sunSun = contact('Sun', 'Sun');
    const marsSun = contact('Mars', 'Sun');
    const sunMoon = contact('Sun', 'Moon');
    expect(shareContact([sunSun, marsSun, sunMoon])).toBe(marsSun);
    expect(shareContact([sunMoon, sunSun])).toBe(sunMoon);
    expect(shareContact([sunSun])).toBeNull();
    expect(shareContact([])).toBeNull();
  });
});

describe('the /your-day/ page copy', () => {
  it('passes the copy rule and has no dashes', () => {
    const text = ['src/pages/your-day/index.astro', 'src/islands/YourDay.tsx'].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(forbiddenClaim(text.replace(/<style[\s\S]*?<\/style>/gu, ''))).toBeNull();
    expect(text).not.toMatch(/crypto|token|blockchain|market|invest|stock/iu);
  });
});
