/**
 * Assemble the reviewed Phase 5 People pilot into the one static production
 * data file the site consumes. This script is deterministic and offline: its
 * only inputs are the committed evidence, computation, copy, and manifest.
 *
 * Usage:
 *   node scripts/build-people-pilot.mjs
 *   node scripts/build-people-pilot.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolvePeopleIndexPolicy } from './people-index-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pilot = resolve(root, 'docs/phase5/people-pilot');
const outputPath = resolve(root, 'src/data/people.json');
const checkOnly = process.argv.includes('--check');

const manifest = JSON.parse(await readFile(resolve(pilot, 'manifest.json'), 'utf8'));
const indexPolicyPath = resolve(pilot, 'index-policy.json');
const indexPolicy = JSON.parse(await readFile(indexPolicyPath, 'utf8'));
const indexDemand = JSON.parse(await readFile(resolve(pilot, 'index-demand.json'), 'utf8'));
const {
  indexableProfiles,
  noindexTailProfiles,
  protectedLivingProfiles,
} = resolvePeopleIndexPolicy({ manifest, indexPolicy, indexDemand });
const people = [];

for (const source of manifest.people) {
  const computed = JSON.parse(
    await readFile(resolve(pilot, 'computed', `${source.slug}.json`), 'utf8'),
  );
  const copy = JSON.parse(
    await readFile(resolve(pilot, 'copy', `${source.slug}.json`), 'utf8'),
  );
  const signIndex = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ];

  const indexEligible = indexableProfiles.has(source.slug);
  const noindexTail = noindexTailProfiles.has(source.slug);
  const livingProtected = protectedLivingProfiles.has(source.slug);
  if ([indexEligible, noindexTail, livingProtected].filter(Boolean).length !== 1) {
    throw new Error(`${source.slug}: must appear in exactly one People indexing state`);
  }
  if (indexEligible && source.living) {
    throw new Error(`${source.slug}: living profile cannot enter the conservative index allowlist`);
  }
  if ((noindexTail && source.living) || (livingProtected && !source.living)) {
    throw new Error(`${source.slug}: protected-living policy disagrees with the reviewed record`);
  }
  if (indexEligible && (
    source.suppression.status !== 'active'
    || !source.sunSign.determinable
    || !source.indexEligibility.contentChecksPassed
    || source.indexEligibility.contentCheckFailures.length > 0
  )) {
    throw new Error(`${source.slug}: failed an immutable profile index-eligibility check`);
  }

  people.push({
    ...source,
    indexEligibility: {
      ...source.indexEligibility,
      eligible: indexEligible,
      blockedBy: indexEligible
        ? []
        : livingProtected
          ? ['phase-5c-living-person-protection: separate consent or qualified review required']
          : ['packet-f-search-demand-tail — page remains available but is withheld from indexing'],
    },
    portrait: source.portrait.available
      ? { ...source.portrait, assetPath: `/assets/people/${source.slug}.webp` }
      : source.portrait,
    placements: computed.placements.map((placement) => ({
      ...placement,
      longitude: Number((
        signIndex.indexOf(placement.sign) * 30 + placement.degree
      ).toFixed(2)),
    })),
    aspectsStableAcrossCivilDay: computed.aspectsStableAcrossCivilDay,
    patterns: computed.patterns,
    copy: {
      title: copy.title,
      metaDescription: copy.metaDescription,
      lede: copy.lede,
      ledeFact: copy.ledeFact,
      blocks: copy.blocks,
      birthdayLink: copy.birthdayLink,
      signLink: copy.signLink,
      measurements: copy.measurements,
    },
  });
}

const output = `${JSON.stringify({
  schema: 'zodiacs.phase5.people.v1',
  status: `Packet F search-quality release: ${indexableProfiles.size} indexable deceased records, ${noindexTailProfiles.size} deferred deceased records, ${protectedLivingProfiles.size} protected living records, 1 withdrawn`,
  releaseCounts: {
    indexableDeceased: indexableProfiles.size,
    deferredDeceased: noindexTailProfiles.size,
    protectedLiving: protectedLivingProfiles.size,
    withdrawn: 1,
  },
  reviewedAtUtc: '2026-07-25T00:00:00Z',
  sourceManifestSha256: createHash('sha256')
    .update(await readFile(resolve(pilot, 'manifest.json')))
    .digest('hex'),
  sourceIndexPolicySha256: createHash('sha256')
    .update(await readFile(indexPolicyPath))
    .digest('hex'),
  sourceIndexDemandSha256: createHash('sha256')
    .update(await readFile(resolve(pilot, 'index-demand.json')))
    .digest('hex'),
  indexPolicyApprovedAtUtc: indexPolicy.approvedAtUtc,
  directoryIndexable: indexPolicy.directoryIndexable,
  people: people.sort((a, b) => a.slug.localeCompare(b.slug)),
}, null, 2)}\n`;

if (checkOnly) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== output) {
    console.error('people-pilot: src/data/people.json drifted; run node scripts/build-people-pilot.mjs');
    process.exit(1);
  }
  console.log(
    `people-release: OK — ${indexableProfiles.size} indexable profiles,`
    + ` ${noindexTailProfiles.size} deferred profiles,`
    + ` ${protectedLivingProfiles.size} protected living profiles, generated data exact`,
  );
} else {
  await writeFile(outputPath, output, 'utf8');
  console.log(
    `people-release: wrote ${people.length} reviewed records`
    + ` (${indexableProfiles.size} indexable) to src/data/people.json`,
  );
}
