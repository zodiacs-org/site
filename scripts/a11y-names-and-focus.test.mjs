// Landmarks, names and focus from the accessibility audit (12 Nov 2026, L1, L2
// and L7): the site header is a banner landmark, an aria-label sits only on an
// element that can take a name (ARIA 1.2 forbids names on plain p and div),
// and the global focus ring is 2px.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('site header landmark', () => {
  it('wraps the primary navigation in a header, outside main, so it is the banner', () => {
    const markup = read('src/components/SiteNav.astro').split('\n<style>')[0];
    const body = markup.split('\n---\n')[1];
    expect(body.trimStart().startsWith('<header class="nav-wrap">')).toBe(true);
    expect(body).toMatch(/<\/header>\s*<div class="mobile-menu"/u);
    expect(read('src/layouts/Base.astro')).toMatch(/<SiteNav [^>]*\/>[\s\S]*<main id="main">/u);
  });
});

describe('names only on elements that can take one', () => {
  const plainNamed = /<(?:p|div)\b(?![^>]*\brole=)[^>]*\baria-label=/u;
  it.each([
    'src/islands/SkyTicker.tsx',
    'src/pages/birth-chart/index.astro',
    'src/components/localized/LocalizedBirthChart.astro',
  ])('%s', (path) => {
    expect(read(path)).not.toMatch(plainNamed);
  });

  it('leaves the Today saved-chart placeholder unnamed (its heading says what it is)', () => {
    expect(read('src/islands/today/TodayBrief.tsx')).toMatch(/<div class="today-returning-chart-placeholder today-reading">/u);
  });

  it('names the Astrofolio Registry facts as a group', () => {
    expect(read('public/astrofolio/index.html')).toContain('<div class="static-how__proof" role="group" aria-label="Registry facts">');
  });
});

describe('focus ring', () => {
  it('is 2px wide by default (WCAG 2.4.13)', () => {
    expect(read('src/styles/base.css')).toMatch(/\n:focus-visible \{\n  outline: 2px solid var\(--accent\);/u);
  });
});
