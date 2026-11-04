/**
 * Consumer text in tool results uses commas, colons and the word "to".
 * En dashes (U+2013) and em dashes (U+2014) are rewritten here, on the way
 * out, so a directory string or a published reading cannot carry one into
 * an answer. The minus sign (U+2212) and arrows are left as they are.
 * Tool definitions are not results, and this function is not applied to them.
 */
export function plainDashes(text: string): string {
  if (!text.includes('\u2013') && !text.includes('\u2014')) return text;
  return text
    .replace(/[ \t]*\u2014[ \t]*/gu, ', ')
    .replace(/[ \t]*\u2013[ \t]*/gu, ' to ')
    .replace(/[ \t]{2,}/gu, ' ')
    .replace(/\s+,/gu, ',')
    .replace(/,\s+/gu, ', ');
}

/** The same rewrite, through every string in a tool result. */
export function stripConsumerDashes<T>(value: T): T {
  if (typeof value === 'string') return plainDashes(value) as T;
  if (Array.isArray(value)) return value.map((item) => stripConsumerDashes(item)) as T;
  if (value && typeof value === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) copy[key] = stripConsumerDashes(item);
    return copy as T;
  }
  return value;
}

/** Birthplace coordinates in results and links: two decimal places, about a kilometre. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}
