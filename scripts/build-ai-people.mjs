/**
 * The compact famous-people index the Zodiacs AI tools read
 * (src/ai-tools/features/people.ts). The MCP runtime is bundled into a
 * serverless function and a plugin ZIP, so it never loads the 8 MB
 * src/data/people.json; it reads this extract instead.
 *
 * Only the people the site publishes in its directory are kept, by the same
 * rule as INDEXABLE_PEOPLE / DIRECTORY_PEOPLE in src/lib/people.ts
 * (indexEligibility.eligible). Living, protected, deferred and withdrawn
 * records never reach the index.
 *
 * Run: node scripts/build-ai-people.mjs [--check]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(root, 'src/data/people.json');
const OUT = resolve(root, 'src/ai-tools/features/people-index.json');
export const STALE_MESSAGE = 'people-index.json is stale; run node scripts/build-ai-people.mjs';

const round1 = (value) => Math.round(value * 10) / 10;

/** The directory rule of src/lib/people.ts, kept exactly. */
export function isDirectoryPerson(person) {
  return person.indexEligibility.eligible === true;
}

/** Pure: the people release in, the index object out. */
export function buildPeopleIndex(release) {
  const people = release.people.filter(isDirectoryPerson).map((person) => {
    if (person.living) throw new Error(`${person.slug} is living but marked eligible; refusing to index it`);
    return {
      slug: person.slug,
      name: person.displayName,
      shortDescription: person.shortDescription,
      born: person.birthDate.displayedDate,
      gregorian: person.birthDate.computedGregorianDate,
      birthplace: person.birthPlace.entityLabel,
      sun: { sign: person.sunSign.slug, degree: round1(person.sunSign.degree) },
      moon: person.moon.uncertain
        ? { sign: null, degree: null }
        : { sign: person.moon.sign, degree: round1(person.moon.degree) },
      placements: person.placements.map((placement) => ({
        body: placement.body,
        sign: placement.sign,
        degree: round1(placement.degree),
        settled: placement.stableAcrossDay,
      })),
      lede: person.copy.lede,
      birthdayRoute: person.birthDate.birthdayRoute,
    };
  }).sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  return { schema: 'zodiacs.ai-people-index.v1', source: 'src/data/people.json', reviewedAtUtc: release.reviewedAtUtc, people };
}

export function renderPeopleIndex(release) {
  return `${JSON.stringify(buildPeopleIndex(release), null, 2)}\n`;
}

export async function renderFromDisk() {
  return renderPeopleIndex(JSON.parse(await readFile(SOURCE, 'utf8')));
}

/** True when the committed index matches what the release produces. */
export async function peopleIndexCurrent() {
  const [next, current] = await Promise.all([renderFromDisk(), readFile(OUT, 'utf8').catch(() => '')]);
  return next === current;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const next = await renderFromDisk();
  if (process.argv.includes('--check')) {
    const current = await readFile(OUT, 'utf8').catch(() => '');
    if (current !== next) {
      console.error(STALE_MESSAGE);
      process.exit(1);
    }
    console.log('people-index.json is current.');
  } else {
    await writeFile(OUT, next);
    console.log(`Wrote src/ai-tools/features/people-index.json (${Buffer.byteLength(next)} bytes, ${JSON.parse(next).people.length} people).`);
  }
}
