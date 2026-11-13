import { describe, expect, it } from 'vitest';
import { synastryLine } from './compat';
import { contactLine } from './contact-line';
import { isGenerationalContact } from './generational-contact';
import { rankedContacts, type InterAspect } from './engine/synastry';

const contact = (a: string, b: string, type: InterAspect['type'], orb: number): InterAspect => ({ a, aLon: 0, b, bLon: 0, type, orb });

describe('generational contacts', () => {
  it('counts every aspect among Uranus, Neptune and Pluto, and slow planets conjunct themselves', () => {
    for (const type of ['conjunction', 'sextile', 'square', 'trine', 'opposition'] as const) {
      expect(isGenerationalContact({ a: 'Neptune', b: 'Pluto', type })).toBe(true);
      expect(isGenerationalContact({ a: 'Uranus', b: 'Uranus', type })).toBe(true);
    }
    expect(isGenerationalContact({ a: 'Saturn', b: 'Saturn', type: 'conjunction' })).toBe(true);
    expect(isGenerationalContact({ a: 'Saturn', b: 'Saturn', type: 'opposition' })).toBe(false);
    expect(isGenerationalContact({ a: 'Saturn', b: 'Uranus', type: 'square' })).toBe(false);
    expect(isGenerationalContact({ a: 'Venus', b: 'Pluto', type: 'conjunction' })).toBe(false);
  });

  it('never lets a generational contact open the list ahead of a personal one', () => {
    const ranked = rankedContacts([
      contact('Neptune', 'Pluto', 'sextile', 0.1),
      contact('Uranus', 'Neptune', 'trine', 0.2),
      contact('Venus', 'Mars', 'square', 4.5),
      contact('Sun', 'Moon', 'trine', 2),
    ]);
    expect(ranked.map((row) => `${row.a}-${row.b}`)).toEqual(['Sun-Moon', 'Venus-Mars', 'Neptune-Pluto', 'Uranus-Neptune']);
  });

  it('words a generational contact as a shared backdrop, and leaves every other line as synastryLine writes it', () => {
    const line = contactLine('Ana', 'Pluto', 'Ben', 'Pluto', 'conjunction');
    expect(line).toBe('Ana’s intensity lines up with Ben’s. A shared generational backdrop, common to many people born in the same years.');
    expect(line).not.toMatch(/strongly/u);
    expect(contactLine('Ana', 'Neptune', 'Ben', 'Pluto', 'opposition')).toBe('Ana’s imagination faces Ben’s intensity. A shared generational backdrop, common to many people born in the same years.');
    expect(contactLine('Ana', 'Venus', 'Ben', 'Pluto', 'conjunction')).toBe(synastryLine('Ana', 'Venus', 'Ben', 'Pluto', 'conjunction'));
    expect(line).not.toMatch(/[–—]/u);
  });
});
