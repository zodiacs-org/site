// Loads a built page in fresh 1280x900 pages, as tests/i18n-r0-drive.mjs
// does, and records when the footer loader inserts the canonical footer
// stylesheet against DOMContentLoaded and window load, and whether a read
// right after DOMContentLoaded (the drive's read before F-98) finds it.
//
//   npm run build
//   node docs/platform/evidence/footer-first-report-20261019/tools/footer-timing-probe.mjs [path] [loads]
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../../../../../tests/visual/browser.mjs';
import { withPreview } from '../../../../../tests/visual/preview-server.mjs';

const [path = '/es/learn/', loadsArg = '40'] = process.argv.slice(2);
const loads = Number(loadsArg);
const footerLink = 'link[rel="stylesheet"][href^="/assets/site-footer.css?"]';
const rows = [];

await withPreview({ port: 4471 }, async (baseURL) => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  try {
    for (let index = 0; index < loads; index += 1) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.addInitScript((selector) => {
        const times = window.__footerTimes = { domContentLoaded: null, load: null, link: null };
        const record = () => {
          if (times.link === null && document.querySelector(selector)) times.link = performance.now();
        };
        new MutationObserver(record).observe(document, { childList: true, subtree: true });
        document.addEventListener('DOMContentLoaded', () => { times.domContentLoaded = performance.now(); }, { once: true });
        window.addEventListener('load', () => { record(); times.load = performance.now(); }, { once: true });
      }, footerLink);
      await page.goto(`${baseURL}${path}`, { waitUntil: 'domcontentloaded' });
      const early = await page.evaluate((selector) => Boolean(document.querySelector(selector)), footerLink);
      await page.waitForTimeout(600);
      rows.push({ early, ...(await page.evaluate(() => window.__footerTimes)) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

const ms = (value) => (value === null ? 'none' : value.toFixed(1));
for (const [index, row] of rows.entries()) {
  console.log(`${index + 1}\tDOMContentLoaded ${ms(row.domContentLoaded)}\tload ${ms(row.load)}\trequest ${ms(row.link)}\tread at DOMContentLoaded ${row.early ? 'finds it' : 'finds none'}`);
}
const count = (test) => rows.filter(test).length;
console.log(`${path}: ${loads} loads; the read at DOMContentLoaded finds the request in ${count((row) => row.early)}; `
  + `request before DOMContentLoaded ${count((row) => row.link !== null && row.link < row.domContentLoaded)}, `
  + `after window load ${count((row) => row.link !== null && row.load !== null && row.link > row.load)}, `
  + `none within 600 ms ${count((row) => row.link === null)}`);
