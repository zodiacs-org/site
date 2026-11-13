/**
 * The birth chart form's late shift, reproduced on demand. A proxy in front of
 * the preview server sends each page's HTML up to a cut point, pauses, then
 * sends the rest, so the browser paints the form parsed only that far. The
 * page then loads at 412 x 823 (mobile, as Lighthouse's mobile run) and every
 * layout shift is recorded with its source.
 *
 * Run after `npm run build`, from the repository root:
 *   node docs/platform/evidence/site-engine-1-1-0-rc1/tools/form-shift-split.mjs > out.json
 * The cuts are before each row the form ends with, and after the options panel.
 */
import http from 'node:http';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from '../../../../../tests/visual/browser.mjs';
import { withPreview } from '../../../../../tests/visual/preview-server.mjs';

const PATHS = ['/birth-chart/', '/ru/birth-chart/'];
const CUTS = [
  { name: 'before the submit button', at: (html) => html.indexOf('<button class="btn btn--primary calc__submit"') },
  { name: 'before the privacy line', at: (html) => html.indexOf('<p class="calc__privacy"') },
  { name: 'before the options panel', at: (html) => html.indexOf('<details class="calc__options"') },
  { name: 'after the options panel', at: (html) => {
    const open = html.indexOf('<details class="calc__options"');
    return open < 0 ? -1 : html.indexOf('</details>', open) + '</details>'.length;
  } },
];
const PAUSE_MS = 2000;

const executablePath = await findChromium();
const results = [];
await withPreview({ port: 4340 }, async (upstream) => {
  let cut = CUTS[0];
  const proxy = http.createServer(async (request, response) => {
    const answer = await fetch(upstream + request.url, { headers: { accept: request.headers.accept ?? '*/*' } });
    const body = Buffer.from(await answer.arrayBuffer());
    const type = answer.headers.get('content-type') ?? '';
    response.writeHead(answer.status, { 'content-type': type, 'cache-control': 'no-store' });
    if (!type.includes('text/html')) return response.end(body);
    const html = body.toString('utf8');
    const at = cut.at(html);
    if (at <= 0) return response.end(body);
    // A comment of 4 KB after the cut makes the browser parse and paint what it has.
    response.write(`${html.slice(0, at)}<!--${' '.repeat(4096)}-->`);
    setTimeout(() => response.end(html.slice(at)), PAUSE_MS);
  });
  await new Promise((resolve) => proxy.listen(4350, resolve));
  try {
    for (const path of PATHS) for (const candidate of CUTS) {
      cut = candidate;
      const browser = await chromium.launch({ executablePath, args: ['--headless=new', ...STABLE_CHROMIUM_ARGS] });
      const context = await browser.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__shifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__shifts.push({
            startTime: Math.round(entry.startTime),
            value: entry.value,
            sources: (entry.sources ?? []).map((source) => ({
              node: source.node ? `${source.node.nodeName.toLowerCase()}.${String(source.node.className).split(' ').join('.')}` : null,
              previousY: Math.round(source.previousRect.y),
              currentY: Math.round(source.currentRect.y),
            })),
          });
        }).observe({ type: 'layout-shift', buffered: true });
      });
      await page.goto(`http://127.0.0.1:4350${path}`, { waitUntil: 'load' });
      await page.waitForTimeout(PAUSE_MS + 400);
      const shifts = await page.evaluate(() => window.__shifts);
      results.push({ path, cut: candidate.name, cumulativeLayoutShift: Number(shifts.reduce((sum, shift) => sum + shift.value, 0).toFixed(6)), shifts });
      await browser.close();
    }
  } finally {
    proxy.close();
  }
});
console.log(JSON.stringify({ schema: 'zodiacs.form-shift-split.v1', viewport: '412x823 mobile', pauseMs: PAUSE_MS, results }, null, 2));
