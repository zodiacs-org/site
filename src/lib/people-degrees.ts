/**
 * The People pages print each placement's degree to 0.1°, rounded once from
 * the full value in src/data/people-degrees.json (scripts/build-people-degrees.mjs).
 * The released copy in people.json is frozen and carries degrees that were
 * rounded twice (stored to 0.01°, then printed to 0.1°), so a body at
 * 28.245° Leo reads 28.3°. correctedPeopleText rewrites only those figures,
 * and only where the sign name sits next to the figure, at render time; the
 * frozen data stays byte for byte as released.
 */
import degreesData from '../data/people-degrees.json';
import type { PersonRecord } from './people';

const DEGREES = degreesData.people as Record<string, Record<string, number>>;

/** The full degree in sign of one body in one record, or null. */
export function fullDegree(slug: string, body: string): number | null {
  return DEGREES[slug]?.[body] ?? null;
}

/** A degree in sign to one decimal, rounded once. */
export function tenths(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

interface Fix { sign: string; from: string; to: string }

function fixesFor(person: Pick<PersonRecord, 'slug' | 'placements'>): Fix[] {
  const all = person.placements.flatMap((placement) => {
    const full = fullDegree(person.slug, placement.body);
    if (full === null) return [];
    return [{ sign: placement.signName, from: placement.degree.toFixed(1), to: tenths(full) }];
  });
  // Two bodies in one sign printed alike but rounding apart cannot be told
  // apart in prose; leave such a figure as written.
  return all.filter((fix) => fix.from !== fix.to && !all.some((other) => (
    other !== fix && other.sign === fix.sign && other.from === fix.from && other.to !== fix.to
  )));
}

/**
 * The copy's text with each double-rounded placement degree printed from the
 * full value. Matches the phrasings the copy composer writes: "28.3° Leo",
 * "Leo (28.3°)", "Leo at 28.3°", "28.3° into Leo", "28.3° of Leo" and
 * "Leo, but precisely: 28.3°". In the Moon block, "it stands at 20.0°" is
 * the Moon's own figure.
 */
export function correctedPeopleText(
  person: Pick<PersonRecord, 'slug' | 'placements'>,
  text: string,
  blockKey?: string,
): string {
  let result = text;
  for (const fix of fixesFor(person)) {
    const d = escape(fix.from);
    const s = escape(fix.sign);
    result = result
      .replace(new RegExp(`(?<![\\d.])${d}° ${s}\\b`, 'gu'), `${fix.to}° ${fix.sign}`)
      .replace(new RegExp(`\\b${s} \\(${d}°\\)`, 'gu'), `${fix.sign} (${fix.to}°)`)
      .replace(new RegExp(`\\b${s} at ${d}°`, 'gu'), `${fix.sign} at ${fix.to}°`)
      .replace(new RegExp(`(?<![\\d.])${d}° (into|of) ${s}\\b`, 'gu'), `${fix.to}° $1 ${fix.sign}`)
      .replace(new RegExp(`\\b${s}, but precisely: ${d}°`, 'gu'), `${fix.sign}, but precisely: ${fix.to}°`);
  }
  if (blockKey === 'moon') {
    const moon = person.placements.find((placement) => placement.body === 'Moon');
    const full = fullDegree(person.slug, 'Moon');
    if (moon && full !== null) {
      result = result.replace(`it stands at ${moon.degree.toFixed(1)}°.`, `it stands at ${tenths(full)}°.`);
    }
  }
  return result;
}

/** The Sun's degree in sign to one decimal, rounded once. */
export function sunTenths(person: Pick<PersonRecord, 'slug' | 'sunSign'>): string {
  const full = fullDegree(person.slug, 'Sun');
  return full === null ? person.sunSign.degree.toFixed(1) : tenths(full);
}

/** Whether the page prints any degree differently than the frozen copy wrote it. */
export function peopleDegreesChanged(person: PersonRecord): boolean {
  if (sunTenths(person) !== person.sunSign.degree.toFixed(1)) return true;
  if (correctedPeopleText(person, person.copy.metaDescription) !== person.copy.metaDescription) return true;
  if (correctedPeopleText(person, person.copy.lede) !== person.copy.lede) return true;
  return person.copy.blocks.some((block) => correctedPeopleText(person, block.text, block.key) !== block.text);
}

export const PEOPLE_DEGREES_MODIFIED_AT = '2026-11-07T00:00:00.000Z';
