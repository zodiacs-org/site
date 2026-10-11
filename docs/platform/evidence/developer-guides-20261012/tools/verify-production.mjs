/**
 * After the merge deploys: what canonical production serves for the developer
 * guides. For the index and each of the 18 guides it GETs the page and its
 * Markdown twin, and it GETs llms.txt, llms-full.txt and the sitemap. They are
 * compared with a local build of the merge commit made with the feature flags
 * unset, as CI's main build is:
 *
 * - the Markdown twins and both llms files byte for byte;
 * - each page's guide article byte for byte, and its text for the content the
 *   twins verifier requires of the build. The rest of the page must hold the
 *   build's page in order, and only what production's flags insert: two
 *   attributes on <html>, the analytics script and the footer's email signup;
 * - the sitemap by its entries: every <url> entry of the build must be served
 *   as built, and any entry production adds is listed.
 *
 * Chromium then opens every page at 360 and 1280 px, as the browser verifier
 * does against a local preview. Its requests to analytics are aborted, so the
 * check adds no visit to the site's analytics.
 *
 * Which deployment the zodiacs.org alias names, and its commit, is read before
 * and after this run through the Vercel connector and recorded beside the
 * output; ALIAS_BEFORE and ALIAS_AFTER pass those reads in as JSON. Prints
 * JSON; exits non-zero on any failed check.
 *
 *   EXPECTED_COMMIT=<merge commit> ALIAS_BEFORE='{…}' node verify-production.mjs <site checkout built at that commit> > out.json
 *   ALIAS_AFTER='{…}' node verify-production.mjs --after out.json        # the read made after the run
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = 'https://zodiacs.org';
/** A connector read must name the deployment and the alias's update time before anything is compared. */
const complete = (read, name) => {
  assert.ok(read && typeof read.deploymentId === 'string' && /^dpl_[A-Za-z0-9]+$/u.test(read.deploymentId),
    `${name} must name the deployment the alias points at`);
  assert.ok(Number.isInteger(read.aliasUpdatedAt) && read.aliasUpdatedAt > 0, `${name} must carry the alias's updatedAt`);
  return read;
};
if (process.argv[2] === '--after') {
  // Second step: add the connector's read made after the run, and the check that it did not move.
  const record = JSON.parse(readFileSync(process.argv[3], 'utf8'));
  const after = complete(JSON.parse(process.env.ALIAS_AFTER ?? 'null'), 'ALIAS_AFTER');
  complete(record.alias.before, 'the recorded ALIAS_BEFORE');
  record.alias.after = after;
  // The read's fields go first, so nothing it carries can replace the computed name or result.
  record.checks.push({ ...after, name: 'alias unchanged during the checks', ok: after.deploymentId === record.alias.before.deploymentId
    && after.aliasUpdatedAt === record.alias.before.aliasUpdatedAt });
  record.ok = record.checks.every((item) => item.ok);
  console.log(JSON.stringify(record, null, 2));
  if (!record.ok) process.exitCode = 1;
  process.exit();
}

const root = resolve(process.argv[2] ?? '.');
const expected = process.env.EXPECTED_COMMIT ?? '';
assert.match(expected, /^[0-9a-f]{40}$/u, 'EXPECTED_COMMIT must be the full merge commit');
// The local build is the reference, so its checkout must be the merge, unmodified.
const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
assert.equal(git('rev-parse', 'HEAD'), expected, 'the checkout must be at the merge commit');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '', 'the checkout must have no tracked changes');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const guides = JSON.parse(readFileSync(resolve(root, 'src/data/developer-guides.json'), 'utf8'));
const candidate = JSON.parse(readFileSync(resolve(root, 'src/data/platform-engine-candidate.json'), 'utf8'));
assert.equal(guides.length, 18);
const decode = (text) => text
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#(?:39|x27);/gi, "'").replace(/&amp;/g, '&');

async function get(path) {
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  return { status: response.status, type: response.headers.get('content-type'), bytes: Buffer.from(await response.arrayBuffer()) };
}
/** The served bytes against the local build's file at the same path. */
async function compare(path, file) {
  const served = await get(path);
  const built = readFileSync(resolve(root, 'dist', file));
  return { ...served, built, identical: served.status === 200 && served.bytes.equals(built),
    detail: { status: served.status, contentType: served.type, bytes: served.bytes.length, sha256: sha256(served.bytes), builtSha256: sha256(built) } };
}
/**
 * The served page against the built one. The build's page is split at each '>',
 * and every piece must appear in the served page in order; what the served page
 * has between them are its insertions. Production's flags insert the analytics
 * script and the footer's email signup, and two attributes on <html>.
 */
