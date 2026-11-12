/**
 * The words and dashes no heads-up calendar string may carry
 * (src/lib/sky-heads-up.ts refuses to build with one, and
 * src/lib/sky-heads-up.copy.test.ts checks every string it emits).
 *
 * This file is the list itself, not copy, so the consumer boundary scanner
 * skips it (NON_SURFACE_SOURCE in scripts/consumer-boundary-lib.mjs), as it
 * skips the Guide's safety list.
 */

/**
 * Words no heads-up string may carry, on top of the consumer boundary
 * scanner: the feed is about the sky, never about money or what to do.
 * Matched case-insensitively on word boundaries; a phrase matches as written.
 */
export const EVENT_COPY_BANNED = [
  'price', 'prices', 'stock', 'stocks', 'bottom', 'dip', 'dips', 'rally', 'crash',
  'bull', 'bullish', 'bear', 'bearish', 'invest', 'investing', 'investment', 'investor',
  'trade', 'trades', 'trading', 'trader', 'buy', 'buying', 'sell', 'selling',
  'portfolio', 'profit', 'profits', 'bitcoin', 'S&P', 'Nasdaq', 'market', 'markets',
  'financial', 'good time to',
] as const;

/** Dash characters the copy rules forbid: figure dash, en dash, em dash, horizontal bar. */
export const FORBIDDEN_DASHES = /[\u2012-\u2015]/u;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const BANNED_PATTERNS = EVENT_COPY_BANNED.map((word) => ({
  word,
  pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, 'iu'),
}));

/** The banned words and dashes a string carries, for the copy tests and the build guard. */
export function headsUpCopyProblems(text: string): string[] {
  const problems = BANNED_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ word }) => `banned word "${word}"`);
  if (FORBIDDEN_DASHES.test(text)) problems.push('dash U+2012 to U+2015');
  return problems;
}

