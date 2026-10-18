import { timelineLine } from '../src/lib/events/format';
import type { CatalogEvent } from '../src/lib/events/types';
import { EVENT_READING_REVISION, REVISED_EVENT_READINGS } from '../src/lib/events/revised-readings';

export const EVENTS_PUBLICATION_SCHEMA = 'zodiacs.events-publication.v1' as const;
export const EVENTS_PUBLICATION_FROM = '2026-01-01T00:00:00.000Z';
export const EVENTS_PUBLICATION_TO = '2028-01-01T00:00:00.000Z';
export const EVENTS_PUBLICATION_LASTMOD = '2026-10-16';

/** A page's date: the later of the publication's revision and its reading's own revision. */
export function eventLastModified(id: string): string {
  return Object.hasOwn(REVISED_EVENT_READINGS, id) && EVENT_READING_REVISION > EVENTS_PUBLICATION_LASTMOD
    ? EVENT_READING_REVISION : EVENTS_PUBLICATION_LASTMOD;
}

type Catalog = {
  events: CatalogEvent[];
  pages: CatalogEvent[];
};

const anchorIso = (event: CatalogEvent): string => (
  event.facts.at ?? event.facts.start ?? ''
);

const insidePublicationWindow = (event: CatalogEvent): boolean => {
  const anchor = anchorIso(event);
  return anchor >= EVENTS_PUBLICATION_FROM && anchor < EVENTS_PUBLICATION_TO;
};

const compareEvent = (left: CatalogEvent, right: CatalogEvent): number => (
  anchorIso(left).localeCompare(anchorIso(right))
  || left.facts.id.localeCompare(right.facts.id)
);

const publicDescriptor = (event: CatalogEvent) => ({
  id: event.facts.id,
  path: event.facts.path,
  title: event.facts.title,
  anchor: anchorIso(event),
  family: event.facts.family,
  subtype: event.facts.subtype,
  bodies: event.facts.bodies,
  signs: event.facts.signs,
  summary: timelineLine(event.facts),
  lastModified: eventLastModified(event.facts.id),
});

/**
 * Build the one explicit launch receipt consumed by indexing, cards, feeds,
 * navigation, and release tests. New catalog facts never publish merely by
 * appearing in a generated month: every standalone page inside the approved
 * 2026–2027 window must also have authored interpretation. The catalog reads
 * this committed receipt to decide eligibility, so generation cannot depend
 * on catalog eligibility without creating a circular launch gate.
 */
export function buildEventsPublication(catalog: Catalog) {
  const windowPages = catalog.pages
    .filter(insidePublicationWindow)
    .sort(compareEvent);

  const incomplete = windowPages.filter((event) => !event.interpretation);
  if (incomplete.length > 0) {
    throw new Error(
      `Events publication is missing ${incomplete.length} interpretation(s): ${incomplete
        .slice(0, 12)
        .map((event) => event.facts.id)
        .join(', ')}`,
    );
  }

  const pageIds = new Set(windowPages.map((event) => event.facts.id));
  const pagePaths = new Set(windowPages.map((event) => event.facts.path));
  const timeline = catalog.events
    .filter(insidePublicationWindow)
    // Cycle spans are represented by their exact station rows on the hub and
    // in the feed; the cycle pages remain available through those links.
    .filter((event) => event.facts.family !== 'retrograde')
    // Standalone facts must be approved pages. Stations are factual rows that
    // link to the already-indexed retrograde tables rather than new pages.
    .filter((event) => (
      event.facts.family === 'station'
        ? pagePaths.has(event.facts.path) || event.facts.path.startsWith('/retrogrades/#retrograde-')
        : pageIds.has(event.facts.id)
    ))
    .sort(compareEvent);

  return {
    schema: EVENTS_PUBLICATION_SCHEMA,
    locale: 'en',
    window: {
      from: EVENTS_PUBLICATION_FROM,
      to: EVENTS_PUBLICATION_TO,
    },
    lastModified: EVENTS_PUBLICATION_LASTMOD,
    hub: {
      path: '/events/',
      title: 'Sky events',
      card: '/assets/og/v2/events/index.png',
      indexEligible: true,
    },
    pages: windowPages.map((event) => ({
      ...publicDescriptor(event),
      card: `/assets/og/v2/events/${event.facts.id}.png`,
    })),
    timeline: timeline.map(publicDescriptor),
  };
}
