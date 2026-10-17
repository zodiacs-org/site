/**
 * The cards' links work end to end against this build: "Open printable
 * card" and "Open both charts" open the site pages from dist/ with the same
 * date, time, place and people the card shows, and "Share the reading"
 * opens the share page, whose preview image renders. A local server stands
 * in for zodiacs.org: dist/ for pages, the share handlers for /share/ and
 * /api/og/. Run after npm run build; manual, not part of CI.
 *
 *   npx vite-node --script tests/ai-cards-links.ts [-- --out <dir>]
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { findChromium, STABLE_CHROMIUM_ARGS } from './visual/browser.mjs';
import { OCCASIONS_HTML } from '../integrations/generated/occasions.mjs';
import { executeAiTool } from '../src/ai-tools/tools';
import type { AiToolName } from '../src/ai-tools/contracts';
import { handleCompatibilityImageRequest, handleCompatibilityLinkRequest, handleOccasionImageRequest, handleOccasionLinkRequest } from '../src/server/result-preview';

const argv = process.argv.slice(2);
const out = argv.includes('--out') ? resolve(argv[argv.indexOf('--out') + 1]) : undefined;
const dist = new URL('../dist/', import.meta.url);
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.avif': 'image/avif' };
const SHARE: Record<string, (request: Request) => Promise<Response>> = {
  '/share/compatibility/': handleCompatibilityLinkRequest, '/share/occasion/': handleOccasionLinkRequest,
  '/api/og/compatibility-image': handleCompatibilityImageRequest, '/api/og/occasion-image': handleOccasionImageRequest,
};
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://local');
  const share = SHARE[url.pathname];
  if (share) {
    const response = await share(new Request(`${origin}${req.url}`));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
    return;
  }
  let file = new URL(`.${decodeURIComponent(url.pathname)}`, dist);
  try { if ((await stat(file)).isDirectory()) file = new URL('index.html', `${file.href.replace(/\/?$/u, '/')}`); } catch { res.writeHead(404).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { 'content-type': TYPES[extname(file.pathname)] ?? 'application/octet-stream' }); res.end(body); } catch { res.writeHead(404).end(); }
});
let origin = '';
await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const local = (url: string) => url.replace('https://zodiacs.org', origin);

const NOW = new Date('2026-10-17T12:00:00Z');
const tool = async (name: AiToolName, args: Record<string, unknown>) => {
  const answer = await executeAiTool(name, args, { occasions: true, now: () => NOW });
  assert.equal(answer.ok, true);
  return answer as unknown as { data: any };
};
const wedding = await tool('get_occasion_sky', { occasion: 'wedding', date: '2027-06-12', time: '17:00', zone: 'Europe/Rome', latitude: 43.7696, longitude: 11.2558, place: 'Florence, Italy', names: 'Ana & Luis' });
const pair = await tool('get_compatibility', {
  a: { name: 'Ana', birthDate: '1990-05-03', time: '08:30', zone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 },
  b: { name: 'Luis', birthDate: '1992-08-10', time: '21:15', zone: 'America/Mexico_City', latitude: 19.4326, longitude: -99.1332 },
});
const milestones = await tool('get_life_milestones', { birthDate: '1997-03-15' });

if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: await findChromium(), args: STABLE_CHROMIUM_ARGS, headless: true });
const checked: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, timezoneId: 'Asia/Bangkok', colorScheme: 'dark' });
  // The links on the card are the links the tool returned, unchanged.
  const card = await context.newPage();
  await card.setContent(OCCASIONS_HTML);
  await card.evaluate((content) => { (window as any).openai = { toolOutput: content }; window.dispatchEvent(new CustomEvent('openai:set_globals', { detail: { globals: { toolOutput: content } } })); }, wedding);
  await card.locator('h1').waitFor();
  assert.equal(await card.getByRole('link', { name: 'Open printable card' }).getAttribute('href'), wedding.data.cardUrl);
  assert.equal(await card.getByRole('link', { name: 'Share the reading' }).getAttribute('href'), wedding.data.shareUrl);
  checked.push('the wedding card links to the cardUrl and shareUrl the tool returned');

  // Open printable card: the occasion page draws the same day from the link alone.
  const printable = await context.newPage();
  await printable.goto(local(wedding.data.cardUrl));
  await printable.locator('.occasion-card').waitFor({ timeout: 20_000 });
  const printed = await printable.locator('.occasion-card').innerText();
  assert.match(printed, /Ana & Luis/u);
  assert.match(printed, /The sky on your wedding day/u);
  assert.match(printed, /12 June 2027/u);
  assert.match(printed, /17:00/u);
  assert.match(printed, /Florence, Italy/u);
  assert.match(printed, /20:13/u, 'Golden hour on the place\'s clock, as on the card');
  if (out) await printable.screenshot({ path: resolve(out, 'printable-wedding-390.png'), fullPage: true });
  checked.push('Open printable card: /occasions/ shows Ana & Luis, 12 June 2027, 17:00, Florence, Italy and golden hour at 20:13');

  // Share the reading: the share page, its title and its preview image.
  const share = await context.newPage();
  await share.goto(local(wedding.data.shareUrl));
  await share.locator('img.card').waitFor();
  const image = await share.locator('meta[property="og:image"]').getAttribute('content');
  assert.ok(image && image.includes('/api/og/occasion-image?'));
  const png = await share.request.get(image!.replace(/^https?:\/\/[^/]+/u, origin));
  assert.equal(png.status(), 200);
  assert.equal(png.headers()['content-type'], 'image/png');
  assert.ok(await share.locator('img.card').evaluate((img) => (img as HTMLImageElement).naturalWidth === 1200));
  assert.match(await share.locator('h1').innerText(), /Ana & Luis/u);
  if (out) await share.screenshot({ path: resolve(out, 'share-page-wedding-390.png'), fullPage: true });
  checked.push('Share the reading: /share/occasion/ opens with its 1200x630 preview image');

  // Two charts: Open both charts and Share the reading.
  const both = await context.newPage();
  await both.goto(local(pair.data.cardUrl));
  await both.getByText('Ana', { exact: false }).first().waitFor({ timeout: 20_000 });
  await both.waitForFunction(() => /Luis/u.test(document.body.innerText) && /\b\d{1,3}\b/u.test(document.body.innerText), undefined, { timeout: 20_000 });
  const bothText = await both.locator('main').innerText();
  assert.match(bothText, /Ana/u);
  assert.match(bothText, /Luis/u);
  if (out) await both.screenshot({ path: resolve(out, 'printable-compatibility-390.png'), fullPage: true });
  checked.push('Open both charts: /compatibility/ opens with Ana and Luis from the link');
  const pairShare = await context.newPage();
  await pairShare.goto(local(pair.data.shareUrl));
  await pairShare.locator('img.card').waitFor();
  assert.match(await pairShare.locator('h1').innerText(), /Ana and Luis/u);
  assert.ok(await pairShare.locator('img.card').evaluate((img) => (img as HTMLImageElement).naturalWidth === 1200));
  if (out) await pairShare.screenshot({ path: resolve(out, 'share-page-compatibility-390.png'), fullPage: true });
  checked.push('Share the reading: /share/compatibility/ opens with its preview image');

  // Milestones: the printable card.
  const lives = await context.newPage();
  await lives.goto(local(milestones.data.cardUrl));
  await lives.waitForFunction(() => /Saturn return/u.test(document.body.innerText), undefined, { timeout: 20_000 });
  if (out) await lives.screenshot({ path: resolve(out, 'printable-milestones-390.png'), fullPage: true });
  checked.push('Open printable card: /occasions/milestones/ draws the Saturn return from the link');
} finally { await browser.close(); server.close(); }
console.log(`Card links verified:\n- ${checked.join('\n- ')}`);
