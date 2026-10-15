import { z } from 'astro/zod';
import rawPeople from '../data/people.json';

const SIGN_SLUGS = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
] as const;
const BODY_NAMES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
] as const;

const signSlugSchema = z.enum(SIGN_SLUGS);
const bodySchema = z.enum(BODY_NAMES);
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const isoInstantSchema = z.string().datetime({ offset: true });
const httpsUrlSchema = z.string().url().refine((value) => value.startsWith('https://'));

const sourceSchema = z.object({
  wikidata: z.object({
    entityUrl: httpsUrlSchema,
    propertiesUsed: z.array(z.string()).min(1),
    lastrevid: z.number().int().positive(),
  }).strict(),
  wikipedia: z.object({
    language: z.literal('en'),
    title: z.string().min(1),
    articleUrl: httpsUrlSchema,
    pageId: z.number().int().positive(),
    revisionId: z.number().int().positive(),
    revisionTimestamp: isoInstantSchema,
  }).strict(),
  retrievedAtUtc: isoInstantSchema,
}).strict();

const portraitSchema = z.discriminatedUnion('available', [
  z.object({
    available: z.literal(true),
    file: z.string().startsWith('File:'),
    filePage: httpsUrlSchema,
    creator: z.string().min(1),
    licence: z.string().min(1),
    licenceUrl: httpsUrlSchema.nullable(),
    attributionRequired: z.boolean(),
    renderedAttribution: z.string().min(1),
    renderedAttributionLinks: z.object({
      creator: httpsUrlSchema,
      licence: httpsUrlSchema.nullable(),
      source: httpsUrlSchema,
    }).strict(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    assetPath: z.string().regex(/^\/assets\/people\/[a-z0-9-]+\.webp$/u),
  }).strict(),
  z.object({
    available: z.literal(false),
    reason: z.string().min(1),
    file: z.string().startsWith('File:').optional(),
  }).strict(),
]);

const placementSchema = z.object({
  body: bodySchema,
  sign: signSlugSchema,
  signName: z.string().min(1),
  degree: z.number().min(0).lt(30),
  retrograde: z.boolean(),
  speedPerDay: z.number(),
  dignity: z.enum(['domicile', 'exaltation', 'detriment', 'fall']).nullable(),
  stableAcrossDay: z.boolean(),
  retrogradeStableAcrossDay: z.boolean(),
  longitude: z.number().min(0).lt(360),
}).strict();

const aspectSchema = z.object({
  a: bodySchema,
  b: bodySchema,
  type: z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
  orb: z.number().min(0),
  applying: z.boolean(),
}).strict();

const positiveCount = z.number().int().positive();
const elementCountsSchema = z.object({
  fire: positiveCount.optional(),
  earth: positiveCount.optional(),
  air: positiveCount.optional(),
  water: positiveCount.optional(),
}).strict().refine((counts) => Object.keys(counts).length > 0, {
  message: 'At least one settled element count is required',
});
const modalityCountsSchema = z.object({
  cardinal: positiveCount.optional(),
  fixed: positiveCount.optional(),
  mutable: positiveCount.optional(),
}).strict().refine((counts) => Object.keys(counts).length > 0, {
  message: 'At least one settled modality count is required',
});

const readingBlockSchema = z.object({
  key: z.enum(['sun', 'personal', 'geometry', 'figures', 'dignity', 'shape', 'moon']),
  title: z.string().min(1),
  facts: z.array(z.string()).min(1),
  text: z.string().min(1),
  uncertain: z.boolean().optional(),
}).strict();

const personSchema = z.object({
  qid: z.string().regex(/^Q\d+$/u),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  displayName: z.string().min(1),
  shortDescription: z.string().min(1),
  sourceReview: z.object({
    reviewedOn: isoDateSchema,
    status: z.enum(['corrected', 'adopted-date', 'uncertain-death', 'reference-location']),
    note: z.string().min(1),
    sources: z.array(z.object({ title: z.string().min(1), url: httpsUrlSchema }).strict()).min(1),
  }).strict().optional(),
  disciplines: z.array(z.string().min(1)).min(1),
  birthDate: z.object({
    storedValue: isoDateSchema,
    precision: z.literal('day'),
    calendarModel: z.literal('proleptic-gregorian'),
    calendarConversion: z.string().min(1),
    displayedDate: isoDateSchema,
    computedGregorianDate: isoDateSchema,
    birthdayCrossLinkKey: isoDateSchema,
    birthdayRoute: z.string().regex(/^\/birthday\/[a-z]+-\d{1,2}\/$/u),
  }).strict(),
  birthTime: z.null(),
  timeQuality: z.literal('unknown'),
  birthTimeEvidence: z.string().min(1),
  birthPlace: z.object({
    entity: z.string().regex(/^Q\d+$/u),
    entityLabel: z.string().min(1),
    displayEntity: z.string().regex(/^Q\d+$/u),
    displayLabel: z.string().min(1),
    normalisedLabel: z.string().min(1),
    country: z.object({
      entity: z.string().regex(/^Q\d+$/u),
      label: z.string().min(1),
    }).strict().nullable(),
    coordinates: z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      sourceEntity: z.string().regex(/^Q\d+$/u),
      sourceEntityLabel: z.string().min(1),
      wikidataPrecision: z.number().nullable(),
      escalationSteps: z.number().int().min(0).max(1),
      precisionDowngrade: z.string().nullable(),
    }).strict(),
    timeZone: z.string().min(1),
  }).strict(),
  computation: z.object({
    convention: z.string().min(1),
    timeZone: z.string().min(1),
    civilTime: z.literal('12:00'),
    utcInstant: isoInstantSchema,
    utcOffsetMinutesAtBirth: z.number(),
    civilDayStartUtc: isoInstantSchema,
    civilDayEndUtc: isoInstantSchema,
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    coordinateEscalationSteps: z.number().int().min(0).max(1),
    coordinateSourceEntity: z.string().regex(/^Q\d+$/u),
    ephemeris: z.string().min(1),
    aspectTable: z.string().min(1),
    anglesComputed: z.literal(false),
    housesComputed: z.literal(false),
    sectComputed: z.literal(false),
    meridianResidualMinutes: z.number(),
    meridianResidualMoonDegrees: z.number().min(0),
  }).strict(),
  sunSign: z.object({
    slug: signSlugSchema,
    name: z.string().min(1),
    degree: z.number().min(0).lt(30),
    determinable: z.literal(true),
    cuspCheck: z.object({
      ambiguous: z.literal(false),
      boundaryUtc: z.null(),
      degreesInsideAtWindowStart: z.number().min(0),
      degreesToNextBoundaryAtWindowEnd: z.number().min(0),
    }).strict(),
  }).strict(),
  moon: z.object({
    sign: signSlugSchema,
    signName: z.string().min(1),
    degree: z.number().min(0).lt(30),
    uncertain: z.boolean(),
    signAtCivilDayStart: signSlugSchema,
    signAtCivilDayEnd: signSlugSchema,
  }).strict(),
  unknownTimeErrorBandDegrees: z.record(bodySchema, z.number().min(0)),
  dataQualityLabel: z.string().min(1),
  sources: sourceSchema,
  portrait: portraitSchema,
  living: z.boolean(),
  reviewedAtUtc: isoInstantSchema,
  computationInputVersion: z.object({
    ephemeris: z.string().min(1),
    aspectTable: z.string().min(1),
    pilotTools: z.string().min(1),
  }).strict(),
  contentDepth: z.object({
    originalWords: z.number().int().min(250),
    substantiveStatements: z.number().int().min(8),
    highestPairwiseSimilarity: z.number().min(0).max(0.32),
  }).strict(),
  indexEligibility: z.object({
    eligible: z.boolean(),
    blockedBy: z.array(z.string().min(1)),
    contentChecksPassed: z.literal(true),
    contentCheckFailures: z.array(z.string()).length(0),
  }).strict().superRefine((eligibility, context) => {
    if (eligibility.eligible && eligibility.blockedBy.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'An indexable People record cannot retain a blocker',
      });
    }
    if (!eligibility.eligible && eligibility.blockedBy.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'A protected People record must state its blocker',
      });
    }
  }),
  suppression: z.object({
    status: z.literal('active'),
    requestedBy: z.null(),
    decidedAtUtc: z.null(),
    note: z.null(),
  }).strict(),
  placements: z.array(placementSchema).length(10),
  aspectsStableAcrossCivilDay: z.array(aspectSchema),
  patterns: z.object({
    settledBodyCount: z.number().int().min(1).max(10),
    stelliums: z.array(z.object({
      sign: signSlugSchema,
      count: z.number().int().min(3).max(10),
    }).strict()),
    elements: elementCountsSchema,
    modalities: modalityCountsSchema,
    retrograde: z.array(bodySchema),
    directionUncertain: z.array(bodySchema),
  }).strict(),
  copy: z.object({
    title: z.string().min(1),
    metaDescription: z.string().min(1).max(180),
    lede: z.string().min(1),
    ledeFact: z.string().min(1),
    blocks: z.array(readingBlockSchema).min(4).max(7),
    birthdayLink: z.object({
      href: z.string().regex(/^\/birthday\/[a-z]+-\d{1,2}\/$/u),
      label: z.string().min(1),
    }).strict(),
    signLink: z.object({
      href: z.string().regex(/^\/[a-z]+\/$/u),
      label: z.string().min(1),
    }).strict(),
    measurements: z.object({
      originalWords: z.number().int().min(250),
      substantiveStatements: z.number().int().min(8),
      blocks: z.number().int().min(4).max(7),
    }).strict(),
  }).strict(),
}).strict();

