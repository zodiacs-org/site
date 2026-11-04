import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTPUT_SCHEMAS } from './contracts';
import {
  bigThreeQuery,
  bigThreeShareUrl,
  CHINESE_SHARE_FIRST_YEAR,
  CHINESE_SHARE_LAST_YEAR,
  chineseZodiacQuery,
  chineseZodiacShareUrl,
  horoscopePeriodShareUrl,
  inviteQuery,
  inviteShareUrl,
  parseBigThreeShare,
  parseChineseZodiacShare,
  parseInviteShare,
  birthdayQuery,
  birthdayShareUrl,
  chartTwinsQuery,
  chartTwinsShareUrl,
  famousChartShareUrl,
  milestoneQuery,
  milestoneShareUrl,
  parseChartTwinsShare,
  parseFamousChartShare,
  parseMilestoneShare,
  horoscopeQuery,
  horoscopeShareUrl,
  parseBirthdayShare,
  parseHoroscopeShare,
  parseSkyCalendarShare,
  skyCalendarQuery,
  skyCalendarShareFromEvent,
  skyCalendarShareUrl,
} from './share-links';
import { executeAiTool, type AiCallContext } from './tools';
import type { HoroscopeWindow } from './horoscope/window';
import { lifeMilestones } from '../lib/occasions/milestones';
import { matchTwins } from '../lib/sharing/twins';
import { twinMatches, type IndexedPerson } from '../server/result-preview-model';
import peopleIndex from './features/people-index.json';
import { CHINESE_FIRST_YEAR, CHINESE_LAST_YEAR, chineseElement } from './features/chinese-zodiac';
import { chineseZodiacCardModel } from '../server/result-preview-model';
import { chineseAnimalForCycleYear } from '../data/chinese-zodiac';

const params = (query: string) => new URLSearchParams(query);
const NOW = new Date('2026-10-18T12:00:00Z');

describe('a birthday share link', () => {
  it('carries the month and day, and only a cusp date’s settled sign', () => {
    expect(birthdayShareUrl('https://zodiacs.org', { month: 5, day: 3, cuspSign: null })).toBe('https://zodiacs.org/share/birthday/?d=05-03');
    expect(birthdayShareUrl('https://zodiacs.org', { month: 4, day: 20, cuspSign: 'taurus' })).toBe('https://zodiacs.org/share/birthday/?d=04-20&s=taurus');
    expect(birthdayShareUrl('https://zodiacs.org', { month: 2, day: 29, cuspSign: null })).toBe('https://zodiacs.org/share/birthday/?d=02-29');
    expect(birthdayShareUrl('https://zodiacs.org', { month: 4, day: 31, cuspSign: null })).toBeNull();
  });

  it('reads back exactly what it wrote, and nothing else', () => {
    const share = parseBirthdayShare(params('d=04-20&s=taurus&ref=chatgpt'))!;
    expect(share).toEqual({ month: 4, day: 20, sign: 'taurus', ref: 'chatgpt' });
    expect(birthdayQuery(share, true)).toBe('d=04-20&s=taurus&ref=chatgpt');
    for (const query of ['d=1990-05-03', 'd=5-3', 'd=13-01', 'd=02-30', 'd=05-03&s=ophiuchus', 'd=05-03&y=1990', 'd=05-03&d=05-04', 'd=05-03&ref=x', 's=taurus']) {
      expect(parseBirthdayShare(params(query)), query).toBeNull();
    }
  });
});

