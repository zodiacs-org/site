/*
 * IndexNow for every new, changed or removed URL of zodiacs.org.
 *
 *   node scripts/indexnow-changed-urls.mjs --snapshot <file> [--dry-run]
 *     [--sitemap <file>] [--date YYYY-MM-DD] [--summary <file>]
 *
 * .github/workflows/indexnow-changes.yml runs this after each production
 * deployment. It reads the live sitemap, which lists every indexable page
 * (scripts/check-dist.mjs fails a build whose sitemap misses one), developer
 * docs and dataset pages included, and compares it with the sitemap it last
 * submitted, which the workflow keeps in its cache:
 *
 * - new: a <loc> the last sitemap did not list;
 * - changed: a <loc> whose <lastmod> differs;
 * - removed: a <loc> the sitemap no longer lists, so engines recrawl it;
 * - changed again: a <loc> dated in the recent window (DIGEST_DAYS) whose
 *   content changed since the last run. A sitemap date says only which day a
 *   page last changed, so a second change that day keeps it; the snapshot
 *   records the content digest of each page dated in the window
 *   (contentDigest in scripts/sitemap-rendered-changes.mjs, the digest the
 *   sitemap-date check compares, with the words the page's stylesheets add)
 *   and submits a page whose digest moved. The window reaches back two days,
 *   or to the last run's day if that is earlier, so every run of the next
 *   days still compares a page and keeps its digest.
 *
 * It submits those URLs to IndexNow, which shares them with every
 * participating engine, in requests of at most 10,000 URLs, and only then
 * writes the sitemap it read as the new snapshot. A failed submission writes
 * none, so the next run submits the same URLs again.
 *
 * With no snapshot (the first run, or after the cache expired) it submits the
 * URLs dated within the last 30 days and records the sitemap.
 *
 * The daily workflow still notifies IndexNow of the daily pages once it has
 * seen them live; IndexNow accepts the repeat.
 */
import { appendFile, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { contentDigest, generatedCopy } from './sitemap-rendered-changes.mjs';

export const SITE_ORIGIN = 'https://zodiacs.org';
export const SITEMAP_URL = `${SITE_ORIGIN}/sitemap.xml`;
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
export const SNAPSHOT_SCHEMA = 'zodiacs.indexnow-sitemap.v2';
/** The previous schema, read as a snapshot without content digests. */
const SNAPSHOT_SCHEMA_V1 = 'zodiacs.indexnow-sitemap.v1';
const PAGE_FETCHES_AT_ONCE = 8;
/**
 * How many days before the run's day the digests reach. A page dated in that window is compared on every run, so a
 * change that keeps its date (on its own day, on a deployment or promotion that becomes live a day later, or reaching
 * only the next day's runs) is submitted; about 80 pages are dated on a given day.
 */
export const DIGEST_DAYS = 2;
export const MAX_URLS_PER_REQUEST = 10_000;
export const BOOTSTRAP_DAYS = 30;
const DAY_MS = 86_400_000;
const TRIES = 3;
const KEY_NAME = /^[A-Za-z0-9-]{8,128}$/u;
const XML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function decodeXml(text) {
  return text.replace(/&(amp|lt|gt|quot|apos);/gu, (_entity, name) => XML_ENTITIES[name]);
}

/** Maps each <loc> of a sitemap to its <lastmod>, or null when it has none. */
export function parseSitemap(xml) {
  if (!/<urlset\b/u.test(xml)) throw new Error('The sitemap has no <urlset>.');
  const urls = new Map();
  for (const [, block] of xml.matchAll(/<url>([\s\S]*?)<\/url>/gu)) {
    const rawLoc = block.match(/<loc>\s*([^<]+?)\s*<\/loc>/u)?.[1];
    if (!rawLoc) throw new Error('A sitemap entry has no <loc>.');
    const loc = decodeXml(rawLoc);
    let url;
    try {
      url = new URL(loc);
    } catch {
      throw new Error(`The sitemap lists an invalid URL: ${loc}`);
    }
    if (url.origin !== SITE_ORIGIN) throw new Error(`The sitemap lists a URL outside ${SITE_ORIGIN}: ${loc}`);
    if (url.href !== loc) throw new Error(`The sitemap lists a URL not in canonical form: ${loc}`);
    if (urls.has(loc)) throw new Error(`The sitemap lists ${loc} twice.`);
    const lastmod = block.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/u)?.[1] ?? null;
    urls.set(loc, lastmod);
  }
  if (urls.size === 0) throw new Error('The sitemap lists no URLs.');
  return urls;
}

