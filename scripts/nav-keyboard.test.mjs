// Keyboard access to the desktop navigation (accessibility audit, 12 Nov 2026):
// every link in an open Tools or Signs panel is reachable with Tab, and site
// search opens with Ctrl/Cmd+K only, never on a bare character key (WCAG 2.1.4).
// The real nav module and search loader from SiteNav.astro run in Chromium
// against a small fixture with the same hooks and DOM order (the panels sit
// after the nav, as they do on the site).
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import { chromium } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src/components/SiteNav.astro', import.meta.url), 'utf8');
const markup = source.split('\n<style>')[0];
const navModule = transformSync(source.split('\n<script>\n')[1].split('</script>')[0], { loader: 'ts' }).code;
const searchLoader = source.match(/<script is:inline>\s*(\/\* Site search loader[\s\S]*?)<\/script>/u)?.[1];

const tools = ['Birth chart', 'Compatibility', 'Transits', 'Moon sign', 'Rising sign', 'Numerology', 'All tools'];
const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer'];
const links = (names) => names.map((name) => `<a href="/${name.toLowerCase().replace(/ /gu, '-')}/">${name}</a>`).join('');
const fixture = `<!doctype html><html lang="en"><body>
<div class="nav-wrap">
  <nav data-nav aria-label="Primary">
    <a href="/">Home</a>
    <div>
      <button type="button" data-tools-toggle aria-expanded="false" aria-controls="tools-menu">Tools</button>
      <button type="button" data-signs-toggle aria-expanded="false" aria-controls="signs-menu">Signs</button>
      <a href="/today/">Today</a>
    </div>
    <button type="button" data-search-open aria-label="Search the site">Search</button>
  </nav>
  <div id="tools-menu" data-tools-menu hidden><div>${links(tools)}</div></div>
  <div id="signs-menu" data-signs-menu hidden><div>${links(signs)}</div></div>
</div>
<main><a href="/learn/">Learn</a><input aria-label="Name"></main>
<script type="module">${navModule}</script>
<script>${searchLoader}</script>
</body></html>`;

let browser;
let page;
const focused = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
const expanded = (hook) => page.getAttribute(`[${hook}]`, 'aria-expanded');

beforeAll(async () => {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.route('http://nav.test/**', (route) => {
    if (route.request().url().includes('/assets/search-ui.js')) {
      return route.fulfill({
        contentType: 'text/javascript',
        body: 'export function openSearch() { window.searchOpened = (window.searchOpened || 0) + 1; }',
      });
    }
    return route.fulfill({ contentType: 'text/html', body: fixture });
  });
}, 30_000);

afterAll(async () => { await browser?.close(); });

async function load() {
  await page.goto('http://nav.test/');
  await page.waitForFunction(() => document.querySelector('[data-tools-toggle]') && document.readyState === 'complete');
}

describe('desktop navigation menus', () => {
  it('marks the Tools and Signs buttons as disclosures, not menu buttons', () => {
    const buttons = markup.match(/<button class="nav__link nav__dropdown-btn"[^>]*>/gu);
    expect(buttons).toHaveLength(2);
    for (const button of buttons) {
      expect(button).toContain('aria-expanded="false"');
      expect(button).not.toContain('aria-haspopup');
    }
    expect(navModule).not.toMatch(/tabIndex/u);
  });

  it('reaches every link of an open panel with Tab, then moves on and closes it', async () => {
    await load();
    await page.focus('[data-tools-toggle]');
    await page.keyboard.press('Enter');
    expect(await expanded('data-tools-toggle')).toBe('true');
    const reached = [];
    for (let i = 0; i < tools.length; i += 1) {
      await page.keyboard.press('Tab');
      reached.push(await focused());
    }
    expect(reached).toEqual(tools);
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('Signs');
    expect(await expanded('data-tools-toggle')).toBe('false');
  });

  it('returns Shift+Tab from the first link to the button with the panel still open', async () => {
    await load();
    await page.focus('[data-signs-toggle]');
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('Aries');
    await page.keyboard.press('Shift+Tab');
    expect(await focused()).toBe('Signs');
    expect(await expanded('data-signs-toggle')).toBe('true');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('Taurus');
  });

  it('keeps the arrow keys and Escape as shortcuts inside the panel', async () => {
    await load();
    await page.focus('[data-signs-toggle]');
    await page.keyboard.press('ArrowDown');
    await page.waitForFunction(() => document.activeElement?.textContent === 'Aries');
    await page.keyboard.press('ArrowRight');
    expect(await focused()).toBe('Taurus');
    await page.keyboard.press('End');
    expect(await focused()).toBe('Cancer');
    await page.keyboard.press('Escape');
    expect(await focused()).toBe('Signs');
    expect(await expanded('data-signs-toggle')).toBe('false');
  });

  it('leaves Tab alone while the panel is closed', async () => {
    await load();
    await page.focus('[data-tools-toggle]');
    await page.keyboard.press('Tab');
    expect(await focused()).toBe('Signs');
  });
});

describe('site search shortcut', () => {
  it('has no single-character shortcut and names Ctrl/Cmd+K instead of a "/" hint', () => {
    expect(searchLoader).toBeTruthy();
    expect(searchLoader).not.toMatch(/key\s*===?\s*'\/'/u);
    expect(markup).not.toContain('nav__search-kbd');
    expect(markup).not.toMatch(/<kbd[^>]*>\/<\/kbd>/u);
    expect(markup).toMatch(/data-search-open[^>]*aria-keyshortcuts="Control\+K Meta\+K"/u);
  });

  it('does not open search on "/", and opens it on Ctrl+K and Cmd+K', async () => {
    await load();
    await page.focus('main a');
    await page.keyboard.press('/');
    await page.keyboard.press('Shift+Slash');
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.searchOpened ?? 0)).toBe(0);
    await page.keyboard.press('Control+k');
    await page.waitForFunction(() => window.searchOpened === 1);
    await page.keyboard.press('Meta+k');
    await page.waitForFunction(() => window.searchOpened === 2);
  });
});
