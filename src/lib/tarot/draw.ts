/**
 * A fair tarot draw. Cards come from the full 78-card deck without replacement, by a partial Fisher-Yates shuffle,
 * and each card is upright or reversed with even odds. Every random choice comes from the platform's secure random
 * number generator (crypto.getRandomValues, in the browser and in Node), turned into a whole number below n by
 * rejection sampling, so no card is favoured by modulo bias.
 *
 * Nothing is seeded. drawTarot takes no seed and nothing from the person: no question, name or birth detail can
 * shape the draw. The word source is a parameter of the internal helpers only so the tests can check the arithmetic
 * exhaustively; the published entry point always uses the secure source.
 */
import { TAROT_DECK, type TarotCard } from './deck';
import { SPREADS, type SpreadId, type SpreadPosition } from './spreads';

/** A source of uniformly random unsigned words of `bits` bits. */
export interface WordSource { bits: number; next: () => number }

/** The platform's secure random number generator, 32 bits at a time. */
export function secureWords(): WordSource {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: <T extends ArrayBufferView>(array: T) => T } }).crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('A secure random number generator is not available here.');
  const buffer = new Uint32Array(64);
  let index = buffer.length;
  return {
    bits: 32,
    next() {
      if (index === buffer.length) { cryptoApi.getRandomValues!(buffer); index = 0; }
      return buffer[index++];
    },
  };
}

/**
 * A whole number from 0 to n - 1, each equally likely. Words at or above the largest multiple of n that fits are
 * thrown away and drawn again, so every remainder has exactly the same number of words behind it.
 */
export function uniformBelow(n: number, source: WordSource): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** source.bits) throw new RangeError(`uniformBelow needs a whole number from 1 to 2^${source.bits}`);
  const range = 2 ** source.bits;
  const limit = range - (range % n);
  for (;;) {
    const word = source.next();
    if (word < limit) return word % n;
  }
}

/** The first `count` items of a uniformly random ordering of `items` (a partial Fisher-Yates shuffle). */
export function sampleWithoutReplacement<T>(items: readonly T[], count: number, source: WordSource): T[] {
  if (!Number.isInteger(count) || count < 0 || count > items.length) throw new RangeError('count must be a whole number no larger than the deck');
  const pool = [...items];
  for (let i = 0; i < count; i++) {
    const j = i + uniformBelow(pool.length - i, source);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export type Orientation = 'upright' | 'reversed';
export interface DrawnCard { position: SpreadPosition; card: TarotCard; orientation: Orientation }

/** Lays out a spread from the given source. Internal: drawTarot is the only caller outside the tests. */
export function layOut(spread: SpreadId, reversals: boolean, source: WordSource): DrawnCard[] {
  const { positions } = SPREADS[spread];
  const cards = sampleWithoutReplacement(TAROT_DECK, positions.length, source);
  return positions.map((position, index) => ({
    position,
    card: cards[index],
    orientation: reversals && uniformBelow(2, source) === 1 ? 'reversed' : 'upright',
  }));
}

/**
 * A fresh, fair draw for the spread. With reversals off every card is upright; on (the default), each is reversed
 * with even odds. Unseeded: two calls are independent, and nothing about the person can be passed in.
 */
export function drawTarot(spread: SpreadId, reversals = true): DrawnCard[] {
  return layOut(spread, reversals, secureWords());
}
