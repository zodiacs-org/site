/**
 * The public figures the Year Ahead Score can be read for by name
 * (src/data/year-people.json). Adults only, each with a cited public birth
 * date; a birth time only where a published record gives one, otherwise the
 * chart is cast for noon on the birthplace clock and the Moon is left out.
 * Pure: parsing and lookup, no network or logging.
 */
import { z } from 'zod';
import raw from '../../data/year-people.json';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u);
const source = z.object({ title: z.string().min(1), url: z.url() });
export const YEAR_PERSON_CATEGORIES = ['founder', 'ceo', 'investor', 'athlete', 'entertainer', 'creator', 'author', 'public-figure'] as const;
const person = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(YEAR_PERSON_CATEGORIES),
  birthDate: day,
  /** HH:MM on the birthplace clock, only from a published record; null means unknown. */
  birthTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u).nullable(),
  zone: z.string().min(1),
  birthplace: z.string().min(1),
  sources: z.array(source).min(1),
  alternateBirthDates: z.array(z.object({ date: day, sources: z.array(source).min(1) })),
  note: z.string().min(1).nullable(),
});
export type YearPerson = z.infer<typeof person>;
const file = z.object({ schema: z.literal('zodiacs.year-people.v1'), reviewedAt: day, policy: z.string(), people: z.array(person) });

const parsed = file.parse(raw);
export const YEAR_PEOPLE_REVIEWED_AT = parsed.reviewedAt;
export const YEAR_PEOPLE: readonly YearPerson[] = parsed.people;

/** Lower case, accents and punctuation removed: "Changpeng Zhao", "changpeng-zhao" and "CZ" style keys compare alike. */
export function personKey(text: string): string {
  return text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').trim();
}

const BY_KEY = new Map<string, YearPerson>();
for (const entry of YEAR_PEOPLE) {
  BY_KEY.set(personKey(entry.slug), entry);
  BY_KEY.set(personKey(entry.name), entry);
}

/** A directory figure by slug or full name, or undefined. */
export function findYearPerson(query: string): YearPerson | undefined {
  return BY_KEY.get(personKey(query));
}

export const yearPersonPath = (slug: string) => `/year/${slug}/`;
