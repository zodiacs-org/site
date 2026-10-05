import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const nav = read('src/components/SiteNav.astro');
const css = nav.split('<style>')[1].split('</style>')[0];

function rule(selector, source = css) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`, 'u'))?.[1];
  if (!body) throw new Error(`Missing rule: ${selector}`);
  return body;
}

function value(body, property) {
  const declarations = body.replace(/\/\*[\s\S]*?\*\//gu, '');
  return declarations.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+);`, 'u'))?.[1].trim();
}

function hasChildDependentNavigation(source) {
  // This exact rule hides the out-of-flow Guide while the native menu is open.
  // It cannot change reserved nav geometry. Strip it once, with only its two
  // reviewed declarations; every other :has and child-dependent grid stays banned.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//gu, '');
  const withoutGuideVisibility = withoutComments.replace(
    /(^|[{}])\s*:global\(body:has\(\[data-mobile-menu\]:not\(\[hidden\]\)\) \.zguide-launcher\) \{\s*visibility: hidden;\s*pointer-events: none;\s*\}/u,
    '$1',
  );
  return /:has\(|:nth-child\([^}]+grid-template-/u.test(withoutGuideVisibility);
}

describe('navigation first-paint reservation', () => {
  it('reserves a bounded pill before any child content is streamed', () => {
    const shell = rule('.nav');
    expect(value(shell, 'display')).toBe('grid');
    expect(value(shell, 'width')).toBe('336px');
    expect(value(shell, 'max-width')).toBe('calc(100% - 32px)');
    expect(value(shell, 'box-sizing')).toBe('border-box');
    expect(value(shell, 'height')).toBe('52px');
    expect(shell).not.toMatch(/max-content|min-content|fit-content/u);
  });

  it('pins each direct child to a reserved area, including before its siblings arrive', () => {
    for (const [selector, area] of [
      ['.nav__mark', 'mark'], ['.nav__links', 'links'], ['.nav__search', 'search'],
      ['.nav__chip', 'chip'], ['.nav__burger', 'menu'],
    ]) expect(value(rule(selector), 'grid-area')).toBe(area);
    expect(value(rule('.nav'), 'grid-template-areas')).toBe("'mark search chip menu'");
    expect(value(rule('.nav:not(.nav--localized)'), 'grid-template-areas')).toBe("'mark links search chip'");
  });

  it('reserves complete English and localized desktop widths independently of font loading', () => {
    const english = rule('.nav:not(.nav--localized)');
    const localized = rule('.nav--localized', css.split('@media (min-width: 1040px)')[1]);
    expect(value(english, 'width')).toBe('884px');
    expect(value(localized, 'width')).toBe('992px');
    expect(value(english, 'grid-template-columns')).toBe('116px minmax(0, 1fr) 62px 120px');
    expect(value(localized, 'grid-template-columns')).toBe('116px minmax(0, 1fr) 44px 120px');
    expect(nav).toContain("'nav--localized': locale !== 'en'");
    expect(nav).toContain("'nav--without-search': locale === 'ru'");
  });

  it('does not expose desktop links until the complete pill and 32px viewport margin fit', () => {
    const tiers = [...css.matchAll(/@media \(min-width: (\d+)px\) \{\s*(\.nav(?::not\(\.nav--localized\)|--localized)) \{([^}]+)\}/gu)];
    expect(tiers).toHaveLength(2);
    for (const [, breakpoint, , body] of tiers) {
      const width = Number.parseFloat(value(body, 'width'));
      expect(width + 32).toBeLessThanOrEqual(Number(breakpoint));
    }
    expect(value(rule('.nav__links'), 'display')).toBe('none');
    expect(css).not.toContain('@media (min-width: 820px)');
  });

  it('keeps both mobile controls at 44px with room for the lockup and destination', () => {
    const mobile = rule('.nav');
    const tracks = value(mobile, 'grid-template-columns');
    expect(tracks).toBe('minmax(0, 1fr) 44px 116px 44px');
    const reserved = 44 + 116 + 44 + 3 * 10 + 20 + 10 + 2;
    expect(Number.parseFloat(value(mobile, 'width')) - reserved).toBeGreaterThanOrEqual(70);
    const compact = css.split('@media (max-width: 360px)')[1].split('\n  }')[0];
    const compactShell = rule('.nav', compact);
    expect(value(compactShell, 'grid-template-columns')).toBe('minmax(0, 1fr) 44px 88px 44px');
    expect(Number.parseFloat(value(compactShell, 'width')) + 32).toBeLessThanOrEqual(320);
    expect(272 - (44 + 88 + 44 + 3 * 4 + 10 + 4 + 2)).toBeGreaterThanOrEqual(68);
    const localizedCompact = rule('.nav--localized', compact);
    expect(value(localizedCompact, 'width')).toBe('288px');
    expect(value(localizedCompact, 'grid-template-columns')).toBe('minmax(0, 1fr) 44px 100px 44px');
    // PT/FR English-only cues measure about 90px at the existing 7.5px face;
    // leave the full cue visible even on the smallest supported viewport.
    expect(100 - 7 - 1).toBeGreaterThanOrEqual(90);
    for (const selector of ['.nav__search', '.nav__burger']) {
      expect(value(rule(selector), 'width')).toBe('44px');
      expect(value(rule(selector), 'height')).toBe('44px');
    }
  });

  it('reserves the phone bar lockup before the chip or the face arrives', () => {
    // The centred ZODIACS | ASTROFOLIO pair must not be sized by its text: a
    // content-sized track re-centres the mark when the chip streams in after
    // first paint, which Lighthouse measured as layout shift on the homepage.
    const phone = css.split('@media (max-width: 919.5px) {')[1].split('\n  }\n')[0];
    const bar = rule('.nav-wrap .nav', phone);
    const tracks = value(bar, 'grid-template-columns');
    expect(tracks).not.toMatch(/\bauto\b|content/u);
    expect(tracks).toBe('44px minmax(0, 1fr) calc(var(--nav-lockup) * 5.7 + 13px) calc(var(--nav-lockup) * 8.27 + 13px) minmax(0, 1fr) 44px 44px');
    expect(value(bar, '--nav-lockup')).toBe('clamp(10px, 3.2vw, 13px)');
    expect(value(rule('.nav__mark', phone), 'font-size')).toBe('var(--nav-lockup)');
    expect(value(rule('.nav__chip', phone), 'font-size')).toBe('var(--nav-lockup)');
  });

  it('pins desktop link starts and provides a sixth localized Today track without truncation', () => {
    expect(value(rule('.nav__links'), 'grid-template-columns')).toBe('74px 74px 64px 62px 102px minmax(0, 1fr)');
    expect(value(rule('.nav--localized .nav__links'), 'grid-template-columns'))
      .toBe('128px 82px repeat(2, minmax(0, 1fr)) 156px');
    expect(value(rule('.nav--localized.nav--with-today .nav__links'), 'grid-template-columns'))
      .toBe('128px 82px 52px repeat(2, minmax(0, 1fr)) 144px');
    expect(nav).toContain("'nav--with-today': links.some((link) => link.href === '/today/')");
    expect(hasChildDependentNavigation(css)).toBe(false);
    expect(value(rule('.nav--without-search .nav__links'), 'grid-template-columns'))
      .toBe('136px 84px repeat(2, minmax(0, 1fr)) 172px');
    expect(rule('.nav__link')).not.toMatch(/overflow:\s*hidden|text-overflow|font-size:\s*0/u);
    expect(value(rule('.nav__link'), 'white-space')).toBe('nowrap');
    expect(value(rule('.nav__dropdown-btn'), 'justify-content')).toBe('space-between');
  });

  it.each([
    ['Guide grid declaration', (source) => source.replace('pointer-events: none;\n  }\n  .mobile-menu', 'pointer-events: none; grid-template-columns: 1fr;\n  }\n  .mobile-menu')],
    ['Guide display declaration', (source) => source.replace('pointer-events: none;\n  }\n  .mobile-menu', 'pointer-events: none; display: none;\n  }\n  .mobile-menu')],
    ['Guide width declaration', (source) => source.replace('pointer-events: none;\n  }\n  .mobile-menu', 'pointer-events: none; width: 0;\n  }\n  .mobile-menu')],
    ['different target', (source) => source.replace('.zguide-launcher) {', '.nav) {')],
    ['selector list', (source) => source.replace(':global(body:has(', '.nav, :global(body:has(')],
    ['selector prefix', (source) => source.replace(':global(body:has(', '.nav :global(body:has(')],
    ['another :has rule', (source) => `${source}\n.nav:has(.nav__chip) { opacity: 1; }`],
    ['child-dependent grid', (source) => `${source}\n.nav__link:nth-child(6) { grid-template-columns: 1fr; }`],
    ['duplicate Guide exception', (source) => `${source}\n:global(body:has([data-mobile-menu]:not([hidden])) .zguide-launcher) { visibility: hidden; pointer-events: none; }`],
  ])('keeps rejecting %s outside the exact Guide visibility exception', (_label, mutate) => {
    const changed = mutate(css);
    expect(changed).not.toBe(css);
    expect(hasChildDependentNavigation(changed)).toBe(true);
  });

  it('leaves headroom around weight-500 dropdown labels without taking space needed by other links', () => {
    const fixedTracks = (selector) => [...value(rule(selector), 'grid-template-columns')
      .matchAll(/(\d+)px/gu)].map(([, width]) => Number(width));
    const english = fixedTracks('.nav__links');
    const localized = fixedTracks('.nav--localized .nav__links');
    const localizedToday = fixedTracks('.nav--localized.nav--with-today .nav__links');

    // HVAR-aware source-font advances at 500, plus existing 22px padding,
    // 8px caret and 6px gap. These are static bounds, not browser fit proof.
    expect(english[0] - 71.994).toBeGreaterThanOrEqual(1);
    expect(english[1] - 72.050).toBeGreaterThanOrEqual(1);
    expect(localized[1] - 80.324).toBeGreaterThanOrEqual(1);
    expect(localizedToday[1] - 80.324).toBeGreaterThanOrEqual(1);

    const englishRow = 884 - 32 - 3 * 18 - 116 - 62 - 120;
    const localizedRow = 992 - 32 - 3 * 18 - 116 - 44 - 120;
    expect(englishRow - english.reduce((sum, width) => sum + width, 0) - 5 * 2).toBe(114);
    expect((localizedRow - localized.reduce((sum, width) => sum + width, 0) - 4 * 2) / 2).toBe(126);
    expect((localizedRow - localizedToday.reduce((sum, width) => sum + width, 0) - 5 * 2) / 2).toBe(105);
  });

  it('removes exactly the absent receiver chip and one gap without shrinking any surviving track', () => {
    const receiver = ':global(html[data-chart-share-receiver])';
    const compact = css.split('@media (max-width: 360px)')[1].split('\n  }')[0];
    const desktopEn = css.split('@media (min-width: 920px)')[1].split('@media (min-width: 1040px)')[0];
    const desktopLocalized = css.split('@media (min-width: 1040px)')[1];
    for (const [source, selector, before, chip, gap] of [
      [css, '.nav', 336, 116, 10],
      [css, '.nav--without-search', 292, 116, 10],
      [compact, '.nav', 272, 88, 4],
      [compact, '.nav--localized', 288, 100, 4],
      [compact, '.nav--without-search', 224, 88, 4],
      [desktopEn, '.nav:not(.nav--localized)', 884, 120, 18],
      [desktopLocalized, '.nav--localized', 992, 120, 18],
    ]) {
      const receiverRule = rule(`${receiver} ${selector}`, source);
      expect(Number.parseFloat(value(receiverRule, 'width'))).toBe(before - chip - gap);
      expect(value(receiverRule, 'grid-template-areas') ?? '').not.toContain('chip');
    }
    expect(value(rule(`${receiver} .nav`), 'grid-template-columns')).toBe('minmax(0, 1fr) 44px 44px');
    expect(value(rule(`${receiver} .nav--without-search`), 'grid-template-columns')).toBe('minmax(0, 1fr) 44px');
    expect(value(rule(`${receiver} .nav:not(.nav--localized)`, desktopEn), 'grid-template-columns'))
      .toBe('116px minmax(0, 1fr) 62px');
    expect(value(rule(`${receiver} .nav--localized`, desktopLocalized), 'grid-template-columns'))
      .toBe('116px minmax(0, 1fr) 44px');
    expect(value(rule(`${receiver} .nav--without-search`, desktopLocalized), 'grid-template-columns'))
      .toBe('116px minmax(0, 1fr)');
  });
});

describe('Instrument Sans fallback width and line-box metrics', () => {
  it.each(['src/styles/tokens.css', 'scripts/wing-nav.mjs'])('keeps every authored fallback in %s metric matched', (path) => {
    const faces = [...read(path).matchAll(/@font-face\s*\{([^}]*font-family:\s*'Instrument Sans Fallback(?: Android)?'[^}]*)\}/gu)];
    expect(faces).toHaveLength(2);
    for (const [, face] of faces) {
      const adjustment = Number.parseFloat(value(face, 'size-adjust')) / 100;
      expect(adjustment).toBe(1.035);
      expect(Number.parseFloat(value(face, 'ascent-override')) * adjustment).toBeCloseTo(97, 4);
      expect(Number.parseFloat(value(face, 'descent-override')) * adjustment).toBeCloseTo(25, 4);
      expect(value(face, 'line-gap-override')).toBe('0%');
      expect(face).not.toMatch(/url\(/u);
    }
  });

  it('leaves the established homepage font families and loading policy in place', () => {
    const home = read('src/home/home-first-paint.css');
    expect(home).toContain("--font-nav-sans: 'Instrument Sans', 'Instrument Sans Fallback'");
    expect(home.match(/font-display: optional;/gu)).toHaveLength(2);
    expect(home).toContain("font-family: 'Instrument Sans Hero'");
  });
});
