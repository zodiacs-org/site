/**
 * Phase 5A pilot validation — fail closed on every contract in the
 * handoff. Exits non-zero on the first failing class, prints the evidence
 * for each passing one, and never repairs anything it finds.
 *
 *   node docs/phase5/people-pilot/tools/validate-pilot.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolvePeopleIndexPolicy } from '../../../../scripts/people-index-policy.mjs';
import { inspectCohortSpacing } from './cohort-integrity.mjs';
import { completeCivilDay } from './civil-day-bounds.mjs';
import { birthplaceDisplay, isSettlement } from './birthplace-labels.mjs';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const PILOT = join(HERE, '..');
const REPO = join(PILOT, '..', '..', '..');
const phase5b = process.argv.includes('--phase5b');
const phase5c = process.argv.includes('--phase5c');
if (phase5b && phase5c) throw new Error('Choose one People release phase');

const results = [];
const failures = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures.push({ name, detail });
}

const manifest = JSON.parse(await readFile(join(PILOT, 'manifest.json'), 'utf8'));
const thresholds = JSON.parse(await readFile(join(PILOT, 'thresholds.json'), 'utf8'));
const depth = JSON.parse(await readFile(join(PILOT, 'depth-report.json'), 'utf8'));
const screening = JSON.parse(await readFile(join(PILOT, 'screening.json'), 'utf8'));
const candidates = JSON.parse(await readFile(join(PILOT, 'candidates.json'), 'utf8'));
const people = manifest.people;

/* 1 — exactly 20 unique QIDs and slugs */
const qids = new Set(people.map((person) => person.qid));
const slugs = new Set(people.map((person) => person.slug));
check('exactly 501 active reviewed people', people.length === 501, `${people.length}`);
check('unique QIDs', qids.size === people.length, `${qids.size}`);
check('unique slugs', slugs.size === people.length, `${slugs.size}`);

/* 2 — all twelve Sun signs */
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const signName = (slug) => slug.charAt(0).toUpperCase() + slug.slice(1);
const bySign = {};
for (const person of people) (bySign[person.sunSign.slug] ??= []).push(person);
const missingSigns = SIGNS.filter((sign) => !bySign[sign]);
check('all twelve Sun signs represented', missingSigns.length === 0, missingSigns.join(', '));

/* 3 — the 365-day admission threshold is unchanged. Published facts may
   be corrected without silently removing an existing person. Every resulting
   close pair must have an exact reviewed correction; it remains a reported
   selection variance, never a claim that 360 days satisfies 365. */
const correctionFiles = (await readdir(join(PILOT, 'corrections')))
  .filter((file) => /^\d{4}-\d{2}-\d{2}-.+\.json$/u.test(file));
const corrections = await Promise.all(correctionFiles.map(async (file) =>
  JSON.parse(await readFile(join(PILOT, 'corrections', file), 'utf8'))));
const baselineBytes = await readFile(join(PILOT, 'corrections', 'published-cohort-2026-09-07.json'));
const baselineHash = createHash('sha256').update(baselineBytes).digest('hex');
if (baselineHash !== '4d50a6a6174def1cd224cc1a8f6b42cda2b56dea0fad86f506a6753e6ba487c1') {
  throw new Error('Published-cohort proof changed; do not rewrite historical admission evidence');
}
const spacing = inspectCohortSpacing(people, corrections, JSON.parse(baselineBytes));
const eraRows = spacing.rows;
check('factual correction ledger', spacing.invalid.length === 0, spacing.invalid.join(', '));
for (const row of eraRows) {
  const unexplained = spacing.unexplained.filter((entry) => entry.sign === row.sign);
  check(`same-sign admission integrity ${row.sign}`, unexplained.length === 0,
    `${row.count} people; closest ${row.closest} at ${row.minGapDays} days`);
}
for (const variance of spacing.reviewed) {
  console.log(`REVIEWED SELECTION VARIANCE: ${variance.pair.join(' / ')} — ${variance.gapDays} days, below the unchanged 365-day admission minimum (${variance.correction}).`);
}

