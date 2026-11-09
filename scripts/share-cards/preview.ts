// Draw a few cards to a folder to look at:  npx vite-node --script scripts/share-cards/preview.ts <outdir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { bigThreeCard, pairCard } from '../../src/lib/share-cards/cards';

const out = process.argv[2] ?? 'tmp-cards';
mkdirSync(out, { recursive: true });
for (const [locale, pair] of [['en', 'aries-leo'], ['es', 'cancer-capricorn'], ['fr', 'sagittarius-sagittarius']] as const) {
  writeFileSync(`${out}/pair-${locale}-${pair}.jpg`, await pairCard(locale, pair));
}
writeFileSync(`${out}/big-three-en-leo.jpg`, await bigThreeCard('en', 'leo'));
console.log(`wrote cards to ${out}`);
