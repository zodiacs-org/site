import { describe, expect, it } from 'vitest';
import {
  BREADCRUMB_LABELS,
  OG_EN,
  ogAltForPath,
  ogImageForPath,
  ogSpecialForPath,
} from './seo.en.mjs';
import {
  breadcrumbLabelForLocale,
  ogAltForPathAndLocale,
  ogImageForPathAndLocale,
} from './seo';

describe('Astrofolio and Terminal SEO identity', () => {
  it('maps the consumer collection and expert routes to distinct copy', () => {
    expect(ogSpecialForPath('/astrofolio/')).toMatchObject({ key: 'astrofolio' });
    for (const path of [
      '/terminal/',
      '/terminal/markets/',
      '/terminal/research/',
      '/terminal/research/sample-note/',
    ]) {
      expect(ogSpecialForPath(path), path).toMatchObject({ key: 'terminal' });
    }

    expect(ogAltForPath('/astrofolio/')).toContain('Astrofolio');
    expect(ogAltForPath('/terminal/')).toContain('Terminal');
    expect(ogAltForPath('/astrofolio/')).not.toContain('—');
    expect(ogAltForPath('/terminal/')).not.toContain('—');
    expect(ogAltForPath('/astrofolio/')).not.toContain('Zodiac Terminal');
    expect(ogAltForPath('/terminal/')).not.toContain('Zodiac Terminal');
  });

  it('publishes distinct cache-stable product images and route-specific alt text', () => {
    expect(OG_EN.astrofolio.image).toBe('/assets/og/astrofolio/v6/faces.jpg');
    expect(OG_EN.terminal.image).toBe('/assets/og/v7/terminal.png');
    expect(OG_EN.terminal.image).not.toBe(OG_EN.astrofolio.image);
    expect(ogImageForPath('/astrofolio/')).toBe(OG_EN.astrofolio.image);
    expect(ogImageForPath('/terminal/research/')).toBe(OG_EN.terminal.image);
    expect(OG_EN.wing.title).toBe('The Twelve');
    expect(OG_EN.wing.data).toBe('Astrofolio · Registry · Terminal');
  });

  it('localizes each route identity and its breadcrumb', () => {
    for (const locale of ['en', 'es', 'pt', 'fr', 'it', 'ru'] as const) {
      expect(ogImageForPathAndLocale('/astrofolio/', locale), locale)
        .toBe(OG_EN.astrofolio.image);
      expect(ogAltForPathAndLocale('/astrofolio/', locale), locale).toContain('Astrofolio');
      expect(ogAltForPathAndLocale('/terminal/', locale), locale).toContain('Terminal');
      expect(breadcrumbLabelForLocale('astrofolio', locale), locale).toBe('Astrofolio');
      expect(breadcrumbLabelForLocale('terminal', locale), locale).toBe('Terminal');
      expect(breadcrumbLabelForLocale('markets', locale), locale).toContain('Terminal');
    }
    expect(BREADCRUMB_LABELS.astrofolio).toBe('Astrofolio');
    expect(BREADCRUMB_LABELS.terminal).toBe('Terminal');
    expect(BREADCRUMB_LABELS.markets).toBe('Terminal venue route');
  });
});