/* 4 — no pilot record is cusp-ambiguous */
for (const person of people) {
  check(
    `cusp check ${person.slug}`,
    person.sunSign.cuspCheck.ambiguous === false && person.sunSign.determinable === true,
    person.sunSign.cuspCheck.ambiguous
      ? `ingress at ${person.sunSign.cuspCheck.boundaryUtc}`
      : `${person.sunSign.cuspCheck.degreesInsideAtWindowStart}° inside at window start, `
        + `${person.sunSign.cuspCheck.degreesToNextBoundaryAtWindowEnd}° to the next boundary at window end`,
  );
}

/* 4b — the cusp verdict must agree with the civil-day transition record.
   These are computed by different code paths over the same day; when they
   disagree, a profile states a settled Sun sign that its own transitions
   block declares open. */
for (const person of people) {
  const sunTransition = (person.signUncertainTransitions ?? [])
    .some((transition) => transition.body === 'Sun');
  check(
    `cusp agrees with civil-day transitions ${person.slug}`,
    !(sunTransition && person.sunSign.cuspCheck.ambiguous === false),
    sunTransition
      ? 'Sun changes sign during the civil day'
      : 'no Sun transition recorded',
  );
}

/* 5 — explicit calendar model plus a documented conversion */
for (const person of people) {
  check(
    `calendar model ${person.slug}`,
    person.birthDate.calendarModel === 'proleptic-gregorian'
      && typeof person.birthDate.calendarConversion === 'string'
      && person.birthDate.calendarConversion.length > 0,
    `${person.birthDate.calendarModel} — ${person.birthDate.calendarConversion}`,
  );
}

/* 6 — displayed date, cross-link key and computed instant agree */
for (const person of people) {
  const { displayedDate, computedGregorianDate, birthdayCrossLinkKey } = person.birthDate;
  const instantDate = person.computation.utcInstant.slice(0, 10);
  const dayShift = Math.abs(Date.parse(`${instantDate}T00:00:00Z`) - Date.parse(`${computedGregorianDate}T00:00:00Z`))
    / 86_400_000;
  check(
    `date consistency ${person.slug}`,
    displayedDate === computedGregorianDate && birthdayCrossLinkKey === computedGregorianDate && dayShift <= 1,
    `displayed ${displayedDate}, key ${birthdayCrossLinkKey}, instant ${person.computation.utcInstant}`,
  );
}

/* 7 — every accepted fact traces to an allowed cached source record */
const ALLOWED_HOSTS = /^(www\.wikidata\.org|en\.wikipedia\.org|commons\.wikimedia\.org|upload\.wikimedia\.org)$/u;
for (const person of people) {
  const urls = [
    person.sources.wikidata.entityUrl,
    person.sources.wikipedia.articleUrl,
    ...(person.portrait.available ? [person.portrait.filePage, person.portrait.licenceUrl].filter(Boolean) : []),
  ];
  const bad = urls.filter((url) => {
    try {
      const host = new URL(url).host;
      return !ALLOWED_HOSTS.test(host) && !/creativecommons\.org$/u.test(host);
    } catch { return true; }
  });
  check(`sources allowed ${person.slug}`, bad.length === 0, bad.join(' '));
  check(
    `source revisions ${person.slug}`,
    Number.isInteger(person.sources.wikipedia.revisionId)
      && Number.isInteger(person.sources.wikidata.lastrevid)
      && typeof person.sources.retrievedAtUtc === 'string',
    `enwiki rev ${person.sources.wikipedia.revisionId}, wikidata rev ${person.sources.wikidata.lastrevid}`,
  );
}

/* 8 — birth time is null unless an allowed source supplies one */
for (const person of people) {
  check(
    `birth time ${person.slug}`,
    person.birthTime === null && person.timeQuality === 'unknown' && typeof person.birthTimeEvidence === 'string',
    person.birthTimeEvidence,
  );
}

/* 9 — coordinates, or a recorded fallback outcome */
for (const person of people) {
  const coordinates = person.birthPlace.coordinates;
  const ok = Number.isFinite(coordinates.latitude) && Number.isFinite(coordinates.longitude)
    && coordinates.escalationSteps <= 1
    && (coordinates.escalationSteps === 0 || typeof coordinates.precisionDowngrade === 'string');
  check(`birthplace coordinates ${person.slug}`, ok,
    `${coordinates.latitude}, ${coordinates.longitude} from ${coordinates.sourceEntityLabel} `
    + `(escalation ${coordinates.escalationSteps})`);
}

