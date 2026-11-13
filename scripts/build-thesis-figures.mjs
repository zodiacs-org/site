/**
 * The thesis season figure (F2): each sign's English Wikipedia article on a
 * typical day of the year, 2016 to 2025, compared with that sign's own typical
 * day, drawn as twelve ridgelines from January to December.
 *
 *   node scripts/build-thesis-figures.mjs            restamp F2 from public/thesis/thesis-seasons.json
 *   node scripts/build-thesis-figures.mjs --reduce   rebuild thesis-seasons.json from the raw
 *     per-sign pageviews in docs/thesis-evidence (newest wikimedia-per-sign.json), then restamp
 *   node scripts/build-thesis-figures.mjs --check    exit 1 if the reduction or the stamp drifts
 *
 * The raw file comes from scripts/fetch-thesis-seasons.mjs (run by the "Thesis
 * season snapshot" workflow; the workspace that edits the site cannot reach
 * Wikimedia). Seasons are the Sun's real sign entries for each year, solved
 * with astronomy-engine, not fixed calendar dates. The figure between the
 * thesis-attention-figure markers is generated output; edit this script or the
 * data, never the markup.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import './lib/deltat-install.mjs';
import * as Astronomy from 'astronomy-engine';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = resolve(root, 'public/thesis/index.html');
const dataPath = resolve(root, 'public/thesis/thesis-seasons.json');

const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const HUES = ['#DE8E79', '#B9D4BE', '#B29DD0', '#B6D4E4', '#E0A9B4', '#B7D9B0', '#D3A9DE', '#B9DCE8', '#E0B080', '#C0DEA8', '#AE8FC9', '#A9D4C4'];
/** Rows from the top, in the order their seasons arrive from 1 January. */
const ROW_ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const YEARS = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const BIN = 5;
const BINS = 73; // 365 days in five-day bins
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const DAY = 86_400_000;

