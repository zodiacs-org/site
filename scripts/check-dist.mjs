/*
 * Static integrity checks over the built site (dist/). Zero dependencies;
 * run from the repo root after `npm run build`:
 *
 *   node scripts/check-dist.mjs
 *
 * Checks:
 *   1. registry/zodiacs.registry.json — 12 assets, solana + base
 *      representation (with address) on each.
 *   2. archive/feed.json — JSON Feed 1.1 shape, non-empty, dated items.
 *   3. archive/rss.xml — XML declaration, balanced tags, item count
 *      matches feed.json.
 *   4. assets/pulse.json + assets/distribution.json — parse and shape.
 *   5. Every href/src in built *.html — site-relative and relative paths
 *      must resolve to a file; internal fragment links must point at an
 *      existing id.
 *   6. search-index.json — valid, populated, sorted, and every path resolves;
 *      deferred search/WebMCP assets exist with their expected fingerprints.
 *   7. sitemap.xml — unique dated locs resolve, exclude noindex, and cover
 *      every indexable built page's same-origin canonical.
 *   8. Root artifacts the outside world depends on are present.
 *   9. Source sky, transit, and daily snapshots cover the build date.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join, relative, sep } from 'node:path';
import {
  extractPageMetadata, htmlFileToPath, isEnglishHtml,
  searchIndexShapeFailures, shouldIndexPath,
} from './search-index-lib.mjs';
import { backstageCopyMatches } from './consumer-copy-lib.mjs';
import {
  ABSENT_LOCALES,
  HREFLANG_LOCALE_POLICY,
  INACTIVE_HREFLANGS,
  STAGED_NOINDEX_LOCALES,
  X_DEFAULT_HREFLANG,
  expectedHreflangsForPath,
  hreflangRouteFamily,
} from './i18n-hreflang-policy.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(repo, 'dist');
const SITE_ORIGIN = 'https://zodiacs.org';
/** Literal redirect sources from vercel.json — served URLs with no dist file. */
const redirectSources = new Set(
  (JSON.parse(await readFile(resolve(repo, 'vercel.json'), 'utf8')).redirects ?? [])
    .map((rule) => rule.source)
    .filter((source) => typeof source === 'string' && source.startsWith('/') && !/[:*(?]/.test(source)),
);
const failures = [];
const fail = (msg) => { failures.push(msg); };
let searchIndexCount = 0;
const ZODIAC_SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const dailyPublishedDays = JSON.parse(await readFile(resolve(repo, 'src/data/chart-of-the-day.json'), 'utf8')).editions.filter((edition) => edition.ownerApproval?.approved === true).map((edition) => edition.day);
const RUSSIAN_INDEXED_PATHS = new Set([
  ...dailyPublishedDays.map((day) => `/ru/chart-of-the-day/${day}/`),
  ...(dailyPublishedDays.length ? ['/ru/chart-of-the-day/'] : []),
  '/ru/', '/ru/tools/', '/ru/birth-chart/', '/ru/compatibility/',
  '/ru/moon-sign/', '/ru/rising-sign/', '/ru/moon-phase/',
  '/ru/saturn-return/', '/ru/transits/', '/ru/baby-zodiac/',
  '/ru/profile/', '/ru/methodology/', '/ru/privacy/', '/ru/disclosure/',
  '/ru/sky-calendar/', '/ru/astrologer-kit/', '/ru/your-sky-wrapped/',
  '/ru/big-three/', '/ru/compatibility/invite/', '/ru/group-charts/', '/ru/chart-twins/',
]);
const LOCALIZED_404_PATHS = new Set([
  '/404.html', '/es/404/', '/pt/404/', '/fr/404/', '/it/404/', '/ru/404/',
]);
const PHASE1_HOROSCOPE_PATHS = ZODIAC_SIGN_SLUGS.flatMap((sign) => [
  `/horoscopes/${sign}/`,
  `/horoscopes/${sign}/tomorrow/`,
  `/horoscopes/${sign}/weekly/`,
  `/horoscopes/${sign}/monthly/`,
  `/horoscopes/${sign}/love/`,
  `/horoscopes/${sign}/career/`,
  `/horoscopes/${sign}/2027/`,
]);
const PHASE1_READER_PATHS = new Set(['/today/', '/horoscopes/', ...PHASE1_HOROSCOPE_PATHS]);
const eventsPublication = JSON.parse(
  await readFile(resolve(repo, 'src/data/events-publication.json'), 'utf8'),
);
const publishedEventPaths = new Set([
  ...(eventsPublication.hub?.indexEligible ? [eventsPublication.hub.path] : []),
  ...(eventsPublication.pages ?? []).map((event) => event.path),
]);
const isPhase2EventPath = (path) => (
  path === '/events/'
  || /^\/events\/(?!preview(?:\/|$))[a-z0-9-]+\/$/.test(path)
  || /^\/(?:full-moon|new-moon|eclipses|(?:mercury|venus|mars)-retrograde)\/\d{4}-\d{2}-\d{2}\/$/.test(path)
);
let eventsFeedIds = new Set();
let eventsFeedLinks = new Set();
let indexedSearchPaths = new Set();

if (eventsPublication.schema !== 'zodiacs.events-publication.v1') {
  fail('events-publication: unsupported or missing schema');
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(eventsPublication.lastModified ?? '')) {
  fail('events-publication: invalid lastModified');
}
if (new Set((eventsPublication.pages ?? []).map((event) => event.id)).size !== (eventsPublication.pages ?? []).length) {
  fail('events-publication: duplicate page id');
}
if (new Set((eventsPublication.pages ?? []).map((event) => event.path)).size !== (eventsPublication.pages ?? []).length) {
  fail('events-publication: duplicate page path');
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalValue(nested)]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalValue(value));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function requireExactSet(label, actual, expected) {
  for (const value of expected) {
    if (!actual.has(value)) fail(`${label}: missing ${value}`);
  }
  for (const value of actual) {
    if (!expected.has(value)) fail(`${label}: unexpected ${value}`);
  }
}

async function exists(path) {
  try { await stat(path); return true; } catch { return false; }
}

if (!(await exists(root))) {
  console.error('check-dist: dist/ not found — run `npm run build` first.');
  process.exit(1);
}

// ---- 1. Registry ----------------------------------------------------------
const registry = JSON.parse(await readFile(resolve(root, 'registry/zodiacs.registry.json'), 'utf8'));
if (!Array.isArray(registry.assets) || registry.assets.length !== 12) {
  fail(`registry: expected 12 assets, found ${registry.assets?.length}`);
}
for (const asset of registry.assets ?? []) {
  for (const chain of ['solana', 'base']) {
    const rep = asset.representations?.find((r) => r.chain === chain);
    if (!rep?.address) fail(`registry: ${asset.sign} missing ${chain} address`);
  }
}

// ---- 2. JSON Feed ----------------------------------------------------------
const feed = JSON.parse(await readFile(resolve(root, 'archive/feed.json'), 'utf8'));
if (!String(feed.version || '').includes('jsonfeed.org/version/1.1')) {
  fail(`feed.json: unexpected version ${feed.version}`);
}
if (!Array.isArray(feed.items) || feed.items.length === 0) {
  fail('feed.json: no items');
}
for (const item of feed.items ?? []) {
  for (const key of ['id', 'url', 'title', 'date_published']) {
    if (!item[key]) fail(`feed.json: item ${item.id || '?'} missing ${key}`);
  }
}

