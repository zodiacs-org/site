/**
 * The two share images (a compatibility score and a date's rating) rendered
 * locally from share queries like the ones the cards' "Share the reading"
 * links carry. Manual, for before-and-after review; no network.
 *
 *   npx vite-node --script tests/ai-share-images-capture.ts -- --out <dir>
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { handleCompatibilityImageRequest, handleOccasionImageRequest } from '../src/server/result-preview';

const argv = process.argv.slice(2);
const out = argv[argv.indexOf('--out') + 1];
if (!out || argv.indexOf('--out') < 0) throw new Error('Give --out <dir> for the images.');
const IMAGES: [string, (request: Request) => Promise<Response>, string][] = [
  ['share-compatibility', handleCompatibilityImageRequest, '/api/og/compatibility-image?a=Ana&as=taurus&b=Luis&bs=leo&score=60&attraction=70&communication=57&stability=52&v=good'],
  ['share-compatibility-unnamed', handleCompatibilityImageRequest, '/api/og/compatibility-image?as=aquarius&bs=cancer&score=58&attraction=61&communication=55&stability=49&v=good'],
  ['share-occasion', handleOccasionImageRequest, '/api/og/occasion-image?o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence%2C+Italy&sun=gemini&moon=libra&score=69&v=good'],
  ['share-occasion-plain', handleOccasionImageRequest, '/api/og/occasion-image?o=birthday&d=2026-10-23&sun=libra&moon=aries&score=74&v=good'],
];
await mkdir(resolve(out), { recursive: true });
for (const [name, handle, path] of IMAGES) {
  const response = await handle(new Request(`https://zodiacs.org${path}`));
  if (response.status !== 200) throw new Error(`${name}: ${response.status}`);
  await writeFile(resolve(out, `${name}.jpg`), Buffer.from(await response.arrayBuffer()));
}
console.log(`Rendered ${IMAGES.length} share images in ${out}.`);
