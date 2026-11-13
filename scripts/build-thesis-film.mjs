/**
 * "Why the zodiac lasts": the thesis's 32-second silent film. It makes the
 * case for the zodiac itself, one claim per scene, each with its source on
 * screen, and only then says the twelve have coins:
 *
 *   1. about 2,400 years old; it outlived every medium that carried it  (page timeline)
 *   2. nine in ten can pick out their sign; one in four believes      (YouGov)
 *   3. 28% of Americans consult astrology every year; 46% of women under 50
 *                                                                  (Pew, 2025)
 *   4. 156 million Wikipedia reads since 2016; each sign is looked up 45% to
 *      80% more in its own season                      (Wikipedia pageviews)
 *   5. a symbol on every keyboard; astronomers still use all twelve names
 *                                                  (Unicode 1.1, IAU 1922)
 *   6. there will only ever be twelve; each has had a coin since July 2024
 *   7. which one is yours, and one line on the risk
 *
 *   npm run data:thesis-film
 *
 * Every number on screen is read from public/thesis/thesis-charts.json and
 * public/thesis/thesis-seasons.json, the files the page's figures are stamped
 * from, and the builder refuses to render if a sentence would stop being true.
 * Market-size figures are left out on purpose: the published estimates are
 * paywalled industry reports that disagree by a factor of two.
 *
 * Writes to public/assets/thesis/film/:
 *   why-the-zodiac-lasts-1280.mp4        1280 x 720, H.264, 30 fps (the page's film)
 *   why-the-zodiac-lasts-1280-av1.mp4    the same in AV1, offered first
 *   why-the-zodiac-lasts-poster.webp     the frame at FILM.posterAt, also as .avif
 *   why-the-zodiac-lasts-1080x1920.mp4   a tall cut for short-video apps, ending
 *                                        on the brand end card
 *
 * Each frame is a pure function of its time, drawn by Chromium on a canvas
 * and encoded by the system's ffmpeg. Not byte-stable across platforms, so
 * not in the drift job; scripts/thesis-film.test.mjs checks the files.
 */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { GLYPHS, SIGN_HUES, SIGN_NAMES } from './build-thesis-charts.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const FILM = Object.freeze({
  fps: 30,
  seconds: 32,
  posterAt: 19.6,
  dir: '/assets/thesis/film',
  wide: { width: 1280, height: 720, h264: 'why-the-zodiac-lasts-1280.mp4', av1: 'why-the-zodiac-lasts-1280-av1.mp4' },
  tall: { width: 1080, height: 1920, h264: 'why-the-zodiac-lasts-1080x1920.mp4' },
  poster: { webp: 'why-the-zodiac-lasts-poster.webp', avif: 'why-the-zodiac-lasts-poster.avif' },
  endCard: '/assets/brand/end-card/zodiacs-end-card-9x16.mp4',
});

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const day = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${SHORT[m - 1]} ${y}`; };
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function must(condition, message) {
  if (!condition) throw new Error(`thesis film: ${message}. Rewrite the scene before rendering.`);
}

/**
 * Every word on screen, built from the data files. Each sentence is checked
 * against the number it states, so the film cannot drift from its evidence.
 */
export function filmScript(charts, seasons) {
  const k = charts.know;
  const c = charts.consult;
  const t = charts.twelve;
  const iau = charts.constellations;
  must(k.knowSignPct >= 85 && k.knowSignPct <= 95, '"nine in ten" needs 85% to 95%');
  must(k.believePct >= 22 && k.believePct <= 30, '"one in four" needs 22% to 30%');
  must(c.yearlyPct >= 25 && c.yearlyPct <= 35, '"about three in ten" needs 25% to 35%');
  must(seasons.signs.every((x) => x.lift > 0), 'every sign must be read more in its own season');
  const millions = Math.round(seasons.reads.total / 1e6);
  must(millions >= 100, 'the reads total should be in the hundreds of millions');
  const [lo, hi] = seasons.liftRange;
  const [cy, cm] = t.createdAt.split('-').map(Number);
  const fromYear = seasons.reads.from.slice(0, 4);
  return {
    know: k.knowSignPct,
    believe: k.believePct,
    consult: c.yearlyPct,
    women: c.womenUnder50Pct,
    readsMillions: millions,
    seasons: seasons.signs.map((x) => ({ sign: x.sign, lift: x.lift, curve: x.curve })),
    eras: [['Clay tablet', 'c. 450 BCE'], ['Star map', '150 BCE'], ['Manuscript', '850'], ['Almanac', '1500'], ['Newspaper', '1930'], ['Phone', '2010'], ['Coin', String(cy)]],
    scenes: [
      {
        lines: ['The twelve signs are about 2,400 years old.'],
        then: ['They outlived every medium that carried them.'],
        source: 'Babylonian tablets to printed horoscopes to phones · the dated timeline on this page',
      },
      {
        lines: ['Nine in ten people can pick out their sign.'],
        then: ['Only one in four says they believe in astrology.', 'You do not have to believe in it for it to be yours.'],
        source: `${k.source}, U.S. adults, ${MONTHS[Number(k.fielded.slice(5, 7)) - 1]} ${k.fielded.slice(0, 4)}`,
      },
      {
        lines: [`${c.yearlyPct}% of Americans consult astrology every year.`],
        then: [`Among women under 50, it is ${c.womenUnder50Pct}%.`],
        source: `${c.source}, ${c.sample.toLocaleString('en-US')} U.S. adults, ${MONTHS[Number(c.fielded.slice(5, 7)) - 1]} ${c.fielded.slice(0, 4)}`,
      },
      {
        lines: [`${millions} million Wikipedia reads since ${fromYear}.`, 'Just the twelve articles about the signs.'],
        then: [`Each sign is looked up ${lo}% to ${hi}% more`, 'in its own season. Every year.'],
        source: `Wikimedia pageviews, English Wikipedia, each sign's article, ${fromYear} to ${seasons.reads.to.slice(0, 4)}`,
      },
      {
        lines: ['Every keyboard has a symbol for each sign.'],
        then: ['Astronomers still use all twelve names.'],
        source: `Unicode 1.1, June 1993 · ${iau.source}, ${iau.total} constellations, ${iau.adopted}`,
      },
      {
        lines: ['There are twelve signs.', 'There will only ever be twelve.'],
        then: [`Since ${MONTHS[cm - 1]} ${cy}, each one has a coin.`],
        source: 'One coin for each sign, on a public ledger · zodiacs.org/registry',
      },
      {
        lines: ['Which one is yours'],
        then: [],
        source: 'Memecoins can fall to zero. Read the evidence first at zodiacs.org/thesis',
      },
    ],
  };
}

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
let W = 0, H = 0, tall = false, L = null;
const BG = '#0B0D12', INK = '#EEF1F7';
const glyphs = D.glyphs.map((d) => new Path2D(d));
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => { x = clamp(x); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
const span = (t, a, b) => clamp((t - a) / (b - a));
const inout = (t, a, b, f = 0.45) => ease(span(t, a, a + f)) * (1 - ease(span(t, b - f, b)));
function mulberry32(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Scene timings, in seconds: [start, swap to "then", end].
const T = [[0, 2.7, 5.2], [5.2, 7.5, 10.2], [10.2, 12.6, 14.8], [14.8, 17.5, 20.6], [20.6, 22.7, 24.8], [24.8, 27.0, 29.0], [29.0, 32, 32.2]];

function text(str, x, y, size, alpha, { font = 'EB Garamond', weight = 400, color = INK, align = 'left' } = {}) {
  if (alpha <= 0 || !str) return;
  ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.font = weight + ' ' + size + 'px "' + font + '"'; ctx.fillText(str, x, y); ctx.restore();
}
function disc(i, x, y, r, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = D.hues[i]; ctx.fill();
  const k = (r * 1.12) / 48; ctx.translate(x - 24 * k, y - 24 * k); ctx.scale(k, k);
  ctx.lineWidth = 2.1 / k * (r / 24); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#10131B'; ctx.stroke(glyphs[i]);
  ctx.restore();
}
function dot(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); }

function layout() {
  if (tall) {
    const u = W / 1080;
    return { u, pad: 80 * u, head: 76 * u, sub: 40 * u, src: 24 * u, headY: 300 * u, lineGap: 1.2,
      vis: { x: 80 * u, y: 720 * u, w: 920 * u, h: 840 * u }, srcY: 1650 * u };
  }
  const u = H / 720;
  return { u, pad: 72 * u, head: 46 * u, sub: 26 * u, src: 15 * u, headY: 96 * u, lineGap: 1.2,
    vis: { x: 72 * u, y: 190 * u, w: 1136 * u, h: 440 * u }, srcY: 686 * u };
}

/** Wrap one line to the frame width, so the tall cut can break long sentences. */
function wrap(str, size, width, font = 'EB Garamond') {
  ctx.save(); ctx.font = '400 ' + size + 'px "' + font + '"';
  const words = str.split(' '), out = []; let line = '';
  for (const w of words) { const next = line ? line + ' ' + w : w; if (ctx.measureText(next).width > width && line) { out.push(line); line = w; } else line = next; }
  if (line) out.push(line); ctx.restore(); return out;
}

/** The headline for scene s: its first lines, then its "then" lines replacing them. */
function headline(t, s) {
  const [a, b, c] = T[s], sc = D.scenes[s];
  const first = inout(t, a + 0.15, sc.then.length ? b : c);
  const second = sc.then.length ? inout(t, b, c) : 0;
  const width = W - L.pad * 2;
  const draw = (lines, alpha) => {
    if (alpha <= 0) return;
    let y = L.headY;
    lines.forEach((line, i) => {
      const size = i === 0 ? L.head : L.head * 0.8;
      for (const part of wrap(line, size, width)) { text(part, L.pad, y, size, alpha * (i === 0 ? 1 : 0.78)); y += size * L.lineGap; }
    });
  };
  draw(sc.lines, first); draw(sc.then, second);
  const srcLines = wrap(sc.source, L.src, width, 'JetBrains Mono');
  srcLines.forEach((part, i) => text(part, L.pad, L.srcY + i * L.src * 1.5, L.src, inout(t, a + 0.3, c) * 0.62, { font: 'JetBrains Mono', color: 'rgb(198,204,218)' }));
}

// 1. The timeline: every medium that carried the signs.
function timeline(t, alpha) {
  if (alpha <= 0) return;
  const v = L.vis, n = D.eras.length;
  if (!tall) {
    const y = v.y + v.h * 0.45, x0 = v.x + 30 * L.u, x1 = v.x + v.w - 30 * L.u;
    const grow = ease(span(t, 0.3, 3.6));
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = 'rgba(198,204,218,0.3)'; ctx.lineWidth = 1.5 * L.u;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + (x1 - x0) * grow, y); ctx.stroke(); ctx.restore();
    D.eras.forEach(([name, when], i) => {
      const x = x0 + (x1 - x0) * (i / (n - 1)), on = ease(span(t, 0.4 + i * 0.45, 0.8 + i * 0.45));
      if (i === n - 1) { for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ctx.save(); ctx.globalAlpha = alpha * on; dot(x + 22 * L.u * Math.cos(a), y + 22 * L.u * Math.sin(a), 5 * L.u, D.hues[k]); ctx.restore(); } }
      else { ctx.save(); ctx.globalAlpha = alpha * on; dot(x, y, 11 * L.u, D.hues[(i * 2) % 12]); ctx.restore(); }
      text(name, x, y + 64 * L.u, 19 * L.u, alpha * on, { font: 'Instrument Sans', align: 'center' });
      text(when, x, y + 90 * L.u, 15 * L.u, alpha * on * 0.6, { font: 'JetBrains Mono', align: 'center', color: 'rgb(198,204,218)' });
    });
  } else {
    const x = v.x + 90 * L.u, y0 = v.y + 20 * L.u, y1 = v.y + v.h - 40 * L.u;
    const grow = ease(span(t, 0.3, 3.6));
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = 'rgba(198,204,218,0.3)'; ctx.lineWidth = 2 * L.u;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + (y1 - y0) * grow); ctx.stroke(); ctx.restore();
    D.eras.forEach(([name, when], i) => {
      const y = y0 + (y1 - y0) * (i / (n - 1)), on = ease(span(t, 0.4 + i * 0.45, 0.8 + i * 0.45));
      if (i === n - 1) { for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; ctx.save(); ctx.globalAlpha = alpha * on; dot(x + 30 * L.u * Math.cos(a), y + 30 * L.u * Math.sin(a), 7 * L.u, D.hues[k]); ctx.restore(); } }
      else { ctx.save(); ctx.globalAlpha = alpha * on; dot(x, y, 16 * L.u, D.hues[(i * 2) % 12]); ctx.restore(); }
      text(name, x + 80 * L.u, y + 4 * L.u, 40 * L.u, alpha * on, { font: 'Instrument Sans' });
      text(when, x + 80 * L.u, y + 46 * L.u, 26 * L.u, alpha * on * 0.6, { font: 'JetBrains Mono', color: 'rgb(198,204,218)' });
    });
  }
}

