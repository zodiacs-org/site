import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../tests/visual/browser.mjs';
import { withPreview } from '../tests/visual/preview-server.mjs';

const guides = JSON.parse(await readFile('src/data/developer-guides.json', 'utf8'));
const routes = [{ slug: 'index', title: 'Developer guides', path: '/developers/docs/' },
  ...guides.map((guide) => ({ slug: guide.slug, title: guide.title, path: '/developers/docs/' + guide.slug + '/' }))];
const checked = [];
const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
try {
  await withPreview({ port: 4381 }, async (baseURL) => {
    for (const width of [360, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US', timezoneId: 'UTC' });
      try {
        for (const route of routes) {
          const page = await context.newPage();
          try {
            const pageErrors = [];
            const calculationRequests = [];
            page.on('pageerror', (error) => pageErrors.push(error.message));
            page.on('request', (request) => {
              const path = new URL(request.url()).pathname;
              if (path.startsWith('/api/v1/') || /\/_astro\/full\.[^/]+\.js$/.test(path)
                || /\/api\/.*(?:moon|chart|calculate)/i.test(path)) calculationRequests.push(path);
            });
            const response = await page.goto(baseURL + route.path, { waitUntil: 'load', timeout: 30000 });
            assert.equal(response.status(), 200, route.path);
            assert.equal(await page.locator('h1').textContent(), route.title);
            assert.equal(await page.locator('article[data-developer-guide]').getAttribute('data-developer-guide'), route.slug);
            const markdownPath = route.slug === 'index' ? '/developers/docs/index.md' : '/developers/docs/' + route.slug + '.md';
            assert.equal(await page.getByRole('link', { name: 'Read this page as Markdown', exact: true }).getAttribute('href'), markdownPath);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'Page overflow: ' + route.path);
            assert.deepEqual(pageErrors, [], 'Browser errors: ' + route.path);
            assert.deepEqual(calculationRequests, [], 'Documentation must not invoke calculations: ' + route.path);
            checked.push({ path: route.path, width, status: 'pass', calculationRequests: 0, pageErrors: 0 });
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }
  });
  assert.equal(checked.length, 38);
  console.log(JSON.stringify({ schema: 'zodiacs.developer-guide-browser.v1', browser: await browser.version(), checked }, null, 2));
} finally {
  await browser.close();
}