async function rawPath() {
  const dir = resolve(root, 'docs/thesis-evidence');
  const dated = (await readdir(dir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().reverse();
  for (const d of dated) {
    const files = await readdir(resolve(dir, d));
    if (files.includes('wikimedia-per-sign.json')) return { path: resolve(dir, d, 'wikimedia-per-sign.json'), rel: `docs/thesis-evidence/${d}/wikimedia-per-sign.json` };
  }
  throw new Error('no docs/thesis-evidence/<date>/wikimedia-per-sign.json');
}

/** The sign the Sun is in at noon UTC on each day, from its solved sign entries. */
function seasonOf(fromMs, toMs) {
  const entries = [];
  let t = new Date(fromMs - 40 * DAY);
  while (t.getTime() < toMs + 40 * DAY) {
    const lon = Astronomy.SunPosition(t).elon;
    const next = (Math.floor(lon / 30) + 1) % 12;
    const hit = Astronomy.SearchSunLongitude(next * 30, t, 40);
    entries.push({ at: hit.date.getTime(), sign: next });
    t = new Date(hit.date.getTime() + DAY);
  }
  return (ms) => {
    let sign = null;
    for (const e of entries) if (e.at <= ms) sign = e.sign;
    return sign;
  };
}

export async function reduce() {
  const { path, rel } = await rawPath();
  const body = await readFile(path);
  const raw = JSON.parse(body.toString('utf8'));
  const startMs = Date.UTC(+raw.from.slice(0, 4), +raw.from.slice(4, 6) - 1, +raw.from.slice(6, 8));
  const sunSign = seasonOf(Date.UTC(YEARS[0], 0, 1), Date.UTC(YEARS.at(-1), 11, 31));
  const signs = [];
  let signYears = 0;
  let liftedYears = 0;
  for (let s = 0; s < 12; s++) {
    const views = raw.signs[SIGNS[s]].views;
    const byDoy = Array.from({ length: 365 }, () => []);
    const inSeason = [];
    const outSeason = [];
    let lifted = 0;
    for (const year of YEARS) {
      const days = [];
      for (let ms = Date.UTC(year, 0, 1); ms < Date.UTC(year + 1, 0, 1); ms += DAY) {
        const v = views[Math.round((ms - startMs) / DAY)];
        if (v == null) continue;
        days.push({ ms, v });
      }
      const typical = median(days.map((d) => d.v));
      const yin = [];
      const yout = [];
      for (const { ms, v } of days) {
        const r = v / typical;
        const date = new Date(ms);
        if (!(date.getUTCMonth() === 1 && date.getUTCDate() === 29)) {
          const doy = Math.round((ms - Date.UTC(year, 0, 1)) / DAY) - (year % 4 === 0 && date.getUTCMonth() > 1 ? 1 : 0);
          byDoy[doy].push(r);
        }
        (sunSign(ms + DAY / 2) === s ? inSeason : outSeason).push(r);
        (sunSign(ms + DAY / 2) === s ? yin : yout).push(v);
      }
      signYears += 1;
      if (median(yin) > median(yout)) { lifted += 1; liftedYears += 1; }
    }
    const daily = byDoy.map(median);
    const curve = Array.from({ length: BINS }, (_, b) => Math.round(mean(daily.slice(b * BIN, b * BIN + BIN)) * 100) / 100);
    signs.push({
      sign: SIGNS[s],
      lift: Math.round((mean(inSeason) / mean(outSeason) - 1) * 100),
      yearsLifted: lifted,
      curve,
    });
  }
  // Season spans on the figure's own axis (day of a 365-day year), from 2025's sign entries.
  const ref = seasonOf(Date.UTC(2025, 0, 1), Date.UTC(2025, 11, 31));
  const spans = Array.from({ length: 12 }, () => []);
  for (let d = 0; d < 365; d++) spans[ref(Date.UTC(2025, 0, 1) + d * DAY + DAY / 2)].push(d);
  signs.forEach((entry, s) => {
    const days = spans[s];
    const wraps = days.includes(0) && days.includes(364);
    entry.season = wraps
      ? [[days.find((d, i) => i > 0 && d - days[i - 1] > 1), 365], [0, days.find((d, i) => days[i + 1] !== d + 1) + 1]]
      : [[days[0], days.at(-1) + 1]];
  });
  const lifts = signs.map((x) => x.lift);
  const totalReads = SIGNS.reduce((sum, key) => sum + raw.signs[key].views.reduce((n, v) => n + (v ?? 0), 0), 0);
  return {
    $comment: 'Reduced from the raw per-sign pageviews named in `raw` by scripts/build-thesis-figures.mjs --reduce. Each curve is one sign article on a typical day of the year (median across the years of views divided by that sign-year median day), in 73 five-day bins from 1 January. lift compares the mean of that ratio inside the sign\'s own season with the rest of the year; seasons are the Sun\'s solved sign entries each year (astronomy-engine), taken at noon UTC.',
    source: raw.source,
    raw: { path: rel, sha256: createHash('sha256').update(body).digest('hex'), fetchedAt: raw.fetchedAt.slice(0, 10) },
    years: [YEARS[0], YEARS.at(-1)],
    bin: BIN,
    signYears,
    liftedYears,
    liftRange: [Math.min(...lifts), Math.max(...lifts)],
    reads: { total: totalReads, from: raw.from, to: raw.to },
    signs,
  };
}

const MONTH_START = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const fmt = (n) => (Math.round(n * 10) / 10).toString();
// A polyline in tenths: an absolute start, then relative steps. Each step is
// the difference of two rounded points, so the drawn line is exactly the one
// absolute coordinates would draw, in about half the bytes of the page.
const tenths = (n) => Math.round(n * 10);
const num = (t) => (t / 10).toString();
function poly(points) {
  let [px, py] = points[0].map(tenths);
  let d = `M${num(px)} ${num(py)}l`;
  points.slice(1).forEach(([x, y], i) => {
    const tx = tenths(x), ty = tenths(y);
    const dx = num(tx - px), dy = num(ty - py);
    d += (i ? (dx.startsWith('-') ? '' : ' ') : '') + dx + (dy.startsWith('-') ? '' : ' ') + dy;
    px = tx; py = ty;
  });
  return d;
}

function mix(hex, amount) {
  const base = [15, 18, 26]; // --surface #0F121A
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${c.map((v, i) => Math.round(base[i] + (v - base[i]) * amount).toString(16).padStart(2, '0')).join('')}`;
}

function render(data, small) {
  const W = small ? 320 : 920;
  const x0 = small ? 74 : 118;
  const x1 = small ? 270 : 836;
  const rowGap = small ? 25 : 31;
  const ridge = small ? 42 : 58;
  const top = small ? 62 : 84;
  const floor = 0.6;
  const ceil = Math.max(...data.signs.flatMap((s) => s.curve));
  const H = top + rowGap * 11 + (small ? 34 : 40);
  const xOf = (day) => x0 + (day / 365) * (x1 - x0);
  const yOf = (base, r) => base - Math.max(0, (r - floor) / (ceil - floor)) * ridge;
  let s = `<desc>Twelve ridgelines, one per sign, from January at the left to December at the right. Each rises when its article is read more than on its own typical day. Each sign's line peaks in its own season.</desc>`;
  for (let m = 0; m < 12; m++) {
    const x = fmt(xOf(MONTH_START[m]));
    s += `<line x1="${x}" y1="${top - ridge + 6}" x2="${x}" y2="${top + rowGap * 11 + 6}" stroke="rgba(198,204,218,0.07)"/>`;
    if (!small || m % 2 === 0) s += `<text x="${fmt(xOf(MONTH_START[m]) + 3)}" y="${H - 8}" class="season-month">${MONTHS[m]}</text>`;
  }
  ROW_ORDER.forEach((si, row) => {
    const sign = data.signs[si];
    const base = top + row * rowGap;
    const pts = sign.curve.map((r, b) => [xOf(b * BIN + BIN / 2), yOf(base, r)]);
    const line = poly([[x0, pts[0][1]], ...pts, [x1, pts.at(-1)[1]]]);
    const area = `${line}V${base}H${fmt(x0)}Z`;
    const hue = HUES[si];
    let hot = '';
    for (const [a, b] of sign.season) {
      const seg = pts.filter(([x]) => x >= xOf(a) - 0.01 && x <= xOf(b) + 0.01);
      if (seg.length < 2) continue;
      hot += poly(seg);
    }
    s += `<g class="ridge" data-sign="${sign.sign}" data-lift="${sign.lift}" style="--r:${row}" tabindex="0" role="button" aria-label="${NAMES[si]}: read ${sign.lift}% more in its own season">`
      + `<path d="${area}" fill="${mix(hue, 0.16)}"/>`
      + `<path d="${line}" fill="none" stroke="${hue}" stroke-opacity="0.5" stroke-width="1.1"/>`
      + `<path class="ridge-hot" d="${hot}" fill="none" stroke="${hue}" stroke-width="${small ? 2 : 2.4}" stroke-linecap="round"/>`
      + `<text x="${x0 - 10}" y="${base - 3}" text-anchor="end" class="season-name">${NAMES[si]}</text>`
      + `<text x="${x1 + 10}" y="${base - 3}" class="season-lift" fill="${hue}">+${sign.lift}%</text>`
      + '</g>';
  });
  s += `<g class="season-today is-off" data-today><line y1="${top - ridge}" y2="${top + rowGap * 11 + 6}" stroke="#EEF1F7" stroke-opacity="0.55" stroke-dasharray="2 3"/><text y="${top - ridge - 6}" text-anchor="middle" class="season-month">Today</text></g>`;
  const label = `Ridgeline chart of English Wikipedia reads for the twelve sign articles, ${data.years[0]} to ${data.years[1]}. Every sign is read more in its own season, from ${data.liftRange[0]}% more to ${data.liftRange[1]}% more than in the rest of the year.`;
  return `<svg class="attention-chart--${small ? 'small' : 'wide'} season-chart" data-attention-chart data-x0="${x0}" data-x1="${x1}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${s}</svg>`;
}

export function seasonFigure(data) {
  const [a, b] = data.liftRange;
  // The caption names no top or bottom sign (owner, 2026-11-13): which sign
  // gains most depends on how the lift is measured.
  return `<figure class="zfig thesis-plate thesis-seasons" id="fig-2" data-motion="seasons">
            <figcaption class="zfig-head">Each sign is looked up most in its own season.</figcaption>
            <p class="season-readout" data-season-readout aria-live="polite">Every sign is read ${a}% to ${b}% more while the Sun is in it.</p>
            ${render(data, false)}
            ${render(data, true)}
            <p class="zfig-cap">Each line is one sign’s English Wikipedia article on a typical day of the year, ${data.years[0]} to ${data.years[1]}, against that sign’s own typical day. The bright stretch is the sign’s season. The lift shows in ${data.liftedYears} of ${data.signYears} sign-years. This measures curiosity, not demand for the coins.</p>
            <p class="zfig-src">Wikimedia pageviews, user traffic, each sign article on its own, fetched ${data.raw.fetchedAt} · <a href="/thesis/thesis-seasons.json">reduced data</a> · seasons from the Sun’s computed sign entries each year.</p>
          </figure>`;
}

export function seasonMotion() {
  return `
  <style data-thesis-seasons>
    .thesis-seasons { padding:20px; border:1px solid var(--hair); border-radius:14px; }
    .thesis-seasons .zfig-head { margin-bottom:8px; }
    .season-readout { margin:0 0 10px; min-height:3.3em; font-family:'Instrument Sans',system-ui,sans-serif; font-size:15px; line-height:1.6; color:var(--ink-2); }
    .thesis-seasons svg.season-chart { display:block; width:100%; height:auto; }
    .thesis-seasons svg.attention-chart--small { display:none; }
    .thesis-seasons .zfig-cap { max-width:68ch; font-family:'Instrument Sans',system-ui,sans-serif; font-style:normal; font-size:14px; line-height:1.65; color:var(--ink-2); }
    .thesis-seasons .zfig-src { max-width:none; font-size:11px; line-height:1.6; color:var(--ink-dim); }
    .season-chart text.season-name { font-family:'Instrument Sans',system-ui,sans-serif; font-size:14px; fill:var(--ink-2); }
    .season-chart text.season-lift { font-family:var(--mono); font-size:13px; }
    .season-chart text.season-month { font-family:var(--mono); font-size:11px; fill:var(--ink-dim); }
    .season-chart .season-today.is-off { display:none; }
    .season-chart .ridge { cursor:pointer; outline:none; transition:opacity .35s ease; }
    .season-chart.has-focus .ridge { opacity:.22; }
    .season-chart.has-focus .ridge.is-focus { opacity:1; }
    .season-chart .ridge:focus-visible text.season-name { text-decoration:underline; }
    .thesis-seasons svg.attention-chart--small text.season-name { font-size:11.5px; }
    .thesis-seasons svg.attention-chart--small text.season-lift { font-size:11px; }
    .thesis-seasons svg.attention-chart--small text.season-month { font-size:10px; }
    @media (max-width:599px) { .season-readout { min-height:4.9em; } }
    @media (max-width:413px) { .season-readout { min-height:6.5em; } }
    @media (max-width:739px) {
      .thesis-seasons svg.attention-chart--wide { display:none; }
      .thesis-seasons svg.attention-chart--small { display:block; }
    }
    @media (prefers-reduced-motion:no-preference) {
      .is-armed .season-chart .ridge { opacity:0; transition:opacity .6s ease; transition-delay:calc(var(--r) * 110ms); }
      .is-armed.is-on .season-chart .ridge { opacity:1; }
      .is-armed .ridge-hot { stroke-dasharray:400; stroke-dashoffset:400; transition:stroke-dashoffset 1.1s ease; transition-delay:calc(var(--r) * 110ms + 500ms); }
      .is-armed.is-on .ridge-hot { stroke-dashoffset:0; }
    }
  </style>
  <script data-thesis-seasons>
(function () {
  var fig = document.querySelector('[data-motion="seasons"]');
  if (!fig) return;
  var readout = fig.querySelector('[data-season-readout]');
  var names = { aries: 'Aries', taurus: 'Taurus', gemini: 'Gemini', cancer: 'Cancer', leo: 'Leo', virgo: 'Virgo', libra: 'Libra', scorpio: 'Scorpio', sagittarius: 'Sagittarius', capricorn: 'Capricorn', aquarius: 'Aquarius', pisces: 'Pisces' };
  var entries = ${JSON.stringify(SUN_ENTRIES)};
  var now = Date.now(), current = null;
  for (var i = 0; i < entries.length; i++) if (Date.parse(entries[i][0]) <= now) current = entries[i][1];
  var start = Date.UTC(new Date(now).getUTCFullYear(), 0, 1);
  var doy = Math.min(364, Math.floor((now - start) / 86400000));
  [].forEach.call(fig.querySelectorAll('svg.season-chart'), function (svg) {
    var x0 = +svg.getAttribute('data-x0'), x1 = +svg.getAttribute('data-x1'), x = x0 + (doy + 0.5) / 365 * (x1 - x0);
    var today = svg.querySelector('[data-today]');
    if (today && current) {
      today.querySelector('line').setAttribute('x1', x); today.querySelector('line').setAttribute('x2', x);
      today.querySelector('text').setAttribute('x', x); today.classList.remove('is-off');
    }
  });
  function focus(sign, said) {
    [].forEach.call(fig.querySelectorAll('svg.season-chart'), function (svg) {
      svg.classList.toggle('has-focus', !!sign);
      [].forEach.call(svg.querySelectorAll('.ridge'), function (g) { g.classList.toggle('is-focus', g.getAttribute('data-sign') === sign); });
    });
    if (!sign) return;
    var g = fig.querySelector('.ridge[data-sign="' + sign + '"]');
    readout.textContent = said + names[sign] + '\\u2019s article is read ' + g.getAttribute('data-lift') + '% more in its own season than in the rest of the year.';
  }
  [].forEach.call(fig.querySelectorAll('.ridge'), function (g) {
    function pick() { var s = g.getAttribute('data-sign'); focus(fig.getAttribute('data-picked') === s ? null : s, ''); fig.setAttribute('data-picked', fig.getAttribute('data-picked') === s ? '' : s); }
    g.addEventListener('click', pick);
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  function picked() { return document.documentElement.dataset.mySign || ''; }
  function settle() { var mine = picked(); if (mine) { focus(mine, ''); return; } if (current) focus(current, 'Today the Sun is in ' + names[current] + '. '); }
  document.addEventListener('thesis:sign', function (e) { fig.setAttribute('data-picked', e.detail.sign || ''); if (e.detail.sign) focus(e.detail.sign, ''); else { focus(null, ''); settle(); } });
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window) || fig.getBoundingClientRect().top < window.innerHeight * 0.9) { settle(); return; }
  fig.classList.add('is-armed');
  var io = new IntersectionObserver(function (es) {
    if (!es[0].isIntersecting) return;
    io.disconnect(); fig.classList.add('is-on');
    setTimeout(settle, 2600);
  }, { threshold: 0.35 });
  io.observe(fig);
})();
  </script>`;
}

/** Sun sign entries for the page's "today" line, 2026 to 2040, from src/data/sun-ingresses.json. */
let SUN_ENTRIES = [];

export async function stampSeasons(page, data) {
  const sun = JSON.parse(await readFile(resolve(root, 'src/data/sun-ingresses.json'), 'utf8'));
  SUN_ENTRIES = sun.windows.map((w) => [w.from.slice(0, 16) + 'Z', w.sign]);
  const begin = '<!-- thesis-attention-figure:begin -->';
  const end = '<!-- thesis-attention-figure:end -->';
  const a = page.indexOf(begin);
  const b = page.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error('thesis-attention-figure markers not found in public/thesis/index.html');
  let next = `${page.slice(0, a + begin.length)}\n          ${seasonFigure(data)}\n          ${page.slice(b)}`;
  const mb = '<!-- thesis-seasons-motion:begin -->';
  const me = '<!-- thesis-seasons-motion:end -->';
  const c = next.indexOf(mb);
  const d = next.indexOf(me);
  if (c === -1 || d === -1) throw new Error('thesis-seasons-motion markers not found in public/thesis/index.html');
  next = `${next.slice(0, c + mb.length)}${seasonMotion()}\n${next.slice(d)}`;
  return next;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const reduced = await reduce();
  const reducedText = `${JSON.stringify(reduced, null, 1)}\n`;
  if (args.has('--check')) {
    const stored = await readFile(dataPath, 'utf8');
    const page = await readFile(pagePath, 'utf8');
    const next = await stampSeasons(page, JSON.parse(stored));
    if (stored !== reducedText) { console.error('thesis seasons: thesis-seasons.json differs from the raw evidence. Run node scripts/build-thesis-figures.mjs --reduce'); process.exit(1); }
    if (next !== page) { console.error('thesis seasons: the stamped figure differs from thesis-seasons.json. Run node scripts/build-thesis-figures.mjs'); process.exit(1); }
    console.log('thesis seasons: data and figure match the raw evidence');
    return;
  }
  if (args.has('--reduce')) await writeFile(dataPath, reducedText);
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  const page = await readFile(pagePath, 'utf8');
  const next = await stampSeasons(page, data);
  if (next !== page) await writeFile(pagePath, next);
  console.log(next === page ? 'thesis seasons: unchanged' : 'thesis seasons: stamped');
  const lifts = data.signs.map((x) => `${x.sign} +${x.lift}% (${x.yearsLifted}/10)`).join(', ');
  console.log(lifts);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