const peoplePilotSchema = z.object({
  schema: z.literal('zodiacs.phase5.people.v1'),
  status: z.string().regex(/^Packet F search-quality release — \d+ indexable deceased records, \d+ deferred deceased records, 4 protected living records, 1 withdrawn$/u),
  releaseCounts: z.object({
    indexableDeceased: z.number().int().nonnegative(),
    deferredDeceased: z.number().int().nonnegative(),
    protectedLiving: z.literal(4),
    withdrawn: z.literal(1),
  }).strict(),
  reviewedAtUtc: isoInstantSchema,
  sourceManifestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  sourceIndexPolicySha256: z.string().regex(/^[a-f0-9]{64}$/u),
  sourceIndexDemandSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  indexPolicyApprovedAtUtc: isoInstantSchema,
  directoryIndexable: z.boolean(),
  people: z.array(personSchema).length(501),
}).strict().superRefine((release, context) => {
  const counts = {
    indexableDeceased: release.people.filter((person) => (
      person.indexEligibility.eligible && !person.living
    )).length,
    deferredDeceased: release.people.filter((person) => (
      !person.indexEligibility.eligible && !person.living
    )).length,
    protectedLiving: release.people.filter((person) => person.living).length,
    withdrawn: 1,
  };
  const expectedStatus = `Packet F search-quality release — ${counts.indexableDeceased} indexable deceased records, ${counts.deferredDeceased} deferred deceased records, ${counts.protectedLiving} protected living records, 1 withdrawn`;
  if (JSON.stringify(release.releaseCounts) !== JSON.stringify(counts)) {
    context.addIssue({ code: 'custom', message: 'People release counts do not match the records' });
  }
  if (release.status !== expectedStatus) {
    context.addIssue({ code: 'custom', message: 'People release status does not match the records' });
  }
});

