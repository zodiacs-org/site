/**
 * The brand's end card for short videos (TikTok, Reels, Shorts): two
 * seconds at 1080 x 1920 in which the tilted ring spins, slows, turns to
 * the brand's own front (Libra) and settles into the ZODIACS · ORG lockup
 * (DESIGN.md, "Brand Lockup"). No sound, so it sits under any track.
 *
 *   npm run data:end-card
 *
 * Writes public/assets/brand/end-card/zodiacs-end-card-9x16.mp4 (H.264,
 * 60 fps) and its last frame as zodiacs-end-card-9x16.png. Every frame is
 * drawn from src/lib/brand-lockup.mjs: the dots' sizes and opacities follow
 * the lockup ring's own depth table, the inks are the ring's sign inks, and
 * the last frame is the lockup in its proportions. Chromium draws each
 * frame from its time alone (four samples across half a frame, for a little
 * motion blur), and the system's ffmpeg encodes them. Chromium's text and
 * the encoder are not byte-stable across platforms, so the files are not in
 * the drift job; rerun this when the lockup changes.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  LOCKUP,
  LOCKUP_WORDS,
  TILTED_RING_DOTS,
  TILTED_RING_FRONT,
  TILTED_RING_INKS,
  TILTED_RING_SIGNS,
} from '../src/lib/brand-lockup.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const END_CARD = Object.freeze({
  width: 1080,
  height: 1920,
  fps: 60,
  seconds: 2,
  /** The lockup's type size on the last frame: about 700px wide, clear of the apps' side buttons. */
  typeSize: 56,
  /**
   * The ring's and the lockup's height on the frame, as a share of it:
   * a little above the middle, above where TikTok, Reels and Shorts put
   * their side buttons and captions.
   */
  centerY: 0.45,
  /** The ring's width while it spins. */
  spinWidth: 760,
  /** How far the ring turns before it settles, in degrees. */
  turn: 450,
  video: '/assets/brand/end-card/zodiacs-end-card-9x16.mp4',
  poster: '/assets/brand/end-card/zodiacs-end-card-9x16.png',
});

/**
 * The timeline, in seconds: the ring fades in as it spins, slows to a stop
 * by `spinEnd`, moves to its place in the lockup while the words come in,
 * and the lockup holds from `settled` to the end.
 */
export const END_CARD_TIMELINE = Object.freeze({
  fadeIn: 0.16,
  spinEnd: 1.05,
  moveStart: 0.7,
  moveEnd: 1.2,
  wordsStart: 1.06,
  wordsEnd: 1.46,
  settled: 1.46,
});

/**
 * The ring's depth table from the lockup's own dots: the size and opacity
 * of a dot at each height on the ellipse, from the back (-1) to the front (1).
 */
export function ringDepthTable() {
  const rows = TILTED_RING_DOTS.map((dot) => ({ depth: (dot.cy - 12) / 4, r: dot.r, opacity: dot.opacity }));
  const unique = new Map(rows.map((row) => [row.depth.toFixed(3), row]));
  return [...unique.values()].sort((a, b) => a.depth - b.depth);
}

/** Each sign's angle on the ellipse when the ring rests, in degrees (90 is the front). */
export function restingAngles() {
  const front = TILTED_RING_SIGNS.indexOf(TILTED_RING_FRONT);
  return Object.fromEntries(TILTED_RING_SIGNS.map((sign, index) => [sign, 90 + 30 * ((index - front + 12) % 12)]));
}

const fontUrl = async (path) => `data:font/woff2;base64,${(await readFile(resolve(root, path))).toString('base64')}`;

function pageHtml({ fonts, data }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'EB Garamond'; font-weight: 400; src: url(${fonts.serif400}) format('woff2'); }
  @font-face { font-family: 'EB Garamond'; font-weight: 500; src: url(${fonts.serif500}) format('woff2'); }
  html, body { margin: 0; width: ${END_CARD.width}px; height: ${END_CARD.height}px; overflow: hidden; background: #060709; }
  canvas { display: block; }
</style></head><body><canvas id="card" width="${END_CARD.width}" height="${END_CARD.height}"></canvas>
<script>
const DATA = ${JSON.stringify(data)};
const { card, timeline, depth, angles, inks, lockup, words } = DATA;
const canvas = document.getElementById('card');
const out = canvas.getContext('2d');
const layer = new OffscreenCanvas(card.width, card.height);
const ctx = layer.getContext('2d');
const SERIF = '"EB Garamond", Georgia, serif';
const INK = '#EEF1F7', MUTED = '#8E96AB', INK2 = '#C6CCDA', VOID = '#060709';
const clamp = (v) => Math.min(1, Math.max(0, v));
const span = (t, a, b) => clamp((t - a) / (b - a));
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, x) => a + (b - a) * x;

function atDepth(d) {
  if (d <= depth[0].depth) return depth[0];
  for (let i = 1; i < depth.length; i += 1) {
    const a = depth[i - 1], b = depth[i];
    if (d <= b.depth) {
      const x = (d - a.depth) / (b.depth - a.depth);
      return { r: lerp(a.r, b.r, x), opacity: lerp(a.opacity, b.opacity, x) };
    }
  }
  return depth[depth.length - 1];
}

// The words' layout on the last frame, as drawShareBrandLockup measures them.
const size = card.typeSize;
const tracking = size * lockup.tracking;
const dotSpace = size * lockup.dotSpace;
const runs = [
  { text: words.name, weight: 400, color: INK, before: 0 },
  { text: words.dot, weight: 400, color: MUTED, before: dotSpace },
  { text: words.tld, weight: 500, color: INK2, before: dotSpace },
];
let widths = [];
let wordsWidth = 0;
function measure() {
  ctx.letterSpacing = '0px';
  widths = runs.map((run) => {
    ctx.font = run.weight + ' ' + size + 'px ' + SERIF;
    return ctx.measureText(run.text).width + tracking * [...run.text].length;
  });
  wordsWidth = runs.reduce((sum, run, i) => sum + run.before + widths[i], 0) - tracking;
}
const ringWidth = size * lockup.ringWidth;
const gap = size * lockup.gap;

