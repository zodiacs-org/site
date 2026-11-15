/**
 * Shared numerology copy: the twelve core numbers, the positions a chart
 * reads them in, the nine personal years, and the four karmic debts.
 *
 * Pythagorean system. The arithmetic lives in src/lib/numerology; this file
 * is prose only, in the site's consumer register. Every sentence describes
 * what the tradition associates with a number; none of it is a measurement.
 */

export type CoreNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 11 | 22 | 33;
export type SingleDigit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type KarmicDebt = 13 | 14 | 16 | 19;

export const CORE_NUMBERS: readonly CoreNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];
export const MASTER_NUMBERS: readonly CoreNumber[] = [11, 22, 33];

export interface NumberMeaning {
  number: CoreNumber;
  /** Short epithet used in headings and cards, e.g. "The initiator". */
  name: string;
  /** Four plain nouns, used as a keyword line. */
  keywords: readonly [string, string, string, string];
  /** Role-agnostic reading, two or three sentences. */
  summary: string;
  strengths: string;
  growth: string;
}

export const NUMBER_MEANINGS: Readonly<Record<CoreNumber, NumberMeaning>> = Object.freeze({
  1: {
    number: 1,
    name: 'The initiator',
    keywords: ['independence', 'initiative', 'drive', 'self-reliance'],
    summary:
      'The tradition reads 1 as the number of beginnings: the person who starts, decides, and would rather lead a small thing than follow a large one. Independence is the default setting, and so is impatience with committees.',
    strengths: 'Decisive, original, willing to go first, and honest about wanting to win.',
    growth: "Learning that other people's pace is not an obstacle, and that asking for help is not a loss.",
  },
  2: {
    number: 2,
    name: 'The partner',
    keywords: ['cooperation', 'diplomacy', 'sensitivity', 'patience'],
    summary:
      '2 is the number of the pair: listening, mediating, and keeping the peace without making a show of it. People with a strong 2 notice what a room needs before it is said, and would rather be right together than right alone.',
    strengths: 'Tactful, loyal, observant, and good at the quiet work that makes a partnership hold.',
    growth: 'Saying the difficult thing out loud, and not mistaking being agreeable for being kind.',
  },
  3: {
    number: 3,
    name: 'The communicator',
    keywords: ['expression', 'sociability', 'optimism', 'creativity'],
    summary:
      '3 is the number of expression: words, performance, and the pleasure of an audience. It is quick, warm, and easily bored, and it turns almost anything into a story worth telling twice.',
    strengths: "Charming, inventive, encouraging, and able to lift a room's mood on purpose.",
    growth: 'Finishing what was started with such enthusiasm, and letting silence do some of the talking.',
  },
  4: {
    number: 4,
    name: 'The builder',
    keywords: ['structure', 'reliability', 'work', 'patience'],
    summary:
      '4 is the number of foundations: systems, schedules, and the satisfaction of a job done right the first time. It trusts method over inspiration and would rather be dependable than dazzling.',
    strengths: 'Steady, practical, thorough, and the person everyone quietly relies on.',
    growth: 'Tolerating a plan that changes, and remembering that rules exist to serve the work, not the other way round.',
  },
  5: {
    number: 5,
    name: 'The traveller',
    keywords: ['freedom', 'change', 'curiosity', 'adaptability'],
    summary:
      '5 is the number of motion: new places, new people, and a low tolerance for anything that feels like a fence. It learns by doing, adapts fast, and finds routine harder than risk.',
    strengths: 'Versatile, quick, persuasive, and genuinely interested in how other people live.',
    growth: 'Staying long enough for something to deepen, and telling the difference between freedom and avoidance.',
  },
  6: {
    number: 6,
    name: 'The caretaker',
    keywords: ['responsibility', 'care', 'home', 'harmony'],
    summary:
      '6 is the number of responsibility: family, home, and the people who count on you. It takes on more than its share, holds high standards for itself and others, and measures a good life by who was looked after.',
    strengths: 'Warm, protective, fair-minded, and reliable in a crisis.',
    growth: 'Letting people carry their own weight, and noticing when helpfulness has turned into control.',
  },
  7: {
    number: 7,
    name: 'The analyst',
    keywords: ['analysis', 'solitude', 'depth', 'scepticism'],
    summary:
      '7 is the number of the inward turn: study, privacy, and the need to understand a thing before trusting it. It prefers a few deep conversations to many shallow ones and is happiest with time alone that nobody has to explain.',
    strengths: 'Perceptive, thorough, self-contained, and hard to fool.',
    growth: 'Letting people in before every question is answered, and accepting that some things are felt rather than proven.',
  },
  8: {
    number: 8,
    name: 'The executive',
    keywords: ['ambition', 'authority', 'organisation', 'results'],
    summary:
      '8 is the number of results: ambition, management, and taking responsibility for outcomes. It reads power clearly, works in long arcs, and expects effort to be measured by what it produced.',
    strengths: 'Capable, confident, strategic, and willing to make the unpopular decision.',
    growth: 'Valuing people for more than their usefulness, and resting before the body insists on it.',
  },
  9: {
    number: 9,
    name: 'The humanitarian',
    keywords: ['compassion', 'breadth', 'idealism', 'completion'],
    summary:
      "9 is the number of the wide view: causes larger than one life, generosity, and the ability to let things end. It feels other people's situations vividly and is drawn to work that improves more than its own corner.",
    strengths: 'Generous, wise, tolerant, and able to see the whole before the parts.',
    growth: 'Keeping something for itself, and forgiving the particular people in front of it as readily as humanity in general.',
  },
  11: {
    number: 11,
    name: 'The intuitive',
    keywords: ['intuition', 'sensitivity', 'inspiration', 'nerves'],
    summary:
      "11 is the first master number: a 2 with the volume turned up. It carries the 2's sensitivity and diplomacy plus a restless, intuitive streak that forms a view before the evidence is in. The tradition writes it 11/2 because on ordinary days it lives as a 2.",
    strengths: "Perceptive, inspiring, idealistic, and quick to read a room's undercurrent.",
    growth: 'Grounding the nerves that come with all that reception, and choosing one vision to act on instead of feeling all of them.',
  },
  22: {
    number: 22,
    name: 'The master builder',
    keywords: ['vision', 'scale', 'discipline', 'practicality'],
    summary:
      "22 is the second master number: a 4 with an architect's ambition. It joins the 4's method to plans that outlast a single lifetime, and it is at its best building something concrete that many people will use. Written 22/4, it rests as a 4.",
    strengths: 'Disciplined, far-sighted, capable, and unusually good at turning ideas into structures.',
    growth: 'Trusting the scale of its own plans, and accepting that most of them take a team.',
  },
  33: {
    number: 33,
    name: 'The teacher',
    keywords: ['service', 'guidance', 'compassion', 'devotion'],
    summary:
      "33 is the rarest master number: a 6 with a teacher's calling. It combines the 6's sense of responsibility with the 9's breadth, and the tradition associates it with lives spent in service, care, and instruction. Written 33/6, it lives day to day as a 6.",
    strengths: 'Nurturing, wise, self-sacrificing, and trusted by people who trust few.',
    growth: 'Keeping the sacrifice proportionate, and letting others give something back.',
  },
});

