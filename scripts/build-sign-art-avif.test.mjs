import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { AVIF_WIDTHS } from './build-sign-art-avif.mjs';
import { SIGN_ORDER } from './sign-data.mjs';
import { SIGN_ART_AVIF_WIDTHS, signArtAvifSrcset } from '../src/lib/sign-art.ts';

const dir = resolve(import.meta.dirname, '../public/assets/sign-art');

describe('sign-art AVIF copies', () => {
  it('names the widths the generator writes', () => {
    expect([...SIGN_ART_AVIF_WIDTHS]).toEqual(AVIF_WIDTHS);
    expect(signArtAvifSrcset('leo')).toBe(
      '/assets/sign-art/leo-720.avif 720w, /assets/sign-art/leo-960.avif 960w, /assets/sign-art/leo-1200.avif 1200w',
    );
  });

  it('publishes every sign at every width, 3:2 and lighter than its WebP', async () => {
    for (const sign of SIGN_ORDER) {
      const webp = readFileSync(resolve(dir, `${sign}-1200.webp`)).length;
      for (const width of AVIF_WIDTHS) {
        const file = resolve(dir, `${sign}-${width}.avif`);
        const meta = await sharp(file).metadata();
        expect([meta.format, meta.width, meta.height], `${sign}-${width}`).toEqual(['heif', width, (width * 2) / 3]);
        expect(meta.compression, `${sign}-${width}`).toBe('av1');
        expect(readFileSync(file).length, `${sign}-${width}`).toBeLessThan(webp);
      }
    }
  });
});
