import { readFile } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { GAP_CONTEXT, GAP_FORECAST_WORDS, GAP_RISK_LINE, shapeAudience, shapeGapMarket } from './astrofolio-gap-lib.mjs';
import { renderGapPage } from './astrofolio-gap-render.mjs';
import { buildGapArtifacts } from './build-astrofolio-gap.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [history, registry, audience] = await Promise.all([
  json('public/assets/data/registry-market-history.v1.json'),
  json('public/registry/zodiacs.registry.json'),
  json('public/astrofolio/gap/audience.json'),
]);
const market = shapeGapMarket(history, registry);
const latestOnly = () => ({ ...structuredClone(history), snapshots: [structuredClone(history.snapshots.at(-1))] });

describe('Astrofolio gap data and publication', () => {
  it('uses all twelve canonical Solana mints and the latest UTC observation', () => {
    expect(market.signs).toHaveLength(12);
    expect(new Set(market.signs.map((sign) => sign.slug)).size).toBe(12);
    expect(market.observedAt).toMatch(/^\d{4}-\d{2}-\d{2}T.+Z$/);
    expect(market.observedAt).toBe(history.snapshots.at(-1).source.readAt);
    expect(market.combined).toBe(history.snapshots.at(-1).totals.marketCapUsd);
    expect(market.measure).toBe('Market cap (USD)');
    for (const sign of market.signs) {
      expect(sign.mint).toBe(registry.assets.find((asset) => asset.sign === sign.slug).native.address);
      expect(sign.sourceName).toBe('DexScreener');
      expect(sign.sourceUrl).toMatch(/^https:\/\/api.dexscreener.com\//);
      expect(sign.observedAt).toBe(market.observedAt);
    }
    expect(shapeGapMarket({ ...history, snapshots: [...history.snapshots].reverse() }, registry)).toEqual(market);
  });

  it('rejects untrusted mint identity, duplicated signs, missing timestamps and missing sources', () => {
    for (const mutate of [
      (entry) => { entry.assets[0].mint = 'different'; },
      (entry) => { entry.assets[1].sign = entry.assets[0].sign; },
      (entry) => { delete entry.source.readAt; },
      (entry) => { delete entry.source.url; },
      (entry) => { entry.totals.marketCapUsd += 1; },
    ]) {
      const copy = latestOnly();
      mutate(copy.snapshots[0]);
      expect(() => shapeGapMarket(copy, registry)).toThrow();
    }
  });

  it('does not substitute FDV, zero or an older observation for missing market cap', () => {
    const copy = structuredClone(history);
    const entry = copy.snapshots.at(-1);
    entry.totals.marketCapUsd -= entry.assets[0].marketCapUsd;
    entry.totals.marketCapAssetCount -= 1;
    entry.assets[0].marketCapUsd = null;
    const partial = shapeGapMarket(copy, registry);
    expect(partial.observedAt).toBe(market.observedAt);
    expect(partial.combined).toBeNull();
    expect(partial.signs[0].value).toBeNull();
    expect(partial.reportedCount).toBe(11);
    const html = renderGapPage({ market: partial, audience, ogPath: '/partial.png' });
    expect(html).toContain('Combined value unavailable');
    expect(html).toContain('Missing values are not zero.');
    expect(html).toContain('Not reported');
    for (const asset of entry.assets) asset.marketCapUsd = null;
    entry.totals.marketCapUsd = null;
    entry.totals.marketCapAssetCount = 0;
    expect(shapeGapMarket(copy, registry).subtotal).toBeNull();
  });

  it('preserves reported zero and rejects invalid values rather than fabricating them', () => {
    const copy = latestOnly();
    const entry = copy.snapshots[0];
    entry.totals.marketCapUsd -= entry.assets[0].marketCapUsd;
    entry.assets[0].marketCapUsd = 0;
    expect(shapeGapMarket(copy, registry).signs[0].value).toBe(0);
    for (const invalid of [-1, undefined, '100']) {
      entry.assets[0].marketCapUsd = invalid;
      expect(() => shapeGapMarket(copy, registry)).toThrow();
    }
  });

  it('requires attributed, dated audience facts and preserves owner review', () => {
    expect(shapeAudience(audience).ownerReviewRequired).toBe(true);
    for (const fact of audience.facts) {
      expect(fact.sourceName).toBe('YouGov 2022 survey');
      expect(fact.sourceUrl).toContain('/42292-one-four-americans-say-they-believe-astrology');
      expect(fact.asOfDate).toBe('2022-04-22');
    }
    for (const mutate of [
      (fact) => { fact.sourceUrl = null; },
      (fact) => { delete fact.asOfDate; },
      (fact) => { fact.label = 'Tokens could reach a price target'; },
    ]) {
      const copy = structuredClone(audience);
      mutate(copy.facts[0]);
      expect(() => shapeAudience(copy)).toThrow();
    }
  });

  it('publishes facts, distinct units and the existing disclosure without forecast words', async () => {
    const html = renderGapPage({ market, audience, ogPath: '/chart.png' });
    const main = html.match(/<main id="main">([\s\S]*?)<\/main>/)[1].replace(/<[^>]*>/g, ' ');
    expect(main).toContain(GAP_RISK_LINE);
    expect(main).toContain(GAP_CONTEXT);
    expect(main).not.toMatch(GAP_FORECAST_WORDS);
    expect(main).not.toMatch(/\b(?:BONK|billion|million)\b/i);
    expect(html).toContain(market.sourceUrl);
    expect(html).toContain(market.observedAt);
    const catalog = await readFile(new URL('../scripts/build-sign-pages.mjs', import.meta.url), 'utf8');
    const strings = await readFile(new URL('../src/strings/en.mjs', import.meta.url), 'utf8');
    expect(catalog).toContain('The price can change quickly and can fall to zero.');
    expect(strings).toContain(GAP_RISK_LINE.split('. ')[0] + '.');
    expect(html).toContain('class="zfooter zfooter--static"');
    expect(html).toContain('class="wnav-wrap"');
    expect(html).toContain('<meta name="robots" content="noindex, follow" />');
  });

  it('rebuilds byte-identical committed HTML, metadata and a 1200×630 PNG without fetching', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () => { throw new Error('Gap generation must stay offline'); };
    try {
      const first = await buildGapArtifacts();
      const second = await buildGapArtifacts();
      for (const [path, bytes] of Object.entries(first)) {
        expect(bytes.equals(second[path]), path).toBe(true);
        // Vite rewrites the navigation function serialized into HTML by the
        // shared wing renderer. Check committed HTML in the real plain-Node
        // generator rather than comparing that transformed function text.
        if (!path.endsWith('.html')) {
          expect(bytes.equals(await readFile(new URL(`../${path}`, import.meta.url))), path).toBe(true);
        }
        if (path.endsWith('.png')) {
          const image = PNG.sync.read(bytes);
          expect([image.width, image.height]).toEqual([1200, 630]);
        }
      }
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
