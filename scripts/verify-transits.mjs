/** Fail-closed physics and schema audit for one committed transit month. */
import '../src/lib/engine/server-de440.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readdir } from 'node:fs/promises';
import { readAndAuditTransitMonth } from './daily-fact-audit.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const monthIndex = process.argv.indexOf('--month');
const month = monthIndex >= 0 ? process.argv[monthIndex + 1] : process.argv[2];
let months = [];
if (process.argv.includes('--all')) {
  months = (await readdir(resolve(repoRoot, 'src/data')))
    .map((name) => name.match(/^transits-(\d{4}-(?:0[1-9]|1[0-2]))\.json$/)?.[1])
    .filter(Boolean)
    .sort();
} else if (/^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '')) {
  months = [month];
} else {
  throw new Error('Usage: node scripts/verify-transits.mjs --month YYYY-MM');
}

if (!months.length) throw new Error('no transit month sources found');
let eventCount = 0;
for (const candidate of months) {
  const result = await readAndAuditTransitMonth(candidate, repoRoot);
  if (!result.source) throw new Error(`src/data/transits-${candidate}.json is missing or invalid`);
  if (result.failures.length) {
    console.error(`verify-transits: ${result.failures.length} failure(s) for ${candidate}`);
    for (const item of result.failures) console.error(`  ${item.ruleId} ${item.path}: ${item.message}`);
    process.exit(1);
  }
  eventCount += result.events.length;
}
console.log(`verify-transits: PASS — ${months.length} month(s), ${eventCount} events checked against the site engine`);
