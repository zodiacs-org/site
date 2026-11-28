import { describe, expect, it } from 'vitest';
import {
  NumerologyInputError,
  classifyPart,
  dateNumbers,
  droppedNamePartEntries,
  droppedNameParts,
  formatChain,
  letterValue,
  lifePathDistribution,
  lifePathExample,
  nameNumbers,
  nextDatesWithLifePath,
  normalizeName,
  numerologyProfile,
  personalCycles,
  reduceFully,
  reduceKeepingMasters,
  remapYOverrides,
  totalsReducingTo,
  type CoreNumber,
  type KarmicDebt,
  type Reduction,
} from './index';

// ---------------------------------------------------------------------------
// The 15 worked vectors from the rule set, with the arithmetic they spell out
// ---------------------------------------------------------------------------

interface YCase {
  part: number;
  index: number;
  vowel: boolean;
}

interface Vector {
  name: string;
  birthDate: string;
  parts: string[];
  ys?: YCase[];
  lifePath: number[];
  birthday: number[];
  expressionParts: number[][];
  soulUrgeParts: number[][];
  personalityParts: number[][];
  expression: number[];
  soulUrge: number[];
  personality: number[];
  maturity: number[];
  personalYearFor: string;
  personalYear: number;
  attitude: number;
  pinnacles: [number, number, number, number];
  challenges: [number, number, number, number];
  karmicDebts: KarmicDebt[];
}

