import { describe, expect, it } from 'vitest';
import { CATALOG_LOCALES } from './i18n/core';
import { SIGNS, SIGN_SLUGS, signDates } from './signs';
import { SIGN_TAGLINE_OVERRIDES, signDateRange, signTagline } from './sign-display';

const RANGE_WORDS: Record<string, string[]> = {
  en: ['to'],
  es: ['del', 'al'],
  pt: ['de', 'a'],
  fr: ['du', 'au'],
  it: ['dal', 'al'],
  ru: ['с', 'по'],
};

/** Day numbers and month abbreviations, in reading order. */
const dateTokens = (value: string) => value.match(/\d+|[\p{L}]+\.?/gu) ?? [];
const words = (value: string) => value.toLowerCase().match(/[\p{L}\p{N}’']+/gu) ?? [];

describe('signDateRange', () => {
  it('words every sign range in every catalog locale without a dash', () => {
    for (const locale of CATALOG_LOCALES) {
      const days = (value: string) => dateTokens(value)
        .filter((token) => !RANGE_WORDS[locale].includes(token));
      for (const slug of SIGN_SLUGS) {
        const range = signDateRange(slug, locale);
        expect(range, `${locale} ${slug}`).not.toMatch(/[—–]/u);
        expect(days(range), `${locale} ${slug}`).toEqual(days(signDates(slug, locale)));
        expect(days(range).filter((token) => /\d/u.test(token)), `${locale} ${slug}`).toHaveLength(2);
      }
    }
  });

  it('uses the locale range words around the table days', () => {
    expect(signDateRange('aries')).toBe('Mar 21 to Apr 19');
    expect(signDateRange('capricorn', 'en')).toBe('Dec 22 to Jan 19');
    expect(signDateRange('aries', 'es')).toBe('del 21 mar al 19 abr');
    expect(signDateRange('aquarius', 'pt')).toBe('de 20 jan a 18 fev');
    expect(signDateRange('aries', 'fr')).toBe('du 21 mars au 19 avr.');
    expect(signDateRange('pisces', 'fr')).toBe('du 19 févr. au 20 mars');
    expect(signDateRange('pisces', 'it')).toBe('dal 19 feb al 20 mar');
    expect(signDateRange('aries', 'ru')).toBe('с 21 мар по 19 апр');
    expect(signDateRange(SIGNS[0], 'en')).toBe(signDateRange('aries', 'en'));
  });

  it('needs no elided Italian article before any table day', () => {
    // "dall'1", "dall'8", "dall'11" would be required; no sign starts or ends on those days.
    for (const slug of SIGN_SLUGS) {
      const [from, to] = signDates(slug, 'it').split(' – ');
      expect(['1', '8', '11']).not.toContain(from.split(' ')[0]);
      expect(['1', '8', '11']).not.toContain(to.split(' ')[0]);
    }
  });
});

describe('signTagline', () => {
  it('prints every English essence without a dash', () => {
    for (const sign of SIGNS) {
      expect(signTagline(sign), sign.slug).not.toMatch(/[—–]/u);
      expect(signTagline(sign.slug)).toBe(signTagline(sign));
    }
  });

  it('overrides only essences that carry a dash, with exactly the same words', () => {
    for (const [slug, tagline] of Object.entries(SIGN_TAGLINE_OVERRIDES)) {
      const sign = SIGNS.find((candidate) => candidate.slug === slug)!;
      expect(sign.essence, slug).toMatch(/[—–]/u);
      expect(words(tagline), slug).toEqual(words(sign.essence));
    }
    for (const sign of SIGNS.filter((candidate) => !/[—–]/u.test(candidate.essence))) {
      expect(signTagline(sign)).toBe(sign.essence);
    }
  });
});
