#!/usr/bin/env node
// Weekly AI crawler counts from Vercel's own request logs, as a Markdown table.
//
// Read-only and counts only. Vercel observability already labels each request
// with a `bot_name`; this script never sees a user agent or an IP address, and
// refuses input that carries one. It turns rows that were already aggregated
// (bot label, request path, count) into one table per path family, plus the
// share of requests to machine-only paths that Vercel did not label as a bot.
//
// There is no Vercel credential in this repository, and none is needed here.
// Run the query outside the repo (the Vercel dashboard's Observability query
// builder, or the read-only `create_observability_query` tool of the Vercel
// connector), save the rows as JSON, then:
//
//   node scripts/visibility/crawler-counts.mjs --print-query --from 2026-11-16 --to 2026-11-22
//   node scripts/visibility/crawler-counts.mjs --counts rows.json --from 2026-11-16 --to 2026-11-22 [--out table.md]
//
// rows.json is either an array of rows or an object with a `rows` array. Each
// row has a bot label (`bot_name` or `botName`), a path (`request_path`,
// `requestPath`, `path` or `route`) and a count (`count`, `value` or `sum`).
// Rows without a path count towards the bot totals only.
//
// No log drain, Firewall rule, Web Analytics switch or plan change is involved.
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PROJECT_ID = 'prj_nRTO3q3aNYLfaM3dotAowOc028fO';
export const TIME_ZONE = 'Asia/Bangkok';

/** The bots the weekly table names, in order, with the labels Vercel may log for each. */
export const NAMED_BOTS = [
  ['ClaudeBot', ['claudebot']],
  ['Claude-SearchBot', ['claude-searchbot']],
  ['Claude-User', ['claude-user']],
  ['GPTBot', ['gptbot']],
  ['OAI-SearchBot', ['oai-searchbot']],
  ['ChatGPT-User', ['chatgpt-user']],
  ['PerplexityBot', ['perplexitybot', 'perplexity-user']],
  ['Google-Extended', ['google-extended']],
  ['Bytespider', ['bytespider']],
  ['Meta', ['meta-externalagent', 'meta-externalfetcher', 'facebookexternalhit', 'facebookbot', 'meta']],
  ['Amazonbot', ['amazonbot']],
  ['Applebot', ['applebot', 'applebot-extended']],
  ['Googlebot', ['googlebot']],
  ['Bingbot', ['bingbot']],
];
export const UNLABELLED = 'Unlabelled (no bot_name)';
export const OTHER_LABELLED = 'Other labelled bots';

export const FAMILIES = ['calculators', 'learn', 'horoscopes', 'events', 'llms', 'md', 'mcp', 'other'];

const LOCALE_PREFIX = /^\/(?:es|pt|fr|it|ru|zh-hans|zh-hant)(?=\/)/u;
const CALCULATORS = /^\/(?:birth-chart|compatibility\/?$|compatibility\/invite|moon-sign|rising-sign|saturn-return|solar-return|lunar-return|transits|moon-phase|numerology|big-three|chart-twins|group-charts|good-days|year-score|astrologer-kit|your-sky-wrapped|your-2027-sky|chinese-zodiac|tools)(?:\/|$)/u;
const HOROSCOPES = /^\/(?:horoscopes?|today|tomorrow)(?:\/|$)/u;
const EVENTS = /^\/(?:events|mercury-retrograde|retrogrades|full-moon-calendar|new-moon-calendar|eclipses|sky-calendar|seasons|ingresses|feeds)(?:[/.-]|$)/u;
const LEARN = /^\/(?:learn|aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|compatibility|birthdays?|people|methodology|about|privacy|glossary|placements)(?:\/|$)/u;