/* 9b — the birthplace is named by its reviewed, sourced display label.
   Coordinates and the time zone still come from the recorded entity. */
for (const person of people) {
  const display = birthplaceDisplay(person.slug, person.birthPlace);
  check(
    `birthplace display label ${person.slug}`,
    person.birthPlace.displayEntity === display.entity
      && person.birthPlace.displayLabel === display.label
      && person.birthPlace.normalisedLabel
        === [display.label, person.birthPlace.country?.label].filter(Boolean).join(', '),
    `${person.birthPlace.displayLabel} (${person.birthPlace.displayEntity}) for `
      + `${person.birthPlace.entityLabel} (${person.birthPlace.entity})`,
  );
}

/* 10 — unknown-time records carry no angle, house, rising or sect claim.
   The reading itself may not mention them at all. Metadata may, but only
   inside an explicit negation — saying a page has no houses is the honest
   disclosure, not a house claim. */
const FORBIDDEN_UNKNOWN_TIME = /\b(rising sign|ascendant|\basc\b|midheaven|\bmc\b|house cusp|houses?|sect|day chart|night chart)\b/iu;
const NEGATED = /\b(no|without|omit\w*|not) [^.]{0,40}\b(houses?|rising sign|angles?|ascendant|midheaven|sect)\b/iu;
for (const person of people) {
  const copy = JSON.parse(await readFile(join(PILOT, 'copy', `${person.slug}.json`), 'utf8'));
  const computed = JSON.parse(await readFile(join(PILOT, 'computed', `${person.slug}.json`), 'utf8'));
  const text = [copy.lede, ...copy.blocks.map((block) => block.text)].join(' ');
  const match = text.match(FORBIDDEN_UNKNOWN_TIME);
  check(`no angle/house/sect claim ${person.slug}`, match === null, match ? `matched "${match[0]}"` : '');
  const metaMatch = copy.metaDescription.match(FORBIDDEN_UNKNOWN_TIME);
  check(
    `metadata mentions angles only as a negation ${person.slug}`,
    metaMatch === null || NEGATED.test(copy.metaDescription),
    metaMatch ? `"${metaMatch[0]}" — negated: ${NEGATED.test(copy.metaDescription)}` : '',
  );
  check(
    `computation flags ${person.slug}`,
    person.computation.anglesComputed === false
      && person.computation.housesComputed === false
      && person.computation.sectComputed === false,
    '',
  );

  const settled = computed.placements.filter((placement) => placement.stableAcrossDay);
  const elementTotal = Object.values(computed.patterns.elements).reduce((sum, value) => sum + value, 0);
  const modalityTotal = Object.values(computed.patterns.modalities).reduce((sum, value) => sum + value, 0);
  const expectedBySign = settled.reduce((counts, placement) => {
    counts[placement.sign] = (counts[placement.sign] ?? 0) + 1;
    return counts;
  }, {});
  check(
    `unknown-time aggregates use settled signs only ${person.slug}`,
    computed.patterns.settledBodyCount === settled.length
      && elementTotal === settled.length
      && modalityTotal === settled.length
      && computed.patterns.stelliums.every(({ sign, count }) => expectedBySign[sign] === count),
    `${settled.length} settled; element total ${elementTotal}; modality total ${modalityTotal}`,
  );
  check(
    `uncertain placements do not claim ten-body totals ${person.slug}`,
    settled.length === 10 || !/\bten bodies\b/iu.test(text),
    `${settled.length} settled placements`,
  );
  const unsettledNonMoon = computed.placements.filter((placement) => (
    !placement.stableAcrossDay && placement.body !== 'Moon'
  ));
  const transitions = computed.signUncertainTransitions ?? [];
  const transitionBodies = transitions
    .filter((transition) => transition.body !== 'Moon')
    .map((transition) => transition.body)
    .sort();
  const unsettledBodies = unsettledNonMoon.map((placement) => placement.body).sort();
  check(
    `non-Moon sign-transition inventory ${person.slug}`,
    JSON.stringify(transitionBodies) === JSON.stringify(unsettledBodies),
    `computed ${transitionBodies.join(', ') || 'none'}; expected ${unsettledBodies.join(', ') || 'none'}`,
  );
  const facts = copy.blocks.flatMap((block) => block.facts);
  for (const transition of transitions.filter((entry) => entry.body !== 'Moon')) {
    const expectedFact = `sign-uncertain:${transition.body}:${transition.signAtCivilDayStart}:${transition.signAtCivilDayEnd}`;
    const expectedSentence = `${transition.body} crossed from ${signName(transition.signAtCivilDayStart)} `
      + `into ${signName(transition.signAtCivilDayEnd)} during that day, so its sign is left open.`;
    check(
      `non-Moon sign uncertainty named ${person.slug}-${transition.body.toLowerCase()}`,
      facts.includes(expectedFact) && text.includes(expectedSentence),
      expectedSentence,
    );
  }
  const daySpanHours = (
    Date.parse(computed.computation.civilDayEndUtc) - Date.parse(computed.computation.civilDayStartUtc)
  ) / 3_600_000;
  check(
    `complete civil-day bounds ${person.slug}`,
    completeCivilDay(computed.computation.civilDayStartUtc, computed.computation.civilDayEndUtc),
    `${computed.computation.civilDayStartUtc} → ${computed.computation.civilDayEndUtc} (${daySpanHours}h)`,
  );
}

