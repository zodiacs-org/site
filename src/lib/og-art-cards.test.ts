import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ART_CARDS,
  ART_CARD_DIR,
  ART_CARD_DISC,
  CHART_TWINS_ART_CARD,
  CHART_TWINS_ART_CARD_ALT,
  CHART_TWINS_ART_CARD_ART,
  CHART_TWINS_ART_CARD_COPY,
  CHART_TWINS_ART_CARD_DISCS,
  CHART_TWINS_ART_CARD_LOCALES,
  chartTwinsArtCard,
  chartTwinsArtCardCopy,
  HOME_ART_CARD,
  HOME_ART_CARD_ALT,
  HOME_ART_CARD_COPY,
  HOME_ART_CARD_CROP,
  HOME_ART_CARD_SCRIM,
  SIGN_ART_CARD_ART,
  SIGN_ART_CARD_SHADE,
  THESIS_ART_CARD,
  THESIS_ART_CARD_ALT,
  THESIS_ART_CARD_ART,
  THESIS_ART_CARD_COPY,
  THESIS_ART_CARD_DISCS,
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
import { ART_CARD_COPY_LOCALES, CHART_TWINS_COPY_LOCALES, captionLead, renderLocalizedArtCardCopyModule } from './og-art-cards-copy';
import { additionText } from '../strings/additions';
import { ruOgImageForPath } from '../strings/seo.ru.mjs';
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
import { loadFilmScript } from '../../scripts/build-thesis-film.mjs';
import {
  ART_CARDS_MAX_TOTAL_BYTES,
  ART_CARD_MAX_BYTES,
  ART_PAGE_CARD_KEYS,
  ART_PAGE_CARD_QUALITY,
  ART_PAGE_CARDS,
  ART_PAGE_PAINTINGS,
  BIRTHDAY_ART_CARD_DIR,
  BIRTHDAY_ART_CARDS,
  BIRTHDAY_ART_CARDS_MAX_TOTAL_BYTES,
  BIRTHDAY_CUSP_DATES,
  CHINESE_ZODIAC_ART_CARD_ANIMALS,
  CHINESE_ZODIAC_ART_CARD_DIR,
  CHINESE_ZODIAC_ART_CARD_KICKER,
  CHINESE_ZODIAC_ART_CARDS,
  CHINESE_ZODIAC_ART_CARDS_MAX_TOTAL_BYTES,
  PAIR_ART_CARD_DIR,
  PAIR_ART_CARDS,
  PAIR_ART_CARDS_MAX_TOTAL_BYTES,
  PAIR_SLUGS,
  artPageCard,
  artPageCardAlt,
  artPageCardSpec,
  birthdayArtCard,
  birthdayArtCardCopy,
  chineseZodiacArtCard,
  chineseZodiacArtCardCopy,
  pairArtCard,
  pairArtCardCopy,
} from './og-art-cards.mjs';
import { OG_EN, ogImageForPath } from '../strings/seo.en.mjs';
import { CHINESE_ZODIAC_ANIMALS, CHINESE_ZODIAC_COPY, chineseZodiacText } from '../data/chinese-zodiac';
import { RETURN_EN } from './return-visits/copy';
import birthdays from '../data/birthdays.json';

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
    expect(home).toContain(`<p class="hero__sub">${HOME_ART_CARD_COPY.subtitle} `);
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
      '/assets/og/v8/tool/chart-twins.jpg',
      '/assets/og/v8/thesis.jpg',
      ...ART_PAGE_CARD_KEYS.map((key) => `/assets/og/v8/tool/${key}.jpg`),
    ]);
    expect(ART_CARDS).toHaveLength(99 + 13);
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
    // The 2026 yearly pages have no card of their own and share the sign guide's.
    expect(horoscopes).toContain("const ogImage = surface === 'year2026' ? signArtCard(sign.slug) : horoscopeArtCard(sign.slug, surface);");
    expect(horoscopes).not.toContain('/assets/og/v2/horoscope/');
  });
});

