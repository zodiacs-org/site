/** Validate the structured-data contracts over a completed production build. */
import { readdirSync, readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, relative, resolve, sep } from 'node:path';
import { EDITORIAL_METADATA } from '../src/lib/editorial-metadata.mjs';
import { editorialGraphErrors, editorialSitemapErrors } from './editorial-metadata-checks.mjs';
import { organizationIdentityErrors } from './organization-identity.mjs';
import { WEB_APPLICATION_PATHS } from '../src/strings/seo.en.mjs';
import { eventArticleDateFailures } from './event-article-dates.mjs';
import {
  DEVELOPER_PAGES, SKY_DATA_FOLDERS, developerExpectations, developerStructuredDataErrors, servesUrlIn, skyDataFiles,
} from './developer-structured-data-checks.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(repo, 'dist');
const SITE_ORIGIN = 'https://zodiacs.org';
const eventPublication = JSON.parse(await readFile(resolve(repo, 'src/data/events-publication.json'), 'utf8'));
const publishedEvents = new Map(eventPublication.pages.map((event) => [event.path, event]));
const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const signSlugs = new Set(SIGN_SLUGS);
const failures = [];
const seenEditorial = new Set();
const seenDeveloper = new Set();
const servesUrl = servesUrlIn(dist);
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const developerExpected = developerExpectations({
  candidate: readJson(resolve(repo, 'src/data/platform-engine-candidate.json')),
  manifest: readJson(resolve(repo, 'public/examples/mcp-server.json')),
  conformanceSource: readJson(resolve(repo, 'src/data/conformance/source.json')),
  conformanceSummary: readJson(resolve(repo, 'src/data/conformance/summary.json')),
  skyIndex: readJson(resolve(dist, 'api/v1/index.json')),
  skyFiles: skyDataFiles(Object.fromEntries(SKY_DATA_FOLDERS.map((folder) => [folder, readdirSync(resolve(dist, 'api/v1', folder)).sort()]))),
  benchmarkItems: readJson(resolve(repo, 'public/developers/sky-benchmark/v0/items.json')),
});
let documentCount = 0;
let nodeCount = 0;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? htmlFiles(path) : (entry.name.endsWith('.html') ? [path] : []);
  }));
  return nested.flat();
}

function attr(html, name, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  return tags.some((tag) => {
    const get = (key) => tag.match(new RegExp(`\\b${key}=(?:"([^"]*)"|'([^']*)')`, 'i'))?.slice(1).find(Boolean);
    return get(name)?.toLowerCase() === value && get('content')?.toLowerCase().includes('noindex');
  });
}

function canonicalHrefs(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];
    const rel = tag.match(/\brel=(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find((value) => value !== undefined);
    if (!rel?.toLowerCase().split(/\s+/u).includes('canonical')) return [];
    const href = tag.match(/\bhref=(?:"([^"]*)"|'([^']*)')/i)?.slice(1).find((value) => value !== undefined);
    return [href ?? ''];
  });
}

function siteUrl(value, label, field, expected, { allowHash = false } = {}) {
  try {
    if (typeof value !== 'string' || !value) throw new Error('empty');
    const url = new URL(value);
    if (
      url.origin !== SITE_ORIGIN
      || url.username
      || url.password
      || url.search
      || (!allowHash && url.hash)
    ) throw new Error('not a canonical same-origin URL');
    if (expected && url.href !== expected) throw new Error(`expected ${expected}`);
    return url;
  } catch {
    failures.push(`${label}: ${field} must be ${expected ?? `an absolute ${SITE_ORIGIN} URL`}`);
    return null;
  }
}

