import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const routePath = '/ru/birth-chart/';

async function withPausedDocument(baseURL, html, callback) {
  const submits = [...html.matchAll(/<button\b[^>]*\bclass="[^"]*\bcalc__submit\b[^"]*"[^>]*>/gu)];
  if (submits.length !== 1) throw new Error('Parser layout fixture needs one calculator submit button');
  const boundary = submits[0].index;
  let release;
  const resumed = new Promise((resolve) => { release = resolve; });
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, baseURL);
      if (url.pathname === routePath) {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.flushHeaders();
        response.write(html.slice(0, boundary));
        await resumed;
        response.end(html.slice(boundary));
        return;
      }
      const upstream = await fetch(url, { redirect: 'manual' });
      const headers = {};
      for (const name of ['content-type', 'cache-control', 'location']) {
        if (upstream.headers.has(name)) headers[name] = upstream.headers.get(name);
      }
      response.writeHead(upstream.status, headers);
      response.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      response.destroy(error);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`, release);
  } finally {
    release();
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  }
}

/** Force the partial HTML paint that exposed the Russian form's reordered disclosure. */
export async function checkCalculatorParserLayout({ browser, baseURL }) {
  const upstream = await fetch(`${baseURL}${routePath}`);
  if (!upstream.ok) throw new Error(`Parser layout route returned ${upstream.status}`);
  const html = await upstream.text();
  return withPausedDocument(baseURL, html, async (streamURL, release) => {
    const viewport = { width: 412, height: 823 };
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));
    try {
      await page.addInitScript(() => {
        const result = { rawCLS: 0, shifts: [] };
        const record = (entries) => {
          for (const entry of entries) {
            // No interaction occurs until this observation ends. Keep every
            // raw shift, including one a browser labels hadRecentInput.
            result.rawCLS += entry.value;
            result.shifts.push({
              value: entry.value,
              sources: entry.sources.map(({ node, previousRect, currentRect }) => ({
                node: node instanceof Element ? `${node.localName}.${[...node.classList].join('.')}` : null,
                previous: [previousRect.x, previousRect.y, previousRect.width, previousRect.height],
                current: [currentRect.x, currentRect.y, currentRect.width, currentRect.height],
              })),
            });
          }
        };
        const observer = new PerformanceObserver((list) => record(list.getEntries()));
        observer.observe({ type: 'layout-shift', buffered: true });
        window.__finishCalculatorParserLayout = () => {
          record(observer.takeRecords());
          observer.disconnect();
          return result;
        };
      });
      await page.goto(`${streamURL}${routePath}`, { waitUntil: 'commit' });
      await page.locator('#place').waitFor({ state: 'attached' });
      await page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const partial = await page.evaluate(() => {
        const options = document.querySelector('.calc__options');
        const rect = options?.getBoundingClientRect();
        return {
          readyState: document.readyState,
          hasSubmit: Boolean(document.querySelector('.calc__submit')),
          hasPrivacy: Boolean(document.querySelector('.calc__privacy')),
          optionsVisible: Boolean(rect && rect.width > 0 && rect.height > 0
            && rect.top < innerHeight && rect.bottom > 0
            && getComputedStyle(options).visibility === 'visible'),
        };
      });
      release();
      await page.waitForLoadState('load');
      await page.locator('#bc-form astro-island:not([ssr])').waitFor({ state: 'attached', timeout: 15_000 });
      await page.waitForFunction(() => {
        const loaded = new Set(Array.from(document.styleSheets, (sheet) => sheet.href));
        return document.querySelectorAll('template[data-zdx-deferred-style]').length === 0
          && [...document.querySelectorAll('link[rel="stylesheet"]')]
            .filter((link) => new URL(link.href).pathname.startsWith('/_astro/'))
            .every((link) => loaded.has(link.href));
      });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const layout = await page.evaluate(() => window.__finishCalculatorParserLayout());
      const receipt = { viewport, partial, ...layout, browserErrors };
      if (partial.readyState !== 'loading' || partial.hasSubmit || partial.hasPrivacy) {
        throw new Error(`Calculator parser pause was not exercised: ${JSON.stringify(receipt)}`);
      }
      if (partial.optionsVisible || layout.rawCLS !== 0 || browserErrors.length > 0) {
        throw new Error(`Calculator partial-document layout changed: ${JSON.stringify(receipt)}`);
      }
      await page.locator('.calc__options summary').click();
      if (!await page.locator('.calc__options').evaluate((options) => options.open)
        || !await page.locator('#house-system').isVisible()) {
        throw new Error('Calculator house-system disclosure did not open after parsing');
      }
      await page.locator('#house-system').selectOption('placidus');
      if (await page.locator('#house-system').inputValue() !== 'placidus') {
        throw new Error('Calculator house-system choice did not remain interactive');
      }
      await page.locator('.calc__options summary').click();
      if (await page.locator('#house-system').isVisible()) {
        throw new Error('Calculator house-system disclosure did not close');
      }
      return receipt;
    } finally {
      release();
      await context.close();
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await withPreview({ port: 4420 }, async (baseURL) => {
    const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
    try {
      const receipt = await checkCalculatorParserLayout({ browser, baseURL });
      console.log(`calculator-parser-layout-drive: partial document and disclosure passed ${JSON.stringify(receipt)}`);
    } finally {
      await browser.close();
    }
  });
}
