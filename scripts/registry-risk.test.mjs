import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const signs = [
  'aries',
  'taurus',
  'gemini',
  'cancer',
  'leo',
  'virgo',
  'libra',
  'scorpio',
  'sagittarius',
  'capricorn',
  'aquarius',
  'pisces',
];

function compact(value) {
  return value.replace(/\s+/g, ' ');
}

describe('Registry risk and trust copy', () => {
  it('keeps Consumer risk copy while the catalogue remains a read-only information surface', async () => {
    const [landingSource, signSource, footerSource] = await Promise.all([
      readFile(resolve(root, 'src/app.jsx'), 'utf8'),
      readFile(resolve(root, 'scripts/build-sign-pages.mjs'), 'utf8'),
      readFile(resolve(root, 'scripts/site-footer.mjs'), 'utf8'),
    ]);

    const landingText = compact(landingSource);
    expect(landingText).toContain('independent third-party');
    expect(landingText).toContain('can lose all market value');
    expect(landingText).toContain('lose all money');
    expect(landingText).toContain('cannot be reversed');
    expect(landingText).toContain('Verify the official mint, network, amount, and destination');
    expect(landingText).toContain('third-party onchain services');
    expect(landingText).toContain('/privacy/');
    expect(landingText).toContain('/terms/');
    expect(landingSource).not.toContain('leading onchain apps');
    expect(landingText).toContain('Operator and economic-interest statements remain pending confirmation');
    expect(landingText).toContain('Shown in zodiac order');
    expect(landingSource).not.toContain('The Standings');
    expect(landingSource).not.toContain('aria-label="Rank"');
    expect(landingSource).not.toMatch(/\.sort\(\(a, b\) => \(b\.marketCap/);

    const signText = compact(`${signSource}\n${footerSource}`);
    expect(signText).toContain('The price can change quickly and can fall to zero');
    expect(signText).not.toContain('This page only shows information. It cannot make a purchase or move money');
    expect(signText).not.toMatch(/Continue to Jupiter|jupiterSwapUrl|What do I need before I continue/);
    expect(signText).toContain('/disclosure/');
    expect(signText).toContain('/privacy/');
    expect(signText).toContain('/terms/');
    expect(signSource).not.toMatch(/Acquire via Jupiter|Open Jupiter route/);
    expect(signSource).not.toMatch(/renderTradeRegion|data-trade-panel|registry-trade:(?:start|slot|end)|\/assets\/trade\.js/);
  });

  it("keeps the gallery card's acquisition copy on the approved wording", async () => {
    const [generator, page] = await Promise.all([
      readFile(resolve(root, 'src/app.jsx'), 'utf8'),
      readFile(resolve(root, 'public/assets/app.js'), 'utf8'),
    ]);

    for (const source of [generator, page]) {
      const text = compact(source);
      // The CTA labels the risk suite pins on the other surfaces.
      expect(text).toContain('Open Jupiter route');
      expect(text).toContain('View market data');
      // The market-panel risk sentence and the read-only stance, verbatim.
      expect(text).toContain('not a valuation or recommendation');
      expect(text).toContain('can lose all market value');
      expect(text).toContain('does not request custody, signing, approvals, or transactions');
      expect(text).toContain('/disclosure/');
      expect(source).not.toContain('Acquire via Jupiter');
    }

    // The route is built at runtime from the live registry answer — the mint
    // itself is never baked into the page that hosts the card.
    const hub = await readFile(resolve(root, 'public/astrofolio/index.html'), 'utf8');
    expect(hub).not.toContain('jup.ag/swap/');
  });

  it('keeps the generated Registry application aligned with its canonical source', async () => {
    const bundle = await readFile(resolve(root, 'public/assets/app.js'), 'utf8');
    expect(bundle).toContain('third-party onchain services');
    expect(bundle).toContain('can lose all market value');
    expect(bundle).toContain('could lose all money');
    expect(bundle).toContain('not government, regulator, wallet, or exchange approval');
    expect(bundle).toContain('Market snapshot');
    expect(bundle).toContain('Shown in zodiac order');
    expect(bundle).not.toContain('The Standings');
    expect(bundle).not.toContain('leading onchain apps');
  });

  it('keeps detailed risk and service boundaries in the static technical record', async () => {
    const html = compact(await readFile(resolve(root, 'public/registry/technical/index.html'), 'utf8'));

    expect(html).toContain('“Official” means that an asset address appears in this Registry');
    expect(html).toContain('not government, regulator, wallet, or exchange approval');
    expect(html).toContain('value can fall to zero');
    expect(html).toContain('Acquisition links open independently operated third-party venues');
    expect(html).toContain('No purchase is required to explore the Registry or use Registry Collection');
    expect(html).toContain('Check a Zodiac address');
    expect(html).toContain('Never share a seed phrase or private key');
    expect(html).toContain('Origin receipts — 5 Jul 2024');
    expect(html).toContain(
      'Operator and economic-interest statements are published as dated operator attestations, not independently verified',
    );
    expect(html).toContain('href="/privacy/"');
    expect(html).toContain('href="/terms/"');
    expect(html).not.toMatch(/Verified Ownership|public ownership|Read-only site/i);
  });

  it('regenerates all twelve catalogue pages without a purchase route or venue link', async () => {
    for (const sign of signs) {
      const raw = await readFile(
        resolve(root, `public/registry/${sign}/index.html`),
        'utf8',
      );
      const html = compact(raw);
      const handoffs = [...raw.matchAll(
        /<a\b[^>]*href="(https:\/\/jup\.ag\/[^"]*)"[^>]*>/giu,
      )];

      expect(handoffs, sign).toHaveLength(0);
      expect(html, sign).toContain('The price can change quickly and can fall to zero');
      expect(html, sign).not.toContain('This page only shows information. It cannot make a purchase or move money');
      expect(html, sign).toContain('<span class="anchor-alias" id="acquire" aria-hidden="true"></span>');
      expect(html, sign).toContain('href="/privacy/"');
      expect(html, sign).toContain('href="/terms/"');
      expect(html, sign).not.toMatch(/Continue to Jupiter|Acquire via Jupiter|Open Jupiter route|data-trade-panel|zodiacs-registry-trade-enabled|registry-trade:(?:start|slot|end)|\/assets\/trade\.js/i);
    }
  });

  it('keeps the optional Shelf on the minimized same-origin holdings endpoint', async () => {
    const [source, bundle, privacy] = await Promise.all([
      readFile(resolve(root, 'src/app.jsx'), 'utf8'),
      readFile(resolve(root, 'public/assets/app.js'), 'utf8'),
      readFile(resolve(root, 'src/pages/privacy/index.astro'), 'utf8'),
    ]);

    for (const value of [source, bundle]) {
      expect(value).toContain('/api/aura-holdings');
      expect(value).not.toContain('api.mainnet-beta.solana.com');
      expect(value).not.toContain('getTokenAccountsByOwner');
      expect(value).not.toContain('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
    }
    expect(source).toContain('check only the twelve Registry mints');
    // The English privacy page dropped the Shelf, Terminal and Registry data-source disclosures on
    // 20 November 2026 (owner-approved); the translated privacy pages still carry them.
    expect(privacy).not.toContain("Zodiac Terminal's optional");
    expect(privacy).not.toContain('Dex Screener');
    expect(privacy).not.toContain('do not include a wallet address');
  });

  it('names the current blockchain-data provider in every translated privacy page', async () => {
    // The Aura/Shelf lookup forwards the public address to a third party;
    // the translated disclosures say WHICH third party and must be updated
    // together with the production RPC configuration. The English page
    // dropped this disclosure on 20 November 2026 (owner-approved).
    expect(await readFile(resolve(root, 'src/pages/privacy/index.astro'), 'utf8')).not.toContain('PublicNode');
    for (const path of [
      'src/pages/es/privacy/index.astro',
      'src/pages/fr/privacy/index.astro',
      'src/pages/it/privacy/index.astro',
      'src/pages/pt/privacy/index.astro',
    ]) {
      const html = await readFile(resolve(root, path), 'utf8');
      expect(html, path).toContain('PublicNode');
      expect(html, path).toContain('Allnodes');
    }
  });

  it('gives the Aura route a constrained browser connection policy', async () => {
    const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
    const route = config.headers.find((entry) => entry.source === '/registry/collection/(.*)');
    const csp = route?.headers?.find((header) => header.key === 'Content-Security-Policy')?.value ?? '';
    const referrer = route?.headers?.find((header) => header.key === 'Referrer-Policy')?.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'unsafe-inline' https://plausible.io");
    expect(csp).toContain("script-src-attr 'none'");
    expect(csp).toContain("connect-src 'self' https://plausible.io");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toMatch(/connect-src[^;]*\*/);
    // same-origin, never no-referrer: a no-referrer document policy makes the
    // browser serialize Origin as `null` on the page's own same-origin POSTs,
    // which the endpoint's CSRF gate must reject — the page would 403 itself.
    expect(referrer).toBe('same-origin');
  });

  it('revalidates the daily Registry outlook instead of caching it as an immutable asset', async () => {
    const config = JSON.parse(await readFile(resolve(root, 'vercel.json'), 'utf8'));
    const routes = config.headers.filter((entry) => entry.source === '/assets/registry-outlook.json');
    expect(routes).toHaveLength(1);
    const cacheHeaders = routes[0].headers.filter((header) => header.key === 'Cache-Control');
    expect(cacheHeaders).toHaveLength(1);
    const cacheControl = cacheHeaders[0].value;

    expect(cacheControl).toBe('public, max-age=0, must-revalidate');
    expect(cacheControl).not.toContain('immutable');
  });
});
