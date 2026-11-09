/**
 * get_numerology: Pythagorean numerology from a name and a birth date, with the site's own engine
 * (src/lib/numerology, the rules the /numerology/ calculator applies) and the site's own pre-written meanings
 * (src/data/numerology-meanings.ts and numerology-readings.ts). Numerology is a separate tradition from astrology:
 * nothing here reads the sky, and every answer says so.
 *
 * Deterministic arithmetic plus fixed copy; no model is called. The name and the birth date are used for this one
 * answer only: neither is echoed in the result, put in a link, stored or logged. The hosted server refuses a birth
 * date less than 13 years ago before this runs (childBirthDateRefusal in ../tools.ts).
 */
import { z } from 'zod';
import { NumerologyInputError } from '../../lib/numerology';
import { NUMEROLOGY_SEPARATE, numerologyReading } from '../../lib/numerology/reading';

export { NUMEROLOGY_SEPARATE };

const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;
export const NUMEROLOGY_MIN_YEAR = 1800;
export const NUMEROLOGY_MAX_YEAR = 2199;

export const numerologyInput = z.strictObject({
  birthDate: z.string().regex(/^(?:18|19|20|21)\d{2}-\d{2}-\d{2}$/)
    .describe('The birth date, such as 1990-05-03. Gives the Life Path and the Personal Year.'),
  name: z.string().min(1).max(120).optional()
    .describe('Optional: the full name at birth, such as it appears on a birth certificate, for the Expression, Soul Urge and Personality numbers. Only if the person gives it for this reading. Latin letters; accents are folded. Used for this answer only: it is not returned, put in a link or stored.'),
  year: z.number().int().min(NUMEROLOGY_MIN_YEAR).max(NUMEROLOGY_MAX_YEAR).optional()
    .describe('Optional: the calendar year for the Personal Year, such as 2027. Without it, the current year where the person is.'),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional()
    .describe("Optional: the person's time zone, such as Europe/Paris, so the current year is their own. Without it, the assistant's time zone or UTC."),
});
export type NumerologyInput = z.infer<typeof numerologyInput>;

const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33] as const;
const numberReading = z.object({
  /** 1 to 9, or a master number 11, 22 or 33 kept unreduced. 0 only for a name with no letters of that kind (no vowels). */
  number: z.literal(NUMBER_VALUES),
  /** The reduction in slash notation, such as 16/7 or 29/11; the number alone when no reduction was needed. */
  chain: z.string(),
  master: z.boolean(),
  /** The number's short name, such as The builder. */
  title: z.string(),
  keywords: z.array(z.string()),
  /** What the tradition associates with the number in any position. */
  meaning: z.string(),
  /** What it reads as in this position. */
  reading: z.string(),
});
const POSITION_NAMES = ['lifePath', 'birthday', 'expression', 'soulUrge', 'personality'] as const;

export const numerologyData = z.object({
  system: z.literal('pythagorean'),
  /** Numerology is not astrology; say so when sharing the answer. */
  separateFromAstrology: z.string(),
  /** From the birth date: month, day and year each reduced, then added and reduced, masters kept. */
  lifePath: numberReading,
  /** From every letter of the name; null when no name was given. */
  expression: numberReading.nullable(),
  /** From the vowels of the name; null when no name was given. */
  soulUrge: numberReading.nullable(),
  /** From the consonants of the name; null when no name was given. */
  personality: numberReading.nullable(),
  personalYear: z.object({
    year: z.number().int(),
    /** Always reduced to one digit, as the site's calculator does; the chain shows an 11 or 22 on the way. */
    number: z.number().int().min(1).max(9),
    chain: z.string(),
    /** Whether the year was the one asked for, or the current year where the person is (or UTC). */
    yearFrom: z.enum(['request', 'zone', 'assistant', 'utc']),
    reading: z.string(),
  }),
  /** A 13, 14, 16 or 19 in the reduction of the Life Path, Birthday, Expression, Soul Urge or Personality. */
  karmicDebts: z.array(z.object({ number: z.literal([13, 14, 16, 19]), carriedBy: z.array(z.enum(POSITION_NAMES)), reading: z.string() })),
  method: z.string(),
  note: z.string(),
});
export type NumerologyData = z.infer<typeof numerologyData>;

export const NUMEROLOGY_METHOD = 'Pythagorean letter values (A to I are 1 to 9, J to R are 1 to 9, S to Z are 1 to 8). The birth month, day and year are each reduced, then added and reduced again; each part of the name is reduced on its own before the parts are added. 11, 22 and 33 are kept as master numbers in the core numbers. Y is a vowel unless it follows A, E, I, O or U, or opens a name before one. The Personal Year adds the birth month and day to the calendar year and reduces to one digit. The same rules as the calculator at zodiacs.org/numerology/.';
export const NUMEROLOGY_NOTE = 'The arithmetic is exact and repeatable. The meanings are the ones the numerology tradition gives each number, in Zodiacs\' own words.';
/** Fixed refusals: the engine's own message can name the letter it could not read, which is part of the name. */
const REFUSALS: Record<NumerologyInputError['code'], string> = {
  'invalid-date': 'birthDate must be a real calendar date, such as 1990-05-03.',
  'empty-name': 'name must contain at least one letter. Leave it out for the birth date numbers alone.',
  'unsupported-letters': 'name can be read only in the Latin alphabet, A to Z (accents are fine). Leave it out for the birth date numbers alone, or give the name as it is written in Latin letters.',
};

export interface NumerologyContext {
  /** The current year where the person is, and where that came from, used when the call names no year. */
  currentYear: number;
  currentYearFrom: 'zone' | 'assistant' | 'utc';
  origin: string;
}

/** The tool's answer: the shared reading (src/lib/numerology/reading.ts) with where its year came from, the method and links. Throws RangeError with a fixed, field-named sentence for details the engine cannot read. */
export function getNumerology(args: NumerologyInput, context: NumerologyContext): { data: NumerologyData; links: { title: string; url: string }[] } {
  let reading: ReturnType<typeof numerologyReading>;
  try {
    reading = numerologyReading({ birthDate: args.birthDate, ...(args.name !== undefined ? { name: args.name } : {}), year: args.year ?? context.currentYear });
  } catch (error) {
    if (error instanceof NumerologyInputError) throw new RangeError(REFUSALS[error.code]);
    throw error;
  }
  const data: NumerologyData = {
    ...reading,
    personalYear: { ...reading.personalYear, yearFrom: args.year !== undefined ? 'request' : context.currentYearFrom },
    method: NUMEROLOGY_METHOD,
    note: NUMEROLOGY_NOTE,
  };
  // Links carry the Life Path number at most, never the name or any part of the date.
  const links = [
    { title: 'Numerology calculator on Zodiacs', url: `${context.origin}/numerology/` },
    ...(data.lifePath.number === 0 ? [] : [{ title: `Life Path ${data.lifePath.number}`, url: `${context.origin}/numerology/life-path/${data.lifePath.number}/` }]),
  ];
  return { data, links };
}