const FLAG_ATTRIBUTES = '<html lang="en" data-daily-email-lifecycle data-guide-analytics-boundary';
function insertions(served, built) {
  const attributes = served.includes(FLAG_ATTRIBUTES);
  const pieces = served.replace(FLAG_ATTRIBUTES, '<html lang="en"').split('>');
  const expected = built.split('>');
  let next = 0;
  const runs = [];
  let run = [];
  for (const piece of pieces) {
    if (next < expected.length && piece === expected[next]) {
      next += 1;
      if (run.length) runs.push(run.join('>'));
      run = [];
    } else run.push(piece);
  }
  if (run.length) runs.push(run.join('>'));
  const kinds = runs.map((text) => (/https:\/\/plausible\.io\/js\//u.test(text) && !/data-email-capture-shell/u.test(text) ? 'analytics script'
    : /data-email-capture-shell/u.test(text) && !/plausible/u.test(text) ? 'footer email signup' : 'unexplained'));
  return { buildInOrder: next === expected.length, flagAttributes: attributes, insertions: kinds,
    ok: next === expected.length && attributes && kinds.join() === 'analytics script,footer email signup' };
}
/** The page's one guide article, from its opening tag to the matching close. */
function article(bytes) {
  const text = bytes.toString('utf8');
  const start = text.search(/<article\b[^>]*\bdata-developer-guide=/u);
  if (start < 0) return null;
  const tags = /<(\/?)article\b[^>]*>/gu;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag = tags.exec(text); tag; tag = tags.exec(text)) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) {
      if (text.slice(tag.index + tag[0].length).search(/<article\b[^>]*\bdata-developer-guide=/u) >= 0) return null;
      return text.slice(start, tag.index + tag[0].length);
    }
  }
  return null;
}

const checks = [];
// Detail first, so no field it carries can replace the check's name or result.
const check = (name, ok, detail = {}) => checks.push({ ...detail, name, ok: Boolean(ok) });
const before = complete(JSON.parse(process.env.ALIAS_BEFORE ?? 'null'), 'ALIAS_BEFORE');
check('alias names a READY production deployment of the merge', before.readyState === 'READY' && before.target === 'production'
  && before.githubCommitSha === expected, before);

const routes = [{ slug: 'index', title: 'Developer guides', html: '/developers/docs/', htmlFile: 'developers/docs/index.html',
  markdown: '/developers/docs/index.md', markdownFile: 'developers/docs/index.md' },
...guides.map((guide) => ({ slug: guide.slug, title: guide.title, guide, html: `/developers/docs/${guide.slug}/`,
  htmlFile: `developers/docs/${guide.slug}/index.html`, markdown: `/developers/docs/${guide.slug}.md`, markdownFile: `developers/docs/${guide.slug}.md` }))];

for (const route of routes) {
  const html = await compare(route.html, route.htmlFile);
  const markdown = await compare(route.markdown, route.markdownFile);
  const servedArticle = article(html.bytes);
  const builtArticle = article(html.built);
  const articleIdentical = html.status === 200 && servedArticle !== null && servedArticle === builtArticle;
  const outside = insertions(html.bytes.toString('utf8'), html.built.toString('utf8'));
  // The same content the twins verifier requires of the build, here of what production serves.
  const page = decode(html.bytes.toString('utf8'));
  const twin = markdown.bytes.toString('utf8');
  const missing = [];
  if (route.guide) {
    const { guide } = route;
    if (!page.includes(`data-developer-guide="${guide.slug}"`)) missing.push('guide attribute');
    for (const text of [guide.title, guide.description, ...guide.sections.flatMap((section) => [section.heading, ...section.paragraphs,
      ...(section.code ? [section.code.source] : [])])]) {
      if (!page.includes(text)) missing.push('HTML content');
      if (!twin.includes(text)) missing.push('Markdown content');
    }
    if (!page.includes(candidate.version) || !twin.includes(candidate.version)) missing.push('release identity');
    if (guide.installation && (!page.includes(candidate.sha256) || !twin.includes(candidate.sha256))) missing.push('archive digest');
    if (guide.installation && (!page.includes(`npm install ${candidate.name}@${candidate.version}`)
      || !twin.includes(`npm install ${candidate.name}@${candidate.version}`))) missing.push('npm install line');
  } else {
    for (const guide of guides) {
      if (!page.includes(`/developers/docs/${guide.slug}/`) || !twin.includes(`/developers/docs/${guide.slug}/`)) missing.push(`index entry ${guide.slug}`);
    }
  }
  check(`${route.html}: its guide article and its twin are the merge's build, and the page is the build's with production's flags`,
    articleIdentical && outside.ok && markdown.identical && missing.length === 0,
    { html: { ...html.detail, article: { identical: articleIdentical, bytes: servedArticle === null ? null : Buffer.byteLength(servedArticle),
      sha256: servedArticle === null ? null : sha256(servedArticle), builtSha256: builtArticle === null ? null : sha256(builtArticle) },
    wholePageIdentical: html.identical, outsideArticle: outside }, markdown: markdown.detail, missing: [...new Set(missing)] });
}

