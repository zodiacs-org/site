/**
 * The words on an occasion card: its title, a closing line for the
 * occasion, and one interpretation sentence from the day's Sun and Moon
 * signs. Astrology offered as interpretation, never a promise: no line says
 * how a marriage, a child or a year will go, and none ranks a date.
 */
import type { OccasionKind } from './kinds';

/** What each sign stands for on an occasion card, as a noun phrase after "the sign of". */
export const SIGN_THEME: Readonly<Record<string, string>> = {
  aries: 'beginnings',
  taurus: 'what lasts',
  gemini: 'conversation',
  cancer: 'home and family',
  leo: 'warmth and celebration',
  virgo: 'care in the details',
  libra: 'partnership',
  scorpio: 'depth and devotion',
  sagittarius: 'open horizons',
  capricorn: 'commitments built to last',
  aquarius: 'friendship and freedom',
  pisces: 'imagination and tenderness',
};

export interface OccasionWords {
  /** The card's heading. */
  title: string;
  /** One closing line under the interpretation. */
  closing: string;
}

export const OCCASION_WORDS: Readonly<Record<OccasionKind, OccasionWords>> = {
  wedding: { title: 'The sky on your wedding day', closing: 'The sky you say your vows under.' },
  anniversary: { title: 'The sky on the day you married', closing: 'The Sun comes back to this place in the sky every anniversary.' },
  met: { title: 'The sky the night you met', closing: 'The sky the night it started.' },
  birthday: { title: 'Your birthday sky', closing: 'The sky of this birthday, worked out for the day.' },
  baby: { title: 'The sky the day you arrived', closing: 'The sky on the day you were born.' },
  pet: { title: 'The sky on their day', closing: 'The sky the day they joined the family.' },
  home: { title: 'The sky the day you got the keys', closing: 'The sky over the first night in a new home.' },
  job: { title: 'The sky on your first day', closing: 'The sky over a first day at work.' },
  graduation: { title: 'The sky on graduation day', closing: 'The sky the day the work was done.' },
  retirement: { title: 'The sky on your first free day', closing: 'The sky over the first day of the next part.' },
  'coming-of-age': { title: 'The sky on the day you came of age', closing: 'The sky the year you became an adult.' },
  gathering: { title: 'Tonight’s sky', closing: 'The sky to look up at together.' },
};

function signName(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** "A Gemini Sun is the sign of conversation; a Libra Moon, of partnership." */
export function sunMoonLine(sunSign: string, moonSign: string): string {
  const sun = SIGN_THEME[sunSign];
  const moon = SIGN_THEME[moonSign];
  if (!sun || !moon) throw new RangeError(`Unknown sign: ${sun ? moonSign : sunSign}`);
  if (sunSign === moonSign) {
    return `The Sun and Moon are both in ${signName(sunSign)}, the sign of ${sun}.`;
  }
  return `A ${signName(sunSign)} Sun is the sign of ${sun}; a ${signName(moonSign)} Moon, of ${moon}.`;
}
