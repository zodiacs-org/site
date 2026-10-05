import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const TIMEOUT = 45_000;

async function trackedPage(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    globalThis.__registryBridgeEvents = [];
    window.zodiacsAnalytics = {
      track(name, props) { globalThis.__registryBridgeEvents.push({ name, props }); },
    };
  });
  return { context, page: await context.newPage() };
}

async function events(page, name) {
  return page.evaluate((eventName) => (
    globalThis.__registryBridgeEvents.filter((event) => event.name === eventName)
  ), name);
}

async function openChart(page, baseURL) {
  const response = await page.goto(`${baseURL}/birth-chart/`, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200);
  await page.locator('.calc__form').waitFor({ state: 'visible', timeout: TIMEOUT });
  await page.waitForFunction(() => {
    const form = document.querySelector('.calc__form');
    const island = form?.closest('astro-island');
    return island ? !island.hasAttribute('ssr') : Boolean(form);
  }, null, { timeout: TIMEOUT });
}

async function selectBangkok(page) {
  await page.locator('#place').fill('Bangkok');
  const option = page.locator('#place-list [role="option"]:not([aria-disabled="true"])').first();
  await option.waitFor({ state: 'visible', timeout: TIMEOUT });
  await option.click();
  await page.locator('#place[readonly]').waitFor({ state: 'visible', timeout: TIMEOUT });
}

async function submitAndWait(page, computedCount) {
  await page.locator('.calc__form button[type="submit"]').click();
  await page.waitForFunction((count) => (
    globalThis.__registryBridgeEvents.filter((event) => event.name === 'chart_computed').length >= count
      && document.querySelector('.calc__form')?.getAttribute('aria-busy') === 'false'
  ), computedCount, { timeout: TIMEOUT });
}

const executablePath = await findChromium();
const browser = await chromium.launch({ executablePath, headless: true, args: STABLE_CHROMIUM_ARGS });

try {
  await withPreview({ port: Number(process.env.REGISTRY_BRIDGE_PORT ?? 4338) }, async (baseURL) => {
    const chartRun = await trackedPage(browser);
    const { page } = chartRun;
    await openChart(page, baseURL);
    await page.locator('#birth-date').fill('1990-01-04');
    await page.locator('.field__toggle input[type="checkbox"]').check();
    await selectBangkok(page);
    await submitAndWait(page, 1);

    const bridge = page.locator('[data-registry-bridge-surface="birth_chart"]');
    const receipt = page.locator('[data-check-our-math]');
    await receipt.waitFor({ state: 'visible', timeout: TIMEOUT });
    assert.equal(await bridge.count(), 0, 'chart tools must not promote the token collection');
    assert.equal(await receipt.getAttribute('data-instant-basis'), 'reference');
    assert.equal(await page.locator('[data-result-opening]').count(), 1);
    assert.deepEqual(await events(page, 'registry_bridge_impression'), []);

    await page.locator('#birth-date').fill('2026-03-20');
    await submitAndWait(page, 2);
    assert.equal(await bridge.count(), 0, 'unknown-time ingress date must not promote the collection');
    assert.equal(await receipt.getAttribute('data-instant-basis'), 'reference');

    await page.locator('.field__toggle input[type="checkbox"]').uncheck();
    await page.locator('#birth-time').fill('22:15');
    await submitAndWait(page, 3);
    assert.equal(await bridge.count(), 0, 'known-time results must not promote the collection either');
    assert.equal(await receipt.getAttribute('data-instant-basis'), 'birth');
    assert.equal(await receipt.locator('time').getAttribute('datetime'), '2026-03-20T15:15:00.000Z');
    assert.deepEqual(await events(page, 'registry_bridge_impression'), []);
    assert.deepEqual(await events(page, 'registry_bridge_click'), []);
    await chartRun.context.close();

    const birthdayRun = await trackedPage(browser);
    const stableResponse = await birthdayRun.page.goto(`${baseURL}/birthday/january-4/`, { waitUntil: 'domcontentloaded' });
    assert.equal(stableResponse?.status(), 200);
    const birthdayBridge = birthdayRun.page.locator('[data-registry-bridge-surface="birthday"]');
    assert.equal(await birthdayBridge.count(), 1);
    assert.equal(await birthdayBridge.getAttribute('data-registry-bridge-sign'), 'capricorn');
    assert.deepEqual(await events(birthdayRun.page, 'registry_bridge_impression'), [{
      name: 'registry_bridge_impression',
      props: { sign: 'capricorn', surface: 'birthday', locale: 'en' },
    }]);

    const cuspResponse = await birthdayRun.page.goto(`${baseURL}/birthday/march-20/`, { waitUntil: 'domcontentloaded' });
    assert.equal(cuspResponse?.status(), 200);
    assert.equal(await birthdayRun.page.locator('[data-registry-bridge-surface="birthday"]').count(), 0);
    assert.equal(await birthdayRun.page.locator('a[href="/birth-chart/"]').count() > 0, true);
    await birthdayRun.context.close();
  });
} finally {
  await browser.close();
}

console.log('registry-bridge-drive: tools omit collection links for known and unknown times; public birthday bridges remain intact');
