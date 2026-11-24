/**
 * Renders the thesis timeline plate (#fig-1, "The evolution of the zodiac")
 * as a PNG for its Share and Save image controls:
 *
 *   public/assets/thesis/share/evolution-of-the-zodiac.png
 *
 *   npm run build                      (the image is taken from the built page)
 *   npm run data:thesis-share-plate
 *
 * Like the Astrofolio share card (build-astrofolio-share-card.mjs), it uses
 * Playwright's Chromium (CHROMIUM_PATH, else /opt/pw-browsers/chromium, else
 * Playwright's own). It serves dist/ on a local port, opens /thesis/ in a dark
 * 1200 px wide viewport at device scale 2 with reduced motion, so the plate
 * shows its finished state, and adds is-capture to <html>, which hides the
 * plate's share controls and any hover state. It waits for the fonts and the
 * twelve header icons, screenshots the figure and sets it on the page
 * background with 24 px of margin. sharp writes the PNG losslessly at its
 * highest compression.
 *
 * There is no --check mode: the picture depends on the fonts and the Chromium
 * build of the machine that renders it, so it is not byte-stable. Re-run it
 * whenever the plate changes, and commit the image with the change.
 */
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');

export const THESIS_SHARE_PLATE_PATH = '/assets/thesis/share/evolution-of-the-zodiac.png';
const MARGIN = 24;
const SCALE = 2;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.ico': 'image/x-icon',
};

function serve() {
  const server = createServer(async (req, res) => {
    try {
      let path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
      if (path.endsWith('/')) path += 'index.html';
      const file = join(dist, path);
      if (!file.startsWith(dist)) throw new Error('outside dist');
      const info = await stat(file).catch(() => null);
      const target = info?.isDirectory() ? join(file, 'index.html') : file;
      const body = await readFile(target);
      res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

export async function renderThesisSharePlate() {
  if (!existsSync(join(dist, 'thesis/index.html'))) throw new Error('dist/thesis/index.html is missing: run npm run build first');
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const server = await serve();
  const browser = await chromium.launch({ executablePath });
  try {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 }, deviceScaleFactor: SCALE, colorScheme: 'dark', reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/thesis/`, { waitUntil: 'load' });
    await page.evaluate(() => document.documentElement.classList.add('is-capture'));
    const figure = page.locator('#fig-1');
    await figure.scrollIntoViewIfNeeded();
    await page.evaluate(async () => {
      const icons = [...document.querySelectorAll('#fig-1 .carry-pick img')];
      icons.forEach((img) => { img.loading = 'eager'; });
      await document.fonts.ready;
      await Promise.all(icons.map((img) => (img.complete && img.naturalWidth ? null : new Promise((done) => {
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      }))));
      if (icons.length !== 12 || icons.some((img) => !img.naturalWidth)) throw new Error('the twelve header icons did not load');
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    await page.mouse.move(0, 0);
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const shot = await figure.screenshot({ type: 'png', animations: 'disabled' });
    const [r, g, b] = (background.match(/\d+/g) ?? ['6', '7', '9']).map(Number);
    const png = await sharp(shot)
      .extend({ top: MARGIN * SCALE, bottom: MARGIN * SCALE, left: MARGIN * SCALE, right: MARGIN * SCALE, background: { r, g, b, alpha: 1 } })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    const output = resolve(root, `public${THESIS_SHARE_PLATE_PATH}`);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, png);
    const meta = await sharp(png).metadata();
    return { output, bytes: png.length, width: meta.width, height: meta.height, chromium: browser.version() };
  } finally {
    await browser.close();
    server.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { output, bytes, width, height, chromium } = await renderThesisSharePlate();
  console.log(`Thesis share plate: ${output} (${width}×${height}, ${bytes} bytes, Chromium ${chromium}).`);
}
