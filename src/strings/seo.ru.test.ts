import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SIGNS } from '../lib/signs';
import { ogImageForPathAndLocale } from './seo';
import { OG_SIGNS } from './seo.signs.mjs';
import {
  RU_OG_COPY_DIGEST_INPUT,
  RU_OG_REQUIRED_CARDS,
  RU_OG_ROUTES,
  ruOgImageForPath,
  ruOgMetaForPath,
} from './seo.ru.mjs';

const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

describe('Russian R2 Open Graph catalogue', () => {
  it('keeps the import-free renderer projection pinned to canonical sign data', () => {
    expect(OG_SIGNS).toEqual(SIGNS.map(({ slug, name, dates, element, modality, hue, essence }) => ({
      slug, name, dates, element, modality, hue, essence,
    })));
  });

  it('pins the exact 35-route deck-copy contract', () => {
    expect(RU_OG_ROUTES).toHaveLength(35);
    expect(RU_OG_REQUIRED_CARDS).toHaveLength(35);
    expect(createHash('sha256').update(RU_OG_COPY_DIGEST_INPUT).digest('hex'))
      .toBe('5b65ff6a8d14b70177b5caa3229499c184d2e292b4fa63c2d5bf07b07dee98d5');

    const paths = RU_OG_ROUTES.map((entry) => entry.publicPath);
    expect(new Set(paths).size).toBe(35);
    expect(paths).toEqual([
      '/ru/sky-calendar/', '/ru/astrologer-kit/', '/ru/your-sky-wrapped/', '/ru/chart-of-the-day/',
      '/ru/big-three/', '/ru/compatibility/invite/', '/ru/group-charts/', '/ru/chart-twins/',
      '/ru/', '/ru/tools/', '/ru/birth-chart/', '/ru/compatibility/',
      '/ru/moon-sign/', '/ru/rising-sign/', '/ru/moon-phase/',
      '/ru/saturn-return/', '/ru/transits/', '/ru/baby-zodiac/',
      '/ru/profile/', '/ru/methodology/', '/ru/privacy/', '/ru/disclosure/',
      '/ru/404/', ...SIGN_SLUGS.map((slug) => `/ru/${slug}/`),
    ]);
  });

  it('maps every launched route to its localized card', () => {
    for (const entry of RU_OG_ROUTES) {
      expect(ruOgMetaForPath(entry.publicPath)).toBe(entry);
      expect(ruOgMetaForPath(entry.contentPath)).toBe(entry);
      expect(ruOgImageForPath(entry.publicPath)).toBe(`/assets/og/v2/ru/${entry.card}`);
      expect(ogImageForPathAndLocale(entry.contentPath, 'ru'))
        .toBe(`/assets/og/v2/ru/${entry.card}`);
    }

    expect(ruOgMetaForPath('/ru/aries/?ref=test')).toMatchObject({
      card: 'sign/aries.png',
      title: 'Овен: даты, характер, совместимость',
      description: 'Гид по знаку Овен: даты, стихия, управитель, сильные стороны и как знак ведёт себя в отношениях.',
    });
    expect(ruOgMetaForPath('/ru/404/')).toMatchObject({ card: '404.png' });
  });

  it('does not invent cards for deferred or Arabic route families', () => {
    for (const path of [
      '/ru/horoscopes/', '/ru/today/', '/ru/events/', '/ru/birthday/',
      '/ru/learn/chinese-zodiac/', '/ru/registry/', '/ar/',
    ]) {
      expect(ruOgMetaForPath(path)).toBeNull();
      expect(ruOgImageForPath(path)).toBeNull();
    }
  });
});
