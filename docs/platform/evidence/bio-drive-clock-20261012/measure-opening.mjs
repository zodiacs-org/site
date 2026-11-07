// Measures /bio/'s heading and primary CTA on the bio drive's five viewports:
// on the edition's day, and in the dated window for several date labels. Run
// from the repository root after `npm run build`:
//
//   node docs/platform/evidence/bio-drive-clock-20261012/measure-opening.mjs
//
// FONT='"EB Garamond Fallback Times"' sets the heading in that face instead of
// the page's own stack. LABELS='May 1, 2026|September 30, 2026' replaces the
// dated label list. Each label is written into the served HTML in place of
// the edition's own, in EditionText's text and its data-edition-dated value.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../../../../tests/visual/browser.mjs';
import { withPreview } from '../../../../tests/visual/preview-server.mjs';

const publication = JSON.parse(await readFile(new URL('../../../../src/data/daily-publication.json', import.meta.url), 'utf8'));
const label = new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${publication.date}T00:00:00Z`));
const clocks = {
  current: Date.parse(`${publication.date}T12:00:00Z`),
  dated: Date.parse(`${publication.date}T00:17:00Z`) + 24 * 60 * 60 * 1000,
};
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'annotation', width: 412, height: 915 },
  { name: 'narrow', width: 320, height: 780 },
];
const labels = (process.env.LABELS
  ?? `${label}|May 1, 2026|February 28, 2026|November 30, 2026|December 31, 2026|September 28, 2026|September 30, 2026`)
  .split('|');
const font = process.env.FONT ?? null;

await withPreview({ port: 4471 }, async (base) => {
  const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS });
  console.log(`chromium ${browser.version()} · edition ${publication.date} · heading font ${font ?? 'page stack'}`);
  try {
    for (const [state, at] of Object.entries(clocks)) {
      for (const variant of state === 'current' ? [label] : labels) {
        for (const viewport of viewports) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            hasTouch: viewport.width <= 600,
          });
          await context.addInitScript(({ instant, face }) => {
            const NativeDate = Date;
            function FixedDate(...args) {
              if (!new.target) return new NativeDate(instant).toString();
              return Reflect.construct(NativeDate, args.length ? args : [instant], new.target);
            }
            Object.setPrototypeOf(FixedDate, NativeDate);
            FixedDate.prototype = NativeDate.prototype;
            FixedDate.now = () => instant;
            globalThis.Date = FixedDate;
            if (face) {
              document.addEventListener('DOMContentLoaded', () => {
                const style = document.createElement('style');
                style.textContent = `#bio-title, #bio-title * { font-family: ${face} !important; }`;
                document.head.append(style);
              });
            }
          }, { instant: at, face: font });
          if (variant !== label) {
            await context.route('**/bio/', async (route) => {
              const response = await route.fetch();
              const html = (await response.text()).replaceAll(`the ${label} edition’s`, `the ${variant} edition’s`);
              await route.fulfill({ response, body: html });
            });
          }
          const page = await context.newPage();
          await page.goto(`${base}/bio/`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const measured = await page.evaluate(() => {
            const heading = document.querySelector('#bio-title');
            const box = heading.getBoundingClientRect();
            const primary = document.querySelector('.bio-link').getBoundingClientRect();
            return {
              editionState: document.documentElement.getAttribute('data-edition-state'),
              heading: heading.textContent,
              lines: Math.round(box.height / parseFloat(getComputedStyle(heading).lineHeight)),
              primaryTop: Math.round(primary.top),
              primaryBottom: Math.round(primary.bottom),
              viewportHeight: innerHeight,
            };
          });
          const cdp = await context.newCDPSession(page);
          await cdp.send('DOM.enable');
          await cdp.send('CSS.enable');
          const { root } = await cdp.send('DOM.getDocument');
          const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#bio-title [data-edition-text]' });
          const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
          console.log([
            state.padEnd(7),
            measured.editionState.padEnd(7),
            variant.padEnd(18),
            viewport.name.padEnd(10),
            `${measured.lines} lines`,
            `CTA ${measured.primaryTop}–${measured.primaryBottom}px of ${measured.viewportHeight}`,
            fonts.map((entry) => entry.familyName).join(', ').padEnd(16),
            measured.heading,
          ].join('  '));
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
});
