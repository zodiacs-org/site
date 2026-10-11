/**
 * After the merge deploys: what canonical production serves for the developer
 * guides. For the index and each of the 18 guides it GETs the page and its
 * Markdown twin, and it GETs llms.txt, llms-full.txt and the sitemap. They are
 * compared with two local builds of the merge commit:
 *
 * - the build with the feature flags unset, as CI's main build is (the one the
 *   guide verifiers check), in the checkout's dist/;
 * - the build with production's feature flags, made with the environment of
 *   CI's "Build with production's feature flags" job (site-check.yml), whose
 *   public values are CI stand-ins.
 *
 * What must hold:
 * - each page is the production-flags build's page, byte for byte, except where
 *   that build has one of the CI's stand-in values, and there production's
 *   value must be of the same kind (STAND_INS below). Nothing else may differ:
 *   not a piece more, not a piece less;
 * - each page's guide article is also the flags-unset build's, byte for byte,
 *   and its text has the content the twins verifier requires of that build;
 * - the Markdown twins and both llms files are both builds' bytes;
 * - the sitemap is the production-flags build's bytes, every guide page in it.
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
 *   EXPECTED_COMMIT=<merge commit> ALIAS_BEFORE='{…}' node verify-production.mjs <checkout built at that commit, flags unset> <production-flags dist> > out.json
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
/**
 * The public values CI's production-flags build uses as stand-ins
 * (.github/workflows/site-check.yml), each with the form production's own value
 * must have where the build has the stand-in.
 */
const STAND_INS = new Map([
  ['https://plausible.io/js/script.js', /^https:\/\/plausible\.io\/js\/[A-Za-z0-9._-]+\.js$/u],
  ['sb_publishable_ci_stand_in', /^sb_publishable_[A-Za-z0-9_-]+$/u],
  ['ci-stand-in-vapid-public-key', /^[A-Za-z0-9_-]{80,100}$/u],
  ['http://127.0.0.1:54321', /^https:\/\/[a-z0-9]+\.supabase\.co$/u],
]);

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
const flagsDist = process.argv[3] ? resolve(process.argv[3]) : null;
assert.ok(flagsDist, 'the production-flags build is the second argument');
const expected = process.env.EXPECTED_COMMIT ?? '';
assert.match(expected, /^[0-9a-f]{40}$/u, 'EXPECTED_COMMIT must be the full merge commit');
// The local builds are the reference, so the checkout must be the merge, unmodified.
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
/** The served bytes beside both builds' files at the same path. */
async function compare(path, file) {
  const served = await get(path);
  const built = readFileSync(resolve(root, 'dist', file));
  const flagged = readFileSync(resolve(flagsDist, file));
  return { ...served, built, flagged,
    detail: { status: served.status, contentType: served.type, bytes: served.bytes.length, sha256: sha256(served.bytes),
      builtSha256: sha256(built), flagsBuildSha256: sha256(flagged) } };
}

/** A piece's string literals, and the piece with each replaced by a marker. */
const LITERAL = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'/gu;
function literals(piece) {
  const values = [];
  const skeleton = piece.replace(LITERAL, (_whole, double, single) => {
    values.push(double ?? single);
    return '\u0000';
  });
  return { skeleton, values };
}
/**
 * The served page against the production-flags build's. Both are split at each
 * '>'; they must have the same pieces, and a piece may differ only in string
 * literals where the build's is a CI stand-in and the served one has the form
 * production's value must have. Returns what was replaced, by length and digest.
 */
