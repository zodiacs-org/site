/**
 * The daily short videos (TikTok, Reels, Shorts): one vertical 1080 x 1920
 * MP4 per sign, about 13 to 19 seconds, with the sign's art and disc, its
 * name in EB Garamond, a few whole sentences of the day's published
 * horoscope, the "Sun-sign reading. Reading confidence 40%" label the site's
 * horoscope images print, the site address, gentle motion, and the brand's
 * end card (public/assets/brand/end-card/, `npm run data:end-card`) at the
 * end. Each video gets a caption file for posting by hand.
 *
 *   npm run data:shorts                      today's published edition
 *   npm run data:shorts -- --date 2026-11-06 a day the horoscope window holds
 *   npm run data:shorts -- --only aries,leo  some signs
 *   npm run data:shorts -- --out some/dir    another folder
 *
 * Writes dist-shorts/YYYY-MM-DD/{sign}.mp4, {sign}.txt (the caption),
 * {sign}-cover.png (a still with every line showing, for a cover image) and
 * manifest.json. dist-shorts/ is git-ignored: the videos are never
 * committed and never published from public/. This script only builds files;
 * it posts nothing anywhere.
 *
 * The words come from scripts/daily-shorts-lib.mjs, which takes whole
 * sentences from the published readings and never writes one. Chromium
 * draws every frame from its time alone, as build-end-card.mjs does, and the
 * system's ffmpeg encodes them and appends the end card. Silent, with an
 * empty audio track, so the apps accept it and any sound can go under it.
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parseArgs } from 'node:util';
import { LOCKUP, LOCKUP_WORDS, TILTED_RING_DOTS } from '../src/lib/brand-lockup.mjs';
import { END_CARD } from './build-end-card.mjs';
import {
  SHORTS_SIGNS,
  SHORTS_TEXT,
  longDate,
  shortsCaption,
  shortsConfidenceLabel,
  shortsLink,
  shortsTimeline,
  todayReadings,
} from './daily-shorts-lib.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const SHORTS = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 30,
  outDir: 'dist-shorts',
  endCard: `public${END_CARD.video}`,
});

const dataUrl = async (path, type) => `data:${type};base64,${(await readFile(resolve(root, path))).toString('base64')}`;

function pageHtml({ fonts }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'EB Garamond'; font-weight: 400; font-style: normal; src: url(${fonts.serif400}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 500; font-style: normal; src: url(${fonts.serif500}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 400; font-style: italic; src: url(${fonts.serif400i}) format('woff2'); }
  @font-face { font-family: 'Instrument Sans'; font-weight: 400 700; src: url(${fonts.sans}) format('woff2'); }
  @font-face { font-family: 'JetBrains Mono'; font-weight: 400 700; src: url(${fonts.mono}) format('woff2'); }
  html, body { margin: 0; width: ${SHORTS.width}px; height: ${SHORTS.height}px; overflow: hidden; background: #060709; }
  canvas { display: block; }
</style></head><body><canvas id="card" width="${SHORTS.width}" height="${SHORTS.height}"></canvas>
<script>
const W = ${SHORTS.width}, H = ${SHORTS.height};
const canvas = document.getElementById('card');
const c = canvas.getContext('2d');
const SERIF = '"EB Garamond", Georgia, serif';
const SANS = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const VOID = '#060709', INK = '#EEF1F7', INK1 = '#C6CCDA', INK2 = '#8E96AB';
const clamp = (v) => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, x) => a + (b - a) * x;
const loadImage = (src) => new Promise((ok, fail) => { const img = new Image(); img.onload = () => ok(img); img.onerror = () => fail(new Error('image did not load')); img.src = src; });

let S = null;

// Layout, in px on the 1080 x 1920 frame. Everything that matters sits
// between 90 and 960 across and above about 1600 down, clear of the apps'
// side buttons and caption band.
const L = {
  lockupY: 118, lockupSize: 26,
  artBottom: 860,
  discY: 650, disc: 188,
  kickerY: 826, nameY: 960, ruleY: 1030,
  textTop: 1112, textCenter: 528,
  addressY: 1548, confidenceY: 1598,
};

function fitFont(weight, size, family, text, maxWidth, style = '') {
  let s = size;
  for (;;) {
    c.font = style + ' ' + weight + ' ' + s + 'px ' + family;
    if (c.measureText(text).width <= maxWidth || s <= 12) return s;
    s -= 1;
  }
}

function prepare(data) {
  S = data;
  // The reading block's type size: the budget's, or smaller if a line would pass the width.
  c.letterSpacing = '0px';
  let size = data.text.fontSize;
  for (const line of data.sentences.flatMap((s) => s.lines)) size = Math.min(size, fitFont(400, data.text.fontSize, SANS, line, data.text.maxWidth));
  S.textSize = size;
  S.lineHeight = Math.round(size * 1.34);
  S.nameSize = fitFont(400, 150, SERIF, data.name, 820);
  // The lockup's words, measured as the end card measures them.
  const size2 = L.lockupSize;
  const tracking = size2 * data.lockup.tracking;
  const runs = [
    { text: data.words.name, weight: 400, color: INK, before: 0 },
    { text: data.words.dot, weight: 400, color: INK2, before: size2 * data.lockup.dotSpace },
    { text: data.words.tld, weight: 500, color: INK1, before: size2 * data.lockup.dotSpace },
  ];
  const widths = runs.map((run) => { c.font = run.weight + ' ' + size2 + 'px ' + SERIF; return c.measureText(run.text).width + tracking * [...run.text].length; });
  const wordsWidth = runs.reduce((sum, run, i) => sum + run.before + widths[i], 0) - tracking;
  S.lockupLayout = { runs, widths, wordsWidth, tracking, ringWidth: size2 * data.lockup.ringWidth, gap: size2 * data.lockup.gap };
  // Where each line sits: sentences one after another, with a little air between them.
  let y = L.textTop;
  S.lines = [];
  data.sentences.forEach((sentence, si) => {
    sentence.lines.forEach((text, li) => { S.lines.push({ text, y, start: data.starts[si] + li * 0.09 }); y += S.lineHeight; });
    y += Math.round(S.lineHeight * 0.36);
  });
  return { textSize: S.textSize, nameSize: S.nameSize, lastBaseline: S.lines[S.lines.length - 1].y };
}

function drawLockup(alpha) {
  const { runs, widths, wordsWidth, tracking, ringWidth, gap } = S.lockupLayout;
  const total = ringWidth + gap + wordsWidth;
  const left = (W - total) / 2;
  const cy = L.lockupY;
  // The ring: the lockup's own dots, viewBox -2 4 28 16, drawn ringWidth wide.
  const scale = ringWidth / 28;
  c.save();
  for (const dot of S.ring) {
    c.globalAlpha = dot.opacity * alpha;
    c.fillStyle = dot.fill;
    c.beginPath();
    c.arc(left + (dot.cx + 2) * scale, cy + (dot.cy - 12) * scale, dot.r * scale, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = alpha;
  c.textAlign = 'left';
  c.textBaseline = 'alphabetic';
  c.letterSpacing = tracking + 'px';
  let x = left + ringWidth + gap;
  const baseline = cy + (L.lockupSize * 0.65) / 2;
  runs.forEach((run, i) => {
    x += run.before;
    c.font = run.weight + ' ' + L.lockupSize + 'px ' + SERIF;
    c.fillStyle = run.color;
    c.fillText(run.text, x, baseline);
    x += widths[i];
  });
  c.restore();
}

function frame(t) {
  const body = S.body;
  c.save();
  c.globalAlpha = 1;
  c.letterSpacing = '0px';
  c.fillStyle = VOID;
  c.fillRect(0, 0, W, H);
  // Everything fades back to the void at the close, so the end card follows without a cut.
  const close = 1 - easeInOut(span(t, body - 0.7, body));

  // The sign's art: a slow push in and a small drift across, under the void's shade.
  const progress = clamp(t / body);
  const zoom = lerp(1.0, 1.07, progress);
  const artH = L.artBottom * 1.12 * zoom;
  const artW = artH * (S.art.width / S.art.height);
  const artX = (W - artW) / 2 + lerp(26, -26, easeInOut(progress));
  const artY = -40 - (artH - L.artBottom * 1.12) * 0.4;
  c.globalAlpha = easeOut(span(t, 0, 1.1)) * close;
  c.filter = 'saturate(0.94) brightness(0.86)';
  c.drawImage(S.art, artX, artY, artW, artH);
  c.filter = 'none';
  c.globalAlpha = 1;
  let g = c.createLinearGradient(0, L.artBottom - 380, 0, L.artBottom + 40);
  g.addColorStop(0, 'rgba(6,7,9,0)');
  g.addColorStop(1, 'rgba(6,7,9,1)');
  c.fillStyle = g;
  c.fillRect(0, L.artBottom - 380, W, H);
  g = c.createLinearGradient(0, 0, 0, 280);
  g.addColorStop(0, 'rgba(6,7,9,0.72)');
  g.addColorStop(1, 'rgba(6,7,9,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 280);

  drawLockup(easeOut(span(t, 0.2, 1.0)) * close);

  // The disc: it comes in, then floats a few pixels.
  const discIn = easeOut(span(t, 0.35, 1.25));
  const discSize = L.disc * lerp(0.86, 1, discIn);
  const float = Math.sin((t / 5.2) * Math.PI * 2) * 6;
  c.globalAlpha = discIn * close;
  c.drawImage(S.disc, W / 2 - discSize / 2, L.discY - discSize / 2 + float, discSize, discSize);

  // The kicker and the name.
  const head = easeOut(span(t, 0.6, 1.5));
  c.globalAlpha = head * close;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  c.font = 'italic 400 40px ' + SERIF;
  c.fillStyle = INK2;
  c.fillText(S.kicker, W / 2, L.kickerY + (1 - head) * 16);
  c.font = '400 ' + S.nameSize + 'px ' + SERIF;
  c.fillStyle = INK;
  c.fillText(S.name, W / 2, L.nameY + (1 - head) * 22);
  // A short rule in the sign's own hue.
  const rule = easeInOut(span(t, 1.0, 1.8));
  c.globalAlpha = close * 0.9;
  c.fillStyle = S.hue;
  c.fillRect(W / 2 - 40 * rule, L.ruleY, 80 * rule, 2);

  // The reading, a sentence at a time.
  c.font = '400 ' + S.textSize + 'px ' + SANS;
  c.fillStyle = INK1;
  for (const line of S.lines) {
    const shown = easeOut(span(t, line.start, line.start + 0.7));
    if (shown <= 0) continue;
    c.globalAlpha = shown * close;
    c.fillText(line.text, L.textCenter, line.y + (1 - shown) * 18);
  }

  // The address and the label.
  const foot = easeOut(span(t, 1.4, 2.2));
  c.globalAlpha = foot * close;
  c.font = '500 34px ' + SANS;
  c.fillStyle = INK;
  c.fillText(S.address, W / 2, L.addressY);
  c.font = '400 25px ' + MONO;
  c.fillStyle = INK2;
  c.fillText(S.confidence, W / 2, L.confidenceY);
  c.restore();
}

window.setup = async (data) => {
  await Promise.all([
    document.fonts.load('400 40px "EB Garamond"', data.name),
    document.fonts.load('500 40px "EB Garamond"', 'ORG'),
    document.fonts.load('italic 400 40px "EB Garamond"', data.kicker),
    document.fonts.load('400 40px "Instrument Sans"', 'Today'),
    document.fonts.load('500 40px "Instrument Sans"', data.address),
    document.fonts.load('400 25px "JetBrains Mono"', data.confidence),
  ]);
  for (const font of ['400 40px "EB Garamond"', 'italic 400 40px "EB Garamond"', '400 40px "Instrument Sans"', '400 25px "JetBrains Mono"']) {
    if (!document.fonts.check(font)) throw new Error(font + ' did not load');
  }
  const [art, disc] = await Promise.all([loadImage(data.artUrl), loadImage(data.discUrl)]);
  data.art = art;
  data.disc = disc;
  return prepare(data);
};
window.draw = (t) => frame(t);
</script></body></html>`;
}

function encoder({ file, body, endCard }) {
  const total = (body + END_CARD.seconds).toFixed(3);
  const child = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(SHORTS.fps), '-c:v', 'png', '-i', 'pipe:0',
    '-i', endCard,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex',
    `[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1[a];[1:v]fps=${SHORTS.fps},scale=${SHORTS.width}:${SHORTS.height},format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]`,
    '-map', '[v]', '-map', '2:a', '-t', total,
    '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '19', '-r', String(SHORTS.fps),
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart',
    file,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise((ok, fail) => {
    child.on('error', fail);
    child.on('close', (code) => (code === 0 ? ok() : fail(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`))));
  });
  let broken = null;
  child.stdin.on('error', (error) => { broken = error; });
  const write = (buffer) => new Promise((ok, fail) => {
    if (broken) fail(broken);
    else if (child.stdin.write(buffer)) ok();
    else child.stdin.once('drain', ok);
  });
  return { write, end: () => { child.stdin.end(); return done; } };
}

/**
 * One short video: the frames drawn by the page above, encoded with the end
 * card after them, a cover still, and the caption file. The daily horoscope
 * videos and the sky event videos (scripts/build-event-shorts.ts) share it.
 */
