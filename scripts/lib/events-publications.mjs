import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EVENT_PUBLICATION_FILES, mergeEventPublications } from '../../src/lib/events/merge-publications.mjs';

/** The site's event publication, both receipts joined (src/lib/events/merge-publications.mjs). */
export async function readEventsPublication(root) {
  return mergeEventPublications(await Promise.all(EVENT_PUBLICATION_FILES.map(async (file) => (
    JSON.parse(await readFile(resolve(root, file), 'utf8'))
  ))));
}
