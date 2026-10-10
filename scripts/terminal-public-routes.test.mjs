import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFile(resolve(root, path), 'utf8');
const exists = async (path) => access(resolve(root, path)).then(() => true, () => false);

describe('Terminal public-route split', () => {
  it('serves the advanced market and research sources only from Terminal paths', async () => {
    expect(await exists('public/astrofolio/index.html')).toBe(true);
    expect(await exists('public/terminal/index.html')).toBe(true);
    expect(await exists('public/terminal/pro/index.html')).toBe(false);
    expect(await exists('public/terminal/markets/index.html')).toBe(true);
    expect(await exists('public/registry/exchange/index.html')).toBe(false);
    expect(await exists('src/pages/terminal/research/index.astro')).toBe(true);
    expect(await exists('src/pages/terminal/research/[slug].astro')).toBe(true);
    expect(await exists('src/pages/registry/research/index.astro')).toBe(false);
    expect(await exists('src/pages/registry/research/[slug].astro')).toBe(false);

    const markets = await read('public/terminal/markets/index.html');
    expect(markets).toContain('href="https://zodiacs.org/terminal/markets/"');
    expect(markets).toContain('"item": "https://zodiacs.org/terminal/"');
    expect(markets).not.toContain('https://zodiacs.org/registry/exchange/');

    const research = await read('src/pages/terminal/research/index.astro');
    const researchNote = await read('src/pages/terminal/research/[slug].astro');
    expect(research).toContain('path="/terminal/research/"');
    expect(research).toContain('href="/terminal/"');
    expect(researchNote).toContain('href="/terminal/"');
    expect(research).not.toContain('/registry/research/');
  });

  it('keeps the indexed Pro reading surface separate from the protected Markets route', async () => {
    const [consumer, pro, markets] = await Promise.all([
      read('public/astrofolio/index.html'),
      read('public/terminal/index.html'),
      read('public/terminal/markets/index.html'),
    ]);
    expect(pro).toContain('<link rel="canonical" href="https://zodiacs.org/terminal/" />');
    expect(pro).toContain('<meta name="zodiacs-registry-view" content="terminal-pro" />');
    expect(pro).toContain('<meta name="zodiacs-registry-exchange-enabled" content="0" />');
    expect(pro).not.toMatch(/<meta\s+name=["']robots["'][^>]*noindex/iu);
    // Owner addendum 2026-08-31: Astrofolio carries the marker, committed off.
    expect(consumer).toContain('<meta name="zodiacs-registry-exchange-enabled" content="0" />');
    expect(markets).toContain('<meta name="robots" content="noindex" />');
  });

  it('publishes Astrofolio for consumers and reserves Terminal for the market desk', async () => {
    const [consumer, pro] = await Promise.all([
      read('public/astrofolio/index.html'),
      read('public/terminal/index.html'),
    ]);
    expect(consumer).toContain('<title>Astrofolio · Choose your sign and see its official Zodiac token · Zodiacs.org</title>');
    expect(consumer).toContain('aria-label="Astrofolio navigation"');
    expect(consumer).toContain('/assets/astrofolio/v2/zodiac-ring-192.png');
    expect(consumer).toContain('/assets/astrofolio/v2/leo/astrofolio.webmanifest');
    expect(consumer).toContain('/assets/og/astrofolio/v5/faces.jpg');
    expect(consumer).not.toContain('/assets/og/astrofolio/v4/');
    expect(consumer).toContain('<meta property="og:image:type" content="image/jpeg" />');
    expect(consumer).not.toMatch(/Zodiac Terminal(?: Pro)?/u);
    expect(pro).toContain('<title>Terminal · Live Prices, Liquidity &amp; Research · Zodiacs.org</title>');
    expect(pro).toContain('<h1 id="pro-static-title">Terminal</h1>');
    expect(pro).toContain('/assets/og/v6/terminal.png');
    expect(pro).not.toContain('/assets/astrofolio/v2/');
    expect(pro).toContain('title="Zodiacs.org Markets Research"');
    expect(pro).not.toContain('Zodiac Markets Research');
    expect(pro).toContain('<a class="pro-static-hero__switch" href="/astrofolio/" data-terminal-static-view="consumer">Astrofolio');
    expect(pro).not.toMatch(/Zodiac Terminal(?: Pro)?/u);
  });

  it('redirects legacy consumer routes directly to Astrofolio, legacy Pro to Terminal and Market Lens to Zodiacs Desk', async () => {
    const config = JSON.parse(await read('vercel.json'));
    const redirects = new Map(config.redirects.map((rule) => [rule.source, rule]));
    const expected = {
      '/collect': '/astrofolio/',
      '/collect/': '/astrofolio/',
      '/registry/shelf': '/astrofolio/',
      '/registry/shelf/': '/astrofolio/',
      '/registry/gallery': '/astrofolio/',
      '/registry/gallery/': '/astrofolio/',
      '/terminal/pro': '/terminal/',
      '/terminal/pro/': '/terminal/',
      '/registry/exchange': '/terminal/markets/',
      '/registry/exchange/': '/terminal/markets/',
      '/registry/exchange/:path(.*)': '/terminal/markets/:path',
      '/registry/research': '/terminal/research/',
      '/registry/research/': '/terminal/research/',
      '/registry/research/:path(.*)': '/terminal/research/:path',
      '/terminal/lens': '/terminal/desk/',
      '/terminal/lens/': '/terminal/desk/',
      '/terminal/lens/:path(.*)': '/terminal/desk/:path',
    };

    for (const [source, destination] of Object.entries(expected)) {
      expect(redirects.get(source)?.destination, source).toBe(destination);
      expect(redirects.get(source)?.permanent, source).toBe(true);
    }
  });

  it('hands old consumer-only Terminal hashes to Astrofolio without dropping state', async () => {
    const terminal = await read('public/terminal/index.html');
    expect(terminal).toContain("'verify', 'buy', 'faq', 'the-twelve', 'thesis'");
    expect(terminal).toContain("'official-twelve', 'market-snapshot', 'registry'");
    for (const sign of ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']) {
      expect(terminal).toContain(`'${sign}'`);
    }
    expect(terminal).toContain("location.replace('/astrofolio/' + location.search + location.hash)");
  });

  it('keeps no-store, noindex, and the provider allowlist on the new markets route', async () => {
    const config = JSON.parse(await read('vercel.json'));
    const rule = config.headers.find(({ source }) => source === '/terminal/markets/(.*)');
    const headers = new Map(rule?.headers.map(({ key, value }) => [key, value]));
    expect(headers.get('Cache-Control')).toBe('no-store');
    expect(headers.get('X-Robots-Tag')).toBe('noindex, noarchive');
    expect(headers.get('Content-Security-Policy')).toContain('https://api.geckoterminal.com');
    expect(headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

  it('keeps the generated research ledger and feeds on canonical Terminal URLs', async () => {
    const drafts = JSON.parse(await read('src/data/registry-research/drafts.json'));
    expect(drafts.items.length).toBeGreaterThan(0);
    expect(new Set(drafts.items.map((item) => item.id)).size).toBe(drafts.items.length);
    for (const item of drafts.items) {
      expect(item.url).toBe(`/terminal/research/${item.slug}/`);
    }

    const feed = await read('src/pages/feeds/market-research.json.ts');
    const sitemap = await read('src/pages/sitemap.xml.ts');
    const legacyUrls = await read('src/lib/legacy/urls.ts');
    expect(feed).toContain("home_page_url: 'https://zodiacs.org/terminal/research/'");
    expect(sitemap).toContain("'/terminal/research/'");
    expect(sitemap).toContain("['/astrofolio/', AUDIT_REMEDIATION_LASTMOD]");
    expect(sitemap).toContain("['/terminal/', AUDIT_REMEDIATION_LASTMOD]");
    expect(legacyUrls).toContain("{ path: '/astrofolio/', priority: 0.8 }");
    expect(legacyUrls).toContain("{ path: '/terminal/', priority: 0.78 }");
    expect(sitemap).not.toContain("'/registry/research/'");
  });

  it('keeps research breadcrumbs inside the Terminal identity', async () => {
    const [index, article] = await Promise.all([
      read('src/pages/terminal/research/index.astro'),
      read('src/pages/terminal/research/[slug].astro'),
    ]);
    for (const source of [index, article]) {
      expect(source).toContain("name: 'Terminal', item: 'https://zodiacs.org/terminal/'");
      expect(source).not.toContain("name: 'Astrofolio'");
    }
    expect(index).toContain('jsonLd={[terminalResearchCollection, terminalResearchBreadcrumb]}');
    expect(index).toContain("isPartOf: { '@id': 'https://zodiacs.org/#site' }");
    expect(index).not.toContain('https://zodiacs.org/#website');
    expect(article).toContain('jsonLd={[terminalResearchBreadcrumb]}');
  });
});