export type PositionKey =
  | 'lifePath'
  | 'birthday'
  | 'expression'
  | 'soulUrge'
  | 'personality'
  | 'maturity'
  | 'attitude'
  | 'personalYear';

export interface PositionMeaning {
  key: PositionKey;
  label: string;
  /** What the number is computed from, as a phrase: "your birth date". */
  source: string;
  description: string;
}

export const POSITIONS: readonly PositionMeaning[] = Object.freeze([
  {
    key: 'lifePath',
    label: 'Life Path',
    source: 'your birth date',
    description:
      "The most-quoted number in a chart: the birth date's month, day, and year each reduced, then added and reduced again. The tradition reads it as the road you are walking and the lessons on it.",
  },
  {
    key: 'birthday',
    label: 'Birthday',
    source: 'the day of the month you were born',
    description: 'The day number on its own, reduced. A secondary talent the tradition says you arrived with.',
  },
  {
    key: 'expression',
    label: 'Expression',
    source: 'every letter of your full name at birth',
    description:
      'Also called the Destiny number. Every letter of the name, each part reduced on its own before the parts are added, read as the abilities you have to work with and the direction you tend to grow into.',
  },
  {
    key: 'soulUrge',
    label: 'Soul Urge',
    source: 'the vowels of your name',
    description: "Also called the Heart's Desire. The vowels alone, read as what you privately want.",
  },
  {
    key: 'personality',
    label: 'Personality',
    source: 'the consonants of your name',
    description: 'The consonants alone, read as the surface you show first, before people know you.',
  },
  {
    key: 'maturity',
    label: 'Maturity',
    source: 'Life Path plus Expression',
    description:
      'The two main numbers added and reduced. The tradition says it comes into focus in the second half of life, from the mid-thirties onward.',
  },
  {
    key: 'attitude',
    label: 'Attitude',
    source: 'month plus day',
    description: 'Month and day added and reduced to one digit. Read as the first impression you give.',
  },
  {
    key: 'personalYear',
    label: 'Personal Year',
    source: 'month, day, and the calendar year',
    description:
      'Month and day of birth added to the calendar year and reduced to one digit. A nine-year cycle the tradition uses for timing, running January to December.',
  },
]);

