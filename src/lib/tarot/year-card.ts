/**
 * The tarot year card: one Major Arcana card for a birthday year, by the
 * numerological method tarot readers use for a "year card" (Mary K. Greer's):
 * add the birthday's month and day to the year the birthday falls in, add the
 * digits of the total until it is 22 or less, and read 22 as The Fool (0).
 * Deterministic: no draw, nothing random, so the same birthday year always
 * gives the same card and a share link can name it.
 *
 * The readings are the site's own words in the 9 November 2026 register: the
 * tradition's work, money, wellbeing and relationship themes, no price or
 * trading calls, diagnoses, death predictions or legal outcomes. Death (XIII)
 * reads as change, as tarot reads it. Pure.
 */
export interface TarotCard {
  number: number;
  numeral: string;
  name: string;
  keywords: readonly [string, string, string];
  year: string;
}

export const MAJOR_ARCANA: readonly TarotCard[] = Object.freeze([
  { number: 0, numeral: '0', name: 'The Fool', keywords: ['beginnings', 'trust', 'a leap'], year: 'A year that starts something. Tradition reads the Fool as the step taken before the map is finished: say yes to the new road, and pack light.' },
  { number: 1, numeral: 'I', name: 'The Magician', keywords: ['skill', 'focus', 'making'], year: 'A year to use what you already have. The Magician has every tool on the table; tradition reads it as a strong year for craft, pitches and work that shows.' },
  { number: 2, numeral: 'II', name: 'The High Priestess', keywords: ['intuition', 'study', 'quiet'], year: 'A year that rewards listening before acting. Tradition reads the High Priestess as study, private knowledge and trusting what you notice.' },
  { number: 3, numeral: 'III', name: 'The Empress', keywords: ['growth', 'comfort', 'abundance'], year: 'A year of growth and good living. Tradition reads the Empress as plenty: creative work flowers, home feels good, and money tends to follow care.' },
  { number: 4, numeral: 'IV', name: 'The Emperor', keywords: ['structure', 'authority', 'plans'], year: 'A year to build structure. Tradition reads the Emperor as leadership and order: set the plan, take charge of it, and put your name to it.' },
  { number: 5, numeral: 'V', name: 'The Hierophant', keywords: ['learning', 'tradition', 'mentors'], year: 'A year for learning from those who came before. Tradition reads the Hierophant as teachers, institutions and agreements made in good faith: a good window to sign on with something established.' },
  { number: 6, numeral: 'VI', name: 'The Lovers', keywords: ['choice', 'partnership', 'values'], year: 'A year of choices that say who you are. Tradition reads the Lovers as partnership and alignment: in love, in work and in what you will and will not do.' },
  { number: 7, numeral: 'VII', name: 'The Chariot', keywords: ['drive', 'direction', 'progress'], year: 'A year of momentum. Tradition reads the Chariot as will put to a single direction: travel, a push at work, and progress you can measure.' },
  { number: 8, numeral: 'VIII', name: 'Strength', keywords: ['courage', 'patience', 'steadiness'], year: 'A year of quiet strength. Tradition reads Strength as patience that wins: steady effort, a gentler hand, and energy looked after rather than spent.' },
  { number: 9, numeral: 'IX', name: 'The Hermit', keywords: ['reflection', 'expertise', 'solitude'], year: 'A year to go inward and get good at something. Tradition reads the Hermit as study, retreat and the kind of mastery that needs fewer meetings.' },
  { number: 10, numeral: 'X', name: 'Wheel of Fortune', keywords: ['turning points', 'timing', 'luck'], year: 'A year when the wheel turns. Tradition reads it as change of fortune and timing: openings arrive, and readiness decides what you make of them.' },
  { number: 11, numeral: 'XI', name: 'Justice', keywords: ['fairness', 'balance', 'decisions'], year: 'A year of fair accounts. Tradition reads Justice as clear decisions, contracts and consequences: a good year to settle what is unsettled and get agreements in writing.' },
  { number: 12, numeral: 'XII', name: 'The Hanged Man', keywords: ['pause', 'perspective', 'surrender'], year: 'A year that asks for a pause. Tradition reads the Hanged Man as a new point of view, found by waiting rather than pushing; take rest seriously.' },
  { number: 13, numeral: 'XIII', name: 'Death', keywords: ['change', 'endings', 'renewal'], year: 'A year of real change. In tarot this card means an ending that clears the ground: one chapter closes so the next can open. It is not read literally.' },
  { number: 14, numeral: 'XIV', name: 'Temperance', keywords: ['balance', 'moderation', 'healing'], year: 'A year of finding the middle. Tradition reads Temperance as balance and blending: steady routines, measured spending and time to recover.' },
  { number: 15, numeral: 'XV', name: 'The Devil', keywords: ['ties', 'desire', 'freedom'], year: 'A year to look at what holds you. Tradition reads the Devil as habits and bargains that bind: name them, and the chain loosens.' },
  { number: 16, numeral: 'XVI', name: 'The Tower', keywords: ['shake-up', 'truth', 'rebuilding'], year: 'A year of sudden clarity. Tradition reads the Tower as a shake-up that shows what was not sound; what you rebuild after it stands better.' },
  { number: 17, numeral: 'XVII', name: 'The Star', keywords: ['hope', 'renewal', 'inspiration'], year: 'A year of renewed hope. Tradition reads the Star as healing and inspiration after a hard stretch: a good year to share your work and trust where it leads.' },
  { number: 18, numeral: 'XVIII', name: 'The Moon', keywords: ['dreams', 'uncertainty', 'intuition'], year: 'A year of half light. Tradition reads the Moon as imagination and uncertainty: creative work thrives, and big decisions want a second look in daylight.' },
  { number: 19, numeral: 'XIX', name: 'The Sun', keywords: ['joy', 'success', 'vitality'], year: 'A bright year. Tradition reads the Sun as success, warmth and energy: recognition comes more easily, and so does enjoying it.' },
  { number: 20, numeral: 'XX', name: 'Judgement', keywords: ['calling', 'review', 'awakening'], year: 'A year of a clear call. Tradition reads Judgement as looking back honestly and answering what you are meant to do next.' },
  { number: 21, numeral: 'XXI', name: 'The World', keywords: ['completion', 'arrival', 'wholeness'], year: 'A year of completion. Tradition reads the World as a cycle finished well: arrivals, recognition, and the freedom to choose the next journey.' },
]);

/** A card's name with its first keyword, so no card stands as a bare name: "Death: change". */
export const cardTitle = (card: TarotCard): string => card.name + ': ' + card.keywords[0];

const digitSum = (n: number) => String(n).split('').reduce((sum, digit) => sum + Number(digit), 0);

/** The year card for a birthday's month and day in a given year: month + day + year, reduced to 22 or less, 22 read as 0. */
export function tarotYearCard(month: number, day: number, year: number): TarotCard {
  let total = month + day + year;
  while (total > 22) total = digitSum(total);
  return MAJOR_ARCANA[total === 22 ? 0 : total];
}
