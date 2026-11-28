/**
 * Pythagorean numerology, computed client-side.
 *
 * Pure arithmetic and string folding, no dependencies. The rules follow the
 * method Hans Decoz publishes and his chart engine applies: month, day and
 * year-digit-sum reduced separately with 11/22/33 kept, name parts reduced
 * one at a time before they are added, the positional Y rule, fully reduced
 * personal cycles, and karmic debts (13/14/16/19) read off the reduction
 * chain of the five core positions.
 *
 * Every reduction records its chain (49 -> 13 -> 4) so the UI can print the
 * arithmetic in the conventional slash notation ("49/13/4").
 */
import type { CoreNumber, SingleDigit, KarmicDebt } from '../../data/numerology-meanings';

export type { CoreNumber, SingleDigit, KarmicDebt };

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export type NumerologyInputErrorCode = 'invalid-date' | 'empty-name' | 'unsupported-letters';

const ERROR_MESSAGES: Record<NumerologyInputErrorCode, string> = {
  'invalid-date': 'Enter a real calendar date as YYYY-MM-DD.',
  'empty-name': 'Enter a name with at least one letter.',
  'unsupported-letters': 'Names are read in the Latin alphabet, A to Z; accented letters are fine.',
};

export class NumerologyInputError extends Error {
  readonly code: NumerologyInputErrorCode;
  /** The input fragment at fault when there is one: the first letter outside A–Z for 'unsupported-letters'. */
  readonly detail?: string;

  constructor(code: NumerologyInputErrorCode, message: string = ERROR_MESSAGES[code], detail?: string) {
    super(message);
    this.name = 'NumerologyInputError';
    this.code = code;
    if (detail !== undefined) this.detail = detail;
  }
}

// ---------------------------------------------------------------------------
// Reduction
// ---------------------------------------------------------------------------

/**
 * One reduced number with its full chain. `chain` starts with `total` and
 * ends with `value`: 49 -> [49, 13, 4]; 22 -> [22]; 7 -> [7].
 *
 * `value` is 0 only for a name part (or a whole name) whose selected letter
 * set is empty, e.g. the Soul Urge of "Ng"; every date position is >= 1.
 */
export interface Reduction {
  total: number;
  chain: number[];
  value: CoreNumber;
  karmicDebt: KarmicDebt | null;
}

export const CORE_NUMBERS: readonly CoreNumber[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33];

function isMaster(n: number): boolean {
  return n === 11 || n === 22 || n === 33;
}

function isCoreNumber(n: number): n is CoreNumber {
  return (Number.isInteger(n) && n >= 1 && n <= 9) || isMaster(n);
}

function digitSum(n: number): number {
  let sum = 0;
  while (n > 0) {
    sum += n % 10;
    n = Math.floor(n / 10);
  }
  return sum;
}

function assertCountingNumber(n: number, label: string): void {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`${label} must be a non-negative integer, got ${String(n)}`);
  }
}

function karmicDebtIn(chain: readonly number[]): KarmicDebt | null {
  for (const n of chain) {
    if (n === 13 || n === 14 || n === 16 || n === 19) return n;
  }
  return null;
}

/** R(n): digit-sum until the value is 1..9 or a master number 11/22/33. */
export function reduceKeepingMasters(n: number): Reduction {
  assertCountingNumber(n, 'total');
  const chain = [n];
  let value = n;
  while (value > 9 && !isMaster(value)) {
    value = digitSum(value);
    chain.push(value);
  }
  return { total: n, chain, value: value as CoreNumber, karmicDebt: karmicDebtIn(chain) };
}

/** R1(n): digit-sum until the value is a single digit; masters are not kept. */
export function reduceFully(n: number): SingleDigit {
  assertCountingNumber(n, 'total');
  let value = n;
  while (value > 9) value = digitSum(value);
  return value as SingleDigit;
}

/** Slash notation: "16/7", "49/13/4", "22", "7". */
export function formatChain(r: Reduction): string {
  return r.chain.join('/');
}