export async function renderShort({ browser, fonts, out, endCard, short }) {
  const { starts, body } = shortsTimeline(short.sentences);
  const page = await browser.newPage({ viewport: { width: SHORTS.width, height: SHORTS.height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setContent(pageHtml({ fonts }), { waitUntil: 'load' });
    const data = {
      name: short.name,
      hue: short.hue,
      kicker: short.kicker,
      address: short.address,
      confidence: short.footer,
      sentences: short.sentences,
      starts,
      body,
      text: SHORTS_TEXT,
      lockup: LOCKUP,
      words: LOCKUP_WORDS,
      ring: TILTED_RING_DOTS,
      artUrl: await dataUrl(`public/assets/sign-art/${short.art}-1200.webp`, 'image/webp'),
      discUrl: await dataUrl(`public/assets/zodiac-icons/400/${short.art}.webp`, 'image/webp'),
    };
    const layout = await page.evaluate((d) => window.setup(d), data);
    if (errors.length) throw new Error(`${short.stem}: ${errors.join('; ')}`);
    const file = join(out, `${short.stem}.mp4`);
    const video = encoder({ file, body, endCard });
    const frames = Math.round(body * SHORTS.fps);
    const coverAt = Math.max(0, Math.round((body - 1.2) * SHORTS.fps));
    // The page is exactly the canvas, so a viewport capture is the frame. The
    // protocol's fast PNG is lossless and about four times quicker than
    // Playwright's element screenshot.
    const cdp = await page.context().newCDPSession(page);
    for (let index = 0; index < frames; index += 1) {
      await page.evaluate((t) => window.draw(t), index / SHORTS.fps);
      const { data: base64 } = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
      const png = Buffer.from(base64, 'base64');
      if (index === coverAt) await writeFile(join(out, `${short.stem}-cover.png`), png);
      await video.write(png);
    }
    await video.end();
    if (errors.length) throw new Error(`${short.stem}: ${errors.join('; ')}`);
    await writeFile(join(out, `${short.stem}.txt`), short.caption);
    return {
      video: `${short.stem}.mp4`,
      caption: `${short.stem}.txt`,
      cover: `${short.stem}-cover.png`,
      seconds: Number((body + END_CARD.seconds).toFixed(2)),
      sentences: short.sentences.map((sentence) => sentence.text),
      layout,
    };
  } finally {
    await page.close();
  }
}

function renderSign({ browser, sign, day, fonts, out, endCard }) {
  const short = {
    stem: sign.slug,
    art: sign.slug,
    name: sign.name,
    hue: sign.hue,
    kicker: `Daily horoscope for ${longDate(day)}`,
    address: shortsLink(sign.slug),
    footer: shortsConfidenceLabel(),
    sentences: sign.sentences,
    caption: shortsCaption({ slug: sign.slug, name: sign.name, day, sentences: sign.sentences }),
  };
  return renderShort({ browser, fonts, out, endCard, short }).then((result) => ({ sign: sign.slug, ...result }));
}

/** The fonts the frames are drawn in, as data URLs. */
export async function shortsFonts() {
  return {
    serif400: await dataUrl('public/fonts/eb-garamond-latin-400-normal.woff2', 'font/woff2'),
    serif500: await dataUrl('public/fonts/eb-garamond-latin-500-normal.woff2', 'font/woff2'),
    serif400i: await dataUrl('public/fonts/eb-garamond-latin-400-italic.woff2', 'font/woff2'),
    sans: await dataUrl('public/fonts/instrument-sans-latin-wght-normal.woff2', 'font/woff2'),
    mono: await dataUrl('public/fonts/jetbrains-mono-latin-wght-normal.woff2', 'font/woff2'),
  };
}

/** The end card's path, once the end card and ffmpeg are known to be there. */
export async function shortsEndCard() {
  const endCard = resolve(root, SHORTS.endCard);
  if (!existsSync(endCard)) throw new Error(`The end card is missing (${SHORTS.endCard}); run npm run data:end-card`);
  await run('ffmpeg', ['-version']).catch(() => { throw new Error('ffmpeg is not installed; the videos need the system ffmpeg'); });
  return endCard;
}

/** Chromium, from the environment or the preinstalled build. */
export async function shortsBrowser() {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'].find((path) => existsSync(path));
  return chromium.launch({ executablePath });
}

export async function buildDailyShorts({ date, only, outRoot = SHORTS.outDir, concurrency = 3 } = {}) {
  const endCard = await shortsEndCard();
  const program = JSON.parse(await readFile(resolve(root, 'src/data/horoscope-program.json'), 'utf8'));
  const horoscopeWindow = JSON.parse(await readFile(resolve(root, 'src/data/horoscope-window.json'), 'utf8'));
  const readings = todayReadings({ program, window: horoscopeWindow, day: date });
  const wanted = only?.length ? new Set(only) : null;
  if (wanted) for (const slug of wanted) if (!SHORTS_SIGNS.some((sign) => sign.slug === slug)) throw new Error(`Unknown sign: ${slug}`);
  const signs = readings.signs.filter((sign) => !wanted || wanted.has(sign.slug));
  const out = resolve(root, outRoot, readings.day);
  await mkdir(out, { recursive: true });
  const fonts = await shortsFonts();
  const browser = await shortsBrowser();
  const results = [];
  try {
    const queue = [...signs];
    const worker = async () => {
      for (let sign = queue.shift(); sign; sign = queue.shift()) {
        const started = Date.now();
        const result = await renderSign({ browser, sign, day: readings.day, fonts, out, endCard });
        results.push(result);
        console.log(`  ${sign.slug}: ${result.seconds}s (${((Date.now() - started) / 1000).toFixed(0)}s to render)`);
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  } finally {
    await browser.close();
  }
  const order = SHORTS_SIGNS.map((sign) => sign.slug);
  results.sort((a, b) => order.indexOf(a.sign) - order.indexOf(b.sign));
  await writeFile(join(out, 'manifest.json'), `${JSON.stringify({
    day: readings.day,
    source: program.anchorDate === readings.day ? 'src/data/horoscope-program.json' : 'src/data/horoscope-window.json',
    note: 'Built for posting by hand. Nothing here has been posted.',
    videos: results,
  }, null, 2)}\n`);
  return { out, day: readings.day, results };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' },
      only: { type: 'string' },
      out: { type: 'string' },
      concurrency: { type: 'string' },
    },
  });
  const { out, day, results } = await buildDailyShorts({
    date: values.date,
    only: values.only?.split(',').map((slug) => slug.trim().toLowerCase()).filter(Boolean),
    outRoot: values.out,
    concurrency: values.concurrency ? Number(values.concurrency) : undefined,
  });
  console.log(`Daily shorts for ${day}: ${results.length} videos with captions in ${out}`);
}