/* 11 — portrait licensing and a rendered attribution string */
for (const person of people) {
  const portrait = person.portrait;
  if (!portrait.available) {
    check(`portrait absence recorded ${person.slug}`, typeof portrait.reason === 'string' && portrait.reason.length > 0, portrait.reason);
    continue;
  }
  const ok = typeof portrait.creator === 'string' && portrait.creator.length > 0
    && typeof portrait.licence === 'string'
    && typeof portrait.renderedAttribution === 'string'
    && portrait.renderedAttribution.includes(portrait.creator)
    && portrait.renderedAttribution.includes('Wikimedia Commons')
    && (!portrait.attributionRequired || typeof portrait.licenceUrl === 'string');
  check(`portrait licence ${person.slug}`, ok, portrait.renderedAttribution);
}

/* 12 — content depth against the declared thresholds */
for (const person of people) {
  const contentDepth = person.contentDepth;
  check(`word floor ${person.slug}`, contentDepth.originalWords >= thresholds.originalWordFloor,
    `${contentDepth.originalWords} words`);
  check(`substantive floor ${person.slug}`, contentDepth.substantiveStatements >= thresholds.substantiveStatementFloor,
    `${contentDepth.substantiveStatements} statements`);
}
check('similarity ceiling', depth.highestSimilarity.similarity <= thresholds.similarityCeiling,
  `max ${depth.highestSimilarity.similarity} (${depth.highestSimilarity.pair.join(' <> ')}), ceiling ${thresholds.similarityCeiling}`);

/* 13 — no full article text or prohibited-source text is committed */
const evidenceFiles = await readdir(join(PILOT, 'evidence'));
let longestStoredString = { file: null, length: 0 };
for (const file of evidenceFiles) {
  const raw = await readFile(join(PILOT, 'evidence', file), 'utf8');
  for (const value of JSON.stringify(JSON.parse(raw)).split('"')) {
    if (value.length > longestStoredString.length) longestStoredString = { file, length: value.length, value };
  }
}
check('no article prose cached', longestStoredString.length <= 400,
  `longest stored string ${longestStoredString.length} chars in ${longestStoredString.file}`);
