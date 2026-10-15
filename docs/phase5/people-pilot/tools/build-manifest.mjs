/**
 * Phase 5A pilot manifest assembly.
 *
 * Joins the cached evidence, the computed chart facts, and the composed
 * copy into one reviewed record per person, in the shape a future static
 * generator would consume. A production build reads this file and never
 * the network.
 *
 *   node docs/phase5/people-pilot/tools/build-manifest.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { reviewedEvidence, sourceReviews } from './source-reviews.mjs';
import { dirname, join } from 'node:path';
import { PRINCIPAL_IDENTITIES, reviewedIdentity } from './principal-identities.mjs';
import { withBirthplaceDisplay } from './birthplace-labels.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, '..');

/** Licences whose obligations this site can honour on a published page. */
const LICENCE_ALLOWLIST = /^(public domain|cc0(?: [\d.]+)?(?: universal)?|cc by [\d.]+|cc by-sa [\d.]+)$/iu;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

function portraitRecord(evidence, displayName) {
  const portrait = evidence.portrait;
  if (!portrait?.licenseShortName) {
    return { available: false, reason: 'no image claim on the Wikidata entity' };
  }
  if (!LICENCE_ALLOWLIST.test(portrait.licenseShortName.trim())) {
    return {
      available: false,
      reason: `licence "${portrait.licenseShortName}" is outside the accepted set (public domain, CC0, CC BY, CC BY-SA)`,
      file: portrait.file,
    };
  }
  const publicDomain = /^public domain$/iu.test(portrait.licenseShortName.trim());
  if (!publicDomain && !portrait.licenseUrl) {
    return {
      available: false,
      reason: `licence "${portrait.licenseShortName}" carries an attribution obligation but the file page exposes no licence deed URL`,
      file: portrait.file,
    };
  }
  if (!portrait.artist) {
    return { available: false, reason: 'no creator recorded on the file page', file: portrait.file };
  }
  // Commons often records the *subject* as the Artist when the file is a
  // photograph of that person's own work. Rendering "Subject · CC BY-SA"
  // would then misstate who licensed the reproduction, so the record fails
  // closed to the no-portrait state rather than publishing a wrong credit.
  if (portrait.artist.trim().toLowerCase() === displayName.trim().toLowerCase()) {
    return {
      available: false,
      reason: `the recorded creator is the subject ("${portrait.artist}"), so the licence holder of this reproduction cannot be credited accurately without separate review`,
      file: portrait.file,
    };
  }
  // The string that must be VISIBLE beside the image, not merely stored.
  const renderedAttribution = publicDomain
    ? `${portrait.artist} · public domain · Wikimedia Commons`
    : `${portrait.artist} · ${portrait.licenseShortName} · Wikimedia Commons`;
  return {
    available: true,
    file: portrait.file,
    filePage: portrait.filePage,
    creator: portrait.artist,
    licence: portrait.licenseShortName,
    licenceUrl: portrait.licenseUrl,
    attributionRequired: !publicDomain,
    renderedAttribution,
    renderedAttributionLinks: {
      creator: portrait.filePage,
      licence: publicDomain ? null : portrait.licenseUrl,
      source: portrait.filePage,
    },
    width: portrait.width,
    height: portrait.height,
  };
}

const policy = JSON.parse(await readFile(join(PILOT, 'index-policy.json'), 'utf8'));
const withdrawnSlugs = new Set((policy.withdrawn ?? []).map((entry) => entry.slug));
const protectedLinkSlugs = new Set(
  policy.expansion?.personSpecificLinkAuthorization?.profiles ?? [],
);
const candidates = JSON.parse(await readFile(join(PILOT, 'candidates.json'), 'utf8'))
  .filter((candidate) => candidate.role === 'pilot' && !withdrawnSlugs.has(candidate.slug));
const existingManifest = JSON.parse(await readFile(join(PILOT, 'manifest.json'), 'utf8'));
const existingBySlug = new Map(existingManifest.people.map((person) => [person.slug, person]));
const correctedSlugs = new Set(process.argv
  .filter((argument) => argument.startsWith('--slug='))
  .flatMap((argument) => argument.slice('--slug='.length).split(','))
  .map((slug) => slug.trim()).filter(Boolean));
for (const slug of correctedSlugs) {
  if (!existingBySlug.has(slug) || !candidates.some((candidate) => candidate.slug === slug)) {
    throw new Error(`Unknown People correction slug: ${slug}`);
  }
}
const depth = JSON.parse(await readFile(join(PILOT, 'depth-report.json'), 'utf8'));
const thresholds = JSON.parse(await readFile(join(PILOT, 'thresholds.json'), 'utf8'));

