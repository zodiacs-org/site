/**
 * Small variants of the cards' artwork, for the assistant panels and the
 * share images. Every piece has two twins: the dark one, for the dark host
 * theme, and a daylight twin with the same subject, framing and camera,
 * for the light theme. Sources, all 720px masters at 3:2:
 *
 *   the twelve sign panels, public/assets/sign-art/<sign>-720.webp (dark);
 *   the cards' own pieces, public/assets/card-art/<name>-720.webp (dark);
 *   every daylight twin, public/assets/card-art/<key>-light-720.webp.
 *
 * Writes:
 *
 *   public/assets/card-art/panel/<key>-400.avif and -480.avif, and
 *     <key>-light-400.avif and -light-480.avif, inlined into the
 *     self-contained panels by build-occasions-panel.mjs and
 *     build-horoscope-panel.mjs (they make no image requests). AVIF, because
 *     both twins of every piece must fit each panel's 600 KB budget: at the
 *     same sizes it is about half the bytes of WebP for the same look;
 *   public/assets/card-art/share/<key>-640.jpg, read by the share image
 *     renderer (src/server/result-preview.ts), which cannot decode WebP. The
 *     share images are dark cards, so they take the dark twins only.
 *
 * Run by hand after changing a source: node scripts/build-card-art.mjs.
 * A new piece starts as a 1536x1024 PNG named <key>-source.png (dark) or
 * <key>-light-source.png (daylight twin); `node scripts/build-card-art.mjs
 * --masters <dir>` writes the 720px masters from every such PNG in <dir>.
 * Like the figure assets and cabinet materials, the encodes are libvips
 * output and not byte-stable across platforms, so they are not in the drift
 * job; the panels' own drift check covers what they embed.
 */
import sharp from 'sharp';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../', import.meta.url);
export const CARD_ART_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
export const CARD_ART_PIECES = ['wedding-hero', 'sky-calendar-hero', 'milestones-hero', 'twins-hero'];
/** One AVIF quality for every panel variant, both twins, chosen to keep both panels under budget. */
const PANEL_QUALITY = 36;

const sources = [
  ...CARD_ART_SIGNS.map((key) => [key, `public/assets/sign-art/${key}-720.webp`]),
  ...CARD_ART_PIECES.map((key) => [key, `public/assets/card-art/${key}-720.webp`]),
];
const lightSources = [...CARD_ART_SIGNS, ...CARD_ART_PIECES].map((key) => [`${key}-light`, `public/assets/card-art/${key}-light-720.webp`]);

export async function buildCardArt() {
  await mkdir(new URL('public/assets/card-art/panel/', root), { recursive: true });
  await mkdir(new URL('public/assets/card-art/share/', root), { recursive: true });
  let total = 0;
  for (const [key, path] of [...sources, ...lightSources]) {
    const input = new URL(path, root).pathname;
    for (const width of [400, 480]) {
      const bytes = await sharp(input).resize({ width }).avif({ quality: PANEL_QUALITY, effort: 6 }).toBuffer();
      await writeFile(new URL(`public/assets/card-art/panel/${key}-${width}.avif`, root), bytes);
      total += bytes.length;
    }
  }
  for (const [key, path] of sources) {
    const share = await sharp(new URL(path, root).pathname).resize({ width: 640 }).jpeg({ quality: 74, mozjpeg: true }).toBuffer();
    await writeFile(new URL(`public/assets/card-art/share/${key}-640.jpg`, root), share);
    total += share.length;
  }
  console.log(`Built card art for ${sources.length} pieces and their daylight twins (${Math.round(total / 1024)} KB)`);
}

/** The 720px masters, from 1536x1024 sources named <key>-source.png or <key>-light-source.png. */
export async function buildCardArtMasters(dir) {
  const names = (await readdir(dir)).filter((name) => name.endsWith('-source.png'));
  for (const name of names) {
    const key = name.slice(0, -'-source.png'.length);
    const bytes = await sharp(join(dir, name)).resize({ width: 720, height: 480, fit: 'cover' }).webp({ quality: 80, effort: 6 }).toBuffer();
    await writeFile(new URL(`public/assets/card-art/${key}-720.webp`, root), bytes);
  }
  console.log(`Wrote ${names.length} card art masters`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const at = process.argv.indexOf('--masters');
  if (at > 0) await buildCardArtMasters(process.argv[at + 1]);
  else await buildCardArt();
}