describe('a sky calendar share link', () => {
  it('names an event by its kind, a retrograde’s planet and the day it starts', () => {
    expect(skyCalendarShareFromEvent({ id: 'Mercury-retrograde-2026-10-24T07:14:22.646Z', start: '2026-10-24T07:14:22.646Z' }))
      .toEqual({ kind: 'retrograde', planet: 'mercury', date: '2026-10-24' });
    expect(skyCalendarShareUrl('https://zodiacs.org', { id: 'full-moon-2026-10-26T04:11:45.019Z', start: '2026-10-26T04:11:45.019Z' }))
      .toBe('https://zodiacs.org/share/sky-calendar/?k=full-moon&d=2026-10-26');
    expect(skyCalendarShareFromEvent({ id: 'lunar-eclipse-2026-08-28T04:12:00.000Z', start: '2026-08-28T04:12:00.000Z' })).toMatchObject({ kind: 'lunar-eclipse', planet: null });
    expect(skyCalendarShareFromEvent({ id: 'Moon-retrograde-2026-10-24T00:00:00Z', start: '2026-10-24T00:00:00Z' })).toBeNull();
  });

  it('refuses a planet on a moon, a retrograde without one, and anything unknown', () => {
    const share = parseSkyCalendarShare(params('k=retrograde&b=mercury&d=2026-10-24'))!;
    expect(skyCalendarQuery(share)).toBe('k=retrograde&b=mercury&d=2026-10-24');
    for (const query of ['k=full-moon&b=mars&d=2026-10-26', 'k=retrograde&d=2026-10-24', 'k=retrograde&b=moon&d=2026-10-24', 'k=quarter-moon&d=2026-10-26', 'k=full-moon&d=2026-02-30', 'k=full-moon&d=2026-10-26&t=Big']) {
      expect(parseSkyCalendarShare(params(query)), query).toBeNull();
    }
  });
});

describe('a horoscope share link', () => {
  it('names the sign and the day with its focus, or the week', () => {
    expect(horoscopeShareUrl('https://zodiacs.org', { sign: 'leo', date: '2026-10-17', week: false, focus: 'general' })).toBe('https://zodiacs.org/share/horoscope/?s=leo&d=2026-10-17');
    expect(horoscopeShareUrl('https://zodiacs.org', { sign: 'leo', date: '2026-10-17', week: false, focus: 'love' }, 'chatgpt')).toBe('https://zodiacs.org/share/horoscope/?s=leo&d=2026-10-17&f=love&ref=chatgpt');
    expect(horoscopeShareUrl('https://zodiacs.org', { sign: 'leo', date: '2026-10-12', week: true, focus: 'love' })).toBe('https://zodiacs.org/share/horoscope/?s=leo&w=2026-10-12');
    expect(horoscopeShareUrl('https://zodiacs.org', { sign: 'leo', date: '17 October', week: false, focus: 'general' })).toBeNull();
    // A week starts on its Monday.
    expect(horoscopeShareUrl('https://zodiacs.org', { sign: 'leo', date: '2026-10-14', week: true, focus: 'general' })).toBeNull();
  });

  it('never carries text, and refuses a day and a week together', () => {
    expect(parseHoroscopeShare(params('s=leo&w=2026-10-12'))).toEqual({ sign: 'leo', date: '2026-10-12', period: 'week', focus: 'general', ref: null });
    expect(horoscopeQuery(parseHoroscopeShare(params('s=leo&d=2026-10-17&f=general'))!)).toBe('s=leo&d=2026-10-17');
    for (const query of ['s=leo', 's=leo&d=2026-10-17&w=2026-10-12', 's=leo&w=2026-10-12&f=love', 's=leo&d=2026-10-17&f=money', 's=leo&d=2026-10-17&text=You+will+win', 's=leo&w=2026-10-14', 'd=2026-10-17']) {
      expect(parseHoroscopeShare(params(query)), query).toBeNull();
    }
  });
});

describe('a month\'s or year\'s horoscope share link', () => {
  it('names the sign and the month or the year, from any day in it', () => {
    expect(horoscopePeriodShareUrl('https://zodiacs.org', { sign: 'leo', period: 'month', date: '2026-11-05' })).toBe('https://zodiacs.org/share/horoscope/?s=leo&m=2026-11');
    expect(horoscopePeriodShareUrl('https://zodiacs.org', { sign: 'leo', period: 'year', date: '2027-03-01' })).toBe('https://zodiacs.org/share/horoscope/?s=leo&y=2027');
    expect(horoscopePeriodShareUrl('https://zodiacs.org', { sign: 'lion', period: 'month', date: '2026-11-05' })).toBeNull();
    expect(parseHoroscopeShare(params('s=leo&m=2026-11&ref=chatgpt'))).toEqual({ sign: 'leo', date: '2026-11-01', period: 'month', focus: 'general', ref: 'chatgpt' });
    expect(parseHoroscopeShare(params('s=leo&y=2027'))).toEqual({ sign: 'leo', date: '2027-01-01', period: 'year', focus: 'general', ref: null });
    expect(horoscopeQuery(parseHoroscopeShare(params('s=leo&m=2026-11'))!)).toBe('s=leo&m=2026-11');
    expect(horoscopeQuery(parseHoroscopeShare(params('s=leo&y=2027'))!)).toBe('s=leo&y=2027');
  });

  it('takes one period, never a focus beside a month or a year, and nothing but a month or a year in its form', () => {
    for (const query of ['s=leo&m=2026-11&y=2026', 's=leo&m=2026-11&d=2026-11-05', 's=leo&m=2026-11&f=love', 's=leo&y=2026&f=career', 's=leo&m=2026-13', 's=leo&m=2026-1', 's=leo&m=November', 's=leo&y=26', 's=leo&y=2300', 's=leo&y=2026&w=2026-10-12', 'm=2026-11']) {
      expect(parseHoroscopeShare(params(query)), query).toBeNull();
    }
  });
});

