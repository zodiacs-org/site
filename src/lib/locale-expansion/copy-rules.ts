/**
 * Shared copy rules for every string the locale expansion prints, in the
 * manner of the seasons and year-sky locale tests: no dashes, no "undefined",
 * no leftover English, and clear of advice the site never gives (investing,
 * betting, guarantees, health predictions) and of market or crypto words.
 * Money as a life area ("el dinero compartido") is allowed: the existing
 * daily readings name it the same way.
 */
import type { ExpansionLocale } from './horoscope/types';

export const DASHES = /[\u2012-\u2015]/u;

export const BANNED: Record<ExpansionLocale, RegExp> = {
  es: /\b(invers\w*|apuesta\w*|lotería|garantí\w*|cripto\w*|tokens?|mercad\w*|bolsa de valores|diagnóstic\w*|enfermedad\w*|curar\w*)\b/iu,
  pt: /\b(investim\w*|investir|aposta\w*|loteria|garanti\w*|cripto\w*|tokens?|mercad\w*|bolsa de valores|diagnóstic\w*|doença\w*|curar\w*)\b/iu,
  fr: /\b(investiss\w*|investir|pari|paris sportifs|loterie|garanti\w*|crypto\w*|tokens?|jetons?|marchés?|bourse|diagnostic\w*|maladie\w*|guérir)\b/iu,
  it: /\b(investim\w*|investire|scommess\w*|lotteria|garanzi\w*|garantit\w*|cripto\w*|tokens?|gettoni?|mercat\w*|borsa valori|diagnos\w*|malatti\w*|guarire)\b/iu,
  ru: /(инвест\p{L}*|ставк\p{L}*|лотере\p{L}*|гарант\p{L}*|крипто\p{L}*|токен\p{L}*|рын\p{L}*|бирж\p{L}*|диагноз\p{L}*|болезн\p{L}*)/iu,
};

/** Common English words that should never survive in localized prose. */
export const ENGLISH_LEFTOVER = /(?:^|[\s(])(?:the|and|your|with|this|that|horoscope|week|month|today|tomorrow)(?=[\s,.;:)!?]|$)/u;
/** "horoscope" is also the French word. */
const ENGLISH_LEFTOVER_FR = /(?:^|[\s(])(?:the|and|your|with|this|that|week|month|today|tomorrow)(?=[\s,.;:)!?]|$)/u;

export function copyProblems(locale: ExpansionLocale, text: string): string[] {
  const problems: string[] = [];
  if (DASHES.test(text)) problems.push('dash');
  if (/undefined|NaN|\[object Object\]|\$\{/u.test(text)) problems.push('template leak');
  if (BANNED[locale].test(text)) problems.push(`banned word: ${text.match(BANNED[locale])?.[0]}`);
  const leftover = locale === 'fr' ? ENGLISH_LEFTOVER_FR : ENGLISH_LEFTOVER;
  if (leftover.test(text)) problems.push(`English leftover: ${text.match(leftover)?.[0].trim()}`);
  if (/\s{2,}|\s[,.;:]/u.test(text.replace(/ | /gu, ' ').replace(/ [;:?!]/gu, ''))) problems.push('spacing');
  return problems;
}