function againstFlagsBuild(served, flagged) {
  const servedPieces = served.split('>');
  const flaggedPieces = flagged.split('>');
  const replaced = [];
  const problems = [];
  if (servedPieces.length !== flaggedPieces.length) {
    problems.push(`${servedPieces.length} pieces served, ${flaggedPieces.length} built`);
    return { ok: false, replaced, problems };
  }
  for (let index = 0; index < servedPieces.length; index += 1) {
    if (servedPieces[index] === flaggedPieces[index]) continue;
    const a = literals(servedPieces[index]);
    const b = literals(flaggedPieces[index]);
    if (a.skeleton !== b.skeleton || a.values.length !== b.values.length) {
      problems.push(`piece ${index} differs outside its string literals`);
      continue;
    }
    for (let at = 0; at < a.values.length; at += 1) {
      if (a.values[at] === b.values[at]) continue;
      const form = STAND_INS.get(b.values[at]);
      if (!form) problems.push(`piece ${index}: a literal differs where the build has no stand-in`);
      else if (!form.test(a.values[at])) problems.push(`piece ${index}: the value served for ${b.values[at]} is not of its form`);
      else replaced.push({ standIn: b.values[at], piece: index, servedLength: a.values[at].length, servedSha256: sha256(a.values[at]) });
    }
  }
  return { ok: problems.length === 0, replaced, problems };
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
  const page = html.status === 200 ? againstFlagsBuild(html.bytes.toString('utf8'), html.flagged.toString('utf8'))
    : { ok: false, replaced: [], problems: [`status ${html.status}`] };
  const servedArticle = article(html.bytes);
  const builtArticle = article(html.built);
  const articleIdentical = html.status === 200 && servedArticle !== null && servedArticle === builtArticle;
  const twinIdentical = markdown.status === 200 && markdown.bytes.equals(markdown.built) && markdown.bytes.equals(markdown.flagged);
  // The same content the twins verifier requires of the build, here of what production serves.
  const text = decode(html.bytes.toString('utf8'));
  const twin = markdown.bytes.toString('utf8');
  const missing = [];
  if (route.guide) {
    const { guide } = route;
    if (!text.includes(`data-developer-guide="${guide.slug}"`)) missing.push('guide attribute');
    for (const part of [guide.title, guide.description, ...guide.sections.flatMap((section) => [section.heading, ...section.paragraphs,
      ...(section.code ? [section.code.source] : [])])]) {
      if (!text.includes(part)) missing.push('HTML content');
      if (!twin.includes(part)) missing.push('Markdown content');
    }
    if (!text.includes(candidate.version) || !twin.includes(candidate.version)) missing.push('release identity');
    if (guide.installation && (!text.includes(candidate.sha256) || !twin.includes(candidate.sha256))) missing.push('archive digest');
    if (guide.installation && (!text.includes(`npm install ${candidate.name}@${candidate.version}`)
      || !twin.includes(`npm install ${candidate.name}@${candidate.version}`))) missing.push('npm install line');
  } else {
    for (const guide of guides) {
      if (!text.includes(`/developers/docs/${guide.slug}/`) || !twin.includes(`/developers/docs/${guide.slug}/`)) missing.push(`index entry ${guide.slug}`);
    }
  }
  check(`${route.html}: the production-flags build's page, with its guide article and its twin as built`,
    page.ok && articleIdentical && twinIdentical && missing.length === 0,
    { html: { ...html.detail, standInsReplaced: page.replaced, problems: page.problems,
      article: { identical: articleIdentical, bytes: servedArticle === null ? null : Buffer.byteLength(servedArticle),
        sha256: servedArticle === null ? null : sha256(servedArticle), builtSha256: builtArticle === null ? null : sha256(builtArticle) } },
    markdown: { ...markdown.detail, identical: twinIdentical }, missing: [...new Set(missing)] });
}

for (const file of ['llms.txt', 'llms-full.txt']) {
  const listing = await compare(`/${file}`, file);
  const identical = listing.status === 200 && listing.bytes.equals(listing.built) && listing.bytes.equals(listing.flagged);
  const text = listing.bytes.toString('utf8');
  const unlisted = guides.filter((guide) => !text.includes(`https://zodiacs.org/developers/docs/${guide.slug}/`)
    || !text.includes(`https://zodiacs.org/developers/docs/${guide.slug}.md`)).map((guide) => guide.slug);
  check(`/${file} is both builds' bytes and lists every guide and twin`, identical && unlisted.length === 0, { ...listing.detail, unlisted });
}
const sitemap = await compare('/sitemap.xml', 'sitemap.xml');
const sitemapText = sitemap.bytes.toString('utf8');
const absent = routes.filter((route) => !sitemapText.includes(`<loc>https://zodiacs.org${route.html}</loc>`)).map((route) => route.slug);
check('/sitemap.xml is the production-flags build\'s bytes, every guide page in it',
  sitemap.status === 200 && sitemap.bytes.equals(sitemap.flagged) && absent.length === 0,
  { ...sitemap.detail, identicalToFlagsUnsetBuild: sitemap.bytes.equals(sitemap.built), absent });

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
console.log(JSON.stringify({ schema: 'zodiacs.developer-guides-production.v2', base: BASE, expectedCommit: expected,
  engine: { name: candidate.name, version: candidate.version, sha256: candidate.sha256 }, checkedAt: new Date().toISOString(),
  alias: { before }, ok, checks }, null, 2));
if (!ok) process.exitCode = 1;
