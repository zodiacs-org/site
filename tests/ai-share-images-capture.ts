/**
 * The share images (a compatibility score, a date's rating, a birthday, the
 * sky calendar's next event and a horoscope) rendered locally from share
 * queries like the ones the cards' share links carry. Manual, for
 * before-and-after review; no network.
 *
 *   npx vite-node --script tests/ai-share-images-capture.ts -- --out <dir>
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  handleBirthdayImageRequest, handleCompatibilityImageRequest, handleHoroscopeImageRequest, handleOccasionImageRequest, handleSkyCalendarImageRequest,
} from '../src/server/result-preview';

// The horoscope is the published reading for the window's own date.
const { generatedFor } = JSON.parse(await readFile(new URL('../src/data/horoscope-window.json', import.meta.url), 'utf8')) as { generatedFor: string };

const argv = process.argv.slice(2);
const out = argv[argv.indexOf('--out') + 1];
if (!out || argv.indexOf('--out') < 0) throw new Error('Give --out <dir> for the images.');
const IMAGES: [string, (request: Request) => Promise<Response>, string][] = [
  ['share-compatibility', handleCompatibilityImageRequest, '/api/og/compatibility-image?a=Ana&as=taurus&b=Luis&bs=leo&score=60&attraction=70&communication=57&stability=52&v=good'],
  ['share-compatibility-unnamed', handleCompatibilityImageRequest, '/api/og/compatibility-image?as=aquarius&bs=cancer&score=58&attraction=61&communication=55&stability=49&v=good'],
  ['share-occasion', handleOccasionImageRequest, '/api/og/occasion-image?o=wedding&d=2027-06-12&n=Ana+%26+Luis&p=Florence%2C+Italy&sun=gemini&moon=libra&score=69&v=good'],
  ['share-occasion-plain', handleOccasionImageRequest, '/api/og/occasion-image?o=birthday&d=2026-10-23&sun=libra&moon=aries&score=74&v=good'],
  ['share-birthday', handleBirthdayImageRequest, '/api/og/birthday-image?d=05-03'],
  ['share-birthday-cusp', handleBirthdayImageRequest, '/api/og/birthday-image?d=04-20'],
  ['share-birthday-famous', handleBirthdayImageRequest, '/api/og/birthday-image?d=05-04'],
  ['share-sky-calendar', handleSkyCalendarImageRequest, '/api/og/sky-calendar-image?k=retrograde&b=mercury&d=2026-10-24'],
  ['share-horoscope', handleHoroscopeImageRequest, `/api/og/horoscope-image?s=leo&d=${generatedFor}`],
];
await mkdir(resolve(out), { recursive: true });
for (const [name, handle, path] of IMAGES) {
  const response = await handle(new Request(`https://zodiacs.org${path}`));
  if (response.status !== 200) throw new Error(`${name}: ${response.status}`);
  await writeFile(resolve(out, `${name}.jpg`), Buffer.from(await response.arrayBuffer()));
}
console.log(`Rendered ${IMAGES.length} share images in ${out}.`);
