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
      place: { name: 'Florence, Italy', latitude: 43.7696, longitude: 11.2558 },
    });
    expect(card.instant).toBe('2027-06-12T17:00:00.000Z');
    expect(card.words.title).toBe('The sky on your wedding day');
    expect(card.words.interpretation).toContain('Gemini Sun');
    expect(card.evening?.goldenHour?.start.slice(0, 16)).toBe('2027-06-12T18:13');
    expect(card.moonSignChange).toBeNull();
  });

  it('flags a day on which the Moon changes sign when no time is given', async () => {
    // The Moon moved from Pisces into Aries on 23 October 2026 (UTC).
    const card = await occasionCard({ occasion: 'baby', date: '2026-10-23', time: null, timeZone: null, place: null });
    expect(card.moonSignChange).toEqual({ from: 'pisces', to: 'aries' });
    const next = await occasionCard({ occasion: 'baby', date: '2026-10-24', time: null, timeZone: null, place: null });
    expect(next.moonSignChange).toBeNull();
  });

  it('refuses impossible input', async () => {
    expect(validOccasionDate('2027-02-30')).toBe(false);
    expect(validOccasionDate('1799-12-31')).toBe(false);
    await expect(occasionCard({ occasion: 'wedding', date: '2027-06-12', time: '19:00', timeZone: null, place: null })).rejects.toThrow(RangeError);
  });
});