describe('the chart twins art card (owner-chosen 2026-11-26)', () => {
  it('draws the page painting in the sign cards\' filter, with the Sun in Leo\'s hue and the Moon in Cancer\'s', () => {
    expect(CHART_TWINS_ART_CARD).toBe('/assets/og/v8/tool/chart-twins.jpg');
    expect(CHART_TWINS_ART_CARD_ART.src).toBe('public/assets/card-art/twins-hero-1200.webp');
    expect(readFileSync(new URL(`../../${CHART_TWINS_ART_CARD_ART.src}`, import.meta.url)).length).toBeGreaterThan(0);
    expect(CHART_TWINS_ART_CARD_ART.filter).toBe(SIGN_ART_CARD_ART.filter);
    expect(CHART_TWINS_ART_CARD_ART.width / CHART_TWINS_ART_CARD_ART.height).toBeCloseTo(1200 / 800, 6);
    expect(CHART_TWINS_ART_CARD_DISCS.sun).toBe(SIGNS.find((sign) => sign.slug === 'leo')?.hue);
    expect(CHART_TWINS_ART_CARD_DISCS.moon).toBe(SIGNS.find((sign) => sign.slug === 'cancer')?.hue);
  });

  it('carries the approved words, with no dashes and without "verified"', () => {
    expect(CHART_TWINS_ART_CARD_COPY).toEqual({
      kicker: 'Matched by Sun and Moon',
      title: 'Your chart twins',
      line: 'Public figures who share your Sun and Moon signs.',
    });
    for (const words of [...Object.values(CHART_TWINS_ART_CARD_COPY), CHART_TWINS_ART_CARD_ALT]) {
      expect(words).not.toMatch(DASHES);
      expect(words).not.toMatch(/verified/iu);
    }
  });

  it('is what every chart twins page links, the Russian one through its catalogue, with the v2 cards kept', () => {
    const page = read('src/components/sharing/SharingToolPage.astro');
    expect(page).toContain("const cardImage = kind === 'twins' ? chartTwinsArtCard(locale) : (");
    expect(page).toContain("const cardAlt = kind === 'twins' ? chartTwinsArtCardCopy(locale).alt : s(locale, titleKey);");
    expect(page).toContain("image={locale === 'ru' ? ruOgImageForPath(route) ?? '/assets/og/v2/ru/share.png' : cardImage}");
    expect(ruOgImageForPath('/ru/chart-twins/')).toBe(chartTwinsArtCard('ru'));
    expect(chartTwinsArtCard()).toBe(CHART_TWINS_ART_CARD);
    expect(chartTwinsArtCardCopy()).toEqual({ ...CHART_TWINS_ART_CARD_COPY, alt: CHART_TWINS_ART_CARD_ALT });
    // The v2 cards stay published for links already shared.
    for (const kept of ['public/assets/og/v2/tool/chart-twins.png', 'public/assets/og/v2/ru/tool/chart-twins.png']) {
      expect(readFileSync(new URL(`../../${kept}`, import.meta.url)).length, kept).toBeGreaterThan(0);
    }
    const generator = read('scripts/build-og-void.mjs');
    expect(generator).toContain("process.argv.includes('--only-chart-twins-card')");
    expect(generator).toContain("process.argv.includes('--only-localized-chart-twins-cards')");
  });
});

