/** Responsive navigation: real layout, focus, touch targets and receiver boundaries. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, webkit } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const out = resolve(process.env.OUT_DIR ?? 'tests/visual/artifacts/navigation-responsive');
await mkdir(out, { recursive: true });
const observations = [];
const chart = '#c=1.' + Buffer.from(JSON.stringify({ d: '1990-02-01', t: '12:00', z: 'Etc/UTC', la: 0, lo: 0 })).toString('base64url');
const locales = ['', '/es', '/pt', '/fr', '/it', '/ru'];
const cases = locales.flatMap((prefix) => {
  const desktop = prefix ? 1040 : 920;
  return [320, 390, 612, desktop - 1, desktop, 1440].map(width => ({ path: prefix === '/ru' ? '/ru/aries/' : `${prefix}/learn/`, width, desktop, receiver: false, wing: false }));
});
for (const prefix of ['', '/es', '/ru']) for (const width of [390, 612, 768]) {
  cases.push({ path: `${prefix}/birth-chart/${chart}`, width, desktop: prefix ? 1040 : 920, receiver: true, wing: false });
}
for (const width of [390, 920]) cases.push({ path: '/birth-chart/', width, desktop: 920, receiver: false, wing: false });
for (const path of ['/astrofolio/', '/registry/virgo/', '/sdk/', '/thesis/']) for (const width of [390, 612, 919, 920, 1440]) {
  cases.push({ path, width, desktop: 920, receiver: false, wing: true });
}

for (const path of ['/profile/', '/today/', '/bio/', '/fomo/']) for (const width of [390, 920, 1440]) cases.push({ path, width, desktop: 920, receiver: false, wing: false });

await withPreview({ port: 8794 }, async (baseURL) => {
  for (const [name, driver, options] of [
    ['chromium', chromium, { executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS }],
    ['webkit', webkit, {}],
  ]) {
    const browser = await driver.launch({ headless: true, ...options });
    try {
      for (const test of cases) {
        const page = await browser.newPage({ viewport: { width: test.width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
        try {
          const errors = []; page.on('pageerror', error => errors.push(error.message));
          assert.equal((await page.goto(baseURL + test.path, { waitUntil: 'networkidle' })).status(), 200);
          const nav = page.locator(test.wing ? '[data-wnav]' : '[data-nav]');
          await nav.waitFor();
          await page.evaluate(() => document.fonts.ready);
          // Chart receivers intentionally finish at their result, with the bar visible.
          if (test.receiver) await page.locator('.calc__result').waitFor({ state: 'visible' });
          const geometry = await nav.evaluate(node => {
            const box = node.getBoundingClientRect(), style = getComputedStyle(node);
            const controls = [...node.children].filter(child => getComputedStyle(child).display !== 'none').map(child => {
              const r = child.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return { className: child.className, left: r.left, right: r.right, width: r.width, height: r.height, hit: hit === child || child.contains(hit) };
            });
            return { left: box.left, right: box.right, width: box.width, top: box.top, radius: style.borderRadius,
              controls, viewportWidth: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1,
              away: node.parentElement.classList.contains('is-away') };
          });
          const compact = test.width < test.desktop;
          assert.equal(await nav.locator('a[href="/astrofolio/"]').count(), 1);
          if (!compact) assert.equal(geometry.width, test.desktop === 920 ? 884 : 992);
          if (!compact && test.desktop === 920) {
            // Cross-page geometry: older wing pages must use the same tracks,
            // not merely fit inside a similarly sized pill.
            for (const [suffix, offset] of [['__mark', 21], ['__links', 155], ['__profile-shortcut', 611], ['__search', 673], ['__chip', 753]]) {
              const control = geometry.controls.find(item => item.className.includes(suffix));
              assert(control && Math.abs(control.left - geometry.left - offset) < 0.5, `${test.path}: ${suffix} position differs`);
            }
          }
          assert.equal(geometry.overflow, false, `${test.path}@${test.width}: overflow`);
          if (compact) {
            // Classic WebKit scrollbars reserve layout width; the bar must fill
            // the content viewport, not paint over the scrollbar.
            assert.equal(geometry.width, geometry.viewportWidth);
            assert.equal(geometry.left, 0); assert.equal(geometry.top, 0);
            assert.equal(geometry.radius, '0px');
            assert.equal(geometry.away, false);
            for (const control of geometry.controls) {
              assert(control.left >= 0 && control.right <= test.width + 0.5, JSON.stringify(control));
              assert(control.height >= 44 && control.hit, JSON.stringify(control));
            }
            if (test.receiver) {
              assert.equal(await nav.locator('a[href="/astrofolio/"]').count(), 1);
              assert.equal(await page.locator('main a[href="/astrofolio/"],main a[href^="/registry/"]').count(), 0);
            }
            if (test.width === 612 && !test.receiver) {
              const burger = page.locator(test.wing ? '[data-wnav-burger]' : '[data-menu-toggle]');
              await burger.click(); assert.equal(await burger.getAttribute('aria-expanded'), 'true');
              const menuSelector = test.wing ? '[data-wnav-mobile]' : '[data-mobile-menu]';
              await page.waitForFunction(selector => document.querySelector(selector)?.contains(document.activeElement), menuSelector);
              const menu = page.locator(menuSelector);
              const links = menu.locator('a[href],button:not([disabled])');
              await page.keyboard.press('Shift+Tab');
              assert(await links.last().evaluate(node => document.activeElement === node));
              await page.keyboard.press('Tab');
              assert(await links.first().evaluate(node => document.activeElement === node));
              await page.keyboard.press('Escape'); assert.equal(await burger.getAttribute('aria-expanded'), 'false');
              assert(await burger.evaluate(node => document.activeElement === node));
              // A keyboard-focused header deliberately stays available.
              // Return to pointer browsing before checking scroll-away motion.
              await page.mouse.click(10, 200);
              assert(await nav.evaluate(node => !node.parentElement.contains(document.activeElement)));
              await page.evaluate(() => scrollTo(0, 600));
              await page.waitForFunction(selector => document.querySelector(selector).parentElement.classList.contains('is-away'), test.wing ? '[data-wnav]' : '[data-nav]');
              await page.evaluate(() => scrollTo(0, 0));
              await page.waitForFunction(selector => !document.querySelector(selector).parentElement.classList.contains('is-away'), test.wing ? '[data-wnav]' : '[data-nav]');
            }
          } else {
            assert.notEqual(geometry.radius, '0px'); assert(geometry.left > 0 && geometry.right < test.width);
            const links = page.locator(test.wing ? '.wnav__links' : '.nav__links');
            assert(await links.isVisible(), 'Desktop links must retain their existing full row');
          }
          const collection = nav.locator(test.wing ? '.wnav__chip' : '.nav__chip');
          if (!compact && await collection.isVisible()) {
            const collectionBox = await collection.boundingBox();
            for (const control of geometry.controls.filter(control => !control.className.includes('__chip'))) {
              assert(control.right <= collectionBox.x + 0.5, 'Astrofolio is alone to the right of every other control and its divider');
            }
          }
          {
            const profile = nav.locator(test.wing ? '.wnav__profile-shortcut' : '.nav__profile-shortcut');
            assert.equal(await profile.count(), 1, 'One profile control serves every layout');
            const profileBox = await profile.boundingBox();
            assert(profileBox && profileBox.width >= 44 && profileBox.height >= 44);
            const chip = nav.locator(test.wing ? '.wnav__chip' : '.nav__chip');
            if (await chip.isVisible()) {
              const chipBox = await chip.boundingBox();
              assert(compact ? chipBox.x + chipBox.width <= profileBox.x + 0.5 : profileBox.x + profileBox.width <= chipBox.x + 0.5, 'Mobile keeps its existing order; desktop puts Astrofolio last');
              if (!compact) {
                // macOS WebKit uses Option-Tab to include links in keyboard navigation.
                const beforeChip = await nav.locator(test.wing ? '.wnav__search' : '.nav__search').isVisible() ? nav.locator(test.wing ? '.wnav__search' : '.nav__search') : profile;
                const beforeBox = await beforeChip.boundingBox();
                assert(beforeBox.x + beforeBox.width <= chipBox.x + 0.5, 'Search precedes the Astrofolio divider');
                await beforeChip.focus(); await page.keyboard.press(name === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab');
                assert(await chip.evaluate(node => document.activeElement === node), 'Keyboard order matches the displayed order');
              }
            }
            const search = nav.locator(test.wing ? '.wnav__search' : '.nav__search');
            if (await search.isVisible()) {
              const searchBox = await search.boundingBox();
              assert(profileBox.x + profileBox.width <= searchBox.x + 0.5, 'Profile precedes search');
              assert(Math.abs((profileBox.y + profileBox.height / 2) - (searchBox.y + searchBox.height / 2)) < 1, 'Profile and search share a baseline');
            }
          }
          assert.deepEqual(errors, []);
          const id = `${name}-${test.path.split('#')[0].replaceAll('/', '_')}-${test.width}`;
          if ([390, 612, 1440].includes(test.width) && (test.path === '/learn/' || test.path === '/astrofolio/')) {
            await page.screenshot({ path: `${out}/${id}.png` });
          }
          observations.push({ browser: name, ...test, geometry });
          console.log(`PASS ${name} ${test.path.split('#')[0]} ${test.width}: ${compact ? 'full-width bar' : 'desktop row'}`);
        } finally { await page.close(); }
      }
    } finally { await browser.close(); }
  }
});
await writeFile(`${out}/observations.json`, JSON.stringify(observations, null, 2) + '\n');
console.log(`${observations.length} responsive navigation cases passed`);
