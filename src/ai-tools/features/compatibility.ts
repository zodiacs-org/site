/**
 * get_compatibility: two birth charts side by side (synastry) for the
 * Zodiacs MCP tools. It reports the chart contacts between the two people
 * and the sign-to-sign facts the compatibility pages show, in the site's
 * own wording (src/lib/compat.ts). It never scores the pair, ranks it, or
 * says how the relationship will go: "no verdicts pretending to be scores".
 *
 * The local-time resolver is passed in, as the occasion tools do
 * (src/lib/occasions/card.ts): the MCP runtime passes the compute API's
 * bundled one (api/_compute/local-time.mjs). Pure: no network, storage or
 * logging; the result is a function of its inputs.
 */
import { z } from 'zod';
import { SIGN_SLUGS } from '../../lib/compute-api/constants';
import type { LocalTimeModule } from '../../lib/compute-api/local-time';
import { pairFacts, pairSlug, synastryLine } from '../../lib/compat';
import { compatibilityHandoffPath } from '../../lib/chart-handoff';
import { computeChart } from '../../lib/engine/full.js';
import { isGenerationalContact, summarizePair, type MinimalBody } from '../../lib/engine/synastry';
import type { Chart } from '../../lib/engine/types';
import { settledSignIndex } from '../../lib/profile/settled-signs';
import type { ShareChartInput } from '../../lib/share';
import { SIGNS, signIndexForLongitude } from '../../lib/signs';
import { parseCivilDate, parseCivilTime } from '../../lib/time/civil-date';

export const COMPATIBILITY_MIN_YEAR = 1800;
export const COMPATIBILITY_MAX_YEAR = 2199;
/** How many contacts the result lists, as the compatibility page does. */
export const COMPATIBILITY_TOP_CONTACTS = 8;
export const COMPATIBILITY_NOTE = 'Chart contacts and their traditional meanings. Zodiacs does not score relationships or predict how one will go.';

// ── Input ────────────────────────────────────────────────────────────

