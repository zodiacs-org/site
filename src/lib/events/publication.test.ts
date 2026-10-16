import { describe, expect, it } from 'vitest';
import {
  futurePublishedEvents,
  singlePublishedEventSign,
  upcomingPublishedEvents,
  type EventsPublication,
} from './publication';

const descriptor = (id: string, anchor: string, family = 'aspect') => ({
  id,
  path: `/events/${id}/`,
  title: id,
  anchor,
  family,
  subtype: 'exact',
  bodies: ['Jupiter', 'Saturn'],
  signs: ['leo', 'aries'],
  summary: 'A published event.',
  lastModified: '2026-07-20',
  card: `/assets/og/v2/events/${id}.png`,
});

const publication = {
  schema: 'zodiacs.events-publication.v1',
  locale: 'en',
  window: { from: '2026-01-01T00:00:00.000Z', to: '2028-01-01T00:00:00.000Z' },
  lastModified: '2026-07-20',
  hub: {
    path: '/events/', title: 'Sky events', card: '/assets/og/v2/events/index.png', indexEligible: true,
  },
  pages: [
    descriptor('today', '2026-07-20T12:00:00.000Z'),
    descriptor('eclipse', '2026-07-22T17:00:00.000Z', 'eclipse'),
    descriptor('paired-lunation', '2026-07-22T16:00:00.000Z', 'lunation'),
    descriptor('fifth-day', '2026-07-25T23:59:00.000Z'),
    descriptor('too-late', '2026-07-26T00:00:00.000Z'),
  ],
  timeline: [],
} satisfies EventsPublication;

describe('events publication cross-links', () => {
  it('returns only today through five days out and caps the list', () => {
    expect(upcomingPublishedEvents('2026-07-20', { limit: 10 }, publication).map((event) => event.id))
      .toEqual(['today', 'eclipse', 'fifth-day']);
    expect(upcomingPublishedEvents('2026-07-20', { limit: 2 }, publication).map((event) => event.id))
      .toEqual(['today', 'eclipse']);
  });

  it('prefers the eclipse page over its same-day lunation page', () => {
    expect(upcomingPublishedEvents('2026-07-20', { limit: 10 }, publication)
      .some((event) => event.id === 'paired-lunation')).toBe(false);
  });

  it('selects only genuinely future events for an Ahead window', () => {
    expect(futurePublishedEvents('2026-07-20', { days: 5, limit: 10 }, publication)
      .map((event) => event.id)).toEqual(['eclipse', 'fifth-day']);
    expect(futurePublishedEvents('2026-07-20', { days: 1, limit: 10 }, publication)).toEqual([]);
  });

  it('never collapses a multi-sign event into one chart house', () => {
    expect(singlePublishedEventSign({ ...descriptor('single', '2026-07-21T00:00:00Z'), signs: ['leo'] }))
      .toBe('leo');
    expect(singlePublishedEventSign({ ...descriptor('same', '2026-07-21T00:00:00Z'), signs: ['leo', 'leo'] }))
      .toBe('leo');
    expect(singlePublishedEventSign({
      ...descriptor('aspect', '2026-07-21T00:00:00Z'), signs: ['leo', 'aries'],
    })).toBeNull();
  });
});

describe('bounded event reading revision', () => {
  it('revises exactly five readings and dates every page from the latest revision without changing factual descriptors', async () => {
    const { buildEventsPublication, EVENTS_PUBLICATION_LASTMOD, eventLastModified } = await import('../../../scripts/events-publication-lib');
    const { eventsCatalog } = await import('./catalog');
    const { EVENT_READING_REVISION, REVISED_EVENT_READINGS } = await import('./revised-readings');
    const { eventsPublication } = await import('./publication');
    const generated = buildEventsPublication(eventsCatalog());
    expect(generated).toEqual(eventsPublication);
    expect(Object.keys(REVISED_EVENT_READINGS).sort()).toEqual([
      'eclipse-2026-08-28', 'jupiter-enters-leo-2026-06-30', 'neptune-sextile-pluto-2026-09-16',
      'new-moon-2026-09-11', 'venus-retrograde-2026-10-03',
    ]);
    // The October 16 copy revision (dash punctuation) postdates the five
    // September 6 reading revisions, so every page carries the publication date.
    expect(EVENT_READING_REVISION < EVENTS_PUBLICATION_LASTMOD).toBe(true);
    expect(generated.timeline.filter((row) => row.id in REVISED_EVENT_READINGS)).toHaveLength(4);
    for (const row of [...generated.pages, ...generated.timeline]) {
      expect(row.lastModified).toBe(eventLastModified(row.id));
      expect(row.lastModified).toBe(EVENTS_PUBLICATION_LASTMOD);
      expect(row).not.toHaveProperty('publishedAt');
    }
  });
});