// ---------------------------------------------------------------------------
// Letters
// ---------------------------------------------------------------------------

/** A..I = 1..9, J..R = 1..9, S..Z = 1..8. Throws on anything but one A-Z letter. */
export function letterValue(letter: string): number {
  const upper = typeof letter === 'string' ? letter.toUpperCase() : '';
  const code = upper.length === 1 ? upper.charCodeAt(0) : NaN;
  if (!(code >= 65 && code <= 90)) {
    throw new NumerologyInputError('unsupported-letters', `Not a letter A-Z: ${JSON.stringify(letter)}`);
  }
  return ((code - 65) % 9) + 1;
}

export interface LetterCell {
  letter: string;
  value: number;
  vowel: boolean;
  isY: boolean;
  /** Position inside the normalised letters of the part. */
  index: number;
}

/** A manual reclassification of one Y; `index` is the position inside the normalised letters of part `part`. */
export interface YOverride {
  part: number;
  index: number;
  as: 'vowel' | 'consonant';
}

const PLAIN_VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

/**
 * Classify every letter of one normalised part. Y is a consonant when the
 * letter before it is A/E/I/O/U, or when it opens the part and the next
 * letter is A/E/I/O/U; in every other position it is a vowel. W is always a
 * consonant. Overrides are applied afterwards by index; only Y cells listen
 * to them (the `part` field is not consulted here, callers filter by part).
 */
