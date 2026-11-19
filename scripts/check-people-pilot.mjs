import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePeopleIndexPolicy } from './people-index-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(await readFile(resolve(root, 'src/data/people.json'), 'utf8'));
const indexPolicy = JSON.parse(
  await readFile(resolve(root, 'docs/phase5/people-pilot/index-policy.json'), 'utf8'),
);
const pilot = resolve(root, 'docs/phase5/people-pilot');
const manifest = JSON.parse(await readFile(resolve(pilot, 'manifest.json'), 'utf8'));
const indexDemand = JSON.parse(await readFile(resolve(pilot, 'index-demand.json'), 'utf8'));
const {
  indexableProfiles: indexableSlugs,
  noindexTailProfiles: noindexTailSlugs,
  protectedLivingProfiles: protectedLivingSlugs,
} = resolvePeopleIndexPolicy({ manifest, indexPolicy, indexDemand });
const failures = [];
const signIndex = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

if (data.people.length !== 516) failures.push(`expected 516 records, found ${data.people.length}`);
if (new Set(data.people.map((person) => person.slug)).size !== data.people.length) failures.push('duplicate slug');
if (new Set(data.people.map((person) => person.qid)).size !== data.people.length) failures.push('duplicate QID');

const birthdayFiles = new Set(
  (await readdir(resolve(root, 'src/content/birthdays')))
    .filter((file) => file.endsWith('.mdx'))
    .map((file) => file.replace(/\.mdx$/u, '')),
);

if (indexableSlugs.size < indexPolicy.minimumIndexableProfilesForDirectory
    && indexPolicy.directoryIndexable) {
  failures.push('directory indexed below its minimum eligible-profile threshold');
}

for (const person of data.people) {
  const expectedEligible = indexableSlugs.has(person.slug);
  const expectedNoindexTail = noindexTailSlugs.has(person.slug);
  const expectedProtected = protectedLivingSlugs.has(person.slug);
  if ([expectedEligible, expectedNoindexTail, expectedProtected].filter(Boolean).length !== 1) {
    failures.push(`${person.slug}: missing from or duplicated across policy sets`);
  }
  if (person.indexEligibility.eligible !== expectedEligible) {
    failures.push(`${person.slug}: eligibility disagrees with the explicit policy`);
  }
  if (expectedEligible && (person.living || person.indexEligibility.blockedBy.length > 0)) {
    failures.push(`${person.slug}: living or blocked record entered the index allowlist`);
  }
  if (expectedProtected && (
    !person.living
    || !person.indexEligibility.blockedBy.some((reason) => reason.includes('living-person-protection'))
  )) {
    failures.push(`${person.slug}: living-person protection drifted`);
  }
  if (expectedNoindexTail && (
    person.living
    || !person.indexEligibility.blockedBy.some((reason) => reason.includes('search-demand-tail'))
  )) {
    failures.push(`${person.slug}: deferred search-demand state drifted`);
  }
  const computed = JSON.parse(
    await readFile(resolve(pilot, 'computed', `${person.slug}.json`), 'utf8'),
  );
  for (const placement of person.placements) {
    const source = computed.placements.find((candidate) => candidate.body === placement.body);
    const expectedLongitude = signIndex.indexOf(source.sign) * 30 + source.degree;
    if (!source
        || Math.abs(placement.degree - source.degree) > 1e-9
        || Math.abs(placement.longitude - expectedLongitude) > 1e-9) {
      failures.push(`${person.slug}: ${placement.body} position drift`);
    }
  }
  const settled = person.placements.filter((placement) => placement.stableAcrossDay);
  const elementTotal = Object.values(person.patterns.elements).reduce((sum, value) => sum + value, 0);
  const modalityTotal = Object.values(person.patterns.modalities).reduce((sum, value) => sum + value, 0);
  if (person.patterns.settledBodyCount !== settled.length
      || elementTotal !== settled.length
      || modalityTotal !== settled.length) {
    failures.push(`${person.slug}: uncertain placement leaked into an aggregate`);
  }
  if (settled.length !== 10) {
    const text = [person.copy.lede, ...person.copy.blocks.map((block) => block.text)].join(' ');
    if (/\bten bodies\b/iu.test(text)) failures.push(`${person.slug}: uncertain chart claims ten-body total`);
  }
  const copyFacts = person.copy.blocks.flatMap((block) => block.facts);
  const copyText = [person.copy.lede, ...person.copy.blocks.map((block) => block.text)].join(' ');
  for (const placement of person.placements.filter((entry) => (
    !entry.stableAcrossDay && entry.body !== 'Moon'
  ))) {
    const fact = copyFacts.find((entry) => entry.startsWith(`sign-uncertain:${placement.body}:`));
    const [, body, start, end] = fact?.split(':') ?? [];
    const startName = start ? start.charAt(0).toUpperCase() + start.slice(1) : '';
    const endName = end ? end.charAt(0).toUpperCase() + end.slice(1) : '';
    const sentence = `${body} crossed from ${startName} into ${endName} during that day, so its sign is left open.`;
    if (!fact || !copyText.includes(sentence)) {
      failures.push(`${person.slug}: ${placement.body} sign uncertainty is not named`);
    }
  }
  const birthdaySlug = person.birthDate.birthdayRoute
    .replace(/^\/birthday\//u, '')
    .replace(/\/$/u, '');
  if (!birthdayFiles.has(birthdaySlug)) failures.push(`${person.slug}: broken birthday route`);
}

const sitemap = await readFile(resolve(root, 'src/pages/sitemap.xml.ts'), 'utf8');
const nav = await readFile(resolve(root, 'src/components/SiteNav.astro'), 'utf8');
if (!sitemap.includes('INDEXABLE_PEOPLE')) failures.push('sitemap is not driven by the People index allowlist');
if (/\/people\//u.test(nav)) failures.push('People route entered primary navigation');

if (failures.length) {
  console.error(`people-pilot-integrity: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(
  `people-release-integrity: OK — ${indexableSlugs.size} explicitly indexable deceased records,`
  + ` ${noindexTailSlugs.size} deferred deceased records,`
  + ` ${protectedLivingSlugs.size} protected living records, uncertain-time aggregates honest`,
);
