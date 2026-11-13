/**
 * Deterministic seasonal identity assets for the consumer Astrofolio surface.
 *
 * Inputs are the canonical Registry order/date ranges, pastel 128px sign art,
 * and transparent gold sculptures used only by the OG cards. Outputs live
 * under an immutable version so route metadata can move seasons without
 * mutating old social URLs.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SIGN_ORDER } from './sign-data.mjs';
import { seasonsFromRegistry } from './astrofolio-season.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const ASTROFOLIO_IDENTITY_VERSION = 'v2';
export const ASTROFOLIO_IDENTITY_BASE = `/assets/astrofolio/${ASTROFOLIO_IDENTITY_VERSION}`;
export const ASTROFOLIO_OG_VERSION = 'v4';
export const ASTROFOLIO_OG_BASE = `/assets/og/astrofolio/${ASTROFOLIO_OG_VERSION}`;
export const TERMINAL_OG_V6_PATH = '/assets/og/v6/terminal.png';
export const ASTROFOLIO_OG_MOTIF_GEOMETRY = Object.freeze({
  size: 636,
  centerX: 877,
  centerY: 315,
  sculptureBox: 334,
});

const VOID = '#060709';
const INK = '#F4EFE6';
const PASTELS = [
  '#DE8E79', '#B9D4BE', '#B29DD0', '#B6D4E4', '#E0A9B4', '#B7D9B0',
  '#D3A9DE', '#B9DCE8', '#E0B080', '#C0DEA8', '#AE8FC9', '#A9D4C4',
];

const publicPath = (rootDirectory, path) => resolve(rootDirectory, 'public', path.replace(/^\//, ''));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function seasonOrder(sign) {
  const start = SIGN_ORDER.indexOf(sign);
  if (start < 0) throw new Error(`Unknown Astrofolio season: ${sign}`);
  return [...SIGN_ORDER.slice(start), ...SIGN_ORDER.slice(0, start)];
}

async function loadRegistry(rootDirectory) {
  return JSON.parse(await readFile(
    resolve(rootDirectory, 'public/registry/zodiacs.registry.json'),
    'utf8',
  ));
}

async function normalizeOgSculpture(rootDirectory, sign, box = ASTROFOLIO_OG_MOTIF_GEOMETRY.sculptureBox) {
  return sharp(resolve(rootDirectory, `public/assets/sculptures/1024/${sign}.webp`))
    .ensureAlpha()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 6 })
    .resize({ width: box, height: box, fit: 'inside', kernel: 'lanczos3' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

function warmHaloSvg(size, seasonHue) {
  const center = size / 2;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="h"><stop offset="0" stop-color="#E7B85A" stop-opacity=".2"/><stop offset=".46" stop-color="#C88835" stop-opacity=".09"/><stop offset="1" stop-color="#8B5728" stop-opacity="0"/></radialGradient>
      <radialGradient id="s"><stop offset="0" stop-color="${seasonHue}" stop-opacity=".11"/><stop offset=".72" stop-color="${seasonHue}" stop-opacity=".025"/><stop offset="1" stop-color="${seasonHue}" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="${center}" cy="${center - 26}" r="354" fill="url(#h)"/>
    <circle cx="${center}" cy="${center}" r="462" fill="url(#s)"/>
  </svg>`);
}

function orbitLineSvg(size, seasonHue) {
  const center = size / 2;
  const ticks = Array.from({ length: 12 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 6;
    const inner = 342;
    const outer = index === 0 ? 348 : 346;
    const x1 = (center + Math.cos(angle) * inner).toFixed(2);
    const y1 = (center + Math.sin(angle) * inner).toFixed(2);
    const x2 = (center + Math.cos(angle) * outer).toFixed(2);
    const y2 = (center + Math.sin(angle) * outer).toFixed(2);
    return `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${index === 0 ? seasonHue : INK}" stroke-opacity="${index === 0 ? '.72' : '.24'}" stroke-width="${index === 0 ? '2' : '1'}"/>`;
  }).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="365" fill="none" stroke="${INK}" stroke-opacity=".16" stroke-width="1"/>
    <circle cx="${center}" cy="${center}" r="348" fill="none" stroke="${seasonHue}" stroke-opacity=".085" stroke-width="1" stroke-dasharray="1 9"/>
    ${ticks}
    <path d="M${center - 246} ${center + 248}C${center - 116} ${center + 322} ${center + 126} ${center + 318} ${center + 248} ${center + 230}" fill="none" stroke="${seasonHue}" stroke-opacity=".1"/>
    <path d="M${center - 224} ${center + 270}C${center - 92} ${center + 334} ${center + 122} ${center + 326} ${center + 226} ${center + 250}" fill="none" stroke="#E7B85A" stroke-opacity=".075"/>
  </svg>`);
}

async function composeSeasonalZodiacRing(rootDirectory, season, {
  size = 1024,
  radius = 334,
  discSize = 92,
  withAtmosphere = true,
  withSelectedHalo = true,
  selectedHaloStyle = 'double',
} = {}) {
  const center = size / 2;
  const ordered = seasonOrder(season);
  const discInputs = await Promise.all(ordered.map(async (sign, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 6;
    const input = await sharp(resolve(rootDirectory, `public/assets/zodiac-icons/128/${sign}.webp`))
      .resize(discSize, discSize, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
    return {
      input,
      left: Math.round(center + Math.cos(angle) * radius - discSize / 2),
      top: Math.round(center + Math.sin(angle) * radius - discSize / 2),
    };
  }));
  const seasonHue = PASTELS[SIGN_ORDER.indexOf(season)];
  const selectedHaloSize = Math.round(discSize * 1.2174);
  const selectedDisc = discInputs[0];
  const haloCenter = selectedHaloSize / 2;
  const haloRings = selectedHaloStyle === 'single'
    ? `<circle cx="${haloCenter}" cy="${haloCenter}" r="${haloCenter - 2}" fill="none" stroke="${seasonHue}" stroke-width="3" opacity=".98"/>`
    : `<circle cx="${haloCenter}" cy="${haloCenter}" r="${haloCenter - 5}" fill="none" stroke="${seasonHue}" stroke-width="3" opacity=".94"/><circle cx="${haloCenter}" cy="${haloCenter}" r="${haloCenter - 1}" fill="none" stroke="${INK}" stroke-width="1" opacity=".52"/>`;
  const selectedHalo = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${selectedHaloSize}" height="${selectedHaloSize}" viewBox="0 0 ${selectedHaloSize} ${selectedHaloSize}">${haloRings}</svg>`);
  const selectedCenterX = selectedDisc.left + discSize / 2;
  const selectedCenterY = selectedDisc.top + discSize / 2;

  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    ...(withAtmosphere ? [{ input: orbitLineSvg(size, seasonHue), left: 0, top: 0 }] : []),
    ...(withSelectedHalo ? [{
      input: selectedHalo,
      left: Math.round(selectedCenterX - selectedHaloSize / 2),
      top: Math.round(selectedCenterY - selectedHaloSize / 2),
    }] : []),
    ...discInputs,
  ]).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

export function astrofolioSeasonTitleLayout(displayName) {
  const length = String(displayName ?? '').trim().length;
  if (!length) throw new Error('Astrofolio season title requires a display name');
  if (length <= 5) return { ogTitleSize: 50, ogIconSize: 38, ogGap: 12 };
  if (length <= 7) return { ogTitleSize: 46, ogIconSize: 36, ogGap: 11 };
  if (length <= 9) return { ogTitleSize: 42, ogIconSize: 34, ogGap: 10 };
  return { ogTitleSize: 36, ogIconSize: 32, ogGap: 10 };
}

export function astrofolioOgIdentitySources(season) {
  const index = SIGN_ORDER.indexOf(season?.sign);
  if (index < 0 || !season?.displayName || !season?.dateRange) {
    throw new Error('Astrofolio OG identity requires complete Registry season metadata');
  }
  return {
    sign: season.sign,
    displayName: season.displayName,
    dateRange: season.dateRange,
    hue: PASTELS[index],
    icon: `/assets/zodiac-icons/128/${season.sign}.webp`,
    sculpture: `/assets/sculptures/1024/${season.sign}.webp`,
  };
}

async function composeTransparentZodiacRing(rootDirectory) {
  const size = 192;
  const center = size / 2;
  const radius = 72;
  const discSize = 27;
  const discs = await Promise.all(SIGN_ORDER.map(async (sign, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 6;
    return {
      input: await sharp(resolve(rootDirectory, `public/assets/zodiac-icons/128/${sign}.webp`))
        .resize(discSize, discSize, { kernel: 'lanczos3' })
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer(),
      left: Math.round(center + Math.cos(angle) * radius - discSize / 2),
      top: Math.round(center + Math.sin(angle) * radius - discSize / 2),
    };
  }));
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(discs)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function composeAppIcon(motif, season) {
  const seasonHue = PASTELS[SIGN_ORDER.indexOf(season)];
  return sharp({ create: { width: 1024, height: 1024, channels: 4, background: VOID } })
    .composite([
      { input: warmHaloSvg(1024, seasonHue), left: 0, top: 0 },
      { input: motif, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function faviconGlyphData(rootDirectory, season) {
  const { data, info } = await sharp(
    resolve(rootDirectory, `public/assets/zodiac-icons/128/${season}.webp`),
  ).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const luminance = data[offset] * 0.2126 + data[offset + 1] * 0.7152 + data[offset + 2] * 0.0722;
    const sourceAlpha = data[offset + 3] ?? 255;
    data[offset] = 8;
    data[offset + 1] = 9;
    data[offset + 2] = 11;
    data[offset + 3] = luminance < 105 ? sourceAlpha : 0;
  }
  return sharp(data, { raw: info })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .resize({ width: 18, height: 18, fit: 'inside', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function composeFaviconSvg(rootDirectory, season) {
  const ordered = seasonOrder(season);
  const center = 32;
  const radius = 21;
  const dots = ordered.map((sign, index) => {
    const sourceIndex = SIGN_ORDER.indexOf(sign);
    const angle = -Math.PI / 2 + index * Math.PI / 6;
    const cx = (center + Math.cos(angle) * radius).toFixed(3);
    const cy = (center + Math.sin(angle) * radius).toFixed(3);
    const dotRadius = index === 0 ? 3.3 : 2.65;
    return `<circle cx="${cx}" cy="${cy}" r="${dotRadius}" fill="${PASTELS[sourceIndex]}"/>`;
  }).join('');
  const glyph = await faviconGlyphData(rootDirectory, season);
  const glyphData = glyph.toString('base64');
  const glyphMeta = await sharp(glyph).metadata();
  const glyphX = (32 - glyphMeta.width / 2).toFixed(2);
  const glyphY = (32 - glyphMeta.height / 2).toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${VOID}"/>${dots}<circle cx="32" cy="32" r="11.25" fill="${PASTELS[SIGN_ORDER.indexOf(season)]}"/><image href="data:image/png;base64,${glyphData}" x="${glyphX}" y="${glyphY}" width="${glyphMeta.width}" height="${glyphMeta.height}"/></svg>`;
}

async function rasterizeFavicon(svg, size) {
  return sharp(Buffer.from(svg))
    .resize(size, size, { kernel: size <= 32 ? 'lanczos3' : 'lanczos3' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function loadIdentityFonts(rootDirectory) {
  const [instrument, serif, serifItalic, mono] = await Promise.all([
    'node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2',
    'node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff2',
    'node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-italic.woff2',
    'node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  ].map(async (path) => (
    readFile(resolve(rootDirectory, path)).then((bytes) => bytes.toString('base64'))
  )));
  return { instrument, serif, serifItalic, mono };
}

function seasonDateLabel(dateRange) {
  const match = /^(\d{2})-(\d{2}) to (\d{2})-(\d{2})$/.exec(dateRange);
  if (!match) throw new Error(`Invalid Astrofolio season date range: ${dateRange}`);
  const months = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  ];
  const [, startMonth, startDay, endMonth, endDay] = match;
  return `${months[Number(startMonth) - 1]} ${Number(startDay)} – ${months[Number(endMonth) - 1]} ${Number(endDay)}`;
}

export function astrofolioOgCopy(season, seasonIndex) {
  if (!season?.displayName || !season?.dateRange) throw new Error('Astrofolio OG season metadata is incomplete');
  if (!Number.isInteger(seasonIndex) || seasonIndex < 0 || seasonIndex >= SIGN_ORDER.length) {
    throw new Error(`Invalid Astrofolio OG season index: ${seasonIndex}`);
  }
  return {
    title: 'Astrofolio',
    caption: 'The Twelve Official Zodiacs',
    status: 'NOW IN SEASON',
    season: season.displayName,
    sequence: `${String(seasonIndex + 1).padStart(2, '0')} / 12`,
    dateRange: seasonDateLabel(season.dateRange),
    timeZone: 'UTC',
  };
}

function ogTextSvg(fonts, season, seasonIndex) {
  const seasonHue = PASTELS[SIGN_ORDER.indexOf(season.sign)];
  const copy = astrofolioOgCopy(season, seasonIndex);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>
      @font-face{font-family:Instrument;src:url(data:font/woff2;base64,${fonts.instrument}) format('woff2');font-weight:100 900}
      @font-face{font-family:Editorial;src:url(data:font/woff2;base64,${fonts.serif}) format('woff2');font-weight:500}
      @font-face{font-family:Editorial;src:url(data:font/woff2;base64,${fonts.serifItalic}) format('woff2');font-weight:500;font-style:italic}
      @font-face{font-family:Mono;src:url(data:font/woff2;base64,${fonts.mono}) format('woff2');font-weight:100 800}
    </style>
    <path d="M67 459C202 522 416 515 568 405" fill="none" stroke="${seasonHue}" stroke-opacity=".1" stroke-width="1"/>
    <path d="M88 482C224 532 421 517 554 428" fill="none" stroke="#E7B85A" stroke-opacity=".055" stroke-width="1"/>
    <path d="M552 138V162M540 150H564" stroke="#E7B85A" stroke-opacity=".48" stroke-width="1"/>
    <circle cx="552" cy="150" r="2.5" fill="#E7B85A" fill-opacity=".7"/>
    <circle cx="579" cy="180" r="1.75" fill="${seasonHue}" fill-opacity=".64"/>
    <text x="72" y="258" fill="${INK}" font-family="Editorial,serif" font-size="118" font-weight="500" font-style="italic" letter-spacing="-2.4">${copy.title}</text>
    <text x="80" y="307" fill="#B8B3AA" font-family="Instrument,sans-serif" font-size="21" font-weight="430" letter-spacing=".55">${copy.caption}</text>
    <path d="M80 350H536" stroke="${seasonHue}" stroke-opacity=".3"/>
    <circle cx="80" cy="350" r="3" fill="${seasonHue}"/>
    <text x="82" y="448" fill="#97938C" font-family="Mono,monospace" font-size="11" font-weight="460" letter-spacing="1.45">${copy.dateRange} · ${copy.timeZone}</text>
  </svg>`);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function renderOgEditorialWord(fontData, text, {
  color,
  fontSize,
  italic = false,
  opacity = 1,
}) {
  const word = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="540" height="86" viewBox="0 0 540 86">
    <style>@font-face{font-family:Editorial;src:url(data:font/woff2;base64,${fontData}) format('woff2');font-weight:500;font-style:${italic ? 'italic' : 'normal'}}</style>
    <text x="8" y="64" fill="${color}" fill-opacity="${opacity}" font-family="Editorial,serif" font-size="${fontSize}" font-weight="500" font-style="${italic ? 'italic' : 'normal'}" letter-spacing="-.7">${escapeXml(text)}</text>
  </svg>`);
  return sharp(word)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function composeOgSeasonLockup(rootDirectory, fonts, season) {
  const identity = astrofolioOgIdentitySources(season);
  const layout = astrofolioSeasonTitleLayout(season.displayName);
  const [signWord, seasonWord, seasonIcon] = await Promise.all([
    renderOgEditorialWord(fonts.serif, season.displayName, {
      color: identity.hue,
      fontSize: layout.ogTitleSize,
    }),
    renderOgEditorialWord(fonts.serifItalic, 'Season', {
      color: INK,
      fontSize: Math.round(layout.ogTitleSize * 0.72),
      italic: true,
      opacity: 0.84,
    }),
    sharp(publicPath(rootDirectory, identity.icon))
      .resize(layout.ogIconSize, layout.ogIconSize, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer(),
  ]);
  const [signMeta, seasonMeta] = await Promise.all([
    sharp(signWord).metadata(),
    sharp(seasonWord).metadata(),
  ]);
  const height = Math.max(signMeta.height, seasonMeta.height, layout.ogIconSize);
  const iconLeft = signMeta.width + layout.ogGap;
  const seasonLeft = iconLeft + layout.ogIconSize + layout.ogGap;
  const width = seasonLeft + seasonMeta.width;
  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([
    { input: signWord, left: 0, top: height - signMeta.height },
    { input: seasonIcon, left: iconLeft, top: Math.round((height - layout.ogIconSize) / 2) },
    { input: seasonWord, left: seasonLeft, top: height - seasonMeta.height },
  ]).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function ogSocialTextSvg(fonts, season, seasonIndex) {
  const copy = astrofolioOgCopy(season, seasonIndex);
  const dateRange = copy.dateRange.replace(' – ', ' — ');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>
      @font-face{font-family:Instrument;src:url(data:font/woff2;base64,${fonts.instrument}) format('woff2');font-weight:100 900}
      @font-face{font-family:Editorial;src:url(data:font/woff2;base64,${fonts.serifItalic}) format('woff2');font-weight:500;font-style:italic}
      @font-face{font-family:Mono;src:url(data:font/woff2;base64,${fonts.mono}) format('woff2');font-weight:100 800}
    </style>
    <text x="68" y="207" fill="${INK}" font-family="Editorial,serif" font-size="97" font-weight="500" font-style="italic" letter-spacing="-1.1">${copy.title}</text>
    <text x="76" y="264" fill="#BEBAB2" font-family="Instrument,sans-serif" font-size="20" font-weight="430" letter-spacing=".55">${copy.caption}</text>
    <text x="76" y="407" fill="#A9A59D" font-family="Mono,monospace" font-size="18" font-weight="430" letter-spacing="1.1">${dateRange} · ${copy.timeZone}</text>
    <text x="74" y="566" fill="#8F8B84" font-family="Instrument,sans-serif" font-size="15" font-weight="500" letter-spacing="3.2">ZODIACS.ORG</text>
  </svg>`);
}

function astrofolioSocialSeasonTitleLayout(displayName) {
  const length = String(displayName ?? '').trim().length;
  if (!length) throw new Error('Astrofolio social season title requires a display name');
  if (length <= 7) return { signSize: 66, seasonSize: 48, gap: 14 };
  if (length <= 9) return { signSize: 60, seasonSize: 45, gap: 13 };
  return { signSize: 54, seasonSize: 42, gap: 12 };
}

async function composeOgSocialSeasonLockup(fonts, season) {
  const identity = astrofolioOgIdentitySources(season);
  const layout = astrofolioSocialSeasonTitleLayout(season.displayName);
  const [signWord, seasonWord] = await Promise.all([
    renderOgEditorialWord(fonts.serif, season.displayName, {
      color: identity.hue,
      fontSize: layout.signSize,
    }),
    renderOgEditorialWord(fonts.serifItalic, 'Season', {
      color: INK,
      fontSize: layout.seasonSize,
      italic: true,
      opacity: 0.84,
    }),
  ]);
  const [signMeta, seasonMeta] = await Promise.all([
    sharp(signWord).metadata(),
    sharp(seasonWord).metadata(),
  ]);
  const height = Math.max(signMeta.height, seasonMeta.height);
  const seasonLeft = signMeta.width + layout.gap;
  return sharp({
    create: {
      width: seasonLeft + seasonMeta.width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    { input: signWord, left: 0, top: height - signMeta.height },
    { input: seasonWord, left: seasonLeft, top: height - seasonMeta.height },
  ]).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

async function composeSeasonSeal(rootDirectory, season) {
  const size = 192;
  const hue = PASTELS[SIGN_ORDER.indexOf(season)];
  const ordered = seasonOrder(season);
  const icon = await sharp(resolve(rootDirectory, `public/assets/zodiac-icons/128/${season}.webp`))
    .resize(84, 84, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  const nodes = ordered.map((sign, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 6;
    const cx = (96 + Math.cos(angle) * 76).toFixed(2);
    const cy = (96 + Math.sin(angle) * 76).toFixed(2);
    const sourceIndex = SIGN_ORDER.indexOf(sign);
    const selectedHalo = index === 0
      ? `<circle cx="${cx}" cy="${cy}" r="10.5" fill="none" stroke="${INK}" stroke-opacity=".62"/><circle cx="${cx}" cy="${cy}" r="8.5" fill="none" stroke="${hue}" stroke-width="2"/>`
      : '';
    return `${selectedHalo}<circle cx="${cx}" cy="${cy}" r="${index === 0 ? 5.75 : 4.25}" fill="${PASTELS[sourceIndex]}"/>`;
  }).join('');
  const rings = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><radialGradient id="plate"><stop offset="0" stop-color="${VOID}" stop-opacity=".98"/><stop offset=".68" stop-color="${VOID}" stop-opacity=".91"/><stop offset=".88" stop-color="${hue}" stop-opacity=".12"/><stop offset="1" stop-color="${VOID}" stop-opacity="0"/></radialGradient></defs><circle cx="96" cy="96" r="95" fill="url(#plate)"/><circle cx="96" cy="96" r="76" fill="none" stroke="${INK}" stroke-opacity=".2"/><circle cx="96" cy="96" r="49" fill="${VOID}" fill-opacity=".94" stroke="${hue}" stroke-opacity=".5"/>${nodes}</svg>`);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: rings, left: 0, top: 0 },
      { input: icon, left: 54, top: 54 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function composeOgZodiacDiscs(rootDirectory, season) {
  const discs = await composeSeasonalZodiacRing(rootDirectory, season, {
    withAtmosphere: false,
    withSelectedHalo: false,
  });
  return sharp(discs)
    .resize(ASTROFOLIO_OG_MOTIF_GEOMETRY.size, ASTROFOLIO_OG_MOTIF_GEOMETRY.size, { kernel: 'lanczos3' })
    .extract({
      left: 0,
      top: Math.round((ASTROFOLIO_OG_MOTIF_GEOMETRY.size - 630) / 2),
      width: ASTROFOLIO_OG_MOTIF_GEOMETRY.size,
      height: 630,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function composeAstrofolioOg(rootDirectory, fonts, season, seasonIndex) {
  const identity = astrofolioOgIdentitySources(season);
  const [motif, sculpture, seasonLockup] = await Promise.all([
    composeOgZodiacDiscs(rootDirectory, season.sign),
    normalizeOgSculpture(rootDirectory, identity.sign),
    composeOgSeasonLockup(rootDirectory, fonts, season),
  ]);
  const sculptureMeta = await sharp(sculpture).metadata();
  const { size, centerX, centerY } = ASTROFOLIO_OG_MOTIF_GEOMETRY;
  const atmosphere = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="a"><stop stop-color="#C88B39" stop-opacity=".07"/><stop offset=".58" stop-color="#C88B39" stop-opacity=".02"/><stop offset="1" stop-color="#060709" stop-opacity="0"/></radialGradient><radialGradient id="s"><stop stop-color="${identity.hue}" stop-opacity=".11"/><stop offset=".52" stop-color="${identity.hue}" stop-opacity=".035"/><stop offset="1" stop-color="#060709" stop-opacity="0"/></radialGradient></defs><ellipse cx="${centerX + 15}" cy="${centerY}" rx="354" ry="320" fill="url(#a)"/><ellipse cx="248" cy="365" rx="310" ry="270" fill="url(#s)"/></svg>`);
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: VOID } })
    .composite([
      { input: atmosphere, left: 0, top: 0 },
      { input: ogTextSvg(fonts, season, seasonIndex), left: 0, top: 0 },
      {
        input: sculpture,
        left: Math.round(centerX - sculptureMeta.width / 2),
        top: Math.round(centerY - sculptureMeta.height / 2),
      },
      { input: motif, left: Math.round(centerX - size / 2), top: 0 },
      { input: seasonLockup, left: 80, top: 373 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, colours: 256, dither: 0.55 })
    .toBuffer();
}

async function composeOgSocialZodiacDiscs(rootDirectory, season) {
  const discs = await composeSeasonalZodiacRing(rootDirectory, season, {
    withAtmosphere: false,
    withSelectedHalo: true,
    selectedHaloStyle: 'single',
  });
  return sharp(discs)
    .resize(ASTROFOLIO_OG_MOTIF_GEOMETRY.size, ASTROFOLIO_OG_MOTIF_GEOMETRY.size, { kernel: 'lanczos3' })
    .extract({
      left: 0,
      top: Math.round((ASTROFOLIO_OG_MOTIF_GEOMETRY.size - 630) / 2),
      width: ASTROFOLIO_OG_MOTIF_GEOMETRY.size,
      height: 630,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function composeAstrofolioSocialOg(rootDirectory, fonts, season, seasonIndex) {
  const identity = astrofolioOgIdentitySources(season);
  const [motif, sculpture, seasonLockup] = await Promise.all([
    composeOgSocialZodiacDiscs(rootDirectory, season.sign),
    normalizeOgSculpture(rootDirectory, identity.sign),
    composeOgSocialSeasonLockup(fonts, season),
  ]);
  const sculptureMeta = await sharp(sculpture).metadata();
  const { size, centerX, centerY } = ASTROFOLIO_OG_MOTIF_GEOMETRY;
  const atmosphere = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="a"><stop stop-color="#C88B39" stop-opacity=".065"/><stop offset=".58" stop-color="#C88B39" stop-opacity=".018"/><stop offset="1" stop-color="${VOID}" stop-opacity="0"/></radialGradient><radialGradient id="s"><stop stop-color="${identity.hue}" stop-opacity=".045"/><stop offset=".58" stop-color="${identity.hue}" stop-opacity=".012"/><stop offset="1" stop-color="${VOID}" stop-opacity="0"/></radialGradient></defs><ellipse cx="${centerX + 15}" cy="${centerY}" rx="354" ry="320" fill="url(#a)"/><ellipse cx="${centerX}" cy="${centerY}" rx="322" ry="298" fill="url(#s)"/><path d="M620 0V630" stroke="${INK}" stroke-opacity=".018"/></svg>`);
  return sharp({ create: { width: 1200, height: 630, channels: 4, background: VOID } })
    .composite([
      { input: atmosphere, left: 0, top: 0 },
      { input: ogSocialTextSvg(fonts, season, seasonIndex), left: 0, top: 0 },
      {
        input: sculpture,
        left: Math.round(centerX - sculptureMeta.width / 2),
        top: Math.round(centerY - sculptureMeta.height / 2),
      },
      { input: motif, left: Math.round(centerX - size / 2), top: 0 },
      { input: seasonLockup, left: 75, top: 314 },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, colours: 256, dither: 0.55 })
    .toBuffer();
}

/**
 * Publish social cards independently from the installed-app identity package.
 * A new versioned URL is intentional: social crawlers cache both successful
 * and failed fetches, while the historical v2 icon and OG routes are immutable.
 */
