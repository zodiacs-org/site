import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontRoot = resolve(repositoryRoot, 'public/assets/home');

/**
 * Reproducible fontTools coverage used by the route-owned font files:
 *
 * U+0020-007E,U+00A9,U+00B0,U+00B1,U+00B7,U+00D7,U+00E1,U+00E7,
 * U+00EA,U+00F1,U+2013-2014,U+2019,U+201C-201D,U+2022,U+2026,
 * U+2032,U+2191,U+2193,U+2212
 *
 * pyftsubset SOURCE --output-file=TARGET --flavor=woff2
 *   --unicodes=CODEPOINTS --layout-features=kern,liga --no-hinting
 *
 * The source Latin faces do not own the horizontal/external-link arrows used
 * on the page; those characters deliberately retain the established system
 * fallback instead of causing a second full-font download.
 */
const fontContract = [
  {
    file: 'eb-garamond-home-400-core.woff2',
    source: 'public/fonts/eb-garamond-latin-400-normal.woff2',
    sha256: '815a63e9dd8466897f1b84a1751975d0eb0ce9608aa34ff4321380914541d8ad',
  },
  {
    file: 'eb-garamond-home-500-nav-core.woff2',
    source: 'public/fonts/eb-garamond-latin-500-normal.woff2',
    sha256: 'e1964873156b4f11e1bb5e667986c59030c05b5509cdb48cbc1d1645b4dbd6f8',
  },
  {
    file: 'instrument-sans-home-nav-core.woff2',
    source: 'public/fonts/instrument-sans-latin-wght-normal.woff2',
    sha256: 'e6a89c868b8952c9f4ba3cf6142b2ddd33b069ea771d1b1b47b9fc2fa6aecce5',
  },
  {
    file: 'jetbrains-mono-home-nav-core.woff2',
    source: 'public/fonts/jetbrains-mono-latin-wght-normal.woff2',
    sha256: 'd5ea581ca5afeb70ed5282c0c1b798b159bde43ad08fdf821229e925207ec812',
  },
];

// The two faces with font-display: optional. Each is preloaded, because
// Chromium holds the first frame only for a preloaded optional font.
const optionalHeroFaces = ['instrument-sans-home-nav-core.woff2', 'eb-garamond-home-400-core.woff2'];

