import { SIGN_PROFILE_PEOPLE } from './sign-profile-data.mjs';
import { validatePeopleIndexDemand } from './people-index-demand-contract.mjs';

/** Resolve the reviewed People population into index, deferred, and protected sets. */
export function resolvePeopleIndexPolicy({ manifest, indexPolicy, indexDemand }) {
  if (indexPolicy.schema !== 'zodiacs.phase5.people-index-policy.v1') {
    throw new Error(`Unsupported People index policy: ${indexPolicy.schema}`);
  }
  const manifestSlugs = new Set(manifest.people.map((person) => person.slug));
  const deceased = manifest.people.filter((person) => !person.living);
  validatePeopleIndexDemand({ evidence: indexDemand, deceased });
  const deceasedSlugs = new Set(
    deceased.map((person) => person.slug),
  );
  const livingSlugs = new Set(
    manifest.people.filter((person) => person.living).map((person) => person.slug),
  );
  const reviewedDeceasedProfiles = new Set(indexPolicy.reviewedDeceasedProfiles ?? []);
  const protectedLivingProfiles = new Set(indexPolicy.protectedLivingProfiles ?? []);
  if (reviewedDeceasedProfiles.size !== indexPolicy.reviewedDeceasedProfiles?.length
      || protectedLivingProfiles.size !== indexPolicy.protectedLivingProfiles?.length) {
    throw new Error('People index policy contains a duplicate slug');
  }
  if (reviewedDeceasedProfiles.size !== deceasedSlugs.size
      || [...reviewedDeceasedProfiles].some((slug) => !deceasedSlugs.has(slug))) {
    throw new Error('People index policy does not cover the exact reviewed deceased population');
  }
  if (protectedLivingProfiles.size !== livingSlugs.size
      || [...protectedLivingProfiles].some((slug) => !livingSlugs.has(slug))) {
    throw new Error('People index policy does not cover the exact protected living population');
  }
  if (reviewedDeceasedProfiles.size + protectedLivingProfiles.size !== manifestSlugs.size) {
    throw new Error('People index policy does not partition the complete reviewed manifest');
  }

  const rankedTarget = indexPolicy.demandPruning?.rankedTarget;
  if (typeof indexPolicy.demandPruning?.authorizedBy !== 'string'
      || !indexPolicy.demandPruning.authorizedBy.includes('Packet F')
      || !Number.isFinite(Date.parse(indexPolicy.demandPruning?.authorizedAtUtc))
      || indexPolicy.demandPruning?.evidence !== 'docs/phase5/people-pilot/index-demand.json'
      || !Number.isSafeInteger(rankedTarget)
      || rankedTarget < indexPolicy.minimumIndexableProfilesForDirectory
      || indexPolicy.demandPruning?.retainReviewedDeceasedRegistryLinks !== true) {
    throw new Error('People demand-pruning policy is incomplete');
  }
  if (indexDemand.target !== rankedTarget) {
    throw new Error('People index-demand evidence does not match the policy target');
  }

  const indexableProfiles = new Set(
    indexDemand.people.slice(0, rankedTarget).map((person) => person.slug),
  );
  const rankedBySlug = new Map(indexDemand.people.map((person) => [person.slug, person.rank]));
  const linkedDeceased = new Set(
    Object.values(SIGN_PROFILE_PEOPLE).flat().filter((slug) => reviewedDeceasedProfiles.has(slug)),
  );
  const requiredOverrides = [...linkedDeceased]
    .filter((slug) => !indexableProfiles.has(slug))
    .sort();
  const configuredOverrides = indexPolicy.demandPruning.continuityOverrides ?? [];
  const configuredOverrideSlugs = configuredOverrides.map((entry) => entry.slug);
  // Every reviewed deceased profile linked from a Registry sign record must be
  // indexable. The four Packet F overrides keep their index status after the
  // 2026-11-18 Registry refresh unlinked them, so pages already in search are
  // not withdrawn; the override list itself stays fixed at those four.
  if (configuredOverrides.length !== 4
      || new Set(configuredOverrideSlugs).size !== configuredOverrides.length
      || requiredOverrides.some((slug) => !configuredOverrideSlugs.includes(slug))
      || configuredOverrides.some((entry) => (
        !reviewedDeceasedProfiles.has(entry.slug)
        || entry.rank !== rankedBySlug.get(entry.slug)
        || entry.rank <= rankedTarget
      ))) {
    throw new Error('People link-continuity overrides do not cover the ranked Registry links');
  }
  for (const slug of configuredOverrideSlugs) {
    indexableProfiles.add(slug);
  }
  if (indexableProfiles.size !== rankedTarget + configuredOverrides.length) {
    throw new Error('People final index cohort has an unexpected size');
  }
  const noindexTailProfiles = new Set(
    [...reviewedDeceasedProfiles].filter((slug) => !indexableProfiles.has(slug)),
  );
  if (indexPolicy.directoryIndexable !== (
    indexableProfiles.size >= indexPolicy.minimumIndexableProfilesForDirectory
  )) {
    throw new Error('People directory eligibility disagrees with its minimum-profile rule');
  }

  return {
    reviewedDeceasedProfiles,
    indexableProfiles,
    noindexTailProfiles,
    protectedLivingProfiles,
  };
}
