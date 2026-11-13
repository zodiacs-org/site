/**
 * Stamp the two bar charts in the /thesis/ essay from the committed data file
 * public/thesis/thesis-charts.json:
 *
 *   fig-know      between <!-- thesis-know-figure:begin --> and :end -->
 *                 YouGov, April 2022: who knows their sign, who says they believe.
 *   fig-lifespan  between <!-- thesis-lifespan-figure:begin --> and :end -->
 *                 CoinGecko's Pump.fun lifespan study, beside the twelve zodiac coins.
 *
 * The figures are generated output: edit the data file or this script, never the
 * stamped markup. Like the reads chart (build-thesis-figures.mjs), the stamp is
 * committed and is not part of a build; refreshing the data is a reviewed action.
 *
 *   node scripts/build-thesis-charts.mjs                restamp from the data file
 *   node scripts/build-thesis-charts.mjs --check        exit 1 if the page differs
 *   node scripts/build-thesis-charts.mjs --trade-check  read each sign's pool on the
 *     public Solana ledger, record the date of its latest swap and how many of the
 *     twelve traded in the 30 days before today, then restamp. RPC_URL overrides
 *     the endpoint (default api.mainnet-beta.solana.com, then publicnode).
 *
 * While twelve.tradedInWindow is null (no trade check recorded yet) the lifespan
 * chart prints CoinGecko's three bars only and makes no claim about the twelve.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = resolve(root, 'public/thesis/index.html');
const dataPath = resolve(root, 'public/thesis/thesis-charts.json');

const esc = (value) => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];
const SHORT = MONTHS.map((m) => m.slice(0, 3));
const longDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};
const shortDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${SHORT[m - 1]} ${y}`;
};
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

const pctText = (value) => `${Math.round(value)}%`;
const thousands = (n) => n.toLocaleString('en-US');

/** The twelve sign hues, Aries to Pisces: the page's only chroma. */
export const SIGN_HUES = ['#DE8E79', '#B9D4BE', '#B29DD0', '#B6D4E4', '#E0A9B4', '#B7D9B0',
  '#D3A9DE', '#B9DCE8', '#E0B080', '#C0DEA8', '#AE8FC9', '#A9D4C4'];
export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const INK = '#EEF1F7';
const DIM = 'rgba(198,204,218,0.16)';

/**
 * Seeded order in which units go dark. The page's motion script carries the
 * same generator (mulberry32) so the animation ends on exactly the dots this
 * static drawing leaves lit.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function deathOrder(n, seed) {
  const order = Array.from({ length: n }, (_, i) => i);
  const rand = mulberry32(seed);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** The twelve sign symbols as drawn on the page's keyboard figure, in a 48 by 48 box. */
export const SIGN_KEYS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
export const GLYPHS = [
  'M24 39V15C24 3 6 3 8 17M24 15C24 3 42 3 40 17',
  'M10 5C10 22 38 22 38 5M35 30A11 11 0 1 1 13 30A11 11 0 1 1 35 30',
  'M11 7Q24 12 37 7M11 41Q24 36 37 41M17 10V38M31 10V38',
  'M9 17C17 5 36 7 39 15M18 17A5 5 0 1 1 8 17A5 5 0 1 1 18 17M39 31C31 43 12 41 9 33M40 31A5 5 0 1 1 30 31A5 5 0 1 1 40 31',
  'M17 27A6 6 0 1 1 5 27A6 6 0 1 1 17 27M17 27C24 17 12 10 22 6C36 1 40 17 32 29C25 42 35 46 42 35',
  'M5 12Q12 6 12 17V35M12 15Q19 5 20 17V35M20 15Q28 5 28 17V32C28 43 43 34 40 21C38 12 29 17 32 27L42 41',
  'M7 33H18C5 22 16 10 24 10C32 10 43 22 30 33H41M7 40H41',
  'M5 12Q12 6 12 17V35M12 15Q20 5 20 17V35M20 15Q28 5 28 17V31Q28 40 42 35M36 31L43 35L39 41',
  'M9 39L39 9M25 9H39V23M11 20L28 37',
  'M5 14L11 10L18 37L27 11M27 11L28 34C28 47 45 42 41 32C38 26 28 29 24 39',
  'M5 20L13 12L20 20L28 12L35 20L43 12M5 34L13 26L20 34L28 26L35 34L43 26',
  'M12 6Q28 24 12 42M36 6Q20 24 36 42M6 24H42',
];
const DISC_INK = '#10131B';

/** A sign disc: the sign's hue with its symbol in the page's dark ink, centred on (cx, cy). */
export function signDisc(i, cx, cy, r, extra = '') {
  const k = (r * 1.12) / 48;
  const x = (cx - 24 * k).toFixed(2);
  const y = (cy - 24 * k).toFixed(2);
  return `<g class="disc"${extra}><circle cx="${cx}" cy="${cy}" r="${r}" fill="${SIGN_HUES[i]}"/>`
    + `<path transform="translate(${x} ${y}) scale(${k.toFixed(4)})" d="${GLYPHS[i]}" fill="none" stroke="${DISC_INK}" stroke-width="${(2.1 / k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/></g>`;
}

/**
 * Twelve coin faces with invented marks: no real coin's logo, letter or
 * mascot. They stand for "a page of crypto coins" in general.
 */
