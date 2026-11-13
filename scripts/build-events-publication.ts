import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { eventsCatalog } from '../src/lib/events/catalog';
import { EVENTS_EXTENSION_WINDOW, EVENTS_PUBLICATION_WINDOW, buildEventsPublication } from './events-publication-lib';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The 2026 to 2027 receipt the AI tools bundle, and the site's 2028 to 2030 one.
for (const [file, window] of [
  ['src/data/events-publication.json', EVENTS_PUBLICATION_WINDOW],
  ['src/data/events-publication-2028-2030.json', EVENTS_EXTENSION_WINDOW],
] as const) {
  const output = resolve(repo, file);
  const publication = buildEventsPublication(eventsCatalog(), window);
  await writeFile(output, `${JSON.stringify(publication, null, 2)}\n`);
  console.log(
    `events-publication: wrote ${publication.pages.length} page(s) and `
    + `${publication.timeline.length} timeline row(s) → ${output}`,
  );
}