const perPageSimilarity = { ...depth.perSlugMax };
for (const pair of depth.topPairs) {
  perPageSimilarity[pair.a] = Math.max(perPageSimilarity[pair.a] ?? 0, pair.similarity);
  perPageSimilarity[pair.b] = Math.max(perPageSimilarity[pair.b] ?? 0, pair.similarity);
}

const people = [];
for (const candidate of candidates) {
  const existing = existingBySlug.get(candidate.slug);
  if (existing && !protectedLinkSlugs.has(candidate.slug) && !correctedSlugs.has(candidate.slug)) {
    // A reviewed birthplace display label is the only birthPlace change a
    // carried record takes; the recorded entity, coordinates and zone stay.
    const birthPlace = withBirthplaceDisplay(candidate.slug, existing.birthPlace);
    if (Object.hasOwn(PRINCIPAL_IDENTITIES, candidate.slug)) {
      const evidence = reviewedEvidence(JSON.parse(await readFile(join(PILOT, 'evidence', `${candidate.slug}.json`), 'utf8')), candidate.slug);
      const copy = JSON.parse(await readFile(join(PILOT, 'copy', `${candidate.slug}.json`), 'utf8'));
      const identity = reviewedIdentity(candidate, evidence, existing.shortDescription);
      if (copy.identity !== identity) throw new Error(`${candidate.slug}: migrate the reviewed copy identity first`);
      people.push({ ...existing, shortDescription: identity, disciplines: [...candidate.disciplines], birthPlace });
    } else {
      people.push({ ...existing, birthPlace });
    }
    continue;
  }
  const evidence = reviewedEvidence(JSON.parse(await readFile(join(PILOT, 'evidence', `${candidate.slug}.json`), 'utf8')), candidate.slug);
  const computed = JSON.parse(await readFile(join(PILOT, 'computed', `${candidate.slug}.json`), 'utf8'));
  const copy = JSON.parse(await readFile(join(PILOT, 'copy', `${candidate.slug}.json`), 'utf8'));
  const month = Number(computed.gregorianDate.slice(5, 7));
  const day = Number(computed.gregorianDate.slice(8, 10));
  const portrait = protectedLinkSlugs.has(candidate.slug)
    ? {
        available: false,
        reason: 'portrait deliberately omitted from this protected living-person profile',
        file: evidence.portrait?.file,
      }
    : portraitRecord(evidence, computed.displayName);

  const failures = [];
  if (copy.measurements.originalWords < thresholds.originalWordFloor) {
    failures.push(`original copy ${copy.measurements.originalWords} words, floor ${thresholds.originalWordFloor}`);
  }
  if (copy.measurements.substantiveStatements < thresholds.substantiveStatementFloor) {
    failures.push(`${copy.measurements.substantiveStatements} substantive statements, floor ${thresholds.substantiveStatementFloor}`);
  }
  if ((perPageSimilarity[candidate.slug] ?? 0) > thresholds.similarityCeiling) {
    failures.push(`similarity ${perPageSimilarity[candidate.slug]} exceeds ceiling ${thresholds.similarityCeiling}`);
  }

  people.push({
    qid: computed.qid,
    slug: candidate.slug,
    displayName: computed.displayName,
    shortDescription: copy.identity,
    disciplines: candidate.disciplines,
    birthDate: {
      storedValue: computed.storedDate,
      precision: 'day',
      calendarModel: computed.calendarModel,
      calendarConversion: computed.calendarModel === 'proleptic-gregorian'
        ? 'none required — the stored value is already proleptic Gregorian'
        : 'Julian → proleptic Gregorian via Julian Day Number',
      displayedDate: computed.displayedDate,
      computedGregorianDate: computed.gregorianDate,
      birthdayCrossLinkKey: computed.birthdayCrossLinkKey,
      birthdayRoute: `/birthday/${MONTHS[month - 1]}-${day}/`,
    },
    birthTime: null,
    timeQuality: 'unknown',
    birthTimeEvidence: evidence.birth.timeOfDayEvidence,
    birthPlace: withBirthplaceDisplay(candidate.slug, {
      entity: evidence.birthPlace.entity,
      entityLabel: evidence.birthPlace.label,
      country: evidence.birthPlace.country,
      coordinates: {
        latitude: evidence.birthPlace.coordinates.latitude,
        longitude: evidence.birthPlace.coordinates.longitude,
        sourceEntity: evidence.birthPlace.coordinates.sourceEntity,
        sourceEntityLabel: evidence.birthPlace.coordinates.sourceEntityLabel,
        wikidataPrecision: evidence.birthPlace.coordinates.precision,
        escalationSteps: evidence.birthPlace.coordinates.escalationSteps,
        precisionDowngrade: evidence.birthPlace.coordinates.escalationSteps > 0
          ? `coordinates taken from ${evidence.birthPlace.coordinates.sourceEntityLabel}, one administrative step above the recorded birthplace`
          : null,
      },
      timeZone: computed.computation.timeZone,
    }),
    computation: {
      ...computed.computation,
      // tzdb's pre-standardisation LMT is the local mean time of the
      // ZONE's reference meridian, not of this settlement. The residual
      // is the time difference between the two, and the Moon error it
      // implies at roughly 0.55°/hour. Both are far smaller than the
      // ±12-hour noon assumption they sit inside.
      meridianResidualMinutes: Number((
        (computed.computation.longitude / 15) * 60 - computed.computation.utcOffsetMinutesAtBirth
      ).toFixed(2)),
      meridianResidualMoonDegrees: Number((
        Math.abs((computed.computation.longitude / 15) * 60 - computed.computation.utcOffsetMinutesAtBirth) / 60 * 0.55
      ).toFixed(4)),
    },
    sunSign: {
      slug: computed.sun.sign,
      name: computed.sun.signName,
      degree: computed.sun.degree,
      determinable: !computed.cusp.ambiguous,
      cuspCheck: computed.cusp,
    },
    moon: computed.moon,
    unknownTimeErrorBandDegrees: computed.unknownTimeErrorBandDegrees,
    dataQualityLabel: sourceReviews.people[candidate.slug]?.status === 'adopted-date'
      ? 'Adopted birth date; date uncertain; birth time unknown'
      : computed.moon.uncertain
      ? 'Birth date sourced; birth time unknown; Moon sign undetermined'
      : 'Birth date sourced; birth time unknown',
    ...(sourceReviews.people[candidate.slug] ? { sourceReview: {
      reviewedOn: sourceReviews.reviewedOn,
      status: sourceReviews.people[candidate.slug].status,
      note: sourceReviews.people[candidate.slug].note,
      sources: sourceReviews.people[candidate.slug].sources,
    } } : {}),
    sources: {
      ...evidence.sources,
      retrievedAtUtc: evidence.retrievedAtUtc,
    },
    portrait,
    living: evidence.living,
    reviewedAtUtc: correctedSlugs.has(candidate.slug) ? sourceReviews.reviewedAtUtc : '2026-08-16T00:00:00Z',
    computationInputVersion: {
      ephemeris: 'astronomy-engine (repository dependency)',
      aspectTable: '@zodiacs/engine/internal/math',
      pilotTools: correctedSlugs.has(candidate.slug)
        ? 'docs/phase5/people-pilot/tools @ factual-correction-2026-09-07'
        : 'docs/phase5/people-pilot/tools @ protected-living-maintenance',
    },
    contentDepth: {
      originalWords: copy.measurements.originalWords,
      substantiveStatements: copy.measurements.substantiveStatements,
      highestPairwiseSimilarity: perPageSimilarity[candidate.slug] ?? 0,
    },
    indexEligibility: {
      eligible: false,
      blockedBy: evidence.living
        ? ['phase-5c-living-person-protection — noindex/nofollow; excluded from sitemap, search, directory, birthday and automatic related-person links']
        : ['phase-5-completion-candidate — release gates pending'],
      contentChecksPassed: failures.length === 0,
      contentCheckFailures: failures,
    },
    suppression: existing?.suppression ?? { status: 'active', requestedBy: null, decidedAtUtc: null, note: null },
  });
}

const manifest = {
  ...existingManifest,
  status: `Phase 5 complete — ${people.length + withdrawnSlugs.size} reviewed records`,
  thresholds,
  people: people.sort((a, b) => a.slug.localeCompare(b.slug)),
};
await writeFile(join(PILOT, 'manifest.json'), `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');

console.log(`Manifest: ${people.length} people.`);
console.log(`Portraits available: ${people.filter((person) => person.portrait.available).length}`);
for (const person of people.filter((candidate) => !candidate.portrait.available)) {
  console.log(`  no portrait — ${person.slug}: ${person.portrait.reason}`);
}