// ---- 3. RSS ----------------------------------------------------------------
const rss = await readFile(resolve(root, 'archive/rss.xml'), 'utf8');
if (!rss.startsWith('<?xml')) fail('rss.xml: missing XML declaration');
{
  const stack = [];
  const tagRe = /<\/?([A-Za-z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
  let m;
  while ((m = tagRe.exec(rss)) !== null) {
    const [full, name, attrs] = m;
    if (full.startsWith('<?') || full.startsWith('<!')) continue;
    if (full.startsWith('</')) {
      const open = stack.pop();
      if (open !== name) fail(`rss.xml: tag mismatch — expected </${open}>, found </${name}>`);
    } else if (!attrs.trimEnd().endsWith('/')) {
      stack.push(name);
    }
  }
  if (stack.length) fail(`rss.xml: unclosed tags — ${stack.join(', ')}`);
  const itemCount = (rss.match(/<item>/g) || []).length;
  if (itemCount !== (feed.items?.length ?? 0)) {
    fail(`rss.xml: ${itemCount} items vs feed.json ${feed.items?.length}`);
  }
}

// ---- 3b. New-wing RSS feeds --------------------------------------------------
for (const { file, minItems } of [
  { file: 'feeds/horoscopes.xml', minItems: 12 },
  ...ZODIAC_SIGN_SLUGS.map((sign) => ({ file: `feeds/horoscopes/${sign}.xml`, minItems: 1 })),
  { file: 'feeds/daily-sky.xml', minItems: 1 },
  { file: 'feeds/almanac.xml', minItems: 1 },
  { file: 'feeds/events.xml', minItems: eventsPublication.timeline?.length ?? 0 },
]) {
  const path = resolve(root, file);
  if (!(await exists(path))) {
    fail(`${file}: missing`);
    continue;
  }
  const xml = await readFile(path, 'utf8');
  if (!xml.startsWith('<?xml')) fail(`${file}: no XML declaration`);
  if (!xml.includes('<rss version="2.0"')) fail(`${file}: not RSS 2.0`);
  const items = (xml.match(/<item>/g) || []).length;
  if (items < minItems) fail(`${file}: ${items} items, expected >= ${minItems}`);
  if (file === 'feeds/events.xml') {
    if (items !== (eventsPublication.timeline?.length ?? 0)) {
      fail(`${file}: ${items} items vs publication receipt ${eventsPublication.timeline?.length ?? 0}`);
    }
    eventsFeedIds = new Set(
      [...xml.matchAll(/<guid isPermaLink="false">https:\/\/zodiacs\.org\/feeds\/events\/([^<]+)<\/guid>/g)]
        .map((match) => match[1]),
    );
    eventsFeedLinks = new Set(
      [...xml.matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<\/item>/g)]
        .map((match) => {
          const url = new URL(match[1]);
          return `${url.pathname}${url.hash}`;
        }),
    );
    const expectedIds = new Set((eventsPublication.timeline ?? []).map((event) => event.id));
    const expectedLinks = new Set((eventsPublication.timeline ?? []).map((event) => event.path));
    requireExactSet(`${file} ids`, eventsFeedIds, expectedIds);
    requireExactSet(`${file} links`, eventsFeedLinks, expectedLinks);
  }
  for (const m of xml.matchAll(/<link>([^<]+)<\/link>/g)) {
    if (!m[1].startsWith('https://zodiacs.org/')) fail(`${file}: non-absolute link ${m[1]}`);
  }
  for (const m of xml.matchAll(/<pubDate>([^<]+)<\/pubDate>/g)) {
    if (Number.isNaN(Date.parse(m[1]))) fail(`${file}: bad pubDate ${m[1]}`);
  }
}

// ---- 4. Data snapshots ------------------------------------------------------
const pulse = JSON.parse(await readFile(resolve(root, 'assets/pulse.json'), 'utf8'));
if (!pulse.capturedAt) fail('pulse.json: missing capturedAt');
if (await exists(resolve(root, 'assets/distribution.json'))) {
  const dist = JSON.parse(await readFile(resolve(root, 'assets/distribution.json'), 'utf8'));
  if (dist.schema !== 'zodiacs.distribution.v2') fail(`distribution.json: unexpected schema ${dist.schema}`);
  if (!Number.isFinite(Date.parse(dist.generatedAt))) fail('distribution.json: invalid generatedAt');
  if (!dist.capturedAt) fail('distribution.json: missing capturedAt');
  if (!dist.signs || typeof dist.signs !== 'object') fail('distribution.json: missing signs');
  if (Object.keys(dist.signs ?? {}).length !== 12) fail('distribution.json: expected 12 signs');
  const coverage = dist.coverage ?? {};
  if (coverage.expected !== 12) fail('distribution.json: coverage.expected must be 12');
  if (coverage.observedInRun + coverage.carriedForward + coverage.missing !== 12) {
    fail('distribution.json: coverage counts must total 12');
  }
  for (const [sign, d] of Object.entries(dist.signs ?? {})) {
    if (!Number.isFinite(Date.parse(d.capturedAt))) fail(`distribution.json: ${sign}.capturedAt invalid`);
    if (!['observed', 'carried-forward'].includes(d.captureMode)) {
      fail(`distribution.json: ${sign}.captureMode invalid (${d.captureMode})`);
    }
    if (d.commitment !== 'finalized') fail(`distribution.json: ${sign}.commitment must be finalized`);
    if (typeof d.supply !== 'string' || !/^\d+(?:\.\d+)?$/u.test(d.supply)) {
      fail(`distribution.json: ${sign}.supply invalid (${d.supply})`);
    }
    if (d.captureMode === 'observed') {
      if (!Number.isSafeInteger(d.supplySlot) || !Number.isSafeInteger(d.largestAccountsSlot)) {
        fail(`distribution.json: ${sign} observed snapshot requires context slots`);
      }
    }
    for (const key of ['top1Pct', 'top10Pct', 'top20Pct']) {
      const v = d[key];
      if (v !== null && (typeof v !== 'number' || v < 0 || v > 100)) {
        fail(`distribution.json: ${sign}.${key} out of range (${v})`);
      }
    }
    if (!(d.top1Pct <= d.top10Pct && d.top10Pct <= d.top20Pct)) {
      fail(`distribution.json: ${sign} concentration shares are not monotonic`);
    }
  }
}

// ---- 5. Internal links + fragments in built HTML -----------------------------
async function htmlFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await htmlFiles(path));
    else if (entry.name.endsWith('.html')) out.push(path);
  }
  return out;
}

