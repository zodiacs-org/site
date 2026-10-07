import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_META, alternatePathEntries } from '../src/lib/i18n';
import { SIGN_SLUGS } from '../src/lib/signs';
import { dailyEditions } from '../src/lib/return-visits/chart-of-day';
import {
  ABSENT_LOCALES,
  ACTIVE_HREFLANGS,
  HREFLANG_LOCALE_POLICY,
  INACTIVE_HREFLANGS,
  STAGED_NOINDEX_LOCALES,
  X_DEFAULT_HREFLANG,
  expectedHreflangsForPath,
  hreflangRouteFamily,
} from './i18n-hreflang-policy.mjs';

describe('hreflang release policy', () => {
  it('publishes Russian on core routes without activating Arabic or deferred families', () => {
    expect(HREFLANG_LOCALE_POLICY.map((entry) => entry.locale)).toEqual(LOCALES);
    expect(HREFLANG_LOCALE_POLICY.filter((entry) => entry.indexEligible).map((entry) => entry.locale))
      .toEqual(['en', 'es', 'pt', 'fr', 'it', 'ru']);
    for (const entry of HREFLANG_LOCALE_POLICY) {
      expect(entry.hreflang).toBe(LOCALE_META[entry.locale].hreflang);
    }
    expect(ACTIVE_HREFLANGS).toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'ru']);
    expect(INACTIVE_HREFLANGS).toEqual(['ar']);
    expect(STAGED_NOINDEX_LOCALES).toEqual([]);
    expect(ABSENT_LOCALES).toEqual(['ar']);
    expect(X_DEFAULT_HREFLANG).toEqual({
      hreflang: 'x-default', locale: 'en', expectedBlocks: 1129 + (dailyEditions.length + (dailyEditions.length ? 1 : 0)) * 6,
    });
    expect(hreflangRouteFamily('/fr/tools/')).toBe('core');
    expect(hreflangRouteFamily('/birthday/february-29/')).toBe('birthday');
    expect(hreflangRouteFamily('/ru/aries/')).toBe('sign-guide');
    expect(hreflangRouteFamily('/pt/horoscopes/aries/')).toBe('daily-reading');
    expect(hreflangRouteFamily('/it/rising-sign/aries/')).toBe('rising-profile');
    expect(hreflangRouteFamily('/rising-sign/')).toBe('core');
    expect(hreflangRouteFamily('/fr/eclipses/')).toBe('sky-calendar');
    expect(hreflangRouteFamily('/eclipses/2027/')).toBe(null);
    expect(hreflangRouteFamily('/es/compatibility/aries-leo/')).toBe('compatibility-pair');
    expect(hreflangRouteFamily('/compatibility/leo-aries/')).toBe(null);
    expect(hreflangRouteFamily('/compatibility/invite/')).toBe('core');
    expect([...expectedHreflangsForPath('/compatibility/pisces-pisces/')]).toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'x-default']);
    expect([...expectedHreflangsForPath('/retrogrades/')]).toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'x-default']);
    expect([...expectedHreflangsForPath('/tools/')]).toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'ru', 'x-default']);
    expect([...expectedHreflangsForPath('/birthday/february-29/')])
      .toEqual(['en', 'x-default']);
    expect([...expectedHreflangsForPath('/aries/')])
      .toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'x-default']);
    expect([...expectedHreflangsForPath('/learn/chinese-zodiac/dragon/')])
      .toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'x-default']);
    expect([...expectedHreflangsForPath('/horoscopes/aries/')]).toEqual(['en', 'es', 'pt-BR', 'x-default']);
    expect([...expectedHreflangsForPath('/horoscopes/aries/weekly/')]).toEqual([]);
    // Rising-sign profiles are translated for es, pt, fr and it; Russian links to the English ones.
    expect([...expectedHreflangsForPath('/rising-sign/aries/')])
      .toEqual(['en', 'es', 'pt-BR', 'fr', 'it', 'x-default']);
    expect(alternatePathEntries('/fr/rising-sign/aries/').map(({ href }) => href)).toEqual([
      '/rising-sign/aries/', '/es/rising-sign/aries/', '/pt/rising-sign/aries/', '/fr/rising-sign/aries/', '/it/rising-sign/aries/',
    ]);
    expect(HREFLANG_LOCALE_POLICY.find((entry) => entry.locale === 'ru')?.routeFamilies).toEqual(['core']);
    expect(HREFLANG_LOCALE_POLICY.find((entry) => entry.locale === 'ar')?.routeFamilies).toEqual([]);
  });

  it('matches application route availability for every published daily edition', () => {
    for (const path of ['/today/', '/horoscopes/', ...SIGN_SLUGS.map((sign) => `/horoscopes/${sign}/`)]) {
      for (const prefix of ['', '/es', '/pt']) {
        const expected = alternatePathEntries(`${prefix}${path}`).map(({ locale }) => LOCALE_META[locale].hreflang);
        expect([...expectedHreflangsForPath(`${prefix}${path}`)]).toEqual([...expected, 'x-default']);
      }
    }
    // Fourteen daily families, four sharing tools, three indexed return tools, twelve rising-sign profiles in
    // five languages, four sky calendars in five languages, and owner-approved dated editions.
    expect(HREFLANG_LOCALE_POLICY.find(({ locale }) => locale === 'en')?.expectedBlocks).toBe(575 + 14 * 3 + 24 + 18 + 12 * 5 + 4 * 5 + 78 * 5 + (dailyEditions.length + (dailyEditions.length ? 1 : 0)) * 6);
    for (const locale of ['es', 'pt']) {
      expect(HREFLANG_LOCALE_POLICY.find((entry) => entry.locale === locale)?.expectedBlocks).toBe(209 + 14 * 3 + 24 + 18 + 12 * 5 + 4 * 5 + 78 * 5 + (dailyEditions.length + (dailyEditions.length ? 1 : 0)) * 6);
    }
  });
});