describe('a big three share link', () => {
  it('carries the Sun, the Moon when the chart settles it and the rising sign only when it is known', () => {
    expect(bigThreeShareUrl('https://zodiacs.org', { sun: 'leo', moon: 'aries', rising: 'libra' })).toBe('https://zodiacs.org/share/big-three/?s=leo&m=aries&r=libra');
    expect(bigThreeShareUrl('https://zodiacs.org', { sun: 'leo', moon: 'aries', rising: null })).toBe('https://zodiacs.org/share/big-three/?s=leo&m=aries');
    // Untimed on a day the Moon changed sign: the card says the Moon sign is undetermined.
    expect(bigThreeShareUrl('https://zodiacs.org', { sun: 'leo', moon: null, rising: null })).toBe('https://zodiacs.org/share/big-three/?s=leo');
    // A rising sign takes a birth time, which settles the Moon; without the Moon the link carries the Sun alone.
    expect(bigThreeShareUrl('https://zodiacs.org', { sun: 'leo', moon: null, rising: 'libra' })).toBe('https://zodiacs.org/share/big-three/?s=leo');
    expect(bigThreeShareUrl('https://zodiacs.org', { sun: null, moon: 'aries', rising: 'libra' })).toBeNull();
  });

  it('reads back exactly what it wrote, and nothing else', () => {
    const share = parseBigThreeShare(params('s=leo&m=aries&r=libra&ref=chatgpt'))!;
    expect(share).toEqual({ sun: 'leo', moon: 'aries', rising: 'libra', ref: 'chatgpt' });
    expect(bigThreeQuery(share, true)).toBe('s=leo&m=aries&r=libra&ref=chatgpt');
    expect(parseBigThreeShare(params('s=leo'))).toEqual({ sun: 'leo', moon: null, rising: null, ref: null });
    for (const query of ['m=aries', 's=leo&r=libra', 's=ophiuchus', 's=leo&m=moon', 's=leo&d=1990-08-01', 's=leo&t=08%3A30', 's=leo&lat=40.42', 's=leo&n=Ana', 's=leo&s=virgo', 's=leo&ref=x']) {
      expect(parseBigThreeShare(params(query)), query).toBeNull();
    }
  });
});