for (const file of ['llms.txt', 'llms-full.txt']) {
  const listing = await compare(`/${file}`, file);
  const text = listing.bytes.toString('utf8');
  const unlisted = guides.filter((guide) => !text.includes(`https://zodiacs.org/developers/docs/${guide.slug}/`)
    || !text.includes(`https://zodiacs.org/developers/docs/${guide.slug}.md`)).map((guide) => guide.slug);
  check(`/${file} is the merge's build and lists every guide and twin`, listing.identical && unlisted.length === 0, { ...listing.detail, unlisted });
}
const sitemap = await compare('/sitemap.xml', 'sitemap.xml');
/** Each <url> entry, whole: its location, alternates, lastmod and priority. */
const entries = (bytes) => bytes.toString('utf8').match(/<url>[\s\S]*?<\/url>/gu) ?? [];
const location = (entry) => /<loc>([^<]+)<\/loc>/u.exec(entry)?.[1] ?? null;
const servedEntries = entries(sitemap.bytes);
const builtEntries = entries(sitemap.built);
const served = new Set(servedEntries);
const built = new Set(builtEntries);
const notServed = builtEntries.filter((entry) => !served.has(entry)).map(location);
const added = servedEntries.filter((entry) => !built.has(entry)).map(location);
const absent = routes.filter((route) => !builtEntries.some((entry) => location(entry) === `https://zodiacs.org${route.html}`)).map((route) => route.slug);
check('/sitemap.xml serves every entry of the merge\'s build, every guide page among them', sitemap.status === 200
  && builtEntries.length > 0 && notServed.length === 0 && absent.length === 0,
  { ...sitemap.detail, builtEntries: builtEntries.length, servedEntries: servedEntries.length, notServed, absent, addedByProduction: added });

// Every page in Chromium at both widths, with the browser verifier's assertions, against production.
const require = createRequire(resolve(root, 'package.json'));
const { chromium } = require('playwright-core');
const { findChromium, STABLE_CHROMIUM_ARGS } = await import(pathToFileURL(resolve(root, 'tests/visual/browser.mjs')).href);
const browser = await chromium.launch({ executablePath: await findChromium(), headless: true, args: STABLE_CHROMIUM_ARGS });
const navigations = [];
let analyticsAborted = 0;
const analytics = (url) => url.hostname === 'plausible.io' || url.hostname.endsWith('.plausible.io')
  || /^\/_vercel\/(?:insights|speed-insights)\//u.test(url.pathname);
try {
  for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'en-US', timezoneId: 'UTC' });
    await context.route((url) => analytics(url), (route) => {
      analyticsAborted += 1;
      return route.abort();
    });
    try {
      for (const route of routes) {
        const page = await context.newPage();
        const pageErrors = [];
        const calculationRequests = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('request', (request) => {
          const path = new URL(request.url()).pathname;
          if (path.startsWith('/api/v1/') || /\/_astro\/full\.[^/]+\.js$/.test(path)
            || /\/api\/.*(?:moon|chart|calculate)/i.test(path)) calculationRequests.push(path);
        });
        const failures = [];
        try {
          const response = await page.goto(BASE + route.html, { waitUntil: 'load', timeout: 30000 });
          if (response?.status() !== 200) failures.push(`status ${response?.status()}`);
          if (await page.locator('h1').textContent() !== route.title) failures.push('h1');
          if (await page.locator('article[data-developer-guide]').getAttribute('data-developer-guide') !== route.slug) failures.push('guide attribute');
          if (await page.getByRole('link', { name: 'Read this page as Markdown', exact: true }).getAttribute('href') !== route.markdown) failures.push('Markdown link');
          if (!await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) failures.push('overflow');
        } catch (error) {
          failures.push(String(error.message).split('\n')[0]);
        } finally {
          await page.close();
        }
        navigations.push({ path: route.html, width, failures, pageErrors, calculationRequests,
          ok: failures.length === 0 && pageErrors.length === 0 && calculationRequests.length === 0 });
      }
    } finally {
      await context.close();
    }
  }
  check('every page in Chromium at 360 and 1280 px: 200, its heading, its twin link, no overflow, no page error, no calculation',
    navigations.length === 38 && navigations.every((item) => item.ok),
    { browser: await browser.version(), navigations: navigations.length, analyticsRequestsAborted: analyticsAborted, failed: navigations.filter((item) => !item.ok) });
} finally {
  await browser.close();
}

const ok = checks.every((item) => item.ok);
console.log(JSON.stringify({ schema: 'zodiacs.developer-guides-production.v1', base: BASE, expectedCommit: expected,
  engine: { name: candidate.name, version: candidate.version, sha256: candidate.sha256 }, checkedAt: new Date().toISOString(),
  alias: { before }, ok, checks }, null, 2));
if (!ok) process.exitCode = 1;