function ring(c, t, cx, cy, width, alpha) {
  const spin = card.turn * (1 - easeOutCubic(span(t, 0, timeline.spinEnd)));
  const scale = width / 28;
  const dots = Object.entries(angles).map(([sign, angle]) => {
    const phi = (angle + spin) * Math.PI / 180;
    const d = Math.sin(phi);
    const { r, opacity } = atDepth(d);
    return { x: cx + 10 * scale * Math.cos(phi), y: cy + 4 * scale * d, r: r * scale, opacity, d, ink: inks[sign] };
  }).sort((a, b) => a.d - b.d);
  for (const dot of dots) {
    c.globalAlpha = dot.opacity * alpha;
    c.fillStyle = dot.ink;
    c.beginPath();
    c.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

function frame(c, t) {
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  c.fillStyle = VOID;
  c.fillRect(0, 0, card.width, card.height);
  const cy = Math.round(card.height * card.centerY);
  const total = ringWidth + gap + wordsWidth;
  const left = (card.width - total) / 2;
  const move = easeInOutCubic(span(t, timeline.moveStart, timeline.moveEnd));
  const width = lerp(card.spinWidth, ringWidth, move);
  const cx = lerp(card.width / 2, left + ringWidth / 2, move);
  ring(c, t, cx, cy, width, easeOutCubic(span(t, 0, timeline.fadeIn)));
  const shown = easeOutCubic(span(t, timeline.wordsStart, timeline.wordsEnd));
  if (shown > 0) {
    c.save();
    c.globalAlpha = shown;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.letterSpacing = tracking + 'px';
    let x = left + ringWidth + gap + (1 - shown) * 36;
    const baseline = cy + (size * 0.65) / 2;
    runs.forEach((run, i) => {
      x += run.before;
      c.font = run.weight + ' ' + size + 'px ' + SERIF;
      c.fillStyle = run.color;
      c.fillText(run.text, x, baseline);
      x += widths[i];
    });
    c.restore();
  }
}

/** One video frame: four samples across half a frame interval, averaged. */
window.draw = (t) => {
  const samples = 4;
  const shutter = 0.5 / card.fps;
  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = 1;
  out.fillStyle = '#000';
  out.fillRect(0, 0, card.width, card.height);
  out.globalCompositeOperation = 'lighter';
  for (let s = 0; s < samples; s += 1) {
    frame(ctx, Math.max(0, t - shutter * (1 - (s + 0.5) / samples)));
    out.globalAlpha = 1 / samples;
    out.drawImage(layer, 0, 0);
  }
  out.globalCompositeOperation = 'source-over';
  out.globalAlpha = 1;
};

window.ready = (async () => {
  await Promise.all([
    document.fonts.load('400 ' + size + 'px ' + SERIF, words.name),
    document.fonts.load('500 ' + size + 'px ' + SERIF, words.tld),
  ]);
  if (!document.fonts.check('400 ' + size + 'px "EB Garamond"') || !document.fonts.check('500 ' + size + 'px "EB Garamond"')) {
    throw new Error('EB Garamond did not load');
  }
  measure();
  return { wordsWidth, ringWidth, gap };
})();
</script></body></html>`;
}

export async function renderEndCard({ rootDirectory = root } = {}) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const fonts = {
    serif400: await fontUrl('public/fonts/eb-garamond-latin-400-normal.woff2'),
    serif500: await fontUrl('public/fonts/eb-garamond-latin-500-normal.woff2'),
  };
  const data = {
    card: END_CARD,
    timeline: END_CARD_TIMELINE,
    depth: ringDepthTable(),
    angles: restingAngles(),
    inks: TILTED_RING_INKS,
    lockup: LOCKUP,
    words: LOCKUP_WORDS,
  };
  const work = await mkdtemp(join(tmpdir(), 'zodiacs-end-card-'));
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: END_CARD.width, height: END_CARD.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(pageHtml({ fonts, data }), { waitUntil: 'load' });
    const layout = await page.evaluate(() => window.ready);
    if (errors.length) throw new Error(`End card page failed: ${errors.join('; ')}`);
    const frames = END_CARD.fps * END_CARD.seconds;
    for (let index = 0; index < frames; index += 1) {
      await page.evaluate((t) => window.draw(t), index / END_CARD.fps);
      await writeFile(join(work, `frame-${String(index).padStart(4, '0')}.png`), await page.locator('#card').screenshot({ type: 'png' }));
    }
    const video = resolve(rootDirectory, `public${END_CARD.video}`);
    const poster = resolve(rootDirectory, `public${END_CARD.poster}`);
    await mkdir(dirname(video), { recursive: true });
    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-framerate', String(END_CARD.fps),
      '-i', join(work, 'frame-%04d.png'),
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow', '-crf', '16',
      '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', '-an',
      video,
    ]);
    await writeFile(poster, await readFile(join(work, `frame-${String(frames - 1).padStart(4, '0')}.png`)));
    return { video, poster, frames, layout, chromium: browser.version() };
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { video, poster, frames, layout, chromium } = await renderEndCard();
  console.log(`End card: ${frames} frames, the lockup ${Math.round(layout.ringWidth + layout.gap + layout.wordsWidth)}px wide (Chromium ${chromium}).`);
  console.log(`  ${video}\n  ${poster}`);
}