export function classifyPart(letters: string, overrides: readonly YOverride[] = []): LetterCell[] {
  const upper = letters.toUpperCase();
  const cells: LetterCell[] = [];
  for (let i = 0; i < upper.length; i++) {
    const letter = upper.charAt(i);
    const value = letterValue(letter);
    const isY = letter === 'Y';
    let vowel: boolean;
    if (isY) {
      const prev = i > 0 ? upper.charAt(i - 1) : '';
      const next = upper.charAt(i + 1);
      const consonant = PLAIN_VOWELS.has(prev) || (i === 0 && PLAIN_VOWELS.has(next));
      vowel = !consonant;
    } else {
      vowel = PLAIN_VOWELS.has(letter);
    }
    cells.push({ letter, value, vowel, isY, index: i });
  }
  for (const override of overrides) {
    const cell = cells[override.index];
    if (cell && cell.isY) cell.vowel = override.as === 'vowel';
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Name normalisation
// ---------------------------------------------------------------------------

/** Latin letters NFKD leaves alone, folded by hand. */
const FOLD_MAP: Record<string, string> = {
  ß: 'SS',
  ẞ: 'SS',
  Æ: 'AE',
  æ: 'AE',
  Œ: 'OE',
  œ: 'OE',
  Ø: 'O',
  ø: 'O',
  Ł: 'L',
  ł: 'L',
  Đ: 'D',
  đ: 'D',
  Ð: 'D',
  ð: 'D',
  Þ: 'TH',
  þ: 'TH',
  Ħ: 'H',
  ħ: 'H',
  Ŧ: 'T',
  ŧ: 'T',
  ı: 'I',
};

/** Apostrophe-shaped modifier letters (ʻokina and friends) count as punctuation, not letters. */
const MODIFIER_APOSTROPHES = /[ʹʻʼʽʾʿ]/g;

const SUFFIXES = new Set(['JR', 'SR', 'JNR', 'SNR', 'II', 'III', 'IV', 'ESQ']);
const TITLES = new Set(['DR', 'MR', 'MRS', 'MS', 'MISS', 'MX', 'PROF', 'REV', 'SIR']);

function foldToken(token: string): string {
  const decomposed = token.normalize('NFKD').replace(/\p{M}+/gu, '').replace(MODIFIER_APOSTROPHES, '');
  let folded = '';
  for (const ch of decomposed) folded += FOLD_MAP[ch] ?? ch;
  folded = folded.toUpperCase();
  for (const ch of folded) {
    if (/\p{L}/u.test(ch) && !/[A-Z]/.test(ch)) {
      throw new NumerologyInputError(
        'unsupported-letters',
        `${ERROR_MESSAGES['unsupported-letters']} "${ch}" cannot be read.`,
        ch,
      );
    }
  }
  return folded.replace(/[^A-Z]/g, '');
}

interface RawPart {
  raw: string;
  letters: string;
}

export interface NormalizeNameOptions {
  /** Keep tokens that match titles or suffixes (Sir, Miss, Dr, Jr, ...) when they are genuinely part of the birth name. */
  keepTitles?: boolean;
}

function normalizeNameParts(input: string, options: NormalizeNameOptions = {}): RawPart[] {
  if (typeof input !== 'string') throw new NumerologyInputError('empty-name');
  const keepTitles = options.keepTitles === true;
  const parts: RawPart[] = [];
  for (const raw of input.split(/\s+/)) {
    if (!raw) continue;
    const letters = foldToken(raw);
    if (!letters) continue;
    if (!keepTitles && (SUFFIXES.has(letters) || TITLES.has(letters))) continue;
    parts.push({ raw, letters });
  }
  if (parts.length === 0) throw new NumerologyInputError('empty-name');
  return parts;
}

/**
 * Tokens that default name normalisation drops because they match a title or
 * generational suffix (Dr, Mr, Sir, Miss, Jr, III, ...), in the order written.
 * Used to tell a reader when a genuine given name or surname was excluded.
 */
export function droppedNameParts(input: string): string[] {
  if (typeof input !== 'string') return [];
  const dropped: string[] = [];
  for (const raw of input.split(/\s+/)) {
    if (!raw) continue;
    const letters = foldToken(raw);
    if (letters && (SUFFIXES.has(letters) || TITLES.has(letters))) dropped.push(raw);
  }
  return dropped;
}

/**
 * Remaps Y overrides when switching name normalisation options (such as
 * toggling `keepTitles`) so overrides on parts that stay in the name keep
 * pointing to the same part and letter index.
 */
export function remapYOverrides(
  input: string,
  from: NormalizeNameOptions,
  to: NormalizeNameOptions,
  overrides: readonly YOverride[],
): YOverride[] {
  if (overrides.length === 0 || typeof input !== 'string') return [];
  const fromKeep = from.keepTitles === true;
  const toKeep = to.keepTitles === true;
  if (fromKeep === toKeep) return [...overrides];

  const fromTokenIndex: number[] = [];
  const toPartByToken = new Map<number, number>();
  let tokenIndex = 0;
  let toPart = 0;
  for (const raw of input.split(/\s+/)) {
    if (!raw) continue;
    const letters = foldToken(raw);
    if (!letters) continue;
    const isTitleOrSuffix = SUFFIXES.has(letters) || TITLES.has(letters);
    if (fromKeep || !isTitleOrSuffix) fromTokenIndex.push(tokenIndex);
    if (toKeep || !isTitleOrSuffix) {
      toPartByToken.set(tokenIndex, toPart);
      toPart += 1;
    }
    tokenIndex += 1;
  }

  const mapped: YOverride[] = [];
  for (const override of overrides) {
    const token = fromTokenIndex[override.part];
    if (token === undefined) continue;
    const nextPart = toPartByToken.get(token);
    if (nextPart === undefined) continue;
    mapped.push({ part: nextPart, index: override.index, as: override.as });
  }
  return mapped;
}

/**
 * Ordered A-Z name parts. Accents are folded (é -> E, ñ -> N, ß -> SS),
 * parts are split on whitespace only, punctuation inside a part is removed
 * without splitting (Dubois-Charpentier is one part), and generational
 * suffixes and titles (JR, SR, II, III, IV, Dr, Mr, ...) are dropped unless
 * `keepTitles` is true.
 * Letters that do not fold to A-Z are an error, never a silent drop.
 */
export function normalizeName(input: string, options?: NormalizeNameOptions): string[] {
  return normalizeNameParts(input, options).map((p) => p.letters);
}

// ---------------------------------------------------------------------------
// Name numbers
// ---------------------------------------------------------------------------

export interface NamePartNumbers {
  raw: string;
  letters: string;
  cells: LetterCell[];
  expression: Reduction;
  soulUrge: Reduction;
  personality: Reduction;
}

export interface NameNumbers {
  parts: NamePartNumbers[];
  expression: Reduction;
  soulUrge: Reduction;
  personality: Reduction;
}

function partNumbers(part: RawPart, cells: LetterCell[]): NamePartNumbers {
  let all = 0;
  let vowels = 0;
  let consonants = 0;
  for (const cell of cells) {
    all += cell.value;
    if (cell.vowel) vowels += cell.value;
    else consonants += cell.value;
  }
  return {
    raw: part.raw,
    letters: part.letters,
    cells,
    expression: reduceKeepingMasters(all),
    soulUrge: reduceKeepingMasters(vowels),
    personality: reduceKeepingMasters(consonants),
  };
}

/**
 * Expression (all letters), Soul Urge (vowels) and Personality (consonants).
 * Each part is reduced on its own with masters kept; the reduced parts are
 * added and the sum reduced again. A one-part name keeps the part's own chain.
 */
export function nameNumbers(fullName: string, overrides: readonly YOverride[] = [], options?: NormalizeNameOptions): NameNumbers {
  const parts = normalizeNameParts(fullName, options).map((part, i) =>
    partNumbers(part, classifyPart(part.letters, overrides.filter((o) => o.part === i))),
  );
  const only = parts.length === 1 ? parts[0] : undefined;
  if (only) {
    return { parts, expression: only.expression, soulUrge: only.soulUrge, personality: only.personality };
  }
  const sumOf = (pick: (p: NamePartNumbers) => Reduction): Reduction =>
    reduceKeepingMasters(parts.reduce((sum, p) => sum + pick(p).value, 0));
  return {
    parts,
    expression: sumOf((p) => p.expression),
    soulUrge: sumOf((p) => p.soulUrge),
    personality: sumOf((p) => p.personality),
  };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return MONTH_LENGTHS[month - 1] ?? 0;
}

function parseIsoDate(iso: string): CalendarDate {
  const match = typeof iso === 'string' ? ISO_DATE.exec(iso.trim()) : null;
  if (!match) throw new NumerologyInputError('invalid-date');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new NumerologyInputError('invalid-date');
  }
  return { year, month, day };
}

function isoString(d: CalendarDate): string {
  return `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

function nextDay(d: CalendarDate): CalendarDate {
  if (d.day < daysInMonth(d.year, d.month)) return { year: d.year, month: d.month, day: d.day + 1 };
  if (d.month < 12) return { year: d.year, month: d.month + 1, day: 1 };
  return { year: d.year + 1, month: 1, day: 1 };
}

export interface DateNumbers {
  iso: string;
  /** R(month), R(day), R(digit sum of the year): the Life Path units, masters kept. */
  month: Reduction;
  day: Reduction;
  year: Reduction;
  /** R(month.value + day.value + year.value); the chain shows a karmic debt when the total is 13/14/16/19. */
  lifePath: Reduction;
  /** R(day of the month). Identical to `day`; kept as its own field because it is read as a core number. */
  birthday: Reduction;
  attitude: SingleDigit;
  pinnacles: [CoreNumber, CoreNumber, CoreNumber, CoreNumber];
  /** Age at which each pinnacle begins; the first is always 0. */
  pinnacleAgeStarts: [number, number, number, number];
  challenges: [number, number, number, number];
}

function lifePathValueOf(d: CalendarDate): CoreNumber {
  return reduceKeepingMasters(
    reduceKeepingMasters(d.month).value + reduceKeepingMasters(d.day).value + reduceKeepingMasters(digitSum(d.year)).value,
  ).value;
}

function buildDateNumbers(d: CalendarDate): DateNumbers {
  const month = reduceKeepingMasters(d.month);
  const day = reduceKeepingMasters(d.day);
  const year = reduceKeepingMasters(digitSum(d.year));
  const lifePath = reduceKeepingMasters(month.value + day.value + year.value);

  const m1 = reduceFully(d.month);
  const d1 = reduceFully(d.day);
  const y1 = reduceFully(digitSum(d.year));
  const attitude = reduceFully(m1 + d1);

  const p1 = reduceKeepingMasters(month.value + day.value).value;
  const p2 = reduceKeepingMasters(day.value + year.value).value;
  const p3 = reduceKeepingMasters(p1 + p2).value;
  const p4 = reduceKeepingMasters(month.value + year.value).value;
  const L = reduceFully(lifePath.value);

  const c1 = Math.abs(m1 - d1);
  const c2 = Math.abs(d1 - y1);
  const c3 = Math.abs(c1 - c2);
  const c4 = Math.abs(m1 - y1);

  return {
    iso: isoString(d),
    month,
    day,
    year,
    lifePath,
    birthday: reduceKeepingMasters(d.day),
    attitude,
    pinnacles: [p1, p2, p3, p4],
    pinnacleAgeStarts: [0, 37 - L, 46 - L, 55 - L],
    challenges: [c1, c2, c3, c4],
  };
}

/** Everything the birth date alone determines. Throws NumerologyInputError('invalid-date'). */
export function dateNumbers(isoDate: string): DateNumbers {
  return buildDateNumbers(parseIsoDate(isoDate));
}

// ---------------------------------------------------------------------------
// Personal cycles
// ---------------------------------------------------------------------------

export interface PersonalCycles {
  forDate: string;
  year: SingleDigit;
  month: SingleDigit;
  day: SingleDigit;
}

/** Personal Year / Month / Day for the target calendar date; masters are never kept in cycles. */
export function personalCycles(isoBirthDate: string, isoTargetDate: string): PersonalCycles {
  const birth = parseIsoDate(isoBirthDate);
  const target = parseIsoDate(isoTargetDate);
  const year = reduceFully(reduceFully(birth.month) + reduceFully(birth.day) + reduceFully(digitSum(target.year)));
  const month = reduceFully(year + reduceFully(target.month));
  const day = reduceFully(month + reduceFully(target.day));
  return { forDate: isoString(target), year, month, day };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export interface NumerologyProfile {
  date: DateNumbers;
  name: NameNumbers | null;
  maturity: Reduction | null;
  personalCycles: PersonalCycles;
  /** Sorted distinct debts across Life Path, Birthday, Expression, Soul Urge and Personality. */
  karmicDebts: KarmicDebt[];
}

export interface NumerologyProfileInput {
  birthDate: string;
  /** Omitted, empty or whitespace-only means "no name given"; a name that normalises to nothing throws. */
  fullName?: string;
  today: string;
  yOverrides?: readonly YOverride[];
  /** Keep tokens that match a title or suffix (e.g. "Sir", "Miss") as part of the birth name. */
  keepTitles?: boolean;
}

export function numerologyProfile(input: NumerologyProfileInput): NumerologyProfile {
  const date = dateNumbers(input.birthDate);
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim() : '';
  const name = fullName ? nameNumbers(fullName, input.yOverrides ?? [], { keepTitles: input.keepTitles }) : null;
  const maturity = name ? reduceKeepingMasters(date.lifePath.value + name.expression.value) : null;
  const cycles = personalCycles(input.birthDate, input.today);

  const debts = new Set<KarmicDebt>();
  const positions = [date.lifePath, date.birthday, name?.expression, name?.soulUrge, name?.personality];
  for (const r of positions) {
    if (r?.karmicDebt) debts.add(r.karmicDebt);
  }

  return {
    date,
    name,
    maturity,
    personalCycles: cycles,
    karmicDebts: [...debts].sort((a, b) => a - b),
  };
}

// ---------------------------------------------------------------------------
// Life Path facts across the calendar
// ---------------------------------------------------------------------------

export interface LifePathStats {
  number: CoreNumber;
  count: number;
  /** Percentage of all dates in the range, two decimals. */
  share: number;
  /** Pre-reduction total -> number of dates with that total. */
  totals: Record<number, number>;
}

function assertYearRange(fromYear: number, toYear: number): void {
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear < 1 || toYear > 9999 || fromYear > toYear) {
    throw new RangeError(`Year range must satisfy 1 <= from <= to <= 9999, got ${String(fromYear)}..${String(toYear)}`);
  }
}

function assertCoreNumber(n: number): asserts n is CoreNumber {
  if (!isCoreNumber(n)) throw new RangeError(`Not a core number (1-9, 11, 22, 33): ${String(n)}`);
}

/** How every date from 1 January `fromYear` to 31 December `toYear` distributes over the twelve Life Paths. */
export function lifePathDistribution(fromYear = 1900, toYear = 2099): Record<CoreNumber, LifePathStats> {
  assertYearRange(fromYear, toYear);
  const stats = {} as Record<CoreNumber, LifePathStats>;
  for (const n of CORE_NUMBERS) stats[n] = { number: n, count: 0, share: 0, totals: {} };

  const monthUnits = Array.from({ length: 13 }, (_, m) => (m ? reduceKeepingMasters(m).value : 0));
  const dayUnits = Array.from({ length: 32 }, (_, d) => (d ? reduceKeepingMasters(d).value : 0));

  let all = 0;
  for (let year = fromYear; year <= toYear; year++) {
    const yearUnit = reduceKeepingMasters(digitSum(year)).value;
    for (let month = 1; month <= 12; month++) {
      const monthUnit = monthUnits[month] ?? 0;
      const length = daysInMonth(year, month);
      for (let day = 1; day <= length; day++) {
        const total = monthUnit + (dayUnits[day] ?? 0) + yearUnit;
        const lifePath = reduceKeepingMasters(total);
        const entry = stats[lifePath.value];
        entry.count += 1;
        entry.totals[total] = (entry.totals[total] ?? 0) + 1;
        all += 1;
      }
    }
  }
  for (const n of CORE_NUMBERS) stats[n].share = Math.round((stats[n].count / all) * 10000) / 100;
  return stats;
}

/** Ascending pre-reduction totals that actually produce `number` somewhere in the range. */
export function totalsReducingTo(number: CoreNumber, fromYear = 1900, toYear = 2099): number[] {
  assertCoreNumber(number);
  const stats = lifePathDistribution(fromYear, toYear)[number];
  return Object.keys(stats.totals)
    .map(Number)
    .sort((a, b) => a - b);
}

/** The next `count` calendar dates on or after `fromIsoDate` whose Life Path is `number`, ascending. */
export function nextDatesWithLifePath(number: CoreNumber, fromIsoDate: string, count: number): string[] {
  assertCoreNumber(number);
  const out: string[] = [];
  const wanted = Number.isFinite(count) ? Math.floor(count) : 0;
  let cursor = parseIsoDate(fromIsoDate);
  while (out.length < wanted && cursor.year <= 9999) {
    if (lifePathValueOf(cursor) === number) out.push(isoString(cursor));
    cursor = nextDay(cursor);
  }
  return out;
}

/** One line of arithmetic, e.g. "10 → 1 · 15 → 6 · 1998 → 27 → 9 · 1 + 6 + 9 = 16 → 7". */
export function lifePathExample(isoDate: string): string {
  const d = parseIsoDate(isoDate);
  const month = reduceKeepingMasters(d.month);
  const day = reduceKeepingMasters(d.day);
  const year = reduceKeepingMasters(digitSum(d.year));
  const lifePath = reduceKeepingMasters(month.value + day.value + year.value);
  const arrows = (r: Reduction): string => r.chain.join(' → ');
  return [
    arrows(month),
    arrows(day),
    `${String(d.year).padStart(4, '0')} → ${arrows(year)}`,
    `${month.value} + ${day.value} + ${year.value} = ${arrows(lifePath)}`,
  ].join(' · ');
}