export const COIN_MARKS = [
  'M14 29A10 10 0 0 1 34 29M24 20H24.1',
  'M24 13A11 11 0 1 1 13 24',
  'M16 17V31M24 14V34M32 19V29',
  'M14 30L24 18L34 30',
  'M24 14V17M24 21V23M24 25V27M24 31V34M14 24H17M21 24H23M25 24H27M31 24H34',
  'M24 14L34 32H14Z',
  'M12 26C16 20 20 20 24 26S32 32 36 26',
  'M24 13L35 24L24 35L13 24Z',
  'M17 24H17.1M24 24H24.1M31 24H31.1',
  'M13 28L18 20L23 28L28 20L33 28',
  'M24 18A6 6 0 1 1 23.9 18M24 12A12 12 0 1 1 23.9 12',
  'M15 31H33M15 24H27M15 17H21',
];
export function coinFace(i, cx, cy, r) {
  const k = (r * 1.2) / 48;
  const x = (cx - 24 * k).toFixed(2);
  const y = (cy - 24 * k).toFixed(2);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1A1E28" stroke="rgba(198,204,218,0.32)" stroke-width="1.2"/>`
    + `<path transform="translate(${x} ${y}) scale(${k.toFixed(4)})" d="${COIN_MARKS[i]}" fill="none" stroke="rgba(198,204,218,0.62)" stroke-width="${(2 / k).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export const FILM = {
  poster: '/assets/thesis/film/two-conversations-poster.webp',
  av1: '/assets/thesis/film/two-conversations-1280-av1.mp4',
  h264: '/assets/thesis/film/two-conversations-1280.mp4',
};

/** "Which one is yours": the film, then twelve unknown coins beside the twelve signs, which the reader can pick. */
export function mineFigure() {
  let coins = '';
  for (let i = 0; i < 12; i++) coins += coinFace(i, 26 + (i % 6) * 49.6, 26 + Math.floor(i / 6) * 50, 21);
  const buttons = SIGN_KEYS.map((key, i) => `<button type="button" class="mine-sign" data-sign="${key}" aria-pressed="false" aria-label="${SIGN_NAMES[i]}"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${signDisc(i, 24, 24, 23)}</svg></button>`).join('');
  return `<figure class="zfig thesis-plate thesis-mine" id="fig-mine" data-motion="mine">
            <figcaption class="zfig-head">Nobody has to explain the twelve.</figcaption>
            <div class="mine-film">
              <video class="thesis-film" controls muted playsinline preload="none" width="1280" height="720" poster="${FILM.poster}" aria-describedby="thesis-film-desc">
                <source src="${FILM.av1}" type='video/mp4; codecs="av01.0.05M.08"'>
                <source src="${FILM.h264}" type="video/mp4">
              </video>
              <p class="mine-film__desc" id="thesis-film-desc">Watch: 20 seconds, no sound. One person talks about crypto in words nobody understands. A group nearby compares star signs and everyone joins in. It ends on the twelve signs and asks which one is yours.</p>
            </div>
            <div class="mine-panels">
              <div class="mine-panel">
                <svg class="mine-coins" viewBox="0 0 300 102" role="img" aria-label="Twelve coin faces with marks nobody recognises."><desc>Made-up coin faces. None of them is a real coin.</desc>${coins}</svg>
                <p class="mine-label">What is this</p>
              </div>
              <div class="mine-panel">
                <div class="mine-signs" role="group" aria-label="Pick your sign">${buttons}</div>
                <p class="mine-label mine-label--you" data-mine-label aria-live="polite">Which one is yours</p>
              </div>
            </div>
          </figure>`;
}

/**
 * Three groups of one hundred U.S. adults, drawn separately because two
 * surveys report three shares and not their overlap: 90 picked their own sign
 * and 27 say they believe in astrology (YouGov); 19 have ever used crypto (Pew).
 */
function peopleSvg(data, { small, label }) {
  const k = data.know;
  const u = data.usedCrypto;
  const step = small ? 14 : 21;
  const r = small ? 4.7 : 6.6;
  const grid = step * 10;
  const width = small ? 320 : 920;
  const top = 6;
  const blockH = grid + (small ? 76 : 112);
  const spots = small ? [[6, top], [176, top], [6, top + blockH + 14]] : [[20, top], [330, top], [640, top]];
  const groups = [
    { n: k.knowSignPct, cls: 'know', line1: 'picked their own sign', line2: 'when shown the twelve', hue: (i) => SIGN_HUES[i % 12] },
    { n: k.believePct, cls: 'believe', line1: 'say they believe', line2: 'in astrology', hue: () => INK },
    { n: u.everUsedPct, cls: 'crypto', line1: 'have ever bought', line2: 'or used any crypto', hue: () => INK },
  ];
  let body = '';
  groups.forEach((g, gi) => {
    const [left, gtop] = spots[gi];
    for (let i = 0; i < 100; i++) {
      const cx = left + (i % 10) * step + step / 2;
      const cy = gtop + Math.floor(i / 10) * step + step / 2;
      body += i < g.n
        ? `<circle class="pd" style="--i:${i + gi * 30}" cx="${cx}" cy="${cy}" r="${r}" fill="${g.hue(i)}"/>`
        : `<circle class="pd pd--off" style="--i:${i + gi * 30}" cx="${cx}" cy="${cy}" r="${(r - 0.6).toFixed(1)}" fill="none" stroke="rgba(198,204,218,0.34)" stroke-width="1.1"/>`;
    }
    const statY = gtop + grid + (small ? 38 : 56);
    body += `<text x="${left}" y="${statY}" class="stat-num stat-num--${g.cls}">${g.n}%</text>`;
    body += `<text x="${left}" y="${statY + (small ? 17 : 26)}" class="stat-lab">${esc(g.line1)}</text>`;
    body += `<text x="${left}" y="${statY + (small ? 32 : 47)}" class="stat-lab">${esc(g.line2)}</text>`;
  });
  const height = small ? top + blockH * 2 + 14 : top + blockH;
  return `<svg class="dots-chart dots-chart--${small ? 'small' : 'wide'}" data-people viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">`
    + `<desc>Three grids of one hundred dots, each dot one in a hundred U.S. adults. In the first, ${k.knowSignPct} dots are filled: they picked their own sign. In the second, ${k.believePct} are filled: they say they believe in astrology. In the third, ${u.everUsedPct} are filled: they have ever bought or used any crypto.</desc>`
    + body
    + '</svg>';
}

