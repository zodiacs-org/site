import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { footerAcquisitionDisclosureVisible } from './footer-boundary.mjs';

describe('footer acquisition disclosure boundary', () => {
  it.each([
    '/astrofolio/',
    '/astrofolio/how-to-buy/',
    '/terminal/',
    '/terminal/markets/',
    '/registry/',
    '/registry/collection/',
    '/sdk/',
    '/thesis/',
    '/archive/',
    '/disclosure/',
  ])('renders within the Registry/Astrofolio wing: %s', (path) => {
    expect(footerAcquisitionDisclosureVisible(path)).toBe(true);
  });

  it.each([
    '/',
    '/race/',
    '/birth-chart/',
    '/compatibility/',
    '/horoscopes/',
    '/aries/',
    '/today/',
    '/about/',
    '/astrofolio-news/',
    '/registryish/',
  ])('stays off ordinary consumer routes: %s', (path) => {
    expect(footerAcquisitionDisclosureVisible(path)).toBe(false);
  });

  it('shows the operator relationship where collection navigation appears, keeping tools separate', async () => {
    const footer = await readFile(new URL('../components/SiteFooter.astro', import.meta.url), 'utf8');
    expect(footer).toContain('{!isTool && (');
    expect(footer).toContain("t(locale, 'trustFreeAnswer')");
    expect(footer).toContain("localizePath(locale, '/disclosure/')");
  });
});
