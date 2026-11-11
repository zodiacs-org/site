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

const MUTED = 'rgba(198,204,218,0.46)';
const TRACK = 'rgba(198,204,218,0.10)';
const ACCENT = '#A9D4C4'; // the "Coin" step of the transmission strip

/** Bars as rows: label above, bar below, value at the bar's end. */
function barsSvg(rows, { small, label, description }) {
  const width = small ? 320 : 920;
  const barMax = small ? 236 : 760;
  const step = small ? 52 : 58;
  const barH = small ? 12 : 14;
  const top = small ? 16 : 20;
  const gap = small ? 10 : 12;
  let y = top;
  let body = `<desc>${esc(description)}</desc>`;
  rows.forEach((row, index) => {
    if (row.apart && index > 0) y += small ? 12 : 14;
    const barY = y + (small ? 8 : 10);
    const w = Math.max(2, (row.pct / 100) * barMax);
    body += `<text x="0" y="${y.toFixed(1)}" class="bar-lab">${esc(row.label)}</text>`;
    body += `<rect x="0" y="${barY}" width="${barMax}" height="${barH}" rx="${barH / 2}" fill="${TRACK}"/>`;
    body += `<rect x="0" y="${barY}" width="${w.toFixed(1)}" height="${barH}" rx="${barH / 2}" fill="${row.accent ? ACCENT : MUTED}"/>`;
    body += `<text x="${(w + gap).toFixed(1)}" y="${(barY + barH - 1).toFixed(1)}" class="bar-val">${esc(row.value)}</text>`;
    y += step;
  });
  const height = Math.round(y - step + (small ? 30 : 34));
  return `<svg class="bars-chart--${small ? 'small' : 'wide'}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(label)}">${body}</svg>`;
}

const pctText = (value) => `${Math.round(value)}%`;

export function knowFigure(data) {
  const k = data.know;
  const rows = [
    { label: 'Know their sign', pct: k.knowSignPct, value: pctText(k.knowSignPct) },
    { label: 'Say they believe in astrology', pct: k.believePct, value: pctText(k.believePct) },
  ];
  const [fy, fm] = k.fielded.split('-').map(Number);
  const when = `${MONTHS[fm - 1]} ${fy}`;
  const label = `Bar chart. ${k.knowSignPct}% of U.S. adults picked their own sign when shown the twelve. ${k.believePct}% said they believe in astrology. ${k.source}, ${when}.`;
  const description = 'Two bars on the same 0 to 100 scale, from one YouGov survey.';
  return `<figure class="zfig thesis-plate thesis-bars" id="fig-know">
            <figcaption class="zfig-head">Almost everyone knows their sign. Few say they believe.</figcaption>
            ${barsSvg(rows, { small: false, label, description })}
            ${barsSvg(rows, { small: true, label, description })}
            <p class="zfig-src"><a href="${esc(k.url)}" rel="noopener noreferrer">${esc(k.source)}</a>, U.S. adults, ${when}. Respondents were shown the twelve signs and asked to pick their own.</p>
          </figure>`;
}

function lessThanFive(value) {
  return value >= 4 && value < 5 ? 'under 5%' : pctText(value);
}

export function lifespanFigure(data) {
  const l = data.lifespan;
  const t = data.twelve;
  const afterOne = 100 - l.lastTradeOnCreationDayPct;
  const afterTwo = 100 - l.lastTradeByNextDayPct;
  const rows = [
    { label: 'Pump.fun coins trading after their first day', pct: afterOne, value: pctText(afterOne) },
    { label: 'Trading after their second day', pct: afterTwo, value: pctText(afterTwo) },
    { label: 'Trading after ninety days', pct: l.lasted90DaysPct, value: lessThanFive(l.lasted90DaysPct) },
  ];
  const millions = (l.sample / 1e6).toFixed(1);
  const checked = typeof t.tradedInWindow === 'number' && t.checkedAt;
  let twelveLabel = '';
  let twelveSource = '';
  if (checked) {
    const day = daysBetween(t.createdAt, t.checkedAt);
    rows.push({
      label: `The twelve zodiac coins, on day ${day}`,
      pct: (t.tradedInWindow / 12) * 100,
      value: `${t.tradedInWindow} of 12`,
      accent: true,
      apart: true,
    });
    const traded = t.tradedInWindow === 12 ? 'All twelve zodiac coins' : `${t.tradedInWindow} of the twelve zodiac coins`;
    twelveLabel = ` ${traded} traded in the ${t.windowDays} days before ${longDate(t.checkedAt)}, on day ${day} since they were made.`;
    twelveSource = ` The twelve were made on ${longDate(t.createdAt)}; each was checked for a trade in the ${t.windowDays} days before ${shortDate(t.checkedAt)} on the public ledger.`;
  }
  const label = `Bar chart. Of ${millions} million coins launched on Pump.fun, ${pctText(afterOne)} traded after their first day, ${pctText(afterTwo)} after their second day and ${lessThanFive(l.lasted90DaysPct)} after ninety days, according to ${l.source}.${twelveLabel}`;
  const description = `Bars on the same 0 to 100 scale. ${l.source} studied coins launched on Pump.fun between ${longDate(l.window[0])} and ${longDate(l.window[1])}.`;
  const caption = checked
    ? `Share of ${millions} million Pump.fun coins that were still trading, beside the twelve zodiac coins.`
    : `Share of ${millions} million Pump.fun coins that were still trading.`;
  const [uy, um, ud] = l.updated.split('-').map(Number);
  return `<figure class="zfig thesis-plate thesis-bars" id="fig-lifespan">
            <figcaption class="zfig-head">Most memecoins stop trading the day they are made.</figcaption>
            ${barsSvg(rows, { small: false, label, description })}
            ${barsSvg(rows, { small: true, label, description })}
            <p class="zfig-cap">${esc(caption)}</p>
            <p class="zfig-src"><a href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.source)}</a>, updated ${ud} ${MONTHS[um - 1]} ${uy}. ${esc(l.source)} counted trades on Pump.fun only, so a coin that moved to another exchange may have traded for longer.${esc(twelveSource)}</p>
          </figure>`;
}

function stamp(page, name, html) {
  const begin = `<!-- thesis-${name}-figure:begin -->`;
  const end = `<!-- thesis-${name}-figure:end -->`;
  const a = page.indexOf(begin);
  const b = page.indexOf(end);
  if (a === -1 || b === -1 || b < a) throw new Error(`thesis-${name}-figure markers not found in public/thesis/index.html`);
  return `${page.slice(0, a + begin.length)}\n          ${html}\n${page.slice(b)}`;
}

export function stampCharts(page, data) {
  return stamp(stamp(page, 'know', knowFigure(data)), 'lifespan', lifespanFigure(data));
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