describe('a Chinese zodiac share link', () => {
  it('names the animal alone, never a year: a year asked about could be a birth year', () => {
    expect(chineseZodiacShareUrl('https://zodiacs.org', { animal: 'horse' })).toBe('https://zodiacs.org/share/chinese-zodiac/?a=horse');
    expect(chineseZodiacShareUrl('https://zodiacs.org', { animal: 'snake' })).toBe('https://zodiacs.org/share/chinese-zodiac/?a=snake');
    expect(chineseZodiacShareUrl('https://zodiacs.org', { animal: 'cat' })).toBeNull();
    // Whatever else a caller hands it, the link is the animal's.
    expect(chineseZodiacShareUrl('https://zodiacs.org', { animal: 'horse', year: 1990 } as { animal: string })).toBe('https://zodiacs.org/share/chinese-zodiac/?a=horse');
  });

  it('reads back exactly what it wrote, and nothing else', () => {
    expect(parseChineseZodiacShare(params('a=horse&ref=assistant'))).toEqual({ animal: 'horse', ref: 'assistant' });
    expect(chineseZodiacQuery(parseChineseZodiacShare(params('a=horse'))!)).toBe('a=horse');
    expect(parseChineseZodiacShare(params('a=rabbit'))).toEqual({ animal: 'rabbit', ref: null });
    for (const query of ['y=2026', 'a=cat', 'a=horse&d=1990-01-20', 'a=horse&a=rat', 'a=horse&e=fire', 'a=horse&y=2026&y=2026']) {
      expect(parseChineseZodiacShare(params(query)), query).toBeNull();
    }
  });

  it('still opens an older link that carries the year, checked as before, and drops it', () => {
    expect(parseChineseZodiacShare(params('a=horse&y=2026&ref=assistant'))).toEqual({ animal: 'horse', ref: 'assistant' });
    expect(chineseZodiacQuery(parseChineseZodiacShare(params('a=horse&y=1990'))!, true)).toBe('a=horse');
    // Another animal's year, a malformed one, and the animal's own years just outside those the tool answers for.
    const outside = [CHINESE_SHARE_FIRST_YEAR - 1, CHINESE_SHARE_LAST_YEAR + 1].map((year) => `a=${chineseAnimalForCycleYear(year).slug}&y=${year}`);
    for (const query of ['a=horse&y=2025', 'a=horse&y=02026', 'a=horse&y=2026.0', ...outside]) {
      expect(parseChineseZodiacShare(params(query)), query).toBeNull();
    }
    expect([CHINESE_SHARE_FIRST_YEAR, CHINESE_SHARE_LAST_YEAR]).toEqual([CHINESE_FIRST_YEAR + 1, CHINESE_LAST_YEAR]);
  });

  it('draws a card that is the same for every year of the animal: its yin or yang is the one get_chinese_zodiac gives each of its years', () => {
    for (let year = CHINESE_SHARE_FIRST_YEAR; year <= CHINESE_SHARE_LAST_YEAR; year += 1) {
      const animal = chineseAnimalForCycleYear(year).slug;
      const card = chineseZodiacCardModel({ animal, ref: null })!;
      expect(card.yinYang, String(year)).toBe(chineseElement(year).yinYang);
      expect(chineseZodiacCardModel(parseChineseZodiacShare(params(`a=${animal}&y=${year}`))!), String(year)).toEqual(card);
    }
  });
});

describe('an invitation to compare charts', () => {
  it('carries the two Sun signs when known, and nothing else', () => {
    expect(inviteShareUrl('https://zodiacs.org', { sun: 'taurus', partner: 'scorpio' })).toBe('https://zodiacs.org/share/invite/?s=taurus&p=scorpio');
    expect(inviteShareUrl('https://zodiacs.org', { sun: null, partner: 'scorpio' })).toBe('https://zodiacs.org/share/invite/?p=scorpio');
    expect(inviteShareUrl('https://zodiacs.org', { sun: null, partner: null })).toBe('https://zodiacs.org/share/invite/');
    expect(parseInviteShare(params('s=taurus&p=scorpio&ref=chatgpt'))).toEqual({ sun: 'taurus', partner: 'scorpio', ref: 'chatgpt' });
    expect(inviteQuery(parseInviteShare(params('p=scorpio&s=taurus'))!)).toBe('s=taurus&p=scorpio');
    // The bare page is the plain one; any birth detail or name makes it no invitation.
    for (const query of ['', 'ref=chatgpt', 's=ophiuchus', 's=taurus&n=Ana', 's=taurus&d=1990-05-03', 's=taurus&p=scorpio&t=08%3A30', 's=taurus&s=leo']) {
      expect(parseInviteShare(params(query)), query).toBeNull();
    }
  });
});

