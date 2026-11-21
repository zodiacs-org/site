import { describe, expect, it } from 'vitest';
import { isBirthOccasionLink, occasionCardLink } from './card-link';
import { BIRTH_OCCASIONS } from './saved-path';
import { OCCASION_KINDS } from './kinds';

/**
 * Links never carry a birth year, a birth time, a birthplace or the names you give (AGENTS.md). On the site's
 * occasions page a birthday's day can be a birth date, so its card gets no link at all, as the assistant's card does
 * not. Every date, name and place here is made up for the test.
 */
const PAGE = 'https://zodiacs.org/occasions/';
const PLACE = { tz: 'Europe/Lisbon', lat: 38.72231, lon: -9.13934, label: 'Lisbon, Portugal' };

describe('the occasions page card link', () => {
  it('is not made for a birthday, a baby or a coming of age, whatever is given', () => {
    expect([...BIRTH_OCCASIONS].sort()).toEqual(['baby', 'birthday', 'coming-of-age']);
    for (const occasion of BIRTH_OCCASIONS) {
      expect(occasionCardLink(PAGE, { occasion, names: 'Robin', date: '1994-03-21', time: '06:10', place: PLACE }), occasion).toBeNull();
      expect(occasionCardLink(PAGE, { occasion, names: '', date: '1994-03-21', time: '', place: null }), occasion).toBeNull();
    }
  });

  it('keeps every other occasion\'s card link after the #, as before', () => {
    for (const occasion of OCCASION_KINDS.filter((kind) => !BIRTH_OCCASIONS.has(kind))) {
      const link = occasionCardLink(PAGE, { occasion, names: '', date: '2027-06-12', time: '', place: null });
      expect(link, occasion).toBe(`${PAGE}#o=${encodeURIComponent(occasion)}&d=2027-06-12`);
      expect(new URL(link!).search, occasion).toBe('');
    }
    const wedding = occasionCardLink(PAGE, { occasion: 'wedding', names: 'Sam & Alex', date: '2027-06-12', time: '17:00', place: PLACE })!;
    expect(Object.fromEntries(new URLSearchParams(new URL(wedding).hash.slice(1)))).toEqual({
      o: 'wedding', d: '2027-06-12', n: 'Sam & Alex', t: '17:00', tz: 'Europe/Lisbon', lat: '38.7223', lon: '-9.1393', place: 'Lisbon, Portugal',
    });
  });

  it('recognises an older birth occasion link, so the page can take it out of the address bar', () => {
    expect(isBirthOccasionLink('#o=birthday&d=1994-03-21&n=Robin')).toBe(true);
    expect(isBirthOccasionLink('o=coming-of-age&d=2008-01-01')).toBe(true);
    expect(isBirthOccasionLink('#o=wedding&d=2027-06-12')).toBe(false);
    expect(isBirthOccasionLink('')).toBe(false);
  });
});
