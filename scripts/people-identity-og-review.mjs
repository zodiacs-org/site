import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PRINCIPAL_IDENTITIES } from '../docs/phase5/people-pilot/tools/principal-identities.mjs';
import { sourceReviews } from '../docs/phase5/people-pilot/tools/source-reviews.mjs';

export const PEOPLE_IDENTITY_REVIEW_FLAG = '--review-people-identities';
/** Every reviewed principal identity, in the closed list's order (A20 first). */
export const PEOPLE_IDENTITY_REVIEW_SLUGS = Object.freeze(Object.keys(PRINCIPAL_IDENTITIES));

export function peopleFactReviewOptions(argv, root, env = process.env) {
  const flag = '--review-people-facts';
  if (!argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`))) return null;
  if (argv.length !== 1 || argv[0] !== flag) throw new Error(`${flag} must be used alone`);
  if (env.PLAYWRIGHT_MODULE && env.PLAYWRIGHT_MODULE !== 'playwright-core') {
    throw new Error('People facts review requires the pinned playwright-core module');
  }
  return { output: resolve(root, 'tests/visual/artifacts/explorer/people-facts-og') };
}

export function reviewedFactPeople(people) {
  return Object.keys(sourceReviews.people).sort().map((slug) => {
    const matches = people.filter((person) => person.slug === slug);
    if (matches.length !== 1) throw new Error(`${slug}: expected exactly one reviewed person`);
    const person = matches[0];
    if (person.sourceReview?.note !== sourceReviews.people[slug].note
      || person.sourceReview?.reviewedOn !== sourceReviews.reviewedOn) {
      throw new Error(`${slug}: source review has not been generated`);
    }
    return person;
  });
}

/** Review output has one fixed destination and cannot be combined with a render mode. */
export function peopleIdentityReviewOptions(argv, root, env = process.env) {
  if (!argv.some((arg) => arg === PEOPLE_IDENTITY_REVIEW_FLAG || arg.startsWith(`${PEOPLE_IDENTITY_REVIEW_FLAG}=`))) return null;
  if (argv.length !== 1 || argv[0] !== PEOPLE_IDENTITY_REVIEW_FLAG) {
    throw new Error(`${PEOPLE_IDENTITY_REVIEW_FLAG} must be used alone`);
  }
  if (env.PLAYWRIGHT_MODULE && env.PLAYWRIGHT_MODULE !== 'playwright-core') {
    throw new Error('People identity review requires the pinned playwright-core module');
  }
  return { output: resolve(root, 'tests/visual/artifacts/explorer/people-identity-og') };
}

export function reviewedPeople(people) {
  return PEOPLE_IDENTITY_REVIEW_SLUGS.map((slug) => {
    const matches = people.filter((person) => person.slug === slug);
    if (matches.length !== 1) throw new Error(`${slug}: expected exactly one reviewed person`);
    const person = matches[0];
    const disciplines = PRINCIPAL_IDENTITIES[slug];
    if (JSON.stringify(person.disciplines) !== JSON.stringify(disciplines)) {
      throw new Error(`${slug}: production disciplines differ from the reviewed selection`);
    }
    const label = disciplines.join(' and ');
    const prefix = `${label[0].toUpperCase()}${label.slice(1)} · `;
    if (!person.shortDescription?.startsWith(prefix) || person.shortDescription.length <= prefix.length) {
      throw new Error(`${slug}: production identity has not been migrated`);
    }
    return person;
  });
}

export async function fileSha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Record every production OG file, including manifests and older immutable families. */
export async function productionOgHashes(root) {
  const hashes = {};
  async function visit(relative) {
    const entries = await readdir(resolve(root, relative), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) hashes[path] = await fileSha256(resolve(root, path));
    }
  }
  await visit('public/assets/og');
  return hashes;
}
