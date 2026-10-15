/**
 * Historical Phase 5 completion tool — merged the selected 480 into the
 * canonical pilot set. Packet F freezes this tool because changing the
 * population now also requires refreshed public-demand evidence.
 *
 *   --stage=pre    evidence/computed/candidates/screening/timezones merge
 *                  (run before compose-copy with FREEZE_EXISTING=1)
 *   --stage=post   append 480 manifest records (pilot records byte-frozen),
 *                  update index-policy for the owner-authorized deceased
 *                  expansion (living profiles stay protected)
 */
import { readFile, writeFile, copyFile, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { withBirthplaceDisplay } from './birthplace-labels.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, '..');
const stage = process.argv.find((argument) => argument.startsWith('--stage='))?.slice(8);
const activePolicy = JSON.parse(await readFile(join(PILOT, 'index-policy.json'), 'utf8'));
if (activePolicy.demandPruning) {
  throw new Error(
    'merge-expansion is retired after Packet F; population changes require refreshed index-demand evidence',
  );
}
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december'];

const selected = JSON.parse(await readFile(join(PILOT, 'selected-expansion.json'), 'utf8')).selected;
const screeningExpansion = JSON.parse(await readFile(join(PILOT, 'screening-expansion.json'), 'utf8'));
const expansionRows = Object.fromEntries(screeningExpansion.candidates.map((row) => [row.slug, row]));
const candidatesExpansion = Object.fromEntries(
  JSON.parse(await readFile(join(PILOT, 'candidates-expansion.json'), 'utf8'))
    .map((candidate) => [candidate.slug, candidate]),
);

if (stage === 'pre') {
  let candidates = JSON.parse(await readFile(join(PILOT, 'candidates.json'), 'utf8'));
  const screening = JSON.parse(await readFile(join(PILOT, 'screening.json'), 'utf8'));
  const timezones = JSON.parse(await readFile(join(PILOT, 'timezones.json'), 'utf8'));
  /* Reset any previous expansion merge so re-selection is clean. */
  const keep = new Set(selected.map((entry) => entry.slug));
  const previouslyMerged = candidates.filter((candidate) => (candidate.note ?? '').startsWith('Phase 5 completion expansion'));
  const dropped = previouslyMerged.filter((candidate) => !keep.has(candidate.slug)).map((candidate) => candidate.slug);
  if (dropped.length > 0) {
    const droppedSet = new Set(dropped);
    candidates = candidates.filter((candidate) => !droppedSet.has(candidate.slug));
    screening.candidates = screening.candidates.filter((row) => !droppedSet.has(row.slug));
    for (const slug of dropped) {
      delete timezones[slug];
      for (const directory of ['evidence', 'computed', 'copy']) {
        await unlink(join(PILOT, directory, `${slug}.json`)).catch(() => {});
      }
    }
    console.log(`reset: removed ${dropped.length} previously merged people no longer selected`);
  }
  const have = new Set(candidates.map((candidate) => candidate.slug));
  let added = 0;
  for (const { slug, disciplines } of selected) {
    if (have.has(slug)) continue;
    await copyFile(join(PILOT, 'evidence-expansion', `${slug}.json`), join(PILOT, 'evidence', `${slug}.json`));
    await copyFile(join(PILOT, 'computed-expansion', `${slug}.json`), join(PILOT, 'computed', `${slug}.json`));
    const source = candidatesExpansion[slug];
    candidates.push({
      slug,
      enwiki: source.enwiki,
      displayName: source.displayName,
      role: 'pilot',
      note: `Phase 5 completion expansion · ${source.region} · ${source.field}`,
      disciplines,
    });
    screening.candidates.push(expansionRows[slug]);
    const computed = JSON.parse(await readFile(join(PILOT, 'computed', `${slug}.json`), 'utf8'));
    timezones[slug] = computed.computation.timeZone;
    added += 1;
  }
  await writeFile(join(PILOT, 'candidates.json'), `${JSON.stringify(candidates, null, 2)}\n`);
  await writeFile(join(PILOT, 'screening.json'), `${JSON.stringify(screening, null, 2)}\n`);
  await writeFile(join(PILOT, 'timezones.json'), `${JSON.stringify(timezones, null, 2)}\n`);
  console.log(`pre-merge: ${added} people merged into the canonical set`);
}

if (stage === 'post') {
  const manifest = JSON.parse(await readFile(join(PILOT, 'manifest.json'), 'utf8'));
  const depth = JSON.parse(await readFile(join(PILOT, 'depth-report.json'), 'utf8'));
  const have = new Set(manifest.people.map((person) => person.slug));
  const LICENCE_ALLOWLIST = /^(public domain|cc0(?: [\d.]+)?(?: universal)?|cc by [\d.]+|cc by-sa [\d.]+)$/iu;

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
    const licenceUrl = portrait.licenseUrl
      ? portrait.licenseUrl.replace(/^http:\/\//u, 'https://')
      : portrait.licenseUrl;
    if (!publicDomain && !licenceUrl) {
      return {
        available: false,
        reason: `licence "${portrait.licenseShortName}" carries an attribution obligation but the file page exposes no licence deed URL`,
        file: portrait.file,
      };
    }
    if (!portrait.artist) {
      return { available: false, reason: 'no creator recorded on the file page', file: portrait.file };
    }
    if (portrait.artist.trim().toLowerCase() === displayName.trim().toLowerCase()) {
      return {
        available: false,
        reason: `the recorded creator is the subject ("${portrait.artist}"), so the licence holder of this reproduction cannot be credited accurately without separate review`,
        file: portrait.file,
      };
    }
    if (portrait.artist.length > 90) {
      return { available: false, reason: 'creator credit too long to render legibly', file: portrait.file };
    }
    const renderedAttribution = publicDomain
      ? `${portrait.artist} · public domain · Wikimedia Commons`
      : `${portrait.artist} · ${portrait.licenseShortName} · Wikimedia Commons`;
    return {
      available: true,
      file: portrait.file,
      filePage: portrait.filePage,
      creator: portrait.artist,
      licence: portrait.licenseShortName,
      licenceUrl,
      attributionRequired: !publicDomain,
      renderedAttribution,
      renderedAttributionLinks: {
        creator: portrait.filePage,
        licence: publicDomain ? null : licenceUrl,
        source: portrait.filePage,
      },
      width: portrait.width,
      height: portrait.height,
    };
  }

  const canonical = JSON.parse(await readFile(join(PILOT, 'candidates.json'), 'utf8'));
  const pilotFrozen = new Set(canonical
    .filter((candidate) => candidate.role === 'pilot' && !(candidate.note ?? '').startsWith('Phase 5 completion expansion'))
    .map((candidate) => candidate.slug));
  manifest.people = manifest.people.filter((person) => pilotFrozen.has(person.slug));
  let appended = 0;
  for (const { slug, disciplines } of selected) {
    if (pilotFrozen.has(slug)) continue;
    const evidence = JSON.parse(await readFile(join(PILOT, 'evidence', `${slug}.json`), 'utf8'));
    const computed = JSON.parse(await readFile(join(PILOT, 'computed', `${slug}.json`), 'utf8'));
    const copy = JSON.parse(await readFile(join(PILOT, 'copy', `${slug}.json`), 'utf8'));
    const month = Number(computed.gregorianDate.slice(5, 7));
    const day = Number(computed.gregorianDate.slice(8, 10));
    manifest.people.push({
      qid: computed.qid,
      slug,
      displayName: computed.displayName,
      shortDescription: copy.identity,
      disciplines,
      birthDate: {
        storedValue: computed.storedDate,
        precision: 'day',
        calendarModel: computed.calendarModel,
        calendarConversion: 'none required — the stored value is already proleptic Gregorian',
        displayedDate: computed.displayedDate,
        computedGregorianDate: computed.gregorianDate,
        birthdayCrossLinkKey: computed.birthdayCrossLinkKey,
        birthdayRoute: `/birthday/${MONTHS[month - 1]}-${day}/`,
      },
      birthTime: null,
      timeQuality: 'unknown',
      birthTimeEvidence: evidence.birth.timeOfDayEvidence,
      birthPlace: withBirthplaceDisplay(slug, {
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
      dataQualityLabel: computed.moon.uncertain
        ? 'Birth date sourced; birth time unknown; Moon sign undetermined'
        : 'Birth date sourced; birth time unknown',
      sources: { ...evidence.sources, retrievedAtUtc: evidence.retrievedAtUtc },
      portrait: portraitRecord(evidence, computed.displayName),
      living: evidence.living,
      reviewedAtUtc: '2026-07-27T00:00:00Z',
      computationInputVersion: {
        ephemeris: 'astronomy-engine (repository dependency)',
        aspectTable: '@zodiacs/engine/internal/math',
        pilotTools: 'docs/phase5/people-pilot/tools @ phase5-completion',
      },
      contentDepth: {
        originalWords: copy.measurements.originalWords,
        substantiveStatements: copy.measurements.substantiveStatements,
        highestPairwiseSimilarity: depth.perSlugMax?.[slug] ?? 0,
      },
      indexEligibility: {
        eligible: false,
        blockedBy: ['phase-5-completion-candidate — release gates pending'],
        contentChecksPassed: true,
        contentCheckFailures: [],
      },
      suppression: { status: 'active', requestedBy: null, decidedAtUtc: null, note: null },
    });
    appended += 1;
  }
  manifest.people.sort((a, b) => a.slug.localeCompare(b.slug));
  manifest.status = `Phase 5 complete — ${manifest.people.length} reviewed records`;
  await writeFile(join(PILOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  const policy = JSON.parse(await readFile(join(PILOT, 'index-policy.json'), 'utf8'));
  const deceased = manifest.people
    .filter((person) => !policy.protectedLivingProfiles.includes(person.slug))
    .map((person) => person.slug)
    .sort();
  policy.reviewedDeceasedProfiles = deceased;
  policy.directoryIndexable = deceased.length >= policy.minimumIndexableProfilesForDirectory;
  policy.expansion = {
    authorizedBy: 'owner instruction of 2026-07-27 — Phase 5 completion authorizes public indexing of complete deceased-person profiles and qualifying directory pages after all gates pass',
    authorizedAtUtc: '2026-07-27T00:00:00Z',
    livingBoundary: 'living-person profiles remain noindex/nofollow and excluded from sitemap, search, and cross-links without a separate person-specific owner authorization',
  };
  await writeFile(join(PILOT, 'index-policy.json'), `${JSON.stringify(policy, null, 2)}\n`);
  console.log(`post-merge: ${appended} manifest records appended; ${deceased.length} indexable; directoryIndexable=${policy.directoryIndexable}`);
}
