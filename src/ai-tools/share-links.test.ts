import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OUTPUT_SCHEMAS } from './contracts';
import {
  birthdayQuery,
  birthdayShareUrl,
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
    expect(parseHoroscopeShare(params('s=leo&w=2026-10-12'))).toEqual({ sign: 'leo', date: '2026-10-12', week: true, focus: 'general', ref: null });
    expect(horoscopeQuery(parseHoroscopeShare(params('s=leo&d=2026-10-17&f=general'))!)).toBe('s=leo&d=2026-10-17');
    for (const query of ['s=leo', 's=leo&d=2026-10-17&w=2026-10-12', 's=leo&w=2026-10-12&f=love', 's=leo&d=2026-10-17&f=money', 's=leo&d=2026-10-17&text=You+will+win', 's=leo&w=2026-10-14', 'd=2026-10-17']) {
      expect(parseHoroscopeShare(params(query)), query).toBeNull();
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
});
