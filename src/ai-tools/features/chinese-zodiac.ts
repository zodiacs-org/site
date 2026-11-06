/**
 * get_chinese_zodiac: the animal, element and yin or yang of a Chinese
 * calendar year, from a birth date or a year, with the Lunar New Year
 * boundary handled: a date before that year's Lunar New Year belongs to the
 * previous animal year. The New Year dates are the generated table in
 * src/data/lunar-new-year.json (scripts/build-lunar-new-year.mjs); the
 * animals and their traditional associations are the site's own guide
 * (src/data/chinese-zodiac.ts, /learn/chinese-zodiac/). The pairings are the
 * calendar's traditional ones: the three-animal harmony (三合), the
 * six-harmony partner (六合) and the opposite animal (六冲). Pure: no network,
 * storage or logging.
 *
 * With ZODIACS_SKY_EVENTS_ENABLED=1 (options.skyEvents) the answer also has a
 * share link to its card (src/ai-tools/share-links.ts): the animal alone,
 * never a date or a year, whatever the answer was for. A year asked about
 * could be the person's birth year, and a year's element with its animal
 * would name it in the sixty-year cycle.
 */
import { z } from 'zod';
import lunarNewYear from '../../data/lunar-new-year.json';
import { CHINESE_ZODIAC_ANIMALS, chineseAnimalForCycleYear, type ChineseZodiacAnimal } from '../../data/chinese-zodiac';
import { stemBranchYear } from '../../data/chinese-zodiac-zh';
import { parseCivilDate } from '../../lib/time/civil-date';
import { chineseZodiacShareUrl } from '../share-links';

const DEFAULT_ORIGIN = 'https://zodiacs.org';
const DATES = lunarNewYear.dates as Record<string, string>;
export const CHINESE_FIRST_YEAR = lunarNewYear.from;
/** The table runs a year past the last one offered, so every offered year has an end. */
export const CHINESE_LAST_YEAR = lunarNewYear.to - 1;
export const CHINESE_ZODIAC_NOTE = 'Traditional associations of the Chinese calendar, for reflection: not a personality test or a prediction.';

const ZONE_PATTERN = /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){0,3}$/;

export const chineseZodiacInput = z.strictObject({
  birthDate: z.string().regex(/^(?:19|20|21)\d{2}-\d{2}-\d{2}$/).optional()
    .describe(`The birth date, such as 1990-01-20 (${lunarNewYear.from + 1} to ${lunarNewYear.to - 1}). A date before that year's Lunar New Year belongs to the previous animal. Give this or year.`),
  year: z.number().int().min(lunarNewYear.from + 1).max(lunarNewYear.to - 1).optional()
    .describe('A year, such as 1990, when the person gives only a year. The answer says which animal applies before that year\'s Lunar New Year.'),
  zone: z.string().min(1).max(64).regex(ZONE_PATTERN).optional()
    .describe("The person's time zone, such as Asia/Singapore, so the current year is worked out for their own date. Without it, UTC."),
}).superRefine((args, context) => {
  if (args.birthDate !== undefined && args.year !== undefined) context.addIssue({ code: 'custom', message: 'Give birthDate or year, not both.' });
});
export type ChineseZodiacInput = z.infer<typeof chineseZodiacInput>;

const ELEMENTS = ['wood', 'fire', 'earth', 'metal', 'water'] as const;
type ChineseElement = typeof ELEMENTS[number];
const ANIMAL_SLUGS = CHINESE_ZODIAC_ANIMALS.map((animal) => animal.slug) as [string, ...string[]];

const animalRef = z.object({ slug: z.enum(ANIMAL_SLUGS), name: z.string(), pageUrl: z.url() });
const animalYear = z.object({
  /** The Chinese calendar year: the Gregorian year its Lunar New Year falls in. */
  year: z.number().int(),
  animal: animalRef.extend({ branch: z.string(), branchPinyin: z.string(), position: z.number().int().min(1).max(12) }),
  element: z.enum(ELEMENTS),
  yinYang: z.enum(['yin', 'yang']),
  /** The year's stem and branch, such as 丙午. */
  stemBranch: z.string(),
  /** The year's name in plain words, such as "Fire Horse (yang)". */
  label: z.string(),
  /** The first and last day of the year: its Lunar New Year and the day before the next one. */
  starts: z.string(),
  ends: z.string(),
});

