/**
 * The site's event publication: the 2026 to 2027 receipt
 * (src/data/events-publication.json), which the AI tools bundle byte for
 * byte and so stays as it is, joined with the 2028 to 2030 receipt
 * (src/data/events-publication-2028-2030.json). Plain JavaScript, so the
 * site (src/lib/events/site-publication.ts) and the Node scripts join them
 * the same way.
 *
 * @template {{ window: { from: string, to: string }, lastModified: string, pages: unknown[], timeline: unknown[] }} P
 * @param {P[]} receipts in time order, each window starting where the last one ends
 * @returns {P}
 */
export function mergeEventPublications(receipts) {
  const [first, ...rest] = receipts;
  if (!first) throw new Error('mergeEventPublications: no receipt');
  let merged = first;
  for (const next of rest) {
    if (next.window.from !== merged.window.to) {
      throw new Error(`mergeEventPublications: ${next.window.from} does not follow ${merged.window.to}`);
    }
    merged = {
      ...merged,
      window: { from: merged.window.from, to: next.window.to },
      lastModified: next.lastModified > merged.lastModified ? next.lastModified : merged.lastModified,
      pages: [...merged.pages, ...next.pages],
      timeline: [...merged.timeline, ...next.timeline],
    };
  }
  return merged;
}

/** The two receipts' paths, from the repository root. */
export const EVENT_PUBLICATION_FILES = Object.freeze([
  'src/data/events-publication.json',
  'src/data/events-publication-2028-2030.json',
]);
