/**
 * Small variants of the cards' artwork, for the assistant panels and the
 * share images. Sources: the twelve sign panels (public/assets/sign-art/
 * <sign>-720.webp) and the cards' own pieces (public/assets/card-art/
 * <name>-720.webp, 3:2). Writes:
 *
 *   public/assets/card-art/panel/<key>-400.webp and -480.webp, inlined into
 *     the self-contained panels by build-occasions-panel.mjs and
 *     build-horoscope-panel.mjs (they make no image requests);
 *   public/assets/card-art/share/<key>-640.jpg, read by the share image
 *     renderer (src/server/result-preview.ts), which cannot decode WebP.
 *
 * Run by hand after changing a source: node scripts/build-card-art.mjs.
 * Like the figure assets and cabinet materials, the encodes are libvips
 * output and not byte-stable across platforms, so they are not in the drift
 * job; the panels' own drift check covers what they embed.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
export const CARD_ART_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
export const CARD_ART_PIECES = ['wedding-hero', 'sky-calendar-hero', 'milestones-hero', 'twins-hero'];

const sources = [
  ...CARD_ART_SIGNS.map((key) => [key, `public/assets/sign-art/${key}-720.webp`]),
  ...CARD_ART_PIECES.map((key) => [key, `public/assets/card-art/${key}-720.webp`]),
];

export async function buildCardArt() {
  await mkdir(new URL('public/assets/card-art/panel/', root), { recursive: true });
  await mkdir(new URL('public/assets/card-art/share/', root), { recursive: true });
  let total = 0;
  for (const [key, path] of sources) {
    const input = new URL(path, root).pathname;
    for (const [width, quality] of [[400, 62], [480, 60]]) {
      const bytes = await sharp(input).resize({ width }).webp({ quality, effort: 6 }).toBuffer();
      await writeFile(new URL(`public/assets/card-art/panel/${key}-${width}.webp`, root), bytes);
      total += bytes.length;
    }
    const share = await sharp(input).resize({ width: 640 }).jpeg({ quality: 74, mozjpeg: true }).toBuffer();
    await writeFile(new URL(`public/assets/card-art/share/${key}-640.jpg`, root), share);
    total += share.length;
  }
  console.log(`Built card art for ${sources.length} pieces (${Math.round(total / 1024)} KB)`);
}

if (import.meta.url === `file://${process.argv[1]}`) await buildCardArt();