export const chineseZodiacData = z.object({
  /** What the answer was worked out from. */
  from: z.enum(['birth-date', 'year', 'today']),
  birthDate: z.string().nullable(),
  /** The person's animal year: from the birth date, or the year as given. Null with neither. */
  person: animalYear.extend({
    association: z.string(),
    context: z.string(),
    pairings: z.object({
      harmony: z.array(animalRef).length(2),
      partner: animalRef,
      opposite: animalRef,
      text: z.string(),
    }),
  }).nullable(),
  /** How the Lunar New Year boundary applied. */
  boundary: z.object({
    lunarNewYear: z.string(),
    /** For a birth date: whether it falls before that Gregorian year's Lunar New Year. Null for a year. */
    beforeNewYear: z.boolean().nullable(),
    /** For a year alone: the animal of anyone born before its Lunar New Year. */
    earlierAnimal: animalRef.nullable(),
    text: z.string(),
  }).nullable(),
  current: animalYear,
  today: z.string(),
  zone: z.string(),
  /** Set only when the current year was worked out in UTC because no time zone was given or shared. */
  zoneNote: z.string().nullable(),
  guideUrl: z.url(),
  note: z.literal(CHINESE_ZODIAC_NOTE),
});
export type ChineseZodiacData = z.infer<typeof chineseZodiacData>;
/** With ZODIACS_SKY_EVENTS_ENABLED=1: the same answer, and the share link to its card. */
export const chineseZodiacDataWithShare = chineseZodiacData.extend({
  /** The card: the animal alone, with its own element and the yin or yang of its years; never a date or a year. */
  shareUrl: z.url().nullable(),
});
export type ChineseZodiacDataWithShare = z.infer<typeof chineseZodiacDataWithShare>;

export interface ChineseZodiacOptions {
  /** ZODIACS_SKY_EVENTS_ENABLED=1: add shareUrl. */
  skyEvents?: boolean;
}

/** The traditional element of a Chinese year from its Heavenly Stem: two years each, wood first, from 1984 (甲子). */
export function chineseElement(year: number): { element: ChineseElement; yinYang: 'yin' | 'yang' } {
  const stem = ((year - 1984) % 10 + 10) % 10;
  return { element: ELEMENTS[Math.floor(stem / 2)], yinYang: stem % 2 === 0 ? 'yang' : 'yin' };
}

/** The Lunar New Year date (YYYY-MM-DD) of a Gregorian year, from the generated table. */
export function lunarNewYearOf(year: number): string {
  const date = DATES[String(year)];
  if (!date) throw new RangeError(`Lunar New Year dates cover ${CHINESE_FIRST_YEAR} to ${CHINESE_LAST_YEAR}.`);
  return date;
}

/** The Chinese calendar year a Gregorian date falls in: the previous year before its Lunar New Year. */
export function chineseYearOf(date: string): number {
  const year = Number(date.slice(0, 4));
  return date < lunarNewYearOf(year) ? year - 1 : year;
}

const animalAt = (position: number) => CHINESE_ZODIAC_ANIMALS[((position - 1) % 12 + 12) % 12];
const animalPage = (origin: string, slug: string) => `${origin}/learn/chinese-zodiac/${slug}/`;
const ref = (origin: string, animal: ChineseZodiacAnimal) => ({ slug: animal.slug, name: animal.name, pageUrl: animalPage(origin, animal.slug) });
const cap = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const dayBefore = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
const SIX_HARMONY: Record<string, string> = { rat: 'ox', ox: 'rat', tiger: 'pig', pig: 'tiger', rabbit: 'dog', dog: 'rabbit', dragon: 'rooster', rooster: 'dragon', snake: 'monkey', monkey: 'snake', horse: 'goat', goat: 'horse' };

/** "3 February 1990", as the other tools write dates for people. */
export function longDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}

function yearFacts(year: number, origin: string) {
  const animal = chineseAnimalForCycleYear(year);
  const { element, yinYang } = chineseElement(year);
  const starts = lunarNewYearOf(year);
  return {
    year,
    animal: { ...ref(origin, animal), branch: animal.branch, branchPinyin: animal.branchPinyin, position: animal.position },
    element,
    yinYang,
    stemBranch: stemBranchYear(year),
    label: `${cap(element)} ${animal.name} (${yinYang})`,
    starts,
    ends: dayBefore(lunarNewYearOf(year + 1)),
  };
}

