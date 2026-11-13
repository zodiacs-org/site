import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  ASTROFOLIO_SHARE_CARD_FILM,
  ASTROFOLIO_SHARE_CARD_FRAMES,
  ASTROFOLIO_SHARE_CARD_MAX_BYTES,
  ASTROFOLIO_SHARE_CARD_PATH,
} from './build-astrofolio-share-card.mjs';
import { SIGN_ORDER } from './sign-data.mjs';
import { stampAstrofolioSeason } from './stamp-astrofolio-season.mjs';
import { OG_EN } from '../src/strings/seo.en.mjs';

const root = resolve(import.meta.dirname, '..');
const read = (path) => readFile(resolve(root, path), 'utf8');

describe('Astrofolio share card (Faces)', () => {
  it('takes one frame of the film for each sign, in zodiac order', async () => {
    expect(ASTROFOLIO_SHARE_CARD_FRAMES.map(({ sign }) => sign)).toEqual(SIGN_ORDER);
    expect(ASTROFOLIO_SHARE_CARD_FILM).toBe('/assets/fomo/fomo-film-av1.mp4');
    await expect(readFile(resolve(root, `public${ASTROFOLIO_SHARE_CARD_FILM}`))).resolves.toBeTruthy();
    for (const { sign, time, focusY } of ASTROFOLIO_SHARE_CARD_FRAMES) {
      // Halfway through a frame of the 6.92-second, 25 fps film, so a seek
      // can never land on the frame either side.
      expect(time, sign).toBeGreaterThan(0);
      expect(time, sign).toBeLessThan(6.92);
      expect(Math.abs((time * 25) % 1 - 0.5), sign).toBeLessThan(0.01);
      expect(focusY, sign).toBeGreaterThanOrEqual(0);
      expect(focusY, sign).toBeLessThanOrEqual(100);
    }
  });

  it('signs the band with the brand lockup, and keeps v5 published for links already shared', async () => {
    expect(ASTROFOLIO_SHARE_CARD_PATH).toBe('/assets/og/astrofolio/v6/faces.jpg');
    const source = await read('scripts/build-astrofolio-share-card.mjs');
    expect(source).toContain('tiltedRingSvg({ width: ringWidthFor(LOCKUP_SIZE.image) })');
    expect(source).toContain("lockupWordsHtml({ name: 'lockup-name', sep: 'lockup-sep', tld: 'lockup-tld' })");
    expect(source).not.toContain('<span class="domain">');
    await expect(readFile(resolve(root, 'public/assets/og/astrofolio/v5/faces.jpg'))).resolves.toBeTruthy();
  });

  it('commits a 1200×630 JPEG small enough for chat-app previews', async () => {
    const bytes = await readFile(resolve(root, `public${ASTROFOLIO_SHARE_CARD_PATH}`));
    const metadata = await sharp(bytes).metadata();
    expect(metadata).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
    expect(bytes.length).toBeLessThanOrEqual(ASTROFOLIO_SHARE_CARD_MAX_BYTES);
  });

  it('is the one image /astrofolio/ shares, whatever the season', async () => {
    expect(OG_EN.astrofolio.image).toBe(ASTROFOLIO_SHARE_CARD_PATH);
    const shell = await read('public/astrofolio/index.html');
    const card = `https://zodiacs.org${ASTROFOLIO_SHARE_CARD_PATH}`;
    expect(shell).toContain(`<meta property="og:image" content="${card}" />`);
    expect(shell).toContain('<meta property="og:image:type" content="image/jpeg" />');
    expect(shell).toContain(`<meta name="twitter:image" content="${card}" />`);
    expect(shell).toContain(`"url": "${card}",`);
    expect(shell).not.toContain('/assets/og/astrofolio/v4/');
    const registry = JSON.parse(await read('public/registry/zodiacs.registry.json'));
    for (const sign of ['aries', 'libra', 'pisces']) {
      const stamped = stampAstrofolioSeason(shell, sign, { registry });
      expect(stamped.split(card), sign).toHaveLength(4);
      expect(stamped, sign).not.toContain('/assets/og/astrofolio/v4/');
    }
  });
});