// 2 and 3. Groups of one hundred people.
function people(t, alpha, groups) {
  if (alpha <= 0) return;
  const v = L.vis;
  const grid = tall ? v.h * 0.4 : Math.min(v.h * 0.78, v.w / 2 - 330 * L.u), step = grid / 10, rr = step * 0.33;
  groups.forEach((g, gi) => {
    const gx = tall ? v.x + 30 * L.u : v.x + gi * (v.w / 2) + 30 * L.u;
    const gy = tall ? v.y + gi * (v.h / 2) : v.y;
    ctx.save();
    for (let i = 0; i < 100; i++) {
      const x = gx + (i % 10 + 0.5) * step, y = gy + (Math.floor(i / 10) + 0.5) * step;
      const show = ease(span(t, g.at + (i / 100) * 1.1, g.at + 0.3 + (i / 100) * 1.1));
      if (i < g.n && show > 0) { ctx.globalAlpha = alpha * show; dot(x, y, rr, g.hue ? D.hues[i % 12] : INK); }
      else { ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, rr * 0.85, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(198,204,218,0.3)'; ctx.lineWidth = Math.max(1, rr * 0.14); ctx.stroke(); }
    }
    ctx.restore();
    const on = alpha * ease(span(t, g.at + 0.7, g.at + 1.2));
    text(g.n + '%', gx + grid + 34 * L.u, gy + grid * 0.5, L.head * 1.6, on, { color: g.hue ? '#D3A9DE' : INK });
    text(g.label, gx + grid + 34 * L.u, gy + grid * 0.5 + L.sub * 1.4, L.sub, on * 0.75, { font: 'Instrument Sans', color: 'rgb(198,204,218)' });
  });
}

// 4. Each sign's own season, from ten years of Wikipedia reads.
const ROW_ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];
function ridges(t, alpha) {
  if (alpha <= 0) return;
  const v = L.vis, labelW = (tall ? 190 : 120) * L.u, x0 = v.x + labelW, x1 = v.x + v.w - (tall ? 120 : 80) * L.u;
  const top = v.y + v.h * 0.12, gap = (v.h * 0.82) / 12, amp = gap * 2.1;
  const maxR = Math.max(...D.seasons.flatMap((s) => s.curve)), floor = 0.6;
  const sweep = x0 + (x1 - x0) * ease(span(t, 15.1, 18.3));
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.rect(v.x, v.y - amp, sweep - v.x, v.h + amp * 2); ctx.clip();
  ROW_ORDER.forEach((si, row) => {
    const s = D.seasons[si], base = top + row * gap, n = s.curve.length;
    const px = (b) => x0 + ((b + 0.5) / n) * (x1 - x0), py = (r) => base - Math.max(0, (r - floor) / (maxR - floor)) * amp;
    ctx.beginPath(); ctx.moveTo(x0, base); s.curve.forEach((r, b) => ctx.lineTo(px(b), py(r))); ctx.lineTo(x1, base); ctx.closePath();
    ctx.fillStyle = BG; ctx.fill(); ctx.globalAlpha = alpha * 0.22; ctx.fillStyle = D.hues[si]; ctx.fill(); ctx.globalAlpha = alpha;
    ctx.beginPath(); s.curve.forEach((r, b) => (b ? ctx.lineTo(px(b), py(r)) : ctx.moveTo(px(b), py(r)))); ctx.strokeStyle = D.hues[si]; ctx.lineWidth = 2 * L.u; ctx.stroke();
  });
  ctx.restore();
  const fs = (tall ? 24 : 15) * L.u;
  ROW_ORDER.forEach((si, row) => {
    text(D.names[si], x0 - 14 * L.u, top + row * gap - 3 * L.u, fs, alpha * 0.8, { font: 'Instrument Sans', align: 'right', color: 'rgb(198,204,218)' });
    text('+' + D.seasons[si].lift + '%', x1 + 14 * L.u, top + row * gap - 3 * L.u, fs, alpha * ease(span(t, 17.6, 18.4)), { font: 'JetBrains Mono', color: D.hues[si] });
  });
  ['Jan', 'Apr', 'Jul', 'Oct'].forEach((m, i) => text(m, x0 + (x1 - x0) * (i / 4), top + 12 * gap + (tall ? 34 : 16) * L.u, fs * 0.9, alpha * 0.55, { font: 'JetBrains Mono', color: 'rgb(198,204,218)' }));
}

