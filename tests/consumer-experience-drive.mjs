/**
 * Five consumer journeys plus a delayed-startup regression, using disposable
 * mobile browser contexts and public
 * demonstration data. This checks task completion, not human comprehension,
 * retention, physical phone keyboards, or Safari/Chrome application chrome.
 *
 * Build first. Run with ZODIACS_TEST_BASE_URL and optional OUT_DIR.
 * CONSUMER_TEST_ENGINES=chromium,webkit enables the installed WebKit runtime.
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { chromium, webkit } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';
import { runPersonalChartHandoff } from './personal-chart-handoff.mjs';

const engines = (process.env.CONSUMER_TEST_ENGINES ?? 'chromium').split(',');
const out = process.env.OUT_DIR;
if (out) await mkdir(out, { recursive: true });
const daily = JSON.parse(await readFile(new URL('../src/data/daily.json', import.meta.url)));
const results = [];
const checks = [];
const check = (name, ok, detail = '') => {
  checks.push({ name, ok, detail });
  assert.ok(ok, `${name}: ${detail}`);
};
const shot = async (page, name) => {
  if (out) await page.screenshot({ path: `${out}/${name}.png` });
};
const mobile = { viewport: { width: 390, height: 844 }, isMobile: true,
  hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' };

async function restore(context, origins) {
  await context.addInitScript(saved => {
    const own = saved.find(o => o.origin === location.origin);
    if (own && !sessionStorage.getItem('consumer-test-restored')) {
      for (const { name, value } of own.localStorage) localStorage.setItem(name, value);
      sessionStorage.setItem('consumer-test-restored', '1');
    }
  }, origins);
}

async function fits(page, name) {
  check(`${name}: no horizontal page overflow`, await page.evaluate(() =>
    document.documentElement.scrollWidth <= innerWidth + 1));
}

async function calculate(page, { unknown = false } = {}) {
  // The visible server form precedes the idle island; don't type into an
  // inert SSR form at machine speed before its handlers have mounted.
  await page.waitForFunction(() => {
    const island = document.querySelector('.calc__form')?.closest('astro-island');
    return island && !island.hasAttribute('ssr');
  });
  await page.getByLabel('Birth date', { exact: true }).fill('1907-07-06');
  if (unknown) await page.getByRole('checkbox', { name: "I don't know it", exact: true }).check();
  else await page.getByLabel('Birth time', { exact: true }).fill('08:30');
  await page.getByLabel('Birthplace', { exact: true }).fill('Coyo');
  await page.locator('#place-opt-0').waitFor({ state: 'visible' });
  await page.locator('#place-opt-0').click();
  await page.locator('.calc__submit').click();
  await page.locator('.calc__result').waitFor();
  await page.locator('[data-first-reading-start]').waitFor();
  await fits(page, unknown ? 'Unknown-time chart' : 'Known-time chart');
}

async function earlyTyping(page, baseURL, engine) {
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route('**/_astro/ChartCalculator.*.js', async route => {
    await ready;
    await route.continue();
  });
  await page.goto(`${baseURL}/birth-chart/`, { waitUntil: 'domcontentloaded' });
  check(`${engine}: startup test holds the calculator before hydration`, await page.locator('.calc__form').evaluate(form => form.closest('astro-island').hasAttribute('ssr')));
  await page.locator('#birth-date').fill('1990-01-01');
  await page.locator('#birth-time').fill('12:30');
  await page.getByRole('checkbox', { name: "I don't know it", exact: true }).check();
  await page.locator('#place').fill('Coyo');
  await page.locator('.calc__options summary').click();
  await page.locator('#house-system').selectOption('placidus');
  release();
  await page.waitForFunction(() => !document.querySelector('.calc__form')?.closest('astro-island')?.hasAttribute('ssr'));
  check(`${engine}: startup retains an early birth date`, await page.locator('#birth-date').inputValue() === '1990-01-01');
  check(`${engine}: startup retains an early birth time`, await page.locator('#birth-time').inputValue() === '12:30');
  check(`${engine}: startup retains an early unknown-time choice`, await page.getByRole('checkbox', { name: "I don't know it", exact: true }).isChecked());
  check(`${engine}: startup retains an early city query`, await page.locator('#place').inputValue() === 'Coyo');
  check(`${engine}: startup retains the chosen house system`, await page.locator('#house-system').inputValue() === 'placidus');
  await page.locator('#place-opt-0').waitFor({ state: 'visible' });
  await shot(page, `${engine}-early-typing`);
}

