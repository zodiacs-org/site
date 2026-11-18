/**
 * What an event page renders, as distinct from what the catalog holds
 * (Linear ZOD-221, decision J). Two things can differ:
 *
 * - a page in the window of window-readings.ts prints that fuller reading;
 * - a past page on the hidden list (src/lib/indexing/past-pages-hidden.mjs)
 *   renders noindex.
 *
 * The catalog, the committed events publication and the AI tools are left
 * as they are. The moon, eclipse and event routes pass each event through
 * here on its way to the shared template.
 */
import { isPastPageHidden } from '../indexing/past-pages-hidden-list';
import type { CatalogEvent } from './types';
import { windowInterpretation } from './window-readings';

export function pageEvent(
  event: CatalogEvent,
  isHidden: (path: string) => boolean = isPastPageHidden,
): CatalogEvent {
  const reading = event.fixture ? undefined : windowInterpretation(event.facts);
  const hidden = isHidden(event.facts.path);
  if (!reading && !hidden) return event;
  return {
    ...event,
    interpretation: reading ?? event.interpretation,
    indexEligible: event.indexEligible && !hidden,
  };
}
