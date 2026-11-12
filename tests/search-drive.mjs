/**
 * End-to-end drive of the site search against `astro preview`: open with
 * the nav button and Ctrl/Cmd+K (a bare `/` does nothing, WCAG 2.1.4); type; arrow through results; Enter
 * navigates; Escape closes and restores focus; the mobile close control
 * supports touch and a two-control keyboard loop; ES pages have no search.
 *
 *   npm run build
 *   OUT_DIR=/tmp/shots node tests/search-drive.mjs
 */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const OUT = process.env.OUT_DIR ?? null;
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium';

const preview = spawn('npx', ['astro', 'preview', '--host', '127.0.0.1', '--port', '4399'], { stdio: 'ignore' });
await wait(2500);
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); };
const shot = async (t, p) => { if (OUT) await t.screenshot({ path: `${OUT}/${p}` }).catch(() => {}); };

try {
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:4399/learn/', { waitUntil: 'networkidle' });

  // Open with the nav button; dialog + index load lazily.
  await page.locator('[data-search-open]').click();
  await page.waitForSelector('.zsearch__input', { timeout: 10000 });
  check('nav button opens the dialog', await page.locator('.zsearch__panel').isVisible());
  check('input is focused on open', await page.evaluate(() => document.activeElement?.classList.contains('zsearch__input')));

  // Type → ranked results with kind badges.
  await page.locator('.zsearch__input').fill('saturn return');
  await page.waitForSelector('.zsearch__opt', { timeout: 5000 });
  const first = await page.locator('.zsearch__opt').first().textContent();
  check('query returns results, tool ranked first', /Saturn return/i.test(first ?? '') && /Tool/i.test(first ?? ''), first?.slice(0, 60) ?? '');
  check('glossary term appears with its badge', (await page.locator('.zsearch__kind', { hasText: 'Glossary' }).count()) >= 1);
  await shot(page, 'search-results.png');

  // Arrow down + Enter navigates to the second result.
  await page.keyboard.press('ArrowDown');
  const activeCount = await page.locator('.zsearch__opt.is-active').count();
  check('arrow moves the active option', activeCount === 1);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.pathname !== '/learn/', { timeout: 8000 });
  check('Enter navigates to the active result', page.url() !== 'http://127.0.0.1:4399/learn/', page.url());

  // A bare `/` is not a shortcut (WCAG 2.1.4 Character Key Shortcuts).
  await page.goto('http://127.0.0.1:4399/', { waitUntil: 'networkidle' });
  await page.keyboard.press('/');
  await wait(200);
  check('slash does not open the dialog', (await page.locator('.zsearch:not([hidden])').count()) === 0);

  // Cmd/Ctrl+K opens; Escape closes and restores focus to the opener context.
  await page.keyboard.press('Control+k');
  await page.waitForSelector('.zsearch__input', { timeout: 10000 });
  check('Ctrl+K opens the dialog on a fresh page', await page.locator('.zsearch__panel').isVisible());
  await page.keyboard.press('Escape');
  await wait(150);
  check('Escape closes the dialog', !(await page.locator('.zsearch').isVisible()));

  await page.keyboard.press('Control+k');
  await page.waitForSelector('.zsearch__input', { timeout: 5000 });
  check('Ctrl+K opens the dialog', await page.locator('.zsearch__panel').isVisible());
  // Sign result shows its pastel disc.
  await page.locator('.zsearch__input').fill('aries');
  await page.waitForSelector('.zsearch__opt', { timeout: 5000 });
  check('sign results carry the disc icon', (await page.locator('.zsearch__icon').count()) >= 1);
  await shot(page, 'search-sign.png');
  await page.keyboard.press('Escape');

  // At phone width the visible close control has a 44px target, closes by
  // touch/click, and loops focus with the input in both Tab directions.
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await mobileContext.newPage();
  await mobile.goto('http://127.0.0.1:4399/learn/', { waitUntil: 'networkidle' });
  await mobile.locator('[data-search-open]').click();
  const closeButton = mobile.getByRole('button', { name: 'Close search' });
  await closeButton.waitFor({ state: 'visible', timeout: 10000 });
  const closeBox = await closeButton.boundingBox();
  check('mobile close control has a 44px hit area', (closeBox?.width ?? 0) >= 44 && (closeBox?.height ?? 0) >= 44, JSON.stringify(closeBox));
  await closeButton.tap();
  check('mobile close control closes by tap', !(await mobile.locator('.zsearch').isVisible()));

  await mobile.locator('[data-search-open]').click();
  await mobile.locator('.zsearch__input').waitFor({ state: 'visible', timeout: 10000 });
  await mobile.keyboard.press('Tab');
  check('Tab moves from input to close', await closeButton.evaluate((el) => document.activeElement === el));
  const focusRing = await closeButton.evaluate((el) => {
    const style = getComputedStyle(el);
    return { style: style.outlineStyle, width: style.outlineWidth, color: style.outlineColor };
  });
  check('close control exposes a focus-visible ring', focusRing.style !== 'none' && Number.parseFloat(focusRing.width) > 0, JSON.stringify(focusRing));
  await shot(mobile, 'search-close-focus-375.png');
  await mobile.keyboard.press('Tab');
  check('Tab loops from close to input', await mobile.locator('.zsearch__input').evaluate((el) => document.activeElement === el));
  await mobile.keyboard.press('Shift+Tab');
  check('Shift+Tab loops from input to close', await closeButton.evaluate((el) => document.activeElement === el));
  await mobile.keyboard.press('Enter');
  check('mobile close control closes by keyboard', !(await mobile.locator('.zsearch').isVisible()));

  await mobile.locator('[data-search-open]').click();
  await mobile.locator('.zsearch').click({ position: { x: 5, y: 5 } });
  check('backdrop still closes the dialog', !(await mobile.locator('.zsearch').isVisible()));
  await mobileContext.close();

  // Typing `/` inside a real input must NOT open the dialog.
  await page.goto('http://127.0.0.1:4399/birth-chart/', { waitUntil: 'networkidle' });
  await page.locator('#bc-date').or(page.locator('input[type="date"]').first()).first().focus();
  await page.keyboard.press('/');
  await wait(200);
  check('slash inside a form field stays typing', (await page.locator('.zsearch:not([hidden])').count()) === 0);

  // ES pages: no search affordance at all.
  await page.goto('http://127.0.0.1:4399/es/transits/', { waitUntil: 'networkidle' });
  check('ES pages have no search button', (await page.locator('[data-search-open]').count()) === 0);
  await page.keyboard.press('/');
  await wait(200);
  check('slash on ES pages does nothing', (await page.locator('.zsearch').count()) === 0);

  await page.close();
  await browser.close();
} finally {
  preview.kill();
}

let failed = 0;
for (const r of results) {
  if (!r.ok) failed += 1;
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  · ${r.detail.slice(0, 80)}` : ''}`);
}
console.log(failed ? `\n${failed} FAILURES` : '\nALL PASS');
process.exit(failed ? 1 : 0);
