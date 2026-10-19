import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ART_CARDS,
  ART_CARD_DIR,
  ART_CARD_DISC,
  HOME_ART_CARD,
  HOME_ART_CARD_ALT,
  HOME_ART_CARD_COPY,
  HOME_ART_CARD_CROP,
  HOME_ART_CARD_SCRIM,
  SIGN_ART_CARD_ART,
  SIGN_ART_CARD_SHADE,
  horoscopeArtCard,
  horoscopeArtCardCopy,
  signArtCard,
  signArtCardCopy,
} from './og-art-cards.mjs';
import {
  ART_CARD_LOCALES,
  HOROSCOPE_ART_CARD_LOCALES,
  LOCALIZED_ART_CARDS,
  LOCALIZED_ART_CARDS_MAX_TOTAL_BYTES,
  homeArtCard,
  localizedHomeArtCardCopy,
  localizedHoroscopeArtCard,
  localizedHoroscopeArtCardCopy,
  localizedSignArtCardCopy,
} from './og-art-cards.mjs';
import { captionLead, renderLocalizedArtCardCopyModule } from './og-art-cards-copy';
import { HOME_COPY } from '../components/localized/home-copy';
import { LOCALIZED_HOROSCOPE_COPY } from '../components/localized/horoscope-copy';
import { spanishGuideFor } from '../data/es-guides';
import { frenchGuideFor } from '../data/fr-guides';
import { italianGuideFor } from '../data/it-guides';
import { portugueseGuideFor } from '../data/pt-guides';
import { signDateRange as localSignDateRange } from './sign-display';
import { signName } from './signs';
import { HOROSCOPE_OG_SURFACES } from '../strings/seo.en.mjs';
import { guideFacts, signOrdinal } from './guide-facts';
import { signTagline } from './sign-display';
import { SIGNS } from './signs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const DASHES = /[‒-―−]/u;

