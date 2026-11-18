#!/usr/bin/env node
/**
 * Evidence for a tool page: serves dist/, opens the page at 390 and 1280 px, fills the form, shows the result,
 * makes the share card, and records every layout-shift entry across all of it, with the phase it happened in. Saves screenshots of the form, the result and the card itself
 * under docs/acceptance/<name>/, and fails on any shift without input (CLS), any shift while the card is made, a
 * console error, horizontal scroll, or a page address that carries the details typed in.
 *
 *   node tests/feature-page-evidence-drive.mjs numerology
 *   node tests/feature-page-evidence-drive.mjs tarot
 */
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dist = join(root, 'dist');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const PAGES = {
  numerology: {
    path: '/numerology/',
    // Details typed into the form; none may reach the address, the card or the share link.
    secrets: ['Philippa', 'Quennell', 'PHILIPPA', '1979-08-17', '1979', '08-17'],
    async fill(page) {
      await page.fill('#num-name', 'Philippa Quennell');
      await page.fill('#num-date', '1979-08-17');
      await page.click('button.calc__submit');
      await page.waitForSelector('.num__lead');
    },
  },
  tarot: {
    path: '/tarot/',
    secrets: [],
    async fill(page) {
      await page.click('button.calc__submit');
      await page.waitForSelector('.tarot__card');
    },
  },
};

const name = process.argv[2];
const spec = PAGES[name];
if (!spec) throw new Error(`Usage: feature-page-evidence-drive.mjs ${Object.keys(PAGES).join('|')}`);
const out = join(root, 'docs/acceptance', name);
await mkdir(out, { recursive: true });

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = join(dist, decodeURIComponent(url.pathname));
  if (file.endsWith('/')) file = join(file, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
const failures = [];
const report = {};
for (const [label, viewport] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, acceptDownloads: true });
  await context.addInitScript(() => {
    window.__shifts = [];
    window.__phase = 'load';
    const describe = (node) => (node && node.nodeType === 1 ? `${node.parentElement?.className ?? ''} > ${node.tagName.toLowerCase()}.${[...node.classList].join('.')}` : String(node?.nodeName));
    new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__shifts.push({ phase: window.__phase, value: entry.value, recent: entry.hadRecentInput, sources: entry.sources.map((source) => describe(source.node)) }); })
      .observe({ type: 'layout-shift', buffered: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(`${origin}${spec.path}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, `${label}-form.png`) });
  await page.evaluate(() => { window.__phase = 'result'; });
  await spec.fill(page);
  await page.waitForTimeout(600);
  const share = page.locator('.story-share');
  await share.scrollIntoViewIfNeeded();
  const size = async () => share.evaluate((node) => `${node.offsetWidth}x${node.offsetHeight}`);
  const before = await size();
  await page.evaluate(() => { window.__phase = 'card'; });
  await share.locator('button', { hasText: 'Make card' }).click();
  await share.locator('.story-share__preview img').waitFor();
  await page.waitForTimeout(400);
  const after = await size();
  // Read the shifts before any screenshot: capturing a tall element re-lays out the page.
  const shifts = await page.evaluate(() => window.__shifts);
  // Viewport screenshots, not one tall capture, so the sticky header is not stitched into the middle.
  await page.mouse.move(2, 2);
  await page.locator('.calc__result').evaluate((node) => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.evaluate(() => window.scrollBy({ top: -80, behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${label}-result.png`) });
  await share.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${label}-share.png`) });
  // The card image itself, as the person would share it.
  const cardImage = await share.locator('.story-share__preview img').evaluate(async (img) => {
    const blob = await (await fetch(img.src)).blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  });
  if (label === 'mobile') await writeFile(join(out, 'share-card.png'), Buffer.from(cardImage, "base64"));
  const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const address = page.url();
  report[label] = { shiftTotal: Number(total.toFixed(4)), shifts: shifts.length, scrollWidth, errors, shareBox: `${before} -> ${after}`, address, detail: shifts.filter((shift) => shift.value > 0.00001) };
  // CLS proper: any shift the person did not cause. Card making is held to zero as well, because the card can land
  // after the 500 ms an input excuses. Results appearing below the form on submit are input-driven and reported only.
  const unprompted = shifts.filter((shift) => !shift.recent).reduce((sum, shift) => sum + shift.value, 0);
  const card = shifts.filter((shift) => shift.phase === 'card').reduce((sum, shift) => sum + shift.value, 0);
  report[label].cls = Number(unprompted.toFixed(4));
  report[label].cardShift = Number(card.toFixed(4));
  if (unprompted > 0) failures.push(`${label}: layout shift without input ${unprompted}`);
  if (card > 0) failures.push(`${label}: layout shift while making the card ${card}`);
  if (before !== after) failures.push(`${label}: the share block changed size when the card was made`);
  if (scrollWidth > viewport.width) failures.push(`${label}: horizontal scroll (${scrollWidth}px)`);
  if (errors.length) failures.push(`${label}: console errors ${errors.join(' | ')}`);
  for (const secret of spec.secrets) if (address.includes(secret)) failures.push(`${label}: the address carries ${secret}`);
  await context.close();
}
await browser.close();
server.close();
console.log(JSON.stringify(report, null, 2));
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`${name}: no layout shift, no console errors, no horizontal scroll; screenshots in docs/acceptance/${name}/`);
