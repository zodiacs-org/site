/**
 * What an event page renders, as distinct from what the catalog holds
 * (Linear ZOD-221, decision J): a past page on the hidden list
 * (src/lib/indexing/past-pages-hidden.mjs) renders noindex.
 *
 * The catalog, the committed events publication and the AI tools are left
 * as they are. The moon, eclipse and event routes pass each event through
 * here on its way to the shared template.
 */
import { isPastPageHidden } from '../indexing/past-pages-hidden-list';
import type { CatalogEvent } from './types';

export function pageEvent(
  event: CatalogEvent,
  isHidden: (path: string) => boolean = isPastPageHidden,
): CatalogEvent {
  if (!isHidden(event.facts.path)) return event;
  return { ...event, indexEligible: false };
}
