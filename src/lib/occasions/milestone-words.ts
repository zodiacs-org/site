/**
 * What each life milestone is called and what astrologers make of it. Plain
 * words only, so the assistant panel can show them without the engine.
 */
import type { MilestoneKind } from './milestones';

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
