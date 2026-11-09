import { describe, expect, it } from 'vitest';
import { getNumerology, numerologyData, numerologyInput, NUMEROLOGY_SEPARATE, type NumerologyInput } from './numerology';
import { POSITION_READINGS } from '../../data/numerology-readings';
import { CORE_NUMBERS, KARMIC_DEBT_MEANINGS, NUMBER_MEANINGS, PERSONAL_YEAR_MEANINGS } from '../../data/numerology-meanings';

const context = { currentYear: 2026, currentYearFrom: 'utc' as const, origin: 'https://zodiacs.org' };
const run = (args: NumerologyInput) => {
  const parsed = numerologyInput.parse(args);
  const result = getNumerology(parsed, context);
  numerologyData.parse(result.data);
  return result;
};

/**
 * Known answers, each worked by hand from the Pythagorean table (A to I = 1 to 9, J to R = 1 to 9, S to Z = 1 to 8)
 * and written out here, so the test does not lean on the engine it checks.
 */
describe('get_numerology known answers', () => {
  it('John Smith, 29 November 1990', () => {
    // Month 11 (master, kept), day 29 -> 11 (kept), year 1990 -> 19 -> 10 -> 1; 11 + 11 + 1 = 23 -> 5.
    // JOHN: 1+6+8+5 = 20 -> 2; vowel O = 6; consonants J H N = 1+8+5 = 14 -> 5.
    // SMITH: 1+4+9+2+8 = 24 -> 6; vowel I = 9; consonants S M T H = 1+4+2+8 = 15 -> 6.
    // Expression 2 + 6 = 8; Soul Urge 6 + 9 = 15 -> 6; Personality 5 + 6 = 11, a master number.
    // Personal Year 2026: 2 + 2 + (2026 -> 10 -> 1) = 5.
    const { data } = run({ birthDate: '1990-11-29', name: 'John Smith', year: 2026 });
    expect([data.lifePath.number, data.lifePath.chain, data.lifePath.master]).toEqual([5, '23/5', false]);
    expect([data.expression?.number, data.expression?.chain]).toEqual([8, '8']);
    expect([data.soulUrge?.number, data.soulUrge?.chain]).toEqual([6, '15/6']);
    expect([data.personality?.number, data.personality?.chain, data.personality?.master]).toEqual([11, '11', true]);
    expect(data.personalYear).toMatchObject({ year: 2026, number: 5, chain: '5', yearFrom: 'request' });
    // The 14 inside JOHN's consonants is a part total, not a core position's chain, so no debt.
    expect(data.karmicDebts).toEqual([]);
  });

  it('the site\'s own worked example: Tobias Alexander Wren, 14 March 1983', () => {
    // From /numerology/: Life Path 3 + 5 + 3 = 11; Expression 3 + 3 + 6 = 12/3; Soul Urge 15/6; Personality 15/6; Birthday 14/5 is a karmic debt.
    const { data } = run({ birthDate: '1983-03-14', name: 'Tobias Alexander Wren', year: 2026 });
    expect([data.lifePath.number, data.lifePath.chain, data.lifePath.master]).toEqual([11, '11', true]);
    expect(data.expression?.chain).toBe('12/3');
    expect(data.soulUrge?.chain).toBe('15/6');
    expect(data.personality?.chain).toBe('15/6');
    expect(data.karmicDebts.map(({ number, carriedBy }) => [number, carriedBy])).toEqual([[14, ['birthday']]]);
  });

  it('keeps 22 and 33 as master numbers in the Life Path', () => {
    // 9 + 11 + (1964 -> 20 -> 2) = 22.
    expect(run({ birthDate: '1964-09-11' }).data.lifePath).toMatchObject({ number: 22, chain: '22', master: true, title: 'The master builder' });
    // 11 + (29 -> 11) + (1910 -> 11) = 33.
    expect(run({ birthDate: '1910-11-29' }).data.lifePath).toMatchObject({ number: 33, chain: '33', master: true, title: 'The teacher' });
    // 10 -> 1, 15 -> 6, 1998 -> 27 -> 9; 1 + 6 + 9 = 16 -> 7, which carries the 16 karmic debt.
    const fifteenOctober = run({ birthDate: '1998-10-15' }).data;
    expect([fifteenOctober.lifePath.number, fifteenOctober.lifePath.chain]).toEqual([7, '16/7']);
    expect(fifteenOctober.karmicDebts.map((debt) => debt.number)).toEqual([16]);
  });

  it('reduces the Personal Year fully and shows an 11 on the way', () => {
    // 2 + 2 + (2032 -> 7) = 11 -> 2.
    expect(run({ birthDate: '1990-11-29', year: 2032 }).data.personalYear).toMatchObject({ number: 2, chain: '11/2' });
    // 2 + 2 + (2027 -> 11 -> 2) = 6.
    expect(run({ birthDate: '1990-11-29', year: 2027 }).data.personalYear).toMatchObject({ number: 6, chain: '6' });
    // Without a year, the current year from the context, and where it came from.
    expect(run({ birthDate: '1990-11-29' }).data.personalYear).toMatchObject({ year: 2026, yearFrom: 'utc' });
  });

  it('gives the date numbers alone without a name, and is the same every time', () => {
    const { data } = run({ birthDate: '1990-11-29' });
    expect([data.expression, data.soulUrge, data.personality]).toEqual([null, null, null]);
    expect(JSON.stringify(run({ birthDate: '1990-11-29', name: 'John Smith' }))).toBe(JSON.stringify(run({ birthDate: '1990-11-29', name: 'John Smith' })));
  });

  it('folds accents and gives a name with no vowels a 0, not a crash', () => {
    expect(run({ birthDate: '1990-11-29', name: 'Renée' }).data.expression?.chain).toBe(run({ birthDate: '1990-11-29', name: 'Renee' }).data.expression?.chain);
    expect(run({ birthDate: '1990-11-29', name: 'Ng' }).data.soulUrge).toMatchObject({ number: 0, title: 'No value' });
  });

  it('refuses unreadable details with fixed sentences that repeat nothing from the request', () => {
    expect(() => run({ birthDate: '1990-02-30' })).toThrow('birthDate must be a real calendar date, such as 1990-05-03.');
    let message = '';
    try { run({ birthDate: '1990-11-29', name: 'Ψάπφω' }); } catch (error) { message = (error as Error).message; }
    expect(message).toMatch(/^name can be read only in the Latin alphabet/u);
    for (const letter of 'Ψάπφω') expect(message).not.toContain(letter);
    expect(() => run({ birthDate: '1990-11-29', name: '-- ,' })).toThrow(/^name must contain at least one letter/u);
  });
});

