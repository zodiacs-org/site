/**
 * Generates Astrofolio's share card: one evergreen 1200×630 JPEG of the
 * twelve portraits from the owner's glyph film, one per sign in zodiac
 * order, in two rows around a void band that carries the wordmark and the
 * page's headline. The owner chose this design (option D, "Faces") on
 * 2026-09-24 in place of the seasonal v4 cards, which stay published at
 * their immutable URLs for links already shared. v6 (2026-10-19) signs the
 * band with the brand lockup (DESIGN.md, "Brand Lockup") where v5 set the
 * domain in the data face; v5 stays published, unchanged, for links already
 * shared.
 *
 *   npm run data:astrofolio-share-card
 *
 * Chromium decodes the AV1 cut of the film (public/assets/fomo/
 * fomo-film-av1.mp4) and seeks each tile to its sign's frame, so the card
 * never drifts from the film. Fonts are inlined as data: URIs, and the page
 * loads nothing from the network. The card is a JPEG because it is a
 * photograph: a PNG of it weighs about a megabyte, too heavy for some
 * chat-app link previews. Chromium's decode and scaling are not byte-stable
 * across platforms, so, like the other Chromium-rendered cards, CI verifies
 * the committed file (scripts/verify-og-cards.mjs) instead of re-rendering it.
 */
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { LOCKUP_SIZE, lockupWordsCss, lockupWordsHtml, ringWidthFor, tiltedRingSvg } from '../src/lib/brand-lockup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const ASTROFOLIO_SHARE_CARD_PATH = '/assets/og/astrofolio/v6/faces.jpg';
export const ASTROFOLIO_SHARE_CARD_MAX_BYTES = 300 * 1024;
export const ASTROFOLIO_SHARE_CARD_FILM = '/assets/fomo/fomo-film-av1.mp4';

// Each sign's frame in the film, as a time in seconds halfway through the
// frame (the film runs at 25 fps), and the vertical crop, as a percentage,
// that centres its glyph in a 200×250 tile.
export const ASTROFOLIO_SHARE_CARD_FRAMES = Object.freeze([
  { sign: 'aries', time: 6.54, focusY: 42 },
  { sign: 'taurus', time: 0.22, focusY: 30 },
  { sign: 'gemini', time: 0.50, focusY: 30 },
  { sign: 'cancer', time: 1.02, focusY: 32 },
  { sign: 'leo', time: 1.46, focusY: 34 },
  { sign: 'virgo', time: 1.94, focusY: 44 },
  { sign: 'libra', time: 2.54, focusY: 52 },
  { sign: 'scorpio', time: 3.06, focusY: 50 },
  { sign: 'sagittarius', time: 3.46, focusY: 46 },
  { sign: 'capricorn', time: 3.90, focusY: 58 },
  { sign: 'aquarius', time: 4.30, focusY: 60 },
  { sign: 'pisces', time: 4.78, focusY: 60 },
].map((frame) => Object.freeze(frame)));
const TILE = Object.freeze({ width: 200, height: 250 });

const fontUrl = async (path) => (
  `data:font/woff2;base64,${(await readFile(resolve(root, path))).toString('base64')}`
);