function pairings(animal: ChineseZodiacAnimal, origin: string) {
  const harmony = [animalAt(animal.position + 4), animalAt(animal.position + 8)];
  const partner = CHINESE_ZODIAC_ANIMALS.find((entry) => entry.slug === SIX_HARMONY[animal.slug])!;
  const opposite = animalAt(animal.position + 6);
  return {
    harmony: harmony.map((entry) => ref(origin, entry)),
    partner: ref(origin, partner),
    opposite: ref(origin, opposite),
    text: `Tradition groups the ${animal.name} with the ${harmony[0].name} and the ${harmony[1].name} as a harmonious three (三合), pairs it with the ${partner.name} (六合), and sets it opposite the ${opposite.name} (六冲), a pairing read as a clash.`,
  };
}

/** The answer for one call. `today` is the person's own date (YYYY-MM-DD) in `zone`. */
export function getChineseZodiac(args: ChineseZodiacInput, today: string, zone: string, origin = DEFAULT_ORIGIN, zoneAssumed = false, options: ChineseZodiacOptions = {}): { data: ChineseZodiacData | ChineseZodiacDataWithShare; links: { title: string; url: string }[] } {
  const currentYear = chineseYearOf(today);
  let personYear: number | null = null;
  let boundary: ChineseZodiacData['boundary'] = null;
  if (args.birthDate !== undefined) {
    const parsed = parseCivilDate(args.birthDate);
    if (!parsed) throw new RangeError('birthDate must be a real date, such as 1990-01-20.');
    if (parsed.year <= CHINESE_FIRST_YEAR || parsed.year > CHINESE_LAST_YEAR) throw new RangeError(`birthDate must fall from ${CHINESE_FIRST_YEAR + 1} to ${CHINESE_LAST_YEAR}.`);
    const newYear = lunarNewYearOf(parsed.year);
    const before = args.birthDate < newYear;
    personYear = before ? parsed.year - 1 : parsed.year;
    const animal = chineseAnimalForCycleYear(personYear);
    boundary = {
      lunarNewYear: newYear,
      beforeNewYear: before,
      earlierAnimal: null,
      text: before
        ? `Born on ${longDate(args.birthDate)}, before the Lunar New Year of ${longDate(newYear)}, so the year is still the ${animal.name} year that began in ${personYear}.`
        : `Born on ${longDate(args.birthDate)}, on or after the Lunar New Year of ${longDate(newYear)}, so the year is the ${animal.name} year of ${personYear}.`,
    };
  } else if (args.year !== undefined) {
    personYear = args.year;
    const newYear = lunarNewYearOf(args.year);
    const earlier = chineseAnimalForCycleYear(args.year - 1);
    boundary = {
      lunarNewYear: newYear,
      beforeNewYear: null,
      earlierAnimal: ref(origin, earlier),
      text: `The ${chineseAnimalForCycleYear(args.year).name} year of ${args.year} began on ${longDate(newYear)}. Anyone born in ${args.year} before that day belongs to the ${earlier.name} year of ${args.year - 1}; ask for the birth date to be sure.`,
    };
  }
  let person: ChineseZodiacData['person'] = null;
  if (personYear !== null) {
    const animal = chineseAnimalForCycleYear(personYear);
    person = { ...yearFacts(personYear, origin), association: animal.association, context: animal.context, pairings: pairings(animal, origin) };
  }
  const data: ChineseZodiacData = {
    from: args.birthDate !== undefined ? 'birth-date' : args.year !== undefined ? 'year' : 'today',
    birthDate: args.birthDate ?? null,
    person,
    boundary,
    current: yearFacts(currentYear, origin),
    today,
    zone,
    zoneNote: zoneAssumed ? 'The current year assumes UTC because no time zone was given.' : null,
    guideUrl: `${origin}/learn/chinese-zodiac/`,
    note: CHINESE_ZODIAC_NOTE,
  };
  const links = [
    ...(person ? [{ title: `The ${person.animal.name} on Zodiacs`, url: person.animal.pageUrl }] : []),
    ...(person?.animal.slug !== data.current.animal.slug ? [{ title: `The ${data.current.animal.name}, this year's animal`, url: data.current.animal.pageUrl }] : []),
    { title: 'The Chinese zodiac on Zodiacs', url: data.guideUrl },
  ];
  if (!options.skyEvents) return { data, links };
  const shown = data.person ?? data.current;
  return { data: { ...data, shareUrl: chineseZodiacShareUrl(origin, { animal: shown.animal.slug }) }, links };
}
