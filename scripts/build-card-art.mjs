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
 *     <key>-light-400.avif and -light-480.avif, retained from the earlier
 *     inline panel design. Current chat panels use the larger published
 *     masters, so these variants remain for older build references;
 *   public/assets/card-art/share/<sign>-1200.jpg and <piece>-720.jpg or
 *     <piece>-1200.jpg, read
 *     by the share image renderer (src/server/result-preview.ts), which
 *     cannot decode WebP. The share images run the art across the whole
 *     1200x630 picture, so they take the largest source there is: the sign
 *     panels' 1200px originals in public/assets/sign-art/ and the pieces'
 *     largest masters. They are dark cards, so they take the dark twins only,
 *     with the cards' dimming of the dark art (saturate .92, brightness .86)
 *     baked in, so the renderer draws them as they are.
 *
 * Run by hand after changing a source: node scripts/build-card-art.mjs.
 * A new piece starts as a 1536x1024 PNG named <key>-source.png (dark) or
 * <key>-light-source.png (daylight twin); `node scripts/build-card-art.mjs
 * --masters <dir>` writes the 720px masters from every such PNG in <dir>.
 * The three October 18 portrait pieces also have original 1536x2736 PNGs;
 * `--hires-masters <dir>` crops them to the existing composition and writes
 * 1200x800 WebP masters. See CARD-ART.md for their source job IDs.
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
export const CARD_ART_HIRES_PIECES = ['sky-calendar-hero', 'milestones-hero', 'twins-hero'];
const HIRES_CROP_Y = { 'sky-calendar-hero': 764, 'milestones-hero': 891, 'twins-hero': 772 };
/** One AVIF quality for the retained small panel variants, both twins. */
const PANEL_QUALITY = 36;

const sources = [
  ...CARD_ART_SIGNS.map((key) => [key, `public/assets/sign-art/${key}-720.webp`]),
  ...CARD_ART_PIECES.map((key) => [key, `public/assets/card-art/${key}-720.webp`]),
];
const lightSources = [...CARD_ART_SIGNS, ...CARD_ART_PIECES].map((key) => [`${key}-light`, `public/assets/card-art/${key}-light-720.webp`]);
/** The share images' sources and widths: each picture's largest master. */
export const SHARE_ART = [
  ...CARD_ART_SIGNS.map((key) => [key, `public/assets/sign-art/${key}-1200.webp`, 1200]),
  ...CARD_ART_PIECES.map((key) => {
    const width = CARD_ART_HIRES_PIECES.includes(key) ? 1200 : 720;
    return [key, `public/assets/card-art/${key}-${width}.webp`, width];
  }),
];

/** CSS saturate(s) as a colour matrix (Filter Effects, feColorMatrix type="saturate"). */
function saturate(s) {
  return [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
}

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
  for (const [key, path, width] of SHARE_ART) {
    const share = await sharp(new URL(path, root).pathname).resize({ width }).recomb(saturate(0.92)).linear(0.86, 0)
      .jpeg({ quality: 74, mozjpeg: true }).toBuffer();
    await writeFile(new URL(`public/assets/card-art/share/${key}-${width}.jpg`, root), share);
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

/** Preserve the chosen 3:2 crop when rebuilding from the original portrait PNGs. */
export async function buildCardArtHiresMasters(dir) {
  for (const key of CARD_ART_HIRES_PIECES) {
    for (const theme of ['', '-light']) {
      const input = join(dir, `${key}${theme}-source.png`);
      const bytes = await sharp(input)
        .extract({ left: 0, top: HIRES_CROP_Y[key], width: 1536, height: 1024 })
        .resize(1200, 800)
        .webp({ quality: 90, effort: 6 })
        .toBuffer();
      await writeFile(new URL(`public/assets/card-art/${key}${theme}-1200.webp`, root), bytes);
    }
  }
  console.log(`Wrote high-resolution card art masters for ${CARD_ART_HIRES_PIECES.length} pieces and their daylight twins`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const at = process.argv.indexOf('--masters');
  const hiresAt = process.argv.indexOf('--hires-masters');
  if (hiresAt > 0) await buildCardArtHiresMasters(process.argv[hiresAt + 1]);
  else if (at > 0) await buildCardArtMasters(process.argv[at + 1]);
  else await buildCardArt();
}
