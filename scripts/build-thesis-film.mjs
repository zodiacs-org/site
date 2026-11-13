/**
 * "Two conversations": the thesis's 20-second silent film, rendered from the
 * page's own shapes. One person talks crypto at nobody; a group nearby
 * compares star signs and everyone joins in; it ends on the twelve signs and
 * asks which one is yours, handing over to the sign picker below it on
 * /thesis/ (fig-mine).
 *
 *   npm run data:thesis-film
 *
 * Writes to public/assets/thesis/film/:
 *   two-conversations-1280.mp4        1280 x 720, H.264, 30 fps, 20 s (the page's film)
 *   two-conversations-1280-av1.mp4    the same in AV1, offered first
 *   two-conversations-poster.webp     the 13.6 s frame, also as .avif
 *   two-conversations-1080x1920.mp4   a tall cut for short-video apps, ending
 *                                     on the brand end card (22 s)
 *
 * Every frame is a pure function of its time: Chromium draws it on a canvas
 * from the page's sign hues, sign symbols and invented coin marks (imported
 * from build-thesis-charts.mjs, so the film and the figures cannot drift
 * apart), and the system's ffmpeg encodes the frames. No real coin, logo,
 * name, price or number appears. Chromium's text and the encoders are not
 * byte-stable across platforms, so the files are not in the drift job;
 * scripts/thesis-film.test.mjs checks their properties.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { COIN_MARKS, GLYPHS, SIGN_HUES } from './build-thesis-charts.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const FILM = Object.freeze({
  fps: 30,
  seconds: 20,
  posterAt: 13.6,
  dir: '/assets/thesis/film',
  wide: { width: 1280, height: 720, h264: 'two-conversations-1280.mp4', av1: 'two-conversations-1280-av1.mp4' },
  tall: { width: 1080, height: 1920, h264: 'two-conversations-1080x1920.mp4' },
  poster: { webp: 'two-conversations-poster.webp', avif: 'two-conversations-poster.avif' },
  endCard: '/assets/brand/end-card/zodiacs-end-card-9x16.mp4',
});

/** Every word on screen, in order. Ordinary words only: no brand, product, coin or person. */
export const FILM_WORDS = Object.freeze({
  open: 'What is this',
  jargon: ['consensus', 'hash power', 'block times', 'decentralization'],
  group: ['I’m such a Virgo.', 'Same.', 'Leos are so dramatic.'],
  ask: 'What’s your sign',
  close: 'Nobody has to explain the twelve.',
  last: 'Which one is yours',
});

async function fontUrl(path) {
  return `data:font/woff2;base64,${(await readFile(resolve(root, path))).toString('base64')}`;
}

function pageHtml({ fonts, data }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'EB Garamond'; src: url('${fonts.serif}') format('woff2'); font-weight: 400; }
@font-face { font-family: 'Instrument Sans'; src: url('${fonts.sans}') format('woff2-variations'); font-weight: 400 700; }
@font-face { font-family: 'JetBrains Mono'; src: url('${fonts.mono}') format('woff2-variations'); font-weight: 300 600; }
html, body { margin: 0; background: #0B0D12; }
canvas { display: block; }
</style></head><body><canvas id="film"></canvas><script>
const D = ${JSON.stringify(data)};
const cv = document.getElementById('film');
const ctx = cv.getContext('2d');
let W = 0, H = 0, tall = false;
const BG = '#0B0D12', INK = '#EEF1F7', DIM = 'rgba(198,204,218,', SURFACE = '#1A1E28';
const glyphs = D.glyphs.map((d) => new Path2D(d));
const marks = D.marks.map((d) => new Path2D(d));
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));
function rand(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function words(text, x, y, size, alpha, { font = 'EB Garamond', weight = 400, color = INK, align = 'center' } = {}) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.font = weight + ' ' + size + 'px "' + font + '"'; ctx.fillText(text, x, y); ctx.restore();
}
function coin(i, x, y, r, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = SURFACE; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.05); ctx.strokeStyle = DIM + '0.32)'; ctx.stroke();
  const k = (r * 1.2) / 48; ctx.translate(x - 24 * k, y - 24 * k); ctx.scale(k, k);
  ctx.lineWidth = 2 / k * (r / 22); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = DIM + '0.62)'; ctx.stroke(marks[i % marks.length]);
  ctx.restore();
}
function disc(i, x, y, r, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = D.hues[i]; ctx.fill();
  const k = (r * 1.12) / 48; ctx.translate(x - 24 * k, y - 24 * k); ctx.scale(k, k);
  ctx.lineWidth = 2.1 / k * (r / 24); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10131B'; ctx.stroke(glyphs[i]);
  ctx.restore();
}
function person(x, y, r, fill, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, r + r * 0.5, 0, Math.PI * 2); ctx.fillStyle = BG; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
  ctx.restore();
}
function bubble(text, x, y, size, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = '500 ' + size + 'px "Instrument Sans"';
  const w = ctx.measureText(text).width + size * 1.3, h = size * 2.05, r = h / 2;
  const left = x - w / 2, top = y - h;
  ctx.beginPath(); ctx.roundRect(left, top, w, h, r);
  ctx.moveTo(x - size * 0.35, top + h - 1); ctx.lineTo(x, top + h + size * 0.45); ctx.lineTo(x + size * 0.35, top + h - 1);
  ctx.fillStyle = SURFACE; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = DIM + '0.35)'; ctx.stroke();
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, top + h / 2 + 1);
  ctx.restore();
}