describe('the thesis art card (owner-chosen 2026-11-27)', () => {
  it('draws the page\'s own painting with the twelve canonical sign discs in a row', () => {
    expect(THESIS_ART_CARD).toBe('/assets/og/v8/thesis.jpg');
    expect(THESIS_ART_CARD_ART.src).toBe('public/assets/art/zodiac-clock-1280.jpg');
    expect(read('public/thesis/index.html')).toContain('/assets/art/zodiac-clock-');
    expect(readFileSync(new URL(`../../${THESIS_ART_CARD_ART.src}`, import.meta.url)).length).toBeGreaterThan(0);
    expect(THESIS_ART_CARD_ART.width / THESIS_ART_CARD_ART.height).toBeCloseTo(1280 / 720, 2);
    // One row of twelve discs, as wide as the kicker and short of the clock.
    const { size, gap } = THESIS_ART_CARD_DISCS;
    expect(size).toBeGreaterThanOrEqual(30);
    expect(size).toBeLessThanOrEqual(36);
    expect(88 + 12 * size + 11 * gap).toBeLessThanOrEqual(THESIS_ART_CARD_ART.left + 80);
    const generator = read('scripts/build-og-void.mjs');
    expect(generator).toContain("process.argv.includes('--only-thesis-art-card')");
    expect(generator).toContain('const discs = SIGNS.map((s) => `<img src="${DISCS[s.slug]}"');
    expect(generator).toContain('[THESIS_ART_CARD, artThesisCard()]');
  });

  it('prints the thesis film\'s first two sentences word for word', async () => {
    const script = await loadFilmScript();
    const [opening] = script.scenes;
    expect(opening.lines).toEqual([THESIS_ART_CARD_COPY.kicker]);
    expect(opening.then).toEqual([THESIS_ART_CARD_COPY.line]);
    expect(THESIS_ART_CARD_COPY.title).toBe('Why Zodiacs Matter');
    for (const words of [...Object.values(THESIS_ART_CARD_COPY), THESIS_ART_CARD_ALT]) {
      expect(words).not.toMatch(DASHES);
      expect(words).not.toMatch(/N\u00ba|\bNo\. ?\d/u);
    }
  });

  it('is what the thesis page shares, with the one alt text in both places', () => {
    const page = read('public/thesis/index.html');
    const url = `https://zodiacs.org${THESIS_ART_CARD}`;
    expect(page).toContain(`<meta property="og:image" content="${url}" />`);
    expect(page).toContain('<meta property="og:image:type" content="image/jpeg" />');
    expect(page).toContain(`<meta name="twitter:image" content="${url}" />`);
    expect(page).toContain(`"image": "${url}",`);
    expect(page).toContain(`<meta property="og:image:alt" content="${THESIS_ART_CARD_ALT}" />`);
    expect(page).toContain(`<meta name="twitter:image:alt" content="${THESIS_ART_CARD_ALT}" />`);
    // The v2 card stays published for links already shared.
    expect(readFileSync(new URL('../../public/assets/og/v2/thesis.png', import.meta.url)).subarray(1, 4).toString('ascii')).toBe('PNG');
  });
});

describe('the chart twins art card in Spanish, French, Italian, Portuguese and Russian (2026-11-26)', () => {
  const verified = /verif|vérifi|провер/iu;

  it('keeps each card in its locale\'s folder, the Russian one beside the other art cards', () => {
    expect([...CHART_TWINS_ART_CARD_LOCALES]).toEqual([...CHART_TWINS_COPY_LOCALES]);
    expect([...CHART_TWINS_ART_CARD_LOCALES]).toEqual(['es', 'fr', 'it', 'pt', 'ru']);
    for (const locale of CHART_TWINS_ART_CARD_LOCALES) {
      expect(chartTwinsArtCard(locale)).toBe(`${ART_CARD_DIR}/${locale}/tool/chart-twins.jpg`);
      expect(LOCALIZED_ART_CARDS).toContain(chartTwinsArtCard(locale));
    }
    expect(() => chartTwinsArtCard('ar')).toThrow(/no chart twins card/u);
  });

  it('takes the four art card locales\' words from their chart twins card copy, without the word for "verified"', () => {
    for (const locale of ['es', 'fr', 'it', 'pt'] as const) {
      const copy = chartTwinsArtCardCopy(locale);
      expect(copy.title, locale).toBe(additionText(locale, 'og.tools.chart-twins.title'));
      const sub = additionText(locale, 'og.tools.chart-twins.sub');
      expect(sub, locale).toMatch(verified);
      expect(copy.line, locale).toBe(sub.replace(/ (?:verificados|vérifiés|verificati)\.$/u, '.'));
    }
  });

  it('carries the reviewed words in each language, with no dashes and no word for "verified"', () => {
    const words = Object.fromEntries(CHART_TWINS_ART_CARD_LOCALES.map((locale) => {
      const { kicker, title, line } = chartTwinsArtCardCopy(locale);
      return [locale, { kicker, title, line }];
    }));
    expect(words).toEqual({
      es: { kicker: 'Coinciden Sol y Luna', title: 'Tus gemelos astrales', line: 'Figuras públicas que comparten tus signos solar y lunar.' },
      fr: { kicker: 'Soleil et Lune en commun', title: 'Tes jumeaux astrologiques', line: 'Des personnalités publiques qui partagent tes signes solaire et lunaire.' },
      it: { kicker: 'Sole e Luna in comune', title: 'I tuoi gemelli astrologici', line: 'Personaggi pubblici che condividono i tuoi segni solare e lunare.' },
      pt: { kicker: 'Sol e Lua em comum', title: 'Seus gêmeos astrais', line: 'Figuras públicas que compartilham seus signos solar e lunar.' },
      ru: { kicker: 'Совпадение по Солнцу и Луне', title: 'Звёздные близнецы', line: 'Известные люди с вашими знаками Солнца и Луны.' },
    });
    for (const locale of CHART_TWINS_ART_CARD_LOCALES) {
      const copy = chartTwinsArtCardCopy(locale);
      // The alt text names the headline and the line, in the page's language, then the painting.
      expect(copy.alt.startsWith(copy.title), locale).toBe(true);
      expect(copy.alt, locale).toMatch(/\.$/u);
      for (const value of Object.values(copy)) {
        expect(value, locale).not.toMatch(DASHES);
        expect(value, locale).not.toMatch(verified);
      }
    }
    expect(chartTwinsArtCardCopy('ru').alt).toMatch(/^[\p{Script=Cyrillic}\s.,:]+$/u);
  });
});