// Prohibited sources are tested against the URLs the pilot treats as
// evidence. A photographer's own domain inside a Commons credit line is
// an attribution, not a source of facts, so credits are checked
// separately: they may never appear in a sources field.
const PROHIBITED_SOURCE = /(astro-databank|astrotheme|astro\.com|famousbirthdays|celebrity|imdb|astrolog)/iu;
const evidenceUrls = people.flatMap((person) => [
  person.sources.wikidata.entityUrl,
  person.sources.wikipedia.articleUrl,
  person.portrait.available ? person.portrait.filePage : null,
  person.portrait.available ? person.portrait.licenceUrl : null,
].filter(Boolean));
const prohibited = evidenceUrls.filter((url) => PROHIBITED_SOURCE.test(url));
check('no prohibited source among the evidence URLs', prohibited.length === 0, prohibited.join(' '));
// A credit may name a person; what it may never do is become a source
// URL. Compare hosts, not free text — the subject's own name legitimately
// appears in both a credit and an article title.
const creditHosts = people
  .filter((person) => person.portrait.available)
  .flatMap((person) => (person.portrait.creator.match(/[\w-]+\.(com|net|org|io)\b/gu) ?? [])
    .map((host) => ({ slug: person.slug, host })));
const leaked = creditHosts.filter(({ host }) => evidenceUrls.some((url) => url.includes(host)));
check('no portrait credit domain appears among the evidence URLs', leaked.length === 0,
  leaked.map((item) => `${item.slug}:${item.host}`).join(', '));
check('a credit naming the subject never renders as a licence holder',
  people.every((person) => !person.portrait.available
    || person.portrait.creator.trim().toLowerCase() !== person.displayName.trim().toLowerCase()),
  '');

/* 14 — birthday cross-links resolve to a committed page */
const birthdayFiles = new Set((await readdir(join(REPO, 'src/content/birthdays')))
  .filter((name) => name.endsWith('.mdx')).map((name) => name.replace(/\.mdx$/u, '')));
for (const person of people) {
  const key = person.birthDate.birthdayRoute.replace(/^\/birthday\//u, '').replace(/\/$/u, '');
  check(`birthday cross-link ${person.slug}`, birthdayFiles.has(key), person.birthDate.birthdayRoute);
}

/* 15 — disciplines are an editorial selection from sourced claims */
for (const person of people) {
  const evidence = JSON.parse(await readFile(join(PILOT, 'evidence', `${person.slug}.json`), 'utf8'));
  const sourced = new Set(evidence.occupations.map((item) => item.label));
  const unsourced = person.disciplines.filter((discipline) => !sourced.has(discipline));
  check(`disciplines sourced ${person.slug}`, unsourced.length === 0, unsourced.join(', '));
}

/* 16 — the dignity table matches src/lib/dignities.ts */
const dignitiesSource = await readFile(join(REPO, 'src/lib/dignities.ts'), 'utf8');
const toolSource = await readFile(join(HERE, 'compute-astro.mjs'), 'utf8');
const dignityParity = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'].every((body) => {
  const site = dignitiesSource.match(new RegExp(`${body}: \\{[^}]*\\}`, 'u'))?.[0] ?? '';
  const tool = toolSource.match(new RegExp(`${body}: \\{[^}]*\\}`, 'u'))?.[0] ?? '';
  const signsOf = (text) => (text.match(/'[a-z]+'/gu) ?? []).join(',');
  return site.length > 0 && signsOf(site) === signsOf(tool);
});
check('dignity table matches src/lib/dignities.ts', dignityParity, '');

/* 17 — subject pronouns are never guessed */
const PRONOUN = /\b(he|him|his|she|her|hers)\b/iu;
for (const person of people) {
  const copy = JSON.parse(await readFile(join(PILOT, 'copy', `${person.slug}.json`), 'utf8'));
  const text = [copy.lede, copy.identity, ...copy.blocks.map((block) => block.text)].join(' ');
  const match = text.match(PRONOUN);
  check(`no subject pronoun ${person.slug}`, match === null, match ? `matched "${match[0]}"` : '');
}

/* 18 — no sensitive-topic or causal claim in the copy */
const SENSITIVE = /\b(illness|disease|diagnos\w*|suicide|death of|affair|marriage|divorce|arrest\w*|convict\w*|wealth|fortune|net worth|sexual\w*|pregnan\w*|addict\w*)\b/iu;
const CAUSAL = /\b(because of (this|the) (placement|chart|sign)|caused|made (him|her|them) )\b/iu;
for (const person of people) {
  const copy = JSON.parse(await readFile(join(PILOT, 'copy', `${person.slug}.json`), 'utf8'));
  const text = [copy.lede, ...copy.blocks.map((block) => block.text)].join(' ');
  check(`no sensitive material ${person.slug}`, !SENSITIVE.test(text), '');
  check(`no causal claim ${person.slug}`, !CAUSAL.test(text), '');
  check(`no numeric score ${person.slug}`, !/\b\d{1,3}\s?(%|\/\s?100|out of 10)\b/u.test(text), '');
}