describe('the art share cards (owner-chosen 2026-10-19)', () => {
  it('prints on each sign card what its guide prints at the top of the page', () => {
    SIGNS.forEach((sign, index) => {
      const copy = signArtCardCopy(sign.slug);
      expect(copy.kicker, sign.slug).toBe(`The ${signOrdinal(index)} sign of the zodiac`);
      expect(copy.name, sign.slug).toBe(sign.name);
      expect(copy.line, sign.slug).toBe(signTagline(sign));
      const { longRange } = guideFacts(sign, { name: 'star', note: 'note' });
      expect(copy.sub, sign.slug).toBe(`The Sun sign for birthdays from ${longRange}.`);
      for (const words of Object.values(copy)) expect(words, sign.slug).not.toMatch(DASHES);
    });
    expect(() => signArtCardCopy('ophiuchus')).toThrow(/unknown sign/u);
  });

  it('carries each horoscope card\'s kicker and line, with the sign card\'s name and birthday sentence', () => {
    expect(HOROSCOPE_OG_SURFACES.map((surface) => surface.key)).toEqual(['today', 'tomorrow', 'weekly', 'monthly', 'love', 'career', 'year']);
    SIGNS.forEach((sign) => {
      for (const surface of HOROSCOPE_OG_SURFACES) {
        const copy = horoscopeArtCardCopy(sign.slug, surface.key);
        const signCopy = signArtCardCopy(sign.slug);
        expect(copy).toEqual({ kicker: surface.kicker, name: sign.name, line: surface.subtitle, sub: signCopy.sub });
        for (const words of Object.values(copy)) expect(words, `${sign.slug} ${surface.key}`).not.toMatch(DASHES);
      }
    });
    expect(() => horoscopeArtCardCopy('aries', 'decade')).toThrow(/unknown horoscope/u);
  });

  it('takes the homepage headline from the hero, and cuts the poster inside its frame', () => {
    const home = read('src/pages/index.astro');
    expect(home).toContain(`<h1 class="hero__title">${HOME_ART_CARD_COPY.title}</h1>`);
    expect(home).toContain(`<p class="hero__sub">${HOME_ART_CARD_COPY.subtitle.replace(/\.$/u, ':')}`);
    for (const words of [HOME_ART_CARD_COPY.title, HOME_ART_CARD_COPY.subtitle, HOME_ART_CARD_ALT]) {
      expect(words).not.toMatch(DASHES);
    }
    const { x, y, width, height } = HOME_ART_CARD_CROP;
    expect(width / height).toBeCloseTo(1200 / 630, 6);
    expect(x + width).toBeLessThanOrEqual(1600);
    expect(y + height).toBeLessThanOrEqual(900);
  });

  it('lays the art and its shade the way the two heroes do', () => {
    const home = read('src/pages/index.astro');
    for (const layer of HOME_ART_CARD_SCRIM) expect(home).toContain(layer);
    const guide = read('src/components/SignGuideHero.astro');
    expect(guide).toContain(`width: ${SIGN_ART_CARD_ART.width};`);
    expect(guide).toContain(`object-position: ${SIGN_ART_CARD_ART.position};`);
    expect(guide).toContain(`filter: ${SIGN_ART_CARD_ART.filter};`);
    expect(guide).toContain(`mask-image: ${SIGN_ART_CARD_ART.mask};`);
    for (const layer of SIGN_ART_CARD_SHADE) expect(guide).toContain(layer);
  });

  it('names its JPEGs in a folder of their own, the homepage card dated for its immutable cache', () => {
    expect(ART_CARD_DIR).toBe('/assets/og/v8');
    expect(HOME_ART_CARD).toBe('/assets/og/v8/home-20261019.jpg');
    expect(signArtCard('aries')).toBe('/assets/og/v8/sign/aries.jpg');
    expect(() => signArtCard('ophiuchus')).toThrow(/unknown sign/u);
    expect(horoscopeArtCard('aries', 'today')).toBe('/assets/og/v8/horoscope/aries.jpg');
    expect(horoscopeArtCard('sagittarius', 'year')).toBe('/assets/og/v8/horoscope/sagittarius-2027.jpg');
    expect(() => horoscopeArtCard('ophiuchus', 'today')).toThrow(/unknown sign/u);
    expect(ART_CARDS).toEqual([
      HOME_ART_CARD,
      ...SIGNS.map((sign) => `/assets/og/v8/sign/${sign.slug}.jpg`),
      ...SIGNS.flatMap((sign) => HOROSCOPE_OG_SURFACES.map((surface) => `/assets/og/v8/horoscope/${sign.slug}${surface.suffix ? `-${surface.suffix}` : ''}.jpg`)),
    ]);
    expect(ART_CARDS).toHaveLength(97);
    // The sign's disc is drawn large, from the 400px tier of the canonical icons (owner's call, 2026-10-19).
    expect(ART_CARD_DISC).toBeGreaterThanOrEqual(128);
    expect(read('scripts/build-og-void.mjs')).toContain('public/assets/zodiac-icons/400/${s.slug}.webp');
    const config = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] };
    const rule = config.headers.find((entry) => entry.source === HOME_ART_CARD);
    expect(rule?.headers.find((header) => header.key === 'Cache-Control')?.value).toBe('public, max-age=31536000, immutable');
  });

  it('is what the homepage, the fallback and every page with a sign or horoscope card link', () => {
    expect(read('src/pages/index.astro')).toContain('image={HOME_ART_CARD}');
    expect(read('src/components/SEO.astro')).toContain(': explicitImage ?? catalogImage ?? (ART_CARD_LOCALES.includes(locale) ? homeArtCard(locale) : HOME_ART_CARD);');
    for (const page of [
      'src/pages/[sign]/index.astro',
      'src/pages/es/[sign]/index.astro',
      'src/pages/fr/[sign]/index.astro',
      'src/pages/it/[sign]/index.astro',
      'src/pages/pt/[sign]/index.astro',
      'src/pages/birthday/[slug].astro',
      'src/components/programmatic/LocalizedBirthdayPage.astro',
    ]) {
      const source = read(page);
      expect(source, page).toContain('signArtCard(');
      expect(source, page).not.toContain('/assets/og/v2/sign/');
    }
    const horoscopes = read('src/components/HoroscopeProgramPage.astro');
    expect(horoscopes).toContain('const ogImage = horoscopeArtCard(sign.slug, surface);');
    expect(horoscopes).not.toContain('/assets/og/v2/horoscope/');
  });
});