async function guide(page, engine) {
  const launcher = page.locator('[data-guide-launcher]');
  await launcher.waitFor({ state: 'visible' });
  await launcher.tap();
  const panel = page.locator('.zassistant__panel');
  await panel.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const p = document.querySelector('.zassistant__panel');
    return p && getComputedStyle(p).transform === 'none';
  });
  const box = await panel.boundingBox();
  check(`${engine}: Guide remains compact and inset`, box.x >= 8 && box.width <= 374
    && box.y > 200 && box.height >= 844 * .5 && box.height <= 844 * .7, JSON.stringify(box));
  check(`${engine}: touch opening does not focus the composer`, await panel.evaluate(p =>
    document.activeElement === p && !document.activeElement.matches('input,textarea')));
  await shot(page, `${engine}-compact-guide`);
  await page.locator('.zassistant__input').fill('What is my rising sign?');
  // Approximate the space a soft keyboard leaves; this is not an OS keyboard.
  await page.setViewportSize({ width: 390, height: 480 });
  await page.waitForFunction(() => {
    const root = document.querySelector('.zassistant');
    return root && Math.abs(root.getBoundingClientRect().height - 480) < 2;
  });
  const hide = page.getByRole('button', { name: 'Close Guide', exact: true });
  const hideBox = await hide.boundingBox();
  check(`${engine}: Guide Hide stays reachable in a shorter viewport`, hideBox.y >= 0 && hideBox.y + hideBox.height <= 480, JSON.stringify(hideBox));
  await fits(page, 'Guide with reduced viewport height');
  await shot(page, `${engine}-guide-short-viewport`);
  await hide.tap();
  await page.locator('.zassistant').waitFor({ state: 'hidden' });
  check(`${engine}: Guide dismissal restores launcher focus`, await launcher.evaluate(l => document.activeElement === l));
  await page.setViewportSize({ width: 390, height: 844 });
  await launcher.tap();
  await panel.waitFor({ state: 'visible' });
  check(`${engine}: unsent question survives hiding Guide`, await page.locator('.zassistant__input').inputValue() === 'What is my rising sign?');
  await page.getByRole('button', { name: 'Close Guide', exact: true }).tap();
}

