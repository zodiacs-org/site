import type { PersonRecord } from '../people';
import { groupReading, type GroupReading } from './group';
import { matchTwins, type TwinMatch, type TwinPerson } from './twins';

/**
 * Build-time sample results for the sharing tools, drawn only from the sourced
 * people directory. Birth times there are unknown, so every sample uses the
 * same settled-sign rule as a visitor who marks their time unknown: no Moon,
 * rising, or houses, and nothing close to a sign boundary.
 */
type Sourced = Pick<PersonRecord, 'slug' | 'displayName' | 'placements'>;

function referenceChart(person: Sourced) {
  return {
    bodies: person.placements.map((placement) => ({ body: placement.body, lon: placement.longitude })),
    angles: undefined,
    input: { timeKnown: false },
  } as unknown as Parameters<typeof groupReading>[0];
}

export const SAMPLE_GROUP_SLUGS = ['mark-twain', 'ella-fitzgerald', 'virginia-woolf', 'marie-curie'] as const;

export interface SampleGroupRow { slug: string; name: string; reading: GroupReading }
export function sampleGroup(people: readonly Sourced[]): SampleGroupRow[] {
  return SAMPLE_GROUP_SLUGS.flatMap((slug) => {
    const person = people.find((entry) => entry.slug === slug);
    return person ? [{ slug, name: person.displayName, reading: groupReading(referenceChart(person)) }] : [];
  });
}

/** Mark Twain's verified Sun and Moon pair, used as the sample visitor. */
export const SAMPLE_TWIN_SIGNS = { sun: 'sagittarius', moon: 'aries' } as const;
export function sampleTwins(directory: readonly TwinPerson[]): { both: TwinMatch[]; partial: number } {
  const matches = matchTwins(SAMPLE_TWIN_SIGNS, directory);
  return { both: matches.filter((match) => match.count === 2), partial: matches.filter((match) => match.count === 1).length };
}

const SLOW_SAFE = ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'] as const;
const MAJOR = [
  { type: 'conjunction', angle: 0 }, { type: 'sextile', angle: 60 }, { type: 'square', angle: 90 },
  { type: 'trine', angle: 120 }, { type: 'opposition', angle: 180 },
] as const;
export interface SampleContact { a: string; b: string; type: string; orb: number }

/**
 * Cross-chart contacts between two directory charts, using only bodies whose
 * sign holds across the birth day, within 3°. The Moon is left out because an
 * unknown birth time moves it by up to about 15°.
 */
export function sampleContacts(left: Sourced, right: Sourced, limit = 3): SampleContact[] {
  const pick = (person: Sourced) => person.placements.filter((placement) => (SLOW_SAFE as readonly string[]).includes(placement.body) && placement.stableAcrossDay);
  const contacts: SampleContact[] = [];
  const personal = new Set(['Sun', 'Mercury', 'Venus', 'Mars']);
  for (const a of pick(left)) {
    for (const b of pick(right)) {
      // Jupiter–Saturn pairs between near-contemporaries are generational, not personal.
      if (!personal.has(a.body) && !personal.has(b.body)) continue;
      const raw = Math.abs(a.longitude - b.longitude) % 360;
      const separation = raw > 180 ? 360 - raw : raw;
      for (const aspect of MAJOR) {
        const orb = Math.abs(separation - aspect.angle);
        if (orb <= 3) contacts.push({ a: a.body, b: b.body, type: aspect.type, orb: Math.round(orb * 10) / 10 });
      }
    }
  }
  return contacts.sort((x, y) => x.orb - y.orb || x.a.localeCompare(y.a) || x.b.localeCompare(y.b)).slice(0, limit);
}

export const SAMPLE_PAIR_SLUGS = ['marie-curie', 'albert-einstein'] as const;
