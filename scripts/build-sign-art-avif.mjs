/*
 * Generates the AVIF copies of the twelve sign paintings:
 *
 *   public/assets/sign-art/{sign}-{720,960,1200}.avif
 *
 * The source is each sign's published 1200px WebP, which stays untouched.
 * The compatibility pair pages offer these copies to screens at 1.5x and
 * above (src/lib/sign-art.ts, SIGN_ART_AVIF_*); 1x screens keep the WebP.
 * At this quality the rendered paintings differ from the WebP by encoder
 * noise only (about 42 dB PSNR on a 3x phone) at roughly 60% of the bytes.
 *
 * libaom output is not byte-stable across platforms, so CI does not
 * regenerate these; scripts/build-sign-art-avif.test.mjs checks that every
 * file exists at its width.
 *
 *   node scripts/build-sign-art-avif.mjs
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { SIGN_ORDER } from './sign-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'public/assets/sign-art');

export const AVIF_WIDTHS = [720, 960, 1200];
export const SOURCE_SIZE = { width: 1200, height: 800 };
const AVIF_OPTIONS = { quality: 55, effort: 6, chromaSubsampling: '4:4:4' };

async function main() {
  for (const sign of SIGN_ORDER) {
    const source = resolve(dir, `${sign}-1200.webp`);
    const meta = await sharp(source).metadata();
    if (meta.width !== SOURCE_SIZE.width || meta.height !== SOURCE_SIZE.height) {
      throw new Error(`${sign}-1200.webp is ${meta.width}x${meta.height}, expected 1200x800.`);
    }
    for (const width of AVIF_WIDTHS) {
      const height = Math.round((width * SOURCE_SIZE.height) / SOURCE_SIZE.width);
      const image = sharp(source);
      if (width !== SOURCE_SIZE.width) image.resize(width, height, { kernel: 'lanczos3' });
      const info = await image.avif(AVIF_OPTIONS).toFile(resolve(dir, `${sign}-${width}.avif`));
      console.log(`${sign}-${width}.avif ${(info.size / 1024).toFixed(1)} KB`);
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
