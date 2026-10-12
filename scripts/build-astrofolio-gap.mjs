import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ImageResponse } from '@vercel/og';
import { shapeGapMarket, shapeAudience, gapOgPath, GAP_OG_DIRECTORY } from './astrofolio-gap-lib.mjs';
import { renderGapPage, gapOgTree } from './astrofolio-gap-render.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));

export async function buildGapArtifacts() {
  const [history, registry, rawAudience, serif, sans, mono] = await Promise.all([
    json('public/assets/data/registry-market-history.v1.json'),
    json('public/registry/zodiacs.registry.json'),
    json('public/astrofolio/gap/audience.json'),
    readFile(resolve(root, 'node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-500-normal.woff')),
    readFile(resolve(root, 'scripts/assets/astrofolio-gap/instrument-sans-400-ascii.woff')),
    readFile(resolve(root, 'scripts/assets/astrofolio-gap/jetbrains-mono-400-ascii.woff')),
  ]);
  const market = shapeGapMarket(history, registry);
  const audience = shapeAudience(rawAudience);
  const response = new ImageResponse(gapOgTree(market, audience), {
    width: 1200, height: 630,
    fonts: [
      { name: 'EB Garamond', data: serif, weight: 500, style: 'normal' },
      { name: 'Instrument Sans', data: sans, weight: 400, style: 'normal' },
      { name: 'JetBrains Mono', data: mono, weight: 400, style: 'normal' },
    ],
  });
  const png = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(png).digest('hex');
  const ogPath = gapOgPath(market, digest);
  const manifest = {
    schema: 'zodiacs.astrofolio-gap-og.v1', width: 1200, height: 630,
    observedAt: market.observedAt, sourceName: market.sourceName, sourceUrl: market.sourceUrl,
    measure: market.measure, combinedUsd: market.combined, reportedAssetCount: market.reportedCount,
    audienceOwnerReviewRequired: audience.ownerReviewRequired,
    image: ogPath, sha256: digest,
  };
  return {
    [`public${ogPath}`]: png,
    [`${GAP_OG_DIRECTORY}/manifest.json`]: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`),
    'public/astrofolio/gap/index.html': Buffer.from(renderGapPage({ market, audience, ogPath })),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // @vercel/og can load additional glyph assets for unsupported copy. Fail
  // closed instead of permitting a future source edit to add a build fetch.
  globalThis.fetch = () => { throw new Error('Astrofolio gap rendering must stay offline; check the local font coverage'); };
  const artifacts = await buildGapArtifacts();
  const check = process.argv.includes('--check');
  for (const [path, bytes] of Object.entries(artifacts)) {
    const target = resolve(root, path);
    if (check) {
      const current = await readFile(target).catch(() => null);
      if (!current?.equals(bytes)) throw new Error(`${path}: stale; run node scripts/build-astrofolio-gap.mjs`);
    } else {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
  }
  console.log(`Astrofolio gap: ${check ? 'verified' : 'generated'} page, OG manifest and 1200×630 chart (offline)`);
}