/** The URLs new, changed or removed between two parsed sitemaps, each sorted. */
export function changedUrls(previous, current) {
  const added = [];
  const changed = [];
  const removed = [];
  for (const [loc, lastmod] of current) {
    if (!previous.has(loc)) added.push(loc);
    else if (previous.get(loc) !== lastmod) changed.push(loc);
  }
  for (const loc of previous.keys()) {
    if (!current.has(loc)) removed.push(loc);
  }
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort() };
}

/** The first day of the bootstrap window that ends on `date` (YYYY-MM-DD). */
export function bootstrapSince(date, days = BOOTSTRAP_DAYS) {
  const time = Date.parse(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(date) || Number.isNaN(time)) throw new Error(`Invalid date: ${date}`);
  return new Date(time - days * DAY_MS).toISOString().slice(0, 10);
}

/** The URLs of a parsed sitemap dated on or after `since`, sorted. */
export function urlsDatedSince(current, since) {
  return [...current]
    .filter(([, lastmod]) => lastmod !== null && lastmod.slice(0, 10) >= since)
    .map(([loc]) => loc)
    .sort();
}

/**
 * The site's IndexNow key: the one text file in public/ whose name is a key
 * and whose body is that same key, as IndexNow verifies at keyLocation.
 */
export async function readIndexNowKey(publicDir) {
  const keys = [];
  for (const name of (await readdir(publicDir)).sort()) {
    const key = name.endsWith('.txt') ? name.slice(0, -4) : '';
    if (!KEY_NAME.test(key)) continue;
    if ((await readFile(resolve(publicDir, name), 'utf8')).trim() === key) keys.push(key);
  }
  if (keys.length !== 1) throw new Error(`Expected one IndexNow key file in public/, found ${keys.length}.`);
  return { key: keys[0], keyLocation: `${SITE_ORIGIN}/${keys[0]}.txt` };
}

const byKey = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

export function snapshotOf(urls, readAt, digests = new Map()) {
  return {
    schema: SNAPSHOT_SCHEMA,
    sitemap: SITEMAP_URL,
    readAt,
    urls: Object.fromEntries([...urls].sort(byKey)),
    // The content digest of each page dated in the recent window, as read on this run.
    digests: Object.fromEntries([...digests].sort(byKey)),
  };
}

/** The URLs of a parsed sitemap dated from `since` through `until` (YYYY-MM-DD), sorted. */
export function urlsDatedBetween(current, since, until) {
  return [...current]
    .filter(([, lastmod]) => lastmod !== null && lastmod.slice(0, 10) >= since && lastmod.slice(0, 10) <= until)
    .map(([loc]) => loc)
    .sort();
}

/**
 * Of the URLs this run digested, those whose content digest differs from the last run's, or that the last run did
 * not digest; `skip` holds URLs already submitted as new or changed.
 */
export function changedSameDay(digests, previousDigests, skip = new Set()) {
  return [...digests]
    .filter(([loc, digest]) => !skip.has(loc) && previousDigests?.get(loc) !== digest)
    .map(([loc]) => loc)
    .sort();
}

/** The previous snapshot as { readAt, urls, digests }, or null when there is none. */
export async function readSnapshot(path) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const snapshot = JSON.parse(text);
  if (![SNAPSHOT_SCHEMA, SNAPSHOT_SCHEMA_V1].includes(snapshot?.schema) || snapshot.sitemap !== SITEMAP_URL
    || typeof snapshot.urls !== 'object' || snapshot.urls === null
    || (snapshot.schema === SNAPSHOT_SCHEMA && (typeof snapshot.digests !== 'object' || snapshot.digests === null))) {
    throw new Error(`${path} is not a ${SNAPSHOT_SCHEMA} snapshot of ${SITEMAP_URL}.`);
  }
  return {
    readAt: snapshot.readAt,
    urls: new Map(Object.entries(snapshot.urls)),
    // A v1 snapshot recorded no digests: every page dated the run's day counts as changed once.
    digests: snapshot.schema === SNAPSHOT_SCHEMA ? new Map(Object.entries(snapshot.digests)) : null,
  };
}

async function writeSnapshot(path, snapshot) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(temporary, path);
}

