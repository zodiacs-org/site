/**
 * Writes src/lib/og-art-cards.locales.mjs, the words of the Spanish, French,
 * Italian and Portuguese art share cards, from what the localized pages print
 * (src/lib/og-art-cards-copy.ts). Plain data, so the plain-Node card generator
 * (scripts/build-og-void.mjs) can read it.
 *
 *   npx vite-node --script scripts/build-og-art-card-copy.ts           # write
 *   npx vite-node --script scripts/build-og-art-card-copy.ts --check   # fail on drift
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderLocalizedArtCardCopyModule } from '../src/lib/og-art-cards-copy';

const OUT = fileURLToPath(new URL('../src/lib/og-art-cards.locales.mjs', import.meta.url));

const next = renderLocalizedArtCardCopyModule();
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8'); } catch { /* missing counts as drift */ }
  if (current !== next) {
    console.error('og-art-cards.locales.mjs is stale: run npx vite-node --script scripts/build-og-art-card-copy.ts');
    process.exit(1);
  }
  console.log('og-art-cards.locales.mjs: up to date');
} else {
  writeFileSync(OUT, next);
  console.log(`Wrote ${OUT}`);
}