function structuredDocuments(html, label) {
  const documents = [];
  const scripts = html.matchAll(/<script\b[^>]*type=(?:"application\/ld\+json"|'application\/ld\+json')[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const document = JSON.parse(match[1]);
      if (document['@context'] !== 'https://schema.org') {
        failures.push(`${label}: JSON-LD document is missing the schema.org context`);
      }
      documents.push(document);
    } catch (error) {
      failures.push(`${label}: invalid JSON-LD — ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return documents;
}

function nodesOf(documents) {
  return documents.flatMap((document) => Array.isArray(document['@graph']) ? document['@graph'] : [document]);
}

function hasType(node, type) {
  return Array.isArray(node?.['@type']) ? node['@type'].includes(type) : node?.['@type'] === type;
}

function validateBreadcrumb(node, label, pathname) {
  const items = node.itemListElement;
  if (!Array.isArray(items) || items.length < 2) {
    failures.push(`${label}: BreadcrumbList needs at least two ListItem entries`);
    return;
  }
  items.forEach((item, index) => {
    if (!hasType(item, 'ListItem') || item.position !== index + 1 || typeof item.name !== 'string') {
      failures.push(`${label}: invalid breadcrumb item at position ${index + 1}`);
    }
    const target = item.item ?? item.url;
    siteUrl(target, label, `breadcrumb ${index + 1} item`, undefined, { allowHash: true });
  });
  const lastTarget = items.at(-1)?.item ?? items.at(-1)?.url;
  siteUrl(lastTarget, label, 'final breadcrumb item', `${SITE_ORIGIN}${pathname}`);
}

function validateArticle(node, label, canonicalUrl, { requireDates = false } = {}) {
  for (const field of ['headline', 'description', 'inLanguage']) {
    if (typeof node[field] !== 'string' || !node[field].trim()) {
      failures.push(`${label}: Article is missing ${field}`);
    }
  }
  siteUrl(node.url, label, 'Article.url', canonicalUrl);
  siteUrl(node.image, label, 'Article.image', undefined);
  if (
    !node.mainEntityOfPage
    || !hasType(node.mainEntityOfPage, 'WebPage')
    || node.mainEntityOfPage['@id'] !== canonicalUrl
  ) {
    failures.push(`${label}: Article.mainEntityOfPage must identify ${canonicalUrl}`);
  }
  for (const field of ['datePublished', 'dateModified']) {
    if (
      (requireDates || node[field] !== undefined)
      && (typeof node[field] !== 'string' || !Number.isFinite(Date.parse(node[field])))
    ) {
      failures.push(`${label}: Article has an invalid ${field}`);
    }
  }
  if (
    Number.isFinite(Date.parse(node.datePublished))
    && Number.isFinite(Date.parse(node.dateModified))
    && Date.parse(node.dateModified) < Date.parse(node.datePublished)
  ) {
    failures.push(`${label}: Article.dateModified predates datePublished`);
  }
  if (!node.author || !node.publisher) failures.push(`${label}: Article needs author and publisher`);
  if (node.author?.['@id'] !== 'https://zodiacs.org/#org') {
    failures.push(`${label}: Article author must be the disclosed Zodiacs.org Organization`);
  }
  if (hasType(node.author, 'Person')) {
    failures.push(`${label}: AI-operated publication must not emit a fictional Person author`);
  }
  if (node.publisher?.['@id'] !== 'https://zodiacs.org/#org') {
    failures.push(`${label}: Article publisher must identify the Zodiacs.org Organization`);
  }
}

function validateFaq(node, label, expectedCount) {
  const questions = node?.mainEntity;
  if (!Array.isArray(questions) || questions.length !== expectedCount) {
    failures.push(`${label}: FAQPage must contain exactly ${expectedCount} questions`);
    return;
  }
  const names = new Set();
  questions.forEach((question, index) => {
    if (!hasType(question, 'Question') || typeof question.name !== 'string' || !question.name.trim()) {
      failures.push(`${label}: FAQ question ${index + 1} has an invalid Question shape`);
    } else if (names.has(question.name.trim())) {
      failures.push(`${label}: FAQ question ${index + 1} duplicates an earlier question`);
    } else {
      names.add(question.name.trim());
    }
    const answer = question.acceptedAnswer;
    if (!hasType(answer, 'Answer') || typeof answer.text !== 'string' || !answer.text.trim()) {
      failures.push(`${label}: FAQ question ${index + 1} needs a non-empty accepted Answer`);
    }
  });
}

function validateHoroscopeItemList(node, label) {
  const items = node?.itemListElement;
  if (node?.numberOfItems !== SIGN_SLUGS.length || !Array.isArray(items) || items.length !== SIGN_SLUGS.length) {
    failures.push(`${label}: horoscope hub ItemList must contain all twelve signs`);
    return;
  }
  const urls = new Set();
  items.forEach((item, index) => {
    const sign = SIGN_SLUGS[index];
    const expectedUrl = `${SITE_ORIGIN}/horoscopes/${sign}/`;
    const expectedName = `${sign.charAt(0).toUpperCase()}${sign.slice(1)} daily horoscope`;
    if (
      !hasType(item, 'ListItem')
      || item.position !== index + 1
      || item.name !== expectedName
    ) {
      failures.push(`${label}: horoscope ItemList entry ${index + 1} has an invalid shape or order`);
    }
    const parsed = siteUrl(item.url ?? item.item, label, `ItemList entry ${index + 1} URL`, expectedUrl);
    if (parsed && urls.has(parsed.href)) {
      failures.push(`${label}: horoscope ItemList entry ${index + 1} duplicates a URL`);
    } else if (parsed) {
      urls.add(parsed.href);
    }
  });
}

function validateApplication(node, label) {
  for (const field of ['name', 'url', 'description', 'applicationCategory', 'operatingSystem']) {
    if (typeof node[field] !== 'string' || !node[field]) failures.push(`${label}: WebApplication is missing ${field}`);
  }
  if (node.isAccessibleForFree !== true) failures.push(`${label}: WebApplication must declare free access`);
  if (String(node.offers?.price) !== '0') failures.push(`${label}: WebApplication must expose a zero-price Offer`);
}

for (const file of await htmlFiles(dist)) {
  const html = await readFile(file, 'utf8');
  const label = relative(dist, file).split(sep).join('/');
  if (attr(html, 'name', 'robots')) continue;
  const builtPath = label === 'index.html'
    ? '/'
    : label.endsWith('/index.html')
      ? `/${label.slice(0, -'index.html'.length)}`
      : `/${label}`;
  const canonicals = canonicalHrefs(html);
  if (canonicals.length !== 1) {
    failures.push(`${label}: indexable page needs exactly one canonical URL (found ${canonicals.length})`);
  }
  const href = canonicals[0];
  if (!href) {
    continue;
  }
  const canonical = siteUrl(href, label, 'canonical URL', `${SITE_ORIGIN}${builtPath}`);
  if (!canonical) continue;
  const pathname = canonical.pathname;
  const canonicalUrl = canonical.href;

  const documents = structuredDocuments(html, label);
  const nodes = nodesOf(documents);
  failures.push(...organizationIdentityErrors(nodes, {
    required: pathname === '/' || /^\/[a-z]{2}(?:-[a-z]{2})?\/$/i.test(pathname) || pathname.startsWith('/developers/'),
  }).map(error => `${label}: ${error}`));
  if (EDITORIAL_METADATA[pathname]) {
    seenEditorial.add(pathname);
    failures.push(...editorialGraphErrors(pathname, nodes).map((error) => `${label}: ${error}`));
  }
  if (DEVELOPER_PAGES[pathname]) {
    seenDeveloper.add(pathname);
    failures.push(...developerStructuredDataErrors(pathname, nodes, { servesUrl, expected: developerExpected }).map((error) => `${label}: ${error}`));
  }
  documentCount += documents.length;
  nodeCount += nodes.length;

  if (pathname !== '/') {
    const breadcrumb = nodes.find((node) => hasType(node, 'BreadcrumbList'));
    if (!breadcrumb) failures.push(`${label}: indexable page is missing BreadcrumbList`);
    else validateBreadcrumb(breadcrumb, label, pathname);
  }

  if (pathname === '/') {
    const website = nodes.find((node) => hasType(node, 'WebSite'));
    const organization = nodes.find((node) => hasType(node, 'Organization'));
    const faq = nodes.find((node) => hasType(node, 'FAQPage'));
    if (!website) failures.push(`${label}: homepage is missing WebSite`);
    if (!organization) failures.push(`${label}: homepage is missing Organization`);
    if (!Array.isArray(organization?.sameAs) || organization.sameAs.length < 1) {
      failures.push(`${label}: homepage Organization needs sameAs profiles`);
    }
    const registryProfiles = Array.isArray(organization?.sameAs)
      ? organization.sameAs.filter((profile) => (
          typeof profile === 'string' && /astrofolio/i.test(profile)
        ))
      : [];
    if (registryProfiles.length > 0) {
      failures.push(
        `${label}: consumer Organization sameAs crosses the Registry boundary: ${registryProfiles.join(', ')}`,
      );
    }
    if (!faq || !Array.isArray(faq.mainEntity) || faq.mainEntity.length < 1) {
      failures.push(`${label}: homepage is missing its FAQPage questions`);
    }
  }

  const topLevelSlug = pathname.split('/').filter(Boolean);
  const horoscopeContent = new RegExp(
    `^/horoscopes/(?:${[...signSlugs].join('|')})(?:/(?:tomorrow|weekly|monthly|love|career|2027))?/$`,
  ).test(pathname);
  const eventContent = /^\/(?:full-moon|new-moon|eclipses|(?:mercury|venus|mars)-retrograde)\/\d{4}-\d{2}-\d{2}\/$/.test(pathname)
    || /^\/events\/(?!preview(?:\/|$))[a-z0-9-]+\/$/.test(pathname);
  const needsArticle = (topLevelSlug.length === 1 && signSlugs.has(topLevelSlug[0]))
    || horoscopeContent
    || eventContent;
  const learnContent = pathname.startsWith('/learn/')
    && (pathname === '/learn/how-to-read-a-birth-chart/'
      || pathname === '/learn/zodiac-dates/'
      || pathname === '/learn/glossary/'
      || topLevelSlug.length >= 3);
  if (needsArticle || learnContent) {
    const articles = nodes.filter((node) => hasType(node, 'Article'));
    if (articles.length !== 1) {
      failures.push(`${label}: article content needs exactly one Article (found ${articles.length})`);
    } else {
      validateArticle(articles[0], label, canonicalUrl, { requireDates: horoscopeContent });
      if (eventContent) failures.push(...eventArticleDateFailures(articles[0], publishedEvents.get(pathname))
        .map((failure) => `${label}: ${failure}`));
    }
  }

  if (horoscopeContent) {
    // FAQ rich results retreated to a handful of authority sites in 2023, so
    // the markup is optional: validated when present, retirable without a
    // gate change. The visible FAQ copy itself stays.
    const faqs = nodes.filter((node) => hasType(node, 'FAQPage'));
    if (faqs.length > 1) {
      failures.push(`${label}: horoscope content allows at most one FAQPage (found ${faqs.length})`);
    } else if (faqs.length === 1) validateFaq(faqs[0], label, 3);
  }

  if (pathname === '/horoscopes/') {
    const collections = nodes.filter((node) => hasType(node, 'CollectionPage'));
    const lists = nodes.filter((node) => hasType(node, 'ItemList'));
    if (collections.length !== 1) {
      failures.push(`${label}: horoscope hub needs exactly one CollectionPage (found ${collections.length})`);
    } else {
      const [collection] = collections;
      siteUrl(collection.url, label, 'CollectionPage.url', canonicalUrl);
      for (const field of ['name', 'description']) {
        if (typeof collection[field] !== 'string' || !collection[field].trim()) {
          failures.push(`${label}: CollectionPage is missing ${field}`);
        }
      }
      if (typeof collection.dateModified !== 'string' || !Number.isFinite(Date.parse(collection.dateModified))) {
        failures.push(`${label}: CollectionPage has an invalid dateModified`);
      }
    }
    if (lists.length !== 1) {
      failures.push(`${label}: horoscope hub needs exactly one ItemList (found ${lists.length})`);
    } else validateHoroscopeItemList(lists[0], label);
  }

  if (WEB_APPLICATION_PATHS.includes(pathname)) {
    const application = nodes.find((node) => hasType(node, 'WebApplication'));
    if (!application) failures.push(`${label}: tool page is missing WebApplication`);
    else validateApplication(application, label);
  }
}

for (const path of Object.keys(EDITORIAL_METADATA)) {
  if (!seenEditorial.has(path)) failures.push(`${path}: editorial owner missing from indexable output`);
}
for (const path of Object.keys(DEVELOPER_PAGES)) {
  if (!seenDeveloper.has(path)) failures.push(`${path}: developer page missing from indexable output`);
}
failures.push(...editorialSitemapErrors(await readFile(resolve(dist, 'sitemap.xml'), 'utf8')));

if (failures.length) {
  console.error(`validate-schema: ${failures.length} failure(s)`);
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log(`validate-schema: OK — ${documentCount} JSON-LD documents, ${nodeCount} graph nodes, ${seenEditorial.size} editorial owners, 0 errors`);