describe('the Spanish, French, Italian and Portuguese art cards', () => {
  const guides = { es: spanishGuideFor, fr: frenchGuideFor, it: italianGuideFor, pt: portugueseGuideFor } as const;
  const upper = (value: string, locale: string) => value.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase(locale));

  it('carries the words og-art-cards-copy.ts reads from the pages (regenerate with build-og-art-card-copy.ts)', () => {
    expect(read('src/lib/og-art-cards.locales.mjs')).toBe(renderLocalizedArtCardCopyModule());
  });

  it('prints on each card what its localized page prints at the top', () => {
    expect([...ART_CARD_LOCALES]).toEqual([...ART_CARD_COPY_LOCALES]);
    for (const locale of ART_CARD_COPY_LOCALES) {
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
    // Each locale's homepage, sign guides and chart twins card, the Spanish and Portuguese horoscopes, and the Russian chart twins card.
    expect(LOCALIZED_ART_CARDS).toHaveLength(4 * (1 + 12 + 1) + 2 * 12 + 1);
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
    // es and pt have horoscope cards; the held fr and it daily editions (locale expansion) use their sign guide card.
    expect(read('src/components/localized/LocalizedHoroscope.astro')).toContain("image={locale === 'es' || locale === 'pt' ? localizedHoroscopeArtCard(sign.slug, locale) : localizedSignArtCard(sign.slug, locale === 'ru' ? 'en' : locale)}");
  });
});