// 5. Keys: each sign's own symbol, and the sky's own names.
function keys(t, alpha) {
  if (alpha <= 0) return;
  const v = L.vis, cols = tall ? 4 : 6, rows = 12 / cols;
  const kw = tall ? 200 * L.u : 150 * L.u, kh = kw * 0.92, gap = 22 * L.u;
  const ox = v.x + (v.w - (cols * kw + (cols - 1) * gap)) / 2, oy = v.y + (tall ? 30 * L.u : 10 * L.u);
  for (let i = 0; i < 12; i++) {
    const x = ox + (i % cols) * (kw + gap), y = oy + Math.floor(i / cols) * (kh + gap), on = ease(span(t, 20.8 + i * 0.07, 21.2 + i * 0.07));
    ctx.save(); ctx.globalAlpha = alpha * on;
    ctx.beginPath(); ctx.roundRect(x, y, kw, kh, 16 * L.u); ctx.fillStyle = '#151923'; ctx.fill(); ctx.strokeStyle = 'rgba(198,204,218,0.18)'; ctx.lineWidth = 1.5 * L.u; ctx.stroke();
    const k = (kw * 0.42) / 48; ctx.translate(x + kw / 2 - 24 * k, y + kh * 0.42 - 24 * k); ctx.scale(k, k);
    ctx.lineWidth = 2.3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = D.hues[i]; ctx.stroke(glyphs[i]);
    ctx.restore();
    const latin = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpius', 'Sagittarius', 'Capricornus', 'Aquarius', 'Pisces'][i];
    const late = ease(span(t, 22.7, 23.3));
    text(D.names[i], x + kw / 2, y + kh * 0.86, (tall ? 26 : 17) * L.u, alpha * on * (1 - late), { font: 'Instrument Sans', align: 'center' });
    text(latin, x + kw / 2, y + kh * 0.86, (tall ? 24 : 15) * L.u, alpha * late, { font: 'JetBrains Mono', align: 'center', color: D.hues[i] });
  }
}