const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
const DATE_PATTERN = /^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/;
const WALL_CLOCK = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
/** Plain text only: no control characters, markup or link syntax. */
const PLAIN_TEXT = /^[^\u0000-\u001f\u007f<>{}[\]\\`]+$/u;

const plainText = (max: number) => z.string().trim().min(1).max(max).regex(PLAIN_TEXT, 'Use plain text.');

export const compatibilityPerson = z.strictObject({
  name: plainText(40).optional().describe('A first name to show, if the person wants one. Plain text.'),
  birthDate: z.string().regex(DATE_PATTERN).describe('The birth date, such as 1994-08-21 (years 1800–2199).'),
  time: z.string().regex(WALL_CLOCK).optional().describe('The birth time on the local clock, if known. Needs zone.'),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional().describe("The birthplace's time zone, such as Europe/Madrid. Needed with a time or a place."),
  latitude: z.number().min(-90).max(90).optional().describe("The birthplace's latitude. Give it with longitude and zone; with a birth time it adds the rising sign."),
  longitude: z.number().min(-180).max(180).optional(),
  place: plainText(80).optional().describe('The birthplace name, such as Madrid, Spain. Shown only.'),
}).superRefine((args, context) => {
  if ((args.latitude === undefined) !== (args.longitude === undefined)) context.addIssue({ code: 'custom', message: 'Give latitude and longitude together.' });
  if ((args.time !== undefined || args.latitude !== undefined) && !args.zone) context.addIssue({ code: 'custom', message: 'A birth time or a place needs its time zone.' });
});

export const compatibilityInput = z.strictObject({
  a: compatibilityPerson.describe('The first person.'),
  b: compatibilityPerson.describe('The second person.'),
});

export type CompatibilityPerson = z.infer<typeof compatibilityPerson>;
export type CompatibilityInput = z.infer<typeof compatibilityInput>;

// ── Output ───────────────────────────────────────────────────────────

const signSlug = z.enum(SIGN_SLUGS);
const bodyName = z.enum(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto']);
const tally = <T extends string>(keys: readonly [T, ...T[]]) => z.object(Object.fromEntries(keys.map((key) => [key, z.number().int().min(0)])) as Record<T, z.ZodNumber>);
const elementTally = tally(['fire', 'earth', 'air', 'water']);
const modalityTally = tally(['cardinal', 'fixed', 'mutable']);
const interaction = z.object({ label: z.string(), note: z.string() });

const personResult = z.object({
  name: z.string().nullable(),
  /** The label the contact lines use: the name, or "Person A" / "Person B". */
  label: z.string(),
  birthDate: z.string(),
  timeKnown: z.boolean(),
  placed: z.boolean(),
  place: z.string().nullable(),
  sun: signSlug.nullable(),
  moon: signSlug.nullable(),
  rising: signSlug.nullable(),
});

export const compatibilityData = z.object({
  a: personResult,
  b: personResult,
  signPair: z.object({
    slug: z.string(),
    signs: z.tuple([signSlug, signSlug]),
    same: z.boolean(),
    element: interaction,
    modality: interaction,
    polarity: z.string(),
  }).nullable(),
  contacts: z.array(z.object({
    aBody: bodyName,
    bBody: bodyName,
    aspect: z.enum(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
    orb: z.number().min(0),
    generational: z.boolean(),
    line: z.string(),
  })).max(COMPATIBILITY_TOP_CONTACTS),
  counts: z.object({
    easeful: z.number().int().min(0),
    charged: z.number().int().min(0),
    total: z.number().int().min(0),
    byAspect: tally(['conjunction', 'sextile', 'square', 'trine', 'opposition']),
  }),
  elements: z.object({ a: elementTally, b: elementTally }),
  modalities: z.object({ a: modalityTally, b: modalityTally }),
  pageUrl: z.string().nullable(),
  cardUrl: z.string().nullable(),
  notes: z.array(z.string()),
  note: z.literal(COMPATIBILITY_NOTE),
});

export type CompatibilityData = z.infer<typeof compatibilityData>;
export interface CompatibilityLink { title: string; url: string }

// ── Calculation ──────────────────────────────────────────────────────

/** The resolver methods this module calls; api/_compute/local-time.mjs supplies them. */
export type CompatibilityClock = Pick<LocalTimeModule, 'prepareLocalTime' | 'resolveLocalToUtc'>;

interface PersonChart {
  person: CompatibilityPerson;
  label: string;
  timeKnown: boolean;
  placed: boolean;
  chart: Chart;
  sunIndex: number | null;
  moonIndex: number | null;
  risingIndex: number | null;
  /** The bodies the contacts are found between: the Moon only with a birth time. */
  bodies: MinimalBody[];
}

function checkPerson(person: CompatibilityPerson, label: string): void {
  const date = parseCivilDate(person.birthDate);
  if (!date || date.year < COMPATIBILITY_MIN_YEAR || date.year > COMPATIBILITY_MAX_YEAR) {
    throw new RangeError(`${label}: the birth date must be a real date from ${COMPATIBILITY_MIN_YEAR} to ${COMPATIBILITY_MAX_YEAR}.`);
  }
  if (person.time !== undefined && !parseCivilTime(person.time)) throw new RangeError(`${label}: the birth time must be HH:MM.`);
  if ((person.latitude === undefined) !== (person.longitude === undefined)) throw new RangeError(`${label}: give latitude and longitude together.`);
  if ((person.time !== undefined || person.latitude !== undefined) && !person.zone) {
    throw new RangeError(`${label}: a birth time or a place needs its time zone.`);
  }
}

/** The birth instant: the given time, else local noon in the zone, else noon UTC. */
async function birthInstant(person: CompatibilityPerson, clock: CompatibilityClock): Promise<Date> {
  const time = person.time ?? '12:00';
  if (!person.zone) return new Date(`${person.birthDate}T${time}:00Z`);
  await clock.prepareLocalTime(person.birthDate, person.zone);
  const resolved = person.longitude !== undefined
    ? clock.resolveLocalToUtc(person.birthDate, time, person.zone, { longitude: person.longitude })
    : clock.resolveLocalToUtc(person.birthDate, time, person.zone);
  return resolved.utc;
}

async function personChart(person: CompatibilityPerson, fallback: string, clock: CompatibilityClock): Promise<PersonChart> {
  checkPerson(person, fallback);
  const timeKnown = person.time !== undefined;
  const placed = person.latitude !== undefined && person.longitude !== undefined;
  const utc = await birthInstant(person, clock);
  const chart = computeChart({
    utc,
    ...(placed ? { latitude: person.latitude, longitude: person.longitude } : {}),
    houseSystem: 'whole',
    timeKnown,
  });
  const lonOf = (body: string) => chart.bodies.find((row) => row.body === body)?.lon ?? Number.NaN;
  const angles = timeKnown && placed ? chart.angles : null;
  return {
    person,
    label: person.name ?? fallback,
    timeKnown,
    placed,
    chart,
    sunIndex: settledSignIndex('Sun', lonOf('Sun'), timeKnown),
    moonIndex: settledSignIndex('Moon', lonOf('Moon'), timeKnown),
    risingIndex: angles ? signIndexForLongitude(angles.asc) : null,
    bodies: chart.bodies
      .filter((row) => timeKnown || row.body !== 'Moon')
      .map((row) => ({ body: row.body, lon: row.lon })),
  };
}

function shareInput(side: PersonChart): ShareChartInput | null {
  const { person } = side;
  if (!person.zone || person.latitude === undefined || person.longitude === undefined) return null;
  return {
    date: person.birthDate,
    time: person.time ?? null,
    timeKnown: side.timeKnown,
    lat: person.latitude,
    lon: person.longitude,
    tz: person.zone,
    ...(person.name ? { name: person.name } : {}),
    ...(person.place ? { place: person.place } : {}),
    houseSystem: 'whole',
  };
}

const slugAt = (index: number | null) => (index === null ? null : SIGNS[index].slug);
const roundOrb = (orb: number) => Math.round(orb * 10) / 10;

function personRow(side: PersonChart): CompatibilityData['a'] {
  return {
    name: side.person.name ?? null,
    label: side.label,
    birthDate: side.person.birthDate,
    timeKnown: side.timeKnown,
    placed: side.placed,
    place: side.person.place ?? null,
    sun: slugAt(side.sunIndex) as CompatibilityData['a']['sun'],
    moon: slugAt(side.moonIndex) as CompatibilityData['a']['moon'],
    rising: slugAt(side.risingIndex) as CompatibilityData['a']['rising'],
  };
}

function notesFor(a: PersonChart, b: PersonChart): string[] {
  const notes: string[] = [];
  for (const side of [a, b]) {
    if (!side.timeKnown) {
      notes.push(`Without a birth time for ${side.label}, the Moon is left out: it moves about 13° in a day, so its contacts cannot be placed. Positions are for noon on the birth date, and the other orbs can differ by about a degree.`);
    } else if (!side.placed) {
      notes.push(`Without a birthplace for ${side.label}, the rising sign and houses are left out.`);
    }
    if (side.sunIndex === null) {
      notes.push(`${side.label} was born on a day the Sun changed sign, so the Sun sign depends on the birth time; the sign-to-sign facts are left out.`);
    }
  }
  return notes;
}

/**
 * Compare two birth charts. Throws RangeError with a plain message for a
 * date, time or zone the calculation cannot take.
 */
export async function computeCompatibility(
  args: CompatibilityInput,
  localTime: CompatibilityClock,
  origin = 'https://zodiacs.org',
): Promise<{ data: CompatibilityData; links: CompatibilityLink[] }> {
  const a = await personChart(args.a, 'Person A', localTime);
  const b = await personChart(args.b, 'Person B', localTime);
  const summary = summarizePair(a.bodies, b.bodies, COMPATIBILITY_TOP_CONTACTS);

  const sunA = slugAt(a.sunIndex);
  const sunB = slugAt(b.sunIndex);
  let signPair: CompatibilityData['signPair'] = null;
  if (sunA && sunB) {
    const facts = pairFacts(sunA, sunB);
    signPair = {
      slug: facts.slug,
      signs: [facts.a.slug, facts.b.slug] as [typeof SIGN_SLUGS[number], typeof SIGN_SLUGS[number]],
      same: facts.same,
      element: { ...facts.element },
      modality: { ...facts.modality },
      polarity: facts.polarity,
    };
  }

  const shareA = shareInput(a);
  const shareB = shareInput(b);
  const cardUrl = shareA && shareB
    ? `${origin}${compatibilityHandoffPath(shareB, { kind: 'input', input: shareA })}`
    : null;

  const data: CompatibilityData = {
    a: personRow(a),
    b: personRow(b),
    signPair,
    contacts: summary.top.map((contact) => ({
      aBody: contact.a as CompatibilityData['contacts'][number]['aBody'],
      bBody: contact.b as CompatibilityData['contacts'][number]['bBody'],
      aspect: contact.type,
      orb: roundOrb(contact.orb),
      generational: isGenerationalContact(contact),
      line: synastryLine(a.label, contact.a, b.label, contact.b, contact.type),
    })),
    counts: {
      easeful: summary.easeful,
      charged: summary.charged,
      total: summary.aspects.length,
      byAspect: { ...summary.counts },
    },
    elements: { a: { ...summary.elements.a }, b: { ...summary.elements.b } },
    modalities: { a: { ...summary.modalities.a }, b: { ...summary.modalities.b } },
    pageUrl: sunA && sunB ? `${origin}/compatibility/${pairSlug(sunA, sunB)}/` : null,
    cardUrl,
    notes: notesFor(a, b),
    note: COMPATIBILITY_NOTE,
  };

  return {
    data,
    links: [
      { title: 'Compatibility on Zodiacs', url: `${origin}/compatibility/` },
      { title: 'How we calculate', url: `${origin}/methodology/` },
    ],
  };
}