export async function buildAstrofolioOgFamily({
  rootDirectory = root,
  outputDirectory = resolve(rootDirectory, `public/assets/og/astrofolio/${ASTROFOLIO_OG_VERSION}`),
} = {}) {
  const registry = await loadRegistry(rootDirectory);
  const seasons = seasonsFromRegistry(registry);
  const fonts = await loadIdentityFonts(rootDirectory);
  const records = [];

  await mkdir(outputDirectory, { recursive: true });
  for (const [seasonIndex, season] of seasons.entries()) {
    const bytes = await composeAstrofolioSocialOg(rootDirectory, fonts, season, seasonIndex);
    const filename = `${season.sign}.png`;
    await writeFile(resolve(outputDirectory, filename), bytes);
    records.push({
      sign: season.sign,
      displayName: season.displayName,
      dateRange: season.dateRange,
      ogCopy: astrofolioOgCopy(season, seasonIndex),
      ogSources: astrofolioOgIdentitySources(season),
      artwork: {
        og: `${ASTROFOLIO_OG_BASE}/${filename}`,
      },
      sha256: hash(bytes),
    });
  }

  const manifest = {
    schema: 'zodiacs.astrofolio-og.v4',
    version: ASTROFOLIO_OG_VERSION,
    base: ASTROFOLIO_OG_BASE,
    type: 'image/png',
    width: 1200,
    height: 630,
    identityBase: ASTROFOLIO_IDENTITY_BASE,
    motifGeometry: ASTROFOLIO_OG_MOTIF_GEOMETRY,
    seasons: records,
  };
  await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Terminal's desk card as SVG, `fontData` being Instrument Sans as base64:
 * v6 is this alone; v7 (scripts/build-og-void.mjs --only-terminal-card) adds
 * the brand lockup's footer row under it.
 */
export function terminalSvg(fontData) {
  const columns = Array.from({ length: 9 }, (_, index) => (
    `<path d="M${708 + index * 48} 108V520" stroke="#FFFFFF" stroke-opacity=".045"/>`
  )).join('');
  const rows = Array.from({ length: 7 }, (_, index) => (
    `<path d="M676 ${142 + index * 54}H1138" stroke="#FFFFFF" stroke-opacity=".065"/>`
  )).join('');
  const ticks = PASTELS.map((color, index) => (
    `<rect x="${690 + index * 36}" y="${455 - (index % 5) * 21}" width="7" height="${26 + (index % 5) * 21}" rx="3.5" fill="${color}" opacity=".86"/>`
  )).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <style>@font-face{font-family:Instrument;src:url(data:font/woff2;base64,${fontData}) format('woff2');font-weight:100 900}</style>
    <rect width="1200" height="630" fill="${VOID}"/>
    <defs><radialGradient id="desk"><stop stop-color="#A9D4C4" stop-opacity=".08"/><stop offset="1" stop-color="#060709" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="910" cy="300" rx="430" ry="340" fill="url(#desk)"/>
    <text x="88" y="265" fill="${INK}" font-family="Instrument,sans-serif" font-size="82" font-weight="575" letter-spacing="-3.6">Terminal</text>
    <text x="93" y="318" fill="#A9AAA7" font-family="Instrument,sans-serif" font-size="23" font-weight="430" letter-spacing=".55">Market intelligence for the Twelve</text>
    <text x="94" y="394" fill="#A9D4C4" font-family="Instrument,sans-serif" font-size="14" font-weight="620" letter-spacing="3.2">PRO DESK · LIVE MARKETS</text>
    <rect x="652" y="84" width="510" height="468" rx="26" fill="#0A0B0D" stroke="#FFFFFF" stroke-opacity=".10"/>
    <rect x="665" y="97" width="484" height="442" rx="18" fill="#07080A" stroke="#FFFFFF" stroke-opacity=".055"/>
    ${columns}${rows}${ticks}
    <path d="M684 403C737 381 771 410 815 347C857 286 899 337 944 254C982 184 1021 281 1061 219C1086 181 1111 196 1131 163" fill="none" stroke="#A9D4C4" stroke-width="3"/>
    <circle cx="1131" cy="163" r="6" fill="#B9DCE8"/><circle cx="1131" cy="163" r="14" fill="none" stroke="#B9DCE8" stroke-opacity=".25"/>
  </svg>`;
}

async function composeTerminalOg(fontData) {
  return sharp(Buffer.from(terminalSvg(fontData)))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, colours: 256, dither: 0.45 })
    .toBuffer();
}

function seasonManifest(sign, displayName) {
  const base = `${ASTROFOLIO_IDENTITY_BASE}/${sign}`;
  return `${JSON.stringify({
    id: '/astrofolio/',
    name: 'Astrofolio',
    short_name: 'Astrofolio',
    description: 'The Twelve Official Zodiacs',
    start_url: '/astrofolio/',
    scope: '/astrofolio/',
    display: 'standalone',
    background_color: VOID,
    theme_color: VOID,
    icons: [
      { src: `${base}/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${base}/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }, null, 2)}\n`;
}

export async function buildAstrofolioIdentity({
  rootDirectory = root,
  outputDirectory = resolve(rootDirectory, `public/assets/astrofolio/${ASTROFOLIO_IDENTITY_VERSION}`),
  terminalOutput = resolve(rootDirectory, 'public/assets/og/v6/terminal.png'),
} = {}) {
  const registry = await loadRegistry(rootDirectory);
  const seasons = seasonsFromRegistry(registry);
  const fonts = await loadIdentityFonts(rootDirectory);
  const records = [];

  await mkdir(outputDirectory, { recursive: true });
  const zodiacRing = await composeTransparentZodiacRing(rootDirectory);
  await writeFile(resolve(outputDirectory, 'zodiac-ring-192.png'), zodiacRing);
  for (const [seasonIndex, season] of seasons.entries()) {
    const signDirectory = resolve(outputDirectory, season.sign);
    await mkdir(signDirectory, { recursive: true });
    const seasonalRing = await composeSeasonalZodiacRing(rootDirectory, season.sign);
    const [avatar, seasonSeal, appIcon] = await Promise.all([
      sharp(seasonalRing).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
      composeSeasonSeal(rootDirectory, season.sign),
      composeAppIcon(seasonalRing, season.sign),
    ]);
    const faviconSvg = await composeFaviconSvg(rootDirectory, season.sign);
    const [favicon16, favicon32, favicon96, apple, icon192, icon512, maskable512, og] = await Promise.all([
      rasterizeFavicon(faviconSvg, 16),
      rasterizeFavicon(faviconSvg, 32),
      rasterizeFavicon(faviconSvg, 96),
      sharp(appIcon).resize(180, 180, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer(),
      sharp(appIcon).resize(192, 192, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer(),
      sharp(appIcon).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer(),
      sharp(appIcon).resize(512, 512, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toBuffer(),
      composeAstrofolioOg(rootDirectory, fonts, season, seasonIndex),
    ]);
    const manifest = seasonManifest(season.sign, season.displayName);
    const files = {
      'avatar-1024.png': avatar,
      'favicon.svg': Buffer.from(faviconSvg),
      'favicon-16.png': favicon16,
      'favicon-32.png': favicon32,
      'favicon-96.png': favicon96,
      'apple-touch-icon-180.png': apple,
      'icon-192.png': icon192,
      'icon-512.png': icon512,
      'maskable-512.png': maskable512,
      'astrofolio.webmanifest': Buffer.from(manifest),
      'og-1200x630.png': og,
      'season-seal-192.png': seasonSeal,
    };
    await Promise.all(Object.entries(files).map(([name, bytes]) => (
      writeFile(resolve(signDirectory, name), bytes)
    )));
    records.push({
      sign: season.sign,
      displayName: season.displayName,
      dateRange: season.dateRange,
      ogCopy: astrofolioOgCopy(season, seasonIndex),
      ogSources: astrofolioOgIdentitySources(season),
      base: `${ASTROFOLIO_IDENTITY_BASE}/${season.sign}`,
      artwork: {
        avatar: `${ASTROFOLIO_IDENTITY_BASE}/${season.sign}/avatar-1024.png`,
        seasonSeal: `${ASTROFOLIO_IDENTITY_BASE}/${season.sign}/season-seal-192.png`,
        og: `${ASTROFOLIO_IDENTITY_BASE}/${season.sign}/og-1200x630.png`,
      },
      sha256: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])),
    });
  }

  const terminal = await composeTerminalOg(fonts.instrument);
  await mkdir(dirname(terminalOutput), { recursive: true });
  await writeFile(terminalOutput, terminal);
  const familyManifest = {
    schema: 'zodiacs.astrofolio-identity.v2',
    version: ASTROFOLIO_IDENTITY_VERSION,
    background: VOID,
    iconSource: '/assets/zodiac-icons/128/{sign}.webp',
    ogSculptureSource: '/assets/sculptures/1024/{sign}.webp',
    cropSafeArea: 0.8,
    onPageSeal: 'season-seal-192.png',
    onPageRing: 'zodiac-ring-192.png',
    onPageRingSha256: hash(zodiacRing),
    terminalOg: TERMINAL_OG_V6_PATH,
    terminalOgSha256: hash(terminal),
    seasons: records,
  };
  await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify(familyManifest, null, 2)}\n`);
  return familyManifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--og-only')) {
    const manifest = await buildAstrofolioOgFamily();
    console.log(`Astrofolio social cards: ${manifest.seasons.length} seasonal ${manifest.version} cards written.`);
  } else {
    const [identity, social] = await Promise.all([
      buildAstrofolioIdentity(),
      buildAstrofolioOgFamily(),
    ]);
    console.log(`Astrofolio identity: ${identity.seasons.length} seasonal packages + ${social.version} social cards + Terminal v6 card written.`);
  }
}