/* 19 — removal/suppression status is honoured everywhere */
const suppressed = people.filter((person) => person.suppression.status !== 'active');
check('no suppressed record appears in any output surface', suppressed.length === 0,
  suppressed.map((person) => person.slug).join(', '));

/* 20 — Phase boundary: Phase 5A publishes nothing; Phase 5B may add only
   noindex routes; Phase 5C may publish only the explicit conservative
   allowlist while retaining the living-person and directory protections. */
const sitemap = await readFile(join(REPO, 'src/pages/sitemap.xml.ts'), 'utf8');
const pagesDir = await readdir(join(REPO, 'src/pages'));
const nav = await readFile(join(REPO, 'src/components/SiteNav.astro'), 'utf8');
check('no People entry in the navigation', !/\/people\//u.test(nav), '');
if (phase5c) {
  const production = JSON.parse(await readFile(join(REPO, 'src/data/people.json'), 'utf8'));
  const policy = JSON.parse(await readFile(join(PILOT, 'index-policy.json'), 'utf8'));
  const demand = JSON.parse(await readFile(join(PILOT, 'index-demand.json'), 'utf8'));
  const resolvedPolicy = resolvePeopleIndexPolicy({ manifest, indexPolicy: policy, indexDemand: demand });
  const directoryRoute = await readFile(join(REPO, 'src/pages/people/index.astro'), 'utf8').catch(() => '');
  const personRoute = await readFile(join(REPO, 'src/pages/people/[slug].astro'), 'utf8').catch(() => '');
  const indexable = production.people.filter((person) => person.indexEligibility.eligible);
  const deferred = production.people.filter((person) => (
    !person.indexEligibility.eligible && !person.living
  ));
  const protectedLiving = production.people.filter((person) => person.living);
  check('Phase 5C people route exists', pagesDir.includes('people'), '');
  check('Phase 5C sitemap is allowlist-driven', sitemap.includes('INDEXABLE_PEOPLE.map'), '');
  check(
    'Phase 5C route robots are eligibility-driven',
    directoryRoute.includes('noindex={!PEOPLE_DIRECTORY_INDEXABLE}')
      && directoryRoute.includes('nofollow={!PEOPLE_DIRECTORY_INDEXABLE}')
      && personRoute.includes('noindex={!person.indexEligibility.eligible}')
      && personRoute.includes('nofollow={person.living}'),
    '',
  );
  check(
    'indexable set is exactly the demand-selected reviewed records',
    indexable.length === resolvedPolicy.indexableProfiles.size
      && indexable.every((person) => !person.living)
      && indexable.map((person) => person.slug).sort().join(',')
        === [...resolvedPolicy.indexableProfiles].sort().join(','),
    `${indexable.length} indexable`,
  );
  check(
    'deferred set is exactly the reviewed deceased search-demand tail',
    deferred.length === resolvedPolicy.noindexTailProfiles.size
      && deferred.every((person) => (
        person.indexEligibility.blockedBy.some((reason) => reason.includes('search-demand-tail'))
      ))
      && deferred.map((person) => person.slug).sort().join(',')
        === [...resolvedPolicy.noindexTailProfiles].sort().join(','),
    `${deferred.length} deferred`,
  );
  check(
    'Phase 5C exact protected living set',
    protectedLiving.length === 4
      && protectedLiving.every((person) => person.living)
      && protectedLiving.map((person) => person.slug).sort().join(',')
        === [...policy.protectedLivingProfiles].sort().join(','),
    `${protectedLiving.length} protected`,
  );
  check(
    'directory indexability follows the policy threshold',
    policy.directoryIndexable === (indexable.length >= policy.minimumIndexableProfilesForDirectory),
    `${indexable.length}/${policy.minimumIndexableProfilesForDirectory} → ${policy.directoryIndexable}`,
  );
  for (const person of indexable) {
    const { entities } = birthplaceDisplay(person.slug, person.birthPlace);
    check(
      `published birthplace names a settlement ${person.slug}`,
      entities.some((entity) => isSettlement(entity)),
      person.birthPlace.displayLabel,
    );
  }
} else if (phase5b) {
  check('no /people/ entry in the sitemap', !/\/people\//u.test(sitemap), '');
  const directoryRoute = await readFile(join(REPO, 'src/pages/people/index.astro'), 'utf8').catch(() => '');
  const personRoute = await readFile(join(REPO, 'src/pages/people/[slug].astro'), 'utf8').catch(() => '');
  check('Phase 5B people route exists', pagesDir.includes('people'), '');
  check(
    'Phase 5B routes are source-pinned noindex and nofollow',
    [directoryRoute, personRoute].every((source) => /\bnoindex\b/u.test(source) && /\bnofollow\b/u.test(source)),
    '',
  );
} else {
  check('no /people/ entry in the sitemap', !/\/people\//u.test(sitemap), '');
  check('no src/pages/people route exists', !pagesDir.includes('people'), '');
}
if (!phase5c) {
  check(`every pilot record is index-ineligible in Phase ${phase5b ? '5B' : '5A'}`,
    people.every((person) => person.indexEligibility.eligible === false), '');
}
check('every pilot record passes its content checks',
  people.every((person) => person.indexEligibility.contentChecksPassed === true),
  people.filter((person) => !person.indexEligibility.contentChecksPassed).map((person) => person.slug).join(', '));

/* 21 — the screening log accounts for every candidate */
check('screening log covers every candidate', screening.candidates.length === candidates.length,
  `${screening.candidates.length} of ${candidates.length}`);
const excluded = screening.candidates.filter((row) => row.verdict === 'excluded');
check('every exclusion states a machine-checkable reason',
  excluded.every((row) => Array.isArray(row.reasons) && row.reasons.length > 0),
  `${excluded.length} excluded`);

/* ── Report ─────────────────────────────────────────────────────────── */
const grouped = new Map();
for (const result of results) {
  const key = result.name.replace(/\s+[a-z0-9-]+$/u, '');
  const entry = grouped.get(key) ?? { pass: 0, fail: 0, sample: '' };
  entry[result.ok ? 'pass' : 'fail'] += 1;
  if (!entry.sample && result.detail) entry.sample = result.detail;
  grouped.set(key, entry);
}
for (const [name, entry] of grouped) {
  const status = entry.fail === 0 ? 'PASS' : 'FAIL';
  console.log(`${status} ${name} — ${entry.pass} passed${entry.fail ? `, ${entry.fail} FAILED` : ''}${entry.sample ? ` · e.g. ${entry.sample}` : ''}`);
}
console.log('\nEra separation:');
for (const row of eraRows) console.log(`  ${row.sign}: ${row.closest} — ${row.minGapDays} days`);
console.log('\nExclusions:');
for (const row of excluded) console.log(`  ${row.slug}: ${row.reasons.join('; ')}`);
console.log(`\nContent depth: ${depth.originalWords.min}–${depth.originalWords.max} original words `
  + `(floor ${thresholds.originalWordFloor}), ${depth.substantiveStatements.min}–${depth.substantiveStatements.max} substantive statements `
  + `(floor ${thresholds.substantiveStatementFloor}), max similarity ${depth.highestSimilarity.similarity} (ceiling ${thresholds.similarityCeiling}).`);

if (failures.length > 0) {
  console.error(`\nPhase ${phase5c ? '5C conservative release' : phase5b ? '5B noindex' : '5A'} pilot validation FAILED — ${failures.length} of ${results.length} checks.`);
  for (const failure of failures) console.error(`  ${failure.name}${failure.detail ? ` — ${failure.detail}` : ''}`);
  process.exitCode = 1;
} else {
  console.log(`\nPhase ${phase5c ? '5C conservative release' : phase5b ? '5B noindex' : '5A'} pilot validation PASSED — ${results.length}/${results.length} checks.`);
}
