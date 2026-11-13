/**
 * Small wording helpers every card shares. `plain` reads text the cards show
 * but do not own (published people copy, sign table ranges) with plain
 * punctuation: a dash between two values becomes "to", a dash between
 * clauses a comma, and a middle dot between list items a comma. The source
 * data keeps its own bytes.
 */
export function plain(text: string): string {
  return text
    .replace(/(\d°?′?)\s*[–—]\s*(\d)/gu, '$1 to $2')
    .replace(/([A-Z][a-z]{2} \d{1,2})\s+[–—]\s+([A-Z][a-z]{2} \d{1,2})/gu, '$1 to $2')
    .replace(/\s+[–—]\s+/gu, ', ')
    .replace(/(\S)—(\S)/gu, '$1, $2')
    .replace(/\s+·\s+/gu, ', ');
}

/** "a", "a and b", "a, b and c". */
export function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export const signName = (slug: string) => slug.charAt(0).toUpperCase() + slug.slice(1);
export const capital = (text: string) => text.replace(/^./u, (c) => c.toUpperCase());

const LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const FULL = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const civil = (date: string) => new Date(`${date.slice(0, 10)}T12:00:00Z`);

/** "Saturday, 12 June 2027", from parts so every runtime puts the comma in the same place. */
export function longDate(date: string): string {
  const parts = Object.fromEntries(LONG.formatToParts(civil(date)).map((part) => [part.type, part.value]));
  return `${parts.weekday}, ${parts.day} ${parts.month} ${parts.year}`;
}
/** "15 March 1997" for a civil date. */
export const fullDate = (date: string) => FULL.format(civil(date));
/** "23 Apr 2026" for an instant, read in UTC as the tools give it. */
export const shortDate = (iso: string) => SHORT.format(new Date(iso));

/** "from 1 to 30 June 2027", "from 28 May to 3 June 2027", "from 20 December 2026 to 5 January 2027". */
export function dateRange(from: string, to: string): string {
  const [a, b] = [fullDate(from).split(' '), fullDate(to).split(' ')];
  if (a[2] !== b[2]) return `from ${a.join(' ')} to ${b.join(' ')}`;
  if (a[1] !== b[1]) return `from ${a[0]} ${a[1]} to ${b.join(' ')}`;
  return `from ${a[0]} to ${b.join(' ')}`;
}
