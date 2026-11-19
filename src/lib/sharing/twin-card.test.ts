import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { twinCardLines } from './twin-card';
import { SHARING_COPY } from './copy';

const DASHES = /[–—]/u;

describe('chart twin story card', () => {
  it('names the twin and only the shared signs', () => {
    const both = twinCardLines({ name: 'Marie Curie', sun: 'scorpio', moon: 'sagittarius' }, 'en');
    expect(both.lead).toBe('I share a Sun and Moon with');
    expect(both.name).toBe('Marie Curie');
    expect(both.signs.map((sign) => sign.label)).toEqual(['Sun in Scorpio', 'Moon in Sagittarius']);
    const sun = twinCardLines({ name: 'Marie Curie', sun: 'scorpio', moon: null }, 'en');
    expect(sun.lead).toBe('I share a Sun sign with');
    expect(sun.signs).toHaveLength(1);
    expect(twinCardLines({ name: 'X Y', sun: null, moon: 'aries' }, 'en').lead).toBe('I share a Moon sign with');
  });

  it('cleans the name and refuses a card with nothing shared', () => {
    expect(twinCardLines({ name: '  Ada\u0000 \n Lovelace ', sun: 'sagittarius', moon: null }, 'en').name).toBe('Ada Lovelace');
    expect(() => twinCardLines({ name: 'Ada Lovelace', sun: null, moon: null }, 'en')).toThrow(RangeError);
    expect(() => twinCardLines({ name: ' ', sun: 'aries', moon: null }, 'en')).toThrow(RangeError);
  });

  it('carries no birth date, time or place: its input has no field for one, and no line has a digit but the image size note', () => {
    for (const locale of ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const) {
      const lines = twinCardLines({ name: 'Marie Curie', sun: 'scorpio', moon: 'sagittarius' }, locale);
      const words = [lines.kicker, lines.lead, lines.name, ...lines.signs.map((sign) => sign.label), lines.caveat, lines.find, lines.privacy];
      for (const word of words) {
        expect(word, `${locale}: ${word}`).not.toMatch(/\d/u);
        expect(word, `${locale}: ${word}`).not.toMatch(DASHES);
      }
      expect(lines.find).toContain('zodiacs.org');
      expect(lines.find).toContain('chart-twins/');
    }
    const source = readFileSync(new URL('./twin-card.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/birthDate|\.utc\b|latitude|longitude|birthPlace|timeKnown/u);
  });

  it('uses no em or en dashes in any language', () => {
    for (const [locale, catalog] of Object.entries(SHARING_COPY)) {
      for (const [key, value] of Object.entries(catalog)) if (key.startsWith('twinsCard') || key === 'twinsShare') expect(value, `${locale}.${key}`).not.toMatch(DASHES);
    }
  });
});