export function knowFigure(data) {
  const k = data.know;
  const u = data.usedCrypto;
  const [fy, fm] = k.fielded.split('-').map(Number);
  const when = `${MONTHS[fm - 1]} ${fy}`;
  const [py, pm] = u.fielded.split('-').map(Number);
  const pwhen = `${MONTHS[pm - 1]} ${py}`;
  const label = `Three dot grids of one hundred U.S. adults each. ${k.knowSignPct}% picked their own sign when shown the twelve and ${k.believePct}% said they believe in astrology (${k.source}, ${when}). ${u.everUsedPct}% have ever bought or used any crypto (${u.source}, ${pwhen}).`;
  return `<figure class="zfig thesis-plate thesis-dots" id="fig-know" data-motion="people">
            <figcaption class="zfig-head">Nine in ten know their sign. One in five has ever used crypto.</figcaption>
            ${peopleSvg(data, { small: false, label })}
            ${peopleSvg(data, { small: true, label })}
            <p class="zfig-cap">Each grid is one hundred U.S. adults. The first two come from one survey and the third from another, so they are drawn apart and should not be added or subtracted.</p>
            <p class="zfig-src"><a href="${esc(k.url)}" rel="noopener noreferrer">${esc(k.source)}</a>, U.S. adults, ${when}: respondents were shown the twelve signs and asked to pick their own. <a href="${esc(u.url)}" rel="noopener noreferrer">${esc(u.source)}</a>, U.S. adults, ${pwhen}: ever invested in, traded or used a cryptocurrency.</p>
          </figure>`;
}

/** Geometry of the shelf: columns of dots grow up from a shared baseline. */
export const SHELF = {
  wide: { width: 920, step: 9, r: 3, cols: 16, xs: [18, 198, 378], base: 405, discs: { x: 590, y: 96, cols: 4, gap: 78, r: 31 } },
  small: { width: 320, step: 6, r: 2.1, cols: 16, xs: [6, 114, 222], base: 264, discs: { x: 4, y: 0, cols: 6, gap: 52, r: 21 } },
};

function shelfColumn(g, x, n) {
  const rows = Math.floor(n / g.cols);
  const rem = n % g.cols;
  return { full: { x, y: g.base - rows * g.step, w: g.cols * g.step, h: rows * g.step }, part: { x, y: g.base - (rows + 1) * g.step, w: rem * g.step, h: g.step } };
}

function shelfSvg(data, { small, label }) {
  const g = small ? SHELF.small : SHELF.wide;
  const id = `sh-${small ? 's' : 'w'}`;
  const cats = data.shelf.categories;
  let body = `<defs><pattern id="${id}" width="${g.step}" height="${g.step}" patternUnits="userSpaceOnUse"><circle cx="${g.step / 2}" cy="${g.step / 2}" r="${g.r}" fill="rgba(198,204,218,0.42)"/></pattern></defs>`;
  cats.forEach((c, ci) => {
    const x = g.xs[ci];
    const col = shelfColumn(g, x, c.count);
    body += `<g class="sh-col" data-n="${c.count}" data-cols="${g.cols}" data-step="${g.step}" data-x="${x}" data-base="${g.base}">`
      + `<rect class="sh-full" x="${col.full.x}" y="${col.full.y}" width="${col.full.w}" height="${col.full.h}" fill="url(#${id})"/>`
      + `<rect class="sh-part" x="${col.part.x}" y="${col.part.y}" width="${col.part.w}" height="${col.part.h}" fill="url(#${id})"/></g>`;
    body += `<text x="${x}" y="${g.base + (small ? 30 : 40)}" class="sh-num" data-count="${c.count}">${thousands(c.count)}</text>`;
    body += `<text x="${x}" y="${g.base + (small ? 47 : 63)}" class="sh-lab">${esc(c.label)}</text>`;
  });
  body += `<text x="${g.xs[0]}" y="${g.base + (small ? 66 : 90)}" class="sh-more">and counting</text>`;
  const d = g.discs;
  const discTop = small ? g.base + 96 : d.y;
  let discs = '';
  SIGN_KEYS.forEach((key, i) => {
    const cx = d.x + d.r + (i % d.cols) * d.gap;
    const cy = discTop + d.r + Math.floor(i / d.cols) * d.gap;
    discs += signDisc(i, cx, cy, d.r, ` data-sign="${key}" style="--i:${i}"`);
  });
  const rowsOfDiscs = Math.ceil(12 / d.cols);
  const twelveY = small ? discTop + rowsOfDiscs * d.gap + 22 : g.base + 40;
  body += `<g class="sh-twelve">${discs}</g>`;
  body += `<text x="${d.x}" y="${twelveY}" class="sh-num sh-num--twelve">12</text>`;
  body += `<text x="${d.x}" y="${twelveY + (small ? 17 : 23)}" class="sh-lab">The same twelve for about 2,400 years.</text>`;
  const height = small ? twelveY + 30 : g.base + 100;
  return `<svg class="shelf-chart shelf-chart--${small ? 'small' : 'wide'}" data-shelf viewBox="0 0 ${g.width} ${height}" role="img" aria-label="${esc(label)}">`
    + `<desc>Three columns of grey dots, one dot per coin, beside the twelve sign discs.</desc>${body}</svg>`;
}

export function shelfFigure(data) {
  const sh = data.shelf;
  const [cy, cm, cd] = sh.checkedAt.split('-').map(Number);
  const read = `${cd} ${MONTHS[cm - 1]} ${cy}`;
  const counts = sh.categories.map((c) => `${thousands(c.count)} ${c.label}`).join(', ');
  const label = `Dot chart. CoinGecko lists ${counts}, one grey dot each, on ${read}. Beside them, the twelve signs.`;
  const links = sh.categories.map((c) => `<a href="${esc(c.url)}" rel="noopener noreferrer">${esc(c.label)}</a>`).join(', ');
  return `<figure class="zfig thesis-plate thesis-shelf" id="fig-shelf" data-motion="shelf">
            <figcaption class="zfig-head">There is no end to dogs. There are twelve signs.</figcaption>
            ${shelfSvg(data, { small: false, label })}
            ${shelfSvg(data, { small: true, label })}
            <p class="zfig-cap">Each grey dot is one coin listed by ${esc(sh.source)} in that category on ${read}. Many more exist that it does not list.</p>
            <p class="zfig-src">${esc(sh.source)} category pages, read ${read}: ${links}.</p>
          </figure>`;
}

/**
 * "A calendar gives the meme a reason to return": the page's sketch, drawn on
 * once when it scrolls into view. Not data: the caption says so.
 */
