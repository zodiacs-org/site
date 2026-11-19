/**
 * Pin a public-demand snapshot for the People index allowlist using a
 * reproducible method.
 *
 * Google Search Console query data is not available in the repository. This
 * uses one complete year of English Wikipedia reader pageviews instead of
 * inventing a popularity order. Pageviews are a demand proxy, not search
 * volume, and the committed evidence file says so explicitly.
 *
 * Usage:
 *   node scripts/build-people-index-demand.mjs --refresh
 *   node scripts/build-people-index-demand.mjs --check
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SIGN_PROFILE_PEOPLE } from './sign-profile-data.mjs';
import {
  PEOPLE_INDEX_DEMAND_METRIC as evidenceMetric,
  PEOPLE_INDEX_DEMAND_SOURCE as evidenceSource,
  PEOPLE_INDEX_DEMAND_TARGET as target,
  PEOPLE_INDEX_DEMAND_WINDOW as evidenceWindow,
  peopleIndexDemandMonthTimestamps,
  validatePeopleIndexDemand,
  wikipediaArticleTitle,
} from './people-index-demand-contract.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pilot = resolve(root, 'docs/phase5/people-pilot');
const manifestPath = resolve(pilot, 'manifest.json');
const policyPath = resolve(pilot, 'index-policy.json');
const evidencePath = resolve(pilot, 'index-demand.json');
const refresh = process.argv.includes('--refresh');
const check = process.argv.includes('--check');

if ([refresh, check].filter(Boolean).length !== 1) {
  throw new Error('Choose exactly one of --refresh or --check');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const deceased = manifest.people.filter((person) => !person.living);
const deceasedSlugs = new Set(deceased.map((person) => person.slug));
const linkedDeceasedSlugs = new Set(
  Object.values(SIGN_PROFILE_PEOPLE).flat().filter((slug) => deceasedSlugs.has(slug)),
);

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

const apiDate = (date) => date.replaceAll('-', '');
const expectedMonthTimestamps = peopleIndexDemandMonthTimestamps();

async function fetchViews(person) {
  const title = wikipediaArticleTitle(person);
  const endpoint = `${evidenceSource.endpoint}${evidenceSource.project}/`
    + `${evidenceSource.access}/${evidenceSource.agent}/${encodeURIComponent(title)}/`
    + `${evidenceSource.granularity}/${apiDate(evidenceWindow.from)}00/`
    + `${apiDate(evidenceWindow.to)}00`;
  let response;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    response = await fetch(endpoint, {
      headers: { 'user-agent': 'zodiacs.org-growth-audit/1.0 (https://zodiacs.org/about/)' },
    });
    if (response.status !== 429) break;
    const retryAfter = Number(response.headers.get('retry-after'));
    await delay(Number.isFinite(retryAfter) ? retryAfter * 1_000 : 750 * (attempt + 1));
  }
  if (!response.ok) throw new Error(`${person.slug}: Wikimedia HTTP ${response.status}`);
  const body = await response.json();
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length !== expectedMonthTimestamps.length || items.some((item, index) => (
    item.timestamp !== expectedMonthTimestamps[index]
    || !Number.isSafeInteger(item.views)
    || item.views < 0
  ))) {
    throw new Error(`${person.slug}: expected the exact complete monthly pageview window`);
  }
  await delay(150);
  return {
    slug: person.slug,
    title,
    views: items.reduce((sum, item) => sum + item.views, 0),
  };
}

async function mapConcurrent(values, concurrency, worker) {
  const output = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run));
  return output;
}

async function readEvidence() {
  return JSON.parse(await readFile(evidencePath, 'utf8'));
}

if (refresh) {
  const measured = await mapConcurrent(deceased, 4, (person) => fetchViews(person));
  measured.sort((a, b) => b.views - a.views || a.slug.localeCompare(b.slug));
  const evidence = {
    schema: 'zodiacs.phase5.people-index-demand.v1',
    generatedBy: 'scripts/build-people-index-demand.mjs --refresh',
    generatedAtUtc: new Date().toISOString(),
    source: evidenceSource,
    metric: evidenceMetric,
    window: evidenceWindow,
    target,
    population: 'All 497 reviewed deceased profiles; living profiles remain separately protected.',
    tieBreak: 'slug ascending',
    people: measured.map((person, index) => ({ rank: index + 1, ...person })),
  };
  validatePeopleIndexDemand({ evidence, deceased });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 1)}\n`, 'utf8');
  console.log(`people-index-demand: wrote ${measured.length} measured profiles to ${evidencePath}`);
}

if (check) {
  const evidence = await readEvidence();
  validatePeopleIndexDemand({ evidence, deceased });
  const rankedSelection = new Set(evidence.people.slice(0, target).map((person) => person.slug));
  const continuityOverrides = evidence.people
    .filter((person) => linkedDeceasedSlugs.has(person.slug) && !rankedSelection.has(person.slug))
    .map(({ slug, rank }) => ({ slug, rank }));
  const configuredOverrides = policy.demandPruning?.continuityOverrides ?? [];
  const selected = new Set([
    ...rankedSelection,
    ...configuredOverrides.map((person) => person.slug),
  ]);
  const reviewedDeceased = new Set(policy.reviewedDeceasedProfiles ?? []);
  const protectedLiving = new Set(policy.protectedLivingProfiles ?? []);
  if (policy.demandPruning?.evidence !== 'docs/phase5/people-pilot/index-demand.json'
      || policy.demandPruning?.rankedTarget !== target
      || policy.demandPruning?.retainReviewedDeceasedRegistryLinks !== true
      // The four Packet F overrides keep their index status after the
      // 2026-11-18 Registry refresh unlinked them; every currently linked
      // out-of-cohort profile must still be covered at its ranked position.
      || configuredOverrides.length !== 4
      || continuityOverrides.some(({ slug, rank }) => !configuredOverrides.some((entry) => (
        entry.slug === slug && entry.rank === rank
      )))
      || configuredOverrides.some((entry) => (
        !reviewedDeceased.has(entry.slug)
        || entry.rank !== evidence.people.find((person) => person.slug === entry.slug)?.rank
        || entry.rank <= target
      ))
      || selected.size !== target + 4
      || reviewedDeceased.size !== deceased.length
      || [...reviewedDeceased].some((slug) => !deceasedSlugs.has(slug))
      || protectedLiving.size !== manifest.people.filter((person) => person.living).length
      || manifest.people.filter((person) => person.living).some((person) => !protectedLiving.has(person.slug))) {
    throw new Error('People index policy does not match the reviewed population and demand-pruning contract');
  }
  console.log(
    `people-index-demand: exact — ${selected.size} indexable`
    + ` (${target} ranked + ${configuredOverrides.length} link-continuity),`
    + ` ${deceased.length - selected.size} deferred`,
  );
}