describe('a chart twins share link', () => {
  it('carries the Sun sign, and the Moon only when it was settled, never a name or a date', () => {
    expect(chartTwinsShareUrl('https://zodiacs.org', { sun: 'taurus', moon: 'leo' })).toBe('https://zodiacs.org/share/chart-twins/?s=taurus&m=leo');
    expect(chartTwinsShareUrl('https://zodiacs.org', { sun: 'pisces', moon: null })).toBe('https://zodiacs.org/share/chart-twins/?s=pisces');
    expect(chartTwinsShareUrl('https://zodiacs.org', { sun: null, moon: 'leo' })).toBeNull();
    const share = parseChartTwinsShare(params('s=taurus&m=leo&ref=chatgpt'))!;
    expect(share).toEqual({ sun: 'taurus', moon: 'leo', ref: 'chatgpt' });
    expect(chartTwinsQuery(share, true)).toBe('s=taurus&m=leo&ref=chatgpt');
    for (const query of ['m=leo', 's=ophiuchus', 's=taurus&m=sun', 's=taurus&n=Audrey+Hepburn', 's=taurus&d=1990-05-03', 's=taurus&s=leo', 's=taurus&ref=x']) {
      expect(parseChartTwinsShare(params(query)), query).toBeNull();
    }
  });

  it('is matched on the server exactly as the tool matches twins, for every pair of signs', () => {
    const people = (peopleIndex as unknown as { people: IndexedPerson[] }).people;
    const directory = people.map((person) => ({ slug: person.slug, name: person.name, sun: person.sun.sign, moon: person.moon.sign }));
    const signs = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
    for (const sun of signs) for (const moon of [null, ...signs]) {
      const tool = matchTwins({ sun, moon }, directory).map((match) => [match.person.slug, match.count]);
      expect(twinMatches({ sun, moon }, people).map((match) => [match.person.slug, match.count]), `${sun} ${moon}`).toEqual(tool);
    }
  });
});

describe('a famous chart share link', () => {
  it('carries a directory slug and nothing else', () => {
    expect(famousChartShareUrl('https://zodiacs.org', 'frida-kahlo')).toBe('https://zodiacs.org/share/famous-chart/?p=frida-kahlo');
    expect(famousChartShareUrl('https://zodiacs.org', 'Frida Kahlo')).toBeNull();
    expect(parseFamousChartShare(params('p=frida-kahlo&ref=assistant'))).toEqual({ slug: 'frida-kahlo', ref: 'assistant' });
    for (const query of ['p=Frida+Kahlo', 'p=frida-kahlo&n=Frida', 'p=../etc', 'p=frida--kahlo', `p=${'a'.repeat(65)}`, 'p=frida-kahlo&p=ada-lovelace', '']) {
      expect(parseFamousChartShare(params(query)), query).toBeNull();
    }
  });
});

describe('a life milestone share link', () => {
  const saturn = { kind: 'saturn-return', index: 1, age: 29, first: '2026-04-23T08:01:00.000Z', last: '2026-12-31T02:00:00.000Z' };

  it('carries the milestone and its age, never the birth date or the days of its passes', () => {
    // The first and last days lead back to the birth date, so a new link leaves them out.
    expect(milestoneShareUrl('https://zodiacs.org', saturn)).toBe('https://zodiacs.org/share/milestone/?k=saturn-return&i=1&a=29');
    const share = parseMilestoneShare(params('k=saturn-return&i=1&a=29&ref=chatgpt'))!;
    expect(share).toEqual({ kind: 'saturn-return', index: 1, age: 29, ref: 'chatgpt' });
    expect(milestoneQuery(share, true)).toBe('k=saturn-return&i=1&a=29&ref=chatgpt');
  });

  it('still opens an older link that carries the first and last days, and drops them', () => {
    const older = parseMilestoneShare(params('k=saturn-return&i=1&a=29&f=2026-04-23&l=2026-12-31&ref=chatgpt'))!;
    expect(older).toEqual({ kind: 'saturn-return', index: 1, age: 29, ref: 'chatgpt' });
    expect(milestoneQuery(older)).toBe('k=saturn-return&i=1&a=29');
    expect(parseMilestoneShare(params('k=uranus-opposition&i=1&a=42&f=2027-03-02&l=2027-03-02'))).toEqual({ kind: 'uranus-opposition', index: 1, age: 42, ref: null });
  });

  it('refuses a milestone that does not come at that age, or passes out of order', () => {
    for (const query of [
      'k=saturn-return&i=1&a=12&f=2026-04-23&l=2026-12-31',
      'k=uranus-opposition&i=2&a=84&f=2026-04-23&l=2026-12-31',
      'k=jupiter-return&i=1&a=12&f=2026-12-31&l=2026-04-23',
      'k=jupiter-return&i=1&a=12&f=2026-01-01&l=2027-06-30',
      'k=pluto-square&i=1&a=36&f=2026-04-23&l=2026-12-31',
      'k=saturn-return&i=01&a=29&f=2026-04-23&l=2026-12-31',
      'k=saturn-return&i=1&a=29&f=2026-04-23&l=2026-12-31&b=1997-03-15',
      'k=saturn-return&i=1&a=29&f=2026-04-23',
      'k=saturn-return&i=1&a=29&l=2026-12-31',
      'k=saturn-return&i=1&a=29&f=1997-03-15x&l=2026-12-31',
      'k=saturn-return&i=1&a=12',
      'k=saturn-return&i=1',
      'k=saturn-return&i=1&a=29&a=30',
    ]) expect(parseMilestoneShare(params(query)), query).toBeNull();
  });

  it('accepts every milestone the tool gives, back to a birth date in 1800', () => {
    const asOf = new Date('2026-10-19T12:00:00Z');
    // 1919 reaches a tenth Jupiter return at about 118; 1800, about the twentieth, past 230.
    for (const year of [1800, 1843, 1888, 1919, 1926, 1937, 1948, 1959, 1966, 1977, 1984, 1997, 2008, 2019]) {
      for (const milestone of lifeMilestones(new Date(`${year}-03-15T12:00:00Z`), asOf).milestones) {
        expect(milestoneShareUrl('https://zodiacs.org', milestone), `${year} ${milestone.kind} ${milestone.index}`).not.toBeNull();
      }
    }
  }, 240_000);

  it('gives a centenarian’s next milestone a share link', async () => {
    const result = await executeAiTool('get_life_milestones', { birthDate: '1919-03-15' }, { occasions: true, now: () => new Date('2026-10-19T12:00:00Z') });
    expect(result.ok).toBe(true);
    if (result.ok && result.tool === 'get_life_milestones') {
      expect(result.data.next).toMatchObject({ kind: 'jupiter-return', index: 10 });
      expect(result.data.shareUrl).toContain('k=jupiter-return&i=10&a=118');
    }
  });
});