export const PEOPLE_PILOT = peoplePilotSchema.parse(rawPeople);
export type PersonRecord = z.infer<typeof personSchema>;
export const PEOPLE = PEOPLE_PILOT.people;
export const PEOPLE_BY_SLUG = new Map(PEOPLE.map((person) => [person.slug, person] as const));
export const INDEXABLE_PEOPLE = PEOPLE.filter((person) => person.indexEligibility.eligible);
export const DIRECTORY_PEOPLE = INDEXABLE_PEOPLE;
export const PEOPLE_DIRECTORY_INDEXABLE = PEOPLE_PILOT.directoryIndexable;

export const PEOPLE_DISCIPLINE_FILTERS = [
  { slug: 'science', name: 'Science' },
  { slug: 'writing', name: 'Writing' },
  { slug: 'music', name: 'Music' },
  { slug: 'art', name: 'Art' },
  { slug: 'architecture', name: 'Architecture' },
  { slug: 'sport', name: 'Sport' },
  { slug: 'film-stage', name: 'Film & stage' },
  { slug: 'design', name: 'Design' },
  { slug: 'public-life', name: 'Public life' },
] as const;
export type PeopleDisciplineGroup = typeof PEOPLE_DISCIPLINE_FILTERS[number]['slug'];

const DISCIPLINE_GROUP_BY_SOURCE: Readonly<Record<string, PeopleDisciplineGroup>> = {
  architect: 'architecture',
  barrister: 'public-life',
  biologist: 'science',
  chemist: 'science',
  composer: 'music',
  crystallographer: 'science',
  draftsperson: 'art',
  environmentalist: 'public-life',
  essayist: 'writing',
  'human rights defender': 'public-life',
  'jazz musician': 'music',
  journalist: 'writing',
  mathematician: 'science',
  novelist: 'writing',
  'nuclear physicist': 'science',
  painter: 'art',
  pianist: 'music',
  poet: 'writing',
  'political philosopher': 'writing',
  'political writer': 'writing',
  'singer-songwriter': 'music',
  sociologist: 'science',
  'tennis player': 'sport',
  'theoretical physicist': 'science',
  physicist: 'science', botanist: 'science', zoologist: 'science', ornithologist: 'science',
  naturalist: 'science', geneticist: 'science', biochemist: 'science', statistician: 'science',
  'computer scientist': 'science', astronomer: 'science', astrophysicist: 'science',
  physician: 'science', surgeon: 'science', nurse: 'science', psychologist: 'science',
  psychiatrist: 'science', psychoanalyst: 'science', neurologist: 'science',
  anthropologist: 'science', archaeologist: 'science', paleontologist: 'science',
  geologist: 'science', oceanographer: 'science', seismologist: 'science', ecologist: 'science',
  primatologist: 'science', ethologist: 'science', virologist: 'science',
  bacteriologist: 'science', immunologist: 'science', pharmacologist: 'science',
  engineer: 'science', inventor: 'science', 'aerospace engineer': 'science',
  agronomist: 'science', economist: 'science', cartographer: 'science',
  scientist: 'science', cosmologist: 'science', logician: 'science',
  writer: 'writing', playwright: 'writing', 'short story writer': 'writing',
  'literary critic': 'writing', historian: 'writing', philosopher: 'writing',
  screenwriter: 'writing', biographer: 'writing', translator: 'writing', diarist: 'writing',
  autobiographer: 'writing', "children's writer": 'writing', 'science fiction writer': 'writing',
  lyricist: 'writing', publisher: 'writing',
  'analytic philosopher': 'writing', 'social critic': 'writing', humorist: 'writing',
  singer: 'music', musician: 'music', violinist: 'music', cellist: 'music', guitarist: 'music',
  conductor: 'music', songwriter: 'music', 'opera singer': 'music', saxophonist: 'music',
  trumpeter: 'music', drummer: 'music', bandleader: 'music', 'music educator': 'music',
  'recording artist': 'music', 'jazz singer': 'music',
  sculptor: 'art', photographer: 'art', printmaker: 'art', illustrator: 'art', artist: 'art',
  'visual artist': 'art', muralist: 'art', ceramicist: 'art', photojournalist: 'art',
  'urban planner': 'architecture',
  'fashion designer': 'design', designer: 'design', 'costume designer': 'design',
  'industrial designer': 'design', 'furniture designer': 'design', 'interior designer': 'design',
  'film director': 'film-stage', actor: 'film-stage', 'film actor': 'film-stage',
  'stage actor': 'film-stage', 'film producer': 'film-stage', comedian: 'film-stage',
  'television actor': 'film-stage', filmmaker: 'film-stage',
  politician: 'public-life', statesperson: 'public-life', lawyer: 'public-life',
  judge: 'public-life', activist: 'public-life', 'human rights activist': 'public-life',
  'civil rights advocate': 'public-life', suffragist: 'public-life', suffragette: 'public-life',
  "women's rights activist": 'public-life', 'trade unionist': 'public-life',
  diplomat: 'public-life', revolutionary: 'public-life', 'resistance fighter': 'public-life',
  'political activist': 'public-life', philanthropist: 'public-life',
  'social reformer': 'public-life', nun: 'public-life', missionary: 'public-life',
  explorer: 'public-life', aviator: 'public-life', astronaut: 'public-life',
  'aircraft pilot': 'public-life', 'test pilot': 'public-life',
  'polar explorer': 'public-life', teacher: 'public-life', 'university teacher': 'public-life',
  pedagogue: 'public-life', feminist: 'public-life',
  monarch: 'public-life', 'freedom fighter': 'public-life', monk: 'public-life',
  'association football player': 'sport', footballer: 'sport', 'baseball player': 'sport',
  'basketball player': 'sport', boxer: 'sport', athlete: 'sport', sprinter: 'sport',
  'long-distance runner': 'sport', swimmer: 'sport', cricketer: 'sport', golfer: 'sport',
  'racing driver': 'sport', 'racing automobile driver': 'sport', 'ice hockey player': 'sport',
  'American football player': 'sport', 'figure skater': 'sport',
  'track and field athlete': 'sport', mountaineer: 'sport', 'Formula One driver': 'sport',
  'martial artist': 'sport',
};

export function peopleDisciplineGroups(person: PersonRecord): PeopleDisciplineGroup[] {
  return [...new Set(person.disciplines.map((discipline) => {
    const group = DISCIPLINE_GROUP_BY_SOURCE[discipline];
    if (!group) throw new Error(`Unmapped People discipline: ${discipline}`);
    return group;
  }))];
}

export function peopleForBirthday(route: string) {
  return PEOPLE.filter((person) => (
    person.suppression.status === 'active'
    && person.indexEligibility.eligible
    && person.birthDate.birthdayRoute === route
  )).sort((a, b) => a.birthDate.computedGregorianDate.localeCompare(b.birthDate.computedGregorianDate));
}
/** First three render immediately; the rest sit behind a native details disclosure. */
export const BIRTHDAY_PEOPLE_VISIBLE = 3;
