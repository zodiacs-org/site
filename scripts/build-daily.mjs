/*
 * Computes one explicit UTC day's deterministic sky snapshot.
 *
 *   node scripts/build-daily.mjs              -> today in UTC
 *   node scripts/build-daily.mjs 2026-07-06   -> explicit date
 *
 * The shared builder is side-effect free; this CLI is the only writer.
 */
import '../src/lib/engine/server-de440.mjs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { assertDailyDate, computeDailySnapshot } from './daily-snapshot-lib.mjs';

const requestedDate = process.argv[2] ?? new Date().toISOString().slice(0, 10);
try {
  assertDailyDate(requestedDate);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  console.error('Usage: node scripts/build-daily.mjs [YYYY-MM-DD]');
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'src/data/daily.json');
const daily = await computeDailySnapshot(requestedDate, root);

await writeFile(output, `${JSON.stringify(daily, null, 2)}\n`);
console.log(
  `✓ src/data/daily.json — ${daily.date}, ${daily.bodies.length} bodies, `
  + `${daily.events.length} events (${daily.eventsCoverage}), ${daily.moon.phase}`,
);
