/** The full and new Moons the English pages publish, as plain facts for the localized pages. */
import { eventsCatalog } from '../../events/catalog';
import { publishedEventById } from '../../events/publication';
import type { LunationFacts, LunationKind } from './types';

export interface LunationEntry {
  date: string;
  facts: LunationFacts;
  lastModified?: string;
}

export function lunations(kind: LunationKind): LunationEntry[] {
  const catalog = eventsCatalog();
  return catalog.pages
    // Only the dates the English edition publishes (events-publication.json), so every localized page has its English twin.
    .filter((event) => event.facts.family === 'lunation' && event.facts.subtype === kind && event.facts.at && publishedEventById.has(event.facts.id))
    .map((event) => {
      const eclipseLink = event.relations.eclipse && catalog.byId.get(event.relations.eclipse.id);
      return {
        date: event.facts.at!.slice(0, 10),
        lastModified: event.lastModified,
        facts: {
          kind,
          sign: event.facts.signs[0],
          at: event.facts.at!,
          degree: event.facts.degree ?? 0,
          eclipse: eclipseLink
            ? { type: eclipseLink.facts.subtype as 'solar' | 'lunar', kind: eclipseLink.facts.eclipseKind }
            : undefined,
        },
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}