/** The layout for this frame size: positions as shares of the frame, sizes from its short side. */
function layout() {
  const u = Math.min(W, H) / 720;
  return tall
    ? { u, lone: [0.5, 0.78], group: [0.5, 0.46], spread: 120 * u, groupR: 26 * u, wall: { cols: 7, r: 36 * u }, title: 0.12, big: 60 * u, bubble: 28 * u, jargon: 30 * u, discs: { cols: 4, r: 58 * u, gap: 150 * u, y: 0.38 } }
    : { u, lone: [0.2, 0.6], group: [0.68, 0.6], spread: 105 * u, groupR: 30 * u, wall: { cols: 13, r: 36 * u }, title: 0.13, big: 56 * u, bubble: 26 * u, jargon: 30 * u, discs: { cols: 6, r: 60 * u, gap: 150 * u, y: 0.4 } };
}
const GROUP = [[-1.2, 0.2], [-0.3, -0.55], [0.75, -0.35], [1.2, 0.5], [0.1, 0.75]];
const GROUP_SIGNS = [5, 4, 7, 1, 2];

window.draw = (t) => {
  const L = layout(), u = L.u;
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const titleY = H * L.title, big = L.big;

  // 1. A wall of coins nobody recognises, still arriving.
  const wallOut = 1 - span(t, 3.5, 4.1);
  if (wallOut > 0) {
    const r = L.wall.r, step = r * 2.5, cols = L.wall.cols;
    const rows = Math.ceil(H / step) + 1;
    const ox = (W - (cols - 1) * step) / 2, oy = step * 0.9;
    const order = rand(20240705);
    let i = 0;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++, i++) {
      const at = order() * 2.4;
      const a = ease(span(t, at, at + 0.35)) * wallOut * 0.95;
      coin((i * 7) % 12, ox + col * step, oy + row * step, r * (0.9 + 0.1 * ease(span(t, at, at + 0.35))), a);
    }
    ctx.save(); ctx.globalAlpha = wallOut;
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.3); g.addColorStop(0, 'rgba(11,13,18,0.96)'); g.addColorStop(1, 'rgba(11,13,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.3); ctx.restore();
    person(W / 2, H * (tall ? 0.8 : 0.82), L.groupR * 1.1, INK, ease(span(t, 0.6, 1.1)) * wallOut);
    words(D.words.open, W / 2, titleY, big, ease(span(t, 1.2, 1.8)) * wallOut);
  }

  // 2. One person talks; the group does not turn. 3. The group lights up; the person joins.
  const scene = ease(span(t, 4.1, 4.7)) * (1 - ease(span(t, 14.0, 14.6)));
  if (scene > 0) {
    const gx = W * L.group[0], gy = H * L.group[1];
    const walk = ease(span(t, 11.4, 13.2));
    const loneX = W * L.lone[0] + (gx - L.spread * 2.3 - W * L.lone[0]) * walk * (tall ? 0 : 1);
    const loneY = H * L.lone[1] + (gy + L.spread * 1.7 - H * L.lone[1]) * walk * (tall ? 1 : 0.6);
    D.words.jargon.forEach((w, i) => {
      const a = 4.6 + i * 1.05, rise = span(t, a, a + 1.9);
      const alpha = Math.sin(Math.PI * rise) * 0.8 * scene;
      words(w, loneX + (i % 2 ? 1 : -1) * 18 * u, loneY - L.groupR * 2.2 - rise * 150 * u, L.jargon, alpha, { font: 'JetBrains Mono', color: 'rgb(198,204,218)' });
    });
    GROUP.forEach(([dx, dy], i) => {
      const lit = ease(span(t, 9.0 + i * 0.32, 9.4 + i * 0.32));
      const hue = D.hues[GROUP_SIGNS[i]];
      person(gx + dx * L.spread, gy + dy * L.spread, L.groupR, lit > 0.5 ? hue : 'rgb(120,126,140)', scene);
      if (lit > 0 && lit <= 0.5) person(gx + dx * L.spread, gy + dy * L.spread, L.groupR, hue, scene * lit * 2);
    });
    person(loneX, loneY, L.groupR, INK, scene);
    const bs = L.bubble;
    const lines = [[0, 9.3], [2, 10.45], [3, 11.6]];
    lines.forEach(([gi, at], k) => {
      const [dx, dy] = GROUP[gi];
      const a = ease(span(t, at, at + 0.3)) * (1 - ease(span(t, at + 1.3, at + 1.6))) * scene;
      bubble(D.words.group[k], gx + dx * L.spread, gy + dy * L.spread - L.groupR * 1.6, bs, a);
    });
    bubble(D.words.ask, gx, gy - L.spread * 1.15 - L.groupR, bs * 1.1, ease(span(t, 13.0, 13.4)) * scene);
  }

  // 4. The twelve. 5. The question that hands over to the picker.
  const d = L.discs;
  if (t >= 14.4) {
    const rowsN = Math.ceil(12 / d.cols);
    const ox = W / 2 - ((d.cols - 1) * d.gap) / 2, oy = H * d.y - ((rowsN - 1) * d.gap) / 2;
    for (let i = 0; i < 12; i++) {
      const a = ease(span(t, 14.6 + i * 0.12, 15.0 + i * 0.12));
      disc(i, ox + (i % d.cols) * d.gap, oy + Math.floor(i / d.cols) * d.gap, d.r * (0.85 + 0.15 * a), a);
    }
    const textY = tall ? H * 0.74 : H * 0.83;
    words(D.words.close, W / 2, textY, big, ease(span(t, 15.8, 16.4)) * (1 - ease(span(t, 17.7, 18.1))));
    words(D.words.last, W / 2, textY, big * 1.05, ease(span(t, 18.1, 18.6)));
  }
};

