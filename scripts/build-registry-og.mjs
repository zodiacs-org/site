/**
 * The Registry's share cards: the twelve catalogue lot cards and the hub
 * card the Registry and its technical page share.
 *
 * v4 (2026-10-19) is the current family. Each lot card is v3's composition,
 * the sign's canonical high-resolution pastel disc and normalized gold
 * sculpture, laid on a text plate whose footer row carries the brand lockup
 * (DESIGN.md, "Brand Lockup"); the hub card is the Registry card with the
 * same footer row. The plates and the hub card are drawn in Chromium by
 * `npm run data:og -- --only-registry` (scripts/build-og-void.mjs), which
 * hands them to buildRegistryOgFamily below. Chromium's text is not
 * byte-stable across platforms, so CI verifies the committed family
 * (scripts/verify-registry-og.mjs) instead of re-rendering it.
 *
 * v3 is frozen: its twelve cards, built on the pinned v2 plates
 * (/assets/og/v2/registry/{sign}.png), stay published byte for byte for the
 * links already shared, as does /assets/og/v2/registry.png.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SIGN_ORDER } from './sign-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The frozen v3 family, verified as published. */
export const REGISTRY_OG_V3 = Object.freeze({
  version: 'v3',
  base: '/assets/og/registry/v3',
  plateSource: '/assets/og/v2/registry/{sign}.png',
  geometry: Object.freeze({
    width: 1200,
    height: 630,
    footerRuleY: 546,
    sculptureBox: Object.freeze({ left: 640, top: 38, width: 500, height: 492 }),
    seal: Object.freeze({ left: 1012, top: 397, iconSize: 118, ringSize: 138 }),
  }),
});

export const REGISTRY_OG_VERSION = 'v4';
export const REGISTRY_OG_BASE = `/assets/og/registry/${REGISTRY_OG_VERSION}`;
/** The Registry hub's and the technical page's card. */
export const REGISTRY_OG_HUB = `${REGISTRY_OG_BASE}/hub.png`;
/**
 * v3's geometry. The art field now stops at the footer rule, so the footer
 * row the plate draws below it (the lockup, then the page's address on the
 * right) shows in full.
 */
export const REGISTRY_OG_GEOMETRY = Object.freeze({
  ...REGISTRY_OG_V3.geometry,
  fieldBottom: REGISTRY_OG_V3.geometry.footerRuleY,
});
export const REGISTRY_OG_ICON_SOURCE = '/assets/sdk/zodiac-icons/circle/{sign}.png';
export const REGISTRY_OG_SCULPTURE_SOURCE = '/assets/sculptures/1024/{sign}.webp';
export const REGISTRY_OG_DIRECTORY = resolve(root, `public${REGISTRY_OG_BASE}`);

const VOID = '#060709';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourcePath = (rootDirectory, template, sign) => resolve(
  rootDirectory,
  'public',
  template.replace('{sign}', sign).replace(/^\//, ''),
);
/** The cards' encoding: one 8-bit palette, as v3 wrote it. */
const encode = (input) => sharp(input)
  .png({ palette: true, colours: 256, dither: 0.45, compressionLevel: 9, effort: 10 })
  .toBuffer();

function rightFieldSvg() {
  const { width, height, fieldBottom } = REGISTRY_OG_GEOMETRY;
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="seam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${VOID}" stop-opacity="0"/>
        <stop offset="1" stop-color="${VOID}" stop-opacity="1"/>
      </linearGradient>
      <radialGradient id="gold" cx="50%" cy="46%" r="52%">
        <stop offset="0" stop-color="#A96D27" stop-opacity=".18"/>
        <stop offset=".42" stop-color="#704018" stop-opacity=".075"/>
        <stop offset="1" stop-color="${VOID}" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="field"><rect x="0" y="0" width="${width}" height="${fieldBottom}"/></clipPath>
    </defs>
    <g clip-path="url(#field)">
      <rect x="660" y="0" width="540" height="${fieldBottom}" fill="${VOID}"/>
      <rect x="590" y="0" width="110" height="${fieldBottom}" fill="url(#seam)"/>
      <ellipse cx="895" cy="288" rx="292" ry="285" fill="url(#gold)"/>
    </g>
  </svg>`);
}

function sealRingSvg() {
  const size = REGISTRY_OG_GEOMETRY.seal.ringSize;
  const center = size / 2;
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${center}" cy="${center}" r="65" fill="${VOID}" fill-opacity=".72" stroke="#D5A45F" stroke-width="2"/>
    <circle cx="${center}" cy="${center}" r="68" fill="none" stroke="#EEF1F7" stroke-opacity=".14" stroke-width="1"/>
  </svg>`);
}