async function fetchSitemap({ fetchImpl, tries, pause }) {
  let problem = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetchImpl(SITEMAP_URL, {
        headers: { accept: 'application/xml', 'user-agent': 'zodiacs-indexnow/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 200) return await response.text();
      problem = `HTTP ${response.status}`;
    } catch (error) {
      problem = error.message;
    }
    if (attempt < tries) await pause(attempt * 5_000);
  }
  throw new Error(`Could not read ${SITEMAP_URL}: ${problem}`);
}

async function fetchText(url, accept, { fetchImpl, tries, pause }) {
  let problem = null;
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept, 'user-agent': 'zodiacs-indexnow/1.0' },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 200) return await response.text();
      problem = `HTTP ${response.status}`;
    } catch (error) {
      problem = error.message;
    }
    if (attempt < tries) await pause(attempt * 5_000);
  }
  throw new Error(`Could not read ${url}: ${problem}`);
}

/**
 * The content digest of each live page in `locs`, a few at a time: of what the page says, with the words its
 * stylesheets add (each stylesheet on this site read once).
 */
export async function digestPages(locs, { fetchImpl = fetch, tries = TRIES, pause = wait } = {}) {
  const options = { fetchImpl, tries, pause };
  const sheets = new Map();
  const stylesheetsOf = (page) => (href) => {
    const url = new URL(href, page);
    if (url.origin !== SITE_ORIGIN) return Promise.resolve('');
    if (!sheets.has(url.href)) sheets.set(url.href, fetchText(url.href, 'text/css', options));
    return sheets.get(url.href);
  };
  const digests = new Map();
  for (let start = 0; start < locs.length; start += PAGE_FETCHES_AT_ONCE) {
    const batch = locs.slice(start, start + PAGE_FETCHES_AT_ONCE);
    const read = await Promise.all(batch.map(async (loc) => {
      const html = await fetchText(loc, 'text/html', options);
      const { pathname } = new URL(loc);
      const isHtml = pathname.endsWith('/') || pathname.endsWith('.html');
      const generated = isHtml ? await generatedCopy(html, stylesheetsOf(loc), { page: loc }) : [];
      return contentDigest(Buffer.from(html), pathname, { generated });
    }));
    batch.forEach((loc, index) => digests.set(loc, read[index]));
  }
  return digests;
}

/**
 * Posts the URLs to IndexNow in requests of at most `maxPerRequest`. Retries
 * a request that failed in transit or with a server error; any other answer
 * but 200 or 202 fails the run.
 */
export async function submitUrls(urls, { key, keyLocation, fetchImpl = fetch, tries = TRIES, pause = wait, maxPerRequest = MAX_URLS_PER_REQUEST }) {
  const statuses = [];
  for (let start = 0; start < urls.length; start += maxPerRequest) {
    const body = JSON.stringify({ host: new URL(SITE_ORIGIN).host, key, keyLocation, urlList: urls.slice(start, start + maxPerRequest) });
    let problem = null;
    for (let attempt = 1; attempt <= tries; attempt += 1) {
      let response;
      try {
        response = await fetchImpl(INDEXNOW_ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json; charset=utf-8' },
          body,
          signal: AbortSignal.timeout(30_000),
        });
      } catch (error) {
        problem = error.message;
      }
      if (response) {
        if (response.status === 200 || response.status === 202) {
          statuses.push(response.status);
          problem = null;
          break;
        }
        const text = (await response.text()).trim().slice(0, 300);
        problem = `HTTP ${response.status}${text ? `: ${text}` : ''}`;
        if (response.status < 500) break;
      }
      if (attempt < tries) await pause(attempt * 5_000);
    }
    if (problem) throw new Error(`IndexNow refused the submission: ${problem}`);
  }
  return statuses;
}

/**
 * Reads the sitemap, submits what changed since the snapshot, and writes the
 * new snapshot. Throws, writing nothing, when the sitemap or a page dated the
 * run's day cannot be read, the sitemap cannot be parsed or has lost more than
 * half its URLs, or IndexNow refuses the URLs.
 */