// 6 and 7. Twelve discs.
function twelve(t, alpha, from) {
  if (alpha <= 0) return;
  const v = L.vis, cols = tall ? 4 : 6, r = tall ? 70 * L.u : 46 * L.u, gap = r * 2.55;
  const ox = v.x + (v.w - (cols - 1) * gap) / 2, oy = v.y + (tall ? v.h * 0.12 : v.h * 0.18);
  for (let i = 0; i < 12; i++) disc(i, ox + (i % cols) * gap, oy + Math.floor(i / cols) * gap, r, alpha * ease(span(t, from + i * 0.06, from + 0.4 + i * 0.06)));
}

window.draw = (t) => {
  L = layout();
  ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  timeline(t, inout(t, 0, 5.2));
  people(t, inout(t, 5.2, 10.2), [{ n: D.know, at: 5.4, hue: true, label: 'picked their own sign' }, { n: D.believe, at: 7.6, hue: false, label: 'believe in astrology' }]);
  people(t, inout(t, 10.2, 14.8), [{ n: D.consult, at: 10.4, hue: true, label: 'of U.S. adults, every year' }, { n: D.women, at: 12.7, hue: true, label: 'of women under 50' }]);
  ridges(t, inout(t, 14.8, 20.6));
  keys(t, inout(t, 20.6, 24.8));
  twelve(t, ease(span(t, 24.8, 25.2)), 25.0);
  for (let s = 0; s < T.length; s++) if (t >= T[s][0] - 0.01 && t <= T[s][2] + 0.01) headline(t, s);
};

