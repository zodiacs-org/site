/** Materialize the exact daily copy and its deterministic provenance record. */
import '../src/lib/engine/server-de440.mjs';
import { writeFile } from 'node:fs/promises';
import {
  MANIFEST_PATH,
  PUBLICATION_PATH,
  expectedDailyPackage,
  formatViolations,
} from './daily-publication-files';

const requestedDateIndex = process.argv.indexOf('--date');
const requestedDate = requestedDateIndex >= 0 ? process.argv[requestedDateIndex + 1] : null;
const { daily, publication, manifest, violations } = await expectedDailyPackage();

if (requestedDate && requestedDate !== daily.date) {
  throw new Error(`Daily publication date ${daily.date} does not match requested ${requestedDate}`);
}
if (violations.length) {
  console.error(`daily-publication: ${violations.length} blocking violation(s)`);
  console.error(formatViolations(violations));
  process.exit(1);
}

await writeFile(PUBLICATION_PATH, `${JSON.stringify(publication, null, 2)}\n`);
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `daily-publication: wrote ${publication.signs.length} signs for ${daily.date} `
  + `(${publication.facts.length} traceable facts, ${manifest.generation.mode})`,
);
