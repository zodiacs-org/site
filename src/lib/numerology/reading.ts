/**
 * The reusable numerology reading: the core numbers from a birth date and, optionally, a name, each with Zodiacs'
 * own words (src/data/numerology-meanings.ts and numerology-readings.ts). Pure and deterministic: the same input
 * gives the same reading, here, in the get_numerology tool (src/ai-tools/features/numerology.ts) or on any page,
 * such as a birthday report:
 *
 *   import { numerologyReading } from '../lib/numerology/reading';
 *   const reading = numerologyReading({ birthDate: '1990-11-29', year: 2027 });   // name optional
 *   reading.lifePath.number   // 5
 *
 * Numerology is a separate tradition from astrology; show `separateFromAstrology` with the reading. Pass the
 * person's details in only for the answer at hand: never store or log them, or put them in a URL. Throws
 * NumerologyInputError (./index.ts) for a date or name it cannot read; its message for unreadable letters names the
 * letter, so show the code's own fixed sentence, not the message, where the name must not be repeated.
 */
import { dateNumbers, nameNumbers, reduceFully, type Reduction } from './index';
import { KARMIC_DEBT_MEANINGS, NUMBER_MEANINGS, PERSONAL_YEAR_MEANINGS, type CoreNumber, type KarmicDebt, type SingleDigit } from '../../data/numerology-meanings';
import { POSITION_READINGS, type ReadingPosition } from '../../data/numerology-readings';

export const NUMEROLOGY_SEPARATE = 'Numerology is a separate tradition from astrology. It works from the letters of a name and the digits of a date, with no planets, signs or sky in it.';

export interface NumberReading {
  /** 1 to 9, or a master number 11, 22 or 33 kept unreduced. 0 only for a name with no letters of that kind. */
  number: 0 | CoreNumber;
  /** The reduction in slash notation, such as 16/7 or 29/11; the number alone when no reduction was needed. */
  chain: string;
  master: boolean;
  /** The number's short name, such as The builder. */
  title: string;
  keywords: string[];
  /** What the tradition associates with the number in any position. */
  meaning: string;
  /** What it reads as in this position. */
  reading: string;
}

export type DebtPosition = 'lifePath' | 'birthday' | 'expression' | 'soulUrge' | 'personality';

export interface NumerologyReading {
  system: 'pythagorean';
  separateFromAstrology: string;
  lifePath: NumberReading;
  /** Null without a name. */
  expression: NumberReading | null;
  soulUrge: NumberReading | null;
  personality: NumberReading | null;
  /** Fully reduced, as the site's calculator does; the chain shows an 11 or 22 on the way. */
  personalYear: { year: number; number: SingleDigit; chain: string; reading: string };
  karmicDebts: { number: KarmicDebt; carriedBy: DebtPosition[]; reading: string }[];
}

export interface NumerologyReadingInput {
  /** YYYY-MM-DD. */
  birthDate: string;
  /** The full name at birth; leave it out for the birth date numbers alone. */
  name?: string;
  /** The calendar year for the Personal Year. */
  year: number;
}

function numberReading(position: ReadingPosition, reduction: Reduction): NumberReading {
  const value = reduction.value as number;
  if (value === 0) {
    return { number: 0, chain: '0', master: false, title: 'No value', keywords: [], meaning: 'No letters of this kind are in the name, so the number has no value.', reading: 'The tradition reads an empty position as one the name leaves open, not as a lack.' };
  }
  const meaning = NUMBER_MEANINGS[value as CoreNumber];
  return {
    number: value as CoreNumber, chain: reduction.chain.join('/'), master: value === 11 || value === 22 || value === 33,
    title: meaning.name, keywords: [...meaning.keywords], meaning: meaning.summary, reading: POSITION_READINGS[position][value as CoreNumber],
  };
}

const digitSum = (n: number) => String(n).split('').reduce((sum, digit) => sum + Number(digit), 0);

/** The Personal Year as the calculator works it (personalCycles in ./index.ts), with the chain from the unreduced sum. */
function personalYear(birthDate: string, year: number) {
  const [, month, day] = birthDate.split('-').map(Number);
  const total = reduceFully(month) + reduceFully(day) + reduceFully(digitSum(year));
  const chain = [total];
  while (chain[chain.length - 1] > 9) chain.push(digitSum(chain[chain.length - 1]));
  return { number: chain[chain.length - 1] as SingleDigit, chain: chain.join('/') };
}

export function numerologyReading({ birthDate, name, year }: NumerologyReadingInput): NumerologyReading {
  const date = dateNumbers(birthDate);
  const names = name !== undefined ? nameNumbers(name) : null;
  const cycle = personalYear(date.iso, year);
  const carriers = new Map<KarmicDebt, DebtPosition[]>();
  const positions: [DebtPosition, Reduction | undefined][] = [
    ['lifePath', date.lifePath], ['birthday', date.birthday], ['expression', names?.expression], ['soulUrge', names?.soulUrge], ['personality', names?.personality],
  ];
  for (const [position, reduction] of positions) {
    if (reduction?.karmicDebt) carriers.set(reduction.karmicDebt, [...(carriers.get(reduction.karmicDebt) ?? []), position]);
  }
  return {
    system: 'pythagorean',
    separateFromAstrology: NUMEROLOGY_SEPARATE,
    lifePath: numberReading('lifePath', date.lifePath),
    expression: names ? numberReading('expression', names.expression) : null,
    soulUrge: names ? numberReading('soulUrge', names.soulUrge) : null,
    personality: names ? numberReading('personality', names.personality) : null,
    personalYear: { year, number: cycle.number, chain: cycle.chain, reading: PERSONAL_YEAR_MEANINGS[cycle.number] },
    karmicDebts: [...carriers.entries()].sort(([a], [b]) => a - b).map(([number, carriedBy]) => ({ number, carriedBy, reading: KARMIC_DEBT_MEANINGS[number] })),
  };
}
