// Compare the unchanged hash contract with its immutable main implementation.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
const base = 'f4715b7047c852f48d0e188d43863d5825ae2bef';
const implementation = 'tests/visual/phase1-evidence-contract.mjs';
const before = execFileSync('git', ['show', `${base}:${implementation}`], { cwd: root });
const original = await import(`data:text/javascript;base64,${before.toString('base64')}`);
const current = await import(pathToFileURL(resolve(root, implementation)).href);
const font = (await readdir(resolve(root, 'public/fonts'))).filter((name) => name.endsWith('.woff2')).sort()[0];
if (!font) throw new Error('No bundled font available for the hash audit');

const scenarios = [
  ['current-tree', null, false],
  ['transitive-source-change', 'src/lib/engine/full.ts', true],
  ['bundled-font-change', `public/fonts/${font}`, true],
  ['excluded-delivery-change', 'src/lib/daily-email/segments.ts', false],
  ['excluded-payload-change', 'src/data/daily.json', false],
];
const report = {
  what: 'One sequential original/current comparison per scenario; exact digest, read coverage and order. No source file is modified.',
  base,
  node: process.version,
  referenceSha256: createHash('sha256').update(before).digest('hex'),
  implementationSha256: createHash('sha256').update(await readFile(resolve(root, implementation))).digest('hex'),
  scenarios: [],
};
let baseline;
for (const [name, changedPath, changesDigest] of scenarios) {
  const runs = [];
  for (const module of [original, current]) {
    const reads = [];
    const start = performance.now();
    const digest = await module.phase1TemplateSourceSha256(root, {
      readSource: async (path) => {
        reads.push(path);
        const bytes = await readFile(path);
        return changedPath && path === resolve(root, changedPath)
          ? Buffer.concat([bytes, Buffer.from('hash-audit-change')]) : bytes;
      },
    });
    runs.push({ digest, reads, wallMs: performance.now() - start });
  }
  const [prior, updated] = runs;
  if (prior.digest !== updated.digest || prior.reads.length !== updated.reads.length
      || prior.reads.some((path, index) => path !== updated.reads[index])) {
    throw new Error('Source-hash digest, coverage or order differs from its reference');
  }
  baseline ??= prior.digest;
  if ((prior.digest !== baseline) !== changesDigest) throw new Error('Source-hash invalidation differs from its contract');
  report.scenarios.push({
    name, equalDigest: true, equalReadCoverageAndOrder: true,
    digest: prior.digest, filesRead: prior.reads.length,
    originalWallMs: prior.wallMs, currentWallMs: updated.wallMs,
    changesDigest,
  });
}
console.log(JSON.stringify(report, null, 2));
