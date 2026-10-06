import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const source = async (relativePath: string): Promise<string> => readFile(
  fileURLToPath(new URL(relativePath, root)),
  'utf8',
);

const MOTION_SOURCES = [
  'styles/base.css',
  'styles/prose.css',
  'styles/evidence-disclosure.css',
  'components/SiteNav.astro',
  'components/SiteFooter.astro',
  'components/EmailCapture.astro',
  'components/HoroscopeProgramPage.astro',
  'pages/today/index.astro',
  'pages/horoscopes/index.astro',
] as const;

const ALLOWED_MOTION_PROPERTIES = new Set(['none', 'opacity', 'transform']);

function keyframeBlocks(css: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    const start = css.indexOf('@keyframes', cursor);
    if (start === -1) break;
    const open = css.indexOf('{', start);
    if (open === -1) break;
    let depth = 1;
    let end = open + 1;
    while (end < css.length && depth > 0) {
      if (css[end] === '{') depth += 1;
      if (css[end] === '}') depth -= 1;
      end += 1;
    }
    blocks.push(css.slice(open + 1, end - 1));
    cursor = end;
  }
  return blocks;
}

describe('Phase 1 layout and motion contract', () => {
  it('animates only transform and opacity on every Phase 1 surface dependency', async () => {
    for (const relativePath of MOTION_SOURCES) {
      const css = await source(relativePath);
      const transitions = [...css.matchAll(/\btransition\s*:\s*([^;{}]+);/gu)];
      for (const transition of transitions) {
        const properties = transition[1]
          .split(',')
          .map((part) => part.trim().match(/^([a-z-]+)/iu)?.[1])
          .filter((property): property is string => Boolean(property));
        expect(properties, `${relativePath}: ${transition[0]}`).not.toHaveLength(0);
        expect(
          properties.every((property) => ALLOWED_MOTION_PROPERTIES.has(property)),
          `${relativePath}: ${transition[0]}`,
        ).toBe(true);
      }

      for (const block of keyframeBlocks(css)) {
        const properties = [...block.matchAll(/(?:^|[;{])\s*([a-z-]+)\s*:/gmu)]
          .map((match) => match[1]);
        expect(properties, `${relativePath}: keyframes must contain declarations`).not.toHaveLength(0);
        expect(
          properties.every((property) => ALLOWED_MOTION_PROPERTIES.has(property)),
          `${relativePath}: @keyframes uses ${properties.join(', ')}`,
        ).toBe(true);
      }

      if (/\banimation\s*:/u.test(css)) {
        expect(css, `${relativePath}: animated motion needs a static fallback`)
          .toContain('prefers-reduced-motion: reduce');
      }
    }
  });

  it('keeps hydration-only Today copy and streak geometry in the server layout', async () => {
    const [fallback, brief, page] = await Promise.all([
      source('islands/today/SunSignFallback.tsx'),
      source('islands/today/TodayBrief.tsx'),
      source('pages/today/index.astro'),
    ]);

    expect(fallback).toContain("class={`today-fallback__status${noChartConfirmed || selfChartUnselected || comparisonUnavailable ? ' is-visible' : ''}`}");
    expect(fallback).toContain('const introCopy = `This is usually the zodiac sign');
    expect(fallback).toContain('<p>{introCopy}</p>');
    expect(fallback).not.toContain('clear note for the {editionLabel} edition');
    expect(brief).toContain('data-ready={streak !== null');
    expect(brief).toContain("streak > 999 ? '999+' : (streak ?? 1)");
    expect(page).toMatch(/\.today-streak\s*\{[\s\S]*?grid-template-columns: 3\.75rem max-content;[\s\S]*?min-width: 0;/u);
    expect(page).toMatch(/\.today-streak__count\s*\{[\s\S]*?min-width: 0;/u);
    expect(brief).toContain('day streak');
    expect(page).toContain('.today-fallback__status.is-visible { visibility: visible; }');
  });

  it('preserves the complete stored Sun-sign SSR subtree through hydration', async () => {
    const [fallback, page] = await Promise.all([
      source('islands/today/SunSignFallback.tsx'),
      source('pages/today/index.astro'),
    ]);
    expect(fallback).not.toContain('restoredSelection');
    expect(fallback).toMatch(
      /active && dailyLine && hasInteracted \? \([\s\S]*?\) : \(\s*<div class="today-sign-readings" data-today-all-signs>/u,
    );
    expect(page).toMatch(
      /:root\[data-today-sun-sign\]\s*\{\s*scrollbar-gutter:\s*stable both-edges;\s*\}/u,
    );
    expect(page).toContain("document.documentElement.setAttribute('data-today-stream-pending', '');");
    expect(page).toMatch(
      /DOMContentLoaded[\s\S]*?requestAnimationFrame[\s\S]*?requestAnimationFrame[\s\S]*?removeAttribute\('data-today-stream-pending'\)/u,
    );
    expect(page).toMatch(
      /:root\[data-today-sun-sign\]\[data-today-stream-pending\] \.today-provenance\s*\{\s*visibility:\s*hidden;\s*\}/u,
    );
    expect(page).toMatch(
      /:root\[data-today-sun-sign\]:not\(\[data-today-saved-chart\]\) \.today-fallback__result\s*\{\s*min-height:\s*224px;\s*\}/u,
    );
  });

  it('scopes saved-chart reservations to unresolved fallback nodes', async () => {
    const [today, program] = await Promise.all([
      source('pages/today/index.astro'),
      source('components/HoroscopeProgramPage.astro'),
    ]);
    expect(today).toMatch(/\.today-reading__body\s*\{[^}]*display:\s*grid;[^}]*min-height:\s*326px;/u);
    expect(today).toMatch(/@media \(max-width: 480px\)\s*\{\s*\.today-reading__body\s*\{\s*min-height:\s*488px;\s*\}/u);
    expect(today).toContain("data-living-chart-enabled={livingChartEnabled ? '' : undefined}");
    expect(today).toMatch(
      /\.today-page\[data-living-chart-enabled\] \.today-reading__body\s*\{\s*min-height:\s*570px;\s*\}/u,
    );
    expect(today).toMatch(
      /\.today-page\[data-living-chart-enabled\] \.today-returning-chart-placeholder \.today-reading__head h2\s*\{[^}]*overflow:\s*hidden;[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/u,
    );
    expect(today).not.toContain('.today-returning-chart-placeholder { min-height:');
    expect(today).not.toContain(':root[data-today-saved-chart] .today-reading { min-height:');
    expect(program).toMatch(/\.program :global\(\.dfy__body\)\s*\{[^}]*display:\s*grid;[^}]*height:\s*260px;/u);
    expect(program).toContain('.program :global(.dfy__body) { height: 292px; }');
    expect(program).not.toMatch(/\.program :global\(\.dfy\)\s*\{[^}]*\b(?:min-)?height\s*:/u);
    expect(program).not.toContain(':global(.dfy--placeholder) { min-height:');
    expect(program).not.toContain(':global(:root[data-dfy-saved-chart]) .program :global(.dfy) {\n    min-height:');
  });

  it('keeps the lazy Living Chart reflection in the saved-chart geometry', async () => {
    const [brief, today] = await Promise.all([
      source('islands/today/TodayBrief.tsx'),
      source('pages/today/index.astro'),
    ]);
    expect(brief).toContain('{livingChartEnabled && <LivingReflection />}');
    expect(brief).toContain('<LivingReflection prompt={reflectionPrompt} />');
    expect(brief.match(/<button class="btn btn--ghost living-moment-trigger">/gu)).toHaveLength(2);
    expect(brief).not.toContain('<span class="btn btn--primary"><span>Save this moment</span>');
    expect(today).toContain(".today-useful[aria-hidden='true'] { visibility: hidden; }");
    expect(today).toContain('.today-useful__question { min-block-size: 3.1em; }');
    expect(today).toContain('.today-useful__question { min-block-size: 4.65em; }');
  });

  it('reserves both picture and image geometry for every pastel sign icon', async () => {
    const [icon, program, fallback] = await Promise.all([
      source('components/SignIcon.astro'),
      source('components/HoroscopeProgramPage.astro'),
      source('islands/today/SunSignFallback.tsx'),
    ]);
    expect(icon).toContain('height: auto;');
    expect(icon).toContain('aspect-ratio: 1;');
    expect(icon).toContain('.sign-icon img { display: block; width: 100%; height: auto; aspect-ratio: 1;');
    expect(icon).toContain('fetchpriority={fetchPriority}');
    expect(program).toContain('fetchPriority="high"');
    expect(program).toContain("const compactHeroIcon = surface === 'today' || surface === 'love' || surface === 'career';");
    expect(program).toContain('webpOnly={compactHeroIcon}');
    expect(program).toContain("decoding={compactHeroIcon ? 'sync' : 'async'}");
    expect(fallback).toContain('inline-size:${size}px;block-size:${size}px;aspect-ratio:1;contain:layout size');
    expect(fallback).toContain('decoding="sync"');
    expect(fallback).toContain('/assets/zodiac-icons/48/${sign.slug}.avif');
  });

  it('pins every Today sign-picker child to a fixed card track during hydration', async () => {
    const today = await source('pages/today/index.astro');
    expect(today).toMatch(/\.today-sign\s*\{[^}]*grid-template-rows:\s*34px 18px 16px;[^}]*align-content:\s*start;[^}]*block-size:\s*88px;/u);
    expect(today).toMatch(/\.today-sign__icon\s*\{[^}]*grid-row:\s*1;/u);
    expect(today).toMatch(/\.today-sign__name\s*\{[^}]*grid-row:\s*2;/u);
    expect(today).toMatch(/\.today-sign__dates\s*\{[^}]*grid-row:\s*3;/u);
    expect(today).not.toMatch(/@media \(max-width:\s*480px\)\s*\{[\s\S]*?\.today-sign\s*\{[^}]*min-height:/u);
  });

  it('loads the below-reading personalization bundle only when its saved-chart fallback is visible', async () => {
    const daily = await source('pages/horoscopes/[sign]/index.astro');
    expect(daily).toContain('<DailyForYou slot="enhancement" client:visible');
    expect(daily).not.toContain('<DailyForYou slot="enhancement" client:load');
    expect(daily).not.toContain('<DailyForYou slot="enhancement" client:idle');
  });

  it('does not permit a late webfont swap after first paint', async () => {
    const tokens = await source('styles/tokens.css');
    const fontFaces = (tokens.match(/@font-face\s*\{[^}]+\}/gu) ?? [])
      .filter((face) => face.includes("url('/fonts/"));
    const phase1FontFaces = fontFaces.filter((face) => face.includes(' Phase1'));
    const russianFontFaces = fontFaces.filter((face) => (
      face.includes("font-family: 'Golos Text'")
      || face.includes("font-family: 'EB Garamond Cyrillic'")
      || face.includes("font-family: 'JetBrains Mono Cyrillic'")
    ));
    const establishedFontFaces = fontFaces.filter((face) => (
      !face.includes(' Phase1') && !russianFontFaces.includes(face)
    ));
    expect(phase1FontFaces).toHaveLength(6);
    expect(establishedFontFaces).toHaveLength(6);
    expect(russianFontFaces).toHaveLength(4);
    for (const face of phase1FontFaces) {
      expect(face).toContain('font-display: optional;');
    }
    for (const face of establishedFontFaces) {
      expect(face).toContain('font-display: swap;');
    }
    for (const face of russianFontFaces) {
      expect(face).toContain('font-display: swap;');
    }

    const [base, today, hub, program] = await Promise.all([
      source('layouts/Base.astro'),
      source('pages/today/index.astro'),
      source('pages/horoscopes/index.astro'),
      source('components/HoroscopeProgramPage.astro'),
    ]);
    expect(base).toContain('data-stable-typography={props.stableTypography');
    expect(base).toContain('data-local-typography={props.localTypography');
    expect(base).toContain('data-stable-chrome-typography={props.stableChromeTypography');
    expect(today).toMatch(/<Base\s+[\s\S]*?localTypography/u);
    expect(today).toMatch(/<Base\s+[\s\S]*?stableChromeTypography/u);
    expect(today).toMatch(/<Base\s+[\s\S]*?minimalNavFontPreloads/u);
    expect(today).toMatch(/<TodayBrief\s+[\s\S]*?client:idle/u);
    const todayPageRule = today.match(/\.today-page\s*\{([^}]*)\}/u)?.[1] ?? '';
    expect(todayPageRule).toContain(
      "font-family: Arial, 'Liberation Sans', system-ui, -apple-system, sans-serif;",
    );
    expect(todayPageRule).not.toContain('Fallback');
    for (const phase1Surface of [today, hub, program]) {
      expect(phase1Surface).toMatch(/<Base\s+[\s\S]*?stableTypography/u);
    }
  });

  it('keeps shared navigation typography independent from route-level reader modes', async () => {
    const [tokens, nav, base] = await Promise.all([
      source('styles/tokens.css'),
      source('components/SiteNav.astro'),
      source('layouts/Base.astro'),
    ]);
    const routeTypography = [...tokens.matchAll(
      /:root\[data-(?:stable|local)-typography\]\s*\{([^}]*)\}/gu,
    )].map((match) => match[1]).join('\n');

    expect(tokens).toContain("--font-nav-serif: 'EB Garamond'");
    expect(tokens).toContain("--font-nav-sans: 'Instrument Sans'");
    expect(tokens).toContain("--font-nav-mono: 'JetBrains Mono'");
    expect(tokens).toContain("--font-nav-sans: 'Golos Text'");
    expect(base).toContain('href="/fonts/instrument-sans-latin-wght-normal.woff2"');
    expect(base).toContain('href="/fonts/eb-garamond-latin-400-normal.woff2"');
    expect(base).toContain('href="/fonts/eb-garamond-latin-500-normal.woff2"');
    expect(base).toContain('href="/fonts/jetbrains-mono-latin-wght-normal.woff2"');
    expect(base).toContain("media={props.minimalNavFontPreloads ? '(min-width: 782px)' : undefined}");
    expect(base).toContain('props.preloadMonoFont || (props.minimalNavFontPreloads && props.stableChromeTypography)');
    expect(base).toContain("media={props.preloadMonoFont ? undefined : '(min-width: 782px)'}");
    expect(routeTypography).not.toContain('--font-nav-');
    expect(nav).toMatch(/\.nav-wrap\s*\{[^}]*font-family:\s*var\(--font-nav-sans\);/u);
    expect(nav).toMatch(/\.mobile-menu\s*\{[^}]*font-family:\s*var\(--font-nav-sans\);/u);
    expect(nav).toContain('class="nav__search-kbd"');
    expect(nav).toContain('.nav { gap: 4px; padding-inline: 10px 4px; }');
    expect(nav).toContain('.nav__name { font-size: 11px; letter-spacing: 0.08em; }');
    expect(nav).toContain('.nav__chip { padding-inline: 7px 0; font-size: 11px; letter-spacing: 0.04em; }');
    expect(nav).not.toMatch(/var\(--font-(?:serif|sans|mono)\)/u);
  });

  it('keeps dense demo marks collision-aware while preserving large jump controls', async () => {
    const [demo, home] = await Promise.all([
      source('islands/DemoChart.tsx'),
      source('pages/index.astro'),
    ]);
    expect(demo).toContain('const interactivePoints = [...rawPlanetTargets, ...rawHouseTargets, ...rawAspectTargets]');
    expect(demo).toContain('return Math.min(maximum, nearest * 0.82);');
    expect(demo.match(/style=\{position\(target\.point, undefined, target\.hit\)\}/gu)).toHaveLength(2);
    expect(home).toContain('width: min(38px, calc(var(--hit) * 1%));');
    expect(home).toContain('width: min(34px, calc(var(--hit) * 1%));');
    expect(home).toContain('width: min(31px, calc(var(--hit) * 1%));');
    expect(home).toMatch(/\.demo__jump\)\s*\{[^}]*min-height:\s*66px;/u);
  });

  it('does not attach generic scroll reveals to the Phase 1 reader templates', async () => {
    const [program, hub] = await Promise.all([
      source('components/HoroscopeProgramPage.astro'),
      source('pages/horoscopes/index.astro'),
    ]);
    expect(program).not.toMatch(/class="[^"]*\breveal\b/u);
    expect(hub).not.toMatch(/class="[^"]*\breveal\b/u);
  });
});