const CAL_AXIS = 'M10 12V107H290';
const CAL_ROWS = [
  ['A person can leave.', 'Schematic attention around a person fades after a peak.', 'M12 96C33 98 32 31 69 26S100 40 123 60S193 94 286 98', false],
  ['A moment can pass.', 'Schematic attention around a news event peaks sharply, then fades.', 'M12 99L54 98L72 20C86 89 123 98 286 99', false],
  ['A joke can wear thin.', 'Schematic attention around a joke rises then gradually fades.', 'M12 97C38 97 38 24 72 25S106 44 138 66S213 94 286 98', true],
];
export function calendarFigure() {
  const rows = CAL_ROWS.map(([title, aria, d, dashed], i) => {
    const line = dashed
      ? `<mask id="cal-mask-${i}" maskUnits="userSpaceOnUse" x="0" y="0" width="300" height="115"><path class="cal-draw" pathLength="1" d="${d}" fill="none" stroke="#fff" stroke-width="8" style="--d:${i * 0.9}s"/></mask><path d="${d}" fill="none" stroke="var(--ink-2)" stroke-width="2.5" stroke-dasharray="6 4" mask="url(#cal-mask-${i})"/>`
      : `<path class="cal-draw" pathLength="1" d="${d}" fill="none" stroke="var(--ink-2)" stroke-width="2.5" style="--d:${i * 0.9}s"/>`;
    return `<div class="fact-card"><strong>${title}</strong><svg viewBox="0 0 300 115" preserveAspectRatio="none" role="img" aria-label="${aria}"><path d="${CAL_AXIS}" fill="none" stroke="var(--hair-2)"/>${line}</svg></div>`;
  }).join('');
  const peaks = (cls, delay, opacity) => SIGN_KEYS.map((key, i) => {
    const x = 12 + i * 23;
    return `<path class="cal-draw cal-peak" data-sign="${key}" pathLength="1" d="M${x} 99L${x + 8} 29L${x + 22} 99" stroke="${SIGN_HUES[i]}" fill="none" stroke-width="2.5" style="--d:${(delay + i * 0.16).toFixed(2)}s"${opacity < 1 ? ` stroke-opacity="${opacity}"` : ''}/>`;
  }).join('');
  const seasons = `<div class="fact-card"><strong>The seasons come back.</strong><svg viewBox="0 0 300 115" preserveAspectRatio="none" role="img" aria-label="Schematic: twelve recurring seasons, one peak in each sign hue, then the year starts again. Not measured attention."><path d="${CAL_AXIS}" fill="none" stroke="var(--hair-2)"/><g class="cal-pass">${peaks('', 2.7, 0.45)}</g><g class="cal-pass cal-pass--again">${peaks('again', 5.0, 1)}</g></svg><span class="attention-patterns__axis">Aries to Pisces, then Aries again</span></div>`;
  return `<figure class="zfig thesis-plate thesis-calendar" id="fig-3" data-motion="calendar">
            <figcaption class="zfig-head">A calendar gives the meme a reason to return.</figcaption>
            <div class="fact-grid attention-patterns">${rows}${seasons}</div>
            <p class="zfig-cap">A sketch: attention tied to a person, a moment or a joke tends to fade, and the zodiac brings its subject back every season. These curves are illustrative, not measured coin performance. The next chart shows the measured version.</p>
            <p class="zfig-src">Illustration · <a href="#fig-2">measured Wikipedia reads</a>. No price forecast is implied.</p>
          </figure>`;
}

/** Geometry of the coin field, shared with the motion script through data attributes. */
export const FIELD = {
  wide: { width: 920, cols: 92, step: 10, r: 2.7 },
  small: { width: 320, cols: 40, step: 8, r: 2.3 },
};
export const FIELD_SEED = 20240705;

export function fieldCounts(l) {
  const n = Math.round(l.sample / 10_000);
  return {
    n,
    afterOne: Math.round((n * (100 - l.lastTradeOnCreationDayPct)) / 100),
    afterTwo: Math.round((n * (100 - l.lastTradeByNextDayPct)) / 100),
    after90: Math.round((n * l.lasted90DaysPct) / 100),
  };
}

function fieldSvg(counts, { small, label }) {
  const g = small ? FIELD.small : FIELD.wide;
  const rows = Math.ceil(counts.n / g.cols);
  const lastRow = counts.n - (rows - 1) * g.cols;
  const height = rows * g.step;
  const order = deathOrder(counts.n, FIELD_SEED);
  const alive = order.slice(counts.n - counts.after90).sort((a, b) => a - b);
  const id = `cf-${small ? 's' : 'w'}`;
  let survivors = '';
  for (const i of alive) {
    const cx = (i % g.cols) * g.step + g.step / 2;
    const cy = Math.floor(i / g.cols) * g.step + g.step / 2;
    survivors += `<circle cx="${cx}" cy="${cy}" r="${g.r}"/>`;
  }
  return `<svg class="field-chart field-chart--${small ? 'small' : 'wide'}" data-field data-cols="${g.cols}" data-step="${g.step}" data-r="${g.r}" viewBox="0 0 ${g.width} ${height}" role="img" aria-label="${esc(label)}">`
    + `<desc>${thousands(counts.n)} dots, one for every 10,000 coins. ${thousands(counts.after90)} are still lit after ninety days.</desc>`
    + `<defs><pattern id="${id}" width="${g.step}" height="${g.step}" patternUnits="userSpaceOnUse"><circle cx="${g.step / 2}" cy="${g.step / 2}" r="${g.r}" fill="${DIM}"/></pattern></defs>`
    + `<rect class="field-dim" width="${g.cols * g.step}" height="${(rows - 1) * g.step}" fill="url(#${id})"/>`
    + `<rect class="field-dim" y="${(rows - 1) * g.step}" width="${lastRow * g.step}" height="${g.step}" fill="url(#${id})"/>`
    + `<g class="field-alive" fill="${INK}">${survivors}</g>`
    + '</svg>';
}

/** The twelve, drawn as the brand's flat ring of dots in their own hues. */
function twelveRingSvg(label) {
  const c = 60;
  const R = 44;
  let dots = '';
  SIGN_HUES.forEach((hue, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    dots += `<circle class="tw" style="--i:${i}" cx="${(c + R * Math.cos(a)).toFixed(2)}" cy="${(c + R * Math.sin(a)).toFixed(2)}" r="7" fill="${hue}"><title>${SIGN_NAMES[i]}</title></circle>`;
  });
  return `<svg class="twelve-ring" viewBox="0 0 120 120" role="img" aria-label="${esc(label)}">${dots}</svg>`;
}

