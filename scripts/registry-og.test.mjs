import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { SIGN_ORDER } from './sign-data.mjs';
import {
  REGISTRY_OG_BASE,
  REGISTRY_OG_GEOMETRY,
  REGISTRY_OG_HUB,
  REGISTRY_OG_V3,
  REGISTRY_OG_VERSION,
} from './build-registry-og.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const family = resolve(root, `public/assets/og/registry/${REGISTRY_OG_VERSION}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** How many pixels of a region are near-white type, the lockup's words and the address. */
async function inkPixels(bytes, region) {
  const pixels = await sharp(bytes).extract(region).removeAlpha().raw().toBuffer();
  let ink = 0;
  for (let offset = 0; offset < pixels.length; offset += 3) {
    if (pixels[offset] > 120 && pixels[offset + 1] > 120 && pixels[offset + 2] > 120) ink += 1;
  }
  return ink;
}

describe('Registry catalogue OG v4', () => {
  it('uses a new cache-busting family, centers the seal ring exactly and keeps the art above the footer row', () => {
    expect(REGISTRY_OG_VERSION).toBe('v4');
    expect(REGISTRY_OG_BASE).toBe('/assets/og/registry/v4');
    expect(REGISTRY_OG_HUB).toBe('/assets/og/registry/v4/hub.png');
    const { seal, sculptureBox, footerRuleY, fieldBottom } = REGISTRY_OG_GEOMETRY;
    const ringLeft = seal.left - (seal.ringSize - seal.iconSize) / 2;
    const ringTop = seal.top - (seal.ringSize - seal.iconSize) / 2;
    expect(ringLeft + seal.ringSize / 2).toBe(seal.left + seal.iconSize / 2);
    expect(ringTop + seal.ringSize / 2).toBe(seal.top + seal.iconSize / 2);
    expect(ringTop + seal.ringSize).toBeLessThan(footerRuleY);
    expect(sculptureBox.top + sculptureBox.height).toBeLessThan(footerRuleY);
    expect(fieldBottom).toBe(footerRuleY);
    const { fieldBottom: _, ...v3Geometry } = REGISTRY_OG_GEOMETRY;
    expect(v3Geometry).toEqual(REGISTRY_OG_V3.geometry);
  });

  it('publishes twelve unique 1200x630 cards with visible gold sculpture pixels and the lockup in the footer row', async () => {
    const manifest = JSON.parse(await readFile(resolve(family, 'manifest.json'), 'utf8'));
    expect(manifest.cards.map(({ sign }) => sign)).toEqual(SIGN_ORDER);
    expect(manifest.iconSource).toBe('/assets/sdk/zodiac-icons/circle/{sign}.png');
    expect(manifest.sculptureSource).toBe('/assets/sculptures/1024/{sign}.webp');
    expect(manifest.hub.image).toBe(REGISTRY_OG_HUB);

    const hashes = new Set();
    for (const sign of SIGN_ORDER) {
      const bytes = await readFile(resolve(family, `${sign}.png`));
      const metadata = await sharp(bytes).metadata();
      expect([metadata.format, metadata.width, metadata.height]).toEqual(['png', 1200, 630]);
      hashes.add(sha256(bytes));

      const region = await sharp(bytes)
        .extract({ left: 640, top: 38, width: 500, height: 492 })
        .removeAlpha()
        .raw()
        .toBuffer();
      let goldPixels = 0;
      for (let offset = 0; offset < region.length; offset += 3) {
        const red = region[offset];
        const green = region[offset + 1];
        const blue = region[offset + 2];
        if (red > 92 && green > 55 && red > green * 1.18 && green > blue * 1.22) goldPixels += 1;
      }
      expect(goldPixels, `${sign} sculpture`).toBeGreaterThan(1200);
      // The footer row: ZODIACS · ORG on the left, the page's address on the right.
      expect(await inkPixels(bytes, { left: 88, top: 560, width: 300, height: 60 }), `${sign} lockup`).toBeGreaterThan(150);
      expect(await inkPixels(bytes, { left: 860, top: 560, width: 252, height: 60 }), `${sign} address`).toBeGreaterThan(60);
    }
    expect(hashes.size).toBe(SIGN_ORDER.length);
    const hub = await readFile(resolve(family, 'hub.png'));
    expect(sha256(hub)).toBe(manifest.hub.sha256);
    expect(await inkPixels(hub, { left: 88, top: 560, width: 300, height: 60 })).toBeGreaterThan(150);
  });

  it('wires every Registry page to the matching v4 OG and Twitter card, and the hub and technical pages to the hub card', async () => {
    for (const sign of SIGN_ORDER) {
      const page = await readFile(resolve(root, `public/registry/${sign}/index.html`), 'utf8');
      const url = `https://zodiacs.org${REGISTRY_OG_BASE}/${sign}.png`;
      expect(page).toContain(`<meta property="og:image" content="${url}" />`);
      expect(page).toContain(`<meta name="twitter:image" content="${url}" />`);
      expect(page).not.toContain(`/assets/og/v2/registry/${sign}.png`);
      expect(page).not.toContain(`${REGISTRY_OG_V3.base}/${sign}.png`);
    }
    for (const path of ['public/registry/index.html', 'public/registry/technical/index.html']) {
      const page = await readFile(resolve(root, path), 'utf8');
      const url = `https://zodiacs.org${REGISTRY_OG_HUB}`;
      expect(page, path).toContain(`<meta property="og:image" content="${url}" />`);
      expect(page, path).toContain(`<meta name="twitter:image" content="${url}" />`);
      expect(page, path).not.toContain('/assets/og/v2/registry.png');
    }
  });

  it('keeps the v3 family published byte for byte for the links already shared', async () => {
    const manifest = JSON.parse(await readFile(resolve(root, `public${REGISTRY_OG_V3.base}/manifest.json`), 'utf8'));
    expect(manifest.version).toBe('v3');
    for (const card of manifest.cards) {
      const bytes = await readFile(resolve(root, `public${REGISTRY_OG_V3.base}/${card.sign}.png`));
      expect(sha256(bytes), card.sign).toBe(card.sha256);
    }
  });
});
