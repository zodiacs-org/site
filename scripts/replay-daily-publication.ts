/**
 * Recompute a rolling historical window without writing files or reading the
 * wall clock. This catches astronomy/data/template combinations that a single
 * current-day fixture cannot exercise.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  DAILY_EDITORIAL_CONSTITUTION,
  buildDailyPublication,
  dailyRendererForDate,
  validateDailyPublication,
} from '../src/lib/daily-publication';
import type { Daily } from '../src/lib/daily';
import { canonicalJson, formatViolations, REPO_ROOT, sha256 } from './daily-publication-files';
import { auditDailyAstronomy } from './daily-fact-audit.mjs';
import { computeDailySnapshot } from './daily-snapshot-lib.mjs';

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

const current = JSON.parse(await readFile(resolve(REPO_ROOT, 'src/data/daily.json'), 'utf8')) as Daily;
const goldens = JSON.parse(await readFile(
  resolve(REPO_ROOT, 'src/data/daily-replay-goldens.json'),
  'utf8',
)) as {
  schema: string;
  rendererVersion: string;
  policyVersion: string;
  cases: Array<{
    date: string;
    coverage: string;
    eventKinds: string[];
    factsSha256: string;
    publicationSha256: string;
  }>;
};
const through = option('--through') ?? current.date;
const days = Number(option('--days') ?? '30');
if (!Number.isInteger(days) || days < 1 || days > 366) {
  throw new Error(`--days must be an integer from 1 to 366, received ${days}`);
}
const throughDate = new Date(`${through}T00:00:00.000Z`);
if (Number.isNaN(throughDate.getTime()) || throughDate.toISOString().slice(0, 10) !== through) {
  throw new Error(`--through must be a real YYYY-MM-DD date, received ${through}`);
}

let outputCount = 0;
async function checkedEdition(date: string) {
  const originalNow = Date.now;
  const originalRandom = Math.random;
  const originalFetch = globalThis.fetch;
  Date.now = () => { throw new Error(`${date}: wall-clock access is forbidden during replay`); };
  Math.random = () => { throw new Error(`${date}: randomness is forbidden during replay`); };
  globalThis.fetch = (async () => { throw new Error(`${date}: network access is forbidden during replay`); }) as typeof fetch;
  try {
    const facts = await computeDailySnapshot(date, REPO_ROOT) as Daily;
    const first = buildDailyPublication(facts);
    const second = buildDailyPublication(structuredClone(facts));
    if (canonicalJson(first) !== canonicalJson(second)) {
      throw new Error(`${date}: renderer is not deterministic`);
    }
    const violations = validateDailyPublication(facts, first);
    violations.push(...await auditDailyAstronomy(facts, REPO_ROOT));
    if (violations.length) {
      throw new Error(`${date}: ${violations.length} replay violation(s)\n${formatViolations(violations)}`);
    }
    return { facts, publication: first };
  } finally {
    Date.now = originalNow;
    Math.random = originalRandom;
    globalThis.fetch = originalFetch;
  }
}

if (goldens.schema !== 'zodiacs.daily-replay-goldens.v1'
  || goldens.cases.some((golden) => goldens.rendererVersion !== dailyRendererForDate(golden.date))
  || goldens.policyVersion !== DAILY_EDITORIAL_CONSTITUTION.version) {
  throw new Error('fixed replay goldens require an explicit renderer/policy version update');
}

if (process.argv.includes('--print-goldens')) {
  const printed = {
    schema: 'zodiacs.daily-replay-goldens.v1',
    rendererVersion: goldens.rendererVersion,
    policyVersion: DAILY_EDITORIAL_CONSTITUTION.version,
    cases: [],
  } as typeof goldens;
  for (const golden of goldens.cases) {
    const { facts, publication } = await checkedEdition(golden.date);
    printed.cases.push({
      date: golden.date,
      coverage: facts.eventsCoverage ?? 'unavailable',
      eventKinds: [...new Set(facts.events.map((event) => event.kind))].sort(),
      factsSha256: sha256(canonicalJson(facts)),
      publicationSha256: sha256(canonicalJson(publication)),
    });
  }
  console.log(JSON.stringify(printed, null, 2));
  process.exit(0);
}

for (const golden of goldens.cases) {
  const { facts, publication } = await checkedEdition(golden.date);
  const eventKinds = [...new Set(facts.events.map((event) => event.kind))].sort();
  if (facts.eventsCoverage !== golden.coverage
    || canonicalJson(eventKinds) !== canonicalJson(golden.eventKinds)
    || sha256(canonicalJson(facts)) !== golden.factsSha256
    || sha256(canonicalJson(publication)) !== golden.publicationSha256) {
    throw new Error(`${golden.date}: fixed replay golden changed; review facts/copy and update the versioned receipt deliberately`);
  }
}

for (let offset = days - 1; offset >= 0; offset -= 1) {
  const date = new Date(throughDate.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
  const { publication } = await checkedEdition(date);
  outputCount += publication.signs.reduce((count, entry) => count + entry.lines.length + 2, 0);
}

console.log(
  `replay-daily-publication: PASS — ${days} days through ${through}, `
  + `${days * 12} sign editions, ${outputCount} checked outputs, ${goldens.cases.length} fixed goldens`,
);