export function lifespanFigure(data) {
  const l = data.lifespan;
  const t = data.twelve;
  const counts = fieldCounts(l);
  const millions = (l.sample / 1e6).toFixed(1);
  const checked = typeof t.tradedInWindow === 'number' && t.checkedAt;
  const day = checked ? daysBetween(t.createdAt, t.checkedAt) : null;
  const afterOne = 100 - l.lastTradeOnCreationDayPct;
  const afterTwo = 100 - l.lastTradeByNextDayPct;
  const fieldLabel = `Dot field. Of ${millions} million coins launched on Pump.fun, ${pctText(afterOne)} traded after their first day, ${pctText(afterTwo)} after their second day and ${lessThanFive(l.lasted90DaysPct)} after ninety days, according to ${l.source}. One dot for every 10,000 coins: ${thousands(counts.after90)} of ${thousands(counts.n)} are still lit.`;
  const steps = [
    ['made', 'Made', counts.n],
    ['one', 'Day 1', counts.afterOne],
    ['two', 'Day 2', counts.afterTwo],
    ['ninety', 'Day 90', counts.after90],
  ].map(([key, name, value]) => `<button type="button" class="field-step" data-step="${key}" data-alive="${value}" aria-pressed="${key === 'ninety'}"><span class="field-step__name">${name}</span> <span class="field-step__n">${thousands(value)}</span></button>`).join('');
  let twelve = '';
  let twelveSource = '';
  if (checked) {
    const traded = t.tradedInWindow === 12 ? 'All twelve zodiac coins' : `${t.tradedInWindow} of the twelve zodiac coins`;
    const ringLabel = `${traded} traded in the ${t.windowDays} days before ${longDate(t.checkedAt)}, on day ${day} since they were made.`;
    twelve = `<div class="field-twelve">${twelveRingSvg(ringLabel)}<p class="field-twelve__n"><span class="field-twelve__big">${t.tradedInWindow} of 12</span> zodiac coins still trading on day ${day}</p></div>`;
    twelveSource = ` The twelve were made on ${longDate(t.createdAt)}; each was checked for a trade in the ${t.windowDays} days before ${shortDate(t.checkedAt)} on the public ledger.`;
  }
  const [uy, um, ud] = l.updated.split('-').map(Number);
  return `<figure class="zfig thesis-plate thesis-field" id="fig-lifespan" data-motion="field" data-seed="${FIELD_SEED}" data-n="${counts.n}">
            <figcaption class="zfig-head">Most memecoins stop trading the day they are made.</figcaption>
            <div class="field-top">
              <p class="field-readout"><span class="field-readout__n" data-readout>${thousands(counts.after90)}</span> <span class="field-readout__of">of ${thousands(counts.n)} dots still lit</span></p>
              ${twelve}
            </div>
            <div class="field-steps" role="group" aria-label="Replay the coin field">${steps}</div>
            <div class="field-frame">
            ${fieldSvg(counts, { small: false, label: fieldLabel })}
            ${fieldSvg(counts, { small: true, label: fieldLabel })}
            </div>
            <p class="zfig-cap">Each grey dot stands for 10,000 of the ${millions} million coins launched on one site, Pump.fun, lit while they still traded. Each coloured dot is one of the twelve zodiac coins.</p>
            <p class="zfig-src"><a href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.source)}</a>, updated ${ud} ${MONTHS[um - 1]} ${uy}. ${esc(l.source)} counted trades on Pump.fun only, so a coin that moved to another exchange may have traded for longer.${esc(twelveSource)}</p>
          </figure>`;
}

function lessThanFive(value) {
  return value >= 4 && value < 5 ? 'under 5%' : pctText(value);
}

function stamp(page, name, html) {
  const begin = `<!-- thesis-${name}-figure:begin -->`;
  const end = `<!-- thesis-${name}-figure:end -->`;
  const a = page.indexOf(begin);
  const b = page.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`thesis-${name}-figure markers not found in public/thesis/index.html`);
  return `${page.slice(0, a + begin.length)}\n          ${html}\n${page.slice(b)}`;
}

/**
 * Styles and the one motion script for the essay's figures. The drawings are
 * complete without it; the script only replays how they got there, once, when
 * the figure scrolls into view, and never moves layout (opacity and canvas
 * paint only). Readers who ask for reduced motion see the final drawing.
 */