function targetPath(urlPath) {
  const clean = urlPath.split(/[?#]/)[0];
  if (!clean) return null;
  const abs = resolve(root, clean.replace(/^\//, ''));
  return clean.endsWith('/') ? join(abs, 'index.html') : abs;
}

function isInsideDist(path) {
  return path === root || path.startsWith(`${root}${sep}`);
}

const idCache = new Map();
async function hasId(filePath, id) {
  if (!idCache.has(filePath)) {
    idCache.set(filePath, await readFile(filePath, 'utf8'));
  }
  const html = idCache.get(filePath);
  if (html.includes(`id="${id}"`) || html.includes(`id='${id}'`)) return true;
  // Astrofolio and Terminal render their sections client-side; ids live in
  // the compiled bundle (JSX id="x" compiles to id: "x").
  if ([resolve(root, 'astrofolio/index.html'), resolve(root, 'terminal/index.html')].includes(filePath)) {
    const bundlePath = resolve(root, 'assets/app.js');
    if (!idCache.has(bundlePath)) {
      idCache.set(bundlePath, await readFile(bundlePath, 'utf8'));
    }
    const bundle = idCache.get(bundlePath);
    return bundle.includes(`id: "${id}"`) || bundle.includes(`id:"${id}"`) || bundle.includes(`id="${id}"`);
  }
  return false;
}

async function hasGlossaryTermId(filePath, id) {
  if (!idCache.has(filePath)) {
    idCache.set(filePath, await readFile(filePath, 'utf8'));
  }
  const html = idCache.get(filePath);
  return html.includes(`<dt id="${id}"`) || html.includes(`<dt id='${id}'`);
}

const files = await htmlFiles(root);
const refRe = /(?:href|src)="([^"]+)"/g;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const rel = relative(root, file);
  let m;
  while ((m = refRe.exec(html)) !== null) {
    const value = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:|#|\/\/)/.test(value)) continue;
    if (value.includes('${')) continue; // inline-script template, not markup
    let target;
    if (value.startsWith('webcal://')) {
      const subscription = new URL(value);
      if (subscription.hostname !== 'zodiacs.org') continue;
      target = targetPath(subscription.pathname);
    } else if (value.startsWith('/')) {
      target = targetPath(value);
    } else {
      const abs = resolve(dirname(file), value.split(/[?#]/)[0]);
      if (!abs.startsWith(root)) { fail(`${rel}: reference escapes dist — ${value}`); continue; }
      target = value.split(/[?#]/)[0].endsWith('/') || abs === root ? join(abs, 'index.html') : abs;
    }
    if (!target) continue;
    if (!(await exists(target))) {
      // A path the edge permanently redirects is a live URL, not a broken
      // one: a withdrawn page still deserves to be named where it is
      // discussed. Only exact literal sources count — patterns are not
      // evaluated here.
      if (redirectSources.has(value.split(/[?#]/)[0])) continue;
      fail(`${rel}: broken reference ${value}`);
      continue;
    }
    const fragment = value.includes('#') ? value.split('#')[1] : null;
    if (fragment && target.endsWith('.html') && !(await hasId(target, fragment))) {
      fail(`${rel}: missing fragment target ${value}`);
    }
  }
}

// Phase 1's pages must be discoverable by starting at / and following actual
// HTML links. An inbound-only gate can be fooled by a disconnected cycle.
const builtPageByFile = new Map(files.map((file) => [
  file,
  htmlFileToPath(relative(root, file)),
]));
const phase1Graph = new Map([...builtPageByFile.values()].map((path) => [path, new Set()]));
const phase1Inbound = new Map([...PHASE1_READER_PATHS].map((path) => [path, new Set()]));
const phase1Metadata = [];
for (const file of files) {
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  const sourcePath = builtPageByFile.get(file);
  for (const match of html.matchAll(/<a\b[^>]*\bhref=(?:"([^"]+)"|'([^']+)')[^>]*>/gi)) {
    const value = match[1] ?? match[2];
    if (/^(?:mailto:|tel:|data:|javascript:|#|\/\/)/i.test(value)) continue;
    try {
      const url = new URL(value, `${SITE_ORIGIN}${sourcePath}`);
      if (url.origin !== SITE_ORIGIN) continue;
      const target = targetPath(url.pathname);
      const linkedPath = target ? builtPageByFile.get(target) : undefined;
      if (!linkedPath || linkedPath === sourcePath) continue;
      phase1Graph.get(sourcePath)?.add(linkedPath);
      phase1Inbound.get(linkedPath)?.add(sourcePath);
    } catch {
      // Malformed internal links are reported by the forward resolver above.
    }
  }

  if (PHASE1_READER_PATHS.has(sourcePath)) {
    const metadata = extractPageMetadata(html);
    const rawOgImage = [...html.matchAll(/<meta\b[^>]*>/gi)]
      .map((match) => match[0])
      .find((tag) => /\bproperty=(?:"og:image"|'og:image')/i.test(tag))
      ?.match(/\bcontent=(?:"([^"]+)"|'([^']+)')/i)?.slice(1).find(Boolean);
    let ogImage;
    if (rawOgImage) {
      try {
        const parsed = new URL(rawOgImage, SITE_ORIGIN);
        if (parsed.origin !== SITE_ORIGIN) throw new Error('foreign origin');
        // Query strings and fragments do not make the underlying local image
        // distinct. Collapse them before URL and byte-level comparisons.
        ogImage = `${SITE_ORIGIN}${parsed.pathname}`;
      } catch {
        fail(`phase1-metadata: ${sourcePath} has a non-canonical local og:image (${rawOgImage})`);
      }
    }
    phase1Metadata.push({ path: sourcePath, ...metadata, ogImage });
  }
}

const reachableFromRoot = new Set();
const crawlQueue = ['/'];
while (crawlQueue.length > 0) {
  const page = crawlQueue.shift();
  if (reachableFromRoot.has(page)) continue;
  reachableFromRoot.add(page);
  for (const linked of phase1Graph.get(page) ?? []) {
    if (!reachableFromRoot.has(linked)) crawlQueue.push(linked);
  }
}
for (const path of PHASE1_READER_PATHS) {
  if (!reachableFromRoot.has(path)) {
    fail(`phase1-links: ${path} is not reachable from / through built HTML links`);
  }
}
for (const [path, inbound] of phase1Inbound) {
  if (inbound.size === 0) fail(`phase1-links: ${path} has no inbound internal link`);
}
if (phase1Metadata.length !== PHASE1_READER_PATHS.size) {
  fail(`phase1-metadata: found ${phase1Metadata.length}/${PHASE1_READER_PATHS.size} reader pages`);
}
for (const field of ['title', 'description', 'ogImage']) {
  const values = new Map();
  for (const metadata of phase1Metadata) {
    const value = metadata[field];
    if (!value) {
      fail(`phase1-metadata: ${metadata.path} is missing ${field}`);
      continue;
    }
    const previous = values.get(value);
    if (previous) fail(`phase1-metadata: ${metadata.path} duplicates ${field} from ${previous}`);
    else values.set(value, metadata.path);
  }
}

// Different URLs can still serve byte-identical cards. Every Phase 1 reader
// surface needs a genuinely distinct local OG artifact, not a relabeled copy.
const ogImageHashes = new Map();
for (const metadata of phase1Metadata) {
  if (!metadata.ogImage) continue;
  const imageUrl = new URL(metadata.ogImage);
  const imagePath = targetPath(imageUrl.pathname);
  if (!imagePath || !isInsideDist(imagePath) || !(await exists(imagePath))) {
    fail(`phase1-metadata: ${metadata.path} og:image does not resolve locally (${metadata.ogImage})`);
    continue;
  }
  try {
    const digest = sha256(await readFile(imagePath));
    const previous = ogImageHashes.get(digest);
    if (previous) {
      fail(`phase1-metadata: ${metadata.path} reuses the og:image bytes from ${previous}`);
    } else {
      ogImageHashes.set(digest, metadata.path);
    }
  } catch (error) {
    fail(`phase1-metadata: ${metadata.path} og:image is unreadable — ${error.message}`);
  }
}

// Consumer pages should lead with the answer, not publication plumbing. Closed
// evidence disclosures and explicit method/trust destinations remain inspectable.
for (const file of files) {
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  const pagePath = htmlFileToPath(relative(root, file));
  for (const phrase of backstageCopyMatches(html, pagePath)) {
    fail(`${pagePath}: default-visible copy exposes backstage language (${phrase})`);
  }
}

// /today/ must be useful in the initial HTML. Saved-chart comparison is a
// client enhancement, never a loading gate in front of the twelve Sun signs.
const dailyPublicationManifest = JSON.parse(await readFile(
  resolve(repo, 'src/data/daily-publication-manifest.json'),
  'utf8',
));
{
  const manifest = dailyPublicationManifest;
  const sourcePublication = JSON.parse(await readFile(
    resolve(repo, 'src/data/daily-publication.json'),
    'utf8',
  ));
  const sourceHoroscopeProgram = JSON.parse(await readFile(
    resolve(repo, 'src/data/horoscope-program.json'),
    'utf8',
  ));
  const policyRaw = await readFile(
    resolve(repo, 'src/lib/editorial-policy/constitution.v1.json'),
    'utf8',
  );
  const expectedPublicationSha256 = sha256(canonicalJson(sourcePublication));
  const expectedPolicySha256 = sha256(policyRaw);

  if (manifest.publication?.canonicalSha256 !== expectedPublicationSha256) {
    fail('daily-publication: committed manifest publication SHA-256 does not match the source publication');
  }
  if (manifest.policy?.sha256 !== expectedPolicySha256) {
    fail('daily-publication: committed manifest policy SHA-256 does not match the source constitution');
  }

  const todayPath = resolve(root, 'today/index.html');
  if (!(await exists(todayPath))) {
    fail('today: missing /today/');
  } else {
    const todayHtml = idCache.get(todayPath) ?? (await readFile(todayPath, 'utf8'));
    const signSlugs = ZODIAC_SIGN_SLUGS;
    const renderedSigns = [
      ...todayHtml.matchAll(/data-today-sun-sign="([^"]+)"/g),
    ].map((match) => match[1]);
    if (
      renderedSigns.length !== signSlugs.length
      || signSlugs.some((slug) => !renderedSigns.includes(slug))
    ) {
      fail(`today: initial HTML has ${renderedSigns.length}/12 Sun-sign readings`);
    }
    const usefulLines = [
      ...todayHtml.matchAll(/<p class="today-sign-reading__line">[^<]{20,}<\/p>/g),
    ];
    if (usefulLines.length !== signSlugs.length) {
      fail(`today: initial HTML has ${usefulLines.length}/12 useful reading lines`);
    }
    const pickerIcons = [...todayHtml.matchAll(/class="today-sign__icon"/g)];
    const readingIcons = [...todayHtml.matchAll(/class="today-sign-reading__icon"/g)];
    if (pickerIcons.length !== signSlugs.length) {
      fail(`today: initial HTML has ${pickerIcons.length}/12 pastel picker icons`);
    }
    if (readingIcons.length !== signSlugs.length) {
      fail(`today: initial HTML has ${readingIcons.length}/12 pastel reading icons`);
    }
    for (const slug of signSlugs) {
      if (
        !todayHtml.includes(`href="#today-sun-sign-${slug}"`)
        || !todayHtml.includes(`id="today-sun-sign-${slug}"`)
      ) {
        fail(`today: initial HTML is missing the ${slug} no-JavaScript anchor`);
      }
      if (!todayHtml.includes(`href="/horoscopes/${slug}/"`)) {
        fail(`today: initial HTML is missing the ${slug} horoscope link`);
      }
      if (
        !todayHtml.includes(`/assets/zodiac-icons/48/${slug}.avif`)
        || !todayHtml.includes(`/assets/zodiac-icons/48/${slug}.webp`)
      ) {
        fail(`today: initial HTML is missing the ${slug} pastel icon assets`);
      }
    }
    if (!todayHtml.includes('data-today-state="sun-sign"')) {
      fail('today: initial HTML is missing the useful Sun-sign state');
    }
    if (!todayHtml.includes(`data-daily-date="${manifest.date}"`)) {
      fail(`today: rendered date does not match verified manifest ${manifest.date}`);
    }
    if (!todayHtml.includes(`data-generation-mode="${manifest.generation?.mode}"`)) {
      fail(`today: rendered generation mode does not match ${manifest.generation?.mode}`);
    }
    if (!todayHtml.includes('/data/daily-publication.json')) {
      fail('today: initial HTML does not link to the public publication record');
    }
    for (const loadingCopy of [
      'Reading the saved chart on this device',
      'Checking for your saved sign',
    ]) {
      if (todayHtml.includes(loadingCopy)) {
        fail(`today: initial HTML is blocked by loading copy — ${loadingCopy}`);
      }
    }
  }

  const publicRecordPath = resolve(root, 'data/daily-publication.json');
  if (!(await exists(publicRecordPath))) {
    fail('daily-publication: public provenance record is missing');
  } else {
    const publicRecord = JSON.parse(await readFile(publicRecordPath, 'utf8'));
    if (canonicalJson(publicRecord.manifest) !== canonicalJson(manifest)) {
      fail('daily-publication: public record manifest does not match the complete committed manifest');
    }
    if (canonicalJson(publicRecord.publication) !== canonicalJson(sourcePublication)) {
      fail('daily-publication: public record publication does not match the complete source publication');
    }
    if (
      publicRecord.publication !== undefined
      && sha256(canonicalJson(publicRecord.publication)) !== manifest.publication?.canonicalSha256
    ) {
      fail('daily-publication: public record publication SHA-256 does not match the committed manifest');
    }
    if (publicRecord.publication?.signs?.length !== 12) {
      fail('daily-publication: public record does not contain twelve sign editions');
    }
    if (!publicRecord.inputs?.dailyFacts
      || sha256(canonicalJson(publicRecord.inputs.dailyFacts)) !== manifest.facts?.canonicalSha256) {
      fail('daily-publication: public daily input does not reproduce the committed canonical facts hash');
    }
    if (canonicalJson(publicRecord.inputs?.horoscopeProgram) !== canonicalJson(sourceHoroscopeProgram)) {
      fail('daily-publication: public horoscope program does not match the complete committed program');
    }
    if (publicRecord.inputs?.horoscopeProgram?.anchorDate !== manifest.date) {
      fail('daily-publication: public horoscope program is not anchored to the verified daily edition');
    }
    if (manifest.facts?.eventsSourceCanonicalSha256
      && (!publicRecord.inputs?.transitSource
        || sha256(canonicalJson(publicRecord.inputs.transitSource)) !== manifest.facts.eventsSourceCanonicalSha256)) {
      fail('daily-publication: public transit input does not reproduce the committed canonical source hash');
    }
  }
}

// ---- 5b. Search index -------------------------------------------------------
// The search dialog ships as a stable public URL (see build-search-ui.mjs);
// the inline nav loader imports it at runtime, so a missing bundle would
// fail silently in the wild.
const searchUiPath = resolve(root, 'assets/search-ui.js');
if (!(await exists(searchUiPath))) {
  fail('search-ui: missing assets/search-ui.js');
} else {
  const searchUi = await readFile(searchUiPath, 'utf8');
  if (!searchUi.includes('openSearch') || !searchUi.includes('zsearch')) {
    fail('search-ui: assets/search-ui.js does not look like the search dialog bundle');
  }
}

const webMcpPath = resolve(root, 'assets/webmcp-register.js');
if (!(await exists(webMcpPath))) {
  fail('webmcp: missing assets/webmcp-register.js');
} else {
  const webMcp = await readFile(webMcpPath, 'utf8');
  for (const fingerprint of ['zodiacs.search', 'INVALID_INPUT', 'INDEX_UNAVAILABLE']) {
    if (!webMcp.includes(fingerprint)) {
      fail(`webmcp: assets/webmcp-register.js is missing ${fingerprint}`);
    }
  }
}

for (const relativePath of ['index.html', 'aries/index.html']) {
  const html = await readFile(resolve(root, relativePath), 'utf8');
  for (const asset of ['search-ui', 'webmcp-register']) {
    if (!html.includes(`import('/assets/${asset}.js?v=search-ranking-2')`)
        || html.includes(`import('/assets/${asset}.js')`)) {
      fail(`${asset}: ${relativePath} must use the refreshed Search ranking cache key`);
    }
  }
}
for (const relativePath of [
  'es/index.html',
  'es/aries/index.html',
  'registry/index.html',
  'astrofolio/index.html',
  'terminal/index.html',
  'terminal/markets/index.html',
  'thesis/index.html',
  'sdk/index.html',
  'archive/index.html',
]) {
  const html = await readFile(resolve(root, relativePath), 'utf8');
  if (html.includes('/assets/webmcp-register.js')) {
    fail(`webmcp: ${relativePath} must not register English tools`);
  }
}

// Guide's stable public entrypoint is deliberately only the privacy-neutral
// launcher/invite shell. The conversation/auth/chart graph must remain in the
// separately fingerprinted drawer and load only after an explicit action.
const assistantUiPath = resolve(root, 'assets/assistant-ui.js');
const assistantCssPath = resolve(root, 'assets/assistant-ui.css');
const assistantDrawerPath = resolve(root, 'assets/assistant-drawer.js');
const assistantDrawerCssPath = resolve(root, 'assets/assistant-drawer.css');
if (!(await exists(assistantUiPath))) {
  fail('assistant-ui: missing assets/assistant-ui.js');
} else {
  const assistantUi = await readFile(assistantUiPath, 'utf8');
  if (
    !assistantUi.includes('openAssistant') ||
    !assistantUi.includes('zguide-launcher') ||
    !assistantUi.includes('/assets/assistant-ui.css') ||
    !assistantUi.includes('/assets/assistant-drawer.js')
  ) {
    fail('assistant-ui: assets/assistant-ui.js does not look like the Guide shell');
  }
  for (const forbidden of [
    'zassistant__panel',
    '/v1/guide/turn',
    'zodiacs.guide.daily-session.v1',
    'PUBLIC_SUPABASE_URL',
    'assistant-chunks/',
  ]) {
    if (assistantUi.includes(forbidden)) {
      fail(`assistant-ui: Guide shell contains deferred drawer marker ${forbidden}`);
    }
  }
}
if (!(await exists(assistantCssPath))) {
  fail('assistant-ui: missing assets/assistant-ui.css');
} else {
  const assistantCss = await readFile(assistantCssPath, 'utf8');
  if (!assistantCss.includes('.zguide-launcher') || assistantCss.includes('.zassistant__panel')) {
    fail('assistant-ui: assets/assistant-ui.css does not look like the Guide shell stylesheet');
  }
}
if (!(await exists(assistantDrawerPath))) {
  fail('assistant-ui: missing assets/assistant-drawer.js');
} else {
  const assistantDrawer = await readFile(assistantDrawerPath, 'utf8');
  if (!assistantDrawer.includes('zassistant__panel') || !assistantDrawer.includes('/v1/guide/turn')) {
    fail('assistant-ui: assets/assistant-drawer.js does not look like the Guide drawer');
  }
}
if (!(await exists(assistantDrawerCssPath))) {
  fail('assistant-ui: missing assets/assistant-drawer.css');
} else {
  const assistantDrawerCss = await readFile(assistantDrawerCssPath, 'utf8');
  if (!assistantDrawerCss.includes('.zassistant') || !assistantDrawerCss.includes('.zassistant__panel')) {
    fail('assistant-ui: assets/assistant-drawer.css does not look like the Guide drawer stylesheet');
  }
}

const searchIndexPath = resolve(root, 'search-index.json');
if (!(await exists(searchIndexPath))) {
  fail('search-index: missing search-index.json');
} else {
  let searchIndex;
  let searchIndexParsed = false;
  try {
    searchIndex = JSON.parse(await readFile(searchIndexPath, 'utf8'));
    searchIndexParsed = true;
  } catch (error) {
    fail(`search-index: invalid JSON — ${error.message}`);
  }

  if (searchIndexParsed) {
    searchIndexCount = Array.isArray(searchIndex) ? searchIndex.length : 0;
    for (const message of searchIndexShapeFailures(searchIndex)) {
      fail(`search-index: ${message}`);
    }

    if (Array.isArray(searchIndex)) {
      const indexedTermFragments = new Set();
      let indexedTermEntries = 0;
      for (const [position, entry] of searchIndex.entries()) {
        if (typeof entry?.path !== 'string' || !entry.path.startsWith('/')) continue;
        const [pagePath, encodedFragment] = entry.path.split('#', 2);
        const target = targetPath(pagePath);
        if (!target || !isInsideDist(target)) {
          fail(`search-index: entry ${position} escapes dist — ${entry.path}`);
          continue;
        }
        if (!(await exists(target))) {
          fail(`search-index: entry ${position} does not resolve — ${entry.path}`);
          continue;
        }

        if (entry.kind === 'term' && (pagePath !== '/learn/glossary/' || !encodedFragment)) {
          fail(`search-index: term entry ${position} is not a glossary fragment — ${entry.path}`);
        }
        if (encodedFragment) {
          if (entry.kind !== 'term' || pagePath !== '/learn/glossary/') {
            fail(`search-index: fragment entry ${position} is not a glossary term — ${entry.path}`);
            continue;
          }
          let fragment;
          try {
            fragment = decodeURIComponent(encodedFragment);
          } catch {
            fail(`search-index: entry ${position} has invalid fragment encoding — ${entry.path}`);
            continue;
          }
          indexedTermEntries += 1;
          if (indexedTermFragments.has(fragment)) {
            fail(`search-index: duplicate glossary term anchor #${fragment}`);
          }
          indexedTermFragments.add(fragment);
          if (!target.endsWith('.html') || !(await hasGlossaryTermId(target, fragment))) {
            fail(`search-index: entry ${position} has no glossary term anchor — ${entry.path}`);
          }
        }
      }

      const glossaryPath = resolve(root, 'learn/glossary/index.html');
      if (await exists(glossaryPath)) {
        if (!idCache.has(glossaryPath)) {
          idCache.set(glossaryPath, await readFile(glossaryPath, 'utf8'));
        }
        const glossaryHtml = idCache.get(glossaryPath);
        const glossaryTermIds = new Set(
          [...glossaryHtml.matchAll(/<dt\b[^>]*\bid=(["'])([^"']+)\1/gi)].map((match) => match[2]),
        );
        if (indexedTermEntries !== glossaryTermIds.size) {
          fail(
            `search-index: ${indexedTermEntries} indexed terms vs ${glossaryTermIds.size} glossary anchors`,
          );
        }
        for (const id of glossaryTermIds) {
          if (!indexedTermFragments.has(id)) fail(`search-index: missing glossary term #${id}`);
        }
      }

      // Reverse completeness: every indexable EN page in dist must be IN the
      // index. Without this, a regression in the exclusion predicates could
      // silently drop hundreds of pages and still pass the entry-count floor.
      const indexedPaths = new Set(
        searchIndex
          .filter((entry) => typeof entry?.path === 'string' && !entry.path.includes('#'))
          .map((entry) => entry.path),
      );
      indexedSearchPaths = indexedPaths;
      requireExactSet(
        'search-index Phase 2 event routes',
        new Set([...indexedPaths].filter(isPhase2EventPath)),
        publishedEventPaths,
      );
      for (const file of files) {
        const rel = relative(root, file).split(sep).join('/');
        const pagePath = htmlFileToPath(rel);
        if (!pagePath || !shouldIndexPath(pagePath)) continue;
        const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
        if (!isEnglishHtml(html)) continue;
        if (extractPageMetadata(html).noindex) continue;
        if (!indexedPaths.has(pagePath)) {
          fail(`search-index: indexable page missing from the index — ${pagePath}`);
        }
      }

      if (await exists(webMcpPath)) {
        try {
          const webMcp = await import(`${pathToFileURL(webMcpPath).href}?dist-check`);
          const fetch = async () => ({ ok: true, json: async () => searchIndex });
          for (const [query, expectedPath] of [
            ['birth charts', '/birth-chart/'],
            ['trines', '/learn/aspects/trine/'],
            ['Aries', '/aries/'],
            ['eclipses', '/eclipses/'],
          ]) {
            const envelope = await webMcp.executeWebMcpSearch({ query }, { fetch });
            const topThree = envelope.ok
              ? envelope.data.results.slice(0, 3).map((entry) => entry.path)
              : [];
            if (!topThree.includes(expectedPath)) {
              fail(`webmcp: ${query} did not place ${expectedPath} in its top three`);
            }
          }
          for (const query of ['registry', 'thesis', 'astrofolio', 'aries record']) {
            const envelope = await webMcp.executeWebMcpSearch({ query }, { fetch });
            const leaked = envelope.ok && envelope.data.results.some((entry) => (
              entry.kind === 'registry'
              || /^\/(?:registry|thesis|sdk|archive|collect)(?:\/|$)/.test(entry.path)
            ));
            if (leaked) fail(`webmcp: ${query} returned a wing entry`);
          }
        } catch (error) {
          fail(`webmcp: deferred asset could not execute — ${error.message}`);
        }
      }
    }
  }
}

// ---- 5c. Share-card images (og:image / twitter:image) -------------------------
// These live in content="…" attributes as absolute URLs, so the href/src
// pass above never sees them — yet a broken share card fails silently in
// the wild. Every referenced card must exist in dist.
const ogRe = /(?:property="og:image"|name="twitter:image")\s+content="([^"]+)"/g;
for (const file of files) {
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  const rel = relative(root, file);
  for (const m of html.matchAll(ogRe)) {
    let path;
    try {
      const url = new URL(m[1], 'https://zodiacs.org');
      if (url.origin !== 'https://zodiacs.org') {
        fail(`${rel}: share image on foreign origin — ${m[1]}`);
        continue;
      }
      path = url.pathname;
    } catch {
      fail(`${rel}: unparsable share image URL — ${m[1]}`);
      continue;
    }
    const target = targetPath(path);
    if (!target || !(await exists(target))) {
      fail(`${rel}: missing share image ${m[1]}`);
    }
  }
}

// ---- 6. Sitemap --------------------------------------------------------------
const sitemap = await readFile(resolve(root, 'sitemap.xml'), 'utf8');
if (!sitemap.startsWith('<?xml')) fail('sitemap.xml: missing XML declaration');
const sitemapLocs = new Set();
const sitemapBlocksByPath = new Map();
const sitemapAlternatePaths = new Set();
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  const url = new URL(m[1]);
  if (url.origin !== 'https://zodiacs.org') {
    fail(`sitemap.xml: unexpected origin ${m[1]}`);
    continue;
  }
  if (sitemapLocs.has(url.pathname)) fail(`sitemap.xml: duplicate loc ${url.pathname}`);
  sitemapLocs.add(url.pathname);
  const target = targetPath(url.pathname);
  if (!(await exists(target))) {
    fail(`sitemap.xml: loc has no file — ${m[1]}`);
    continue;
  }
  if (target.endsWith('.html')) {
    const html = idCache.get(target) ?? (await readFile(target, 'utf8'));
    if (hasNoindex(html)) fail(`sitemap.xml: noindex page included — ${m[1]}`);
  }
}
for (const block of sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
  const loc = block[1].match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '?';
  try {
    const url = new URL(loc);
    if (sitemapBlocksByPath.has(url.pathname)) {
      fail(`sitemap.xml: duplicate URL block ${url.pathname}`);
    } else {
      sitemapBlocksByPath.set(url.pathname, block[1]);
    }
  } catch {
    fail(`sitemap.xml: invalid URL block location ${loc}`);
  }
  const lastmod = block[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
  if (!lastmod || !/^\d{4}-\d{2}-\d{2}$/.test(lastmod) || Number.isNaN(Date.parse(`${lastmod}T00:00:00Z`))) {
    fail(`sitemap.xml: ${loc} has invalid or missing lastmod`);
  }
}
for (const match of sitemap.matchAll(/<xhtml:link\b[^>]*>/g)) {
  const href = attr(match[0], 'href');
  if (!href) {
    fail('sitemap.xml: alternate link is missing href');
    continue;
  }
  const url = new URL(href);
  if (url.origin !== SITE_ORIGIN) {
    fail(`sitemap.xml: alternate link has unexpected origin — ${href}`);
    continue;
  }
  sitemapAlternatePaths.add(url.pathname);
  const target = targetPath(url.pathname);
  if (!target || !(await exists(target))) {
    fail(`sitemap.xml: alternate link has no file — ${href}`);
    continue;
  }
  if (target.endsWith('.html')) {
    const html = idCache.get(target) ?? (await readFile(target, 'utf8'));
    if (hasNoindex(html)) fail(`sitemap.xml: noindex alternate included — ${href}`);
    if (canonicalHref(html) !== href) {
      fail(`sitemap.xml: alternate is not self-canonical — ${href}`);
    }
  }
}
for (const artifact of ['/llms.txt', '/llms-full.txt', '/registry/zodiacs.registry.json']) {
  if (sitemapLocs.has(artifact)) fail(`sitemap.xml: machine artifact must not be indexed — ${artifact}`);
  const target = targetPath(artifact);
  if (!target || !(await exists(target))) {
    fail(`Packet F: machine artifact no longer resolves — ${artifact}`);
  }
}
{
  const todayBlock = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .find((match) => match[1].includes('<loc>https://zodiacs.org/today/</loc>'))?.[1];
  const todayLastmod = todayBlock?.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
  if (todayLastmod !== dailyPublicationManifest.date) {
    fail(
      `sitemap.xml: /today/ lastmod ${todayLastmod ?? 'missing'} does not match daily publication ${dailyPublicationManifest.date}`,
    );
  }
}
{
  const sourceHoroscopeProgram = JSON.parse(await readFile(
    resolve(repo, 'src/data/horoscope-program.json'),
    'utf8',
  ));
  for (const sign of sourceHoroscopeProgram.signs) {
    const loc = `https://zodiacs.org/horoscopes/${sign.sign}/weekly/`;
    const block = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
      .find((match) => match[1].includes(`<loc>${loc}</loc>`))?.[1];
    const lastmod = block?.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1];
    const expected = sign.readings?.weekly?.period?.from;
    if (lastmod !== expected) {
      fail(`sitemap.xml: /horoscopes/${sign.sign}/weekly/ lastmod ${lastmod ?? 'missing'} does not match weekly period ${expected ?? 'missing'}`);
    }
  }
}

function attr(tag, name) {
  return tag.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(Boolean) ?? null;
}

function hasNoindex(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)].some((match) =>
    attr(match[0], 'name')?.toLowerCase() === 'robots' &&
    attr(match[0], 'content')?.toLowerCase().split(/\s*,\s*/).includes('noindex'));
}

function canonicalHref(html) {
  const tag = [...html.matchAll(/<link\b[^>]*>/gi)].find((match) =>
    attr(match[0], 'rel')?.toLowerCase().split(/\s+/).includes('canonical'));
  return tag ? attr(tag[0], 'href') : null;
}

function alternateHrefMap(markup, sitemapBlock = false) {
  const pattern = sitemapBlock ? /<xhtml:link\b[^>]*\/>/gi : /<link\b[^>]*>/gi;
  const links = new Map();
  for (const match of markup.matchAll(pattern)) {
    const tag = match[0];
    const rel = attr(tag, 'rel')?.toLowerCase().split(/\s+/) ?? [];
    const hreflang = attr(tag, 'hreflang');
    const href = attr(tag, 'href');
    if (!rel.includes('alternate') || !hreflang || !href) continue;
    if (links.has(hreflang)) fail(`hreflang: duplicate ${hreflang} alternate`);
    links.set(hreflang, href);
  }
  return links;
}

function requireSameAlternateMap(label, actual, expected) {
  requireExactSet(label, new Set(actual.keys()), new Set(expected.keys()));
  for (const [hreflang, href] of expected) {
    if (actual.get(hreflang) !== href) {
      fail(`${label}: ${hreflang} points to ${actual.get(hreflang) ?? 'missing'} instead of ${href}`);
    }
  }
}

for (const [pagePath, block] of sitemapBlocksByPath) {
  const sitemapAlternates = alternateHrefMap(block, true);
  if (!sitemapAlternates.size) continue;
  const expectedHreflangs = expectedHreflangsForPath(pagePath);
  requireExactSet(`sitemap.xml ${pagePath} hreflangs`, new Set(sitemapAlternates.keys()), expectedHreflangs);
  if (sitemapAlternates.get(X_DEFAULT_HREFLANG.hreflang) !== sitemapAlternates.get('en')) {
    fail(`sitemap.xml ${pagePath}: x-default must equal the English alternate`);
  }

  for (const [hreflang, href] of sitemapAlternates) {
    let alternateUrl;
    try {
      alternateUrl = new URL(href);
    } catch {
      fail(`sitemap.xml ${pagePath}: invalid ${hreflang} alternate ${href}`);
      continue;
    }
    if (alternateUrl.origin !== SITE_ORIGIN) {
      fail(`sitemap.xml ${pagePath}: foreign ${hreflang} alternate ${href}`);
      continue;
    }
    const target = targetPath(alternateUrl.pathname);
    if (!target || !(await exists(target))) {
      fail(`sitemap.xml ${pagePath}: ${hreflang} alternate has no file — ${href}`);
      continue;
    }
    if (!target.endsWith('.html')) continue;
    const alternateHtml = idCache.get(target) ?? (await readFile(target, 'utf8'));
    if (canonicalHref(alternateHtml) !== href) {
      fail(`sitemap.xml ${pagePath}: ${hreflang} target is not self-canonical — ${href}`);
    }
    const headAlternates = alternateHrefMap(alternateHtml);
    requireSameAlternateMap(`HTML ${alternateUrl.pathname} hreflangs`, headAlternates, sitemapAlternates);
    const reciprocalBlock = sitemapBlocksByPath.get(alternateUrl.pathname);
    if (!reciprocalBlock) {
      fail(`sitemap.xml ${pagePath}: ${hreflang} alternate has no reciprocal URL block — ${href}`);
      continue;
    }
    requireSameAlternateMap(
      `sitemap.xml ${alternateUrl.pathname} reciprocal hreflangs`,
      alternateHrefMap(reciprocalBlock, true),
      sitemapAlternates,
    );
  }
}

const astrofolioLandingPath = resolve(root, 'astrofolio/index.html');
const astrofolioLandingHtml = idCache.get(astrofolioLandingPath)
  ?? (await readFile(astrofolioLandingPath, 'utf8'));
const registryAuraMarker = astrofolioLandingHtml.match(
  /<meta name="zodiacs-registry-collection-enabled" content="([01])" \/>/,
)?.[1];
if (!registryAuraMarker) fail('astrofolio/index.html: missing Registry Collection build marker');
const registryAuraBuildEnabled = registryAuraMarker === '1';
const registryAuraLandingLinked = /href=["']\/registry\/collection\/["']/.test(astrofolioLandingHtml);
if (registryAuraLandingLinked !== registryAuraBuildEnabled) {
  fail('astrofolio/index.html: Registry Collection landing link does not match its build marker');
}
const thesisHtmlPath = resolve(root, 'thesis/index.html');
const thesisHtml = idCache.get(thesisHtmlPath) ?? (await readFile(thesisHtmlPath, 'utf8'));
const registryAuraThesisLinked = /href=["']\/registry\/collection\/["']/.test(thesisHtml);
if (registryAuraThesisLinked !== registryAuraBuildEnabled) {
  fail('thesis/index.html: Registry Collection action does not match the Registry build marker');
}
if (sitemapLocs.has('/registry/collection/') !== registryAuraBuildEnabled) {
  fail('sitemap.xml: Registry Collection inclusion does not match the Registry build marker');
}
if (registryAuraBuildEnabled) {
  const collectionHtml = await readFile(resolve(root, 'registry/collection/index.html'), 'utf8');
  const collectionCanonical = collectionHtml.match(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
    ?? collectionHtml.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i)?.[1];
  if (collectionCanonical !== 'https://zodiacs.org/registry/collection/') {
    fail(`registry/collection/index.html: enabled output is not self-canonical — ${collectionCanonical ?? 'missing'}`);
  }
  if (/url=\/404\.html|http-equiv=["']refresh["'][^>]*\/404\.html/i.test(collectionHtml)) {
    fail('registry/collection/index.html: enabled output is a 404 redirect stub');
  }
}

// Coordinated indexing baseline (2026-07-19): compatibility prose remains
// English-only under D9, while birthdays, Chinese zodiac, and the Registry
// disclosure ship on every locale rail. The shareable birth-chart page
// (/birth-chart/someone-else/) joined the index with the cabinet release. The
// seven-surface horoscope program contributes 84 English-only sign pages.
// Keep exact counts so sitemap drift fails loudly.
const registryAuraIndexed = sitemapLocs.has('/registry/collection/');
// The Race follows the PUBLIC_ZODIAC_GAMES_ENABLED build flag the same way
// the Registry Collection follows its own: the sitemap entry and the built
// page appear and disappear together.
const raceIndexed = sitemapLocs.has('/race/');
const trophyHallIndexed = sitemapLocs.has('/games/history/');
const indexablePeoplePaths = new Set(
  JSON.parse(await readFile(resolve(repo, 'src/data/people.json'), 'utf8')).people
    .filter((person) => person.indexEligibility.eligible)
    .map((person) => `/people/${person.slug}/`),
);
const registryResearchPublication = JSON.parse(await readFile(
  resolve(repo, 'src/data/registry-research/publication.json'),
  'utf8',
));
const indexedRegistryResearchPaths = new Set([
  '/terminal/research/',
  ...registryResearchPublication.items
    .filter((item) => item.status === 'published' && item.visibleAt <= registryResearchPublication.generatedAt)
    .map((item) => item.url),
]);
const developerGuidePaths = new Set([
  '/developers/docs/',
  ...JSON.parse(await readFile(resolve(repo, 'src/data/developer-guides.json'), 'utf8'))
    .map((guide) => `/developers/docs/${guide.slug}/`),
]);
const sitemapPolicy = {
  // 944 reflects Packet F's removal of 1,464 localized birthday previews,
  // twelve thin Russian sign guides, and three machine-contract artifacts;
  // +1 for the /developers/ sky data API documentation page;
  // +1 for the /big-three/ calculator;
  // +28 for the Spanish and Portuguese daily surfaces (today, hub, twelve signs each).
  // +3 for the 2027 full-moon, eclipse, and Mercury-retrograde year pages.
  // +1 for the English-only lunar-return calculator.
  // +1 for /fomo/, the Astrofolio-on-Fomo landing page (wing register, indexable).
  // +13 for the numerology calculator and the twelve English-only Life Path pages.
  // +1 for the void-of-course Moon calendar.
  // +2 for the platform support contract and runnable developer examples.
  // +1 for /developers/compare/, the browser-local chart-difference tool.
  // +1 for /developers/mcp/, the local MCP adapter's install and privacy page.
  // +1 for /developers/engine/, the engine's own product page.
  // +1 for /developers/conformance/, the conformance suite's results page.
  // +1 for /developers/compute/, the compute API's page.
  // +1 for /developers/sky-benchmark/, the sky-fact benchmark's page.
  // +23 for three six-language sharing tools and five Big Three translations.
  // +18 for three six-language return-visit tools.
  // +48 for the twelve rising-sign profiles translated into es, pt, fr and it.
  // +16 for the four sky-calendar hubs translated into es, pt, fr and it.
  // +312 translated compatibility pairs and +1 AI integration candidates page.
  // +19 version-bound developer guide pages from the shared catalogue (index included).
  total: 1419 + (dailyPublishedDays.length + (dailyPublishedDays.length ? 1 : 0)) * 6 + Number(registryAuraIndexed) + Number(raceIndexed) + Number(trophyHallIndexed)
    + publishedEventPaths.size + indexablePeoplePaths.size
    + Number(JSON.parse(await readFile(resolve(repo, 'src/data/people.json'), 'utf8')).directoryIndexable === true)
    + indexedRegistryResearchPaths.size + developerGuidePaths.size,
  // 78 pairs in English and in es, pt, fr and it.
  compatibilityPairs: 390,
  birthdays: 366,
  chineseZodiac: 65,
  disclosures: 6,
  extendedHoroscopePages: 72,
  dailyReadingPages: 42,
  eventPages: publishedEventPaths.size,
  peoplePages: indexablePeoplePaths.size,
  registryResearchPages: indexedRegistryResearchPaths.size,
  translatedBlocks: 641,
};
const indexedFamilies = [
  { label: 'compatibility pairs', pattern: /^\/(?:(?:es|pt|fr|it)\/)?compatibility\/[a-z]+-[a-z]+\/$/, expected: sitemapPolicy.compatibilityPairs, localized: true },
  { label: 'birthdays', pattern: /^\/(?:(?:es|pt|fr|it)\/)?birthday\/[a-z]+-\d{1,2}\/$/, expected: sitemapPolicy.birthdays, localized: true },
  { label: 'Chinese zodiac', pattern: /^\/(?:(?:es|pt|fr|it)\/)?learn\/chinese-zodiac(?:\/[a-z]+)?\/$/, expected: sitemapPolicy.chineseZodiac, localized: true },
  { label: 'disclosures', pattern: /^\/(?:(?:es|pt|fr|it|ru)\/)?disclosure\/$/, expected: sitemapPolicy.disclosures, localized: true },
  {
    label: 'English-only extended horoscope pages',
    pattern: /^\/horoscopes\/(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/(?:tomorrow|weekly|monthly|love|career|2027)\/$/,
    expected: sitemapPolicy.extendedHoroscopePages,
    localized: false,
  },
  {
    label: 'published daily editions',
    pattern: /^\/(?:(?:es|pt)\/)?(?:today|horoscopes(?:\/(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces))?)\/$/,
    expected: sitemapPolicy.dailyReadingPages,
    localized: true,
  },
  {
    label: 'Phase 2 event pages',
    pattern: /^(?:\/events\/(?:[a-z0-9-]+\/)?|\/(?:full-moon|new-moon|eclipses|(?:mercury|venus|mars)-retrograde)\/\d{4}-\d{2}-\d{2}\/)$/,
    expected: sitemapPolicy.eventPages,
    localized: false,
  },
  {
    label: 'Phase 5 People profiles',
    pattern: /^\/people\/[a-z0-9-]+\/$/,
    expected: sitemapPolicy.peoplePages,
    localized: false,
  },
  { label: 'Life Path pages', pattern: /^\/numerology\/life-path\/(?:[1-9]|11|22|33)\/$/, expected: 12, localized: false },
  { label: 'Registry Collection', pattern: /^\/registry\/collection\/$/, expected: Number(registryAuraIndexed), localized: false },
  { label: 'The Race', pattern: /^\/race\/$/, expected: Number(raceIndexed), localized: false },
  { label: 'Trophy Hall', pattern: /^\/games\/history\/$/, expected: Number(trophyHallIndexed), localized: false },
  { label: 'Registry technical record', pattern: /^\/registry\/technical\/$/, expected: 1, localized: false },
  { label: 'Terminal Research', pattern: /^\/terminal\/research(?:\/[a-z0-9-]+)?\/$/, expected: sitemapPolicy.registryResearchPages, localized: false },
];

requireExactSet(
  'sitemap.xml Phase 2 event routes',
  new Set([...sitemapLocs].filter(isPhase2EventPath)),
  publishedEventPaths,
);
requireExactSet(
  'sitemap.xml Russian core routes',
  new Set([...sitemapLocs].filter((path) => path === '/ru/' || path.startsWith('/ru/'))),
  RUSSIAN_INDEXED_PATHS,
);
requireExactSet(
  'sitemap.xml Phase 5 People profiles',
  new Set([...sitemapLocs].filter((path) => /^\/people\/[a-z0-9-]+\/$/u.test(path))),
  indexablePeoplePaths,
);
requireExactSet(
  'sitemap.xml Terminal Research routes',
  new Set([...sitemapLocs].filter((path) => /^\/terminal\/research(?:\/[a-z0-9-]+)?\/$/u.test(path))),
  indexedRegistryResearchPaths,
);

const packetFNoindexCounts = { localizedBirthdays: 0, russianSignGuides: 0, people: 0 };
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  const pagePath = htmlFileToPath(rel);
  const localizedBirthday = /^\/(?:es|pt|fr|it)\/birthday\/[a-z]+-\d{1,2}\/$/u.test(pagePath);
  const russianSignGuide = /^\/ru\/(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/$/u.test(pagePath);
  const deferredPerson = /^\/people\/[a-z0-9-]+\/$/u.test(pagePath)
    && !indexablePeoplePaths.has(pagePath);
  if (!localizedBirthday && !russianSignGuide && !deferredPerson) continue;
  if (localizedBirthday) packetFNoindexCounts.localizedBirthdays += 1;
  if (russianSignGuide) packetFNoindexCounts.russianSignGuides += 1;
  if (deferredPerson) packetFNoindexCounts.people += 1;
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  if (!hasNoindex(html)) fail(`Packet F: expected noindex page — ${pagePath}`);
  if (canonicalHref(html) !== `${SITE_ORIGIN}${pagePath}`) {
    fail(`Packet F: noindex page is not self-canonical — ${pagePath}`);
  }
  if (sitemapLocs.has(pagePath) || sitemapAlternatePaths.has(pagePath)) {
    fail(`Packet F: noindex page leaked into sitemap discovery — ${pagePath}`);
  }
}
if (packetFNoindexCounts.localizedBirthdays !== 1464) {
  fail(`Packet F: ${packetFNoindexCounts.localizedBirthdays}/1464 localized birthday previews are present`);
}
if (packetFNoindexCounts.russianSignGuides !== 12) {
  fail(`Packet F: ${packetFNoindexCounts.russianSignGuides}/12 Russian sign-guide previews are present`);
}
if (packetFNoindexCounts.people !== 501 - indexablePeoplePaths.size) {
  fail(`Packet F: ${packetFNoindexCounts.people}/${501 - indexablePeoplePaths.size} deferred People profiles are present`);
}

if (sitemapLocs.size !== sitemapPolicy.total) {
  fail(`sitemap.xml: ${sitemapLocs.size} locs vs coordinated baseline ${sitemapPolicy.total}`);
}
requireExactSet(
  'sitemap.xml developer guide routes',
  new Set([...sitemapLocs].filter((path) => path.startsWith('/developers/docs/'))),
  developerGuidePaths,
);
requireExactSet(
  'sitemap.xml lunar-return routes',
  new Set([...sitemapLocs].filter((path) => /^\/(?:(?:es|pt|fr|it|ru)\/)?lunar-return\/$/u.test(path))),
  new Set(['/lunar-return/']),
);
if (!sitemapBlocksByPath.get('/lunar-return/')?.includes('<lastmod>2026-09-06</lastmod>')) {
  fail('sitemap.xml: lunar-return modification date must match the reviewed source revision');
}
requireExactSet(
  'sitemap.xml numerology routes',
  new Set([...sitemapLocs].filter((path) => /^\/(?:(?:es|pt|fr|it|ru)\/)?numerology\/$/u.test(path))),
  new Set(['/numerology/']),
);
if (!sitemapBlocksByPath.get('/numerology/')?.includes('<lastmod>2026-09-07</lastmod>')) {
  fail('sitemap.xml: numerology modification date must match the reviewed source revision');
}
requireExactSet(
  'sitemap.xml void-of-course routes',
  new Set([...sitemapLocs].filter((path) => /^\/(?:(?:es|pt|fr|it|ru)\/)?void-of-course-moon\/$/u.test(path))),
  new Set(['/void-of-course-moon/']),
);
for (const family of indexedFamilies) {
  const locs = [...sitemapLocs].filter((loc) => family.pattern.test(loc));
  if (locs.length !== family.expected) {
    fail(`sitemap.xml: ${locs.length} ${family.label} vs baseline ${family.expected}`);
  }
  for (const loc of locs) {
    const target = targetPath(loc);
    if (!target || !(await exists(target))) continue;
    const html = idCache.get(target) ?? (await readFile(target, 'utf8'));
    const canonical = canonicalHref(html);
    if (canonical !== `https://zodiacs.org${loc}`) {
      fail(`sitemap.xml: ${loc} is not self-canonical — ${canonical ?? 'missing'}`);
    }
    const block = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)]
      .find((match) => match[1].includes(`<loc>https://zodiacs.org${loc}</loc>`))?.[1] ?? '';
    if (!family.localized && /hreflang=/.test(block)) {
      fail(`sitemap.xml: English-only ${family.label} route has hreflang alternates — ${loc}`);
    }
    if (family.localized) {
      for (const hreflang of expectedHreflangsForPath(loc)) {
        if (!block.includes(`hreflang="${hreflang}"`)) {
          fail(`sitemap.xml: localized ${family.label} route is missing ${hreflang} alternate — ${loc}`);
        }
      }
    }
  }
}
for (const policy of HREFLANG_LOCALE_POLICY) {
  const count = [...sitemap.matchAll(new RegExp(`hreflang="${policy.hreflang}"`, 'g'))].length;
  if (count !== policy.expectedBlocks) {
    fail(`sitemap.xml: ${count} ${policy.hreflang} alternates vs locale baseline ${policy.expectedBlocks}`);
  }
}
{
  const count = [...sitemap.matchAll(new RegExp(`hreflang="${X_DEFAULT_HREFLANG.hreflang}"`, 'g'))].length;
  if (count !== X_DEFAULT_HREFLANG.expectedBlocks) {
    fail(`sitemap.xml: ${count} x-default alternates vs locale baseline ${X_DEFAULT_HREFLANG.expectedBlocks}`);
  }
}

for (const inactiveLocale of INACTIVE_HREFLANGS) {
  if ([...sitemapLocs].some((path) => path === `/${inactiveLocale}/` || path.startsWith(`/${inactiveLocale}/`))) {
    fail(`i18n: inactive /${inactiveLocale}/ URL leaked into sitemap.xml`);
  }
  if ([...indexedSearchPaths].some((path) => path === `/${inactiveLocale}/` || path.startsWith(`/${inactiveLocale}/`))) {
    fail(`i18n: inactive /${inactiveLocale}/ URL leaked into search-index.json`);
  }
}
if ([...indexedSearchPaths].some((path) => path === '/ru/' || path.startsWith('/ru/'))) {
  fail('i18n: Russian route leaked into the English-only search-index.json');
}
for (const absentLocale of ABSENT_LOCALES) {
  if (await exists(resolve(root, absentLocale))) {
    fail(`i18n: absent /${absentLocale}/ output directory exists`);
  }
}
for (const previewLocale of STAGED_NOINDEX_LOCALES) {
  if (!(await exists(resolve(root, previewLocale)))) {
    fail(`i18n: staged /${previewLocale}/ preview directory is missing`);
  }
}
for (const file of files) {
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  const rel = relative(root, file);
  const pagePath = htmlFileToPath(rel.split(sep).join('/'));
  const russianRouteAvailable = expectedHreflangsForPath(pagePath).has('ru')
    || LOCALIZED_404_PATHS.has(pagePath);
  const russianRouteRenderable = russianRouteAvailable
    || hreflangRouteFamily(pagePath) === 'sign-guide';
  if (!russianRouteRenderable && /href=["'](?:https:\/\/zodiacs\.org)?\/ru(?:\/|["'#?])/.test(html)) {
    fail(`${rel}: Russian route leaked onto a deferred or programmatic page`);
  }
  if (/href=["'](?:https:\/\/zodiacs\.org)?\/ar(?:\/|["'#?])/.test(html)) {
    fail(`${rel}: absent AR route leaked into an href`);
  }
  if (/hreflang=["']ar["']/.test(html)) {
    fail(`${rel}: inactive Arabic hreflang leaked into HTML`);
  }
  if (!russianRouteAvailable
      && /<link\b[^>]*\brel=["']alternate["'][^>]*\bhreflang=["']ru["']|<link\b[^>]*\bhreflang=["']ru["'][^>]*\brel=["']alternate["']/.test(html)) {
    fail(`${rel}: Russian hreflang leaked onto a deferred or programmatic page`);
  }
  if (/property=["']og:locale(?::alternate)?["'][^>]*content=["']ar_AR["']/.test(html)) {
    fail(`${rel}: inactive Arabic Open Graph locale leaked into HTML`);
  }
  const isRussianSignGuide = /^\/ru\/(?:aries|taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces)\/$/u.test(pagePath);
  if (!russianRouteAvailable && !isRussianSignGuide
      && /property=["']og:locale(?::alternate)?["'][^>]*content=["']ru_RU["']/.test(html)) {
    fail(`${rel}: Russian Open Graph locale leaked onto a deferred or programmatic page`);
  }
  if (/العربية/u.test(html)) {
    fail(`${rel}: inactive Arabic language-selector label leaked into HTML`);
  }
  if (!russianRouteRenderable && /Русский/u.test(html)) {
    fail(`${rel}: Russian language-selector label leaked onto a deferred or programmatic page`);
  }
}

// The publication receipt is the single launch allowlist. Every generated
// Phase 2 route must land on exactly one side of the boundary: published and
// discoverable everywhere, or withheld from every discovery surface.
const previewEventPath = (path) => /^\/events\/preview(?:\/|$)/.test(path);
for (const event of eventsPublication.timeline ?? []) {
  const url = new URL(event.path, SITE_ORIGIN);
  if (publishedEventPaths.has(url.pathname)) continue;
  const target = targetPath(url.pathname);
  if (!sitemapLocs.has(url.pathname) || !target || !(await exists(target))) {
    fail(`events-publication: timeline ${event.id} links outside the public index — ${event.path}`);
    continue;
  }
  if (url.hash && !(await hasId(target, decodeURIComponent(url.hash.slice(1))))) {
    fail(`events-publication: timeline ${event.id} has no anchor target — ${event.path}`);
  }
}
for (const path of publishedEventPaths) {
  const target = targetPath(path);
  if (!target || !(await exists(target))) {
    fail(`events-publication: published route has no built HTML — ${path}`);
  }
}
for (const file of files) {
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  const pagePath = htmlFileToPath(relative(root, file));
  if (!isPhase2EventPath(pagePath) && !previewEventPath(pagePath)) continue;

  const published = publishedEventPaths.has(pagePath);
  const noindex = hasNoindex(html);
  const canonical = canonicalHref(html);
  if (published) {
    if (noindex) fail(`events-publication: published route is noindex — ${pagePath}`);
    if (canonical !== `${SITE_ORIGIN}${pagePath}`) {
      fail(`events-publication: ${pagePath} is not self-canonical — ${canonical ?? 'missing'}`);
    }
    if (!sitemapLocs.has(pagePath)) fail(`events-publication: sitemap is missing ${pagePath}`);
    if (!indexedSearchPaths.has(pagePath)) fail(`events-publication: search is missing ${pagePath}`);
    if (!html.includes('href="/feeds/events.xml"')) {
      fail(`events-publication: ${pagePath} has no events-feed autodiscovery link`);
    }
  } else {
    if (!noindex) fail(`events-publication: withheld route is indexable — ${pagePath}`);
    if (sitemapLocs.has(pagePath)) fail(`events-publication: withheld route leaked into sitemap — ${pagePath}`);
    if (indexedSearchPaths.has(pagePath)) fail(`events-publication: withheld route leaked into search — ${pagePath}`);
  }
}

// Reverse coverage: every indexable HTML page must declare a same-origin
// canonical URL that appears in the sitemap.
for (const file of files) {
  const html = idCache.get(file) ?? (await readFile(file, 'utf8'));
  if (hasNoindex(html)) continue;
  const rel = relative(root, file);
  const canonical = canonicalHref(html);
  if (!canonical) {
    fail(`${rel}: indexable page has no canonical URL`);
    continue;
  }
  let url;
  try {
    url = new URL(canonical);
  } catch {
    fail(`${rel}: invalid canonical URL — ${canonical}`);
    continue;
  }
  if (url.origin !== 'https://zodiacs.org') {
    fail(`${rel}: canonical on unexpected origin — ${canonical}`);
    continue;
  }
  if (!sitemapLocs.has(url.pathname)) {
    fail(`${rel}: canonical missing from sitemap — ${url.pathname}`);
  }
}

// ---- 7. External-contract artifacts ------------------------------------------
for (const artifact of [
  'robots.txt',
  'llms.txt',
  'llms-full.txt',
  'd21e17e6-3d58-4604-96d9-3363e13780e2.txt',
  'registry/zodiacs.registry.json',
  'archive/feed.json',
  'archive/rss.xml',
  '404.html',
  'registry/index.html',
  'astrofolio/index.html',
  'terminal/index.html',
  'thesis/index.html',
  'sdk/index.html',
  'api/v1/index.json',
]) {
  if (!(await exists(resolve(root, artifact)))) fail(`missing external-contract artifact: ${artifact}`);
}

// The sky data API's index is its deploy contract: every endpoint it
// advertises must exist in this build, and today's snapshot must carry the
// same date as the verified daily publication.
if (await exists(resolve(root, 'api/v1/index.json'))) {
  const skyApiIndex = JSON.parse(await readFile(resolve(root, 'api/v1/index.json'), 'utf8'));
  const advertised = Array.isArray(skyApiIndex.endpoints) ? skyApiIndex.endpoints : [];
  if (advertised.length === 0) fail('api/v1/index.json: no endpoints listed');
  const documents = Array.isArray(skyApiIndex.documents) ? skyApiIndex.documents : [];
  for (const entry of [...advertised, ...documents]) {
    const relPath = String(entry?.path ?? '').replace(/^\//u, '');
    if (!relPath.startsWith('api/v1/') || !(await exists(resolve(root, relPath)))) {
      fail(`api/v1/index.json: advertised path missing from dist — ${entry?.path}`);
    }
  }
  for (const required of ['/api/v1/llms.txt', '/api/v1/openapi.json', '/api/v1/sky/upcoming.json']) {
    if (![...advertised, ...documents].some((entry) => entry?.path === required)) {
      fail(`api/v1/index.json: ${required} is no longer advertised`);
    }
  }
  if (await exists(resolve(root, 'api/v1/sky/today.json'))) {
    const skyToday = JSON.parse(await readFile(resolve(root, 'api/v1/sky/today.json'), 'utf8'));
    if (skyToday.date !== dailyPublicationManifest.date) {
      fail(`api/v1/sky/today.json: date ${skyToday.date} does not match daily publication ${dailyPublicationManifest.date}`);
    }
  }
}

// ---- 8. Source-data freshness -------------------------------------------------
// These snapshots are baked into the static output, so checking dist alone cannot
// tell us whether a successful build quietly shipped stale sky data.
const buildNow = new Date();
const buildDay = new Date(Date.UTC(
  buildNow.getUTCFullYear(),
  buildNow.getUTCMonth(),
  buildNow.getUTCDate(),
));
const buildMonth = buildNow.toISOString().slice(0, 7);
const dataRoot = resolve(repo, 'src/data');

const sky = JSON.parse(await readFile(resolve(dataRoot, 'sky.json'), 'utf8'));
const skyThrough = new Date(sky.to);
const minimumSkyHorizon = new Date(buildNow);
minimumSkyHorizon.setUTCDate(minimumSkyHorizon.getUTCDate() + 90);
if (Number.isNaN(skyThrough.getTime())) {
  fail(`sky.json: invalid horizon ${sky.to}`);
} else if (skyThrough < minimumSkyHorizon) {
  fail(`sky.json: horizon ${sky.to} is before build + 90 days (${minimumSkyHorizon.toISOString()})`);
}

const transitFiles = (await readdir(dataRoot))
  .filter((name) => /^transits-\d{4}-\d{2}\.json$/.test(name))
  .sort();
const latestTransitFile = transitFiles.at(-1);
const renderMonthTransitFile = `transits-${buildMonth}.json`;
if (!latestTransitFile) {
  fail('transits: no transits-YYYY-MM.json snapshot found');
} else {
  const latestTransitMonth = latestTransitFile.slice('transits-'.length, -'.json'.length);
  const latestTransits = JSON.parse(await readFile(resolve(dataRoot, latestTransitFile), 'utf8'));
  if (latestTransits.month !== latestTransitMonth) {
    fail(`${latestTransitFile}: month field is ${latestTransits.month}, expected ${latestTransitMonth}`);
  }
  if (latestTransitMonth < buildMonth) {
    fail(`${latestTransitFile}: latest transit month does not cover build month ${buildMonth}`);
  }
  if (!transitFiles.includes(renderMonthTransitFile)) {
    fail(`transits: missing render-month snapshot ${renderMonthTransitFile}`);
  } else if (latestTransitFile !== renderMonthTransitFile) {
    const renderMonthTransits = JSON.parse(await readFile(resolve(dataRoot, renderMonthTransitFile), 'utf8'));
    if (renderMonthTransits.month !== buildMonth) {
      fail(`${renderMonthTransitFile}: month field is ${renderMonthTransits.month}, expected ${buildMonth}`);
    }
  }
}

const daily = JSON.parse(await readFile(resolve(dataRoot, 'daily.json'), 'utf8'));
const dailyDay = new Date(`${daily.date}T00:00:00.000Z`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(daily.date ?? '') || Number.isNaN(dailyDay.getTime())) {
  fail(`daily.json: invalid date ${daily.date}`);
} else {
  const ageDays = Math.floor((buildDay.getTime() - dailyDay.getTime()) / 86_400_000);
  if (ageDays < 0) {
    fail(`daily.json: date ${daily.date} is in the future`);
  } else if (ageDays > 3) {
    const staleOverride = process.env.CI === 'true' && process.env.ZODIACS_ALLOW_STALE_DAILY === '1';
    if (staleOverride) {
      console.warn(`check-dist: daily.json is ${ageDays} days old; CI-only ZODIACS_ALLOW_STALE_DAILY override accepted.`);
    } else {
      fail(`daily.json: ${daily.date} is ${ageDays} days old (maximum 3); CI may explicitly set ZODIACS_ALLOW_STALE_DAILY=1`);
    }
  }
}

// ---- Report ------------------------------------------------------------------
if (failures.length) {
  console.error(`check-dist: ${failures.length} failure(s)`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check-dist: OK — ${files.length} HTML files, ${searchIndexCount} search entries, `
  + `${feed.items.length} feed items, registry intact.`,
);

// Keep the Registry bridge's data-driven birthday cusp contract inside the
// standard postbuild gate, not only in a manually invoked acceptance command.
await import('./check-registry-bridge-dist.mjs');