try { await withPreview({ port: 8784 }, async baseURL => {
  for (const engine of engines) {
    assert.ok(['chromium', 'webkit'].includes(engine), `Unsupported engine ${engine}`);
    const browser = engine === 'webkit' ? await webkit.launch({ headless: true })
      : await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
    const journey = async (name, task) => {
      const context = await browser.newContext(mobile);
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        await task(page, context);
        check(`${engine}/${name}: no browser exceptions`, errors.length === 0, errors.join('; '));
        results.push({ engine, browserVersion: browser.version(), journey: name, passed: true });
        console.log(`PASS ${engine}: ${name}`);
      } catch (error) {
        results.push({ engine, journey: name, passed: false, error: error.message });
        await shot(page, `${engine}-${name}-failure`);
        throw error;
      } finally { await context.close(); }
    };
    try {
      await journey('startup-input', page => earlyTyping(page, baseURL, engine));
      await journey('quick-horoscope', async page => {
        await page.goto(baseURL);
        await page.getByRole('link', { name: 'Your horoscope', exact: true }).click();
        await page.locator('main a[href="/horoscopes/cancer/"]').first().click();
        await page.getByRole('heading', { level: 1 }).waitFor();
        check(`${engine}: sign reading requires no chart`, /Cancer/.test(await page.locator('h1').textContent()));
        await fits(page, 'Sign reading');
        await shot(page, `${engine}-daily-horoscope`);
        await page.goBack();
        check(`${engine}: Back returns to sign chooser`, new URL(page.url()).pathname === '/horoscopes/');
        await guide(page, engine);
      });

      let savedState;
      await journey('known-time-first-chart', async (page, context) => {
        await page.goto(baseURL);
        await page.getByRole('link', { name: 'Get your free birth chart ↗', exact: true }).click();
        await calculate(page);
        await page.locator('[data-first-reading-start]').click();
        for (let step = 1; step <= 4; step++) {
          await page.waitForFunction(n => document.querySelector('[data-tour-kicker]')?.textContent?.includes(`${n} of 4`), step);
          await fits(page, `Reading step ${step}`);
          if (step === 4) await shot(page, `${engine}-reading-save-handoff`);
          await page.locator('[data-tour-next]').click();
        }
        await page.locator('[data-your-page-ready]').waitFor();
        check(`${engine}: save confirmation explains device storage`, (await page.locator('[data-your-page-ready]').textContent()).includes('on this device'));
        await page.locator('[data-primary-action="today"]').click();
        await page.locator('.today-reading--resolved').waitFor();
        await fits(page, 'Personal Today');
        savedState = await context.storageState();
        await shot(page, `${engine}-personal-today`);
      });

      await journey('unknown-time-chart', async page => {
        await page.goto(`${baseURL}/birth-chart/`);
        await calculate(page, { unknown: true });
        const result = await page.locator('.calc__result').textContent();
        check(`${engine}: unknown time omits houses and rising`, /no houses|houses.*(?:omitted|hidden|unknown)|without.*houses/i.test(result), result.slice(0, 600));
        await page.locator('[data-first-reading-dismiss]').click();
        await page.locator('[data-save-chart]').click();
        await page.locator('[data-your-page-ready]').waitFor();
        await page.locator('[data-primary-action="today"]').click();
        await page.locator('.today-reading--resolved').waitFor();
        await fits(page, 'Unknown-time Today');
        await shot(page, `${engine}-unknown-time-today`);
      });

      await journey('returning-next-day', async (page, context) => {
        // Restore persisted storage into a new context after the first closes.
        await restore(context, savedState.origins);
        await page.clock.install({ time: new Date(`${daily.date}T12:00:00Z`) });
        await page.goto(baseURL);
        const card = page.locator('.wb-card');
        await card.waitFor({ state: 'visible' });
        await card.locator('a[href="/today/"]').click();
        await page.locator('.today-reading--resolved').waitFor();
        const identity = await page.locator('.today-reading__chart-name').textContent();
        await page.goBack();
        await card.waitFor({ state: 'visible' });
        await page.clock.setSystemTime(new Date(`${daily.date}T12:00:00Z`).getTime() + 86400_000);
        await page.reload();
        await card.waitFor({ state: 'visible' });
        await card.locator('a[href="/today/"]').click();
        await page.locator('.today-reading--resolved').waitFor();
        check(`${engine}: next-day visit preserves personal identity`, await page.locator('.today-reading__chart-name').textContent() === identity);
        check(`${engine}: unchanged static edition retains its actual date`, await page.locator(`[data-daily-date="${daily.date}"]`).count() === 1);
        await fits(page, 'Returning Today');
        await shot(page, `${engine}-returning-next-day`);
      });

      await journey('friend-chart-identity', async (page, context) => {
        await restore(context, savedState.origins);
        await page.goto(`${baseURL}/profile/`);
        await page.locator('#saved-charts a').filter({ hasText: "Add someone's chart" }).click();
        check(`${engine}: saved-chart Add someone reaches the correct flow`, new URL(page.url()).pathname === '/birth-chart/someone-else/');
        await page.waitForFunction(() => !document.querySelector('#other-chart-name')?.closest('astro-island')?.hasAttribute('ssr'));
        await page.locator('#other-chart-name').fill('Simulated friend');
        await page.locator('#other-birth-date').fill('1990-01-01');
        await page.locator('#other-birth-time').fill('08:30');
        await page.locator('#other-birth-place').fill('Coyo');
        await page.locator('#other-birth-place-opt-0').waitFor({ state: 'visible' });
        await page.locator('#other-birth-place-opt-0').click();
        await page.locator('.other-chart__permission input').check();
        await page.locator('[data-entry-mode="details"] button[type="submit"]').click();
        await page.locator('.calc__result').waitFor();
        // Returning visitors already completed the beginner tour.
        if (await page.locator('[data-first-reading-dismiss]').isVisible()) {
          await page.locator('[data-first-reading-dismiss]').click();
        }
        await page.locator('[data-save-chart]').click();
        await page.locator('[data-save-prompt]').waitFor();
        await page.locator('#chart-save-name').fill('Simulated friend');
        await page.locator('[data-save-prompt] button[type="submit"]').click();
        await page.locator('[data-primary-action="saved_charts"]').waitFor();
        await page.goto(baseURL);
        await page.locator('.wb-card').waitFor({ state: 'visible' });
        check(`${engine}: saving a friend does not replace the owner`, !(await page.locator('.wb-card h2').textContent()).includes('Simulated friend'));
        await shot(page, `${engine}-saved-friend-home`);
        // Mixed-chart fixtures make the friend's edit newer to isolate
        // identity precedence independently of the calculator save flow.
        await runPersonalChartHandoff({ browser, baseURL,
          check: (name, ok, detail) => check(`${engine}: ${name}`, ok, detail), outDir: out ? `${out}/${engine}-friend` : undefined });
      });
    } finally { await browser.close(); }
  }
}); } finally {
if (out) await writeFile(`${out}/results.json`, JSON.stringify({
  kind: 'simulated-consumer-journeys', viewport: mobile.viewport,
  capturedAt: new Date().toISOString(),
  limitations: ['No human participants', 'No physical phone keyboard or browser chrome', 'No retention measurement', 'Static next-day edition is deliberately unchanged', 'No Guide response-quality evaluation'],
  results, checks,
}, null, 2) + '\n');
}
console.log(`${results.length} journeys and ${checks.length} checks passed.`);