describe('homepage first-paint assets', () => {
  it('keeps the motion control out of document flow before deferred styles load', async () => {
    const critical = await readFile(resolve(repositoryRoot, 'src/home/home-first-paint.css'), 'utf8');
    const page = await readFile(resolve(repositoryRoot, 'src/pages/index.astro'), 'utf8');
    const canonical = page.match(/<style>([\s\S]*?)<\/style>/u)[1];
    const controls = (css) => {
      const rules = [];
      postcss.parse(css).walkRules('.hero-motion', (rule) => {
        rules.push({ media: rule.parent.type === 'atrule' ? rule.parent.params : '', declarations: Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map((node) => [node.prop, node.value])) });
      });
      return rules;
    };
    const criticalControls = controls(critical);
    expect(criticalControls).toEqual(controls(canonical));
    expect(criticalControls[0].declarations.position).toBe('absolute');
    expect(criticalControls[0].declarations['min-height']).toBe('44px');
  });
  it.each(fontContract)('pins the deterministic $file subset', async ({ file, source, sha256 }) => {
    const [subset, full] = await Promise.all([
      readFile(resolve(fontRoot, file)),
      readFile(resolve(repositoryRoot, source)),
    ]);

    expect(subset.subarray(0, 4).toString('ascii')).toBe('wOF2');
    expect(subset.byteLength).toBeLessThan(full.byteLength);
    expect(createHash('sha256').update(subset).digest('hex')).toBe(sha256);
  });

  it('keeps route subsets local and avoids the full font files', async () => {
    const css = await readFile(resolve(repositoryRoot, 'src/home/home-first-paint.css'), 'utf8');

    expect(css.match(/font-display: optional;/g)).toHaveLength(2);
    expect(css.match(/font-display: swap;/g)).toHaveLength(1);
    expect(css).not.toMatch(/url\(['"]?\/fonts\//u);
    expect(css).toContain("--font-nav-serif: 'EB Garamond',");
    expect(css).toContain("--font-nav-sans: 'Instrument Sans',");
    expect(css).toContain("--font-nav-mono: 'JetBrains Mono',");
    expect(css).toContain('/assets/home/eb-garamond-home-400-core.woff2');
    expect(css).toContain('/assets/home/instrument-sans-home-nav-core.woff2');
    expect(css).toContain('/assets/home/jetbrains-mono-home-nav-core.woff2');
  });

  it('preloads each optional hero face after the poster hints', async () => {
    const page = await readFile(resolve(repositoryRoot, 'src/pages/index.astro'), 'utf8');
    const lastPosterHint = page.lastIndexOf('href="/assets/hero/zodiacs-hero-poster');

    for (const face of optionalHeroFaces) {
      const hint = page.match(new RegExp(`<link\\s+slot="head"\\s+rel="preload"\\s+as="font"\\s+type="font/woff2"\\s+href="/assets/home/${face.replaceAll('.', '\\.')}"\\s+crossorigin\\s*/>`, 'u'));
      expect(hint).not.toBeNull();
      expect(page.indexOf(hint[0])).toBeGreaterThan(lastPosterHint);
    }
  });

  it('keeps the mobile poster motion on the first-render path', async () => {
    const css = await readFile(resolve(repositoryRoot, 'src/home/home-first-paint.css'), 'utf8');

    expect(css).toContain('@keyframes hero-poster-drift');
    expect(css).toContain('@media (max-width: 719px) and (prefers-reduced-motion: no-preference)');
    expect(css).toContain(".hero__poster[data-hero-motion='drift']");
    expect(css).toContain(".hero__poster[data-hero-visible='false'] { animation-play-state: paused; }");
  });

  it('keeps the pre-August 31 hero hierarchy on the real route fonts', async () => {
    const [css, page] = await Promise.all([
      readFile(resolve(repositoryRoot, 'src/home/home-first-paint.css'), 'utf8'),
      readFile(resolve(repositoryRoot, 'src/pages/index.astro'), 'utf8'),
    ]);

    expect(css).toMatch(/\.hero__title\s*\{[^}]*font-family: 'Instrument Sans Hero'/su);
    expect(css).toMatch(/\.hero__sub\s*\{[^}]*font-family: 'Instrument Sans Hero'/su);
    expect(css).toMatch(/\.hero__ctas\s*\{[^}]*font-family: 'Instrument Sans Hero'/su);
    expect(css).toMatch(/\.hero__trust\s*\{[^}]*font-family: 'JetBrains Mono Hero'/su);
    expect(page).toMatch(/\.hero__title\s*\{[^}]*font-family: 'Instrument Sans Hero'/su);
    expect(page).toMatch(/\.hero__trust\s*\{[^}]*font-family: 'JetBrains Mono Hero'/su);
    expect(page).toContain('<h1 class="hero__title">Your whole chart, <em>not just your sign.</em></h1>');
    expect(page).toContain('Free birth charts, moon signs, compatibility, and horoscopes —');
    expect(page).toContain('Get your free birth chart');
    expect(page).toContain('Your horoscope');
    expect(page).toContain('Free · No signup · Calculated in your browser');
    expect(page).not.toContain('class="hero__story"');
    expect(page).not.toContain('class="hero__method"');
  });

  it('keeps the deterministic sky receipt server-rendered without a hydration directive', async () => {
    const page = await readFile(resolve(repositoryRoot, 'src/pages/index.astro'), 'utf8');
    const ticker = page.match(/<SkyTicker\b[^>]*\/>/gu);

    expect(ticker).toEqual(['<SkyTicker />']);
    // The saved-profile island has no SSR child for visibility observation.
    // Idle hydration makes returning state reachable without changing the sky receipt.
    expect(page).toContain('<WelcomeBack client:idle />');
    expect(page).toContain('<TodayBySign client:visible={{ rootMargin: \'240px\' }} />');
  });

  it.skipIf(!existsSync(resolve(repositoryRoot, 'dist/index.html')))(
    'discovers the poster first and installs client copy after the hero',
    async () => {
      const html = await readFile(resolve(repositoryRoot, 'dist/index.html'), 'utf8');
      const posterHint = html.indexOf('href="/assets/hero/zodiacs-hero-poster-mobile.avif"');
      const criticalBase = html.indexOf('data-zdx-critical=');
      const hero = html.indexOf('<section class="hero');
      const catalog = html.indexOf('globalThis.__ZDX_UI__');
      const firstIsland = html.indexOf('<astro-island');

      expect(posterHint).toBeGreaterThanOrEqual(0);
      expect(posterHint).toBeLessThan(criticalBase);
      expect(hero).toBeGreaterThan(criticalBase);
      expect(catalog).toBeGreaterThan(hero);
      expect(catalog).toBeLessThan(firstIsland);
      for (const { file } of fontContract) expect(html).toContain(`/assets/home/${file}`);
      // The two optional hero faces are preloaded after the poster hints, so
      // the first frame waits for them instead of re-laying the hero out.
      for (const face of optionalHeroFaces) {
        const hint = html.indexOf(`<link rel="preload" as="font" type="font/woff2" href="/assets/home/${face}" crossorigin>`);
        expect(hint).toBeGreaterThan(posterHint);
        expect(hint).toBeLessThan(criticalBase);
      }

      // The receipt remains available without JavaScript, and its static
      // dependency tree must not become a home hydration root again.
      expect(html).toContain('class="skyticker mono"');
      expect(html).toContain('class="skyticker__label"');
      expect(html.match(/class="skyticker__item"/gu)?.length).toBeGreaterThanOrEqual(3);
      expect(html).not.toMatch(/component-url="[^"]*\/SkyTicker\.[^"]*"/u);
    },
  );
});
