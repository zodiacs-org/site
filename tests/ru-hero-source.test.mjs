import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

// The Russian hero, markup, playback script and drift rules, lives in its
// own component; the Russian page renders it through the shared home.
const source = await readFile(new URL('../src/components/localized/RuHomeHero.astro', import.meta.url), 'utf8');
const page = await readFile(new URL('../src/pages/ru/index.astro', import.meta.url), 'utf8');
const home = await readFile(new URL('../src/components/localized/LocalizedHome.astro', import.meta.url), 'utf8');
const head = await readFile(new URL('../src/components/localized/LocalizedHomeHead.astro', import.meta.url), 'utf8');
const footerSource = await readFile(new URL('../src/components/SiteFooter.astro', import.meta.url), 'utf8');
const navSource = await readFile(new URL('../src/components/SiteNav.astro', import.meta.url), 'utf8');
const englishOnlySource = await readFile(new URL('../src/lib/i18n/english-only.ts', import.meta.url), 'utf8');

describe('hidden Russian homepage hero media contract', () => {
  it('is the hero the Russian page renders, with its own poster hints', () => {
    expect(page).toContain('<LocalizedHome locale="ru"');
    expect(page).toContain('<LocalizedHomeHead slot="head" locale="ru" />');
    expect(home).toMatch(/\{locale === 'ru' \? \(\s*<RuHomeHero\b/u);
    expect(head).toContain('href="/assets/hero/zodiacs-hero-poster-ru-mobile.avif" media="(max-width: 719px)" fetchpriority="high"');
    expect(head).toContain('href="/assets/hero/zodiacs-hero-poster-ru.avif" media="(min-width: 720px)" fetchpriority="high"');
  });

  it('keeps the poster as LCP and every video source detached initially', () => {
    expect(source).toContain('src="/assets/hero/zodiacs-hero-poster-ru.avif"');
    expect(source).toContain('srcset="/assets/hero/zodiacs-hero-poster-ru-mobile.avif"');
    expect(source).toContain('media="(max-width: 719px)"');
    expect(source).toContain('data-hero-poster-ru');
    expect(source).toContain('width="1440"');
    expect(source).toContain('height="810"');
    expect(source).not.toMatch(/<video[^>]*\sposter=/);
    expect(source).toContain('preload="none"');
    expect(source).toContain('data-src="/assets/hero/zodiacs-hero-av1.mp4"');
    expect(source).toContain('data-src="/assets/hero/zodiacs-hero.mp4"');
    expect(source).not.toMatch(/<(?:video|source)[^>]*\ssrc="\/assets\/hero\/zodiacs-hero/);
  });

  it('attaches playback only through interaction and respects constrained modes', () => {
    expect(source).toContain("['pointerdown', 'touchstart', 'keydown']");
    expect(source).toContain('connection.saveData');
    expect(source).toContain("['slow-2g', '2g']");
    expect(source).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(source).not.toContain('compactViewport');
  });

  it('pauses offscreen and returns failed playback to the moving poster', () => {
    expect(source).toContain("new IntersectionObserver");
    expect(source).toContain("v.dataset.heroPlayback = 'poster-fallback'");
    expect(source).toContain("v.dataset.heroVisible = String(visible)");
    expect(source).toContain(".hero-ru__poster[data-hero-visible='false'] { animation-play-state: paused; }");
    expect(source).toContain('@keyframes hero-poster-drift');
  });
});

describe('hidden Russian deferred-product safeguards', () => {
  it('never mounts the English-backed email signup on a Russian route', () => {
    expect(footerSource).toContain("locale !== 'ru' && !isRegistryWing && !suppressFooterEmailCapture");
  });

  it('labels English-only navigation and removes the deferred birthday tool', () => {
    // The RU-only labeling generalized into the shared english-only courtesy;
    // the safeguard now pins that mechanism plus the RU strings it serves.
    expect(navSource).toContain('const englishOnly = englishOnlyCue(locale);');
    expect(navSource).toContain("'nav__link--deferred': englishOnlyHref(l.href)");
    expect(englishOnlySource).toContain(
      "ru: { suffix: ' (пока по-английски)', aria: 'Материал пока доступен по-английски' }",
    );
    expect(navSource).toContain("NAV_TOOLS.filter((tool) => tool.href !== '/birthday/')");
    expect(navSource).toContain("locale === 'ru' ? null : locale === 'en'");
  });
});
