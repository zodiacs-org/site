/**
 * The brand lockup's tilted ring as files, for the places that cannot draw it
 * inline: public/assets/brand/tilted-ring.svg, and a PNG at three times the
 * lockup's 13px size (102 x 57, shown at 34 x 19) for emails, which travel
 * it as an inline attachment (scripts/build-email-inline-images.mjs).
 *
 *   node scripts/build-brand-lockup-assets.mjs
 *
 * The SVG is text and re-derives byte for byte from src/lib/brand-lockup.mjs.
 * The PNG is libvips output, which is not byte-stable across platforms, so it
 * is committed and kept out of the drift job, as the card art is; rerun this
 * script when the ring changes.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { tiltedRingSvg, ringWidthFor, tiltedRingHeight, LOCKUP_SIZE } from '../src/lib/brand-lockup.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'public/assets/brand');

/** The standalone SVG file: the inline ring with the SVG namespace. */
export function tiltedRingFile(width = ringWidthFor(LOCKUP_SIZE.page)) {
  return `${tiltedRingSvg({ width }).replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace(' aria-hidden="true" focusable="false"', '')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await mkdir(OUT, { recursive: true });
  const svg = tiltedRingFile();
  await writeFile(resolve(OUT, 'tilted-ring.svg'), svg);
  // Three times the 13px lockup's ring (34 x 19), so it stays sharp on dense screens.
  const [width, height] = [ringWidthFor(LOCKUP_SIZE.page) * 3, tiltedRingHeight(ringWidthFor(LOCKUP_SIZE.page)) * 3];
  await sharp(Buffer.from(svg), { density: 72 * 3 })
    .resize(width, height, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toFile(resolve(OUT, 'tilted-ring@3x.png'));
  console.log(`brand-lockup-assets: wrote ${OUT}/tilted-ring.svg and tilted-ring@3x.png (${width} x ${height})`);
}