window.setup = async (w, h) => {
  W = w; H = h; tall = h > w; cv.width = W; cv.height = H;
  await Promise.all([
    document.fonts.load('400 40px "EB Garamond"'),
    document.fonts.load('500 30px "Instrument Sans"'),
    document.fonts.load('400 30px "JetBrains Mono"'),
  ]);
  for (const f of ['400 40px "EB Garamond"', '500 30px "Instrument Sans"', '400 30px "JetBrains Mono"']) {
    if (!document.fonts.check(f)) throw new Error('font did not load: ' + f);
  }
  return true;
};
</script></body></html>`;
}

async function frames(page, { width, height }, dir) {
  await page.setViewportSize({ width, height });
  await page.evaluate(([w, h]) => window.setup(w, h), [width, height]);
  const count = FILM.fps * FILM.seconds;
  for (let index = 0; index < count; index += 1) {
    await page.evaluate((t) => window.draw(t), index / FILM.fps);
    await writeFile(join(dir, `f-${String(index).padStart(4, '0')}.png`), await page.locator('#film').screenshot({ type: 'png' }));
  }
  return count;
}

const COLOUR = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv'];

export async function renderFilm({ rootDirectory = root } = {}) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const fonts = {
    serif: await fontUrl('public/fonts/eb-garamond-latin-400-normal.woff2'),
    sans: await fontUrl('public/fonts/instrument-sans-latin-wght-normal.woff2'),
    mono: await fontUrl('public/fonts/jetbrains-mono-latin-wght-normal.woff2'),
  };
  const data = { hues: SIGN_HUES, glyphs: GLYPHS, marks: COIN_MARKS, words: FILM_WORDS };
  const out = resolve(rootDirectory, `public${FILM.dir}`);
  await mkdir(out, { recursive: true });
  const work = await mkdtemp(join(tmpdir(), 'zodiacs-thesis-film-'));
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: FILM.wide.width, height: FILM.wide.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(pageHtml({ fonts, data }), { waitUntil: 'load' });

    const wideDir = join(work, 'wide');
    await mkdir(wideDir);
    await frames(page, FILM.wide, wideDir);
    if (errors.length) throw new Error(`film page failed: ${errors.join('; ')}`);
    const input = ['-framerate', String(FILM.fps), '-i', join(wideDir, 'f-%04d.png')];
    const vf = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'];
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', ...COLOUR, '-movflags', '+faststart', '-an', '-map_metadata', '-1', join(out, FILM.wide.h264)]);
    await run('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...vf, '-c:v', 'libsvtav1', '-preset', '8', '-crf', '40', ...COLOUR, '-movflags', '+faststart', '-an', '-map_metadata', '-1', join(out, FILM.wide.av1)], { maxBuffer: 1 << 26 });

    const { default: sharp } = await import('sharp');
    const still = join(wideDir, `f-${String(Math.round(FILM.posterAt * FILM.fps)).padStart(4, '0')}.png`);
    await sharp(still).webp({ quality: 78 }).toFile(join(out, FILM.poster.webp));
    await sharp(still).avif({ quality: 55 }).toFile(join(out, FILM.poster.avif));

    const tallDir = join(work, 'tall');
    await mkdir(tallDir);
    await frames(page, FILM.tall, tallDir);
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-framerate', String(FILM.fps), '-i', join(tallDir, 'f-%04d.png'),
      '-i', resolve(rootDirectory, `public${FILM.endCard}`),
      '-filter_complex', `[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1[a];[1:v]fps=${FILM.fps},format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]`,
      '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', ...COLOUR, '-movflags', '+faststart', '-an', '-map_metadata', '-1',
      join(out, FILM.tall.h264),
    ]);
    if (errors.length) throw new Error(`film page failed: ${errors.join('; ')}`);
    return { out, chromium: browser.version() };
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { out, chromium } = await renderFilm();
  console.log(`Thesis film rendered in ${out} (Chromium ${chromium}).`);
}
