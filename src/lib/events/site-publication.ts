/**
 * The event pages the site publishes: the 2026 to 2027 receipt joined with
 * the 2028 to 2030 one. Site pages read this module; the AI tools read
 * ./publication, whose receipt they bundle byte for byte.
 */
import first from '../../data/events-publication.json';
import extension from '../../data/events-publication-2028-2030.json';
import { mergeEventPublications } from './merge-publications.mjs';
import {
  futurePublishedEvents as futureIn,
  upcomingPublishedEvents as upcomingIn,
  type EventsPublication,
  type PublishedEventDescriptor,
} from './publication';

export { singlePublishedEventSign } from './publication';
export type { EventsPublication, PublishedEventDescriptor } from './publication';

export const eventsPublication = mergeEventPublications([
  first as EventsPublication,
  extension as EventsPublication,
]);
export const publishedEventPages = eventsPublication.pages;
export const publishedEventById = new Map(
  publishedEventPages.map((event) => [event.id, event] as const),
);

/** Standalone, approved event pages from today through five calendar days out. */
export function upcomingPublishedEvents(
  date: string,
  options: { days?: number; limit?: number } = {},
  publication: EventsPublication = eventsPublication,
): PublishedEventDescriptor[] {
  return upcomingIn(date, options, publication);
}

/** Published event pages after the edition date, through `days` calendar days out. */
export function futurePublishedEvents(
  date: string,
  options: { days?: number; limit?: number } = {},
  publication: EventsPublication = eventsPublication,
): PublishedEventDescriptor[] {
  return futureIn(date, options, publication);
}
