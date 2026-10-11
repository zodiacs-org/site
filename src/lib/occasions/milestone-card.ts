/**
 * A life-milestones card from a birth date (and, if known, time and zone):
 * the Jupiter returns, Saturn returns and Uranus opposition with every pass,
 * the next one coming, and the sky numbers lived through. Runs in the browser
 * behind the lazy engine import and in the MCP runtime alike.
 */
import { prepareLocalTime, resolveLocalToUtc } from '../time/localToUtc';
import { validOccasionDate } from './card';
import { lifeMilestones, type LifeMilestones, type MilestoneKind } from './milestones';

const DAY = 86_400_000;

export const MILESTONE_WORDS: Readonly<Record<MilestoneKind, { name: string; about: string }>> = {
  'jupiter-return': {
    name: 'Jupiter return',
    about: 'Jupiter is back where it was when you were born, about every twelve years. Astrologers read it as the start of a new twelve-year round.',
  },
  'saturn-return': {
    name: 'Saturn return',
    about: 'Saturn is back where it was at your birth, at about 29, 58 and 88. The oldest milestone in astrology: a time to take stock and build what lasts.',
  },
  'uranus-opposition': {
    name: 'Uranus opposition',
    about: 'Uranus stands opposite its place at your birth, around 40 to 42. Astrologers connect it with the midlife wish to do something differently.',
  },
};

export interface MilestoneInput {
  birthDate: string;
  time: string | null;
  timeZone: string | null;
  /** The birthplace, when known; its longitude settles the offset before standard time. */
  birthplace: { lon: number } | null;
}

export interface MilestoneCard extends LifeMilestones {
  timeKnown: boolean;
}

export async function milestoneCard(input: MilestoneInput, asOf = new Date()): Promise<MilestoneCard> {
  if (!validOccasionDate(input.birthDate)) throw new RangeError('The birth date must be a real date from 1800 to 2199.');
  if (input.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/u.test(input.time)) throw new RangeError('The time must be HH:MM.');
  if (input.time !== null && !input.timeZone) throw new RangeError('A birth time needs the birthplace.');
  let birth: Date;
  if (input.time !== null && input.timeZone) {
    await prepareLocalTime(input.birthDate, input.timeZone);
    birth = (input.birthplace
      ? resolveLocalToUtc(input.birthDate, input.time, input.timeZone, { longitude: input.birthplace.lon })
      : resolveLocalToUtc(input.birthDate, input.time, input.timeZone)).utc;
  } else {
    // Without a time, noon UTC on the birth date. The slow planets move so
    // little in half a day that a pass usually shifts by a day or less (more
    // only near a station); the card says so and shows dates, not times.
    const [year, month, day] = input.birthDate.split('-').map(Number);
    birth = new Date(Date.UTC(year, month - 1, day) + DAY / 2);
  }
  if (birth.getTime() > asOf.getTime()) throw new RangeError('The birth date is in the future.');
  return { ...lifeMilestones(birth, asOf), timeKnown: input.time !== null };
}