function footerRuleSvg() {
  const { width, height, footerRuleY } = REGISTRY_OG_GEOMETRY;
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <line x1="88" y1="${footerRuleY}" x2="1112" y2="${footerRuleY}" stroke="#C6CCDA" stroke-opacity=".10" stroke-width="1"/>
  </svg>`);
}

async function normalizeSculpture(bytes) {
  const { width, height } = REGISTRY_OG_GEOMETRY.sculptureBox;
  return sharp(bytes)
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .resize(width, height, {
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer({ resolveWithObject: true });
}

/** One lot card: the sign's sculpture and seal laid on its plate. */
export async function composeRegistryCard(rootDirectory, sign, plate) {
  const [iconSource, sculptureSource] = await Promise.all([
    readFile(sourcePath(rootDirectory, REGISTRY_OG_ICON_SOURCE, sign)),
    readFile(sourcePath(rootDirectory, REGISTRY_OG_SCULPTURE_SOURCE, sign)),
  ]);
  const sculpture = await normalizeSculpture(sculptureSource);
  const { sculptureBox, seal } = REGISTRY_OG_GEOMETRY;
  const sculptureLeft = sculptureBox.left + Math.round((sculptureBox.width - sculpture.info.width) / 2);
  const sculptureTop = sculptureBox.top + Math.round((sculptureBox.height - sculpture.info.height) / 2);
  const ringLeft = seal.left - Math.round((seal.ringSize - seal.iconSize) / 2);
  const ringTop = seal.top - Math.round((seal.ringSize - seal.iconSize) / 2);
  const icon = await sharp(iconSource)
    .resize(seal.iconSize, seal.iconSize, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const composed = await sharp(plate)
    .composite([
      { input: rightFieldSvg(), left: 0, top: 0 },
      { input: sculpture.data, left: sculptureLeft, top: sculptureTop },
      { input: sealRingSvg(), left: ringLeft, top: ringTop },
      { input: icon, left: seal.left, top: seal.top },
      { input: footerRuleSvg(), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
  return {
    bytes: await encode(composed),
    sourceSha256: {
      plate: hash(plate),
      icon: hash(iconSource),
      sculpture: hash(sculptureSource),
    },
  };
}

/**
 * Writes the v4 family from the plates and the hub card build-og-void.mjs
 * drew: `plates` maps each sign to its plate's PNG, `hub` is the hub card's.
 */
export async function buildRegistryOgFamily({
  plates,
  hub,
  rootDirectory = root,
  outputDirectory = resolve(rootDirectory, `public${REGISTRY_OG_BASE}`),
}) {
  if (!(plates instanceof Map) || SIGN_ORDER.some((sign) => !plates.has(sign)) || !hub) {
    throw new Error('buildRegistryOgFamily needs a plate for every sign and the hub card; run npm run data:og -- --only-registry');
  }
  await mkdir(outputDirectory, { recursive: true });
  const cards = [];
  for (const sign of SIGN_ORDER) {
    const rendered = await composeRegistryCard(rootDirectory, sign, plates.get(sign));
    const filename = `${sign}.png`;
    await writeFile(resolve(outputDirectory, filename), rendered.bytes);
    cards.push({
      sign,
      image: `${REGISTRY_OG_BASE}/${filename}`,
      sha256: hash(rendered.bytes),
      sourceSha256: rendered.sourceSha256,
    });
  }
  const hubBytes = await encode(hub);
  await writeFile(resolve(outputDirectory, 'hub.png'), hubBytes);

  const manifest = {
    schema: 'zodiacs.registry-og.v4',
    version: REGISTRY_OG_VERSION,
    base: REGISTRY_OG_BASE,
    type: 'image/png',
    width: REGISTRY_OG_GEOMETRY.width,
    height: REGISTRY_OG_GEOMETRY.height,
    plateSource: 'scripts/build-og-void.mjs --only-registry (drawn in Chromium, not published)',
    iconSource: REGISTRY_OG_ICON_SOURCE,
    sculptureSource: REGISTRY_OG_SCULPTURE_SOURCE,
    geometry: REGISTRY_OG_GEOMETRY,
    hub: { image: REGISTRY_OG_HUB, sha256: hash(hubBytes) },
    cards,
  };
  await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.error('The Registry cards are drawn with the other share cards: npm run data:og -- --only-registry');
  process.exit(1);
}
