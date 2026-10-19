import { SITE_CLOCK } from './site-clock';
import { describe, expect, it } from 'vitest';
import { occasionCard, validOccasionDate } from './card';
import { OCCASION_KINDS } from './kinds';
import { OCCASION_WORDS, SIGN_THEME, sunMoonLine } from './lines';

describe('occasion card words', () => {
  it('has a title and closing line for every occasion and a theme for every sign', () => {
    for (const kind of OCCASION_KINDS) {
      expect(OCCASION_WORDS[kind].title).toBeTruthy();
      expect(OCCASION_WORDS[kind].closing).toMatch(/\.$/u);
    }
    expect(Object.keys(SIGN_THEME)).toHaveLength(12);
  });

  it('never promises, predicts or ranks', () => {
    const text = [...Object.values(OCCASION_WORDS).flatMap((words) => [words.title, words.closing]), ...Object.values(SIGN_THEME)].join(' ');
    expect(text).not.toMatch(/\b(will|lucky|unlucky|best|worst|perfect|guarantee|destined|fated|ideal|good day|bad day)\b/iu);
  });

  it('pairs the Sun and Moon themes, and says it once when they share a sign', () => {
    expect(sunMoonLine('gemini', 'libra')).toBe('A Gemini Sun is the sign of conversation; a Libra Moon, of partnership.');
    expect(sunMoonLine('leo', 'leo')).toBe('The Sun and Moon are both in Leo, the sign of warmth and celebration.');
    // "An" before the two signs that start with a vowel, Sun or Moon.
    expect(sunMoonLine('aries', 'pisces')).toBe('An Aries Sun is the sign of beginnings; a Pisces Moon, of imagination and tenderness.');
    expect(sunMoonLine('capricorn', 'aquarius')).toMatch(/^A Capricorn Sun is the sign of .+; an Aquarius Moon, of .+\.$/u);
    for (const sun of Object.keys(SIGN_THEME)) for (const moon of Object.keys(SIGN_THEME)) {
      expect(sunMoonLine(sun, moon), `${sun} ${moon}`).not.toMatch(/\b[Aa] [AEIOU]/u);
    }
    expect(() => sunMoonLine('ophiuchus', 'leo')).toThrow(RangeError);
  });
});

describe('occasion card', () => {
  it('makes the Florence wedding card with its evening', async () => {
    const card = await occasionCard({
      occasion: 'wedding',
      date: '2027-06-12',
      time: '19:00',
      timeZone: 'Europe/Rome',
      place: { name: 'Florence, Italy', lat: 43.7696, lon: 11.2558 },
    }, SITE_CLOCK);
    expect(card.instant).toBe('2027-06-12T17:00:00.000Z');
    expect(card.words.title).toBe('The sky on your wedding day');
    expect(card.words.interpretation).toContain('Gemini Sun');
    expect(card.evening?.goldenHour?.start.slice(0, 16)).toBe('2027-06-12T18:13');
    expect(card.moonSignChange).toBeNull();
  });

  it('flags a day on which the Moon changes sign when no time is given', async () => {
    // The Moon moved from Pisces into Aries on 23 October 2026 (UTC).
    const card = await occasionCard({ occasion: 'baby', date: '2026-10-23', time: null, timeZone: null, place: null }, SITE_CLOCK);
    expect(card.moonSignChange).toEqual({ from: 'pisces', to: 'aries' });
    const next = await occasionCard({ occasion: 'baby', date: '2026-10-24', time: null, timeZone: null, place: null }, SITE_CLOCK);
    expect(next.moonSignChange).toBeNull();
  });

  it('reads a date-only card before standard time on the place’s own local mean time', async () => {
    // Rio de Janeiro, 1900: Sao Paulo's zone was still on local mean time, so
    // Rio's own clock (43.2° W, 2 h 52 min 48 s behind UTC) sets local noon.
    const card = await occasionCard({
      occasion: 'wedding', date: '1900-06-15', time: null, timeZone: 'America/Sao_Paulo',
      place: { name: 'Rio de Janeiro, Brazil', lat: -22.9, lon: -43.2 },
    }, SITE_CLOCK);
    expect(card.instant).toBe('1900-06-15T14:52:48.000Z');
    expect(card.evening?.utcOffsetMinutes).toBe(-173);
  });

  it('refuses impossible input', async () => {
    expect(validOccasionDate('2027-02-30')).toBe(false);
    expect(validOccasionDate('1799-12-31')).toBe(false);
    await expect(occasionCard({ occasion: 'wedding', date: '2027-06-12', time: '19:00', timeZone: null, place: null }, SITE_CLOCK)).rejects.toThrow(RangeError);
  });
});
