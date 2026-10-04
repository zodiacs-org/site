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
it.each([
  ['<a href="http://LICENSING.md">LICENSING.md</a>', 'http://LICENSING.md'],
  ['<a href="https://licensing.md/">LICENSING.md</a>', 'https://licensing.md/'],
  ['<a href="http://github.com/zodiacs-org/engine">Engine</a>', 'http://github.com/zodiacs-org/engine'],
  ['<img src="https://example.com/pixel.png">', 'https://example.com/pixel.png'],
  ['<a href="//attacker.example/">Elsewhere</a>', '//attacker.example/'],
  ['<a href="//attacker.example/developers/engine/reference/">Elsewhere</a>', '//attacker.example/developers/engine/reference/'],
  ['<a href=" https://attacker.example/">Elsewhere</a>', ' https://attacker.example/'],
  ["<a href='http://LICENSING.md'>LICENSING.md</a>", 'http://LICENSING.md'],
  ['<a href=http://LICENSING.md>LICENSING.md</a>', 'http://LICENSING.md'],
  ['<img srcset="../assets/a.png 1x, https://example.com/b.png 2x">', 'https://example.com/b.png'],
  ['<a href="https://www.zodiacs.org/developers/engine/">Engine</a>', 'https://www.zodiacs.org/developers/engine/'],
  ['<a href="javascript:void(0)">Nothing</a>', 'javascript:void(0)'],
])('rejects an external link outside the named HTTPS hosts: %s', async (link, value) => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html + link);
  expect((await checkEngineReference(root)).errors).toContain(`index.html: unexpected external link ${value}`);
});
it('accepts the named HTTPS hosts', async () => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html + '<a href="https://github.com/zodiacs-org/engine">Engine</a><a href="https://developer.mozilla.org/docs/Web">MDN</a><a href="https://raw.githubusercontent.com/zodiacs-org/engine/x/a.tgz">Archive</a><a href="https://zodiacs.org/developers/engine/reference/modules.html">Modules</a>');
  expect((await checkEngineReference(root)).errors).toEqual([]);
});
it('holds an absolute zodiacs.org link to a file in the build, as it does a relative one', async () => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html + '<a href="https://zodiacs.org/developers/engine/missing/">Missing</a>');
  expect((await checkEngineReference(root)).errors)
    .toContain('index.html: missing local target https://zodiacs.org/developers/engine/missing/');
});
it.each([
  "<a href='/sdk/engine/'>SDK</a>",
  '<a href=/sdk/>SDK</a>',
  '<a href="https://zodiacs.org/sdk/engine/modules.html">SDK</a>',
  '<a href="https://github.com/zodiacs-org/sdk/tree/main">SDK</a>',
  '<img srcset="../assets/a.png 1x, /sdk/b.png 2x">',
])('rejects a link to the historical SDK however it is written: %s', async (link) => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html + link);
  expect((await checkEngineReference(root)).errors).toContain('index.html: reference links to historical SDK');
});
it('reports a malformed escape in a link instead of stopping', async () => {
  const html = await readFile(join(directory, 'index.html'), 'utf8');
  await put('index.html', html + '<a href="modules/%E0%A4%A.html">Bad</a><a href="modules/calc.html#%E0%A4%A">Bad anchor</a>');
  const { errors } = await checkEngineReference(root);
  expect(errors).toContain('index.html: malformed link modules/%E0%A4%A.html');
  expect(errors).toContain('index.html: missing anchor modules/calc.html#%E0%A4%A');
});
it.each([
  'Collect the NFT', 'cryptocurrency', 'crypto markets', 'two crypto-tokens', 'your wallet', 'Astrofolio',
  'minted on-chain', 'a web3 app',
])('rejects token or market wording: %s', async (text) => {
  const html = await readFile(join(directory, 'modules/calc.html'), 'utf8');
  await put('modules/calc.html', html.replace('</h1>', `</h1><p>${text}</p>`));
  expect((await checkEngineReference(root)).errors.some((error) => error.startsWith('modules/calc.html: token or market wording'))).toBe(true);
});
it('reads the release notices for the same wording, beside their digests', async () => {
  await put('release/README.txt', 'Hold the NFT');
  const { errors } = await checkEngineReference(root);
  expect(errors).toContain('release/README.txt: notice digest mismatch');
  expect(errors).toContain('release/README.txt: token or market wording "NFT"');
});
it('leaves ordinary API words alone', async () => {
  const html = await readFile(join(directory, 'modules/calc.html'), 'utf8');
  await put('modules/calc.html', html.replace('</h1>',
    '</h1><p>Pass a cancellation token; format tokens follow ICU. Check the digest with the Web Crypto API, crypto.subtle.digest.</p>'));
  expect((await checkEngineReference(root)).errors).toEqual([]);
});
