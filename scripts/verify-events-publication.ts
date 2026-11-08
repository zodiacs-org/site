import { stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import committed from '../src/data/events-publication.json';
import committedExtension from '../src/data/events-publication-2028-2030.json';
import { eventsCatalog } from '../src/lib/events/catalog';
import { mergeEventPublications } from '../src/lib/events/merge-publications.mjs';
import { EVENTS_EXTENSION_WINDOW, buildEventsPublication } from './events-publication-lib';

// The 2026 to 2027 receipt the AI tools bundle, and the site's 2028 to 2030 one.
const first = buildEventsPublication(eventsCatalog());
const extension = buildEventsPublication(eventsCatalog(), EVENTS_EXTENSION_WINDOW);
for (const [file, actual, built] of [
  ['events-publication.json', committed, first],
  ['events-publication-2028-2030.json', committedExtension, extension],
] as const) {
  if (JSON.stringify(actual) !== JSON.stringify(built)) {
    console.error(`events-publication: committed receipt ${file} is stale; run npm run data:events:build`);
    process.exit(1);
  }
}
const expected = mergeEventPublications([first, extension]);

const repo = fileURLToPath(new URL('..', import.meta.url));
const cards = [
  ...(expected.hub.indexEligible ? [expected.hub.card] : []),
  ...expected.pages.map((event) => event.card),
];
let cardBytes = 0;
for (const card of cards) {
  let cardStat;
  try {
    cardStat = await stat(resolve(repo, 'public', card.replace(/^\//, '')));
  } catch {
    console.error(`events-publication: missing generated OG card ${card}`);
    process.exit(1);
  }
  if (!cardStat.isFile() || cardStat.size < 1_024) {
    console.error(`events-publication: invalid generated OG card ${card} (${cardStat.size} bytes)`);
    process.exit(1);
  }
  cardBytes += cardStat.size;
}

console.log(
  `events-publication: OK — ${expected.pages.length} approved page(s), `
  + `${expected.timeline.length} public timeline row(s), ${cards.length} OG card(s) `
  + `(${(cardBytes / 1024 / 1024).toFixed(2)}MiB), fixtures and post-2030 pages withheld`,
);
