import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { withPreview } from './visual/preview-server.mjs';

const publication = JSON.parse(await readFile('src/data/daily-publication.json', 'utf8'));
const fixedNow = Date.parse(`${publication.date}T12:00:00Z`);

// Force the parser to yield after creating EditionText's span, then after
// appending its dated text but before DOMContentLoaded can clean it up. The
// original childList-only observer lets the parser coalesce that text with
// "Today", wrapping the heading and shifting the completed reading shell.
await withPreview({ port: 4389 }, async (baseURL) => {
  const server = createServer(async (req, res) => {
    try {
      const response = await fetch(new URL(req.url, baseURL));
      const bytes = Buffer.from(await response.arrayBuffer());
      res.statusCode = response.status;
      for (const [name, value] of response.headers) {
        if (!['content-encoding', 'content-length', 'transfer-encoding', 'etag'].includes(name)) {
          res.setHeader(name, value);
        }
      }
      if (req.url !== '/today/' || !response.ok) { res.end(bytes); return; }
      const html = bytes.toString();
      const hero = html.indexOf('class="today-hero"');
      const span = html.indexOf('data-edition-text', hero);
      const textStart = html.indexOf('>', span) + 1;
      const documentEnd = html.indexOf('</body>');
      assert.ok(hero >= 0 && span > hero && textStart > span && documentEnd > textStart);
      res.write(html.slice(0, textStart));
      await new Promise(resolve => setTimeout(resolve, 300));
      res.write(html.slice(textStart, documentEnd));
      await new Promise(resolve => setTimeout(resolve, 300));
      res.end(html.slice(documentEnd));
    } catch {
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  let browser;
  try {
    browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
    const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
    await page.addInitScript(({ at }) => {
      const NativeDate = Date;
      function FixedDate(...args) {
        if (!new.target) return new NativeDate(at).toString();
        return Reflect.construct(NativeDate, args.length ? args : [at], new.target);
      }
      Object.setPrototypeOf(FixedDate, NativeDate);
      FixedDate.prototype = NativeDate.prototype;
      FixedDate.now = () => at;
      globalThis.Date = FixedDate;
      localStorage.setItem('zodiacs:today-sun-sign:v1', 'leo');
      globalThis.__editionParserShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) globalThis.__editionParserShifts.push(entry.value);
        }
      }).observe({ type: 'layout-shift', buffered: true });
    }, { at: fixedNow });
    const response = await page.goto(`http://127.0.0.1:${server.address().port}/today/`, { waitUntil: 'networkidle' });
    assert.equal(response.status(), 200);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.today-hero h1').innerText(), 'Today');
    const cls = await page.evaluate(() => globalThis.__editionParserShifts.reduce((sum, value) => sum + value, 0));
    assert.equal(cls, 0, 'Streamed current-edition labels must have exactly zero CLS');
    console.log(JSON.stringify({ status: 'passed', browser: browser.version(), scenario: 'coalesced parser text before DOMContentLoaded', cls }));
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
