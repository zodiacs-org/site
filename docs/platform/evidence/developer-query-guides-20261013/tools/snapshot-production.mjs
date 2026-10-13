/**
 * Saves what canonical production serves for the developer guides, so that
 * verify-production.mjs can compare it with local builds of the merge later,
 * without production having to stay on that deployment while they are built.
 * For the index and each guide of the merge's catalogue it GETs the page and its
 * Markdown twin, and it GETs llms.txt, llms-full.txt and the sitemap: the paths
 * verify-production.mjs reads. Each response is kept byte for byte, with its
 * status, content type, digest and the time it was read.
 *
 *   node snapshot-production.mjs <merge commit> <out dir>   (run in a clone that has the commit)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = 'https://zodiacs.org';
const [commit, out] = process.argv.slice(2);
if (!/^[0-9a-f]{40}$/u.test(commit ?? '') || !out) throw new Error('usage: snapshot-production.mjs <40-hex commit> <out dir>');
const guides = JSON.parse(execFileSync('git', ['show', `${commit}:src/data/developer-guides.json`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const paths = [
  '/developers/docs/', '/developers/docs/index.md',
  ...guides.flatMap((guide) => [`/developers/docs/${guide.slug}/`, `/developers/docs/${guide.slug}.md`]),
  '/llms.txt', '/llms-full.txt', '/sitemap.xml',
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
mkdirSync(resolve(out, 'files'), { recursive: true });
const entries = [];
for (const [index, path] of paths.entries()) {
  const readAt = new Date().toISOString();
  const response = await fetch(BASE + path, { redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(30000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const file = `files/${String(index).padStart(3, '0')}`;
  writeFileSync(resolve(out, file), bytes);
  entries.push({ path, file, readAt, status: response.status, type: response.headers.get('content-type'), bytes: bytes.length, sha256: sha256(bytes) });
}
writeFileSync(resolve(out, 'manifest.json'), `${JSON.stringify({ schema: 'zodiacs.production-snapshot.v1', base: BASE, commit, guides: guides.length, entries }, null, 2)}\n`);
console.log(`${entries.length} responses, ${entries.filter((entry) => entry.status === 200).length} with status 200`);