const VECTORS: Vector[] = [
  {
    name: 'Tobias Alexander Wren',
    birthDate: '1983-03-14',
    parts: ['TOBIAS', 'ALEXANDER', 'WREN'],
    lifePath: [11],
    birthday: [14, 5],
    expressionParts: [[21, 3], [39, 12, 3], [24, 6]],
    soulUrgeParts: [[16, 7], [12, 3], [5]],
    personalityParts: [[5], [27, 9], [19, 10, 1]],
    expression: [12, 3],
    soulUrge: [15, 6],
    personality: [15, 6],
    maturity: [14, 5],
    personalYearFor: '2026',
    personalYear: 9,
    attitude: 8,
    pinnacles: [8, 8, 7, 6],
    challenges: [2, 2, 0, 0],
    karmicDebts: [14],
  },
  {
    name: 'Mirabel Sydney Okonkwo',
    birthDate: '1976-06-11',
    parts: ['MIRABEL', 'SYDNEY', 'OKONKWO'],
    ys: [
      { part: 1, index: 1, vowel: true },
      { part: 1, index: 5, vowel: false },
    ],
    lifePath: [22],
    birthday: [11],
    expressionParts: [[33], [29, 11], [32, 5]],
    soulUrgeParts: [[15, 6], [12, 3], [18, 9]],
    personalityParts: [[18, 9], [17, 8], [14, 5]],
    expression: [49, 13, 4],
    soulUrge: [18, 9],
    personality: [22],
    maturity: [26, 8],
    personalYearFor: '2026',
    personalYear: 9,
    attitude: 8,
    pinnacles: [8, 7, 6, 11],
    challenges: [4, 3, 1, 1],
    karmicDebts: [13],
  },
  {
    name: 'Callum Rhys Featherstone',
    birthDate: '1975-02-18',
    parts: ['CALLUM', 'RHYS', 'FEATHERSTONE'],
    ys: [{ part: 1, index: 2, vowel: true }],
    lifePath: [33],
    birthday: [18, 9],
    expressionParts: [[17, 8], [25, 7], [55, 10, 1]],
    soulUrgeParts: [[4], [7], [22]],
    personalityParts: [[13, 4], [18, 9], [33]],
    expression: [16, 7],
    soulUrge: [33],
    personality: [46, 10, 1],
    maturity: [40, 4],
    personalYearFor: '2026',
    personalYear: 3,
    attitude: 2,
    pinnacles: [11, 4, 6, 6],
    challenges: [7, 5, 2, 2],
    karmicDebts: [16],
  },
  {
    name: 'Oriane Lys Beaumont',
    birthDate: '1998-10-15',
    parts: ['ORIANE', 'LYS', 'BEAUMONT'],
    ys: [{ part: 1, index: 1, vowel: true }],
    lifePath: [16, 7],
    birthday: [15, 6],
    expressionParts: [[35, 8], [11], [28, 10, 1]],
    soulUrgeParts: [[21, 3], [7], [15, 6]],
    personalityParts: [[14, 5], [4], [13, 4]],
    expression: [20, 2],
    soulUrge: [16, 7],
    personality: [13, 4],
    maturity: [9],
    personalYearFor: '2026',
    personalYear: 8,
    attitude: 7,
    pinnacles: [7, 6, 4, 1],
    challenges: [5, 3, 2, 8],
    karmicDebts: [13, 16],
  },
  {
    name: 'Yvonne Marguerite Castellanos',
    birthDate: '1976-04-11',
    parts: ['YVONNE', 'MARGUERITE', 'CASTELLANOS'],
    ys: [{ part: 0, index: 0, vowel: true }],
    lifePath: [20, 2],
    birthday: [11],
    expressionParts: [[32, 5], [54, 9], [31, 4]],
    soulUrgeParts: [[18, 9], [23, 5], [13, 4]],
    personalityParts: [[14, 5], [31, 4], [18, 9]],
    expression: [18, 9],
    soulUrge: [18, 9],
    personality: [18, 9],
    maturity: [11],
    personalYearFor: '2026',
    personalYear: 7,
    attitude: 6,
    pinnacles: [6, 7, 4, 9],
    challenges: [2, 3, 1, 1],
    karmicDebts: [],
  },
  {
    name: 'Yolanda Faye Murray',
    birthDate: '1975-01-19',
    parts: ['YOLANDA', 'FAYE', 'MURRAY'],
    ys: [
      { part: 0, index: 0, vowel: false },
      { part: 1, index: 2, vowel: false },
      { part: 2, index: 5, vowel: false },
    ],
    lifePath: [24, 6],
    birthday: [19, 10, 1],
    expressionParts: [[27, 9], [19, 10, 1], [33]],
    soulUrgeParts: [[8], [6], [4]],
    personalityParts: [[19, 10, 1], [13, 4], [29, 11]],
    expression: [43, 7],
    soulUrge: [18, 9],
    personality: [16, 7],
    maturity: [13, 4],
    personalYearFor: '2027',
    personalYear: 4,
    attitude: 2,
    pinnacles: [2, 5, 7, 5],
    challenges: [0, 3, 3, 3],
    karmicDebts: [16, 19],
  },
  {
    name: 'Renée Céline Dubois-Charpentier',
    birthDate: '2001-11-29',
    parts: ['RENEE', 'CELINE', 'DUBOISCHARPENTIER'],
    lifePath: [25, 7],
    birthday: [29, 11],
    expressionParts: [[29, 11], [30, 3], [88, 16, 7]],
    soulUrgeParts: [[15, 6], [19, 10, 1], [38, 11]],
    personalityParts: [[14, 5], [11], [50, 5]],
    expression: [21, 3],
    soulUrge: [18, 9],
    personality: [21, 3],
    maturity: [10, 1],
    personalYearFor: '2026',
    personalYear: 5,
    attitude: 4,
    pinnacles: [22, 5, 9, 5],
    challenges: [0, 1, 1, 1],
    karmicDebts: [],
  },
  {
    name: "Siobhán O'Connell",
    birthDate: '1990-08-22',
    parts: ['SIOBHAN', 'OCONNELL'],
    lifePath: [31, 4],
    birthday: [22],
    expressionParts: [[32, 5], [36, 9]],
    soulUrgeParts: [[16, 7], [17, 8]],
    personalityParts: [[16, 7], [19, 10, 1]],
    expression: [14, 5],
    soulUrge: [15, 6],
    personality: [8],
    maturity: [9],
    personalYearFor: '2026',
    personalYear: 4,
    attitude: 3,
    pinnacles: [3, 5, 8, 9],
    challenges: [4, 3, 1, 7],
    karmicDebts: [14],
  },
  {
    name: 'Ryan Wyatt Dwyer',
    birthDate: '1984-04-12',
    parts: ['RYAN', 'WYATT', 'DWYER'],
    ys: [
      { part: 0, index: 1, vowel: true },
      { part: 1, index: 1, vowel: true },
      { part: 2, index: 2, vowel: true },
    ],
    lifePath: [29, 11],
    birthday: [12, 3],
    expressionParts: [[22], [17, 8], [30, 3]],
    soulUrgeParts: [[8], [8], [12, 3]],
    personalityParts: [[14, 5], [9], [18, 9]],
    expression: [33],
    soulUrge: [19, 10, 1],
    personality: [23, 5],
    maturity: [44, 8],
    personalYearFor: '2026',
    personalYear: 8,
    attitude: 7,
    pinnacles: [7, 7, 5, 8],
    challenges: [1, 1, 0, 0],
    karmicDebts: [19],
  },
  {
    name: 'Zephyrine',
    birthDate: '2000-06-29',
    parts: ['ZEPHYRINE'],
    ys: [{ part: 0, index: 4, vowel: true }],
    lifePath: [19, 10, 1],
    birthday: [29, 11],
    expressionParts: [[63, 9]],
    soulUrgeParts: [[26, 8]],
    personalityParts: [[37, 10, 1]],
    expression: [63, 9],
    soulUrge: [26, 8],
    personality: [37, 10, 1],
    maturity: [10, 1],
    personalYearFor: '2026',
    personalYear: 9,
    attitude: 8,
    pinnacles: [8, 4, 3, 8],
    challenges: [4, 0, 4, 4],
    karmicDebts: [19],
  },
  {
    name: 'Ingrid Solveig Halvorsen',
    birthDate: '1988-11-04',
    parts: ['INGRID', 'SOLVEIG', 'HALVORSEN'],
    lifePath: [23, 5],
    birthday: [4],
    expressionParts: [[43, 7], [35, 8], [42, 6]],
    soulUrgeParts: [[18, 9], [20, 2], [12, 3]],
    personalityParts: [[25, 7], [15, 6], [30, 3]],
    expression: [21, 3],
    soulUrge: [14, 5],
    personality: [16, 7],
    maturity: [8],
    personalYearFor: '2026',
    personalYear: 7,
    attitude: 6,
    pinnacles: [6, 3, 9, 1],
    challenges: [2, 4, 2, 6],
    karmicDebts: [14, 16],
  },
  {
    name: 'Lucía Nuñez Ríos',
    birthDate: '1999-12-31',
    parts: ['LUCIA', 'NUNEZ', 'RIOS'],
    lifePath: [8],
    birthday: [31, 4],
    expressionParts: [[19, 10, 1], [26, 8], [25, 7]],
    soulUrgeParts: [[13, 4], [8], [15, 6]],
    personalityParts: [[6], [18, 9], [10, 1]],
    expression: [16, 7],
    soulUrge: [18, 9],
    personality: [16, 7],
    maturity: [15, 6],
    personalYearFor: '2027',
    personalYear: 9,
    attitude: 7,
    pinnacles: [7, 5, 3, 4],
    challenges: [1, 3, 2, 2],
    karmicDebts: [16],
  },
  {
    name: 'Gwendolyn Bowen Ashworth',
    birthDate: '2005-05-15',
    parts: ['GWENDOLYN', 'BOWEN', 'ASHWORTH'],
    ys: [{ part: 0, index: 7, vowel: true }],
    lifePath: [18, 9],
    birthday: [15, 6],
    expressionParts: [[47, 11], [23, 5], [40, 4]],
    soulUrgeParts: [[18, 9], [11], [7]],
    personalityParts: [[29, 11], [12, 3], [33]],
    expression: [20, 2],
    soulUrge: [27, 9],
    personality: [47, 11],
    maturity: [11],
    personalYearFor: '2026',
    personalYear: 3,
    attitude: 2,
    pinnacles: [11, 4, 6, 3],
    challenges: [1, 1, 0, 2],
    karmicDebts: [],
  },
  {
    name: 'Thomas Elliot Vance',
    birthDate: '1992-07-07',
    parts: ['THOMAS', 'ELLIOT', 'VANCE'],
    lifePath: [17, 8],
    birthday: [7],
    expressionParts: [[22], [28, 10, 1], [18, 9]],
    soulUrgeParts: [[7], [20, 2], [6]],
    personalityParts: [[15, 6], [8], [12, 3]],
    expression: [32, 5],
    soulUrge: [15, 6],
    personality: [17, 8],
    maturity: [13, 4],
    personalYearFor: '2026',
    personalYear: 6,
    attitude: 5,
    pinnacles: [5, 1, 6, 1],
    challenges: [0, 4, 4, 4],
    karmicDebts: [],
  },
  {
    name: 'Priya Anand Mehra',
    birthDate: '1969-09-13',
    parts: ['PRIYA', 'ANAND', 'MEHRA'],
    ys: [{ part: 0, index: 3, vowel: false }],
    lifePath: [20, 2],
    birthday: [13, 4],
    expressionParts: [[33], [16, 7], [27, 9]],
    soulUrgeParts: [[10, 1], [2], [6]],
    personalityParts: [[23, 5], [14, 5], [21, 3]],
    expression: [49, 13, 4],
    soulUrge: [9],
    personality: [13, 4],
    maturity: [6],
    personalYearFor: '2026',
    personalYear: 5,
    attitude: 4,
    pinnacles: [4, 11, 6, 7],
    challenges: [5, 3, 2, 2],
    karmicDebts: [13],
  },
];