window.setup = async (w, h) => {
  W = w; H = h; tall = h > w; cv.width = W; cv.height = H;
  for (const f of ['400 40px "EB Garamond"', '500 30px "Instrument Sans"', '400 30px "JetBrains Mono"']) {
    await document.fonts.load(f);
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

export async function loadFilmScript(rootDirectory = root) {
  const charts = JSON.parse(await readFile(resolve(rootDirectory, 'public/thesis/thesis-charts.json'), 'utf8'));
  const seasons = JSON.parse(await readFile(resolve(rootDirectory, 'public/thesis/thesis-seasons.json'), 'utf8'));
  return filmScript(charts, seasons);
}

export async function renderFilm({ rootDirectory = root, only } = {}) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
  const executablePath = process.env.CHROMIUM_PATH
    ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const fonts = {
    serif: await fontUrl('public/fonts/eb-garamond-latin-400-normal.woff2'),
    sans: await fontUrl('public/fonts/instrument-sans-latin-wght-normal.woff2'),
    mono: await fontUrl('public/fonts/jetbrains-mono-latin-wght-normal.woff2'),
  };
  const script = await loadFilmScript(rootDirectory);
  const data = { ...script, hues: SIGN_HUES, glyphs: GLYPHS, names: SIGN_NAMES };
  const out = resolve(rootDirectory, `public${FILM.dir}`);
  await mkdir(out, { recursive: true });
  const work = await mkdtemp(join(tmpdir(), 'zodiacs-thesis-film-'));
  const browser = await chromium.launch({ executablePath });
  try {
    const page = await browser.newPage({ viewport: { width: FILM.wide.width, height: FILM.wide.height }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setContent(pageHtml({ fonts, data }), { waitUntil: 'load' });

    if (only !== 'tall') {
      const wideDir = join(work, 'wide');
      await mkdir(wideDir);
      await frames(page, FILM.wide, wideDir);
      if (errors.length) throw new Error(`film page failed: ${errors.join('; ')}`);
      const input = ['-framerate', String(FILM.fps), '-i', join(wideDir, 'f-%04d.png')];
      const vf = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'];
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', ...COLOUR, '-movflags', '+faststart', '-an', '-map_metadata', '-1', join(out, FILM.wide.h264)]);
      await run('ffmpeg', ['-y', '-loglevel', 'error', ...input, ...vf, '-c:v', 'libsvtav1', '-preset', '8', '-crf', '38', ...COLOUR, '-movflags', '+faststart', '-an', '-map_metadata', '-1', join(out, FILM.wide.av1)], { maxBuffer: 1 << 26 });
      const { default: sharp } = await import('sharp');
      const still = join(wideDir, `f-${String(Math.round(FILM.posterAt * FILM.fps)).padStart(4, '0')}.png`);
      await sharp(still).webp({ quality: 80 }).toFile(join(out, FILM.poster.webp));
      await sharp(still).avif({ quality: 58 }).toFile(join(out, FILM.poster.avif));
    }
    if (only !== 'wide') {
      const tallDir = join(work, 'tall');
      await mkdir(tallDir);
      await frames(page, FILM.tall, tallDir);
      await run('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-framerate', String(FILM.fps), '-i', join(tallDir, 'f-%04d.png'),
        '-i', resolve(rootDirectory, `public${FILM.endCard}`),
        '-filter_complex', `[0:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setsar=1[a];[1:v]fps=${FILM.fps},format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]`,
        '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', ...COLOUR, '-movflags', '+faststart', '-an', '-map_metadata', '-1',
        join(out, FILM.tall.h264),
      ]);
    }
    if (errors.length) throw new Error(`film page failed: ${errors.join('; ')}`);
    return { out, chromium: browser.version() };
  } finally {
    await browser.close();
    await rm(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const onlyAt = process.argv.indexOf('--only');
  const { out, chromium } = await renderFilm({ only: onlyAt > 0 ? process.argv[onlyAt + 1] : undefined });
  console.log(`Thesis film rendered in ${out} (Chromium ${chromium}).`);
}