export async function runIndexNow({
  snapshotPath,
  publicDir,
  sitemapXml = null,
  date = new Date().toISOString().slice(0, 10),
  dryRun = false,
  now = () => new Date().toISOString(),
  fetchImpl = fetch,
  tries = TRIES,
  pause = wait,
  maxPerRequest = MAX_URLS_PER_REQUEST,
}) {
  const readAt = now();
  const current = parseSitemap(sitemapXml ?? await fetchSitemap({ fetchImpl, tries, pause }));
  const previous = await readSnapshot(snapshotPath);
  let result;
  if (previous) {
    if (current.size < previous.urls.size / 2) {
      throw new Error(`The sitemap lists ${current.size} URLs, fewer than half the ${previous.urls.size} it listed at ${previous.readAt}; refusing to submit the rest as removed.`);
    }
    const changes = changedUrls(previous.urls, current);
    result = {
      mode: 'changes',
      previousReadAt: previous.readAt,
      previousCount: previous.urls.size,
      ...changes,
      urls: [...changes.added, ...changes.changed, ...changes.removed].sort(),
    };
  } else {
    const since = bootstrapSince(date);
    result = { mode: 'bootstrap', since, urls: urlsDatedSince(current, since) };
  }
  // A page dated in the recent window can have changed again without a new date: digest every page dated from the
  // DIGEST_DAYS days before the run's day, or the last run's day if that is earlier, through the run's day.
  const windowStart = bootstrapSince(date, DIGEST_DAYS);
  const lastRunDay = previous ? previous.readAt.slice(0, 10) : date;
  const since = lastRunDay < windowStart ? lastRunDay : windowStart;
  const digests = await digestPages(urlsDatedBetween(current, since, date), { fetchImpl, tries, pause });
  result.digested = digests.size;
  result.sameDay = previous ? changedSameDay(digests, previous.digests, new Set(result.urls)) : [];
  result.urls = [...result.urls, ...result.sameDay].sort();
  result.readAt = readAt;
  result.count = current.size;
  result.dryRun = dryRun;
  result.statuses = [];
  if (dryRun) return result;
  if (result.urls.length > 0) {
    const { key, keyLocation } = await readIndexNowKey(publicDir);
    result.statuses = await submitUrls(result.urls, { key, keyLocation, fetchImpl, tries, pause, maxPerRequest });
  }
  await writeSnapshot(snapshotPath, snapshotOf(current, readAt, digests));
  return result;
}

const LISTED = 500;

export function renderReport(result) {
  const lines = ['## IndexNow', ''];
  const submitted = result.dryRun
    ? `Would submit ${result.urls.length} URLs (dry run; nothing was sent or recorded).`
    : result.urls.length === 0
      ? 'Nothing to submit.'
      : `Submitted ${result.urls.length} URLs to IndexNow (HTTP ${[...new Set(result.statuses)].join(', ')}).`;
  if (result.mode === 'changes') {
    lines.push(`The sitemap read at ${result.readAt} lists ${result.count} URLs. Against the ${result.previousCount} submitted from the sitemap read at ${result.previousReadAt}: ${result.added.length} new, ${result.changed.length} changed, ${result.removed.length} removed, and ${result.sameDay.length} of the ${result.digested} dated in the last ${DIGEST_DAYS + 1} days changed again since that run.`);
  } else {
    lines.push(`No earlier sitemap was recorded. The sitemap read at ${result.readAt} lists ${result.count} URLs; ${result.urls.length} are dated ${result.since} or later.`);
  }
  lines.push('', submitted, '');
  if (result.urls.length > 0) {
    lines.push('<details><summary>URLs</summary>', '');
    for (const url of result.urls.slice(0, LISTED)) lines.push(`- ${url}`);
    if (result.urls.length > LISTED) lines.push(`- … and ${result.urls.length - LISTED} more`);
    lines.push('', '</details>', '');
  }
  return `${lines.join('\n')}\n`;
}

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`);
  return value;
}

async function main() {
  const snapshotPath = argument('--snapshot');
  if (!snapshotPath) throw new Error('--snapshot <file> is required');
  const sitemap = argument('--sitemap');
  const summary = argument('--summary') ?? process.env.GITHUB_STEP_SUMMARY ?? null;
  const result = await runIndexNow({
    snapshotPath: resolve(snapshotPath),
    publicDir: resolve(import.meta.dirname, '../public'),
    sitemapXml: sitemap ? await readFile(sitemap, 'utf8') : null,
    date: argument('--date') ?? new Date().toISOString().slice(0, 10),
    dryRun: process.argv.includes('--dry-run'),
  });
  const report = renderReport(result);
  process.stdout.write(report);
  if (summary) await appendFile(summary, report);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
