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

  it('refuses a release whose review date is not a plain YYYY-MM-DD day', () => {
    for (const reviewedAt of ['04/01/2028', '2027-12-31T23:00:00-05:00', '2027-1-5', ' 2027-01-05', 20270105]) {
      expect(() => expansionState(record({ released: true, reviewer: 'R', reviewedAt }), {}), String(reviewedAt)).toThrow(/YYYY-MM-DD/);
    }
    expect(publishedLocalesForPath('/horoscopes/leo/weekly/', expansionState(record({ released: true, reviewer: 'R', reviewedAt: '2027-01-05' }), {}))).toEqual(['es']);
    // A held entry may carry any draft value.
    expect(() => expansionState(record({ released: false, reviewer: null, reviewedAt: '04/01/2028' }), {})).not.toThrow();
  });

  it('refuses a yearly family reviewed after its year ended, and only yearly families', () => {
    const yearly = (reviewedAt: string) => ({ updated: '2026-11-08', entries: { es: { 'horoscope-2027': { released: true, reviewer: 'R', reviewedAt } } } }) as never;
    expect(() => expansionState(yearly('2028-01-04'), {})).toThrow('locale expansion: horoscope-2027 is for a year that ended before its review date');
    expect(publishedLocalesForPath('/horoscopes/leo/2027/', expansionState(yearly('2027-12-31'), {}))).toEqual(['es']);
    expect(publishedLocalesForPath('/horoscopes/leo/2027/', expansionState(yearly('2026-11-20'), {}))).toEqual(['es']);
    // A held yearly entry is never refused, and a non-yearly family reviewed in any year is unaffected.
    expect(() => expansionState({ updated: '2026-11-08', entries: { es: { 'horoscope-2027': { released: false, reviewer: 'R', reviewedAt: '2030-01-01' } } } } as never, {})).not.toThrow();
    expect(publishedLocalesForPath('/horoscopes/leo/weekly/', expansionState(record({ released: true, reviewer: 'R', reviewedAt: '2031-02-01' }), {}))).toEqual(['es']);
  });

  it('has no 2026 yearly family in the expansion, under the preview flag too', () => {
    expect(EXPANSION_FAMILY_IDS).not.toContain('horoscope-2026');
    expect(familyForPath('/horoscopes/leo/2026/')).toBeUndefined();
    for (const families of Object.values(publication.entries)) expect(Object.keys(families)).not.toContain('horoscope-2026');
    const preview = expansionState(publication, { PUBLIC_LOCALE_EXPANSION_PREVIEW: '1' });
    expect(enabledLocalesForPath('/horoscopes/leo/2026/', preview)).toEqual([]);
    expect(enabledLocalesForPath('/horoscopes/leo/2027/', preview)).toEqual(['es', 'pt', 'fr', 'it']);
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

  it('releases part of a family when the entry lists its paths', () => {
    const state = expansionState(record({ released: true, reviewer: 'R', reviewedAt: '2026-11-20', paths: ['/horoscopes/leo/weekly/'] }), {});
    expect(publishedLocalesForPath('/horoscopes/leo/weekly/', state)).toEqual(['es']);
    expect(publishedLocalesForPath('/horoscopes/virgo/weekly/', state)).toEqual([]);
    expect(enabledLocalesForPath('/horoscopes/virgo/weekly/', state)).toEqual([]);
    expect(isHeldPreview('es', '/horoscopes/leo/weekly/', state)).toBe(false);
    expect(() => expansionState(record({ released: true, reviewer: 'R', reviewedAt: '2026-11-20', paths: ['/today/'] }), {})).toThrow(/outside its family/);
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
    // es and pt already publish the daily family, so they get 4 routes; fr and it get all 7.
    expect(all).toHaveLength(4 + 4 + EXPANSION_ROUTES.length * 2);
    expect(all).toContainEqual({ pattern: '/it/horoscopes/[sign]/', entrypoint: './src/locale-pages/it/horoscope-daily.astro' });
  });
});
