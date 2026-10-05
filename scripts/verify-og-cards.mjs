/**
 * Fast production-build gate for required Open Graph cards.
 *
 * Generation is intentionally an explicit data task because it needs
 * Chromium. Every normal build still verifies the committed output: required
 * coverage, dimensions, byte-level uniqueness, manifest drift, canonical icon
 * sources, and the cache-busted global fallback.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { HOROSCOPE_OG_SURFACES, OG_EN } from '../src/strings/seo.en.mjs';
import {
  ASTROFOLIO_SHARE_CARD_MAX_BYTES,
  ASTROFOLIO_SHARE_CARD_PATH,
} from './build-astrofolio-share-card.mjs';
import {
  RU_OG_COPY_DIGEST_INPUT,
  RU_OG_REQUIRED_CARDS,
  RU_OG_ROUTE_CARDS,
} from '../src/strings/seo.ru.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/assets/og/v2');
const wingOut = resolve(root, 'public/assets/og/v5');
const wingCard = 'the-twelve.png';
const astrofolioOut = resolve(root, 'public/assets/og/astrofolio/v4');
const terminalOut = resolve(root, 'public/assets/og/v6');
const legacyRegistryCardSha256 = 'f7b9e9e801e390f2ef3671755d1f3754a7e45bb9db026699f5381764aab5a08a';
const homepageCard = 'share-pastel-wheel-20260809.png';
const russianOut = resolve(out, 'ru');
const eventsPublication = JSON.parse(
  await readFile(resolve(root, 'src/data/events-publication.json'), 'utf8'),
);
const peoplePilot = JSON.parse(
  await readFile(resolve(root, 'src/data/people.json'), 'utf8'),
).people;
const signSlugs = [
  'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
  'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];
const horoscopeCardPath = (slug, surface) => (
  `horoscope/${slug}${surface.suffix ? `-${surface.suffix}` : ''}.png`
);

const expected = [
  ...signSlugs.map((slug) => `sign/${slug}.png`),
  ...signSlugs.map((slug) => `registry/${slug}.png`),
  ...signSlugs.flatMap((slug) => HOROSCOPE_OG_SURFACES.map((surface) => (
    horoscopeCardPath(slug, surface)
  ))),
  ...OG_EN.tools.map((tool) => `tool/${tool.key}.png`),
  'tool/compatibility-invite.png',
  ...(eventsPublication.hub.indexEligible ? ['events/index.png'] : []),
  ...eventsPublication.pages.map((event) => `events/${event.id}.png`),
  ...peoplePilot.map((person) => `people/${person.slug}.png`),
  'fomo.png',
  'registry.png',
  'thesis.png',
  'disclosure.png',
].sort();

const failures = [];
const hashes = new Map();

async function directoryBytes(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    bytes += entry.isDirectory() ? await directoryBytes(path) : (await stat(path)).size;
  }
  return bytes;
}

async function relativePngFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await relativePngFiles(resolve(directory, entry.name), relativePath));
    else if (entry.name.endsWith('.png')) files.push(relativePath);
  }
  return files.sort();
}

async function validatePng(relativePath, {
  unique = true,
  base = out,
  label = relativePath,
} = {}) {
  const absolutePath = resolve(base, relativePath);
  let bytes;
  try {
    bytes = await readFile(absolutePath);
  } catch {
    failures.push(`${label}: missing`);
    return;
  }
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== 'png' || metadata.width !== 1200 || metadata.height !== 630) {
    failures.push(
      `${label}: expected 1200x630 PNG, received ${metadata.width ?? '?'}x${metadata.height ?? '?'} ${metadata.format ?? 'unknown'}`,
    );
  }
  if (!unique) return;
  const hash = createHash('sha256').update(bytes).digest('hex');
  const duplicate = hashes.get(hash);
  if (duplicate) failures.push(`${label}: byte-identical to ${duplicate}`);
  else hashes.set(hash, label);
}

// The homepage shares the void fallback card. A separate homepage asset was
// tried once in a light cream palette and read as a different site next to the
// dark surfaces, so the card is not allowed back without a void render.
async function validateHomepageCard() {
  const relativePath = 'homepage.webp';
  try {
    await readFile(resolve(out, relativePath));
    failures.push(`${relativePath}: off-system homepage card — the homepage uses the void share.png fallback`);
  } catch {
    // Absent, as expected.
  }
}

for (const slug of signSlugs) {
  const iconPath = resolve(root, `public/assets/zodiac-icons/128/${slug}.webp`);
  try {
    const metadata = await sharp(await readFile(iconPath)).metadata();
    if (metadata.format !== 'webp' || metadata.width !== 128 || metadata.height !== 128) {
      failures.push(`canonical icon ${slug}: expected 128x128 WebP`);
    }
  } catch {
    failures.push(`canonical icon ${slug}: missing`);
  }
}

for (const relativePath of expected) await validatePng(relativePath);
const expectedTerminalPath = '/assets/og/v6/terminal.png';
if (OG_EN.astrofolio.image !== ASTROFOLIO_SHARE_CARD_PATH) {
  failures.push(`Astrofolio image: expected ${ASTROFOLIO_SHARE_CARD_PATH}, received ${OG_EN.astrofolio.image}`);
}
// Astrofolio's evergreen share card is a photograph, so it is the one JPEG
// card, held under a byte budget that chat-app previews accept.
try {
  const bytes = await readFile(resolve(root, `public${ASTROFOLIO_SHARE_CARD_PATH}`));
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== 'jpeg' || metadata.width !== 1200 || metadata.height !== 630) {
    failures.push(
      `${ASTROFOLIO_SHARE_CARD_PATH}: expected 1200x630 JPEG, received ${metadata.width ?? '?'}x${metadata.height ?? '?'} ${metadata.format ?? 'unknown'}`,
    );
  }
  if (bytes.length > ASTROFOLIO_SHARE_CARD_MAX_BYTES) {
    failures.push(`${ASTROFOLIO_SHARE_CARD_PATH}: ${bytes.length} bytes, over the ${ASTROFOLIO_SHARE_CARD_MAX_BYTES}-byte budget`);
  }
} catch {
  failures.push(`${ASTROFOLIO_SHARE_CARD_PATH}: missing`);
}
if (OG_EN.terminal.image !== expectedTerminalPath) {
  failures.push(`Terminal image: expected ${expectedTerminalPath}, received ${OG_EN.terminal.image}`);
}
for (const slug of signSlugs) {
  await validatePng(`${slug}.png`, { base: astrofolioOut, label: `astrofolio/v4/${slug}.png` });
}
await validatePng('terminal.png', { base: terminalOut, label: 'v6/terminal.png' });
await validatePng(wingCard, { unique: false, base: wingOut, label: `historical v5/${wingCard}` });
try {
  const legacyRegistryBytes = await readFile(resolve(out, 'registry.png'));
  const legacyRegistryHash = createHash('sha256').update(legacyRegistryBytes).digest('hex');
  if (legacyRegistryHash !== legacyRegistryCardSha256) {
    failures.push('registry.png: legacy v2 card bytes changed; publish consumer renames under a new versioned URL');
  }
} catch {
  // validatePng reports the missing v2 card above.
}
await validatePng('share.png', { unique: false });
await validatePng(homepageCard, { unique: false });
await validateHomepageCard();
try {
  const fallbackBytes = await readFile(resolve(out, 'share.png'));
  const fallbackHash = createHash('sha256').update(fallbackBytes).digest('hex');
  if (!hashes.has(fallbackHash)) hashes.set(fallbackHash, 'share.png');
} catch {
  // validatePng reports the missing fallback above.
}

try {
  const manifest = JSON.parse(await readFile(resolve(out, 'manifest.json'), 'utf8'));
  if (manifest.schema !== 'zodiacs.og-cards.v1') failures.push('manifest.json: unsupported schema');
  if (manifest.width !== 1200 || manifest.height !== 630) failures.push('manifest.json: invalid dimensions');
  if (manifest.iconSource !== '/assets/zodiac-icons/128/{sign}.webp') {
    failures.push('manifest.json: canonical icon source drifted');
  }
  if (manifest.fallback !== `/assets/og/v2/${homepageCard}`) {
    failures.push('manifest.json: homepage fallback drifted');
  }
  if (JSON.stringify(manifest.requiredCards) !== JSON.stringify(expected)) {
    failures.push('manifest.json: required card list drifted; rerun npm run data:og');
  }
} catch (error) {
  failures.push(`manifest.json: ${error instanceof Error ? error.message : 'missing or invalid'}`);
}

const russianExpected = [...RU_OG_REQUIRED_CARDS];
for (const relativePath of russianExpected) await validatePng(`ru/${relativePath}`);

try {
  const inventory = await relativePngFiles(russianOut);
  if (JSON.stringify(inventory) !== JSON.stringify(russianExpected)) {
    failures.push(`ru: expected exactly ${russianExpected.length} PNGs; found ${inventory.length}`);
  }
} catch (error) {
  failures.push(`ru: ${error instanceof Error ? error.message : 'missing card directory'}`);
}

try {
  const manifest = JSON.parse(await readFile(resolve(russianOut, 'manifest.json'), 'utf8'));
  const expectedCopyDigest = createHash('sha256').update(RU_OG_COPY_DIGEST_INPUT).digest('hex');
  if (manifest.schema !== 'zodiacs.og-cards.v1') failures.push('ru/manifest.json: unsupported schema');
  if (manifest.locale !== 'ru') failures.push('ru/manifest.json: locale must be ru');
  if (manifest.width !== 1200 || manifest.height !== 630) failures.push('ru/manifest.json: invalid dimensions');
  if (manifest.iconSource !== '/assets/zodiac-icons/128/{sign}.webp') {
    failures.push('ru/manifest.json: canonical icon source drifted');
  }
  if (manifest.fallback !== '/assets/og/v2/ru/share.png') {
    failures.push('ru/manifest.json: localized fallback drifted');
  }
  if (manifest.copyDigest !== expectedCopyDigest) {
    failures.push('ru/manifest.json: deck copy digest drifted; rerun npm run data:og -- --only-ru');
  }
  if (JSON.stringify(manifest.requiredCards) !== JSON.stringify(russianExpected)) {
    failures.push('ru/manifest.json: required card list drifted; rerun npm run data:og -- --only-ru');
  }
  if (JSON.stringify(manifest.routeCards) !== JSON.stringify(RU_OG_ROUTE_CARDS)) {
    failures.push('ru/manifest.json: route-to-card mapping drifted; rerun npm run data:og -- --only-ru');
  }
} catch (error) {
  failures.push(`ru/manifest.json: ${error instanceof Error ? error.message : 'missing or invalid'}`);
}

let russianBytes = 0;
try {
  russianBytes = await directoryBytes(russianOut);
  if (russianBytes > 700 * 1024) {
    failures.push(`Russian OG family: ${(russianBytes / 1024).toFixed(1)}KiB exceeds the 700KiB budget`);
  }
} catch {
  // The missing Russian directory is reported by the inventory gate above.
}

const bundleBytes = await directoryBytes(out);
const bundleMb = bundleBytes / 1024 / 1024;
/* Ceiling raised 15 → 25MB for the Phase 5 completion: 500 People cards
   (~7.6MB) join the set. Documented in PLAN.md; no runtime cost — these
   are request-time social assets, never page-bundle bytes. */
if (bundleMb > 25) failures.push(`v2 asset bundle: ${bundleMb.toFixed(2)}MB exceeds the 25MB budget`);

if (failures.length) {
  console.error(`verify-og-cards: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`verify-og-cards: OK — homepage on the cache-busted void card; Astrofolio on its evergreen Faces card (the seasonal v4 cards kept for shared links) and Terminal on v6; ${expected.length} English + ${russianExpected.length} Russian unique page cards, all 1200x630 PNG; Russian family ${(russianBytes / 1024).toFixed(1)}KiB; v2 bundle ${bundleMb.toFixed(2)}MB`);

// Registry catalogue cards live outside the frozen v2 bundle. Keep their
// source, geometry, manifest, route metadata, and size contracts in the same
// production OG gate so a standard build cannot publish a stale family.
await import('./verify-registry-og.mjs');