export function motionBlock() {
  const css = `
    .thesis-dots, .thesis-field { padding:20px; border:1px solid var(--hair); border-radius:14px; }
    .thesis-dots .zfig-cap, .thesis-field .zfig-cap { max-width:68ch; font-family:'Instrument Sans',system-ui,sans-serif; font-style:normal; font-size:14px; line-height:1.65; color:var(--ink-2); }
    .thesis-dots .zfig-src, .thesis-field .zfig-src { max-width:none; font-size:11px; line-height:1.6; color:var(--ink-dim); }
    .thesis-dots .zfig-head, .thesis-field .zfig-head { margin-bottom:18px; }
    .thesis-dots svg.dots-chart, .thesis-field svg.field-chart { display:block; width:100%; height:auto; }
    .thesis-dots svg.dots-chart--small, .thesis-field svg.field-chart--small { display:none; }
    .dots-chart text.stat-num { font-family:var(--serif); font-size:64px; fill:var(--ink); }
    .dots-chart text.stat-num--believe { fill:#D3A9DE; }
    .dots-chart text.stat-lab { font-family:'Instrument Sans',system-ui,sans-serif; font-size:17px; fill:var(--ink-2); }
    .dots-chart--small text.stat-num { font-size:40px; }
    .dots-chart--small text.stat-lab { font-size:13px; }
    .field-top { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:16px 28px; margin-bottom:14px; }
    .field-readout { margin:0; display:flex; align-items:baseline; gap:12px; }
    .field-readout__n { font-family:var(--serif); font-size:clamp(48px,7vw,72px); line-height:1; color:var(--ink); font-variant-numeric:tabular-nums; display:inline-block; width:4.2ch; text-align:right; }
    .field-readout__of { font-family:'Instrument Sans',system-ui,sans-serif; font-size:15px; color:var(--ink-2); }
    .field-twelve { display:flex; align-items:center; gap:14px; margin:0; }
    .thesis-field svg.twelve-ring { width:76px; height:76px; flex:none; }
    .field-twelve__n { margin:0; max-width:17ch; font-family:'Instrument Sans',system-ui,sans-serif; font-size:14px; line-height:1.4; color:var(--ink-2); }
    .field-twelve__big { display:block; font-family:var(--serif); font-size:26px; color:var(--ink); }
    .field-steps { display:flex; flex-wrap:wrap; gap:8px; margin:0 0 14px; }
    .field-step { appearance:none; background:transparent; border:1px solid var(--hair); border-radius:999px; padding:6px 12px; color:var(--ink-dim); font:12px/1.2 var(--mono); cursor:pointer; }
    .field-step__n { color:var(--ink-2); }
    .field-step[aria-pressed="true"] { border-color:rgba(198,204,218,0.42); color:var(--ink); }
    .field-step[aria-pressed="true"] .field-step__n { color:var(--ink); }
    .field-step:focus-visible { outline:2px solid var(--ink-dim); outline-offset:2px; }
    .field-frame { position:relative; }
    .field-frame canvas { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; }
    .field-frame.is-live svg { visibility:hidden; }
    @media (max-width:739px) {
      .thesis-dots svg.dots-chart--wide, .thesis-field svg.field-chart--wide { display:none; }
      .thesis-dots svg.dots-chart--small { display:block; max-width:420px; margin:0 auto; }
      .thesis-field svg.field-chart--small { display:block; }
    }
    @media (prefers-reduced-motion:no-preference) {
      .is-armed .pd { opacity:.08; transition:opacity .5s ease, fill .9s ease; transition-delay:calc(var(--i) * 12ms); }
      .is-armed.is-on .pd { opacity:1; }
      .is-armed .stat-num, .is-armed .stat-lab { opacity:0; transition:opacity .8s ease 1.2s; }
      .is-armed.is-on .stat-num, .is-armed.is-on .stat-lab { opacity:1; }
      .is-armed .tw { opacity:.12; transition:opacity .45s ease; transition-delay:calc(var(--i) * 70ms); }
      .is-armed.is-twelve .tw { opacity:1; }
    }
    .thesis-mine, .thesis-shelf, .thesis-calendar { padding:20px; border:1px solid var(--hair); border-radius:14px; }
    .thesis-mine .zfig-head, .thesis-shelf .zfig-head { margin-bottom:16px; }
    .thesis-mine .zfig-cap, .thesis-shelf .zfig-cap, .thesis-calendar .zfig-cap { max-width:68ch; font-family:'Instrument Sans',system-ui,sans-serif; font-style:normal; font-size:14px; line-height:1.65; color:var(--ink-2); }
    .thesis-mine .zfig-src, .thesis-shelf .zfig-src, .thesis-calendar .zfig-src { max-width:none; font-size:11px; line-height:1.6; color:var(--ink-dim); }
    .mine-film { margin:0 0 16px; }
    .thesis-mine video.thesis-film { display:block; width:100%; height:auto; aspect-ratio:16/9; border-radius:10px; background:#0B0D12; }
    .mine-film__desc { margin:8px 0 0; font-family:'Instrument Sans',system-ui,sans-serif; font-size:12px; line-height:1.55; color:var(--ink-dim); }
    .mine-panels { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .mine-panel { border:1px solid var(--hair); border-radius:12px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:12px; }
    .thesis-mine svg.mine-coins { display:block; width:100%; height:auto; }
    .mine-signs { display:grid; grid-template-columns:repeat(6,1fr); gap:6px; }
    .mine-sign { appearance:none; background:none; border:0; padding:0; margin:0; border-radius:50%; cursor:pointer; aspect-ratio:1; transition:opacity .3s ease, transform .3s ease; }
    .mine-sign svg { display:block; width:100%; height:100%; }
    .mine-sign:focus-visible { outline:2px solid var(--ink); outline-offset:3px; }
    .mine-signs.has-pick .mine-sign[aria-pressed="false"] { opacity:.28; }
    .mine-label { margin:0; min-height:2.7em; display:flex; align-items:flex-end; font-family:var(--serif); font-size:20px; line-height:1.3; color:var(--ink); }
    .thesis-shelf svg.shelf-chart { display:block; width:100%; height:auto; }
    .thesis-shelf svg.shelf-chart--small { display:none; }
    .shelf-chart text.sh-num { font-family:var(--serif); font-size:34px; fill:var(--ink); font-variant-numeric:tabular-nums; }
    .shelf-chart text.sh-num--twelve { font-size:44px; }
    .shelf-chart text.sh-lab { font-family:'Instrument Sans',system-ui,sans-serif; font-size:15px; fill:var(--ink-2); }
    .shelf-chart text.sh-more { font-family:var(--serif); font-style:italic; font-size:15px; fill:var(--ink-dim); }
    .shelf-chart--small text.sh-num { font-size:22px; }
    .shelf-chart--small text.sh-num--twelve { font-size:30px; }
    .shelf-chart--small text.sh-lab { font-size:12px; }
    .shelf-chart--small text.sh-more { font-size:12px; }
    .shelf-chart .disc { transition:opacity .4s ease; }
    .thesis-shelf.has-pick .disc:not(.is-me), .thesis-calendar.has-pick .cal-peak:not(.is-me) { opacity:.25; }
    .thesis-field.has-pick .tw:not(.is-me) { opacity:.22 !important; }
    @media (max-width:739px) {
      .mine-panels { grid-template-columns:1fr; }
      .thesis-shelf svg.shelf-chart--wide { display:none; }
      .thesis-shelf svg.shelf-chart--small { display:block; }
    }
    @media (prefers-reduced-motion:no-preference) {
      .is-armed .shelf-chart .disc { opacity:.1; transition:opacity .45s ease; transition-delay:calc(var(--i) * 80ms); }
      .is-armed.is-twelve .shelf-chart .disc { opacity:1; }
      .is-armed .cal-draw { stroke-dasharray:1 1; stroke-dashoffset:1; }
      .is-armed.is-on .cal-draw { stroke-dashoffset:0; transition:stroke-dashoffset 1.1s ease; transition-delay:var(--d); }
      .is-armed .cal-pass--again .cal-draw { transition-duration:.7s; }
    }`;
  const js = `
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = !reduce && ('IntersectionObserver' in window);
  function below(el) { return el.getBoundingClientRect().top > window.innerHeight * 0.9; }
  function once(el, fn) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); fn(); }
    }, { threshold: 0.45 });
    io.observe(el);
  }
  var people = document.querySelector('[data-motion="people"]');
  if (animate && people && below(people)) {
    people.classList.add('is-armed');
    once(people, function () {
      people.classList.add('is-on');
    });
  }
  var fig = document.querySelector('[data-motion="field"]');
  if (!fig) return;
  var frame = fig.querySelector('.field-frame');
  var readout = fig.querySelector('[data-readout]');
  var buttons = [].slice.call(fig.querySelectorAll('.field-step'));
  var n = +fig.getAttribute('data-n');
  var alive = buttons.map(function (b) { return +b.getAttribute('data-alive'); });
  function mulberry32(a) { return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  var rand = mulberry32(+fig.getAttribute('data-seed'));
  var order = []; for (var i = 0; i < n; i++) order.push(i);
  for (var k = n - 1; k > 0; k--) { var j = Math.floor(rand() * (k + 1)); var s = order[k]; order[k] = order[j]; order[j] = s; }
  var stageOf = new Array(n), jitter = new Array(n), jr = mulberry32(858);
  for (var p = 0; p < n; p++) {
    var idx = order[p];
    stageOf[idx] = p < n - alive[1] ? 1 : p < n - alive[2] ? 2 : p < n - alive[3] ? 3 : 4;
    jitter[idx] = jr();
  }
  var canvas, ctx, geo, level = 3, from = 0, to = 0, t0 = 0, raf = 0, shown = alive[3];
  function svg() { var all = frame.querySelectorAll('svg'); for (var q = 0; q < all.length; q++) if (all[q].getClientRects().length) return all[q]; return null; }
  function setup() {
    var el = svg(); if (!el) return false;
    var vb = el.viewBox.baseVal, dpr = Math.min(window.devicePixelRatio || 1, 2), w = frame.clientWidth, h = w * vb.height / vb.width;
    if (!canvas) { canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); frame.appendChild(canvas); ctx = canvas.getContext('2d'); }
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    geo = { cols: +el.getAttribute('data-cols'), step: +el.getAttribute('data-step'), r: +el.getAttribute('data-r'), k: (w / vb.width) * dpr };
    return true;
  }
  function draw(pos) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var g = geo, lit = 0;
    for (var d = 0; d < n; d++) {
      var st = stageOf[d], a;
      if (st > pos + 0.999) a = 1;
      else if (st <= Math.floor(pos)) a = 0;
      else { var local = (pos - (st - 1) - jitter[d] * 0.55) / 0.45; a = local <= 0 ? 1 : local >= 1 ? 0 : 1 - local; }
      if (a > 0.5) lit++;
      ctx.fillStyle = a > 0 ? 'rgba(238,241,247,' + (0.16 + 0.76 * a).toFixed(3) + ')' : 'rgba(198,204,218,0.16)';
      ctx.beginPath();
      ctx.arc(((d % g.cols) + 0.5) * g.step * g.k, (Math.floor(d / g.cols) + 0.5) * g.step * g.k, g.r * g.k, 0, 6.2832);
      ctx.fill();
    }
    shown = lit;
    if (readout) readout.textContent = lit.toLocaleString('en-US');
  }
  function press(stage) { buttons.forEach(function (b, q) { b.setAttribute('aria-pressed', q === stage ? 'true' : 'false'); }); }
  function run(target, ms) {
    cancelAnimationFrame(raf); from = level; to = target; t0 = performance.now();
    if (!(ms > 0)) { level = target; draw(level); press(target); fig.classList.toggle('is-twelve', target === 3); return; }
    (function tick(now) {
      var u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      level = from + (to - from) * e; draw(level);
      if (u < 1) raf = requestAnimationFrame(tick);
      else { press(Math.round(level)); if (Math.round(level) === 3) fig.classList.add('is-twelve'); }
    })(t0);
  }
  var timers = [];
  buttons.forEach(function (b, q) {
    b.addEventListener('click', function () {
      if (!canvas && !setup()) return;
      timers.forEach(clearTimeout); timers = [];
      frame.classList.add('is-live');
      if (q < 3) fig.classList.remove('is-twelve');
      run(q, reduce ? 0 : 900 * Math.max(1, Math.abs(q - level)));
    });
  });
  if (!animate || !below(fig)) return;
  fig.classList.add('is-armed');
  once(fig, function () {
    if (!setup()) return;
    frame.classList.add('is-live'); level = 0; draw(0); press(0); fig.classList.remove('is-twelve');
    timers.push(setTimeout(function () { run(1, 1500); }, 700));
    timers.push(setTimeout(function () { run(2, 1100); }, 2500));
    timers.push(setTimeout(function () { run(3, 1500); }, 3900));
  });
  var rt; window.addEventListener('resize', function () { if (!canvas) return; clearTimeout(rt); rt = setTimeout(function () { setup(); draw(level); }, 120); });
})();`;
  const pick = `
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var animate = !reduce && ('IntersectionObserver' in window);
  function below(el) { return el.getBoundingClientRect().top > window.innerHeight * 0.9; }
  function once(el, fn) {
    var io = new IntersectionObserver(function (entries) { if (entries[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: 0.4 });
    io.observe(el);
  }
  var NAMES = { aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer', leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio', sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces' };
  /* The reader's pick lives in this page only: nothing is stored or sent. */
  var mine = document.querySelector('[data-motion="mine"]');
  if (mine) {
    var grid = mine.querySelector('.mine-signs');
    var label = mine.querySelector('[data-mine-label]');
    var resting = label.textContent;
    [].forEach.call(mine.querySelectorAll('.mine-sign'), function (b) {
      b.addEventListener('click', function () {
        var sign = b.getAttribute('aria-pressed') === 'true' ? '' : b.getAttribute('data-sign');
        [].forEach.call(mine.querySelectorAll('.mine-sign'), function (o) { o.setAttribute('aria-pressed', o === b && sign ? 'true' : 'false'); });
        grid.classList.toggle('has-pick', !!sign);
        label.textContent = sign ? NAMES[sign] + '. You already knew.' : resting;
        document.documentElement.dataset.mySign = sign;
        document.dispatchEvent(new CustomEvent('thesis:sign', { detail: { sign: sign } }));
      });
    });
  }
  function marks(fig, selector, sign) {
    fig.classList.toggle('has-pick', !!sign);
    [].forEach.call(fig.querySelectorAll(selector), function (el) { el.classList.toggle('is-me', !!sign && el.getAttribute('data-sign') === sign); });
  }
  var field = document.querySelector('[data-motion="field"]');
  var shelf = document.querySelector('[data-motion="shelf"]');
  var cal = document.querySelector('[data-motion="calendar"]');
  if (field) [].forEach.call(field.querySelectorAll('.tw'), function (el, i) { el.setAttribute('data-sign', Object.keys(NAMES)[i]); });
  document.addEventListener('thesis:sign', function (e) {
    var sign = e.detail.sign;
    if (field) marks(field, '.tw', sign);
    if (shelf) marks(shelf, '.disc', sign);
    if (cal) marks(cal, '.cal-peak', sign);
  });
  if (cal && animate && below(cal)) {
    cal.classList.add('is-armed');
    once(cal, function () { cal.classList.add('is-on'); });
  }
  if (!shelf || !animate || !below(shelf)) return;
  var cols = [].slice.call(shelf.querySelectorAll('.sh-col'));
  function setCol(col, shown) {
    var c = +col.getAttribute('data-cols'), st = +col.getAttribute('data-step'), base = +col.getAttribute('data-base');
    var rows = Math.floor(shown / c), rem = shown % c;
    var full = col.querySelector('.sh-full'), part = col.querySelector('.sh-part');
    full.setAttribute('y', base - rows * st); full.setAttribute('height', rows * st);
    part.setAttribute('y', base - (rows + 1) * st); part.setAttribute('width', rem * st);
  }
  function counters(i, value) {
    [].forEach.call(shelf.querySelectorAll('svg'), function (svg) { var t = svg.querySelectorAll('.sh-num[data-count]')[i]; if (t) t.textContent = value.toLocaleString('en-US'); });
  }
  var byIndex = [];
  cols.forEach(function (col) { var svg = col.ownerSVGElement, k = [].indexOf.call(svg.querySelectorAll('.sh-col'), col); (byIndex[k] = byIndex[k] || []).push(col); setCol(col, 0); });
  byIndex.forEach(function (_, k) { counters(k, 0); });
  shelf.classList.add('is-armed');
  once(shelf, function () {
    var t0 = performance.now(), each = 1300;
    (function tick(now) {
      var done = true;
      byIndex.forEach(function (group, k) {
        var n = +group[0].getAttribute('data-n');
        var u = Math.max(0, Math.min(1, (now - t0 - k * (each * 0.75)) / each));
        if (u < 1) done = false;
        var shown = Math.round(n * (1 - Math.pow(1 - u, 2)));
        group.forEach(function (col) { setCol(col, shown); });
        counters(k, shown);
      });
      if (!done) requestAnimationFrame(tick); else shelf.classList.add('is-twelve');
    })(t0);
  });
})();`;
  return `<style data-thesis-figures>${css}\n  </style>\n  <script data-thesis-figures>${js}${pick}\n  </script>`;
}

