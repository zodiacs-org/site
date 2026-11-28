#!/usr/bin/env node
/**
 * The tarot draw's assets follow PUBLIC_TAROT_ENABLED (scripts/tarot-route.mjs), checked on the built site.
 *
 * Off: /tarot/ is the redirect to the 404 page, no /_astro/ file is the TarotDraw island, no script carries the
 * draw's words or a card meaning, and the service worker lists no tarot asset to precache. On: the page is built and
 * its island ships with the meanings. Run after `npm run build`, with the same switch in the shell:
 *
 *   npm run build && node scripts/check-tarot-dist.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tarotEnabled } from './tarot-route.mjs';

/** Words only the draw and the meanings carry: the island's own message and one card's question. */
export const TAROT_MARKERS = Object.freeze([
  'The cards could not be drawn in this browser',
  'What would you begin today if you did not need to know how it ends?',
]);
const ISLAND = /^TarotDraw\.[A-Za-z0-9_-]+\.js$/u;

/**
 * What is wrong with a build, as plain sentences; empty when it follows the switch. `assets` is every /_astro/ script
 * as { name, text }, `serviceWorker` the text of sw.js and `page` that of tarot/index.html.
 */
export function tarotDistProblems({ enabled, assets, serviceWorker, page }) {
  const problems = [];
  const islands = assets.filter((asset) => ISLAND.test(asset.name));
  const carrying = assets.filter((asset) => TAROT_MARKERS.some((marker) => asset.text.includes(marker)));
  const redirect = /http-equiv="refresh"[^>]*\/404\.html/u.test(page);
  if (!enabled) {
    if (!redirect) problems.push('/tarot/ is not the redirect to the 404 page with PUBLIC_TAROT_ENABLED off');
    for (const asset of islands) problems.push(`/_astro/${asset.name} is the tarot island in a flag-off build`);
    for (const asset of carrying) problems.push(`/_astro/${asset.name} carries the tarot draw's words in a flag-off build`);
    if (/TarotDraw/u.test(serviceWorker)) problems.push('the service worker lists a tarot asset in a flag-off build');
    return problems;
  }
  if (redirect || !page.includes('<h1')) problems.push('/tarot/ is not built with PUBLIC_TAROT_ENABLED on');
  if (islands.length !== 1) problems.push(`expected one TarotDraw island with PUBLIC_TAROT_ENABLED on, found ${islands.length}`);
  for (const marker of TAROT_MARKERS) {
    if (!carrying.some((asset) => asset.text.includes(marker))) problems.push(`no script carries "${marker}" with PUBLIC_TAROT_ENABLED on`);
  }
  return problems;
}

async function main() {
  const dist = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
  const names = (await readdir(join(dist, '_astro'))).filter((name) => name.endsWith('.js'));
  const assets = await Promise.all(names.map(async (name) => ({ name, text: await readFile(join(dist, '_astro', name), 'utf8') })));
  const serviceWorker = await readFile(join(dist, 'sw.js'), 'utf8');
  const page = await readFile(join(dist, 'tarot', 'index.html'), 'utf8').catch(() => '');
  const enabled = tarotEnabled();
  const problems = tarotDistProblems({ enabled, assets, serviceWorker, page });
  if (problems.length) {
    for (const problem of problems) console.error(`check-tarot-dist: ${problem}`);
    process.exit(1);
  }
  console.log(`check-tarot-dist: OK with PUBLIC_TAROT_ENABLED ${enabled ? 'on' : 'off'} (${assets.length} scripts)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
