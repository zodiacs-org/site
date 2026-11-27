import { describe, expect, it } from 'vitest';
import { sunYearView, type SunYearTense } from './sun-year';
import { SUN_YEAR_WORDS, type SunYearLocale } from './sun-year-words';
import { SIGN_SLUGS, signBySlug } from './signs';

const at = (iso: string) => new Date(iso);

describe('sunYearView', () => {
  it('shows the year that contains the edition date, for every sign', () => {
    const now = at('2026-11-26T12:00:00Z');
    for (const slug of SIGN_SLUGS) {
      const view = sunYearView(slug, now);
      expect(view, slug).not.toBeNull();
      expect(view!.year).toHaveLength(12);
      expect(view!.year[0].sign).toBe('aries');
      expect(view!.year[0].start.startsWith('2026-03-20')).toBe(true);
      expect(Date.parse(view!.year[11].end)).toBeGreaterThan(now.getTime());
      expect(view!.mine.sign).toBe(slug);
    }
  });

  it('marks a season under way, with no next line', () => {
    const view = sunYearView('sagittarius', at('2026-11-26T12:00:00Z'))!;
    expect(view.tense).toBe('under-way');
    expect(view.mine.start.startsWith('2026-11-22')).toBe(true);
    expect(view.next).toBeNull();
  });

  it('marks a season still ahead in the same year', () => {
    const view = sunYearView('capricorn', at('2026-11-26T12:00:00Z'))!;
    expect(view.tense).toBe('ahead');
    expect(view.mine.start.startsWith('2026-12-21')).toBe(true);
    expect(view.next).toBeNull();
  });

  it('marks a season already past in the same year, and gives the next one', () => {
    const view = sunYearView('leo', at('2026-11-26T12:00:00Z'))!;
    expect(view.tense).toBe('past');
    expect(view.mine.start.startsWith('2026-07-22')).toBe(true);
    expect(view.next?.sign).toBe('leo');
    expect(view.next?.start.startsWith('2027-07-23')).toBe(true);
  });

  it('a season that ended at the very instant is past', () => {
    const view = sunYearView('scorpio', at('2026-11-22T07:23:20.577Z'))!;
    expect(view.tense).toBe('past');
    expect(sunYearView('sagittarius', at('2026-11-22T07:23:20.577Z'))!.tense).toBe('under-way');
  });

  it('just before the March equinox keeps the old year, with Pisces under way', () => {
    const now = at('2027-03-20T12:00:00Z');
    const pisces = sunYearView('pisces', now)!;
    expect(pisces.year[0].start.startsWith('2026-03-20')).toBe(true);
    expect(pisces.tense).toBe('under-way');
    const aries = sunYearView('aries', now)!;
    expect(aries.tense).toBe('past');
    expect(aries.next?.start.startsWith('2027-03-20')).toBe(true);
  });

  it('just after the March equinox starts the new year, with Aries under way', () => {
    const now = at('2027-03-21T12:00:00Z');
    const aries = sunYearView('aries', now)!;
    expect(aries.year[0].start.startsWith('2027-03-20')).toBe(true);
    expect(aries.tense).toBe('under-way');
    const pisces = sunYearView('pisces', now)!;
    expect(pisces.tense).toBe('ahead');
    expect(pisces.mine.start.startsWith('2028-02')).toBe(true);
  });

  it('renders nothing where the table does not cover the year', () => {
    expect(sunYearView('aries', at('2026-02-01T12:00:00Z'))).toBeNull();
    expect(sunYearView('aries', at('2045-01-01T12:00:00Z'))).toBeNull();
  });
});

describe('the ring’s accessible name', () => {
  const tenses: SunYearTense[] = ['past', 'under-way', 'ahead'];
  const locales = Object.keys(SUN_YEAR_WORDS) as SunYearLocale[];

  it('is written in all six guide languages', () => {
    expect(locales.sort()).toEqual(['en', 'es', 'fr', 'it', 'pt', 'ru']);
  });

  for (const locale of locales) {
    it(`follows the season’s tense in ${locale}`, () => {
      for (const slug of SIGN_SLUGS) {
        const family = ['A', 'B', 'C'];
        const texts = tenses.map((tense) => SUN_YEAR_WORDS[locale].alt(slug, '22 July', '8 August', signBySlug(slug).element, family, tense));
        for (const text of texts) {
          expect(text, `${locale} ${slug}`).not.toMatch(/undefined|null|NaN|[\u2013\u2014]/u);
          expect(text).toContain('22 July');
          expect(text).toContain('8 August');
        }
        // Past, under way and ahead each read differently.
        expect(new Set(texts).size, `${locale} ${slug}`).toBe(3);
      }
    });
  }

  it('says ran, runs and will run in English', () => {
    const say = (tense: SunYearTense) => SUN_YEAR_WORDS.en.alt('leo', 'July 22', 'August 22', 'fire', ['Aries', 'Leo', 'Sagittarius'], tense);
    expect(say('past')).toContain('Leo ran from July 22 to August 22.');
    expect(say('under-way')).toContain('Leo runs from July 22 to August 22.');
    expect(say('ahead')).toContain('Leo will run from July 22 to August 22.');
  });
});
