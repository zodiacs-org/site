import { describe, expect, it } from 'vitest';
import publication from '../../data/locale-expansion-publication.json';
import {
  EXPANSION_FAMILY_IDS,
  EXPANSION_ROUTES,
  enabledLocalesForPath,
  expansionState,
  familyForPath,
  isHeldPreview,
  localeExpansionRoutes,
  publishedLocalesForPath,
} from './policy.mjs';

const record = (entry: Record<string, unknown>) => ({ updated: '2026-11-08', entries: { es: { 'horoscope-weekly': entry } } }) as never;

describe('locale expansion publication record', () => {
  it('is committed with every family held', () => {
    const state = expansionState(publication, {});
    expect(state.rows.length).toBeGreaterThan(0);
    expect(state.rows.every((row) => !row.published && !row.enabled)).toBe(true);
    for (const families of Object.values(publication.entries)) {
      for (const [family, entry] of Object.entries(families)) {
        expect(EXPANSION_FAMILY_IDS).toContain(family);
        expect(entry.released).toBe(false);
      }
    }
  });

  it('refuses a release without a reviewer and a review date', () => {
    expect(() => expansionState(record({ released: true, reviewer: null, reviewedAt: null }), {})).toThrow(/reviewer/);
  });

  it('publishes a reviewed family, and the preview flag only builds held ones', () => {
    const released = expansionState(record({ released: true, reviewer: 'Dias Malayev', reviewedAt: '2026-11-20' }), {});
    expect(publishedLocalesForPath('/horoscopes/leo/weekly/', released)).toEqual(['es']);
    expect(isHeldPreview('es', '/horoscopes/leo/weekly/', released)).toBe(false);

    const preview = expansionState(record({ released: false }), { PUBLIC_LOCALE_EXPANSION_PREVIEW: '1' });
    expect(publishedLocalesForPath('/horoscopes/leo/weekly/', preview)).toEqual([]);
    expect(enabledLocalesForPath('/horoscopes/leo/weekly/', preview)).toEqual(['es']);
    expect(isHeldPreview('es', '/horoscopes/leo/weekly/', preview)).toBe(true);

    const onlyPt = expansionState(record({ released: false }), { PUBLIC_LOCALE_EXPANSION_PREVIEW: 'pt' });
    expect(enabledLocalesForPath('/horoscopes/leo/weekly/', onlyPt)).toEqual([]);
    const onlyEs = expansionState(record({ released: false }), { PUBLIC_LOCALE_EXPANSION_PREVIEW: 'es,pt' });
    expect(enabledLocalesForPath('/horoscopes/leo/weekly/', onlyEs)).toEqual(['es']);
  });

  it('maps every expansion path to one family and leaves other paths alone', () => {
    expect(familyForPath('/horoscopes/')).toBe('horoscope-daily');
    expect(familyForPath('/horoscopes/pisces/')).toBe('horoscope-daily');
    expect(familyForPath('/horoscopes/pisces/2027/')).toBe('horoscope-2027');
    expect(familyForPath('/today/')).toBe('today');
    expect(familyForPath('/full-moon/2026-11-24/')).toBe('full-moon');
    expect(familyForPath('/new-moon/2026-12-09/')).toBe('new-moon');
    expect(familyForPath('/learn/zodiac-dates/')).toBe('zodiac-dates');
    expect(familyForPath('/full-moon-calendar/')).toBeUndefined();
    expect(familyForPath('/compatibility/aries-leo/')).toBeUndefined();
  });

  it('injects no route while every family is held', () => {
    const injected: unknown[] = [];
    localeExpansionRoutes(expansionState(publication, {})).hooks['astro:config:setup']({ injectRoute: (route: unknown) => injected.push(route) });
    expect(injected).toEqual([]);
    const all: unknown[] = [];
    localeExpansionRoutes(expansionState(publication, { PUBLIC_LOCALE_EXPANSION_PREVIEW: '1' })).hooks['astro:config:setup']({ injectRoute: (route: unknown) => all.push(route) });
    expect(all).toHaveLength(EXPANSION_ROUTES.length);
  });
});
