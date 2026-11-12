import { afterEach, describe, expect, it, vi } from 'vitest';
import { SUITS, SUIT_THEMES, TAROT_DECK } from './deck';
import { SPREADS, SPREAD_IDS } from './spreads';
import { TAROT_MEANINGS } from './meanings';
import { drawTarot, layOut, sampleWithoutReplacement, secureWords, uniformBelow, type WordSource } from './draw';

/** Every word of a small word size, once each, in order: an exhaustive source for checking the arithmetic. */
function everyWord(bits: number): WordSource & { used: () => number } {
  let n = 0;
  return { bits, next: () => n++ % 2 ** bits, used: () => n };
}

/** Pearson's chi-square statistic for observed counts against equal expected counts. */
function chiSquare(counts: readonly number[]): number {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const expected = total / counts.length;
  return counts.reduce((sum, count) => sum + (count - expected) ** 2 / expected, 0);
}
/**
 * A chi-square bound with a false-alarm rate far below one in a million, from the Wilson-Hilferty approximation at
 * z = 5.3, so a fair generator does not flake the suite. A biased draw (one card twice as likely) still fails it.
 */
function chiSquareBound(degrees: number): number {
  const z = 5.3;
  return degrees * (1 - 2 / (9 * degrees) + z * Math.sqrt(2 / (9 * degrees))) ** 3;
}

describe('the deck', () => {
  it('has the 78 cards: 22 Major Arcana and four suits of fourteen, with unique ids', () => {
    expect(TAROT_DECK).toHaveLength(78);
    expect(TAROT_DECK.filter((card) => card.arcana === 'major').map((card) => card.number)).toEqual([...Array(22).keys()]);
    for (const suit of SUITS) expect(TAROT_DECK.filter((card) => card.suit === suit).map((card) => card.number)).toEqual([...Array(14).keys()].map((n) => n + 1));
    expect(new Set(TAROT_DECK.map((card) => card.id)).size).toBe(78);
    expect(TAROT_DECK[0]).toMatchObject({ id: 'the-fool', name: 'The Fool', number: 0 });
    expect(TAROT_DECK[21]).toMatchObject({ id: 'the-world', name: 'The World' });
    expect(TAROT_DECK.at(-1)).toMatchObject({ id: 'king-of-pentacles', name: 'King of Pentacles', suit: 'pentacles', number: 14 });
  });

  it('has the spreads with one, three and ten positions', () => {
    expect(SPREAD_IDS.map((id) => SPREADS[id].positions.length)).toEqual([1, 3, 10]);
    expect(SPREADS['three-card'].positions.map((position) => position.name)).toEqual(['Past', 'Present', 'Future']);
  });
});

describe('a fair draw', () => {
  it('has no modulo bias: over every word of an 8-bit source, each value below n has the same number of words', () => {
    for (const n of [2, 3, 5, 7, 10, 22, 56, 77, 78, 100, 255, 256]) {
      const source = everyWord(8);
      const counts = new Array(n).fill(0);
      // 256 words in a row: the words at or above the largest multiple of n are rejected and none is reused.
      const limit = 256 - (256 % n);
      for (let i = 0; i < limit / n * n; i++) counts[uniformBelow(n, source)] += 1;
      expect(new Set(counts), `n = ${n}`).toEqual(new Set([Math.floor(256 / n)]));
      expect(source.used(), `n = ${n}`).toBeLessThanOrEqual(256);
    }
  });

  it('rejects the words that would bias the remainder and draws again', () => {
    // n = 78 with 8-bit words: 256 - 256 % 78 = 234, so 234..255 are thrown away.
    const words = [255, 234, 233];
    const source: WordSource = { bits: 8, next: () => words.shift()! };
    expect(uniformBelow(78, source)).toBe(233 % 78);
    expect(words).toEqual([]);
    expect(() => uniformBelow(0, source)).toThrow(RangeError);
    expect(() => uniformBelow(257, source)).toThrow(RangeError);
  });

  it('gives every ordering of a small deck exactly once from every combination of choices (Fisher-Yates)', () => {
    // A 4-card deck shuffled fully takes choices below 4, 3, 2 and 1; enumerate them all as words.
    const seen = new Map<string, number>();
    for (let a = 0; a < 4; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 2; c++) {
      const words = [a, b, c, 0];
      const order = sampleWithoutReplacement(['A', 'B', 'C', 'D'], 4, { bits: 32, next: () => words.shift()! }).join('');
      seen.set(order, (seen.get(order) ?? 0) + 1);
    }
    expect(seen.size).toBe(24);
    expect(new Set(seen.values())).toEqual(new Set([1]));
  });

  it('never repeats a card within a spread, and draws every spread at full size', () => {
    for (let i = 0; i < 300; i++) {
      for (const spread of SPREAD_IDS) {
        const drawn = drawTarot(spread);
        expect(drawn).toHaveLength(SPREADS[spread].positions.length);
        expect(new Set(drawn.map(({ card }) => card.id)).size).toBe(drawn.length);
      }
    }
  });

  it('gives each of the 78 cards an even chance in every position, from the secure source', () => {
    const draws = 78 * 600;
    const first = new Array(78).fill(0);
    const tenth = new Array(78).fill(0);
    const index = new Map(TAROT_DECK.map((card, at) => [card.id, at]));
    for (let i = 0; i < draws; i++) {
      const drawn = drawTarot('celtic-cross');
      first[index.get(drawn[0].card.id)!] += 1;
      tenth[index.get(drawn[9].card.id)!] += 1;
    }
    expect(chiSquare(first)).toBeLessThan(chiSquareBound(77));
    expect(chiSquare(tenth)).toBeLessThan(chiSquareBound(77));
    // The bound is tight enough to catch a real bias: one card twice as likely as the rest fails it.
    const skewed = [...first]; skewed[0] = first[0] * 2;
    expect(chiSquare(skewed)).toBeGreaterThan(chiSquareBound(77));
  }, 60_000);

  it('reverses about half the cards with reversals on, and none with them off', () => {
    let reversed = 0;
    const trials = 20_000;
    for (let i = 0; i < trials; i++) if (drawTarot('one-card')[0].orientation === 'reversed') reversed += 1;
    expect(chiSquare([reversed, trials - reversed])).toBeLessThan(chiSquareBound(1));
    for (let i = 0; i < 200; i++) for (const { orientation } of drawTarot('celtic-cross', false)) expect(orientation).toBe('upright');
  });
});

