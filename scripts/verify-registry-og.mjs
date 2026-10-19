/**
 * Production-build gate for the Registry's share cards: the current v4
 * family (twelve lot cards and the hub card, with the brand lockup) and the
 * frozen v3 family kept for links already shared.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SIGN_ORDER } from './sign-data.mjs';
import {
  REGISTRY_OG_BASE,
  REGISTRY_OG_GEOMETRY,
  REGISTRY_OG_HUB,
  REGISTRY_OG_ICON_SOURCE,
  REGISTRY_OG_SCULPTURE_SOURCE,
  REGISTRY_OG_V3,
  REGISTRY_OG_VERSION,
} from './build-registry-og.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, `public${REGISTRY_OG_BASE}`);
const failures = [];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFile = (template, sign) => resolve(root, 'public', template.replace('{sign}', sign).replace(/^\//, ''));

async function readManifest(directory, label) {
  try {
    return JSON.parse(await readFile(resolve(directory, 'manifest.json'), 'utf8'));
  } catch (error) {
    failures.push(`${label} manifest: ${error instanceof Error ? error.message : 'missing or invalid'}`);
    return null;
  }
}

async function checkPng(bytes, label) {
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1200 || metadata.height !== 630) {
    failures.push(`${label}: expected a 1200x630 PNG`);
  }
  if (bytes.length > 250 * 1024) failures.push(`${label}: ${(bytes.length / 1024).toFixed(1)}KiB exceeds the 250KiB card budget`);
}

// ── v4, the current family ──────────────────────────────────────────

const manifest = await readManifest(out, REGISTRY_OG_VERSION);
if (manifest) {
  if (manifest.schema !== 'zodiacs.registry-og.v4') failures.push('manifest: unsupported schema');
  if (manifest.version !== REGISTRY_OG_VERSION) failures.push('manifest: version drifted');
  if (manifest.base !== REGISTRY_OG_BASE) failures.push('manifest: base URL drifted');
  if (manifest.type !== 'image/png') failures.push('manifest: type must be image/png');
  if (manifest.width !== 1200 || manifest.height !== 630) failures.push('manifest: dimensions must be 1200x630');
  if (manifest.iconSource !== REGISTRY_OG_ICON_SOURCE) failures.push('manifest: icon source must be the high-resolution SDK circle art');
  if (manifest.sculptureSource !== REGISTRY_OG_SCULPTURE_SOURCE) failures.push('manifest: sculpture source must be the 1024px tier');
  if (JSON.stringify(manifest.geometry) !== JSON.stringify(REGISTRY_OG_GEOMETRY)) failures.push('manifest: geometry drifted');
  if (JSON.stringify(manifest.cards?.map(({ sign }) => sign)) !== JSON.stringify(SIGN_ORDER)) failures.push('manifest: card order or coverage drifted');
  if (manifest.hub?.image !== REGISTRY_OG_HUB) failures.push('manifest: hub card URL drifted');
}

const { sculptureBox, seal, footerRuleY, fieldBottom } = REGISTRY_OG_GEOMETRY;
const ringLeft = seal.left - (seal.ringSize - seal.iconSize) / 2;
const ringTop = seal.top - (seal.ringSize - seal.iconSize) / 2;
const iconCenter = [seal.left + seal.iconSize / 2, seal.top + seal.iconSize / 2];
const ringCenter = [ringLeft + seal.ringSize / 2, ringTop + seal.ringSize / 2];
if (JSON.stringify(iconCenter) !== JSON.stringify(ringCenter)) failures.push('geometry: seal ring is not centered on the icon');
if (ringTop + seal.ringSize >= footerRuleY) failures.push('geometry: seal ring collides with the footer rule');
if (sculptureBox.top + sculptureBox.height >= footerRuleY) failures.push('geometry: sculpture box collides with the footer rule');
if (fieldBottom > footerRuleY) failures.push('geometry: the art field covers the footer row');

const expectedFiles = [...SIGN_ORDER.map((sign) => `${sign}.png`), 'hub.png'].sort();
try {
  const actualFiles = (await readdir(out)).filter((name) => name.endsWith('.png')).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    failures.push(`inventory: expected ${expectedFiles.length} PNGs, found ${actualFiles.length}`);
  }
} catch (error) {
  failures.push(`inventory: ${error instanceof Error ? error.message : 'missing family directory'}`);
}

const cardHashes = new Set();
let familyBytes = 0;
for (const sign of SIGN_ORDER) {
  const record = manifest?.cards?.find((card) => card.sign === sign);
  const imagePath = resolve(out, `${sign}.png`);
  let bytes;
  try {
    bytes = await readFile(imagePath);
  } catch {
    failures.push(`${sign}: missing card`);
    continue;
  }
  familyBytes += (await stat(imagePath)).size;
  await checkPng(bytes, sign);
  const cardHash = hash(bytes);
  if (cardHashes.has(cardHash)) failures.push(`${sign}: card is byte-identical to another sign`);
  cardHashes.add(cardHash);
  if (!record) failures.push(`${sign}: missing manifest record`);
  else {
    if (record.image !== `${REGISTRY_OG_BASE}/${sign}.png`) failures.push(`${sign}: manifest image URL drifted`);
    if (record.sha256 !== cardHash) failures.push(`${sign}: manifest card hash drifted; rerun npm run data:og -- --only-registry`);
  }

  for (const [key, template, expectedFormat] of [
    ['icon', REGISTRY_OG_ICON_SOURCE, 'png'],
    ['sculpture', REGISTRY_OG_SCULPTURE_SOURCE, 'webp'],
  ]) {
    try {
      const source = await readFile(sourceFile(template, sign));
      const sourceMetadata = await sharp(source).metadata();
      if (sourceMetadata.format !== expectedFormat) failures.push(`${sign}: ${key} format drifted`);
      if (sourceMetadata.width !== 1024 || sourceMetadata.height !== 1024) failures.push(`${sign}: ${key} must be the 1024x1024 source`);
      if (record?.sourceSha256?.[key] !== hash(source)) {
        failures.push(`${sign}: ${key} source hash drifted; rerun npm run data:og -- --only-registry`);
      }
    } catch {
      failures.push(`${sign}: ${key} source is missing`);
    }
  }

  try {
    const page = await readFile(resolve(root, `public/registry/${sign}/index.html`), 'utf8');
    const absoluteImage = `https://zodiacs.org${REGISTRY_OG_BASE}/${sign}.png`;
    if (!page.includes(`<meta property="og:image" content="${absoluteImage}" />`)) failures.push(`${sign}: Registry OG metadata is stale`);
    if (!page.includes(`<meta name="twitter:image" content="${absoluteImage}" />`)) failures.push(`${sign}: Registry Twitter metadata is stale`);
    for (const earlier of [`/assets/og/v2/registry/${sign}.png`, `${REGISTRY_OG_V3.base}/${sign}.png`]) {
      if (page.includes(earlier)) failures.push(`${sign}: Registry page still references the earlier card ${earlier}`);
    }
  } catch {
    failures.push(`${sign}: Registry page is missing`);
  }
}

try {
  const bytes = await readFile(resolve(out, 'hub.png'));
  familyBytes += bytes.length;
  await checkPng(bytes, 'hub');
  if (manifest?.hub?.sha256 !== hash(bytes)) failures.push('hub: manifest card hash drifted; rerun npm run data:og -- --only-registry');
  if (cardHashes.has(hash(bytes))) failures.push('hub: card is byte-identical to a lot card');
} catch {
  failures.push('hub: missing card');
}
for (const page of ['public/registry/index.html', 'public/registry/technical/index.html']) {
  try {
    const html = await readFile(resolve(root, page), 'utf8');
    const absoluteImage = `https://zodiacs.org${REGISTRY_OG_HUB}`;
    if (!html.includes(`<meta property="og:image" content="${absoluteImage}" />`)) failures.push(`${page}: OG metadata does not name the hub card`);
    if (!html.includes(`<meta name="twitter:image" content="${absoluteImage}" />`)) failures.push(`${page}: Twitter metadata does not name the hub card`);
    if (html.includes('/assets/og/v2/registry.png')) failures.push(`${page}: still references the pinned v2 card`);
  } catch {
    failures.push(`${page}: missing`);
  }
}

if (familyBytes > 2.75 * 1024 * 1024) failures.push(`family: ${(familyBytes / 1024 / 1024).toFixed(2)}MiB exceeds the 2.75MiB budget`);

// ── v3, frozen ──────────────────────────────────────────────────────

const v3Out = resolve(root, `public${REGISTRY_OG_V3.base}`);
const v3 = await readManifest(v3Out, 'v3');
if (v3) {
  if (v3.schema !== 'zodiacs.registry-og.v3' || v3.version !== 'v3' || v3.base !== REGISTRY_OG_V3.base) failures.push('v3 manifest: identity drifted');
  if (JSON.stringify(v3.geometry) !== JSON.stringify(REGISTRY_OG_V3.geometry)) failures.push('v3 manifest: geometry drifted');
  for (const sign of SIGN_ORDER) {
    const record = v3.cards?.find((card) => card.sign === sign);
    try {
      const bytes = await readFile(resolve(v3Out, `${sign}.png`));
      if (record?.sha256 !== hash(bytes)) failures.push(`v3 ${sign}: published bytes changed; a new design takes a new version`);
      const plate = await readFile(sourceFile(REGISTRY_OG_V3.plateSource, sign));
      if (record?.sourceSha256?.baseCard !== hash(plate)) failures.push(`v3 ${sign}: its pinned v2 plate changed`);
    } catch {
      failures.push(`v3 ${sign}: card or plate missing`);
    }
  }
}

if (failures.length) {
  console.error(`verify-registry-og: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`verify-registry-og: OK — ${REGISTRY_OG_VERSION}: ${SIGN_ORDER.length} unique lot cards and the hub card with the brand lockup, exact high-resolution icon/sculpture sources, centered seals, 1200x630 PNG, ${(familyBytes / 1024 / 1024).toFixed(2)}MiB; v3 kept byte for byte`);