describe('the tools’ share links', () => {
  const window = JSON.parse(readFileSync(new URL('../data/horoscope-window.json', import.meta.url), 'utf8')) as HoroscopeWindow;
  const noon = new Date(`${window.generatedFor}T12:00:00Z`);

  it('give a birthday’s month and day, never the birth year, with ?ref=', async () => {
    const result = await executeAiTool('get_birthday', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }, { occasions: true, now: () => NOW }, { ref: 'chatgpt' });
    expect(result.ok).toBe(true);
    expect(OUTPUT_SCHEMAS.get_birthday.safeParse(result).success).toBe(true);
    if (result.ok && result.tool === 'get_birthday') {
      expect(result.data.shareUrl).toBe('https://zodiacs.org/share/birthday/?d=05-03&ref=chatgpt');
    }
    // A cusp date names its sign once the birth year settles it.
    const cusp = await executeAiTool('get_birthday', { birthDate: '1983-04-20' }, { occasions: true, now: () => NOW });
    expect(cusp.ok).toBe(true);
    if (cusp.ok && cusp.tool === 'get_birthday') {
      expect(cusp.data.cusp).not.toBeNull();
      expect(cusp.data.shareUrl).toBe(cusp.data.sign ? `https://zodiacs.org/share/birthday/?d=04-20&s=${cusp.data.sign.slug}` : 'https://zodiacs.org/share/birthday/?d=04-20');
      expect(cusp.data.shareUrl).not.toContain('1983');
    }
  });

  it('give the sky calendar’s next event', async () => {
    const result = await executeAiTool('get_sky_calendar', {}, { occasions: true, now: () => NOW });
    expect(result.ok).toBe(true);
    expect(OUTPUT_SCHEMAS.get_sky_calendar.safeParse(result).success).toBe(true);
    if (result.ok && result.tool === 'get_sky_calendar') {
      const next = result.data.next[0];
      expect(next.title).toBe('Mercury retrograde');
      expect(result.data.shareUrl).toBe('https://zodiacs.org/share/sky-calendar/?k=retrograde&b=mercury&d=2026-10-24');
    }
    const spanish = await executeAiTool('get_sky_calendar', { language: 'es' }, { occasions: true, now: () => NOW });
    expect(spanish.ok).toBe(true);
    if (spanish.ok && spanish.tool === 'get_sky_calendar') expect(spanish.data.shareUrl).toBe('https://zodiacs.org/share/sky-calendar/?k=retrograde&b=mercury&d=2026-10-24');
  });

  it('give the reading shown, and the panel one for every day, focus and week it can show', async () => {
    const context: AiCallContext = { ref: 'assistant' };
    const result = await executeAiTool('get_horoscope', { sign: 'leo', date: window.generatedFor }, { now: () => noon, horoscopeWindow: async () => window }, context);
    expect(result.ok).toBe(true);
    expect(OUTPUT_SCHEMAS.get_horoscope.safeParse(result).success).toBe(true);
    if (result.ok && result.tool === 'get_horoscope') expect(result.data.shareUrl).toBe(`https://zodiacs.org/share/horoscope/?s=leo&d=${window.generatedFor}&ref=assistant`);
    const panel = context.horoscopePanel!;
    for (const day of panel.days) {
      expect(day.focuses.general.shareUrl).toBe(`https://zodiacs.org/share/horoscope/?s=leo&d=${day.date}&ref=assistant`);
      expect(day.focuses.love.shareUrl).toBe(`https://zodiacs.org/share/horoscope/?s=leo&d=${day.date}&f=love&ref=assistant`);
    }
    for (const week of panel.weeks) expect(week.shareUrl).toBe(`https://zodiacs.org/share/horoscope/?s=leo&w=${week.from}&ref=assistant`);
    const week = await executeAiTool('get_horoscope', { sign: 'leo', period: 'week' }, { now: () => noon, horoscopeWindow: async () => window });
    expect(week.ok).toBe(true);
    if (week.ok && week.tool === 'get_horoscope') expect(week.data.shareUrl).toMatch(/^https:\/\/zodiacs\.org\/share\/horoscope\/\?s=leo&w=\d{4}-\d{2}-\d{2}$/u);
    const choose = await executeAiTool('get_horoscope', {}, { now: () => noon, horoscopeWindow: async () => window });
    expect(choose.ok).toBe(true);
    if (choose.ok && choose.tool === 'get_horoscope') expect(choose.data.shareUrl ?? null).toBeNull();
  });

  it('give chart twins’ signs, a famous chart’s slug and the milestone shown, never a birth date', async () => {
    const twins = await executeAiTool('find_chart_twins', { birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid' }, { occasions: true, now: () => NOW }, { ref: 'chatgpt' });
    expect(twins.ok).toBe(true);
    expect(OUTPUT_SCHEMAS.find_chart_twins.safeParse(twins).success).toBe(true);
    if (twins.ok && twins.tool === 'find_chart_twins') {
      expect(twins.data.shareUrl).toBe(`https://zodiacs.org/share/chart-twins/?s=taurus&m=${twins.data.you.moon}&ref=chatgpt`);
    }
    const untimed = await executeAiTool('find_chart_twins', { birthDate: '1990-05-03' }, { occasions: true, now: () => NOW });
    if (untimed.ok && untimed.tool === 'find_chart_twins') expect(untimed.data.shareUrl).toBe('https://zodiacs.org/share/chart-twins/?s=taurus');
    const famous = await executeAiTool('get_famous_chart', { name: 'Frida Kahlo' }, { occasions: true, now: () => NOW });
    expect(OUTPUT_SCHEMAS.get_famous_chart.safeParse(famous).success).toBe(true);
    if (famous.ok && famous.tool === 'get_famous_chart' && famous.data.found) expect(famous.data.shareUrl).toBe('https://zodiacs.org/share/famous-chart/?p=frida-kahlo');
    const milestones = await executeAiTool('get_life_milestones', { birthDate: '1997-03-15' }, { occasions: true, now: () => NOW });
    expect(milestones.ok).toBe(true);
    expect(OUTPUT_SCHEMAS.get_life_milestones.safeParse(milestones).success).toBe(true);
    if (milestones.ok && milestones.tool === 'get_life_milestones') {
      const next = milestones.data.next!;
      expect(milestones.data.shareUrl).toBe(`https://zodiacs.org/share/milestone/?k=${next.kind}&i=${next.index}&a=${next.age}`);
      expect(milestones.data.shareUrl).not.toContain('1997');
      expect(milestones.data.shareUrl).not.toMatch(/[?&][fl]=|\d{4}-\d{2}-\d{2}/u);
    }
  });
});