export function stampCharts(page, data) {
  let next = stamp(stamp(page, 'know', knowFigure(data)), 'lifespan', lifespanFigure(data));
  next = stamp(next, 'mine', mineFigure());
  next = stamp(next, 'shelf', shelfFigure(data));
  next = stamp(next, 'calendar', calendarFigure());
  next = stamp(next, 'motion', motionBlock());
  return next;
}

const RPC_URLS = [process.env.RPC_URL, 'https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com'].filter(Boolean);

async function rpc(method, params) {
  let lastError;
  for (const url of RPC_URLS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error.message);
        return json.result;
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw new Error(`${method} failed on every endpoint: ${lastError?.message ?? lastError}`);
}

/** Date (YYYY-MM-DD, UTC) of the newest swap through a pool, or null. */
async function latestSwap(pool) {
  const signatures = await rpc('getSignaturesForAddress', [pool, { limit: 25 }]);
  for (const entry of signatures) {
    if (entry.err || !entry.blockTime) continue;
    const tx = await rpc('getTransaction', [entry.signature, { encoding: 'json', maxSupportedTransactionVersion: 1 }]);
    const logs = tx?.meta?.logMessages ?? [];
    if (logs.some((line) => /Instruction: Swap/i.test(line))) {
      return new Date(entry.blockTime * 1000).toISOString().slice(0, 10);
    }
  }
  return null;
}

