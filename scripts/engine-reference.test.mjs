import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { checkEngineReference } from './check-engine-reference.mjs';

let root, directory, provenance;
const base = 'https://zodiacs.org/developers/engine/reference/';
const modules = ['engine','calc','crossings','deltat','geo','houses','receipt','sky','techniques','timing','vedic','window'];
async function put(path, content) {
  await mkdir(dirname(join(directory, path)), { recursive: true });
  await writeFile(join(directory, path), content);
}
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'engine-reference-test-'));
  directory = join(root, 'developers/engine/reference');
  provenance = JSON.parse(await readFile('public/developers/engine/reference/provenance.json', 'utf8'));
  for (const path of ['index.html', 'modules.html', ...modules.map((name) => `modules/${name}.html`)]) {
    const url = path === 'index.html' ? base : new URL(path, base).href;
    await put(path, `<head><link rel="canonical" href="${url}"/><meta name="robots" content="noindex,follow"/></head><h1>@zodiacs/engine 0.1.1-rc.16</h1><footer><nav class="engine-sign-rail"></nav>MIT AND CC-BY-4.0 /about/#editorial-system <a href="${provenance.sourceRepository}/tree/${provenance.sourceCommit}">Source</a></footer>`);
  }
  for (const path of Object.keys(provenance.notices)) {
    const bytes = await readFile(`public/developers/engine/reference/${path}`);
    await put(path, bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(provenance.notices[path]);
  }
  await put('provenance.json', JSON.stringify(provenance));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
it('accepts complete reference output and faithful release notices', async () => {
  expect(await checkEngineReference(root)).toEqual({ pages: 14, errors: [] });
});
it.each([
  ['canonical', 'https://zodiacs.org/developers/engine/reference/', 'https://zodiacs.org/sdk/engine/'],
  ['version', '@zodiacs/engine 0.1.1-rc.16', '@zodiacs/engine 0.1.1-rc.1'],
  ['licence', 'MIT AND CC-BY-4.0', 'MIT'],
  ['noindex', 'noindex,follow', 'index,follow'],
  ['pinned source', provenance => provenance.sourceCommit, 'main'],
])('rejects stale or incomplete %s metadata', async (_, from, to) => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html.replace(typeof from === 'function' ? from(provenance) : from, to));
  expect((await checkEngineReference(root)).errors.length).toBeGreaterThan(0);
});
it('rejects missing public entry points', async () => {
  await rm(join(directory, 'modules/crossings.html'));
  expect((await checkEngineReference(root)).errors).toContain('Missing required reference page: modules/crossings.html');
});
it('rejects altered notices', async () => {
  await put('release/NOTICE.txt', 'incomplete');
  expect((await checkEngineReference(root)).errors).toContain('release/NOTICE.txt: notice digest mismatch');
});
it('rejects broken local links and fragment links', async () => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html + '<a href="missing.html">Missing</a><a href="modules/calc.html#missing">Missing anchor</a>');
  const result = await checkEngineReference(root);
  expect(result.errors).toContain('index.html: missing local target missing.html');
  expect(result.errors).toContain('index.html: missing anchor modules/calc.html#missing');
});
it('keeps compatibility-only entries outside the public documentation contract', () => {
  expect(Object.keys(provenance.api)).toEqual(['.','./calc','./crossings','./deltat','./geo','./houses','./receipt','./sky','./techniques','./timing','./vedic','./window']);
  expect(Object.keys(provenance.excluded)).toEqual(['./internal','./internal/math']);
});
