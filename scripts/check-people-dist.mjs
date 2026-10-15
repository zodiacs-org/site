import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const data = JSON.parse(await readFile(resolve(root, 'src/data/people.json'), 'utf8'));
const people = data.people;
const failures = [];
const sitemap = await readFile(resolve(dist, 'sitemap.xml'), 'utf8');
const searchIndex = JSON.parse(await readFile(resolve(dist, 'search-index.json'), 'utf8'));
const searchPeople = new Set(searchIndex
  .map((entry) => entry.path)
  .filter((path) => /^\/people\/[a-z0-9-]+\/$/u.test(path)));

const NOINDEX_NOFOLLOW = /<meta name="robots" content="noindex, nofollow, max-image-preview:large"\s*\/?>/u;
const NOINDEX_FOLLOW = /<meta name="robots" content="noindex, follow, max-image-preview:large"\s*\/?>/u;
const INDEXABLE = /<meta name="robots" content="max-image-preview:large"\s*\/?>/u;
// Profiles are noindex under the shared rule (src/lib/seo/indexing.mjs); an
// eligible profile carries the rule's marker and stays in the site's search.
const ruleNoindex = (follow) => new RegExp(`<meta name="robots" data-noindex-rule="People pages" content="noindex, ${follow}, max-image-preview:large"\\s*\\/?>`, 'u');

for (const person of people) {
  const route = `/people/${person.slug}/`;
  const html = await readFile(resolve(dist, route.slice(1), 'index.html'), 'utf8').catch(() => '');
  if (!html) { failures.push(`${route}: missing`); continue; }
  const eligible = person.indexEligibility.eligible;
  if (eligible && !ruleNoindex(person.living ? 'nofollow' : 'follow').test(html)) {
    failures.push(`${route}: expected the shared rule's noindex`);
  }
  if (!eligible && person.living && !NOINDEX_NOFOLLOW.test(html)) {
    failures.push(`${route}: living protection lost`);
  }
  if (!eligible && !person.living && !NOINDEX_FOLLOW.test(html)) {
    failures.push(`${route}: deferred profile must remain noindex, follow`);
  }
  if (/<link rel="alternate" hreflang=/u.test(html)) failures.push(`${route}: unexpected hreflang`);
  if (!html.includes(`<link rel="canonical" href="https://zodiacs.org${route}"`)) {
    failures.push(`${route}: self-canonical missing`);
  }
  if (sitemap.includes(`https://zodiacs.org${route}`)) {
    failures.push(`${route}: profiles stay out of the sitemap`);
  }
  if (eligible !== searchPeople.has(route)) {
    failures.push(`${route}: search membership must equal eligibility (${eligible})`);
  }
}

const directoryHtml = await readFile(resolve(dist, 'people/index.html'), 'utf8').catch(() => '');
if (!directoryHtml) failures.push('/people/: missing');
if (data.directoryIndexable) {
  if (!INDEXABLE.test(directoryHtml)) failures.push('/people/: expected indexable robots');
} else if (!NOINDEX_NOFOLLOW.test(directoryHtml)) {
  failures.push('/people/: expected noindex robots');
}

const personDirectories = await readdir(resolve(dist, 'people'));
if (personDirectories.length !== people.length + 1 || !personDirectories.includes('index.html')) {
  failures.push(`expected directory plus ${people.length} person directories, found ${personDirectories.length} entries`);
}

/* Living-person asset protection stays pinned in vercel.json. Portraits are
   binaries: this header is their only protection, so the gate checks the
   header a rule actually sets rather than merely finding the slug somewhere
   in a source pattern. */
const vercel = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
const REQUIRED_ASSET_DIRECTIVES = ['noindex', 'noimageindex', 'noarchive'];
const robotsRulesFor = (slug) => (vercel.headers ?? [])
  .filter((rule) => typeof rule.source === 'string' && rule.source.includes(slug))
  .flatMap((rule) => (rule.headers ?? [])
    .filter((header) => String(header.key).toLowerCase() === 'x-robots-tag')
    .map((header) => String(header.value).toLowerCase()));

for (const person of people.filter((candidate) => candidate.living)) {
  const values = robotsRulesFor(person.slug);
  if (values.length === 0) {
    failures.push(`${person.slug}: no vercel.json X-Robots-Tag rule names this living person`);
    continue;
  }
  const missing = REQUIRED_ASSET_DIRECTIVES
    .filter((directive) => !values.some((value) => value.includes(directive)));
  if (missing.length > 0) {
    failures.push(`${person.slug}: living-person X-Robots-Tag lacks ${missing.join(', ')}`);
  }
}

if (failures.length) {
  console.error(`people-dist: ${failures.length} failure(s)`);
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`);
  process.exit(1);
}
const eligibleCount = people.filter((person) => person.indexEligibility.eligible).length;
const deferredCount = people.filter((person) => !person.indexEligibility.eligible && !person.living).length;
const protectedCount = people.filter((person) => person.living).length;
console.log(`people-dist: OK — ${people.length + 1} routes; ${eligibleCount} searchable, noindex by the shared rule (+ directory ${data.directoryIndexable ? 'indexable' : 'noindex'}); ${deferredCount} deferred; ${protectedCount} living protected; no profile in the sitemap; search membership exact`);
