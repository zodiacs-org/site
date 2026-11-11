import { describe, expect, it } from 'vitest';
import { MAJOR_ARCANA, tarotYearCard } from './year-card';

describe('the tarot year card', () => {
  it('adds the month and day to the year and reduces to 22 or less, reading 22 as the Fool', () => {
    // 3 + 15 + 2026 = 2044 -> 10 (Wheel of Fortune)
    expect(tarotYearCard(3, 15, 2026).name).toBe('Wheel of Fortune');
    // 12 + 31 + 2026 = 2069 -> 17 (The Star)
    expect(tarotYearCard(12, 31, 2026).name).toBe('The Star');
    // 2 + 2 + 2018 = 2022 -> 6 (The Lovers)
    expect(tarotYearCard(2, 2, 2018).name).toBe('The Lovers');
    // 9 + 9 + 1975 = 1993 -> 22, read as The Fool
    expect(tarotYearCard(9, 9, 1975)).toMatchObject({ number: 0, name: 'The Fool' });
  });
  it('has the 22 Major Arcana in order, each reading plain, with no dashes and no literal death or trading call', () => {
    expect(MAJOR_ARCANA.map((card) => card.number)).toEqual([...Array(22).keys()]);
    const banned = /\b(?:buy|sell|stocks?|crypto\w*|bitcoin|diagnos\w*|die|dies|dying)\b|\byou will (?:win|lose)\b|[–—]/iu;
    for (const card of MAJOR_ARCANA) expect(card.year, card.name).not.toMatch(banned);
    expect(MAJOR_ARCANA[13].year).toContain('It is not read literally.');
  });
});
