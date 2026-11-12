import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createLocalTimeModule } from '../../../api/_compute/local-time.mjs';
import { personalDay } from '../../ai-tools/personal/personal-day';
import { forbiddenClaim, type PersonalToolContext } from '../../ai-tools/personal/shared';
import { computeYourDay } from '../../islands/your-day/compute';
import { PAIR_CONFIDENCES, readingConfidence } from '../../ai-tools/reading-confidence';
import { parseYourDayShare, yourDayQuery, yourDayShareUrl, YOUR_DAY_CONFIDENCES, YOUR_DAY_SHARE_KEYS } from './share';

const NOW = new Date('2026-11-09T09:00:00Z');
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

  it('shares the top contact and nothing about the birth', async () => {
    const tool = (await personalDay({ ...ADULT, currentZone: 'Europe/Madrid', date: '2026-11-09' }, context)).data;
    const top = tool.contacts[0];
    expect(tool.pageUrl).toBe('https://zodiacs.org/your-day/');
    expect(tool.shareUrl).toBe(`https://zodiacs.org/share/your-day/?day=2026-11-09&p=${top.planet.toLowerCase()}&a=${top.aspect}&n=${top.point.toLowerCase()}&c=${top.confidence}`);
    const url = new URL(tool.shareUrl!);
    expect([...url.searchParams.keys()].every((key) => YOUR_DAY_SHARE_KEYS.includes(key))).toBe(true);
    expect(decodeURIComponent(url.href)).not.toMatch(/1990|05-03|08:30|40\.42|3\.7|Madrid/u);
    expect(parseYourDayShare(url.searchParams)).toEqual({ date: '2026-11-09', planet: top.planet, aspect: top.aspect, point: top.point, confidence: top.confidence, ref: null });
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
  });
});

describe('the /your-day/ page copy', () => {
  it('passes the copy rule and has no dashes', () => {
    const text = ['src/pages/your-day/index.astro', 'src/islands/YourDay.tsx'].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(forbiddenClaim(text.replace(/<style[\s\S]*?<\/style>/gu, ''))).toBeNull();
    expect(text).not.toMatch(/crypto|token|blockchain|market|invest|stock/iu);
  });
});
