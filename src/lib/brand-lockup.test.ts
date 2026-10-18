import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LOCKUP,
  LOCKUP_LABEL,
  LOCKUP_SIZE,
  LOCKUP_WORDS,
  TILTED_RING_DOTS,
  TILTED_RING_VIEWBOX,
  lockupWordsCss,
  lockupWordsHtml,
  ringWidthFor,
  tiltedRingHeight,
  tiltedRingSvg,
} from './brand-lockup.mjs';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('the brand lockup (DESIGN.md, "Brand Lockup")', () => {
  it('is the tilted twelve-dot ring and ZODIACS · ORG, in the owner-chosen proportions', () => {
    expect(TILTED_RING_VIEWBOX).toBe('-2 4 28 16');
    expect(TILTED_RING_DOTS).toHaveLength(12);
    expect(new Set(TILTED_RING_DOTS.map((dot) => dot.fill)).size).toBe(12);
    // Back to front: each dot is at least as large and as opaque as the one before.
    TILTED_RING_DOTS.slice(1).forEach((dot, index) => {
      expect(dot.r).toBeGreaterThanOrEqual(TILTED_RING_DOTS[index].r);
      expect(dot.opacity).toBeGreaterThanOrEqual(TILTED_RING_DOTS[index].opacity);
    });
    expect(LOCKUP).toEqual({ tracking: 0.2, dotSpace: 0.2, ringWidth: 2.625, gap: 0.75 });
    expect(LOCKUP_SIZE).toEqual({ page: 13, image: 20 });
    expect(`${LOCKUP_WORDS.name} ${LOCKUP_WORDS.dot} ${LOCKUP_WORDS.tld}`).toBe('ZODIACS · ORG');
    expect(LOCKUP_LABEL).toBe('Zodiacs.org');
    expect(ringWidthFor(13)).toBe(34);
    expect(tiltedRingHeight(34)).toBe(19);
  });

  it('writes the live words as the nav does, for the stylesheet to capitalise', () => {
    expect(lockupWordsHtml({ name: 'a', sep: 'b', tld: 'c' }))
      .toBe('<span class="a" aria-hidden="true">Zodiacs<span class="b">·</span><span class="c">org</span></span>');
    const css = lockupWordsCss({ name: 'a', sep: 'b', tld: 'c', colors: { name: '#fff', sep: '#888', tld: '#ccc' } });
    expect(css).toContain('letter-spacing:0.2em;text-transform:uppercase');
    expect(css).toContain('.b{margin:0 0.2em;color:#888}');
    expect(css).toContain('.c{font-weight:500;color:#ccc}');
    const svg = tiltedRingSvg({ width: 34, className: 'ring' });
    expect(svg).toMatch(/^<svg class="ring" viewBox="-2 4 28 16" width="34" height="19" fill="none" aria-hidden="true" focusable="false">(?:<circle [^>]+\/>){12}<\/svg>$/u);
  });

  it('is copied exactly into the pages that cannot import it', () => {
    const ring = tiltedRingSvg({ width: 34, className: 'brand-ring' });
    for (const page of ['src/ai-tools/watch/account.html', 'src/ai-tools/accounts/consent.html']) {
      const html = read(page);
      expect(html, page).toContain(`<a href="https://zodiacs.org/" aria-label="Zodiacs.org">${ring}`);
      expect(html, page).toContain(lockupWordsHtml({ name: 'brand-name', sep: 'brand-sep', tld: 'brand-tld' }));
    }
    expect(read('public/assets/brand/tilted-ring.svg')).toBe(
      `${tiltedRingSvg({ width: 34 }).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace(' aria-hidden="true" focusable="false"', '')}\n`,
    );
  });

  it('signs the site chrome: the desktop nav, the footers and the registry app', () => {
    const nav = read('src/components/SiteNav.astro');
    expect(nav).toContain('<TiltedRing width={34} class="nav__ring" />');
    const footer = read('src/components/SiteFooter.astro');
    expect(footer).toContain('<TiltedRing width={42} class="zfooter__brand-mark" />');
    expect(footer).toContain('Zodiacs<span class="zfooter__brand-sep">·</span><span class="zfooter__brand-tld">org</span>');
    expect(read('scripts/site-footer.mjs')).toContain("tiltedRingSvg({ width: 42, className: 'zfooter__brand-mark' })");
    expect(read('scripts/wing-nav.mjs')).toContain("tiltedRingSvg({ width: 34, className: 'wnav__ring' })");
    const app = read('src/app.jsx');
    expect(app).toContain('<BrandRing className="wnav__ring" width={34} />');
    expect(app).toContain('<BrandRing className="zfooter__brand-mark" width={42} />');
    // The favicon and app icons keep the flat ring (the owner's exception).
    expect(read('src/components/BrandMark.astro')).toContain('const R = 9;');
  });
});