export const PERSONAL_YEAR_MEANINGS: Readonly<Record<SingleDigit, string>> = Object.freeze({
  1: 'A year for starting. The tradition treats it as the opening of a nine-year cycle: new work, new places, decisions made alone. Momentum matters more than polish.',
  2: 'A year for patience and partnership. The tradition expects what was begun last year to develop slowly; the useful work is listening, cooperating, and letting a relationship or a plan take its time.',
  3: 'A year for expression. The tradition associates it with a wider social life and easier creative work, and warns of scattering. Say the thing, make the thing, and pick one to finish.',
  4: 'A year for foundations. Work, order, health, and the unglamorous tasks that make the next years possible. The tradition reads it as a year that repays effort and not shortcuts.',
  5: 'A year for change. Travel, new people, and a restlessness the tradition says is worth following, within reason. Freedom is the theme; discipline is the counterweight.',
  6: 'A year for responsibility. Family, home, and the people who depend on you take the foreground. The tradition pairs the care given in this year with care returned in later ones.',
  7: 'A year for the inward turn. Study, rest, and questions that need quiet to answer. Less is happening on the surface than underneath.',
  8: 'A year for results. Ambition, authority, and what the last seven years of effort add up to. Decisions carry weight; so do their consequences.',
  9: 'A year for completion. Endings, clearing out, and finishing what the cycle started. The tradition says to let go now so the 1 year that follows starts clear.',
});

export const KARMIC_DEBT_MEANINGS: Readonly<Record<KarmicDebt, string>> = Object.freeze({
  13: 'The 13/4 appears when a total of 13 reduces to 4. The tradition reads it as work that has to be done twice: shortcuts fail, and the lesson is honest, patient effort until the structure holds.',
  14: 'The 14/5 appears when a total of 14 reduces to 5. The tradition reads it as freedom that has to be handled carefully: appetite, restlessness, and the need to commit to something long enough to see it through.',
  16: 'The 16/7 appears when a total of 16 reduces to 7. The tradition reads it as the collapse of what was built on the wrong footing, followed by rebuilding with more humility and clearer sight.',
  19: 'The 19/1 appears when a total of 19 reduces to 1. The tradition reads it as independence taken too far: learning to lead without going it alone, and to accept help without feeling diminished.',
});

/** The single digit a master number lives as on ordinary days. */
export function baseDigit(number: CoreNumber): SingleDigit {
  if (number === 11) return 2;
  if (number === 22) return 4;
  if (number === 33) return 6;
  return number;
}

/**
 * One pastel sign hue per core number, for the result cards' labels. The
 * twelve disc hues are the site's only chroma, so each number borrows one
 * and no two numbers share a hue.
 */
export const NUMBER_HUES: Readonly<Record<CoreNumber, string>> = Object.freeze({
  1: 'var(--sign-aries)',
  2: 'var(--sign-libra)',
  3: 'var(--sign-gemini)',
  4: 'var(--sign-capricorn)',
  5: 'var(--sign-sagittarius)',
  6: 'var(--sign-cancer)',
  7: 'var(--sign-scorpio)',
  8: 'var(--sign-leo)',
  9: 'var(--sign-pisces)',
  11: 'var(--sign-aquarius)',
  22: 'var(--sign-taurus)',
  33: 'var(--sign-virgo)',
});
