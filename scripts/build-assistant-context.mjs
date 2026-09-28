/*
 * Builds the cached site guide used by the assistant function.
 *
 * Run under vite-node because the glossary is a TypeScript data module:
 *   vite-node --script scripts/build-assistant-context.mjs
 *
 * The output is committed. It deliberately carries no build timestamp so a
 * second run over the same sources is byte-identical.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GLOSSARY } from '../src/data/glossary.ts';
import { CHINESE_ZODIAC_COPY } from '../src/data/chinese-zodiac.ts';
import { DEFAULT_LOCALE, LOCALES } from '../src/lib/i18n/core.ts';
import { EN } from '../src/strings/en.mjs';
import { WIDGET_EN } from '../src/strings/widgets.ts';
import { currentHoroscopeMonth, utcMonth } from '../src/lib/horoscope-month.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_OUTPUT = resolve(repo, 'api/_assistant/context.ts');

export const MIN_CONTEXT_BYTES = 30 * 1024;
export const MAX_CONTEXT_BYTES = 60 * 1024;

// These are the English tools and utilities that accept a date, chart, pair,
// or current-sky question. The generator verifies every route has a real page
// and takes its explanation from that page's meta description.
export const TOOL_ROUTES = Object.freeze([
  '/ask/',
  '/baby-zodiac/',
  '/birth-chart/',
  '/birthday/',
  '/compatibility/',
  '/eclipses/',
  '/full-moon-calendar/',
  '/lunar-return/',
  '/mercury-retrograde/',
  '/moon-phase/',
  '/moon-sign/',
  '/numerology/',
  '/profile/',
  '/retrogrades/',
  '/rising-sign/',
  '/saturn-return/',
  '/solar-return/',
  '/transits/',
  '/void-of-course-moon/',
  '/widgets/',
]);

export const BANNED_CONSUMER_VOCABULARY = Object.freeze([
  'astrofolio',
  'coin',
  'crypto',
  'cryptocurrency',
  'fomo',
  'investment',
  'investor',
  'market',
  'mint',
  'price',
  'registry',
  'sale',
  'token',
  'terminal',
  'trade',
  'trading',
  'wallet',
]);

const COLLAPSE = /\s+/g;
// The assistant inventory is English-only. Exclude every declared locale,
// including staged noindex trees such as /ru/, so preview pages can never
// change the committed English context or its route counts.
const LOCALIZED_PAGE_PREFIXES = LOCALES
  .filter((locale) => locale !== DEFAULT_LOCALE)
  .map((locale) => `${locale}/`);
// Reachable does not mean recommendable. Keep the reviewed People pilot and
// every Astrofolio/Fomo/Registry/Terminal route out of the consumer astrology
// catalog, along with the experimental precision preview: it is noindex, it is
// not the engine behind any chart on this site, and an assistant pointing a
// visitor at it would be pointing them at a research surface.
const UNLISTED_ROUTE_PREFIXES = Object.freeze([
  '/astrofolio/',
  '/bio/',
  '/developers/precision-preview/',
  '/disclosure/',
  '/feeds/market-research',
  '/fomo/',
  '/people/',
  '/registry/',
  '/terminal/',
]);

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clean(value) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&mdash;', '—')
    .replaceAll('&ndash;', '–')
    .replaceAll('&rsquo;', '’')
    .replaceAll('&lsquo;', '‘')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(COLLAPSE, ' ')
    .trim();
}

async function filesUnder(root, extension = '') {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesUnder(path, extension));
    else if (!extension || extname(entry.name) === extension) output.push(path);
  }
  return output.sort();
}

export function frontmatterField(source, field, sourceName = 'content entry') {
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) throw new Error(`Missing frontmatter in ${sourceName}`);
  const match = frontmatter.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
  if (!match) throw new Error(`Missing ${field} in ${sourceName}`);
  const raw = match[1].trim();

  if (raw.startsWith('"') && raw.endsWith('"')) return JSON.parse(raw);
  if (raw.startsWith("'") && raw.endsWith("'")) {
    return raw.slice(1, -1).replaceAll("''", "'");
  }
  return raw;
}

function pagePath(file, pagesRoot) {
  const local = relative(pagesRoot, file).replaceAll('\\', '/');
  if (local === 'index.astro') return '/';
  if (local.endsWith('/index.astro')) return `/${local.slice(0, -'index.astro'.length)}`;
  return `/${local.slice(0, -'.astro'.length)}/`;
}

function zodiacDatesDescription(ingresses) {
  const currentYear = Number(ingresses.generatedAt.slice(0, 4));
  if (!Number.isInteger(currentYear)) throw new Error('Invalid ingress generatedAt year');
  return `The twelve tropical zodiac signs in one table: exact longitude ranges, correspondences, hemisphere seasons, and year-exact Sun ingress instants for ${currentYear} and ${currentYear + 1}.`;
}

function monthLabel(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Invalid horoscope month: ${month}`);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function signName(sign) {
  return `${sign[0].toUpperCase()}${sign.slice(1)}`;
}

function staticDescription(route, source, { ingresses, latestHoroscopeMonth }) {
  const literal = source.match(/<Base\b[\s\S]*?\bdescription="([^"]+)"/i)?.[1];
  if (literal) return clean(literal);

  const catalogKey = source.match(/<Base\b[\s\S]*?\bdescription=\{EN\[['"]([^'"]+)['"]\]\}/i)?.[1];
  if (catalogKey && EN[catalogKey]) return clean(EN[catalogKey]);

  if (source.includes('<LocalizedDisclosurePage locale="en"')) {
    return clean(EN['disclosure.metaDescription']);
  }

  const chineseCatalogKey = source.match(/<Base\b[\s\S]*?\bdescription=\{CHINESE_ZODIAC_COPY\.([a-zA-Z0-9_]+)\}/i)?.[1];
  if (chineseCatalogKey && CHINESE_ZODIAC_COPY[chineseCatalogKey]) {
    return clean(CHINESE_ZODIAC_COPY[chineseCatalogKey]);
  }

  const widgetCatalogKey = source.match(/<Base\b[\s\S]*?\bdescription=\{WIDGET_EN\.([a-zA-Z0-9_]+)\}/i)?.[1];
  if (widgetCatalogKey && WIDGET_EN[widgetCatalogKey]) {
    return clean(WIDGET_EN[widgetCatalogKey]);
  }

  if (route === '/horoscopes/') {
    return `Dated daily horoscopes for every sign, with the exact UTC edition date printed on the page and links to tomorrow, weekly, ${monthLabel(latestHoroscopeMonth)} monthly, love, career, and year-ahead readings.`;
  }
  if (route === '/learn/zodiac-dates/') return zodiacDatesDescription(ingresses);

  const named = source.match(/const description\s*=\s*(['"])([\s\S]*?)\1\s*;/)?.[2];
  if (named) return clean(named);
  throw new Error(`Could not read the Base meta description for ${route}`);
}

async function loadContentEntries(root, routeFor) {
  const entries = [];
  for (const file of await filesUnder(root, '.mdx')) {
    const source = await readFile(file, 'utf8');
    const local = relative(root, file).replaceAll('\\', '/').slice(0, -'.mdx'.length);
    entries.push({
      id: local,
      route: routeFor(local, source),
      title: frontmatterField(source, 'title', file),
      description: frontmatterField(source, 'description', file),
      source,
    });
  }
  return entries.sort((a, b) => compareText(a.route, b.route));
}

async function loadHoroscopes(root) {
  const all = [];
  for (const file of await filesUnder(root, '.mdx')) {
    const source = await readFile(file, 'utf8');
    // The horoscope routes render the latest NON-DRAFT month; the site guide
    // must describe the same month a visitor actually sees.
    if (/^draft:\s*true$/m.test(source.split(/\r?\n---(?:\r?\n|$)/)[0] ?? '')) continue;
    all.push({
      sign: frontmatterField(source, 'sign', file),
      month: frontmatterField(source, 'month', file),
    });
  }
  const latestMonth = currentHoroscopeMonth(all.map((entry) => entry.month), utcMonth(JSON.parse(await readFile(new URL('../src/data/daily.json', import.meta.url), 'utf8')).date));
  if (!latestMonth) throw new Error('Horoscope collection is empty');
  const current = all.filter((entry) => entry.month === latestMonth)
    .sort((a, b) => compareText(a.sign, b.sign));
  if (current.length !== 12) {
    throw new Error(`Latest horoscope month ${latestMonth} has ${current.length} signs`);
  }
  return { latestMonth, current };
}

async function loadStaticPages(repoRoot, context) {
  const pagesRoot = resolve(repoRoot, 'src/pages');
  const pages = [];
  for (const file of await filesUnder(pagesRoot, '.astro')) {
    const local = relative(pagesRoot, file).replaceAll('\\', '/');
    if (LOCALIZED_PAGE_PREFIXES.some((prefix) => local.startsWith(prefix))) continue;
    if (local.startsWith('embed/')) continue;
    if (local.includes('[')) continue;
    if (local === '404.astro') continue;
    const route = pagePath(file, pagesRoot);
    if (UNLISTED_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix))) continue;
    // Labeled sample pages for event-template review: never part of the
    // recommendable site inventory.
    if (route.startsWith('/events/preview/')) continue;
    // Capability exchange shell: /c/{secret}/ is private, one-use transport,
    // never a page the assistant should recommend or describe.
    if (route.startsWith('/c/')) continue;
    const source = await readFile(file, 'utf8');
    pages.push({
      route,
      description: staticDescription(route, source, context),
    });
  }
  return pages.sort((a, b) => compareText(a.route, b.route));
}

export function extractLearnTopics(source) {
  const topics = [];
  const pattern = /<a\s+class="tile clusters__card"\s+href="([^"]+)">([\s\S]*?)<\/a>/g;
  for (const match of source.matchAll(pattern)) {
    const body = match[2];
    const title = clean(body.match(/<strong>([\s\S]*?)<\/strong>/)?.[1] ?? '');
    const description = clean(body.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '');
    if (!title || !description) throw new Error(`Incomplete learn topic ${match[1]}`);
    topics.push({ route: match[1], title, description });
  }
  if (!topics.length) throw new Error('No learn topics found');
  return topics;
}

export function extractCanonicalLabels(strategy) {
  const section = strategy.match(/## 4\. Voice & microcopy([\s\S]*?)(?=\n## 5\.)/)?.[1];
  if (!section) throw new Error('docs/STRATEGY.md §4 was not found');
  const labels = [];
  for (const match of section.matchAll(/"([^"]+)"/g)) {
    if (!labels.includes(match[1])) labels.push(match[1]);
  }
  if (labels.length < 10) throw new Error(`Expected at least 10 canonical labels; found ${labels.length}`);
  return labels;
}

function routeList(routes, perLine = 8) {
  const lines = [];
  for (let index = 0; index < routes.length; index += perLine) {
    lines.push(routes.slice(index, index + perLine).join(', '));
  }
  return lines.join('\n');
}

function compactDescription(value, maxLength = 42) {
  const firstSentence = clean(value).split(/(?<=[.!?])\s/, 1)[0];
  const firstClause = firstSentence.split(/\s(?:—|–)\s|:\s|;\s/, 1)[0].trim();
  if (firstClause.length <= maxLength) {
    return /[.!?]$/.test(firstClause) ? firstClause : `${firstClause}.`;
  }
  const words = firstClause.split(' ');
  let output = '';
  for (const word of words) {
    const next = output ? `${output} ${word}` : word;
    if (next.length > maxLength - 1) break;
    output = next;
  }
  return `${output.replace(/[.,;:!?]+$/, '')}…`;
}

function pageLines(entries, { compact = false } = {}) {
  return entries
    .map((entry) => `- ${entry.route} — ${compact ? compactDescription(entry.description) : clean(entry.description)}`)
    .join('\n');
}

function birthdayLines(entries, signNames) {
  return entries.map((entry) => {
    const description = clean(entry.description);
    const signs = signNames
      .map((sign) => ({ sign, index: description.search(new RegExp(`\\b${sign}\\b`, 'i')) }))
      .filter(({ index }) => index >= 0)
      .sort((left, right) => left.index - right.index)
      .map(({ sign }) => sign);
    if (!signs.length) throw new Error(`Birthday meta description names no sign: ${entry.route}`);
    return `- ${entry.route} — ${signs.join('/')} birthday guide.`;
  }).join('\n');
}

function bannedVocabulary(text) {
  return BANNED_CONSUMER_VOCABULARY.filter((word) => (
    new RegExp(`\\b${word}(?:s)?\\b`, 'i').test(text)
  ));
}

export async function generateAssistantContext({ repoRoot = repo } = {}) {
  const contentRoot = resolve(repoRoot, 'src/content');
  const horoscopeData = await loadHoroscopes(resolve(contentRoot, 'horoscopes'));
  const ingresses = JSON.parse(await readFile(resolve(repoRoot, 'src/data/ingresses.json'), 'utf8'));
  const staticPages = await loadStaticPages(repoRoot, {
    ingresses,
    latestHoroscopeMonth: horoscopeData.latestMonth,
  });

  const guides = await loadContentEntries(
    resolve(contentRoot, 'guides'),
    (id) => `/${id}/`,
  );
  const learn = await loadContentEntries(
    resolve(contentRoot, 'learn'),
    (id) => id.startsWith('rising/')
      ? `/rising-sign/${id.slice('rising/'.length)}/`
      : `/learn/${id}/`,
  );
  const pairs = await loadContentEntries(
    resolve(contentRoot, 'pairs'),
    (id) => `/compatibility/${id}/`,
  );
  const birthdays = await loadContentEntries(
    resolve(contentRoot, 'birthdays'),
    (id) => `/birthday/${id}/`,
  );

  const staticByRoute = new Map(staticPages.map((entry) => [entry.route, entry]));
  for (const route of TOOL_ROUTES) {
    if (!staticByRoute.has(route)) throw new Error(`Tool route has no static page: ${route}`);
  }

  const learnSource = await readFile(resolve(repoRoot, 'src/pages/learn/index.astro'), 'utf8');
  const topics = extractLearnTopics(learnSource);
  const strategy = await readFile(resolve(repoRoot, 'docs/STRATEGY.md'), 'utf8');
  const labels = extractCanonicalLabels(strategy).filter((label) => (
    !/\b(?:Astrofolio|Registry|Registro)\b|\bthe Twelve\b|\bView the record\b|\bgold sculpture\b/iu.test(label)
  ));
  const labelLines = labels.map((label) => `- ${label}`).join('\n');

  const horoscopeLabel = monthLabel(horoscopeData.latestMonth);
  const dailyHoroscopePages = horoscopeData.current.map(({ sign }) => ({
    route: `/horoscopes/${sign}/`,
    description: `${signName(sign)} daily horoscope. Use the exact UTC edition date printed on the page; call it “today” only when that date matches the current UTC date.`,
  }));
  const monthlyHoroscopePages = horoscopeData.current.map(({ sign }) => ({
    route: `/horoscopes/${sign}/monthly/`,
    description: `${signName(sign)} in ${horoscopeLabel}, grounded in the month's dated transits and lunations.`,
  }));

  const rising = learn.filter((entry) => entry.id.startsWith('rising/'));
  const focusedLearn = learn.filter((entry) => !entry.id.startsWith('rising/') && !entry.id.startsWith('placements/'));
  const placements = learn.filter((entry) => entry.id.startsWith('placements/'));
  const tools = TOOL_ROUTES.map((route) => staticByRoute.get(route));
  const evergreen = staticPages.filter((entry) => !TOOL_ROUTES.includes(entry.route));
  const glossaryNames = [...GLOSSARY]
    .map((entry) => entry.term)
    .sort(compareText);
  const signNames = guides.map((entry) => entry.title.split(/[ :]/, 1)[0]);
  if (new Set(signNames).size !== 12) throw new Error('Could not derive the twelve sign names from guide metadata');
  const consumerRoutes = new Set([
    ...staticPages,
    ...guides,
    ...dailyHoroscopePages,
    ...monthlyHoroscopePages,
    ...learn,
    ...pairs,
    ...birthdays,
  ].map((entry) => entry.route));

  const context = [
    'SITE CONTEXT — ZODIACS.ORG',
    '',
    'Zodiacs.org is a free astrology reference. Chart calculations run in the visitor’s browser. Positions are computed astronomy; meanings are interpretation.',
    'Chart calculation does not send birth fields to a chart API. Saved charts are local-first; optional account sync, which starts when a person signs in, uploads their saved charts, including birth details, to that person’s account. The public Guide sends chat messages to OpenAI and sends a placements-only chart summary only after the person explicitly chooses “Attach my chart”, which is offered only with the encrypted sync preview (off on the public site); it never attaches the saved name, birth date, time, place, or coordinates, though the summary’s positions still give the birth date and time and, roughly, the birthplace.',
    'Historical civil time from 1970 on uses the IANA/ICU history supplied by the visitor’s browser or device runtime, so for those dates historical coverage and tzdb version depend on that host; before 1970 it comes from a pinned tzdb release (2025c) with its backzone records, which tzdb’s maintainers consider less reliable than the rest. A birth from before its place adopted a legal time uses the birthplace’s own local mean time, from its longitude, with the date each place adopted a legal time taken from the same release. When birth time is unknown, the site uses 12:00 local civil time as a reference for body positions, omits the rising sign, angles, and houses, and marks the Moon’s sign as unverified, because the Moon can change sign during that local date. A code shared from such a chart carries the positions at 12:00 UTC on the birth date instead, so it gives nothing about the birthplace.',
    'The site has English pages and partial Spanish translations. The inventory below lists English routes once; do not invent an English or Spanish page that is not listed.',
    '',
    'CANONICAL LABELS',
    'Use these labels from docs/STRATEGY.md §4 when they fit:',
    labelLines,
    '',
    'TOOLS AND UTILITIES',
    'These lines use each live page’s meta description to state what it computes or provides:',
    pageLines(tools),
    '',
    'LEARN-HUB TOPICS',
    topics.map((topic) => `- ${topic.route} — ${topic.title}: ${topic.description}`).join('\n'),
    '',
    'PAGE INVENTORY — EVERGREEN PAGES AND HUBS',
    pageLines(evergreen, { compact: true }),
    '',
    'PAGE INVENTORY — THE TWELVE SIGN GUIDES',
    pageLines(guides, { compact: true }),
    '',
    'PAGE INVENTORY — DAILY AND MONTHLY HOROSCOPES',
    'The hub and stable sign routes publish a dated daily edition. Treat “today” as an exact UTC-date claim: use it only when the edition date printed on the page matches the current UTC date. If it does not match, name the printed date and say the current edition is pending rather than relabeling stale copy. Monthly readings use the /monthly/ subroutes.',
    pageLines([...dailyHoroscopePages, ...monthlyHoroscopePages], { compact: true }),
    '',
    'PAGE INVENTORY — PLANETS, HOUSES, AND ASPECTS',
    pageLines(focusedLearn, { compact: true }),
    '',
    'PAGE INVENTORY — RISING-SIGN PROFILES',
    pageLines(rising, { compact: true }),
    '',
    'PAGE INVENTORY — PLANET-IN-SIGN PLACEMENTS',
    pageLines(placements, { compact: true }),
    '',
    'COMPATIBILITY PAGE FAMILY',
    `Every route below is a live sign-pair guide. Its one-line description is condensed from that page's meta description; use /compatibility/ when the visitor wants a comparison of two full charts.`,
    pageLines(pairs, { compact: true }),
    '',
    'BIRTHDAY PAGE FAMILY',
    `Every route below is a live date guide. Each one-line description names the sign or boundary signs from that page's meta description. The pages verify the Sun sign across 1940–2030, give degree spans and decans, and include year tables on sign-boundary dates.`,
    birthdayLines(birthdays, signNames),
    '',
    'GLOSSARY TERMS',
    'The definitions live at /learn/glossary/#slug. These are the names available there:',
    routeList(glossaryNames, 12),
    '',
    'ANSWERING BOUNDARIES',
    '- For calculation details and privacy, use /methodology/ and /privacy/.',
    '- For a visitor’s own placements, use only an attached chart summary. Otherwise send them to /birth-chart/.',
    '- /birth-chart/ computes Sun through Pluto, the True Node, ASC and MC, houses, and the five major aspects in the browser.',
    '- /transits/ compares the moving sky with a natal chart within 3° of exact.',
    '- /compatibility/ compares two full charts; sign-pair pages are a simpler Sun-sign baseline.',
    '- /learn/zodiac-dates/ uses the tropical zodiac and gives Sun ingress instants in UTC.',
  ].join('\n');

  const duplicatedLocale = LOCALIZED_PAGE_PREFIXES.find((prefix) => context.includes(`/${prefix}`));
  if (duplicatedLocale) {
    throw new Error(`Assistant context duplicates localized routes under /${duplicatedLocale}`);
  }
  const missingDescriptions = [...consumerRoutes]
    .filter((route) => !context.includes(`- ${route} —`));
  if (missingDescriptions.length) {
    throw new Error(`Assistant context has routes without descriptions: ${missingDescriptions.join(', ')}`);
  }
  const banned = bannedVocabulary(context);
  if (banned.length) throw new Error(`Assistant context contains banned vocabulary: ${banned.join(', ')}`);
  const size = Buffer.byteLength(context);
  if (size < MIN_CONTEXT_BYTES || size > MAX_CONTEXT_BYTES) {
    throw new Error(`Assistant context is ${size} bytes; expected ${MIN_CONTEXT_BYTES}–${MAX_CONTEXT_BYTES}`);
  }

  return {
    context,
    counts: {
      birthdays: birthdays.length,
      consumerRoutes: consumerRoutes.size,
      glossary: glossaryNames.length,
      guides: guides.length,
      learn: learn.length,
      pairs: pairs.length,
      staticPages: staticPages.length,
      tools: tools.length,
    },
  };
}

function asTypeScript(context) {
  const escaped = context
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${');
  return `// Generated by scripts/build-assistant-context.mjs. Do not hand-edit.\nexport const ASSISTANT_CONTEXT = \`${escaped}\`;\n`;
}

export async function buildAssistantContext({ repoRoot = repo, output = DEFAULT_OUTPUT } = {}) {
  const result = await generateAssistantContext({ repoRoot });
  const source = asTypeScript(result.context);
  await writeFile(output, source, 'utf8');
  return { ...result, source };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  const result = await buildAssistantContext();
  console.log(
    `assistant-context: ${Buffer.byteLength(result.context)} bytes`
    + ` · ${result.counts.staticPages} static pages`
    + ` · ${result.counts.learn} learn guides`
    + ` · ${result.counts.glossary} glossary terms`,
  );
}
