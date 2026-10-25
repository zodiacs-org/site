// Normal build: the natal pair pages follow the publication record. While the
// record is held, none of the three routes is emitted, served, listed in the
// sitemap or search index, or linked from the existing aspect guides.
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { withPreview } from './visual/preview-server.mjs';
import { NATAL_ASPECT_PAIRS, natalAspectsEnabled, natalAspectsPublished } from '../scripts/natal-aspects-policy.mjs';

assert.equal(natalAspectsEnabled, natalAspectsPublished, 'Run against a normal build, without PUBLIC_NATAL_ASPECTS_PREVIEW.');
const routes = NATAL_ASPECT_PAIRS.map((pair) => `/learn/aspects/${pair}/`);
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const search = await readFile('dist/search-index.json', 'utf8');
for (const route of routes) {
  if (natalAspectsPublished) await access(`dist${route}index.html`);
  else await assert.rejects(access(`dist${route}index.html`), `${route} is not emitted while held`);
  assert.equal(sitemap.includes(`https://zodiacs.org${route}`), natalAspectsPublished, `${route} sitemap entry matches publication`);
  assert.equal(search.includes(route), natalAspectsPublished, `${route} search entry matches publication`);
}
for (const path of ['learn/aspects/index.html', ...['conjunction', 'sextile', 'square', 'trine', 'opposition'].map((type) => `learn/aspects/${type}/index.html`)]) {
  const html = await readFile(`dist/${path}`, 'utf8');
  for (const route of routes) assert.equal(html.includes(`href="${route}`), false, `${path} carries no link to ${route} yet`);
}
await withPreview({ port: 4348 }, async (baseURL) => {
  for (const route of routes) {
    assert.equal((await fetch(`${baseURL}${route}`)).status, natalAspectsPublished ? 200 : 404, `${route} HTTP status`);
  }
  assert.equal((await fetch(`${baseURL}/learn/aspects/square/`)).status, 200, 'geometry guides still build');
});
console.log(natalAspectsPublished
  ? 'Natal publication passed: three routes present, in the sitemap and search.'
  : 'Natal publication hold passed: three routes absent and HTTP 404, no sitemap, search or discovery links.');