const last = (chain: number[]): number => chain[chain.length - 1] as number;

function expectReduction(r: Reduction, chain: number[]): void {
  expect(r.chain).toEqual(chain);
  expect(r.total).toBe(chain[0]);
  expect(r.value).toBe(last(chain));
  const debt = chain.find((n) => n === 13 || n === 14 || n === 16 || n === 19) ?? null;
  expect(r.karmicDebt).toBe(debt);
}

describe('worked vectors', () => {
  for (const v of VECTORS) {
    describe(`${v.name} (${v.birthDate})`, () => {
      const profile = numerologyProfile({
        birthDate: v.birthDate,
        fullName: v.name,
        today: `${v.personalYearFor}-01-01`,
      });
      const name = profile.name;
      if (!name) throw new Error('name expected');

      it('normalises the name parts', () => {
        expect(normalizeName(v.name)).toEqual(v.parts);
        expect(name.parts.map((p) => p.letters)).toEqual(v.parts);
      });

      it('classifies every Y as the rule set says', () => {
        for (const y of v.ys ?? []) {
          const cell = name.parts[y.part]?.cells[y.index];
          expect(cell?.letter).toBe('Y');
          expect(cell?.isY).toBe(true);
          expect(cell?.vowel).toBe(y.vowel);
        }
        for (const part of name.parts) {
          for (const cell of part.cells) {
            if (cell.letter === 'W') expect(cell.vowel).toBe(false);
            if ('AEIOU'.includes(cell.letter)) expect(cell.vowel).toBe(true);
          }
        }
      });

      it('reduces each name part on its own', () => {
        expect(name.parts).toHaveLength(v.expressionParts.length);
        name.parts.forEach((part, i) => {
          expectReduction(part.expression, v.expressionParts[i] as number[]);
          expectReduction(part.soulUrge, v.soulUrgeParts[i] as number[]);
          expectReduction(part.personality, v.personalityParts[i] as number[]);
        });
      });

      it('gives the core numbers with their chains', () => {
        expectReduction(profile.date.lifePath, v.lifePath);
        expectReduction(profile.date.birthday, v.birthday);
        expectReduction(name.expression, v.expression);
        expectReduction(name.soulUrge, v.soulUrge);
        expectReduction(name.personality, v.personality);
        expect(profile.maturity).not.toBeNull();
        expectReduction(profile.maturity as Reduction, v.maturity);
      });

      it('gives the personal year, attitude, pinnacles and challenges', () => {
        expect(profile.personalCycles.year).toBe(v.personalYear);
        expect(personalCycles(v.birthDate, `${v.personalYearFor}-07-04`).year).toBe(v.personalYear);
        expect(profile.date.attitude).toBe(v.attitude);
        expect(profile.date.pinnacles).toEqual(v.pinnacles);
        expect(profile.date.challenges).toEqual(v.challenges);
      });

      it('collects the karmic debts of the five core positions only', () => {
        expect(profile.karmicDebts).toEqual(v.karmicDebts);
      });
    });
  }

  it('records the extra arithmetic the vectors spell out', () => {
    // Yolanda Faye Murray: 2026 is a 3 year, 2027 a 4 year.
    expect(personalCycles('1975-01-19', '2026-01-01').year).toBe(3);
    expect(personalCycles('1975-01-19', '2027-11-29')).toEqual({ forDate: '2027-11-29', year: 4, month: 6, day: 8 });
    // Pinnacle timing: L = R1(Life Path); Life Path 11 -> L 2 -> 0..34, 35..43, 44..52, 53+.
    expect(dateNumbers('1983-03-14').pinnacleAgeStarts).toEqual([0, 35, 44, 53]);
    // The rule set's L = 8 example: 0-28, 29-37, 38-46, 47+.
    expect(dateNumbers('1992-07-07').pinnacleAgeStarts).toEqual([0, 29, 38, 47]);
    // Life Path units keep masters: 1975 -> 22, November -> 11, day 29 -> 11.
    const renee = dateNumbers('2001-11-29');
    expectReduction(renee.month, [11]);
    expectReduction(renee.day, [29, 11]);
    expectReduction(renee.year, [3]);
    const callum = dateNumbers('1975-02-18');
    expectReduction(callum.year, [22]);
    expectReduction(dateNumbers('1990-08-22').year, [19, 10, 1]);
    // The year unit's own 19 never becomes a Life Path debt.
    expect(dateNumbers('1990-08-22').lifePath.karmicDebt).toBeNull();
    expect(numerologyProfile({ birthDate: '1990-08-22', today: '2026-01-01' }).karmicDebts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Reduction and notation
// ---------------------------------------------------------------------------

describe('reduction', () => {
  it('keeps masters and records the chain', () => {
    expectReduction(reduceKeepingMasters(49), [49, 13, 4]);
    expectReduction(reduceKeepingMasters(29), [29, 11]);
    expectReduction(reduceKeepingMasters(19), [19, 10, 1]);
    expectReduction(reduceKeepingMasters(22), [22]);
    expectReduction(reduceKeepingMasters(33), [33]);
    expectReduction(reduceKeepingMasters(44), [44, 8]);
    expectReduction(reduceKeepingMasters(7), [7]);
    expectReduction(reduceKeepingMasters(0), [0]);
  });

  it('reduces fully with no master exceptions', () => {
    expect(reduceFully(11)).toBe(2);
    expect(reduceFully(22)).toBe(4);
    expect(reduceFully(29)).toBe(2);
    expect(reduceFully(2026)).toBe(1);
    expect(reduceFully(9)).toBe(9);
  });

  it('rejects non-counting input', () => {
    expect(() => reduceKeepingMasters(-1)).toThrow(RangeError);
    expect(() => reduceKeepingMasters(1.5)).toThrow(RangeError);
    expect(() => reduceFully(Number.NaN)).toThrow(RangeError);
  });

  it('formats chains with slashes', () => {
    expect(formatChain(reduceKeepingMasters(16))).toBe('16/7');
    expect(formatChain(reduceKeepingMasters(49))).toBe('49/13/4');
    expect(formatChain(reduceKeepingMasters(22))).toBe('22');
    expect(formatChain(reduceKeepingMasters(7))).toBe('7');
    expect(formatChain(reduceKeepingMasters(19))).toBe('19/10/1');
    expect(formatChain(reduceKeepingMasters(29))).toBe('29/11');
  });
});

// ---------------------------------------------------------------------------
// Letters and the Y rule
// ---------------------------------------------------------------------------

describe('letter values', () => {
  it('cycles A-Z through 1..9', () => {
    const table: Record<string, number> = {
      A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
      J: 1, K: 2, L: 3, M: 4, N: 5, O: 6, P: 7, Q: 8, R: 9,
      S: 1, T: 2, U: 3, V: 4, W: 5, X: 6, Y: 7, Z: 8,
    };
    for (const [letter, value] of Object.entries(table)) {
      expect(letterValue(letter)).toBe(value);
      expect(letterValue(letter.toLowerCase())).toBe(value);
    }
  });

  it('throws on anything that is not one A-Z letter', () => {
    for (const bad of ['', 'AB', '1', 'É', 'ß', ' ', '-']) {
      expect(() => letterValue(bad)).toThrow(NumerologyInputError);
    }
  });
});

describe('the Y rule', () => {
  const cases: Array<[string, number, 'vowel' | 'consonant']> = [
    ['SYDNEY', 1, 'vowel'],
    ['SYDNEY', 5, 'consonant'],
    ['RYAN', 1, 'vowel'],
    ['FAYE', 2, 'consonant'],
    ['KAYLA', 2, 'consonant'],
    ['YVONNE', 0, 'vowel'],
    ['YOLANDA', 0, 'consonant'],
    ['MURRAY', 5, 'consonant'],
    ['MAYA', 2, 'consonant'],
    ['KYLE', 1, 'vowel'],
    ['LYNN', 1, 'vowel'],
    ['HAYDEN', 2, 'consonant'],
    ['BOYD', 2, 'consonant'],
    ['WYATT', 1, 'vowel'],
  ];

  for (const [word, index, expected] of cases) {
    it(`${word}[${index}] is a ${expected}`, () => {
      const cell = classifyPart(word)[index];
      expect(cell?.letter).toBe('Y');
      expect(cell?.vowel).toBe(expected === 'vowel');
    });
  }

  it('reproduces the example values', () => {
    const sums = (word: string) => {
      const cells = classifyPart(word);
      return {
        vowels: cells.filter((c) => c.vowel).reduce((s, c) => s + c.value, 0),
        consonants: cells.filter((c) => !c.vowel).reduce((s, c) => s + c.value, 0),
      };
    };
    expect(sums('SYDNEY')).toEqual({ vowels: 12, consonants: 17 });
    expect(sums('RYAN')).toEqual({ vowels: 8, consonants: 14 });
    expect(sums('FAYE')).toEqual({ vowels: 6, consonants: 13 });
    expect(sums('KAYLA')).toEqual({ vowels: 2, consonants: 12 });
  });

  it('treats a lone Y as a vowel and W as a consonant', () => {
    expect(classifyPart('Y')[0]?.vowel).toBe(true);
    expect(classifyPart('BOWEN').map((c) => c.vowel)).toEqual([false, true, false, true, false]);
  });

  it('honours per-letter overrides on Y only', () => {
    const byRule = classifyPart('TANYA');
    expect(byRule[3]?.vowel).toBe(true);
    const overridden = classifyPart('TANYA', [
      { part: 0, index: 3, as: 'consonant' },
      { part: 0, index: 0, as: 'vowel' },
    ]);
    expect(overridden[3]?.vowel).toBe(false);
    expect(overridden[0]?.vowel).toBe(false);

    const plain = nameNumbers('Tanya Kenyon');
    expect(plain.parts[0]?.soulUrge.total).toBe(9);
    const fixed = nameNumbers('Tanya Kenyon', [{ part: 0, index: 3, as: 'consonant' }]);
    expect(fixed.parts[0]?.soulUrge.total).toBe(2);
    expect(fixed.parts[0]?.personality.total).toBe(14);
    expect(fixed.parts[1]?.cells[3]?.vowel).toBe(true);
  });

  it('carries the cell index and value', () => {
    expect(classifyPart('LYS')).toEqual([
      { letter: 'L', value: 3, vowel: false, isY: false, index: 0 },
      { letter: 'Y', value: 7, vowel: true, isY: true, index: 1 },
      { letter: 'S', value: 1, vowel: false, isY: false, index: 2 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

describe('normalizeName', () => {
  it('folds accents to the base letter', () => {
    expect(normalizeName('Renée Céline')).toEqual(['RENEE', 'CELINE']);
    expect(normalizeName('Lucía Nuñez Ríos')).toEqual(['LUCIA', 'NUNEZ', 'RIOS']);
    expect(normalizeName('Siobhán Ørsted Åberg Çelik Müller Ýr')).toEqual([
      'SIOBHAN', 'ORSTED', 'ABERG', 'CELIK', 'MULLER', 'YR',
    ]);
  });

  it('expands the letters NFKD leaves alone', () => {
    expect(normalizeName('Straße')).toEqual(['STRASSE']);
    expect(normalizeName('Æsa Œuvre Łukasz Đorđe Þór')).toEqual(['AESA', 'OEUVRE', 'LUKASZ', 'DORDE', 'THOR']);
  });

  it('removes hyphens, apostrophes and other punctuation without splitting', () => {
    expect(normalizeName('Renée Dubois-Charpentier')).toEqual(['RENEE', 'DUBOISCHARPENTIER']);
    expect(normalizeName("Siobhán O'Connell")).toEqual(['SIOBHAN', 'OCONNELL']);
    expect(normalizeName('Marie-Claire O’Neil St. John')).toEqual(['MARIECLAIRE', 'ONEIL', 'ST', 'JOHN']);
    expect(normalizeName('Kaʻiulani')).toEqual(['KAIULANI']);
  });

  it('splits on any whitespace and drops empty parts', () => {
    expect(normalizeName('  Tobias\tAlexander Wren  ')).toEqual(['TOBIAS', 'ALEXANDER', 'WREN']);
    expect(normalizeName('Ana - Maria')).toEqual(['ANA', 'MARIA']);
  });

  it('strips generational suffixes and titles', () => {
    expect(normalizeName('Martin Luther King Jr.')).toEqual(['MARTIN', 'LUTHER', 'KING']);
    expect(normalizeName('John Smith III')).toEqual(['JOHN', 'SMITH']);
    expect(normalizeName('Dr. Ada Lovelace')).toEqual(['ADA', 'LOVELACE']);
    expect(normalizeName('Henry Ford II')).toEqual(['HENRY', 'FORD']);
    expect(normalizeName('Thomas Vance IV')).toEqual(['THOMAS', 'VANCE']);
    expect(normalizeName('Mr Thomas Vance Sr')).toEqual(['THOMAS', 'VANCE']);
  });

  it('reports dropped titles/suffixes and allows keeping individual parts when genuinely part of a birth name', () => {
    expect(droppedNameParts('Sir John Smith Jr.')).toEqual(['Sir', 'Jr.']);
    expect(droppedNameParts('Ada Lovelace')).toEqual([]);
    expect(normalizeName('Sir John', { keepTitles: true })).toEqual(['SIR', 'JOHN']);
    expect(normalizeName('Sir', { keepTitles: true })).toEqual(['SIR']);
    expect(normalizeName('Sir', { keepParts: ['Sir'] })).toEqual(['SIR']);
    // Keeping "Sir" in "Sir Example Jr." restores "Sir" while still dropping "Jr.".
    expect(normalizeName('Sir Example Jr.', { keepParts: ['Sir'] })).toEqual(['SIR', 'EXAMPLE']);
    expect(normalizeName('Sir Example Jr.', { keepParts: ['Jr.'] })).toEqual(['EXAMPLE', 'JR']);
    const kept = numerologyProfile({ birthDate: '1990-05-03', fullName: 'Sir John Jr.', today: '2026-11-28', keepParts: ['Sir'] });
    expect(kept.name!.parts.map((part) => part.letters)).toEqual(['SIR', 'JOHN']);
    // Repeated title/suffix spellings are identified by 0-based letter-bearing position so one occurrence can be kept.
    expect(droppedNamePartEntries('Sir Sir Example Jr.')).toEqual([
      { raw: 'Sir', key: 'SIR', index: 0, occurrence: 1, occurrences: 2 },
      { raw: 'Sir', key: 'SIR', index: 1, occurrence: 2, occurrences: 2 },
      { raw: 'Jr.', key: 'JR', index: 3, occurrence: 1, occurrences: 1 },
    ]);
    expect(normalizeName('Sir Sir Example', { keepPartIndices: [1] })).toEqual(['SIR', 'EXAMPLE']);
    expect(normalizeName('123 Sir Sir Example', { keepPartIndices: [1] })).toEqual(['SIR', 'EXAMPLE']);
    const singleOccurrence = numerologyProfile({ birthDate: '1990-05-03', fullName: 'Sir Sir Example', today: '2026-11-28', keepPartIndices: [1] });
    const singleExpected = numerologyProfile({ birthDate: '1990-05-03', fullName: 'Sir Example', today: '2026-11-28', keepPartIndices: [0] });
    expect(singleOccurrence.name!.expression).toEqual(singleExpected.name!.expression);
    // Remapping Y overrides stays exact when keeping only one repeated occurrence.
    const remapped = remapYOverrides(
      'Sir Sir Yvonne',
      { keepPartIndices: [] },
      { keepPartIndices: [1] },
      [{ part: 0, index: 0, as: 'consonant' }],
    );
    expect(remapped).toEqual([{ part: 1, index: 0, as: 'consonant' }]);
  });

  it('remaps Y overrides onto retained parts when toggling keepTitles', () => {
    const initial = [
      { part: 0, index: 3, as: 'consonant' as const },
      { part: 1, index: 3, as: 'consonant' as const },
    ];
    const withTitles = remapYOverrides('Sir Tanya Kenyon Jr.', { keepTitles: false }, { keepTitles: true }, initial);
    expect(withTitles).toEqual([
      { part: 1, index: 3, as: 'consonant' },
      { part: 2, index: 3, as: 'consonant' },
    ]);
    const backWithout = remapYOverrides('Sir Tanya Kenyon Jr.', { keepTitles: true }, { keepTitles: false }, withTitles);
    expect(backWithout).toEqual(initial);
    // Applying the remapped overrides keeps Tanya and Kenyon's Y overrides intact after including "Sir" and "Jr.".
    const profile = numerologyProfile({
      birthDate: '1990-05-03',
      fullName: 'Sir Tanya Kenyon Jr.',
      today: '2026-11-28',
      keepTitles: true,
      yOverrides: withTitles,
    });
    expect(profile.name?.parts[1]?.cells[3]?.vowel).toBe(false);
    expect(profile.name?.parts[2]?.cells[3]?.vowel).toBe(false);
  });

  it('rejects letters that do not fold to A-Z', () => {
    for (const bad of ['Иван Петров', 'Γιώργος', 'محمد', '山田太郎', 'Anna Иванова']) {
      let caught: unknown;
      try {
        normalizeName(bad);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(NumerologyInputError);
      expect((caught as NumerologyInputError).code).toBe('unsupported-letters');
      expect((caught as NumerologyInputError).detail).toMatch(/^\p{L}$/u);
    }
  });

  it('names the first letter it cannot read', () => {
    let caught: unknown;
    try {
      normalizeName('Anna Иванова');
    } catch (error) {
      caught = error;
    }
    expect((caught as NumerologyInputError).detail).toBe('И');
    expect((caught as NumerologyInputError).message).toContain('"И" cannot be read');
  });

  it('rejects names with nothing left', () => {
    for (const bad of ['', '   ', '---', '123', 'Jr.', 'Dr. III']) {
      let caught: unknown;
      try {
        normalizeName(bad);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(NumerologyInputError);
      expect((caught as NumerologyInputError).code).toBe('empty-name');
    }
  });

  it('keeps the raw token next to its letters', () => {
    const parts = nameNumbers("Siobhán O'Connell").parts;
    expect(parts.map((p) => p.raw)).toEqual(['Siobhán', "O'Connell"]);
    expect(parts.map((p) => p.letters)).toEqual(['SIOBHAN', 'OCONNELL']);
  });

  it('lets a part with no vowels contribute 0', () => {
    const ng = nameNumbers('Ng');
    expect(ng.soulUrge.total).toBe(0);
    expect(ng.soulUrge.chain).toEqual([0]);
    expect(ng.expression.value).toBe(3);
    const two = nameNumbers('Ng Ann');
    expect(two.soulUrge.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

describe('dateNumbers', () => {
  it('rejects impossible and malformed dates', () => {
    for (const bad of [
      '2023-02-30', '2001-13-01', '2001-00-10', '2001-04-31', '1900-02-29', '2100-02-29',
      '0000-01-01', '1998-1-5', '15/10/1998', '19981015', 'yesterday', '', '2023-02-30T00:00',
    ]) {
      let caught: unknown;
      try {
        dateNumbers(bad);
      } catch (error) {
        caught = error;
      }
      expect(caught, bad).toBeInstanceOf(NumerologyInputError);
      expect((caught as NumerologyInputError).code).toBe('invalid-date');
    }
  });

  it('accepts leap days and echoes the ISO string', () => {
    expect(dateNumbers('2000-02-29').iso).toBe('2000-02-29');
    expect(dateNumbers('2024-02-29').iso).toBe('2024-02-29');
    expect(dateNumbers(' 1998-10-15 ').iso).toBe('1998-10-15');
  });

  it('flags the karmic-debt birthdays and no others', () => {
    const flagged: Array<[number, KarmicDebt]> = [[13, 13], [14, 14], [16, 16], [19, 19]];
    for (const [day, debt] of flagged) {
      expect(dateNumbers(`2000-01-${String(day).padStart(2, '0')}`).birthday.karmicDebt).toBe(debt);
    }
    for (let day = 1; day <= 31; day++) {
      if (day === 13 || day === 14 || day === 16 || day === 19) continue;
      expect(dateNumbers(`2000-01-${String(day).padStart(2, '0')}`).birthday.karmicDebt).toBeNull();
    }
  });

  it('keeps master units in the pinnacles but reduces them in the challenges', () => {
    // Decoz engine, 1975-11-11: month 11 + day 11 = 22, day 11 + year 22 = 33, 22 + 33 = 55 -> 1, month 11 + year 22 = 33.
    const d = dateNumbers('1975-11-11');
    expect(d.pinnacles).toEqual([22, 33, 1, 33]);
    expect(d.challenges).toEqual([0, 2, 2, 2]);
    expect(d.attitude).toBe(4);
  });
});

describe('personalCycles', () => {
  it('reduces every unit fully', () => {
    expect(personalCycles('1983-03-14', '2026-01-01').year).toBe(9);
    expect(personalCycles('2001-11-29', '2026-01-01').year).toBe(5);
    expect(personalCycles('1975-01-19', '2027-01-01').year).toBe(4);
  });

  it('validates both dates', () => {
    expect(() => personalCycles('1983-03-14', '2026-02-30')).toThrow(NumerologyInputError);
    expect(() => personalCycles('1983-02-30', '2026-01-01')).toThrow(NumerologyInputError);
  });
});

describe('numerologyProfile', () => {
  it('works without a name', () => {
    const p = numerologyProfile({ birthDate: '1998-10-15', today: '2026-09-07' });
    expect(p.name).toBeNull();
    expect(p.maturity).toBeNull();
    expect(p.karmicDebts).toEqual([16]);
    expect(p.personalCycles.forDate).toBe('2026-09-07');
  });

  it('treats a blank name as no name and an unusable one as an error', () => {
    expect(numerologyProfile({ birthDate: '1998-10-15', today: '2026-09-07', fullName: '   ' }).name).toBeNull();
    expect(() => numerologyProfile({ birthDate: '1998-10-15', today: '2026-09-07', fullName: 'Jr.' })).toThrow(
      NumerologyInputError,
    );
  });

  it('passes Y overrides through by part', () => {
    const p = numerologyProfile({
      birthDate: '1998-10-15',
      today: '2026-09-07',
      fullName: 'Tanya Kenyon',
      yOverrides: [{ part: 1, index: 3, as: 'consonant' }],
    });
    expect(p.name?.parts[0]?.cells[3]?.vowel).toBe(true);
    expect(p.name?.parts[1]?.cells[3]?.vowel).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Life Path facts across 1900..2099
// ---------------------------------------------------------------------------

const FACTS: { dates: number; byNumber: Record<string, { count: number; share: number; totals: Record<string, number> }> } = {
  dates: 73049,
  byNumber: {
    '1': { count: 8114, share: 11.11, totals: { '10': 3012, '19': 4174, '28': 687, '37': 227, '46': 7, '55': 7 } },
    '2': { count: 3650, share: 5, totals: { '20': 3650 } },
    '3': { count: 8116, share: 11.11, totals: { '3': 184, '12': 4051, '21': 3245, '30': 474, '39': 155, '48': 7 } },
    '4': { count: 5656, share: 7.74, totals: { '4': 272, '13': 4741, '31': 524, '40': 112, '49': 7 } },
    '5': { count: 8118, share: 11.11, totals: { '5': 678, '14': 4697, '23': 2211, '32': 456, '41': 69, '50': 7 } },
    '6': { count: 7725, share: 10.58, totals: { '6': 885, '15': 5135, '24': 1629, '42': 69, '51': 7 } },
    '7': { count: 8117, share: 11.11, totals: { '7': 1385, '16': 4911, '25': 1367, '34': 447, '52': 7 } },
    '8': { count: 8117, share: 11.11, totals: { '8': 1813, '17': 4894, '26': 1087, '35': 290, '44': 26, '53': 7 } },
    '9': { count: 8116, share: 11.11, totals: { '9': 2383, '18': 4578, '27': 824, '36': 317, '45': 14 } },
    '11': { count: 4464, share: 6.11, totals: { '11': 3675, '29': 577, '38': 198, '47': 14 } },
    '22': { count: 2463, share: 3.37, totals: { '22': 2463 } },
    '33': { count: 393, share: 0.54, totals: { '33': 393 } },
  },
};

describe('lifePathDistribution', () => {
  const stats = lifePathDistribution();

  it('covers all 73049 dates', () => {
    const total = Object.values(stats).reduce((s, entry) => s + entry.count, 0);
    expect(total).toBe(FACTS.dates);
    expect(Object.keys(stats).map(Number).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]);
  });

  for (const [key, expected] of Object.entries(FACTS.byNumber)) {
    const number = Number(key) as CoreNumber;
    it(`reproduces the facts for ${key}`, () => {
      const entry = stats[number];
      expect(entry.number).toBe(number);
      expect(entry.count).toBe(expected.count);
      expect(entry.share).toBe(expected.share);
      const totals: Record<string, number> = {};
      for (const [t, n] of Object.entries(entry.totals)) totals[t] = n;
      expect(totals).toEqual(expected.totals);
    });
  }

  it('lists the totals that reduce to a number, ascending', () => {
    expect(totalsReducingTo(2)).toEqual([20]);
    expect(totalsReducingTo(1)).toEqual([10, 19, 28, 37, 46, 55]);
    expect(totalsReducingTo(11)).toEqual([11, 29, 38, 47]);
    expect(totalsReducingTo(33)).toEqual([33]);
  });

  it('honours a custom year range', () => {
    const one = lifePathDistribution(2024, 2024);
    expect(Object.values(one).reduce((s, entry) => s + entry.count, 0)).toBe(366);
    expect(Math.round(Object.values(one).reduce((s, entry) => s + entry.share, 0))).toBe(100);
    expect(() => lifePathDistribution(2030, 2020)).toThrow(RangeError);
    expect(() => totalsReducingTo(10 as CoreNumber)).toThrow(RangeError);
  });
});

describe('nextDatesWithLifePath', () => {
  it('includes the starting date when it qualifies and stays ascending', () => {
    const dates = nextDatesWithLifePath(7, '1998-10-15', 5);
    expect(dates).toHaveLength(5);
    expect(dates[0]).toBe('1998-10-15');
    for (const iso of dates) expect(dateNumbers(iso).lifePath.value).toBe(7);
    for (let i = 1; i < dates.length; i++) expect(dates[i] > (dates[i - 1] as string)).toBe(true);
  });

  it('skips the starting date when it does not qualify', () => {
    const dates = nextDatesWithLifePath(2, '1998-10-15', 3);
    expect(dates[0]).not.toBe('1998-10-15');
    expect(dates[0]! > '1998-10-15').toBe(true);
    for (const iso of dates) expect(dateNumbers(iso).lifePath.value).toBe(2);
    const between = nextDatesWithLifePath(2, '1998-10-16', 1)[0];
    expect(between).toBe(dates[0]);
  });

  it('finds the master numbers and skips no qualifying date on the way', () => {
    const first33 = nextDatesWithLifePath(33, '2026-01-01', 1)[0] as string;
    expect(dateNumbers(first33).lifePath.value).toBe(33);
    for (let iso = '2026-01-01'; iso < first33; iso = nextIso(iso)) {
      expect(dateNumbers(iso).lifePath.value).not.toBe(33);
    }
    // September 2000: 9 + 11 + 2 = 22 on the 11th and the 29th, nothing else that month.
    expect(nextDatesWithLifePath(22, '2000-09-11', 2)).toEqual(['2000-09-11', '2000-09-29']);
    expect(nextDatesWithLifePath(22, '2000-09-12', 1)).toEqual(['2000-09-29']);
  });

  it('returns nothing for a zero or negative count and validates the start', () => {
    expect(nextDatesWithLifePath(7, '1998-10-15', 0)).toEqual([]);
    expect(nextDatesWithLifePath(7, '1998-10-15', -3)).toEqual([]);
    expect(() => nextDatesWithLifePath(7, '1998-02-30', 1)).toThrow(NumerologyInputError);
    expect(() => nextDatesWithLifePath(12 as CoreNumber, '1998-10-15', 1)).toThrow(RangeError);
  });
});

function nextIso(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('lifePathExample', () => {
  it('writes the arithmetic line', () => {
    expect(lifePathExample('1998-10-15')).toBe('10 → 1 · 15 → 6 · 1998 → 27 → 9 · 1 + 6 + 9 = 16 → 7');
    expect(lifePathExample('1983-03-14')).toBe('3 · 14 → 5 · 1983 → 21 → 3 · 3 + 5 + 3 = 11');
    expect(lifePathExample('2001-11-29')).toBe('11 · 29 → 11 · 2001 → 3 · 11 + 11 + 3 = 25 → 7');
    expect(lifePathExample('1990-08-22')).toBe('8 · 22 · 1990 → 19 → 10 → 1 · 8 + 22 + 1 = 31 → 4');
  });

  it('validates the date', () => {
    expect(() => lifePathExample('2001-13-01')).toThrow(NumerologyInputError);
  });
});
