// Normal build: the natal pair pages are released. All three routes are
// emitted, served, indexable and self-canonical, listed in the sitemap and
// the search index, and linked from the aspects hub and every geometry guide.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { withPreview } from './visual/preview-server.mjs';
import { NATAL_ASPECT_PAIRS, natalAspectsEnabled, natalAspectsPublished } from '../scripts/natal-aspects-policy.mjs';

assert.equal(natalAspectsPublished, true, 'The committed publication record is released.');
assert.equal(natalAspectsEnabled, true);
const GEOMETRIES = ['conjunction', 'sextile', 'square', 'trine', 'opposition'];
const routes = NATAL_ASPECT_PAIRS.map((pair) => `/learn/aspects/${pair}/`);
const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const search = await readFile('dist/search-index.json', 'utf8');
const robots = await readFile('dist/robots.txt', 'utf8');
for (const route of routes) {
  const html = await readFile(`dist${route}index.html`, 'utf8');
  assert.match(html, new RegExp(`<link rel="canonical" href="https://zodiacs\\.org${route}"`), `${route} is self-canonical`);
  assert.doesNotMatch(html, /<meta name="robots" content="[^"]*noindex/, `${route} is indexable`);
  assert.ok(sitemap.includes(`<loc>https://zodiacs.org${route}</loc>`), `${route} is in the sitemap`);
  assert.ok(search.includes(`"${route}"`), `${route} is in the search index`);
  assert.doesNotMatch(robots, /^Disallow:\s*\/learn\/(?:aspects\/)?\s*$/m, 'robots.txt allows the Learn aspects tree');
}
const hub = await readFile('dist/learn/aspects/index.html', 'utf8');
for (const route of routes) assert.ok(hub.includes(`href="${route}"`), `the aspects hub links ${route}`);
for (const type of GEOMETRIES) {
  const html = await readFile(`dist/learn/aspects/${type}/index.html`, 'utf8');
  for (const route of routes) assert.ok(html.includes(`href="${route}#${type}"`), `the ${type} guide links ${route}#${type}`);
}
await withPreview({ port: 4348 }, async (baseURL) => {
  for (const route of routes) {
    assert.equal((await fetch(`${baseURL}${route}`)).status, 200, `${route} HTTP status`);
  }
  assert.equal((await fetch(`${baseURL}/learn/aspects/square/`)).status, 200, 'geometry guides still build');
});
console.log('Natal publication passed: three routes served, indexable, self-canonical, in the sitemap and search, and linked from the hub and the five geometry guides.');