describe('the Spanish, French, Italian and Portuguese art cards', () => {
  const guides = { es: spanishGuideFor, fr: frenchGuideFor, it: italianGuideFor, pt: portugueseGuideFor } as const;
  const upper = (value: string, locale: string) => value.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase(locale));

  it('carries the words og-art-cards-copy.ts reads from the pages (regenerate with build-og-art-card-copy.ts)', () => {
    expect(read('src/lib/og-art-cards.locales.mjs')).toBe(renderLocalizedArtCardCopyModule());
  });

  it('prints on each card what its localized page prints at the top', () => {
    expect([...ART_CARD_LOCALES]).toEqual(['es', 'fr', 'it', 'pt']);
    for (const locale of ART_CARD_LOCALES) {
      const hero = HOME_COPY[locale].hero;
      const home = localizedHomeArtCardCopy(locale);
      expect(home.title, locale).toBe(hero.title);
      expect(home.subtitle, locale).toBe(captionLead(hero.sub));
      expect(hero.sub.startsWith(home.subtitle.replace(/\.$/u, '')), locale).toBe(true);
      for (const sign of SIGNS) {
        const copy = localizedSignArtCardCopy(sign.slug, locale);
        const intro = guides[locale](sign).intro[0];
        expect(copy.name, `${locale} ${sign.slug}`).toBe(signName(sign, locale));
        // The first sentence of the hero's line, word for word.
        expect(intro.startsWith(copy.line), `${locale} ${sign.slug}`).toBe(true);
        expect(copy.line, `${locale} ${sign.slug}`).toMatch(/[.!?]$/u);
        expect(copy.sub, `${locale} ${sign.slug}`).toBe(upper(localSignDateRange(sign, locale), locale));
        for (const words of Object.values(copy)) expect(words, `${locale} ${sign.slug}`).not.toMatch(DASHES);
      }
    }
    expect([...HOROSCOPE_ART_CARD_LOCALES]).toEqual(['es', 'pt']);
    for (const locale of HOROSCOPE_ART_CARD_LOCALES as readonly ('es' | 'pt')[]) {
      const page = LOCALIZED_HOROSCOPE_COPY[locale];
      for (const sign of SIGNS) {
        const copy = localizedHoroscopeArtCardCopy(sign.slug, locale);
        expect(copy.kicker).toBe(page.crumbs);
        expect(copy.name).toBe(page.h1(signName(sign, locale)));
        expect(copy.sub).toBe(upper(localSignDateRange(sign, locale), locale));
      }
    }
    expect(() => localizedHoroscopeArtCard('aries', 'fr')).toThrow(/no horoscope cards/u);
    expect(() => homeArtCard('ru')).toThrow(/no art cards/u);
  });

  it("keeps each locale's cards in its own folder, under their own ceiling", () => {
    expect(LOCALIZED_ART_CARDS).toHaveLength(4 * (1 + 12) + 2 * 12);
    expect(new Set(LOCALIZED_ART_CARDS).size).toBe(LOCALIZED_ART_CARDS.length);
    expect(homeArtCard('en')).toBe(HOME_ART_CARD);
    expect(homeArtCard('es')).toBe(`${ART_CARD_DIR}/es/home.jpg`);
    expect(signArtCard('aries', 'fr')).toBe(`${ART_CARD_DIR}/fr/sign/aries.jpg`);
    expect(localizedHoroscopeArtCard('leo', 'pt')).toBe(`${ART_CARD_DIR}/pt/horoscope/leo.jpg`);
    for (const path of LOCALIZED_ART_CARDS) expect(ART_CARDS, path).not.toContain(path);
    expect(LOCALIZED_ART_CARDS_MAX_TOTAL_BYTES).toBeLessThanOrEqual(12 * 1024 * 1024);
  });

  it('is what the localized guides, birthdays, horoscopes and the localized fallback link', () => {
    for (const locale of ART_CARD_LOCALES) {
      const page = read(`src/pages/${locale}/[sign]/index.astro`);
      expect(page.split(`signArtCard(sign.slug, '${locale}')`).length - 1, locale).toBe(2);
    }
    expect(read('src/components/programmatic/LocalizedBirthdayPage.astro')).toContain('const ogImage = signArtCard(heroSign!.slug, locale);');
    expect(read('src/components/localized/LocalizedHoroscope.astro')).toContain('image={localizedHoroscopeArtCard(sign.slug, locale)}');
  });
});