/** The path family a request path belongs to. Query strings and fragments are ignored. */
export function pathFamily(rawPath) {
  const path = String(rawPath ?? '').split(/[?#]/u)[0] || '/';
  if (/^\/(?:api\/v1\/)?llms(?:-full)?\.txt$/u.test(path)) return 'llms';
  if (/\.md$/u.test(path)) return 'md';
  if (/^\/mcp(?:\/|$)/u.test(path)) return 'mcp';
  const bare = path.replace(LOCALE_PREFIX, '');
  if (CALCULATORS.test(bare)) return 'calculators';
  if (HOROSCOPES.test(bare)) return 'horoscopes';
  if (EVENTS.test(bare)) return 'events';
  if (LEARN.test(bare)) return 'learn';
  return 'other';
}

/** Requests to these come almost only from programs, so an unlabelled share there estimates disguised agents. */
export const isMachineOnlyPath = (path) => ['llms', 'md'].includes(pathFamily(path)) && !String(path).startsWith('/api/');

const clean = (label) => String(label ?? '').trim().toLowerCase().replace(/[\s_]+/gu, '-');

/** The table row a Vercel bot label counts under. */
export function botRow(label) {
  const key = clean(label);
  if (!key || key === 'null' || key === 'none' || key === '(empty)') return UNLABELLED;
  for (const [name, labels] of NAMED_BOTS) if (labels.includes(key) || clean(name) === key) return name;
  return OTHER_LABELLED;
}

const FORBIDDEN_KEY = /(?:user[-_]?agent|^ua$|^ip$|ip[-_]?address|client[-_]?ip|x-forwarded-for|header)/iu;
const pick = (row, keys) => keys.map((key) => row[key]).find((value) => value !== undefined);

/** Validated rows: a bot label, a path or null, a whole count. Throws on anything that looks like a user agent or IP. */
export function normaliseRows(input) {
  const rows = Array.isArray(input) ? input : input?.rows ?? input?.data;
  if (!Array.isArray(rows)) throw new Error('Expected an array of rows, or an object with a rows array.');
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object') throw new Error(`Row ${index} is not an object.`);
    const forbidden = Object.keys(row).find((key) => FORBIDDEN_KEY.test(key));
    if (forbidden) throw new Error(`Row ${index} carries "${forbidden}". Only counts by bot label and path are accepted; drop user agents and IPs before saving.`);
    const count = Number(pick(row, ['count', 'value', 'sum', 'requests']));
    if (!Number.isFinite(count) || count < 0) throw new Error(`Row ${index} has no usable count.`);
    const path = pick(row, ['request_path', 'requestPath', 'path', 'route']);
    return { bot: botRow(pick(row, ['bot_name', 'botName', 'bot'])), path: path == null ? null : String(path).split(/[?#]/u)[0], count: Math.round(count) };
  });
}

/** Totals per bot row and per family, and the unlabelled share on machine-only paths. */
export function summarise(rows) {
  const rowNames = [...NAMED_BOTS.map(([name]) => name), OTHER_LABELLED, UNLABELLED];
  const table = new Map(rowNames.map((name) => [name, { total: 0, byFamily: Object.fromEntries(FAMILIES.map((family) => [family, 0])) }]));
  let pathCounted = false;
  const machine = { all: 0, unlabelled: 0, byPath: new Map() };
  for (const { bot, path, count } of rows) {
    const entry = table.get(bot);
    entry.total += count;
    if (path === null) continue;
    pathCounted = true;
    entry.byFamily[pathFamily(path)] += count;
    if (isMachineOnlyPath(path)) {
      machine.all += count;
      if (bot === UNLABELLED) machine.unlabelled += count;
      const slot = machine.byPath.get(path) ?? { all: 0, unlabelled: 0 };
      slot.all += count;
      if (bot === UNLABELLED) slot.unlabelled += count;
      machine.byPath.set(path, slot);
    }
  }
  return { table, pathCounted, machine };
}

const fmt = (n) => n.toLocaleString('en-US');
const pct = (part, whole) => (whole ? `${((part / whole) * 100).toFixed(1)}%` : 'n/a');

/** The weekly table, in Markdown. */
export function renderTable({ table, pathCounted, machine }, { from, to, source = 'Vercel observability, vercel.request.count' } = {}) {
  const lines = [
    `# AI crawler counts, ${from} to ${to} (${TIME_ZONE} days)`,
    '',
    `Source: ${source}, project \`${PROJECT_ID}\`. Counts only; no user agent or IP address was read or stored.`,
    '',
  ];
  const head = pathCounted ? ['Bot', 'Total', ...FAMILIES] : ['Bot', 'Total'];
  lines.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`);
  for (const [name, entry] of table) {
    const cells = [name, fmt(entry.total), ...(pathCounted ? FAMILIES.map((family) => fmt(entry.byFamily[family])) : [])];
    lines.push(`| ${cells.join(' | ')} |`);
  }
  lines.push('');
  if (pathCounted) {
    lines.push(
      '## Unlabelled share on machine-only paths',
      '',
      `Requests to /llms.txt, /llms-full.txt and the .md twins that Vercel did not label as a bot: ${fmt(machine.unlabelled)} of ${fmt(machine.all)} (${pct(machine.unlabelled, machine.all)}). People rarely open these files, so this share estimates agents that do not name themselves. It is an estimate, not a count of disguised bots.`,
      '',
      '| Path | Requests | Unlabelled | Share |',
      '| --- | ---: | ---: | ---: |',
      ...[...machine.byPath].sort((a, b) => b[1].all - a[1].all).map(([path, slot]) => `| ${path} | ${fmt(slot.all)} | ${fmt(slot.unlabelled)} | ${pct(slot.unlabelled, slot.all)} |`),
      '',
    );
  } else {
    lines.push('Path families and the unlabelled share need the second query (grouped by bot label and path).', '');
  }
  lines.push('Families: calculators, learn (sign, pair and learn pages, methodology, about, privacy), horoscopes (and Today), events (sky calendars, retrogrades, eclipses, seasons, feeds), llms (llms.txt files), md (Markdown twins), mcp, other.');
  return `${lines.join('\n')}\n`;
}

/** Bangkok calendar days as UTC instants: from 00:00 on the first day to 00:00 after the last. */
export function bangkokWindow(from, to) {
  const start = new Date(`${from}T00:00:00+07:00`);
  const end = new Date(`${to}T00:00:00+07:00`);
  end.setUTCDate(end.getUTCDate() + 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new Error('Give --from and --to as YYYY-MM-DD, from on or before to.');
  return { startTime: start.toISOString(), endTime: end.toISOString() };
}

/** The two read-only observability queries, as the request bodies the Vercel connector takes. */
export function querySpecs(from, to, pathDimension = 'request_path') {
  const window = bangkokWindow(from, to);
  const base = { metric: 'vercel.request.count', aggregation: 'sum', scope: { type: 'project', projectId: PROJECT_ID }, ...window };
  return [
    { purpose: 'Totals per bot label', ...base, groupBy: ['bot_name'], limit: 200 },
    { purpose: 'Bot label by path (families and the unlabelled share)', ...base, groupBy: ['bot_name', pathDimension], limit: 10000 },
  ];
}

function main(argv) {
  const opt = (key) => { const i = argv.indexOf(`--${key}`); return i >= 0 ? argv[i + 1] : undefined; };
  const from = opt('from');
  const to = opt('to');
  if (!from || !to) throw new Error('Give --from YYYY-MM-DD and --to YYYY-MM-DD (Asia/Bangkok days).');
  if (argv.includes('--print-query')) {
    process.stdout.write(`${JSON.stringify(querySpecs(from, to, opt('path-dimension')), null, 2)}\n`);
    return;
  }
  const file = opt('counts');
  if (!file) throw new Error('Give --counts rows.json, or --print-query.');
  const markdown = renderTable(summarise(normaliseRows(JSON.parse(readFileSync(file, 'utf8')))), { from, to });
  const out = opt('out');
  if (out) writeFileSync(out, markdown);
  else process.stdout.write(markdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