describe('get_numerology privacy', () => {
  it('returns neither the name nor the birth date, and links carry the Life Path number at most', () => {
    const result = run({ birthDate: '1987-04-23', name: 'Marguerite Okonkwo-Bellweather', year: 2026 });
    const text = JSON.stringify(result);
    for (const fragment of ['Marguerite', 'MARGUERITE', 'Okonkwo', 'OKONKWO', 'Bellweather', 'BELLWEATHER', '1987', '04-23', '1987-04-23', '23 April']) expect(text).not.toContain(fragment);
    for (const link of result.links) {
      expect(new URL(link.url).search).toBe('');
      expect(new URL(link.url).hash).toBe('');
      expect(link.url).toMatch(/^https:\/\/zodiacs\.org\/numerology\/(?:life-path\/(?:[1-9]|11|22|33)\/)?$/u);
    }
  });
});

describe('the numerology copy', () => {
  /**
   * Work, money and wellbeing are allowed as the tradition reads them. Still not allowed: price, stock or coin calls,
   * buy or sell signals, diagnoses or medical timing, death predictions, and saying a legal matter will be won or lost.
   */
  const DISALLOWED = /\b(?:stocks?|share prices?|crypto\w*|tokens?|coins?|bitcoin|price targets?|buy|sell|selling|diagnos\w*|prognos\w*|surgery|death|die|dies|dying|dead|lawsuit|verdict|(?:will|going to) (?:win|lose)|lottery|gambl\w*)\b/iu;
  const texts = [
    ...Object.values(POSITION_READINGS).flatMap((readings) => Object.values(readings)),
    ...Object.values(PERSONAL_YEAR_MEANINGS),
    ...CORE_NUMBERS.flatMap((number) => [NUMBER_MEANINGS[number].summary, ...NUMBER_MEANINGS[number].keywords]),
    ...Object.values(KARMIC_DEBT_MEANINGS),
    NUMEROLOGY_SEPARATE,
  ];

  it('has a reading for every core number in all four positions', () => {
    for (const readings of Object.values(POSITION_READINGS)) expect(Object.keys(readings).map(Number).sort((a, b) => a - b)).toEqual([...CORE_NUMBERS]);
  });

  it('has no em or en dashes, and no price call, buy or sell signal, diagnosis, death prediction or legal verdict', () => {
    for (const text of texts) {
      expect(text, text).not.toMatch(/[–—]/u);
      expect(text, text).not.toMatch(DISALLOWED);
    }
  });

  it('reads work, money and wellbeing where the tradition does', () => {
    expect(POSITION_READINGS.lifePath[8]).toContain('a strong head for money and business');
    expect(PERSONAL_YEAR_MEANINGS[8]).toContain('a strong year for earnings and promotion');
    expect(PERSONAL_YEAR_MEANINGS[4]).toContain('health');
  });

  it('says in every answer that numerology is separate from astrology', () => {
    const { data } = run({ birthDate: '1990-11-29' });
    expect(data.separateFromAstrology).toMatch(/separate tradition from astrology/u);
    // The mandatory reflection line is gone (the rule of 9 November 2026); the note says what is exact and whose meanings these are.
    expect(data.note).not.toMatch(/reflection/u);
    expect(data.note).toContain('The arithmetic is exact and repeatable.');
  });
});
