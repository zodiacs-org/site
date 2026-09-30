import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const signs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

function primaryNav(html) {
  const start = html.indexOf('<nav class="wnav"');
  expect(start, 'primary .wnav exists').toBeGreaterThanOrEqual(0);
  const end = html.indexOf('</nav>', start);
  expect(end, 'primary .wnav closes').toBeGreaterThan(start);
  return html.slice(start, end + '</nav>'.length);
}

function openingTagBefore(source, marker) {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex, `${marker} exists`).toBeGreaterThanOrEqual(0);
  const start = source.lastIndexOf('<', markerIndex);
  const end = source.indexOf('>', start);
  return source.slice(start, end + 1);
}

function cssRule(source, selector) {
  const start = source.indexOf(selector);
  expect(start, `${selector} exists`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return source.slice(start, close + 1);
}

function expectMainSiteNavType(html) {
  const wrap = cssRule(html, '.wnav-wrap {');
  expect(wrap).toContain("--wing-sans: 'Instrument Sans', 'Instrument Sans Fallback', 'Instrument Sans Fallback Android', system-ui, -apple-system, sans-serif");
  expect(wrap).toContain("--wing-serif: 'EB Garamond', 'EB Garamond Fallback', 'EB Garamond Fallback Android', 'EB Garamond Fallback Times', 'Iowan Old Style', Georgia, serif");
  expect(cssRule(html, '.wnav__link {')).toContain('font-family: var(--wing-sans);');
  expect(cssRule(html, '.wnav__link {')).not.toContain("'Segoe UI'");
  expect(cssRule(html, '.wnav__name {')).toContain('font-family: var(--wing-serif);');
  expect(cssRule(html, '.wnav__chip {')).toContain('font-family: var(--wing-serif);');
}

describe('Registry catalogue shell parity', () => {
  it('keeps the catalogue navigation label plain across all records', async () => {
    const [hub, ...profiles] = await Promise.all([
      read('public/registry/index.html'),
      ...signs.map((sign) => read(`public/registry/${sign}/index.html`)),
    ]);

    for (const html of [hub, ...profiles]) {
      expect(html).toContain('<span>Astrofolio</span><small>The twelve Zodiac signs</small>');
      expect(html).not.toContain('gold Zodiac sculptures');
    }
  });

  it('uses one main-site-style navigation capsule on the hub and all twelve profiles', async () => {
    const outputs = await Promise.all([
      read('public/registry/index.html'),
      ...signs.map((sign) => read(`public/registry/${sign}/index.html`)),
    ]);

    for (const html of outputs) {
      const nav = primaryNav(html);
      const toolsTag = openingTagBefore(nav, '>Tools<svg');
      const searchIndex = nav.indexOf('class="wnav__search"');
      const chipIndex = nav.indexOf('class="wnav__chip"');
      const burgerIndex = nav.indexOf('class="wnav__burger"');

      expect(html.match(/<nav class="wnav"/gu)).toHaveLength(1);
      expect(nav).not.toContain('wnav__pill');
      expect(nav).toMatch(/<\/div>\s*<a class="wnav__profile-shortcut" href="\/profile\/" aria-label="Your profile"/u);
      expect(nav).toContain('<a class="wnav__search" href="/?search=1" aria-label="Search the site">');
      expect(searchIndex).toBeGreaterThan(nav.indexOf('class="wnav__links"'));
      expect(chipIndex).toBeGreaterThan(searchIndex);
      expect(burgerIndex).toBeGreaterThan(chipIndex);

      expect(toolsTag).toMatch(/^<button\b/u);
      expect(toolsTag).toContain('class="wnav__link wnav__dropdown-btn"');
      expect(toolsTag).toContain('type="button"');
      expect(toolsTag).toContain('data-wnav-tools');
      expect(toolsTag).toContain('aria-expanded="false"');
      expect(toolsTag).toContain('aria-controls="wnav-tools"');
      expect(toolsTag).toContain('aria-haspopup="true"');
      expect(html).toContain('id="wnav-tools" data-wnav-tools-menu hidden');
      expect(html.match(/class="wnav-tools__item"/gu)).toHaveLength(8);
    }
  });

  it('keeps the shared sans interface and gives profile display headings the site serif', async () => {
    const [hub, ...profiles] = await Promise.all([
      read('public/registry/index.html'),
      ...signs.map((sign) => read(`public/registry/${sign}/index.html`)),
    ]);

    expect(hub).toContain("--sans:'Instrument Sans','Instrument Sans Fallback','Instrument Sans Fallback Android',system-ui,-apple-system,sans-serif");
    expect(cssRule(hub, 'body {')).toContain('font-family:var(--sans);');
    expect(cssRule(hub, 'h1 {')).toContain('var(--sans)');
    expect(cssRule(hub, 'h2 {')).toContain('var(--sans)');
    expectMainSiteNavType(hub);

    for (const html of profiles) {
      expect(html).toContain("--sans: 'Instrument Sans', 'Instrument Sans Fallback', 'Instrument Sans Fallback Android', system-ui, -apple-system, sans-serif");
      expect(html).toContain('--serif: var(--sans);');
      expect(cssRule(html, 'html, body {')).toContain('font-family: var(--sans);');
      expect(cssRule(html, '.lot__title {')).toContain('font-family: var(--profile-display);');
      expect(cssRule(html, '.sec__title {')).toContain('font-family: var(--profile-display);');
      expect(cssRule(html, '.record-detail__title {')).toContain('font-family: var(--profile-display);');
      expectMainSiteNavType(html);
    }
  });
});
