#!/usr/bin/env node
/**
 * Draws the sky-fact benchmark v0 again with the installed engine and
 * compares what it draws with the published files.
 *
 * v0 was drawn with @zodiacs/engine 0.1.1-rc.16, and the generator refuses
 * to draw or check it with any other engine. This calls the generator's own
 * exported steps (buildBenchmark, toolAnswers, serialize and
 * replyDifferences) without that refusal, so that the comparison is the
 * generator's, made with rc.17. It writes nothing into the benchmark's
 * folder: it prints a JSON record of the comparison on stdout.
 *
 * Run from the site's root, with the engine to compare installed:
 *   node_modules/.bin/vite-node --script \
 *     docs/platform/evidence/site-engine-rc17/tools/redraw-sky-benchmark-v0.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const generator = await import(resolve(root, 'scripts/build-sky-benchmark.mjs'));
const { checkSkyFact } = await import(resolve(root, 'src/mcp/sky-tools.ts'));

const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The paths at which two JSON values differ, each with the number of places
 * it differs. A list index is written as [], so that one field differing in
 * every question counts as one path.
 */
function differingPaths(a, b, path = '', found = new Map()) {
  if (isRecord(a) && isRecord(b)) {
    for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
      differingPaths(a[name], b[name], path ? `${path}.${name}` : name, found);
    }
  } else if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
    a.forEach((entry, index) => differingPaths(entry, b[index], `${path}[]`, found));
  } else if (JSON.stringify(a) !== JSON.stringify(b)) {
    found.set(path, (found.get(path) ?? 0) + 1);
  }
  return found;
}

const folder = resolve(root, generator.OUT_DIR);
const published = Object.fromEntries(
  generator.DRAWN_FILES.map((name) => [name, readFileSync(resolve(folder, name), 'utf8')]),
);
const publishedKey = JSON.parse(published['key.json']);
const publishedTool = JSON.parse(published['tool-answers.json']);
const installed = await generator.installedEngine();

const { items, key } = generator.buildBenchmark();
const tool = await generator.toolAnswers(items, key, checkSkyFact);
const drawn = {
  'items.json': generator.serialize(items, 'items'),
  'key.json': generator.serialize(key, 'items'),
  'tool-answers.json': generator.serialize(tool, 'answers'),
};

const files = {};
for (const name of generator.DRAWN_FILES) {
  const paths = differingPaths(JSON.parse(published[name]), JSON.parse(drawn[name]));
  files[name] = {
    publishedSha256: sha256(published[name]),
    drawnSha256: sha256(drawn[name]),
    sameBytes: published[name] === drawn[name],
    differingPaths: Object.fromEntries([...paths].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  };
}

const record = {
  what: 'The sky-fact benchmark v0 drawn again with the installed engine by the generator\'s own steps, past its refusal of an engine other than v0\'s, and compared with the published files. differingPaths names each JSON path that differs, with a list index written as [], and how many places it differs in.',
  generatorSha256: sha256(readFileSync(resolve(root, 'scripts/build-sky-benchmark.mjs'))),
  node: process.version,
  publishedWith: generator.drawnWith(publishedKey, publishedTool),
  installed,
  generatorRefusal: generator.redrawRefusal(generator.drawnWith(publishedKey, publishedTool), installed),
  files,
  replyDifferences: generator.replyDifferences(publishedTool, tool),
  replyDifferencesNote: 'What the generator\'s --check holds tool-answers.json to: each request, its answer and the facts behind it, with every event within 2 seconds of where it was. Receipts are set aside.',
};
process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
