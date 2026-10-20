import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { withPreview } from './visual/preview-server.mjs';
import { synastryEnabled, synastryPublished } from '../scripts/synastry-reference-policy.mjs';

assert.equal(synastryEnabled, synastryPublished, 'Run against a normal build.');
const search = await readFile('dist/search-index.json', 'utf8');
assert.equal(search.includes('/compatibility/aspects/'), synastryPublished, 'Search discovery matches publication status.');
for (const suffix of ['', 'sun-moon/', 'moon-venus/', 'moon-mars/']) {
  if (synastryPublished) await access(`dist/compatibility/aspects/${suffix}index.html`);
  else await assert.rejects(access(`dist/compatibility/aspects/${suffix}index.html`));
}
for (const path of ['index.html', 'tools/index.html', 'compatibility/index.html', 'compatibility/gemini-gemini/index.html']) {
  assert.equal((await readFile(`dist/${path}`, 'utf8')).includes('href="/compatibility/aspects/"'), synastryPublished, `${path} matches publication status`);
}
for (const path of ['learn/index.html', 'gemini/index.html']) {
  assert.equal((await readFile(`dist/${path}`, 'utf8')).includes('href="/compatibility/aspects/"'), false, `${path} remains outside discovery scope`);
}
await withPreview({ port: 4346 }, async (baseURL) => {
  for (const suffix of ['', 'sun-moon/', 'moon-venus/', 'moon-mars/']) {
    assert.equal((await fetch(`${baseURL}/compatibility/aspects/${suffix}`)).status, synastryPublished ? 200 : 404);
  }
});
console.log(synastryPublished ? 'Publication passed: four routes and discovery are present.' : 'Publication hold passed: four routes absent and HTTP 404, no draft discovery links.');