describe('the art page cards (owner-delegated decisions, 2026-11-27)', () => {
  // No accuracy words, no new claims, no token or market words, no dashes.
  const BANNED = /\b(?:verified|accurate|accuracy|precise|precisely|exact|exactly|token|tokens|crypto|market|markets|buy|price|invest\w*)\b/iu;
  const words = (...values: string[]) => {
    for (const value of values) {
      expect(value).not.toMatch(DASHES);
      expect(value).not.toMatch(BANNED);
    }
  };
  const tool = (key: string) => {
    const entry = OG_EN.tools.find((candidate) => candidate.key === key);
    if (!entry) throw new Error(`no OG_EN tool ${key}`);
    return entry;
  };
  const deDash = (value: string) => value.replace(' — ', ', ');

  it('draws the thirteen single page cards in the English folder, each from its page\'s own painting', () => {
    expect([...ART_PAGE_CARD_KEYS]).toEqual(['birth-chart', 'today', 'rising-sign', 'big-three', 'birthday', 'tools', 'learn', 'sky-calendar', 'saturn-return', 'compatibility-invite', 'baby-zodiac', 'mercury-retrograde', 'transits']);
    expect([...ART_PAGE_CARDS]).toEqual(ART_PAGE_CARD_KEYS.map((key) => `${ART_CARD_DIR}/tool/${key}.jpg`));
    for (const card of ART_PAGE_CARDS) expect(ART_CARDS).toContain(card);
    for (const painting of Object.values(ART_PAGE_PAINTINGS)) expect(readFileSync(new URL(`../../${painting.src}`, import.meta.url)).length, painting.src).toBeGreaterThan(0);
    for (const key of ART_PAGE_CARD_KEYS) {
      const spec = artPageCardSpec(key);
      expect(spec.title.length, key).toBe(2);
      words(spec.kicker, ...spec.title, spec.line, spec.alt);
      expect(spec.alt.length, key).toBeGreaterThan(60);
      expect(artPageCardAlt(key)).toBe(spec.alt);
      for (const route of spec.routes) expect(route, key).toMatch(/^\/[a-z0-9/-]*\/$/u);
    }
    expect(() => artPageCard('moon-sign')).toThrow(/no art page card/u);
    expect(ART_CARDS_MAX_TOTAL_BYTES).toBe(12 * 1024 * 1024);
    expect(ART_CARD_MAX_BYTES).toBe(300 * 1024);
  });

  it('takes each single card\'s words from its page and its v2 card', () => {
    const page = (path: string) => read(path);
    const spec = artPageCardSpec;
    // The birth chart: the v2 card's kicker and title, the hero's lede.
    expect(spec('birth-chart').kicker).toBe(tool('birth-chart').kicker);
    expect(spec('birth-chart').title.join(' ')).toBe(tool('birth-chart').title);
    expect(page('src/pages/birth-chart/index.astro')).toContain(`<p class="bc-lede">${spec('birth-chart').line.replace(/\.$/u, '')}, and what each one means.</p>`);
    // Today: the hero's headline.
    expect(page('src/pages/today/index.astro')).toContain(`<EditionText current="${spec('today').title.join(' ')}"`);
    expect(page('src/pages/today/index.astro')).toContain('Planets, Moon Phase and Retrogrades');
    // The rising sign: the v2 card's words, the dash written as a comma.
    expect(spec('rising-sign').kicker).toBe(tool('rising-sign').kicker);
    expect(spec('rising-sign').title.join(' ')).toBe(tool('rising-sign').title);
    expect(spec('rising-sign').line).toBe(deDash(tool('rising-sign').sub));
    // The big three: the v2 title, the tools catalogue's Sun, Moon and Rising.
    expect(spec('big-three').title.join(' ')).toBe(tool('big-three').title);
    expect(read('src/lib/nav-tools.ts')).toContain(`'${spec('big-three').kicker}, as a card to share.'`);
    expect(tool('big-three').sub.startsWith(spec('big-three').line.replace(' a card to share.', ''))).toBe(true);
    // The birthday hub: the v2 kicker, the hero's headline.
    expect(spec('birthday').kicker).toBe(tool('birthday').kicker);
    expect(spec('birthday').title.join(' ')).toBe(tool('birthday').title);
    expect(page('src/pages/birthday/index.astro')).toContain(`<h1 class="display">${spec('birthday').title.join(' ')}.</h1>`);
    // The tools hub: its kicker, headline and its lede without the count, which a launch flag changes.
    const tools = page('src/pages/tools/index.astro');
    expect(tools).toContain(`<span class="kicker">${spec('tools').kicker}</span>`);
    expect(tools).toContain(`<h1 class="tools-hub__title">${spec('tools').title.join(' ')}</h1>`);
    expect(tools).toContain('{countTitle} tools, sorted by what you want to know. New here? Start with your birth chart.');
    expect(spec('tools').line).toBe('Sorted by what you want to know. New here? Start with your birth chart.');
    expect(spec('tools').line).not.toMatch(/\d|twenty/i);
    // Learn: the hero's kicker, headline and the first sentence of its lede.
    const learn = page('src/pages/learn/index.astro');
    expect(learn).toContain(`<span class="kicker">${spec('learn').kicker}</span>`);
    expect(learn).toContain(`<h1 class="display">${spec('learn').title.join(' ')}</h1>`);
    expect(learn).toContain(`<p class="klede">${spec('learn').line} `);
    // The sky calendar: the page's headline and the v2 kicker.
    expect(RETURN_EN.calendarTitle).toBe(spec('sky-calendar').title.join(' '));
    expect(spec('sky-calendar').kicker).toBe(tool('sky-calendar').kicker);
    expect(tool('sky-calendar').sub.startsWith(spec('sky-calendar').line.replace(' in your calendar.', ''))).toBe(true);
    // The Saturn return: the v2 kicker and title.
    expect(spec('saturn-return').kicker).toBe(tool('saturn-return').kicker);
    expect(spec('saturn-return').title.join(' ')).toBe(tool('saturn-return').title);
    // The invitation: the page's title and description, the v2 card's line.
    const invite = page('src/pages/c/index.astro');
    expect(invite).toContain(`title="${spec('compatibility-invite').title.join(' ')} | Zodiacs.org"`);
    expect(invite).toContain(`description="${spec('compatibility-invite').kicker}. `);
    expect(read('scripts/build-og-void.mjs')).toContain(spec('compatibility-invite').line);
    // The baby zodiac: the v2 kicker and title, the start of its line.
    expect(spec('baby-zodiac').kicker).toBe(tool('baby-zodiac').kicker);
    expect(spec('baby-zodiac').title.join(' ')).toBe(tool('baby-zodiac').title);
    expect(tool('baby-zodiac').sub.startsWith(spec('baby-zodiac').line.replace(', and the week’s possible Moons.', ''))).toBe(true);
    // Mercury retrograde: the v2 card's words, its line cut before "and the themes to watch".
    expect(spec('mercury-retrograde').kicker).toBe(tool('mercury-retrograde').kicker);
    expect(spec('mercury-retrograde').title.join(' ')).toBe(tool('mercury-retrograde').title);
    expect(tool('mercury-retrograde').sub).toBe(`${spec('mercury-retrograde').line.replace(/\.$/u, '')} and the themes to watch.`);
    // Transits: the v2 kicker and the hero's headline.
    expect(spec('transits').kicker).toBe(tool('transits').kicker);
    expect(page('src/pages/transits/index.astro')).toContain(`<h1 class="display">${spec('transits').title.join(' ')}</h1>`);
  });

  it('is what each of those pages links, and the English catalogue for the pages that read it', () => {
    const tools = OG_EN.tools as readonly { key: string; path: string; artCard?: string }[];
    for (const entry of tools) {
      if (ART_PAGE_CARD_KEYS.includes(entry.key)) {
        expect(entry.artCard, entry.key).toBe(artPageCard(entry.key));
        expect(ogImageForPath(entry.path), entry.key).toBe(artPageCard(entry.key));
      } else {
        expect(entry.artCard, entry.key).toBeUndefined();
        expect(ogImageForPath(entry.path), entry.key).toBe(`/assets/og/v2/tool/${entry.key}.png`);
      }
    }
    for (const [file, key] of [
      ['src/pages/birth-chart/index.astro', 'birth-chart'],
      ['src/pages/birth-chart/someone-else/index.astro', 'birth-chart'],
      ['src/pages/birth-chart/three-dimensions/index.astro', 'birth-chart'],
      ['src/pages/today/index.astro', 'today'],
      ['src/pages/rising-sign/index.astro', 'rising-sign'],
      ['src/pages/big-three/index.astro', 'big-three'],
      ['src/pages/birthday/index.astro', 'birthday'],
      ['src/pages/tools/index.astro', 'tools'],
      ['src/pages/learn/index.astro', 'learn'],
      ['src/pages/saturn-return/index.astro', 'saturn-return'],
      ['src/pages/c/index.astro', 'compatibility-invite'],
      ['src/pages/baby-zodiac/index.astro', 'baby-zodiac'],
      ['src/pages/mercury-retrograde/index.astro', 'mercury-retrograde'],
      ['src/pages/mercury-retrograde/2027/index.astro', 'mercury-retrograde'],
      ['src/pages/transits/index.astro', 'transits'],
    ] as const) {
      const source = read(file);
      expect(source, file).toContain(`image={artPageCard('${key}')}`);
      expect(source, file).toContain(`imageAlt={artPageCardAlt('${key}')}`);
    }
    // The Spanish, French, Italian and Portuguese pages that showed the English v2 card show the English art card.
    for (const locale of ['es', 'fr', 'it', 'pt']) {
      for (const key of ['birth-chart', 'tools', 'baby-zodiac', 'saturn-return', 'transits', 'rising-sign']) {
        expect(read(`src/pages/${locale}/${key}/index.astro`), `${locale} ${key}`).toContain(`image={artPageCard('${key}')}`);
      }
    }
    expect(read('src/components/sky/LocalizedMercuryRetrogradePage.astro')).toContain("image={artPageCard('mercury-retrograde')}");
    expect(read('src/components/sharing/SharingToolPage.astro')).toContain("big: artPageCard('big-three')");
    expect(read('src/components/return-visits/ReturnToolPage.astro')).toContain("const cardImage = kind === 'calendar' ? artPageCard('sky-calendar')");
    // The pages that borrowed the learn and transits cards keep them for now.
    for (const kept of ['src/pages/learn/glossary/index.astro', 'src/pages/learn/placements/index.astro', 'src/pages/your-day/index.astro']) {
      expect(read(kept), kept).toMatch(/image="\/assets\/og\/v2\/tool\/(?:learn|transits)\.png"/u);
    }
    // The v2 cards stay published for links already shared.
    for (const key of ['birth-chart', 'today', 'rising-sign', 'big-three', 'birthday', 'tools', 'learn', 'sky-calendar', 'saturn-return', 'compatibility-invite', 'baby-zodiac', 'mercury-retrograde', 'transits']) {
      expect(readFileSync(new URL(`../../public/assets/og/v2/tool/${key}.png`, import.meta.url)).subarray(1, 4).toString('ascii'), key).toBe('PNG');
    }
  });

  it('draws the 78 sign pairs in a folder of their own, under its own ceiling', () => {
    expect(PAIR_SLUGS).toHaveLength(78);
    const published = readdirSync(new URL('../../public/assets/og/v2/pair/', import.meta.url)).filter((file) => file.endsWith('.png')).map((file) => file.replace(/\.png$/u, '')).sort();
    expect([...PAIR_SLUGS].sort()).toEqual(published);
    expect(PAIR_ART_CARDS).toEqual(PAIR_SLUGS.map((slug) => `${PAIR_ART_CARD_DIR}/${slug}.jpg`));
    expect(PAIR_ART_CARD_DIR).toBe('/assets/og/v8/pair');
    expect(PAIR_ART_CARDS_MAX_TOTAL_BYTES).toBe(10 * 1024 * 1024);
    expect(() => pairArtCard('leo-aries')).toThrow(/unknown pair/u);
    expect(pairArtCardCopy('aries-leo')).toMatchObject({ kicker: 'Compatibility, fire with fire', title: ['Aries', 'and Leo'], line: 'What works, what strains, what makes it last.' });
    expect(pairArtCardCopy('cancer-capricorn').kicker).toBe('Compatibility, water with earth');
    for (const slug of PAIR_SLUGS) {
      const copy = pairArtCardCopy(slug);
      words(copy.kicker, ...copy.title, copy.line, copy.alt);
      expect(copy.alt.startsWith(`${copy.title[0]} ${copy.title[1]} compatibility, `), slug).toBe(true);
    }
    const english = read('src/pages/compatibility/[pair]/index.astro');
    expect(english).toContain('image={pairArtCard(facts.slug)}');
    expect(english).toContain('imageAlt={pairArtCardCopy(facts.slug).alt}');
    expect(english).toContain('image: `https://zodiacs.org${pairArtCard(facts.slug)}`,');
    const localized = read('src/components/compat/LocalizedPairPage.astro');
    expect(localized).toContain('image={pairArtCard(facts.slug)}');
    expect(localized).not.toContain('/assets/og/v2/pair/');
  });

  it('draws one card for each cusp birthday, the dates the birthday data marks as cusps', () => {
    const data = birthdays as { days: Record<string, { cusp?: { a: string; b: string } }> };
    const cusps = Object.entries(data.days).filter(([, day]) => day.cusp).map(([slug, day]) => ({ slug, a: day.cusp!.a, b: day.cusp!.b }));
    expect(BIRTHDAY_CUSP_DATES.map((date) => ({ ...date }))).toEqual(cusps);
    expect(BIRTHDAY_ART_CARDS).toHaveLength(29);
    expect(BIRTHDAY_ART_CARDS).toEqual(BIRTHDAY_CUSP_DATES.map((date) => `${BIRTHDAY_ART_CARD_DIR}/${date.slug}.jpg`));
    expect(BIRTHDAY_ART_CARD_DIR).toBe('/assets/og/v8/birthday');
    expect(BIRTHDAY_ART_CARDS_MAX_TOTAL_BYTES).toBe(4 * 1024 * 1024);
    expect(() => birthdayArtCard('march-22')).toThrow(/not a cusp date/u);
    expect(birthdayArtCardCopy('march-21')).toMatchObject({ kicker: 'Pisces or Aries, by year', title: ['Born on', 'March 21'] });
    const page = read('src/pages/birthday/[slug].astro');
    // The kicker is the page's own fact line, the headline its h1.
    expect(page).toContain('`${cusp.a.name} or ${cusp.b.name}, by year`');
    expect(page).toContain('<h1 class="display bday-title">Born on <em>{label}</em></h1>');
    expect(page).toContain('? birthdayArtCard(slug)');
    expect(page).toContain('imageAlt={cusp ? birthdayArtCardCopy(slug).alt');
    expect(page).not.toContain('/assets/og/v2/tool/birthday.png');
    for (const date of BIRTHDAY_CUSP_DATES) {
      const copy = birthdayArtCardCopy(date.slug);
      words(copy.kicker, ...copy.title, copy.line, copy.alt);
    }
  });

  it('draws the twelve Chinese zodiac animals in the guide\'s own words, each on its own painting', () => {
    expect(CHINESE_ZODIAC_ART_CARD_ANIMALS.map((animal) => animal.slug)).toEqual(CHINESE_ZODIAC_ANIMALS.map((animal) => animal.slug));
    expect(CHINESE_ZODIAC_ART_CARD_KICKER).toBe(CHINESE_ZODIAC_COPY.animalKicker);
    for (const animal of CHINESE_ZODIAC_ANIMALS) {
      const copy = chineseZodiacArtCardCopy(animal.slug);
      expect(copy.title.join(' ')).toBe(chineseZodiacText('yearOf', { animal: animal.name }));
      expect(copy.line).toBe(animal.association);
      words(copy.kicker, ...copy.title, copy.line, copy.alt);
      const art = CHINESE_ZODIAC_ART_CARD_ANIMALS.find((entry) => entry.slug === animal.slug)!.art;
      expect(readFileSync(new URL(`../../${art.src}`, import.meta.url)).length, animal.slug).toBeGreaterThan(0);
      // The painting fades in at or past its own left edge, so the edge never shows.
      expect(art.fade[0], animal.slug).toBeGreaterThanOrEqual(Math.max(500, art.cx - art.fx * art.scale));
    }
    expect(CHINESE_ZODIAC_ART_CARDS).toEqual(CHINESE_ZODIAC_ANIMALS.map((animal) => `${CHINESE_ZODIAC_ART_CARD_DIR}/${animal.slug}.jpg`));
    expect(CHINESE_ZODIAC_ART_CARD_DIR).toBe('/assets/og/v8/learn/chinese-zodiac');
    expect(CHINESE_ZODIAC_ART_CARDS_MAX_TOTAL_BYTES).toBe(2 * 1024 * 1024);
    expect(chineseZodiacArtCard('dragon')).toBe('/assets/og/v8/learn/chinese-zodiac/dragon.jpg');
    const page = read('src/pages/learn/chinese-zodiac/[animal]/index.astro');
    expect(page).toContain('image={chineseZodiacArtCard(animal.slug)} imageAlt={chineseZodiacArtCardCopy(animal.slug).alt}');
  });

  it('has a narrow flag per family, each drawn with the rest by --only-art-cards', () => {
    const generator = read('scripts/build-og-void.mjs');
    for (const flag of ['--only-art-page-cards', '--only-pair-art-cards', '--only-birthday-art-cards', '--only-chinese-zodiac-art-cards']) {
      expect(generator).toContain(`flag: '${flag}'`);
    }
    expect(generator).toContain('for (const name of Object.keys(ART_PAGE_FAMILIES)) pageCards += (await renderArtPageFamily(name)).count;');
    expect(Object.values(ART_PAGE_CARD_QUALITY).every((quality) => quality >= 78 && quality <= 90)).toBe(true);
  });
});