async function tradeCheck(data) {
  const today = new Date().toISOString().slice(0, 10);
  const perSign = {};
  let traded = 0;
  for (const [sign, pool] of Object.entries(data.twelve.pools)) {
    const date = await latestSwap(pool);
    perSign[sign] = date;
    if (date && daysBetween(date, today) <= data.twelve.windowDays) traded += 1;
    console.log(`${sign.padEnd(12)} ${date ?? 'no swap in the newest 25 transactions'}`);
  }
  data.twelve.perSign = perSign;
  data.twelve.tradedInWindow = traded;
  data.twelve.checkedAt = today;
  data.twelve.source = 'Solana RPC: getSignaturesForAddress on each pool, newest transaction whose logs record a swap';
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`${traded} of 12 traded in the ${data.twelve.windowDays} days before ${today}`);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  if (args.has('--trade-check')) await tradeCheck(data);
  const page = await readFile(pagePath, 'utf8');
  const next = stampCharts(page, data);
  if (args.has('--check')) {
    if (next !== page) {
      console.error('thesis charts: the stamped figures differ from public/thesis/thesis-charts.json. Run node scripts/build-thesis-charts.mjs');
      process.exit(1);
    }
    console.log('thesis charts: stamped figures match the data file');
    return;
  }
  if (next !== page) await writeFile(pagePath, next);
  console.log(next === page ? 'thesis charts: unchanged' : 'thesis charts: stamped');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
