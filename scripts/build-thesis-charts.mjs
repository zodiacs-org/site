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

/** One hundred people: 90 know their sign, 27 of them believe. */
function peopleSvg(k, { small, label }) {
  const step = small ? 25 : 24;
  const r = small ? 7.5 : 7.5;
  const gx = small ? 35 : 6;
  const gy = small ? 6 : 6;
  const grid = step * 10;
  const width = small ? 320 : 920;
  let dots = '';
  for (let i = 0; i < 100; i++) {
    const cx = gx + (i % 10) * step + step / 2;
    const cy = gy + Math.floor(i / 10) * step + step / 2;
    const cls = i < k.believePct ? 'pd pd--believe' : i < k.knowSignPct ? 'pd pd--know' : 'pd pd--not';
    const fill = i < k.believePct ? SIGN_HUES[i % 12] : i < k.knowSignPct ? INK : 'none';
    const stroke = i >= k.knowSignPct ? ` stroke="${DIM.replace('0.16', '0.5')}" stroke-width="1.2"` : '';
    dots += `<circle class="${cls}" style="--i:${i}${i < k.believePct ? `;--hue:${SIGN_HUES[i % 12]}` : ''}" cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke}/>`;
  }
  const statX = small ? 0 : gx + grid + 64;
  const statY = small ? gy + grid + 46 : 60;
  const gap = small ? 74 : 112;
  const stat = (y, n, line1, line2, cls) => `<text x="${statX}" y="${y}" class="stat-num ${cls}">${n}%</text>`
    + `<text x="${statX + (small ? 92 : 128)}" y="${y - (small ? 20 : 28)}" class="stat-lab">${esc(line1)}</text>`
    + `<text x="${statX + (small ? 92 : 128)}" y="${y - (small ? 2 : 6)}" class="stat-lab">${esc(line2)}</text>`;
  const height = small ? statY + gap + 14 : gy + grid + 8;
  return `<svg class="dots-chart dots-chart--${small ? 'small' : 'wide'}" data-people viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">`
    + `<desc>One hundred dots, one for each hundredth of U.S. adults. ${k.knowSignPct} are filled: they picked their own sign. ${k.believePct} of those are in colour: they also said they believe in astrology. ${100 - k.knowSignPct} are hollow.</desc>`
    + dots
    + stat(statY, k.knowSignPct, 'picked their own sign', 'when shown the twelve', 'stat-num--know')
    + stat(statY + gap, k.believePct, 'said they believe', 'in astrology', 'stat-num--believe')
    + '</svg>';
}

export function knowFigure(data) {
  const k = data.know;
  const [fy, fm] = k.fielded.split('-').map(Number);
  const when = `${MONTHS[fm - 1]} ${fy}`;
  const label = `Dot chart of one hundred U.S. adults. ${k.knowSignPct}% picked their own sign when shown the twelve. ${k.believePct}% said they believe in astrology. ${k.source}, ${when}.`;
  return `<figure class="zfig thesis-plate thesis-dots" id="fig-know" data-motion="people">
            <figcaption class="zfig-head">Almost everyone knows their sign. Few say they believe.</figcaption>
            ${peopleSvg(k, { small: false, label })}
            ${peopleSvg(k, { small: true, label })}
            <p class="zfig-cap">Each dot is one in a hundred U.S. adults. Coloured dots know their sign and believe; white dots know it and do not; hollow dots could not pick it.</p>
            <p class="zfig-src"><a href="${esc(k.url)}" rel="noopener noreferrer">${esc(k.source)}</a>, U.S. adults, ${when}. Respondents were shown the twelve signs and asked to pick their own.</p>
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
  ].map(([key, name, value]) => `<button type="button" class="field-step" data-step="${key}" data-alive="${value}"><span class="field-step__name">${name}</span> <span class="field-step__n">${thousands(value)}</span></button>`).join('');
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
            <p class="zfig-cap">Each grey dot stands for 10,000 of the ${millions} million coins launched on Pump.fun, lit while they still traded. Each coloured dot is one of the twelve zodiac coins.</p>
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
    .dots-chart--small text.stat-num { font-size:46px; }
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
      .is-armed .pd--believe { fill:${INK}; }
      .is-armed.is-colour .pd--believe { fill:var(--hue); }
      .is-armed .stat-num, .is-armed .stat-lab { opacity:0; transition:opacity .8s ease 1.2s; }
      .is-armed.is-on .stat-num, .is-armed.is-on .stat-lab { opacity:1; }
      .is-armed .tw { opacity:.12; transition:opacity .45s ease; transition-delay:calc(var(--i) * 70ms); }
      .is-armed.is-twelve .tw { opacity:1; }
    }`;
  const js = `
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;
  function below(el) { return el.getBoundingClientRect().top > window.innerHeight * 0.9; }
  function once(el, fn) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); fn(); }
    }, { threshold: 0.45 });
    io.observe(el);
  }
  var people = document.querySelector('[data-motion="people"]');
  if (people && below(people)) {
    people.classList.add('is-armed');
    once(people, function () {
      people.classList.add('is-on');
      setTimeout(function () { people.classList.add('is-colour'); }, 1700);
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
  var canvas, ctx, geo, level = 0, from = 0, to = 0, t0 = 0, raf = 0, shown = alive[3];
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
    (function tick(now) {
      var u = Math.min(1, (now - t0) / ms), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      level = from + (to - from) * e; draw(level);
      if (u < 1) raf = requestAnimationFrame(tick);
      else { press(Math.round(level)); if (Math.round(level) === 3) fig.classList.add('is-twelve'); }
    })(t0);
  }
  if (!below(fig)) return;
  fig.classList.add('is-armed');
  once(fig, function () {
    if (!setup()) return;
    frame.classList.add('is-live'); level = 0; draw(0); press(0);
    setTimeout(function () { run(1, 1500); }, 700);
    setTimeout(function () { run(2, 1100); }, 2500);
    setTimeout(function () { run(3, 1500); }, 3900);
  });
  buttons.forEach(function (b, q) {
    b.addEventListener('click', function () {
      if (!canvas && !setup()) return;
      frame.classList.add('is-live'); fig.classList.add('is-armed');
      if (q < 3) fig.classList.remove('is-twelve');
      run(q, 900 * Math.max(1, Math.abs(q - level)));
    });
  });
  var rt; window.addEventListener('resize', function () { if (!canvas) return; clearTimeout(rt); rt = setTimeout(function () { setup(); draw(level); }, 120); });
})();`;
  return `<style data-thesis-figures>${css}\n  </style>\n  <script data-thesis-figures>${js}\n  </script>`;
}

export function stampCharts(page, data) {
  let next = stamp(stamp(page, 'know', knowFigure(data)), 'lifespan', lifespanFigure(data));
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
