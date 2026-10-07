/** Real footer CSS application and pre-load approach checks, invoked by Explorer. */
import { mkdir, writeFile } from 'node:fs/promises';
import { observeFooterStyles } from './locale-capture-readiness.mjs';

const TIMEOUT = 15_000;
const FOOTER_CSS = '/assets/site-footer.css';

async function withDeadline(promise, label) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} exceeded ${TIMEOUT}ms`)), TIMEOUT);
    })]);
  } finally { clearTimeout(timer); }
}

// With JavaScript disabled the unchanged noscript CSS @import supplies the
// same stylesheet without inserting a link. Observe that distinct browser path.
function observeNoscriptFooter() {
  const imported = [...document.styleSheets].some((sheet) => {
    if (sheet.disabled) return false;
    try {
      return [...sheet.cssRules].some((rule) => {
        if (!rule.href || !rule.styleSheet || rule.styleSheet.disabled) return false;
        const url = new URL(rule.href, location.href);
        return url.origin === location.origin && url.pathname === '/assets/site-footer.css';
      });
    } catch { return false; }
  });
  const directory = document.querySelector('.zfooter__directory');
  return imported && Boolean(directory && getComputedStyle(directory).display === 'grid');
}

async function footerState(page, allowNoscript = false) {
  const state = await page.evaluate(observeFooterStyles);
  // Cache-version changes must not look like a missing canonical stylesheet.
  const geometry = await page.evaluate(() => ({
    links: document.querySelectorAll('link[rel="stylesheet"][href^="/assets/site-footer.css?"]').length,
    columns: getComputedStyle(document.querySelector('.zfooter__directory')).gridTemplateColumns.split(' ').filter(Boolean).length,
  }));
  const noscriptSheetLoaded = allowNoscript && await page.evaluate(observeNoscriptFooter);
  return { ...state, ...geometry, noscriptSheetLoaded, ready: state.ready || noscriptSheetLoaded };
}

/** Scroll naturally, then await the actual applied CSS before capture. */
export async function awaitAppliedFooter(page, { scroll = true, allowNoscript = false } = {}) {
  if (scroll) await page.locator('.zfooter__directory').scrollIntoViewIfNeeded({ timeout: TIMEOUT });
  try {
    await page.waitForFunction(allowNoscript ? observeNoscriptFooter : observeFooterStyles, { readyOnly: true }, { timeout: TIMEOUT });
  } catch (error) {
    const state = await footerState(page, allowNoscript).catch(() => ({ unavailable: true }));
    throw new Error(`Footer CSS did not apply: ${JSON.stringify(state)}`, { cause: error });
  }
  await withDeadline(page.evaluate(() => document.fonts.ready.then(() => undefined)), 'Footer fonts');
  await withDeadline(page.locator('.zfooter').evaluate(async (footer) => {
    await Promise.all([...footer.querySelectorAll('img')].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight
        && box.right > 0 && box.left < innerWidth;
    }).map((image) => image.decode()));
  }), 'Visible footer images');
  return footerState(page, allowNoscript);
}

function observeRequestsAndErrors(context) {
  const errors = [];
  const css = [];
  context.on('page', (page) => {
    page.on('pageerror', (error) => errors.push({ kind: 'pageerror', text: error.message }));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push({ kind: 'console', text: message.text(), url: message.location().url });
    });
    page.on('requestfailed', (request) => errors.push({ kind: 'requestfailed', url: request.url(), error: request.failure()?.errorText }));
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === FOOTER_CSS) css.push({ url: request.url(), status: null });
    });
    page.on('response', (response) => {
      const request = css.find((entry) => entry.url === response.url() && entry.status === null);
      if (request) request.status = response.status();
    });
  });
  return { css, verify(check, label) {
    check(`Footer ${label}: no unexpected page, console or request failures`, errors.length === 0, JSON.stringify(errors));
  } };
}

async function recordTiming(context) {
  await context.addInitScript(() => {
    window.__footerWindowLoadAt = null;
    window.__footerLinkAt = null;
    const record = () => {
      if (window.__footerLinkAt === null && document.querySelector('link[rel="stylesheet"][href^="/assets/site-footer.css?"]')) {
        window.__footerLinkAt = performance.now();
      }
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true });
    window.addEventListener('load', () => { window.__footerWindowLoadAt = performance.now(); record(); }, { once: true });
  });
}

async function open(page, url, waitUntil = 'domcontentloaded') {
  const response = await page.goto(url, { waitUntil, timeout: TIMEOUT });
  if (response?.status() !== 200) throw new Error(`Footer fixture expected HTTP 200: ${url} (${response?.status()})`);
}

async function capture(page, check, outDir, label, width) {
  const directory = page.locator('.zfooter__directory');
  const state = await footerState(page, true);
  const fit = await directory.evaluate((node) => {
    const box = node.getBoundingClientRect();
    return document.documentElement.scrollWidth <= innerWidth + 1 && node.scrollWidth <= node.clientWidth + 1
      && box.left >= -1 && box.right <= innerWidth + 1
      && [...node.querySelectorAll('.zfooter__sign')].every((link) => link.getBoundingClientRect().height >= 43.5);
  });
  check(`Footer ${label}: actual columns and 44px sign actions fit ${width}px`, state.ready && state.columns === (width <= 760 ? 2 : 3) && fit, JSON.stringify(state));
  if (outDir) await directory.screenshot({ path: `${outDir}/${label}-${width}.png`, animations: 'disabled' });
  return state;
}

export async function runFooterStyleChecks({ browser, baseURL, check, outDir }) {
  if (outDir) await mkdir(outDir, { recursive: true });
  const records = [];
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const observations = observeRequestsAndErrors(context);
    await recordTiming(context);
    let release;
    let markHeld;
    const held = new Promise((resolve) => { release = resolve; });
    const intercepted = new Promise((resolve) => { markHeld = resolve; });
    const portraitUrls = [];
    let page;
    try {
      // This real eager image, unlike an Astro module, keeps load pending while
      // DOMContentLoaded and a natural scroll can still happen.
      await context.route((url) => url.origin === baseURL && /^\/assets\/people\/neil-armstrong(?:-192)?\.webp$/.test(url.pathname), async (route) => {
        portraitUrls.push(route.request().url());
        markHeld();
        await held;
        await route.continue();
      });
      page = await context.newPage();
      await open(page, `${baseURL}/people/neil-armstrong/`);
      await withDeadline(intercepted, 'Eager portrait interception');
      const initial = await page.evaluate(() => ({
        footerTop: document.querySelector('.zfooter').getBoundingClientRect().top,
        height: innerHeight, loadAt: window.__footerWindowLoadAt,
      }));
      check(`Footer approach ${width}: distant footer remains deferred while a real portrait holds load`,
        initial.footerTop > initial.height + 200 && initial.loadAt === null && observations.css.length === 0, JSON.stringify(initial));
      const applied = await awaitAppliedFooter(page);
      const beforeRelease = await page.evaluate(() => ({ loadAt: window.__footerWindowLoadAt, linkAt: window.__footerLinkAt }));
      check(`Footer approach ${width}: CSS applies before window load after scrolling near`,
        applied.ready && applied.links === 1 && observations.css.length === 1 && observations.css[0].status === 200
        && beforeRelease.loadAt === null && beforeRelease.linkAt !== null && portraitUrls.length > 0, JSON.stringify({ applied, beforeRelease, css: observations.css }));
      await capture(page, check, outDir, 'approach-before-load', width);
      release();
      await page.waitForLoadState('load', { timeout: TIMEOUT });
      // A frame pair allows normal event work without waiting an arbitrary
      // interval; the exact later250ms dedup race is covered by the real-IIFE unit.
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      check(`Footer approach ${width}: completing load retains one applied stylesheet`,
        await page.locator('link[rel="stylesheet"][href^="/assets/site-footer.css?"]').count() === 1 && observations.css.length === 1);
      records.push({ label: 'approach-before-load', width, initial, beforeRelease, applied, portraitUrls, css: observations.css });
    } finally {
      release();
      try {
        if (page) await page.waitForLoadState('load', { timeout: TIMEOUT });
      } finally {
        observations.verify(check, `approach ${width}`);
        await context.close();
      }
    }
  }

  for (const mode of ['initial-near', 'no-observer', 'no-script']) {
    const width = mode === 'initial-near' ? 1280 : 390;
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block', javaScriptEnabled: mode !== 'no-script' });
    const observations = observeRequestsAndErrors(context);
    if (mode !== 'no-script') await recordTiming(context);
    if (mode === 'no-observer') await context.addInitScript(() => { delete window.IntersectionObserver; });
    let page;
    try {
      page = await context.newPage();
      await open(page, `${baseURL}${mode === 'initial-near' ? '/es/learn/' : '/people/neil-armstrong/'}`, mode === 'no-observer' ? 'load' : 'domcontentloaded');
      const initial = await page.evaluate(() => ({
        near: document.querySelector('.zfooter').getBoundingClientRect().top <= innerHeight + 200,
        linkAt: window.__footerLinkAt ?? null, loadAt: window.__footerWindowLoadAt ?? null,
      }));
      const applied = await awaitAppliedFooter(page, { allowNoscript: mode === 'no-script' });
      const timing = await page.evaluate(() => ({ linkAt: window.__footerLinkAt ?? null, loadAt: window.__footerWindowLoadAt ?? null }));
      if (mode === 'initial-near') {
        check('Footer initial-near: short-page request does not wait for window load', initial.near && timing.linkAt !== null && (timing.loadAt === null || timing.linkAt <= timing.loadAt));
      } else if (mode === 'no-observer') {
        check('Footer no-observer: distant page retains the real post-load fallback', !initial.near && timing.loadAt !== null && timing.linkAt >= timing.loadAt && applied.links === 1);
      } else {
        check('Footer no-script: noscript import supplies real CSS without a dynamic link', applied.ready && applied.links === 0);
      }
      check(`Footer ${mode}: one successful canonical CSS response`, observations.css.length === 1 && observations.css[0].status === 200, JSON.stringify(observations.css));
      await capture(page, check, outDir, mode, width);
      records.push({ label: mode, width, initial, timing, applied, css: observations.css });
    } finally {
      try {
        if (page) await page.waitForLoadState('load', { timeout: TIMEOUT });
      } finally {
        observations.verify(check, mode);
        await context.close();
      }
    }
  }
  if (outDir) await writeFile(`${outDir}/footer-style-receipt.json`, JSON.stringify({ scope: 'Genuine applied footer CSS; eager portrait held until pre-load approach proof, no aborted requests.', records }, null, 2) + '\n');
}