describe('no seeding', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('takes every random choice from crypto.getRandomValues, and nothing else', () => {
    const secure = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const weak = vi.spyOn(Math, 'random');
    drawTarot('celtic-cross');
    expect(secure).toHaveBeenCalled();
    expect(weak).not.toHaveBeenCalled();
  });

  it('accepts only the spread and the reversals switch: there is no seed to pass', () => {
    expect(drawTarot.length).toBeLessThanOrEqual(2);
    // The same spread twice is two independent draws: the full ten-card order repeats with odds of about 1 in 10^19.
    const a = drawTarot('celtic-cross').map(({ card, orientation }) => `${card.id}:${orientation}`).join();
    const b = drawTarot('celtic-cross').map(({ card, orientation }) => `${card.id}:${orientation}`).join();
    expect(a).not.toBe(b);
  });

  it('is the same arithmetic for a given word stream, so the layout is checkable', () => {
    const words = () => { let n = 0; return { bits: 32, next: () => (n++ * 2_654_435_761) % 2 ** 32 }; };
    expect(layOut('three-card', true, words())).toEqual(layOut('three-card', true, words()));
    expect(secureWords().bits).toBe(32);
  });
});

describe('the meanings', () => {
  /**
   * Work, money, wellbeing and agreements are allowed as the tradition reads them (the copy rule of 9 November 2026).
   * Still not allowed: price, stock or coin calls, buy or sell signals, diagnoses or medical timing, death predictions,
   * and saying a legal matter will be won or lost.
   */
  const DISALLOWED = /\b(?:stocks|stock (?:markets?|prices?|picks?|tips?)|share prices?|crypto\w*|tokens?|coins?|bitcoin|price targets?|buy|sell|selling|diagnos\w*|prognos\w*|surgery|pregnan\w*|death|die|dies|dying|dead|lawsuit|verdict|(?:will|going to) (?:win|lose)|lottery|gambl\w*)\b/iu;
  const FORECAST = /\byou will\b|\bwill happen\b|\bis coming\b|\bexpect to\b|\bsoon you\b/iu;

  it('has a meaning for every card, in deck order', () => {
    expect(Object.keys(TAROT_MEANINGS)).toEqual(TAROT_DECK.map((card) => card.id));
  });

  it('gives each card keywords, an upright and a reversed reading of 35 to 60 words, and one question', () => {
    for (const [id, meaning] of Object.entries(TAROT_MEANINGS)) {
      expect(meaning.keywords.length, id).toBeGreaterThanOrEqual(3);
      expect(meaning.keywords.length, id).toBeLessThanOrEqual(4);
      for (const text of [meaning.upright, meaning.reversed]) {
        const words = text.split(/\s+/u).length;
        expect(words, `${id}: ${text}`).toBeGreaterThanOrEqual(35);
        expect(words, `${id}: ${text}`).toBeLessThanOrEqual(60);
      }
      expect(meaning.question, id).toMatch(/\?$/u);
      expect(meaning.upright, id).not.toBe(meaning.reversed);
    }
  });

  it('has no dashes, no price call, buy or sell signal, diagnosis, death prediction or legal verdict', () => {
    const texts = [
      ...Object.values(TAROT_MEANINGS).flatMap((meaning) => [meaning.upright, meaning.reversed, meaning.question, ...meaning.keywords]),
      ...SPREAD_IDS.flatMap((id) => [SPREADS[id].name, SPREADS[id].description, ...SPREADS[id].positions.flatMap((position) => [position.name, position.prompt])]),
      ...Object.values(SUIT_THEMES).flatMap((suit) => [suit.name, suit.theme]),
    ];
    for (const text of texts) {
      expect(text, text).not.toMatch(/[–—]| - /u);
      expect(text, text).not.toMatch(DISALLOWED);
      expect(text, text).not.toMatch(FORECAST);
      expect(text, text).not.toMatch(/!/u);
    }
  });

  it('reads work, money, wellbeing and agreements where the tradition does', () => {
    expect(TAROT_MEANINGS['ace-of-pentacles'].upright).toContain('a good start for money and work');
    expect(TAROT_MEANINGS['four-of-swords'].upright).toContain('take rest seriously');
    expect(TAROT_MEANINGS.justice.upright).toContain('a good time to sign agreements');
    expect(TAROT_MEANINGS.temperance.upright).toContain('wellbeing');
  });

  it('writes the Death card about endings and change', () => {
    expect(TAROT_MEANINGS.death.keywords).toContain('endings');
    expect(TAROT_MEANINGS.death.upright).toMatch(/endings in the everyday sense/u);
  });
});
