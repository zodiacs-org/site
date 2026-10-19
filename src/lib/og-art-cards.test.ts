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
    expect(read('src/components/SEO.astro')).toContain(': explicitImage ?? catalogImage ?? HOME_ART_CARD;');
    for (const page of [
      'src/pages/[sign]/index.astro',
      'src/pages/es/[sign]/index.astro',
      'src/pages/fr/[sign]/index.astro',
      'src/pages/it/[sign]/index.astro',
      'src/pages/pt/[sign]/index.astro',
      'src/pages/birthday/[slug].astro',
      'src/components/programmatic/LocalizedBirthdayPage.astro',
      'src/components/localized/LocalizedHoroscope.astro',
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
