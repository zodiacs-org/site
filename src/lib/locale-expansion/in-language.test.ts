import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCALE_META } from '../i18n';
import type { ExpansionLocale } from './horoscope/types';

// The localized period, Moon and zodiac dates pages give their JSON-LD the
// same language tag as the page's <html lang> (Base.astro reads
// LOCALE_META[locale].htmlLang), so Portuguese is pt-BR in both places.
const PAGES = ['LocalizedHoroscopePeriod', 'LocalizedLunationPage', 'LocalizedZodiacDates'];
const LOCALES: ExpansionLocale[] = ['es', 'pt', 'fr', 'it', 'ru'];

describe('localized expansion pages: JSON-LD inLanguage', () => {
  it.each(PAGES)('%s takes the html lang tag, not the locale key', (page) => {
    const source = readFileSync(new URL(`../../components/localized/${page}.astro`, import.meta.url), 'utf8');
    const values = [...source.matchAll(/inLanguage:\s*([^,\n}]+)/gu)].map((match) => match[1].trim());
    expect(values.length).toBeGreaterThan(0);
    expect(values.every((value) => value === 'LOCALE_META[locale].htmlLang')).toBe(true);
  });

  it('gives Portuguese pt-BR and the other expansion locales their own key', () => {
    const base = readFileSync(new URL('../../layouts/Base.astro', import.meta.url), 'utf8');
    expect(base).toContain('lang={LOCALE_META[locale].htmlLang}');
    expect(Object.fromEntries(LOCALES.map((locale) => [locale, LOCALE_META[locale].htmlLang])))
      .toEqual({ es: 'es', pt: 'pt-BR', fr: 'fr', it: 'it', ru: 'ru' });
  });
});