function cardHtml({ fonts, filmUrl }) {
  const tile = ({ sign }) => (
    `<div class="tile"><canvas data-sign="${sign}" width="${TILE.width}" height="${TILE.height}"></canvas></div>`
  );
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'EB Garamond'; font-weight: 400; src: url(${fonts.serif}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 500; src: url(${fonts.serif500}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 400; font-style: italic; src: url(${fonts.serifItalic}) format('woff2'); }
  @font-face { font-family: 'Instrument Sans'; font-weight: 100 900; src: url(${fonts.sans}) format('woff2'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 100 800; src: url(${fonts.mono}) format('woff2'); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; overflow: hidden; background: #060709; -webkit-font-smoothing: antialiased; }
  .card { display: grid; grid-template-rows: 250px 130px 250px; width: 1200px; height: 630px; }
  .row { display: grid; grid-template-columns: repeat(6, 1fr); }
  .tile { position: relative; overflow: hidden; background: #060709; }
  .tile canvas { display: block; width: 100%; height: 100%; }
  .tile + .tile::before { content: ""; position: absolute; z-index: 1; left: 0; top: 0; bottom: 0; width: 1px; background: rgba(6, 7, 9, .9); }
  .band { display: flex; align-items: center; justify-content: space-between; padding: 0 56px; background: #060709; }
  .wordmark { margin-top: -8px; color: #EEF1F7; font: 400 92px/.9 'EB Garamond', serif; letter-spacing: -.02em; }
  .wordmark i { font-style: italic; letter-spacing: -.01em; }
  .side { display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
  .tag { color: #C6CCDA; font: 500 19px/1 'Instrument Sans', sans-serif; letter-spacing: .22em; text-transform: uppercase; }
  .lockup { display: flex; align-items: center; gap: ${Math.round(LOCKUP_SIZE.image * 0.75)}px; }
  .lockup svg { display: block; flex: none; }
  ${lockupWordsCss({ name: 'lockup-name', sep: 'lockup-sep', tld: 'lockup-tld', size: LOCKUP_SIZE.image, colors: { name: '#EEF1F7', sep: '#8E96AB', tld: '#C6CCDA' } })}
</style></head><body><video id="film" muted playsinline preload="auto" src="${filmUrl}" hidden></video><div class="card">
  <div class="row">${ASTROFOLIO_SHARE_CARD_FRAMES.slice(0, 6).map(tile).join('')}</div>
  <div class="band"><span class="wordmark">Astro<i>folio</i></span><span class="side"><span class="tag">Twelve signs. Twelve tokens.</span><span class="lockup">${tiltedRingSvg({ width: ringWidthFor(LOCKUP_SIZE.image) })}${lockupWordsHtml({ name: 'lockup-name', sep: 'lockup-sep', tld: 'lockup-tld' })}</span></span></div>
  <div class="row">${ASTROFOLIO_SHARE_CARD_FRAMES.slice(6).map(tile).join('')}</div>
</div></body></html>`;
}

export async function renderAstrofolioShareCard({
  rootDirectory = root,
  output = resolve(rootDirectory, `public${ASTROFOLIO_SHARE_CARD_PATH}`),
} = {}) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const fonts = {
    serif: await fontUrl('public/fonts/eb-garamond-latin-400-normal.woff2'),
    serif500: await fontUrl('public/fonts/eb-garamond-latin-500-normal.woff2'),
    serifItalic: await fontUrl('public/fonts/eb-garamond-latin-400-italic.woff2'),
    sans: await fontUrl('public/fonts/instrument-sans-latin-wght-normal.woff2'),
    mono: await fontUrl('public/fonts/jetbrains-mono-latin-wght-normal.woff2'),
  };
  const filmUrl = pathToFileURL(resolve(rootDirectory, `public${ASTROFOLIO_SHARE_CARD_FILM}`)).href;
  // The film loads from a file: page; a page set from a string could not
  // read it.
  const workDirectory = await mkdtemp(join(tmpdir(), 'astrofolio-share-card-'));
  const browser = await chromium.launch({ executablePath });
  try {
    const pagePath = join(workDirectory, 'card.html');
    await writeFile(pagePath, cardHtml({ fonts, filmUrl }), 'utf8');
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(pagePath).href, { waitUntil: 'load' });
    // One film element, seeked frame by frame and painted into each tile.
    // Twelve elements decoding at once let some seeks land on the wrong
    // frame.
    await page.evaluate(async ({ frames, tile }) => {
      await document.fonts.ready;
      const film = document.getElementById('film');
      if (film.readyState < 2) {
        await new Promise((ready, fail) => {
          film.addEventListener('loadeddata', ready, { once: true });
          film.addEventListener('error', () => fail(new Error(`The film did not decode (media error ${film.error?.code})`)), { once: true });
        });
      }
      for (const { sign, time, focusY } of frames) {
        await new Promise((ready) => {
          film.addEventListener('seeked', ready, { once: true });
          film.currentTime = time;
        });
        // Cover the tile, with the crop set by focusY.
        const scale = Math.max(tile.width / film.videoWidth, tile.height / film.videoHeight);
        const width = tile.width / scale;
        const height = tile.height / scale;
        const context = document.querySelector(`canvas[data-sign="${sign}"]`).getContext('2d');
        context.imageSmoothingQuality = 'high';
        context.filter = 'saturate(.9) brightness(.92)';
        context.drawImage(
          film,
          (film.videoWidth - width) / 2,
          (film.videoHeight - height) * focusY / 100,
          width,
          height,
          0,
          0,
          tile.width,
          tile.height,
        );
      }
      await new Promise((ready) => requestAnimationFrame(() => requestAnimationFrame(ready)));
    }, { frames: ASTROFOLIO_SHARE_CARD_FRAMES, tile: TILE });
    const loaded = await page.evaluate(() => [...document.fonts].filter((font) => font.status === 'loaded').length);
    if (loaded < 4) throw new Error(`Astrofolio share card: only ${loaded} fonts loaded`);
    const raw = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } });
    const jpeg = await sharp(raw)
      .jpeg({ quality: 84, mozjpeg: true, chromaSubsampling: '4:4:4' })
      .toBuffer();
    if (jpeg.length > ASTROFOLIO_SHARE_CARD_MAX_BYTES) {
      throw new Error(`Astrofolio share card is ${jpeg.length} bytes, over the ${ASTROFOLIO_SHARE_CARD_MAX_BYTES}-byte budget`);
    }
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, jpeg);
    return { output, bytes: jpeg.length, chromium: browser.version() };
  } finally {
    await browser.close();
    await rm(workDirectory, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { output, bytes, chromium } = await renderAstrofolioShareCard();
  console.log(`Astrofolio share card: ${output} (${bytes} bytes, Chromium ${chromium}).`);
}
