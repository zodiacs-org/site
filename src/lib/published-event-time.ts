import publishedEventLinks from '../data/published-event-time-links.json';

const links: Readonly<Record<string, string>> = publishedEventLinks.keys;

/** The archived engine key for this event in the DE440 catalog. */
export function archivedEventKey(at: string, ...identity: string[]): string {
  return links[[...identity, at].join('|')] ?? at;
}
